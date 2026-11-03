---
id: "ui-layers"
title: "Menus and modal panels"
kind: "contract"
status: "implemented"
summary: "A floating control needs a destination where it remains interactive and the appearance of the scope that opened it. PortalContainerProvider supplies the destination; the layer scope carries theme, mode and scale attributes even when the content is outside the provider's DOM subtree."
parent: "ui-interface"
sources:
  [
    "packages/react/src/lib/portal-container.tsx",
    "packages/react/src/components/dialog.tsx",
    "packages/react/src/components/drawer.tsx",
    "packages/react/src/components/sheet.tsx",
    "packages/react/src/components/dropdown-menu.tsx",
    "packages/react/src/components/context-menu.tsx",
    "packages/react/src/components/popover-surface.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Place menus and modal panels

A floating control needs a destination where it remains interactive and the appearance of the scope that opened it. PortalContainerProvider supplies the destination; the layer scope carries theme, mode and scale attributes even when the content is outside the provider's DOM subtree.

For example, a menu inside a modal Sheet should use that panel's layer host. Sending it to the body can put it outside the modal's allowed interactive region. An explicit container overrides the nearest owner; `null` deliberately selects the body. NessaProvider supplies appearance without forcing every layer under an element that might clip it.

Dialog, Drawer and Sheet are panel surfaces with their own layout and interaction. DropdownMenu and ContextMenu use Radix menu primitives; PopoverSurface supplies shared chrome rather than a network operation. Tooltips, picker menus and access-mode menus consume the same portal/scope boundary. Drawer direction changes its measured axis; percentages resolve against its containing portal block.

Use [ChatOverlay](../chat/overlays.md) when only the transcript area should be covered and the composer must remain usable. That view is explicitly nonmodal. Do not infer that every surface named overlay traps Tab or makes the whole application inert. For exact panel props and accessible composition, the declaration and Storybook examples are the API reference; this page maps ownership rather than promising one identical dismissal policy for all primitives.
