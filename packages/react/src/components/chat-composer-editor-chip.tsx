"use client"

import { cn } from "@/lib/utils"
import { ChatComposerAttachmentIcon } from "./chat-composer"
import type { ChatComposerChip } from "./chat-composer-editor"

/**
 * Renders one editor chip's visual content inside its non-editable host.
 * The chip is plain inline text — an icon aligned to the type baseline plus
 * the label — so it inherits the editor's font metrics and sits on the same
 * baseline as the surrounding message text.
 */
export function ChatComposerChipView({
  chip,
  onPress,
  onHoverChange,
}: {
  chip: ChatComposerChip
  onPress?: (chip: ChatComposerChip) => void
  onHoverChange?: (
    chip: ChatComposerChip | null,
    element: HTMLElement | null,
  ) => void
}) {
  return (
    <span
      data-slot="chat-composer-chip"
      data-kind={chip.kind}
      onClick={onPress ? () => onPress(chip) : undefined}
      onMouseEnter={
        onHoverChange
          ? (event) => onHoverChange(chip, event.currentTarget)
          : undefined
      }
      onMouseLeave={onHoverChange ? () => onHoverChange(null, null) : undefined}
      className={cn(
        "select-none whitespace-nowrap",
        onPress && "cursor-pointer",
        chip.className,
      )}
    >
      <ChatComposerAttachmentIcon
        kind={chip.kind}
        icon={chip.icon}
        className="mr-1 size-3.5 align-[-0.125em]"
      />
      {chip.label}
    </span>
  )
}

