import { SidebarSide, useSidebar } from "@nessa-ui/react"

import { SidebarLeftIcon, SidebarRightIcon } from "./nucleo"

interface SidebarToggleIconProps {
  side?: SidebarSide
}

function SidebarToggleIcon({
  side = SidebarSide.Left,
}: SidebarToggleIconProps) {
  const { state } = useSidebar()
  const isExpanded = state === "expanded"
  const showLeftSidebar =
    side === SidebarSide.Left ? isExpanded : !isExpanded

  return showLeftSidebar ? <SidebarLeftIcon /> : <SidebarRightIcon />
}

export { SidebarToggleIcon }
