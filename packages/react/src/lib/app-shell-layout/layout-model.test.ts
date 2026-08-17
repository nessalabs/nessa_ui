/** @responsibility Verifies the structural invariants and pure operations of the app-shell layout model. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  AppShellDockSide,
  PaneDropRegion,
  PaneSplitDirection,
  SplitOrientation,
} from "./layout-options"
import {
  normalizeAppShellLayout,
  normalizeWorkspaceLayout,
} from "./layout-normalize"
import {
  closePane,
  createAppShellLayout,
  createPaneNode,
  focusPane,
  insertRelativeTo,
  maximizePane,
  movePane,
  openView,
  removeNode,
  resizeDock,
  restorePane,
  setDockOpen,
  setSplitWeights,
  splitPane,
  swapPanes,
} from "./layout-operations"
import type {
  AppShellLayout,
  LayoutNode,
  SplitNode,
  WorkspaceLayout,
} from "./layout-types"

/**
 * Builds a layout document around a provided workspace tree.
 *
 * @param root - The workspace tree root.
 * @param activePaneId - The active pane id.
 * @returns A complete layout document for testing.
 */
function layoutWith(root: LayoutNode, activePaneId: string): AppShellLayout {
  const base = createAppShellLayout()

  return normalizeAppShellLayout({
    ...base,
    workspace: { root, activePaneId, recentPaneIds: [activePaneId] },
  })
}

describe("normalizeWorkspaceLayout", () => {
  test("collapses single-child splits and flattens same-orientation nesting", () => {
    const messy: WorkspaceLayout = {
      root: {
        type: "split",
        id: "s0",
        weight: 1,
        orientation: SplitOrientation.Horizontal,
        children: [
          createPaneNode({ id: "a", weight: 0.5 }),
          {
            type: "split",
            id: "s1",
            weight: 0.5,
            orientation: SplitOrientation.Horizontal,
            children: [
              createPaneNode({ id: "b", weight: 0.5 }),
              {
                type: "split",
                id: "s2",
                weight: 0.5,
                orientation: SplitOrientation.Vertical,
                children: [createPaneNode({ id: "c", weight: 1 })],
              },
            ],
          },
        ],
      },
      activePaneId: "a",
      recentPaneIds: ["a", "ghost"],
    }

    const normalized = normalizeWorkspaceLayout(messy)
    const root = normalized.root as SplitNode

    assert.equal(root.type, "split")
    assert.deepEqual(
      root.children.map((child) => child.id),
      ["a", "b", "c"],
    )
    assert.deepEqual(
      root.children.map((child) => child.weight),
      [0.5, 0.25, 0.25],
    )
    assert.deepEqual(normalized.recentPaneIds, ["a"])
  })

  test("is idempotent", () => {
    const layout = createAppShellLayout()
    const once = normalizeAppShellLayout(layout)

    assert.equal(normalizeAppShellLayout(once), once)
  })

  test("replaces a pane-less document with one empty pane", () => {
    const workspace: WorkspaceLayout = {
      root: {
        type: "split",
        id: "s0",
        weight: 1,
        orientation: SplitOrientation.Horizontal,
        children: [],
      },
      activePaneId: "ghost",
      recentPaneIds: ["ghost"],
    }

    const normalized = normalizeWorkspaceLayout(workspace)

    assert.equal(normalized.root.type, "pane")
    assert.equal(normalized.activePaneId, normalized.root.id)
    assert.deepEqual(normalized.recentPaneIds, [normalized.root.id])
  })

  test("repairs broken dock sizes and non-boolean open flags", () => {
    const layout = createAppShellLayout()
    const broken: AppShellLayout = {
      ...layout,
      docks: {
        ...layout.docks,
        [AppShellDockSide.Left]: { open: true, size: Number.NaN },
        [AppShellDockSide.Bottom]: { open: true, size: -50 },
      },
    }

    const normalized = normalizeAppShellLayout(broken)

    assert.equal(normalized.docks[AppShellDockSide.Left].size, 0)
    assert.equal(normalized.docks[AppShellDockSide.Bottom].size, 0)
    assert.equal(
      normalized.docks[AppShellDockSide.Right],
      layout.docks[AppShellDockSide.Right],
    )
  })

  test("heals dangling focus and maximize pointers", () => {
    const workspace: WorkspaceLayout = {
      root: {
        type: "split",
        id: "s0",
        weight: 1,
        orientation: SplitOrientation.Horizontal,
        children: [
          createPaneNode({ id: "a", weight: 0.5 }),
          createPaneNode({ id: "b", weight: 0.5 }),
        ],
      },
      activePaneId: "missing",
      recentPaneIds: ["missing", "b"],
      maximizedPaneId: "missing",
    }

    const normalized = normalizeWorkspaceLayout(workspace)

    assert.equal(normalized.activePaneId, "b")
    assert.equal(normalized.maximizedPaneId, undefined)
    assert.deepEqual(normalized.recentPaneIds, ["b"])
  })

  test("preserves a zero weight as a legal collapsed state", () => {
    const workspace: WorkspaceLayout = {
      root: {
        type: "split",
        id: "s0",
        weight: 1,
        orientation: SplitOrientation.Horizontal,
        children: [
          createPaneNode({ id: "a", weight: 0 }),
          createPaneNode({ id: "b", weight: 0.4 }),
          createPaneNode({ id: "c", weight: 0.6 }),
        ],
      },
      activePaneId: "b",
      recentPaneIds: ["b"],
    }

    const root = normalizeWorkspaceLayout(workspace).root as SplitNode

    assert.deepEqual(
      root.children.map((child) => child.weight),
      [0, 0.4, 0.6],
    )
  })

  test("resets invalid weights to an even distribution", () => {
    const workspace: WorkspaceLayout = {
      root: {
        type: "split",
        id: "s0",
        weight: 1,
        orientation: SplitOrientation.Vertical,
        children: [
          createPaneNode({ id: "a", weight: -2 }),
          createPaneNode({ id: "b", weight: Number.NaN }),
        ],
      },
      activePaneId: "a",
      recentPaneIds: ["a"],
    }

    const root = normalizeWorkspaceLayout(workspace).root as SplitNode

    assert.deepEqual(
      root.children.map((child) => child.weight),
      [0.5, 0.5],
    )
  })
})

describe("splitPane and closePane", () => {
  test("splitting across the axis wraps the pane in a new split", () => {
    const layout = layoutWith(createPaneNode({ id: "a", weight: 1 }), "a")
    const split = splitPane(layout, {
      paneId: "a",
      direction: PaneSplitDirection.Right,
      newPaneId: "b",
    })

    const root = split.workspace.root as SplitNode

    assert.equal(root.type, "split")
    assert.equal(root.orientation, SplitOrientation.Horizontal)
    assert.deepEqual(
      root.children.map((child) => child.id),
      ["a", "b"],
    )
    assert.equal(split.workspace.activePaneId, "b")
  })

  test("splitting along the parent axis inserts a sibling", () => {
    const layout = layoutWith(createPaneNode({ id: "a", weight: 1 }), "a")
    const twice = splitPane(
      splitPane(layout, {
        paneId: "a",
        direction: PaneSplitDirection.Right,
        newPaneId: "b",
      }),
      { paneId: "a", direction: PaneSplitDirection.Right, newPaneId: "c" },
    )

    const root = twice.workspace.root as SplitNode

    assert.deepEqual(
      root.children.map((child) => child.id),
      ["a", "c", "b"],
    )
    assert.deepEqual(
      root.children.map((child) => child.weight),
      [0.25, 0.25, 0.5],
    )
  })

  test("splitting up or left places the new pane before the target", () => {
    const layout = layoutWith(createPaneNode({ id: "a", weight: 1 }), "a")
    const split = splitPane(layout, {
      paneId: "a",
      direction: PaneSplitDirection.Up,
      newPaneId: "b",
    })

    const root = split.workspace.root as SplitNode

    assert.equal(root.orientation, SplitOrientation.Vertical)
    assert.deepEqual(
      root.children.map((child) => child.id),
      ["b", "a"],
    )
  })

  test("closePane is the inverse of splitPane", () => {
    const layout = layoutWith(
      {
        type: "split",
        id: "s0",
        weight: 1,
        orientation: SplitOrientation.Horizontal,
        children: [
          createPaneNode({ id: "a", weight: 0.5 }),
          createPaneNode({ id: "b", weight: 0.5 }),
        ],
      },
      "a",
    )

    for (const direction of Object.values(PaneSplitDirection)) {
      const split = splitPane(layout, {
        paneId: "a",
        direction,
        newPaneId: "temp",
      })
      const restored = closePane(split, { paneId: "temp" })

      assert.deepEqual(
        restored.workspace.root,
        layout.workspace.root,
        `direction ${direction}`,
      )
    }
  })

  test("closing the active pane focuses the most recently active survivor", () => {
    const layout = layoutWith(createPaneNode({ id: "a", weight: 1 }), "a")
    const three = splitPane(
      splitPane(layout, {
        paneId: "a",
        direction: PaneSplitDirection.Right,
        newPaneId: "b",
      }),
      { paneId: "b", direction: PaneSplitDirection.Down, newPaneId: "c" },
    )

    const focused = focusPane(three, { paneId: "b" })
    const closed = closePane(focused, { paneId: "b" })

    assert.equal(closed.workspace.activePaneId, "c")
    assert.equal(closed.workspace.recentPaneIds.includes("b"), false)
  })

  test("the last remaining pane never closes", () => {
    const layout = layoutWith(createPaneNode({ id: "a", weight: 1 }), "a")

    assert.equal(closePane(layout, { paneId: "a" }), layout)
  })

  test("rejects a split whose new pane or wrapper id is already taken", () => {
    const layout = layoutWith(
      {
        type: "split",
        id: "s0",
        weight: 1,
        orientation: SplitOrientation.Horizontal,
        children: [
          createPaneNode({ id: "a", weight: 0.5 }),
          createPaneNode({ id: "split:b", weight: 0.5 }),
        ],
      },
      "a",
    )

    const duplicatePane = splitPane(layout, {
      paneId: "a",
      direction: PaneSplitDirection.Right,
      newPaneId: "a",
    })
    const duplicateWrapper = splitPane(layout, {
      paneId: "a",
      direction: PaneSplitDirection.Down,
      newPaneId: "b",
    })

    assert.equal(duplicatePane, layout)
    assert.equal(duplicateWrapper, layout)
  })
})

describe("insertRelativeTo and removeNode", () => {
  test("returns the same root when the target is absent", () => {
    const root = createPaneNode({ id: "a", weight: 1 })

    assert.equal(
      insertRelativeTo(
        root,
        "missing",
        createPaneNode({ id: "b", weight: 1 }),
        PaneSplitDirection.Right,
        "wrap",
      ),
      root,
    )
    assert.equal(removeNode(root, "missing").removed, null)
  })

  test("removal grants the removed weight to the adjacent sibling", () => {
    const root: SplitNode = {
      type: "split",
      id: "s0",
      weight: 1,
      orientation: SplitOrientation.Horizontal,
      children: [
        createPaneNode({ id: "a", weight: 0.25 }),
        createPaneNode({ id: "b", weight: 0.25 }),
        createPaneNode({ id: "c", weight: 0.5 }),
      ],
    }

    const { root: next } = removeNode(root, "b")
    const children = (next as SplitNode).children

    assert.deepEqual(
      children.map((child) => child.weight),
      [0.5, 0.5],
    )
  })
})

describe("movePane and openView", () => {
  /** Three panes side by side: a | b | c, with b active. */
  const threeAcross = () =>
    layoutWith(
      {
        type: "split",
        id: "s0",
        weight: 1,
        orientation: SplitOrientation.Horizontal,
        children: [
          createPaneNode({ id: "a", weight: 0.5, views: ["one"] }),
          createPaneNode({ id: "b", weight: 0.25, views: ["two"] }),
          createPaneNode({ id: "c", weight: 0.25, views: ["three"] }),
        ],
      },
      "b",
    )

  test("dropping on an edge splits the target across the axis", () => {
    const moved = movePane(threeAcross(), {
      paneId: "c",
      targetPaneId: "a",
      region: PaneDropRegion.Top,
    })

    const root = moved.workspace.root as SplitNode
    const first = root.children[0] as SplitNode

    assert.equal(first.type, "split")
    assert.equal(first.orientation, SplitOrientation.Vertical)
    assert.deepEqual(
      first.children.map((child) => child.id),
      ["c", "a"],
    )
    assert.equal(moved.workspace.activePaneId, "c")
  })

  test("dropping on a same-axis edge inserts a sibling", () => {
    const moved = movePane(threeAcross(), {
      paneId: "c",
      targetPaneId: "a",
      region: PaneDropRegion.Left,
    })

    const root = moved.workspace.root as SplitNode

    assert.deepEqual(
      root.children.map((child) => child.id),
      ["c", "a", "b"],
    )
  })

  test("dropping on center merges views into the target", () => {
    const moved = movePane(threeAcross(), {
      paneId: "c",
      targetPaneId: "a",
      region: PaneDropRegion.Center,
    })

    const root = moved.workspace.root as SplitNode
    const target = root.children[0]

    assert.deepEqual(
      root.children.map((child) => child.id),
      ["a", "b"],
    )
    assert.equal(target.type, "pane")
    assert.deepEqual(target.type === "pane" ? target.views : [], [
      "one",
      "three",
    ])
    assert.equal(
      target.type === "pane" ? target.activeViewId : undefined,
      "three",
    )
    assert.equal(moved.workspace.activePaneId, "a")
  })

  test("moving onto itself or an unknown pane changes nothing", () => {
    const layout = threeAcross()

    assert.equal(
      movePane(layout, {
        paneId: "a",
        targetPaneId: "a",
        region: PaneDropRegion.Left,
      }),
      layout,
    )
    assert.equal(
      movePane(layout, {
        paneId: "a",
        targetPaneId: "ghost",
        region: PaneDropRegion.Left,
      }),
      layout,
    )
  })

  test("openView activates a view and focuses its pane", () => {
    const layout = threeAcross()
    const opened = openView(layout, { viewId: "four", paneId: "a" })

    const root = opened.workspace.root as SplitNode
    const pane = root.children[0]

    assert.equal(pane.type, "pane")
    assert.deepEqual(pane.type === "pane" ? pane.views : [], ["one", "four"])
    assert.equal(pane.type === "pane" ? pane.activeViewId : undefined, "four")
    assert.equal(opened.workspace.activePaneId, "a")
    assert.equal(openView(opened, { viewId: "four", paneId: "a" }), opened)
  })

  test("swapPanes exchanges positions while keeping each position's size", () => {
    const layout = threeAcross()
    const swapped = swapPanes(layout, { paneId: "c", withPaneId: "a" })
    const root = swapped.workspace.root as SplitNode

    assert.deepEqual(
      root.children.map((child) => child.id),
      ["c", "b", "a"],
    )
    assert.deepEqual(
      root.children.map((child) => child.weight),
      [0.5, 0.25, 0.25],
    )
    assert.deepEqual(
      root.children.map((child) => (child.type === "pane" ? child.views : [])),
      [["three"], ["two"], ["one"]],
    )
    assert.equal(swapped.workspace.activePaneId, "c")
    assert.equal(swapPanes(layout, { paneId: "a", withPaneId: "a" }), layout)
    assert.equal(
      swapPanes(layout, { paneId: "a", withPaneId: "ghost" }),
      layout,
    )
  })

  test("openView focuses a pane already showing the view", () => {
    const layout = threeAcross()
    const opened = openView(layout, { viewId: "one", paneId: "a" })

    assert.equal(opened.workspace.root, layout.workspace.root)
    assert.equal(opened.workspace.activePaneId, "a")
    assert.equal(openView(layout, { viewId: "ghost", paneId: "missing" }), layout)
  })
})

describe("weights, maximize, and docks", () => {
  test("setSplitWeights renormalizes to a sum of one", () => {
    const layout = splitPane(
      layoutWith(createPaneNode({ id: "a", weight: 1 }), "a"),
      { paneId: "a", direction: PaneSplitDirection.Right, newPaneId: "b" },
    )
    const splitId = (layout.workspace.root as SplitNode).id

    const resized = setSplitWeights(layout, { splitId, weights: [3, 1] })
    const root = resized.workspace.root as SplitNode

    assert.deepEqual(
      root.children.map((child) => child.weight),
      [0.75, 0.25],
    )
  })

  test("maximize is rendering-only and restore clears it", () => {
    const layout = splitPane(
      layoutWith(createPaneNode({ id: "a", weight: 1 }), "a"),
      { paneId: "a", direction: PaneSplitDirection.Right, newPaneId: "b" },
    )

    const maximized = maximizePane(layout, { paneId: "a" })

    assert.equal(maximized.workspace.maximizedPaneId, "a")
    assert.equal(maximized.workspace.root, layout.workspace.root)
    assert.equal(restorePane(maximized).workspace.maximizedPaneId, undefined)
  })

  test("docks retain their size while closed and clamp on resize", () => {
    const layout = createAppShellLayout()
    const side = AppShellDockSide.Left

    const closed = setDockOpen(layout, { side, open: false })

    assert.equal(closed.docks[side].size, layout.docks[side].size)

    const clamped = resizeDock(closed, {
      side,
      size: 10000,
      minSize: 120,
      maxSize: 640,
    })

    assert.equal(clamped.docks[side].size, 640)
  })
})
