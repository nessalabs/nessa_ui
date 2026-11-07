---
id: "ui-tables"
title: "Tables and large lists"
kind: "contract"
status: "implemented"
summary: "Table supplies semantic table chrome, scrolling and overflow affordances. VirtualList reduces mounted rows for a large fixed-height list. A host must choose between mounting every row and saving render work."
parent: "ui-workspace"
sources:
  [
    "packages/react/src/components/virtual-list.tsx",
    "packages/react/src/components/table/table.tsx",
    "packages/react/src/components/table/table-toolbar.tsx",
    "packages/react/src/components/table/table-pagination.tsx",
    "packages/react/src/components/git-history/index.tsx",
    "packages/react/src/components/file-diff-list.tsx",
    "packages/react/src/lib/size-observer.ts",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Keep large lists readable

Table supplies semantic table chrome, scrolling and overflow affordances. VirtualList reduces mounted rows for a large fixed-height list. A host must choose between mounting every row and saving render work.

VirtualList defaults to a 400px viewport, 40px rows and five extra rows on each side. It requires positive finite dimensions and a nonnegative integer overscan, otherwise it throws RangeError. Give every item a stable key and ensure content fits the fixed row height. A focused row remains mounted even outside the normal window; other offscreen rows unmount. Keep durable row edits in the host.

Set `virtualize=false` when browser Find or complete DOM/accessibility traversal matters more than windowing. GitHistory defaults to virtualization; FileDiffList opts into it. Do not assume offscreen rows can be found just because the full dataset exists in memory. `itemAsChild` requires a child that forwards position/semantics props; `as="ul"` preserves native list composition.

Table makes its scroll container focusable only when it actually overflows, including a host-imposed height cap. Supply a container label for that region. Sticky headers need appropriate scroll padding so focused controls are not hidden beneath them. Edge fades indicate hidden columns, including physical left/right under RTL. TableToolbar and TablePagination offer controls; sorting, filtering and fetching belong to the host.

VirtualList's optional debug trace is bounded and removed on unmount. The shared size observer responds to size/content/font changes; pure math/unit checks are not proof of every browser's scrolling or focus behavior.
