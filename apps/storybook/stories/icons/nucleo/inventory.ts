import { ChatComposeIcon } from "./chat-compose-icon"
import { FastIcon } from "./fast-icon"
import { FileCopyIcon } from "./file-copy-icon"
import { FolderClosedIcon } from "./folder-closed-icon"
import { FolderOpenIcon } from "./folder-open-icon"
import { SidebarLeftIcon } from "./sidebar-left-icon"
import { SidebarRightIcon } from "./sidebar-right-icon"
import { ThinkingIcon } from "./thinking-icon"

const nucleoIconInventory = [
  {
    id: "chat-compose",
    name: "Chat compose",
    component: ChatComposeIcon,
  },
  {
    id: "fast",
    name: "Fast",
    component: FastIcon,
  },
  {
    id: "file-copy",
    name: "File copy",
    component: FileCopyIcon,
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
  {
    id: "thinking",
    name: "Thinking",
    component: ThinkingIcon,
  },
] as const

const NUCLEO_ICON_COUNT = nucleoIconInventory.length

export { NUCLEO_ICON_COUNT, nucleoIconInventory }
