"use client"

/** @responsibility Re-exports the public surface of the AppShell composite. */

export {
  AppShell,
  useAppShell,
  useAppShellContext,
  type AppShellChangeMeta,
  type AppShellContextValue,
  type AppShellKeyboardShortcut,
  type AppShellLayoutOperation,
  type AppShellProps,
  type AppShellShortcutModifier,
  type SplitPaneActionOptions,
  type UseAppShellResult,
} from "./app-shell"
export {
  AppShellBody,
  AppShellHeader,
  AppShellMain,
  AppShellStatusBar,
} from "./app-shell-chrome"
export { AppShellDock, type AppShellDockProps } from "./app-shell-dock"
export {
  AppShellPaneDragHandle,
  AppShellPaneGrabber,
  useAppShellDrag,
  type AppShellDragContextValue,
  type AppShellPaneDragHandleProps,
  type AppShellPaneGrabberProps,
  type PaneDropTarget,
} from "./app-shell-drag"
export {
  AppShellWorkspace,
  type AppShellPaneStyle,
  type AppShellWorkspaceProps,
} from "./app-shell-workspace"
