import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A key, or a chord written as one cap — `⌘K`, `Esc`, `⇧⌘P` — as a menu, a
 * field or a tooltip shows it. It is the `<kbd>` element, so assistive
 * technology reads it as keyboard input; it does not bind the key, which
 * stays the host's job.
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center gap-0.5 rounded-sm bg-muted px-1 font-sans nessa-text-1 font-medium text-muted-foreground tabular-nums",
        className,
      )}
      {...props}
    />
  )
}

export { Kbd }
