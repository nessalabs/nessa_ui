import * as React from "react"

import { cn } from "@/lib/utils"

export interface PageHeaderProps
  extends Omit<React.ComponentProps<"header">, "title" | "children"> {
  /** The page's name: one line, in the page title's one size. */
  title: React.ReactNode
  /** Controls at the end of the header — Add, a filter, Close — on the title's line. */
  actions?: React.ReactNode
  /**
   * The heading level the title is announced at.
   * @defaultValue 1
   */
  level?: 1 | 2
  /** Props for the heading itself, such as an `id` a region is labelled by. */
  titleProps?: Omit<React.ComponentProps<"h1">, "children">
}

/**
 * The top of a page: its title, and its actions on the same line at the end.
 * One size, one height and no subtitle, so every page in an app starts the
 * same way; where the header sits (its inset and gutter) is the page's. A
 * title too long for the line is cut with an ellipsis rather than pushing
 * the actions off it.
 */
function PageHeader({
  title,
  actions,
  level = 1,
  titleProps,
  className,
  ...props
}: PageHeaderProps) {
  const Heading = level === 1 ? "h1" : "h2"
  const { className: titleClassName, ...headingProps } = titleProps ?? {}
  return (
    <header
      data-slot="page-header"
      className={cn("flex min-h-9 min-w-0 items-center gap-3 font-sans", className)}
      {...props}
    >
      <Heading
        data-slot="page-header-title"
        className={cn(
          "m-0 min-w-0 flex-1 truncate nessa-text-7 font-semibold text-foreground",
          titleClassName,
        )}
        {...headingProps}
      >
        {title}
      </Heading>
      {actions !== undefined ? (
        <div data-slot="page-header-actions" className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  )
}

export { PageHeader }
