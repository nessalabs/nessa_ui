---
id: "ui-layout"
title: "Layout and panels"
kind: "contract"
status: "implemented"
summary: "AppShell and Sidebar arrange the application frame, while SplitView divides a region into resizable panels. They organize supplied content; they do not choose application routes, save workspace state or establish a connection."
parent: "ui-workspace"
sources:
  [
    "packages/react/src/composites/app-shell/index.ts",
    "packages/react/src/lib/app-shell-layout/index.ts",
    "packages/react/src/components/sidebar.tsx",
    "packages/react/src/components/split-view/index.ts",
    "packages/react/src/components/breadcrumb.tsx",
    "packages/react/src/components/page-outline.tsx",
    "packages/react/src/components/pagination.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Compose the application frame

AppShell and Sidebar arrange the application frame, while SplitView divides a region into resizable panels. They organize supplied content; they do not choose application routes, save workspace state or establish a connection.

The app-shell layout library is a separate pure model exported for consumers that need to compute a layout. SplitView exposes panel sizing and a separator with pointer/keyboard interaction. The host decides which widths or collapsed panels to retain across visits. A layout adjustment in memory is not a saved preference.

Breadcrumb supplies a navigation trail from host items. PageOutline links headings within a reading surface. Pagination presents page navigation, and Tabs/SegmentedControl select among supplied content. The host must define the route or data request behind those callbacks; there is no implicit remote pagination.

Layout and content lifetimes are separate. A resizable panel can keep its child mounted, whereas a [WindowDeck](windows.md) can unmount inactive content under its default policy. Inspect that policy before putting unsaved editor state inside a switchable window. Portal destinations also remain separate from layout dimensions; a transformed or clipping ancestor should not accidentally own every floating menu.
