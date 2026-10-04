"use client"

import * as React from "react"

import { ControlLabelContext } from "@/lib/control-label"
import { cn } from "@/lib/utils"

export interface SettingsGroupProps
  extends Omit<React.ComponentProps<"section">, "title"> {
  /** The group's heading, drawn small and muted above the card. */
  title?: React.ReactNode
  /** A quiet note under the card: what the group does, or how to enable it. */
  footnote?: React.ReactNode
  /** The rows, or any content, drawn inside the card. */
  children: React.ReactNode
}

/**
 * A titled card of settings rows: a small heading, one card holding the rows
 * with hairlines between them, and an optional footnote below. When it has a
 * title, the section is named by it.
 */
function SettingsGroup({
  title,
  footnote,
  className,
  children,
  ...props
}: SettingsGroupProps) {
  const titleId = React.useId()
  return (
    <section
      data-slot="settings-group"
      aria-labelledby={title !== undefined ? titleId : undefined}
      className={cn("flex flex-col gap-2 font-sans", className)}
      {...props}
    >
      {title !== undefined ? (
        <h2
          id={titleId}
          data-slot="settings-group-title"
          className="m-0 px-3.5 nessa-text-2 font-medium text-muted-foreground"
        >
          {title}
        </h2>
      ) : null}
      <div
        data-slot="settings-group-card"
        className="flex flex-col rounded-xl border border-border bg-card text-card-foreground [&>[data-slot=settings-row]+[data-slot=settings-row]]:border-t [&>[data-slot=settings-row]+[data-slot=settings-row]]:border-border"
      >
        {children}
      </div>
      {footnote !== undefined ? (
        <p
          data-slot="settings-group-footnote"
          className="m-0 px-3.5 nessa-text-2 text-muted-foreground"
        >
          {footnote}
        </p>
      ) : null}
    </section>
  )
}

export interface SettingsRowProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** The setting's name. A control in the row with no name of its own takes this one. */
  label: React.ReactNode
  /** A line under the label: what the setting does, or its current state. */
  detail?: React.ReactNode
  /** Drawn before the label — an icon or a small tile. */
  leading?: React.ReactNode
  /** Drawn at the end of the row — a switch, a button, a value. */
  control?: React.ReactNode
  /**
   * Content under the row's label line, full width — a fingerprint to
   * compare, an inline error. It stays inside the row.
   */
  children?: React.ReactNode
  /**
   * Disables every control in the row: they are dimmed, skipped by Tab, and
   * read as unavailable, as a disabled fieldset makes them.
   */
  disabled?: boolean
}

/**
 * One line in a `SettingsGroup`: a label with an optional detail line, an
 * optional leading mark, and a control at the end. Anything passed as
 * children sits under the label, so a row can carry a fingerprint or an
 * inline message without leaving the card.
 */
function SettingsRow({
  label,
  detail,
  leading,
  control,
  children,
  disabled = false,
  className,
  ...props
}: SettingsRowProps) {
  const labelId = React.useId()
  return (
    <div
      data-slot="settings-row"
      data-disabled={disabled || undefined}
      className={cn("flex flex-col gap-2 px-3.5 py-2.5", className)}
      {...props}
    >
      <div className="flex min-h-7 items-center gap-3.5">
        {leading !== undefined ? (
          <span data-slot="settings-row-leading" className="flex shrink-0">
            {leading}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={labelId} data-slot="settings-row-label" className="nessa-text-4 text-foreground">
            {label}
          </span>
          {detail !== undefined ? (
            <span data-slot="settings-row-detail" className="nessa-text-2 text-muted-foreground">
              {detail}
            </span>
          ) : null}
        </div>
        {control !== undefined ? (
          <fieldset
            data-slot="settings-row-control"
            disabled={disabled}
            className={cn(
              "m-0 flex min-w-0 shrink-0 items-center gap-2 border-0 p-0",
              disabled && "opacity-50",
            )}
          >
            <ControlLabelContext.Provider value={labelId}>{control}</ControlLabelContext.Provider>
          </fieldset>
        ) : null}
      </div>
      {children !== undefined ? (
        <div data-slot="settings-row-content">{children}</div>
      ) : null}
    </div>
  )
}

export { SettingsGroup, SettingsRow }
