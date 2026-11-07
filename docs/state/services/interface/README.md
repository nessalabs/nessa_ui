---
id: "ui-interface"
title: "Interface foundations"
kind: "service"
status: "implemented"
summary: "Start with [theme and scope](theme.md), then choose [inputs and selection](inputs.md) and [floating layers](layers.md). These components own local interaction and accessibility. Your application decides what a selection means and whether a change is saved."
parent: "nessa-ui"
sources:
  [
    "packages/react/src/provider/nessa-provider.tsx",
    "packages/react/src/lib/portal-container.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Set up the interface

Start with [theme and scope](theme.md), then choose [inputs and selection](inputs.md) and [floating layers](layers.md). These components own local interaction and accessibility. Your application decides what a selection means and whether a change is saved.

A menu needs two answers: where its portal lands, and which theme it carries. A dark provider does not move every portal beneath its DOM element. See the layer page before putting a picker inside a modal panel.
