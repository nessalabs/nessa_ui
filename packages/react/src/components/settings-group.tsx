"use client"

import * as React from "react"
import { LoaderCircle } from "lucide-react"

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
  /**
   * Disables every row in the group at once, as `disabled` on each row
   * would. Say why with `disabledReason`.
   * @defaultValue false
   */
  disabled?: boolean
  /**
   * Why the group is unavailable — "Turn on linking to change these" —
   * written once above the card while `disabled` is set, and read as the
   * section's description.
   */
  disabledReason?: React.ReactNode
}

/** Whether the enclosing group is disabled; a row folds it into its own. */
const SettingsGroupDisabledContext = /* @__PURE__ */ React.createContext(false)

/** The inner radius of the group's card, so a tinted row meets its corners. */
const rowCornerClassName =
  "first:rounded-t-[calc(var(--radius)*1.5-1px)] last:rounded-b-[calc(var(--radius)*1.5-1px)]"

/**
 * A titled card of settings rows: a small heading, one card holding the rows
 * with hairlines between them, and an optional footnote below. When it has a
 * title, the section is named by it.
 */
function SettingsGroup({
  title,
  footnote,
  disabled = false,
  disabledReason,
  className,
  children,
  ...props
}: SettingsGroupProps) {
  const titleId = React.useId()
  const reasonId = React.useId()
  const showsReason = disabled && disabledReason !== undefined
  return (
    <section
      data-slot="settings-group"
      data-disabled={disabled || undefined}
      aria-labelledby={title !== undefined ? titleId : undefined}
      aria-describedby={showsReason ? reasonId : undefined}
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
      {showsReason ? (
        <p
          id={reasonId}
          data-slot="settings-group-reason"
          className="m-0 px-3.5 nessa-text-2 text-muted-foreground"
        >
          {disabledReason}
        </p>
      ) : null}
      <div
        data-slot="settings-group-card"
        className="flex flex-col rounded-xl border border-border bg-card text-card-foreground [&>[data-slot=settings-row]+[data-slot=settings-row]]:border-t [&>[data-slot=settings-row]+[data-slot=settings-row]]:border-border"
      >
        <SettingsGroupDisabledContext.Provider value={disabled}>
          {children}
        </SettingsGroupDisabledContext.Provider>
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
   * compare, an inline error, a button beside that error. It stays inside
   * the row, and a disabled row disables the controls in it.
   */
  children?: React.ReactNode
  /**
   * Disables every control in the row, the one at the end and any passed as
   * children: they are dimmed, skipped by Tab, and read as unavailable, as
   * a disabled fieldset makes them.
   */
  disabled?: boolean
  /**
   * Marks the row as a search result: a soft wash over the row, so a
   * setting found by search stands out where it lives. Scrolling to it is
   * the host's.
   * @defaultValue false
   */
  found?: boolean
  /**
   * Marks a change as being applied: a small spinner beside the control and
   * `aria-busy` on the row. The control stays as the host left it; disable
   * it too if a second change must wait.
   * @defaultValue false
   */
  pending?: boolean
}

/**
 * One line in a `SettingsGroup`: a label with an optional detail line, an
 * optional leading mark, and a control at the end. Anything passed as
 * children sits under the label, so a row can carry a fingerprint, an
 * inline message or a `Choices` control without leaving the card; a control
 * there with no name of its own is named by the row's label too.
 */
function SettingsRow({
  label,
  detail,
  leading,
  control,
  children,
  disabled: ownDisabled = false,
  found = false,
  pending = false,
  className,
  ...props
}: SettingsRowProps) {
  const labelId = React.useId()
  const disabled = React.useContext(SettingsGroupDisabledContext) || ownDisabled
  return (
    <div
      data-slot="settings-row"
      data-disabled={disabled || undefined}
      data-found={found || undefined}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      className={cn(
        "flex flex-col gap-2 px-3.5 py-2.5 transition-[background-color] [transition-duration:var(--nessa-motion-duration-slow)] [transition-timing-function:var(--nessa-motion-easing-standard)]",
        rowCornerClassName,
        found && "bg-foreground/(--nessa-state-hover-strong)",
        className,
      )}
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
        {pending ? (
          <LoaderCircle
            aria-hidden="true"
            data-slot="settings-row-pending"
            className="size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
          />
        ) : null}
        {control !== undefined ? (
          <fieldset
            data-slot="settings-row-control"
            disabled={disabled}
            className={cn(
              "m-0 flex min-w-0 shrink-0 items-center gap-2 border-0 p-0",
              disabled && "opacity-50",
            )}
          >
            <ControlLabelContext.Provider value={labelId}>
              {withRowLabel(control, labelId)}
            </ControlLabelContext.Provider>
          </fieldset>
        ) : null}
      </div>
      {children !== undefined ? (
        disabled ? (
          <fieldset
            disabled
            data-slot="settings-row-content"
            className="m-0 min-w-0 border-0 p-0 opacity-50"
          >
            <ControlLabelContext.Provider value={labelId}>{children}</ControlLabelContext.Provider>
          </fieldset>
        ) : (
          <div data-slot="settings-row-content">
            <ControlLabelContext.Provider value={labelId}>{children}</ControlLabelContext.Provider>
          </div>
        )
      ) : null}
    </div>
  )
}

type LabelableProps = {
  children?: React.ReactNode
  "aria-label"?: string
  "aria-labelledby"?: string
}

/** Host elements whose accessible name is their own text. */
const NAMED_BY_TEXT = new Set(["a", "button", "summary"])

function hasOwnName(props: LabelableProps): boolean {
  return props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined
}

function hasTextContent(node: React.ReactNode): boolean {
  if (typeof node === "string") return node.trim() !== ""
  if (typeof node === "number") return true
  if (Array.isArray(node)) return node.some(hasTextContent)
  if (React.isValidElement<LabelableProps>(node)) return hasTextContent(node.props.children)
  return false
}

/**
 * Points a control that carries no name of its own at the row's label.
 * A button or link that already says something keeps that name. A checkbox,
 * switch, input, or native select does not, so it takes the row's — at the
 * row, where the label is known, rather than only inside controls that
 * happen to read the label context.
 */
function withRowLabel(node: React.ReactNode, labelId: string): React.ReactNode {
  if (Array.isArray(node)) return node.map((child) => withRowLabel(child, labelId))
  if (!React.isValidElement<LabelableProps>(node)) return node
  if (node.type === React.Fragment) {
    return React.cloneElement(node, {}, withRowLabel(node.props.children, labelId))
  }

  const props = node.props
  if (hasOwnName(props)) return node

  if (typeof node.type === "string") {
    const tag = node.type
    if (NAMED_BY_TEXT.has(tag) && hasTextContent(props.children)) return node
    if (tag === "input" || tag === "select" || tag === "textarea" || tag === "button") {
      return React.cloneElement(node, { "aria-labelledby": labelId })
    }
    return React.cloneElement(node, {}, withRowLabel(props.children, labelId))
  }

  // A component that renders its children, such as Button, already has a name.
  if (hasTextContent(props.children)) return node
  return React.cloneElement(node, { "aria-labelledby": labelId })
}

export { SettingsGroup, SettingsRow }
