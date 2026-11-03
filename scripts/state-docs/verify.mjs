#!/usr/bin/env node
// Nessa Docs owns catalog validation, checker pins, bounds and result serialization.
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
if (
  process.argv.slice(2).some((a) => a !== "--write") ||
  process.argv.slice(2).length > 1
)
  throw new Error("Usage: node scripts/state-docs/verify.mjs [--write]");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const renderer = process.env.NESSA_DOCS_ROOT;
if (!renderer)
  throw new Error(
    "Set NESSA_DOCS_ROOT to a built nessalabs/nessa-docs checkout.",
  );
const mod = (p) => import(pathToFileURL(join(renderer, "dist/server", p)).href);
const [
  { loadCatalog },
  { nodeRepositoryFiles },
  { createCheckerCache },
  { createModelCheckService },
  { writeModelCheckFile },
] = await Promise.all([
  mod("server/catalog.js"),
  mod("server/files.js"),
  mod("server/model-check/cache.js"),
  mod("server/model-check/service.js"),
  mod("server/model-check/record.js"),
]);
const files = nodeRepositoryFiles(),
  catalog = await loadCatalog(files, root);
if (!catalog.rootId || catalog.issues.length)
  throw new Error(JSON.stringify(catalog.issues));
const cache = createCheckerCache();
if ((await cache.status()).state !== "ready")
  throw new Error(
    "Canonical checker cache unavailable; install through Nessa Docs.",
  );
const service = createModelCheckService({
  files,
  loadCatalog: (p) => loadCatalog(files, p),
  runtime: () => cache.runtime(),
  status: () => cache.status(),
  install: (s) => cache.install(s),
});
const controls = JSON.parse(
  await readFile(join(root, "verification/state-models/controls.json"), "utf8"),
);
const results = {
  date: new Date().toISOString(),
  documents: catalog.documents.size,
  baselines: [],
  controls: [],
};
const pages = [...catalog.documents.values()].filter((p) => p.summary.model);
const ids = new Set(pages.map((p) => p.summary.id));
if (controls.some((c) => !ids.has(c.owner)))
  throw new Error("Control references unknown model owner");
const signal = new AbortController();
process.once("SIGINT", () => signal.abort());
process.once("SIGTERM", () => signal.abort());
let ok = true;
for (const page of pages) {
  const m = page.summary.model;
  const spec = await readFile(join(root, "docs/state", m.spec), "utf8"),
    config = await readFile(join(root, "docs/state", m.config), "utf8");
  const input = {
    spec,
    config,
    sourceRevision: page.summary.sourceRevision,
    configPath: m.config,
    steps: m.steps,
    nodeIds: [],
  };
  const baseline = await service.checkText(input, signal.signal);
  results.baselines.push({ owner: page.summary.id, ...baseline });
  console.error(page.summary.id, baseline.state);
  if (
    baseline.state !== "passed" ||
    !baseline.result ||
    baseline.result.unchecked.length ||
    baseline.result.broke.length
  ) {
    ok = false;
    continue;
  }
  if (process.argv.includes("--write"))
    await writeModelCheckFile(root, page.summary.file, baseline.result);
  const cases = controls.filter((c) => c.owner === page.summary.id);
  if (!cases.length) {
    ok = false;
    continue;
  }
  for (const c of cases) {
    if (spec.split(c.from).length !== 2)
      throw new Error(`Mutation must match exactly once: ${c.name}`);
    const run = await service.checkText(
      { ...input, spec: spec.replace(c.from, c.to) },
      signal.signal,
    );
    const passed =
      run.result?.broke.some((b) => b.rule === c.rule) &&
      run.result.unchecked.length === 0 &&
      !run.result.stop;
    results.controls.push({
      name: c.name,
      owner: c.owner,
      expected: c.rule,
      passed: Boolean(passed),
      ...run,
    });
    ok &&= Boolean(passed);
    console.error(c.name, passed ? "expected failure" : "FAILED CONTROL");
  }
}
results.ok = ok && pages.length > 0;
await writeFile(
  join(root, "verification/state-models/results.json"),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    ok: results.ok,
    documents: results.documents,
    models: results.baselines.length,
    controls: results.controls.length,
  }),
);
process.exitCode = results.ok ? 0 : 1;
