---
id: "ui-windows"
title: "Window decks"
kind: "contract"
status: "implemented"
summary: "WindowDeck presents panes as a focused carousel or an overview. It owns the visual transition, focused pane and dismissal interaction; the host owns pane content and decides when a dismissed pane is actually removed."
parent: "ui-workspace"
sources:
  [
    "packages/react/src/components/window-deck/window-deck.tsx",
    "packages/react/src/components/window-deck/window-deck-pane.tsx",
    "packages/react/src/components/window-deck/window-deck-layout.ts",
    "packages/react/src/components/window-deck/window-deck-shortcuts.ts",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Switch windows without losing host state

WindowDeck presents panes as a focused carousel or an overview. It owns the visual transition, focused pane and dismissal interaction; the host owns pane content and decides when a dismissed pane is actually removed.

`contentMount="active"` is the default: only the active window's content stays alive. Overview tiles use their preview or empty chrome and distant panes remain frames. A component-local editor draft can therefore disappear on a window switch. Keep durable work above the deck, or choose `contentMount="always"` when every hidden tree must remain mounted. Keeping a tree mounted still does not establish that an external process is running.

Active pane and mode can be controlled by props/callbacks or initialized with defaults. The default shortcuts use Mod+G for overview and Mod+Arrow for switching. Hosts can rebind or disable mapped actions; Escape still leaves overview and Delete dismisses the focused tile. The implementation distinguishes editable targets so navigation shortcuts do not blindly steal editing gestures.

Pane width defaults relative to the deck query container; percentages would resolve against the whole rail instead. Overview geometry, motion timing and shortcuts have pure/unit tests in the executed suite. Those tests do not replace a real browser test of drag, focus, animation or the host's retained content policy.
