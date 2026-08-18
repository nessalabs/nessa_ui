import { BashIcon } from "./bash-icon"
import { ChatComposeIcon } from "./chat-compose-icon"
import { EditIcon } from "./edit-icon"
import { FastIcon } from "./fast-icon"
import { FileCopyIcon } from "./file-copy-icon"
import { FolderClosedIcon } from "./folder-closed-icon"
import { FolderOpenIcon } from "./folder-open-icon"
import { GlobeIcon } from "./globe-icon"
import { SearchIcon } from "./search-icon"
import { SidebarLeftIcon } from "./sidebar-left-icon"
import { SidebarRightIcon } from "./sidebar-right-icon"
import { ThinkingIcon } from "./thinking-icon"
import { TodoIcon } from "./todo-icon"

const nucleoIconInventory = [
  {
    id: "bash",
    name: "Bash",
    component: BashIcon,
  },
  {
    id: "chat-compose",
    name: "Chat compose",
    component: ChatComposeIcon,
  },
  {
    id: "edit",
    name: "Edit",
    component: EditIcon,
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
    id: "globe",
    name: "Globe",
    component: GlobeIcon,
  },
  {
    id: "search",
    name: "Search",
    component: SearchIcon,
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
  {
    id: "todo",
    name: "Todo",
    component: TodoIcon,
  },
] as const

const NUCLEO_ICON_COUNT = nucleoIconInventory.length

export { NUCLEO_ICON_COUNT, nucleoIconInventory }
