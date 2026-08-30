import ts from "typescript"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"
import { hasUnscopedUniversal, ruleOwnsGlobalReset, selectorOwnership } from "./css-ownership.ts"

interface PackageJson {
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  bundledDependencies?: readonly string[]
  bundleDependencies?: readonly string[]
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, unknown>
  exports?: Record<string, unknown>
  sideEffects?: string[] | boolean
  files?: string[]
  scripts?: Record<string, string>
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`
  return JSON.stringify(value)
}

export function hasUseClientDirective(source: string): boolean {
  return /^\s*["']use client["'];?/.test(source)
}

/**
 * Every module specifier a source file pulls in, in every spelling.
 *
 * Read off the AST rather than matched in text, because the spellings that
 * matter here are exactly the ones a `from "react"` regex misses: a
 * side-effect `import "react"`, `await import("react")`, `require("react")`,
 * and `react/jsx-runtime`. A regex also matches inside comments and strings,
 * so it fails in both directions.
 */
export function moduleSpecifiers(source: string, filePath: string): string[] {
  const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const record = (node: ts.Node | undefined) => {
    if (node && ts.isStringLiteralLike(node)) found.push(node.text)
  }
  ast.forEachChild(function step(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) record(node.moduleSpecifier)
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) record(node.moduleReference.expression)
    else if (ts.isCallExpression(node)) {
      const callee = node.expression
      const isDynamic = callee.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(callee) && callee.text === "require"
      if (isDynamic || isRequire) record(node.arguments[0])
    }
    ts.forEachChild(node, step)
  })
  return found
}

/** React, in any of the entry points that would drag the framework back in. */
export function isReactSpecifier(specifier: string): boolean {
  return specifier === "react" || specifier === "react-dom" || specifier.startsWith("react/") || specifier.startsWith("react-dom/")
}

export function packageDeclarationIssues(pkg: PackageJson): string[] {
  const issues: string[] = []
  if (pkg.peerDependencies?.react !== ">=19.0.0" || pkg.peerDependencies?.["react-dom"] !== ">=19.0.0") issues.push("react peers")
  const expectedExports: Record<string, unknown> = {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./styles.css": "./dist/styles.css",
    "./theme.css": "./dist/theme.css",
    "./app.css": "./dist/app.css",
  }
  if (canonicalJson(pkg.exports) !== canonicalJson(expectedExports)) issues.push("exact exports")
  if (!Array.isArray(pkg.sideEffects) || !pkg.sideEffects.includes("**/*.css")) issues.push("css side effects")
  if (pkg.scripts?.prepack !== "pnpm build") issues.push("prepack build")
  for (const file of ["dist", "README.md", "LICENSE"]) if (!pkg.files?.includes(file)) issues.push(`published ${file}`)
  return issues
}

/**
 * The parser package's declarations, which are the layering made enforceable.
 *
 * `@nessa-ui/agent-stream` stops at the agent message and draws nothing, so its
 * independence is not a style preference — a declared dependency or a React
 * peer would put the rendering tree back in front of any Node process, server
 * component, or non-React host that wants only the event log. The exports map
 * is checked exactly because the two-entry split *is* the boundary: collapsing
 * the fold back into `.` would silently re-merge the layers this package exists
 * to keep apart.
 */
export function parserPackageDeclarationIssues(pkg: PackageJson): string[] {
  const issues: string[] = []
  // Every field that can put a package on a consumer's disk, not just the
  // obvious one: moving an entry to `optionalDependencies` still installs it.
  const installs =
    Object.keys(pkg.dependencies ?? {}).length +
    Object.keys(pkg.optionalDependencies ?? {}).length +
    (pkg.bundledDependencies?.length ?? 0) +
    (pkg.bundleDependencies?.length ?? 0)
  if (installs) issues.push("no dependencies")
  if (Object.keys(pkg.peerDependencies ?? {}).length || Object.keys(pkg.peerDependenciesMeta ?? {}).length) issues.push("no peers")
  const expectedExports: Record<string, unknown> = {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./transcript": { types: "./dist/transcript.d.ts", import: "./dist/transcript.js" },
  }
  if (canonicalJson(pkg.exports) !== canonicalJson(expectedExports)) issues.push("exact exports")
  if (pkg.sideEffects !== false) issues.push("side effect free")
  if (pkg.scripts?.prepack !== "pnpm build") issues.push("prepack build")
  for (const file of ["dist", "README.md", "LICENSE"]) if (!pkg.files?.includes(file)) issues.push(`published ${file}`)
  return issues
}

/**
 * Whether the contract entry can reach the fold, following relative imports.
 *
 * The exports map can promise a two-entry split while `src/index.ts` quietly
 * re-exports the fold, and every other check here would still pass: the map is
 * unchanged, no dependency appears, no React is imported. What breaks is
 * invisible. The fold's two modules import each other's *values*
 * (`fold.ts` takes `TranscriptBuilder`, `builder.ts` takes `assembleTurn`), so
 * pulling them into the contract entry drags that cycle across an entry
 * boundary. Worse, `@nessa-ui/react` re-exports both entries with `export *`;
 * a name exported by two of those is ambiguous, and ES semantics elide it
 * *silently*, so the React package would drop every fold symbol from its
 * public API with a green typecheck and no error anywhere but a consumer's
 * call site.
 *
 * Walking the graph is what makes the layering a fact rather than a comment.
 */
const CONTRACT_ENTRY = "packages/agent-stream/src/index.ts"
const FOLD_ROOT = "packages/agent-stream/src/transcript/"

export async function foldReachableFromContract(context: {
  readText(filePath: string): Promise<string>
  files: { has(filePath: string): boolean }
}): Promise<string[]> {
  const resolve = (fromPath: string, specifier: string): string | null => {
    if (!specifier.startsWith(".")) return null
    const segments = `${fromPath.slice(0, fromPath.lastIndexOf("/"))}/${specifier}`.split("/")
    const stack: string[] = []
    for (const segment of segments) {
      if (segment === "." || segment === "") continue
      if (segment === "..") stack.pop()
      else stack.push(segment)
    }
    const base = stack.join("/")
    for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
      if (context.files.has(candidate)) return candidate
    }
    return null
  }

  const reached: string[] = []
  const seen = new Set<string>()
  const queue = [CONTRACT_ENTRY]
  while (queue.length) {
    const current = queue.shift()!
    if (seen.has(current)) continue
    seen.add(current)
    if (!context.files.has(current)) continue
    for (const specifier of moduleSpecifiers(await context.readText(current), current)) {
      const target = resolve(current, specifier)
      if (!target) continue
      if (target.startsWith(FOLD_ROOT)) reached.push(target)
      else queue.push(target)
    }
  }
  return [...new Set(reached)].sort()
}

export const packageArtifactsCheck = defineCheck({
  id: "package-artifacts",
  ...checkMetadata["package-artifacts"],
  async run(context) {
    const findings = []
    const pkg = await context.readJson<PackageJson>("packages/react/package.json")
    const issues = new Set(packageDeclarationIssues(pkg))
    if (issues.has("react peers")) {
      findings.push(context.fail("React and React DOM peer floors must remain explicit at >=19.0.0.", { contractId: "PKG-001" }))
    }
    if (issues.has("exact exports")) findings.push(context.fail("Package exports must exactly map root types/import and the three CSS contracts to their intended dist artifacts.", { contractId: "PKG-002" }))
    if (issues.has("css side effects")) findings.push(context.fail("CSS side effects declaration is missing.", { contractId: "PKG-002" }))
    if (issues.has("prepack build")) findings.push(context.fail("prepack must build a fresh package.", { contractId: "PKG-003" }))
    for (const file of ["dist", "README.md", "LICENSE"]) {
      if (issues.has(`published ${file}`)) findings.push(context.fail(`Published files omit ${file}.`, { contractId: "PKG-003" }))
    }
    if (!context.files.has("packages/react/LICENSE") || !context.files.has("packages/react/README.md")) {
      findings.push(context.fail("Package README or LICENSE is absent.", { contractId: "PKG-003" }))
    }
    const parser = await context.readJson<PackageJson>("packages/agent-stream/package.json")
    const parserIssues = new Set(parserPackageDeclarationIssues(parser))
    if (parserIssues.has("no dependencies")) {
      findings.push(context.fail("The parser package must install nothing: no dependencies, optional dependencies, or bundled dependencies.", { contractId: "PKG-001" }))
    }
    if (parserIssues.has("no peers")) {
      findings.push(context.fail("The parser package must declare no peer dependencies, so a non-React host can consume it.", { contractId: "PKG-001" }))
    }
    if (parserIssues.has("exact exports")) findings.push(context.fail("The parser package must export exactly the contract entry and the transcript subpath.", { contractId: "PKG-002" }))
    if (parserIssues.has("side effect free")) findings.push(context.fail("The parser package must declare itself side-effect free.", { contractId: "PKG-002" }))
    if (parserIssues.has("prepack build")) findings.push(context.fail("The parser package's prepack must build a fresh package.", { contractId: "PKG-003" }))
    for (const file of ["dist", "README.md", "LICENSE"]) {
      if (parserIssues.has(`published ${file}`)) findings.push(context.fail(`The parser package's published files omit ${file}.`, { contractId: "PKG-003" }))
    }
    if (!context.files.has("packages/agent-stream/LICENSE") || !context.files.has("packages/agent-stream/README.md")) {
      findings.push(context.fail("The parser package's README or LICENSE is absent.", { contractId: "PKG-003" }))
    }

    // Source-level independence. The manifest can promise a framework-free
    // package while an import quietly reintroduces one, and a stray client
    // directive would strand the parser behind a React boundary again.
    for (const filePath of context.files.match(["packages/agent-stream/src/**/*.ts"])) {
      const source = await context.readText(filePath)
      if (hasUseClientDirective(source)) {
        findings.push(context.fail("The parser must not carry a React client boundary.", { contractId: "PKG-001", path: filePath }))
      }
      if (moduleSpecifiers(source, filePath).some(isReactSpecifier)) {
        findings.push(context.fail("The parser must not import React.", { contractId: "PKG-001", path: filePath }))
      }
    }

    for (const reached of await foldReachableFromContract(context)) {
      findings.push(context.fail(
        "The contract entry must not reach the fold: re-exporting it inlines the transcript/builder cycle and makes @nessa-ui/react's two star-exports ambiguous, which elides every fold symbol from its public API without an error.",
        { contractId: "PKG-002", path: reached },
      ))
    }

    if (!findings.length) findings.push(context.pass("Package peer, export, side-effect, and publication declarations are intact, and the parser package stays framework-free.", { contractId: "PKG-001" }))
    return findings
  },
})

export const packageArtifactsBuiltCheck = defineCheck({
  id: "package-artifacts-built",
  ...checkMetadata["package-artifacts-built"],
  async run(context) {
    const findings = []
    for (const filePath of [
      "packages/react/dist/index.js",
      "packages/react/dist/index.d.ts",
      "packages/react/dist/theme.css",
      "packages/react/dist/styles.css",
      "packages/react/dist/app.css",
    ]) {
      if (!context.files.has(filePath)) findings.push(context.fail(`Fresh package build omitted ${filePath}.`, { contractId: "PKG-003", path: filePath }))
    }
    for (const modulePath of context.files.match(["packages/react/dist/**/*.js"])) {
      if (!hasUseClientDirective(await context.readText(modulePath))) {
        findings.push(context.fail("Built package module lost its React client boundary.", { contractId: "PKG-003", path: modulePath }))
      }
    }
    if (context.files.has("packages/react/dist/styles.css")) {
      const styles = await context.parseCss("packages/react/dist/styles.css")
      let forbidden = false
      styles.walkRules((rule) => { forbidden ||= ruleOwnsGlobalReset(rule) })
      if (forbidden) {
        findings.push(context.fail("Built styles.css contains Preflight/body ownership.", { contractId: "CSS-002" }))
      }
    }
    if (context.files.has("packages/react/dist/app.css")) {
      const app = await context.parseCss("packages/react/dist/app.css")
      let hasBodyBaseline = false
      let hasPreflightReset = false
      app.walkRules((rule) => {
        const declarations = new Map(rule.nodes.filter((node): node is import("postcss").Declaration => node.type === "decl").map((declaration) => [declaration.prop, declaration.value]))
        if (selectorOwnership(rule.selector).body && declarations.get("background-color") === "var(--background)" && declarations.get("color") === "var(--foreground)") hasBodyBaseline = true
        if (hasUnscopedUniversal(rule.selector) && declarations.get("box-sizing") === "border-box" && declarations.get("margin") === "0" && declarations.get("padding") === "0") hasPreflightReset = true
      })
      if (!hasPreflightReset || !hasBodyBaseline) {
        findings.push(context.fail("Built app.css does not contain Preflight and body baseline.", { contractId: "CSS-003" }))
      }
    }
    if (!findings.length) findings.push(context.pass("Fresh package artifacts contain the required JS, declarations, and CSS ownership split.", { contractId: "PKG-003" }))
    return findings
  },
})
