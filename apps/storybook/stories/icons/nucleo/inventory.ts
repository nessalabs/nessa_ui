import { ChatComposeIcon } from "./chat-compose-icon"
import { FolderClosedIcon } from "./folder-closed-icon"
import { FolderOpenIcon } from "./folder-open-icon"
import { SidebarLeftIcon } from "./sidebar-left-icon"
import { SidebarRightIcon } from "./sidebar-right-icon"

const nucleoIconInventory = [
  {
    id: "chat-compose",
    name: "Chat compose",
    component: ChatComposeIcon,
  },
  {
    id: "folder-closed",
    name: "Folder closed",
    component: FolderClosedIcon,
  },
  {
    id: "folder-open",
    name: "Folder open",
    component: FolderOpenIcon,
  },
  {
    id: "sidebar-left",
    name: "Sidebar left",
    component: SidebarLeftIcon,
  },
  {
    id: "sidebar-right",
    name: "Sidebar right",
    component: SidebarRightIcon,
  },
] as const

const NUCLEO_ICON_COUNT = nucleoIconInventory.length

export { NUCLEO_ICON_COUNT, nucleoIconInventory }
