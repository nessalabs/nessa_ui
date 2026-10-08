"use client"

import * as React from "react"

/**
 * The id of the visible text that names the control inside it — a settings
 * row's label, for instance. A control with no name of its own takes this
 * one, so a row reads as "Allow linking, switch, on" rather than as an
 * unnamed switch beside some text.
 */
const ControlLabelContext = /* @__PURE__ */ React.createContext<string | undefined>(undefined)

/**
 * The id of the row label above content placed under it — a settings row's
 * children. Only controls built to stand there as the row's own control,
 * such as `Choices`, read it; a switch or field among that content keeps the
 * name it has, so adding a row's content never renames what is in it.
 */
const ContentLabelContext = /* @__PURE__ */ React.createContext<string | undefined>(undefined)

/**
 * The naming props for a control: its own `aria-label` or
 * `aria-labelledby` when it has one, otherwise the enclosing label's id.
 */
function useControlLabel(own: {
  "aria-label"?: string
  "aria-labelledby"?: string
}): { "aria-label"?: string; "aria-labelledby"?: string } {
  const enclosing = React.useContext(ControlLabelContext)
  if (own["aria-label"] !== undefined || own["aria-labelledby"] !== undefined) {
    return own
  }
  return enclosing === undefined ? {} : { "aria-labelledby": enclosing }
}

export { ContentLabelContext, ControlLabelContext, useControlLabel }
