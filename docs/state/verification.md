---
id: "ui-verification"
title: "Evidence and limits"
kind: "guide"
status: "implemented"
summary: "This atlas records a source review at a32191c26ee27c2d8159ab6498a0f0530a93e3ea. That checkpoint identifies the implementation described; it is not a claim that every component, provider or browser was exercised."
parent: "nessa-ui"
sources:
  ["package.json", "CONTRIBUTING.md", "AGENTS.md", "validation/README.md"]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Read the evidence and its limits

This atlas records a source review at a32191c26ee27c2d8159ab6498a0f0530a93e3ea. That checkpoint identifies the implementation described; it is not a claim that every component, provider or browser was exercised.

The untouched baseline installed with pnpm 11.9.0 and the frozen lockfile. `pnpm validate` reported 14 PASS, 0 FAIL, 9 existing exceptions, 3 planned and 3 review items. `pnpm typecheck` passed all workspace and validation types. `pnpm test:unit` passed 679 tests in 77 suites with 0 failures/skips. These include provider fixtures, scheduling/geometry, size observation, layout and Mermaid queue behavior.

`pnpm validate:full` passed after installing its pinned Playwright runtimes. It ran 128 validator tests, workspace typechecks, 1,517 Chromium/default and reduced-motion cases, 114 Firefox/WebKit cases, the 679 unit tests and 13 server-render tests. It also rebuilt package artifacts, reproduced all 127 registry artifacts, checked both package manifests and consumer declarations/budgets, and rendered all 119 built Storybook documentation pages. Its protected-tree check found no mutation. The initial attempt had stopped for missing browser executables before browser assertions; that setup problem was resolved for the successful run.

These checks exercise repository fixtures and built artifacts. They do not establish live provider compatibility or a consuming application's save/send logic. No external application was installed and no package was published. Repository instructions prohibit invoking verify.sh/precommit unless explicitly requested; neither was used.

Selected TLA models represent ownership/race rules, not the TypeScript implementation. Each requires canonical TLC baseline, semantic negative controls and independent source-aware adversarial review. All five baselines passed nine invariants across 165 aggregate states; all nine negative controls broke the expected rule without unchecked results. [Exact receipts](../../verification/state-models/results.json), [mutations](../../verification/state-models/controls.json) and [source/adversarial review](../../verification/state-models/review.md) record the scope. Independent review corrected the Mermaid model to separate a released queue link from the still-running renderer, then verified the isolated quarantine control. The inventory maps unmodeled contract families explicitly rather than suggesting a model exists for every widget.

[Implementation checks](../../verification/state-models/implementation-checks.json) record exact commands, tool versions and limitations. [Independent reader/source review](../../verification/state-models/independent-review.md) used six realistic tasks. Chrome opened all 31 pages and rendered six diagrams with no errors; [browser results](../../verification/state-models/browser-results.json) and [normal chart-detail checks](../../verification/state-models/reader-browser.json) retain that evidence. This checks the atlas, not the actual library components.

With a built Nessa Docs checkout and its pinned checker cache installed, reproduce all models and controls:

```sh
NESSA_DOCS_ROOT=/absolute/nessa-docs node scripts/state-docs/verify.mjs --write
```

This adapter imports the canonical catalog/checker and writes only original model receipts into pages. It does not install the checker. Catalog validation checks links/metadata; browser reading checks charts/navigation; neither proves runtime behavior.
