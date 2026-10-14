/**
 * What an element would compute for `property` while in a pseudo-class a
 * play test cannot put it in — `:hover`, `:active` — read from the live
 * stylesheet rather than from a class name.
 *
 * It finds the last rule that sets `property` for the element plus that
 * pseudo-class (inside layers and media blocks), then resolves the
 * declared value in the element's own context, so custom properties set
 * on its ancestors apply exactly as they would on the element itself.
 * Returns `null` when no rule sets it.
 *
 * It strips the pseudo-class from every selector before matching, so a
 * `group-hover`/`peer-hover` rule (an ancestor's or sibling's state) would
 * match too; assert only on the element's own state rules.
 */
export function stateStyle(element: HTMLElement, pseudo: ":hover" | ":active", property: string): string | null {
  let declared: string | null = null
  // Declarations nested in a matched rule — Tailwind writes a plain fallback
  // and then the real value inside `@supports` — apply when their
  // condition holds, after the rule's own.
  const nested = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSSupportsRule && !CSS.supports(rule.conditionText)) continue
      if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches) continue
      const style = (rule as CSSRule & { style?: CSSStyleDeclaration }).style
      const value = style?.getPropertyValue(property)
      if (value) declared = value
      if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) nested((rule as CSSGroupingRule).cssRules)
    }
  }
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches) continue
      if (rule instanceof CSSSupportsRule && !CSS.supports(rule.conditionText)) continue
      if (rule instanceof CSSStyleRule) {
        if (rule.selectorText.includes(pseudo)) {
          const base = rule.selectorText.split(pseudo).join("")
          let matches = false
          try {
            matches = element.matches(base)
          } catch {
            matches = false
          }
          if (matches) {
            const value = rule.style.getPropertyValue(property)
            if (value) declared = value
            if (rule.cssRules?.length) nested(rule.cssRules)
            continue
          }
        }
        if (rule.cssRules?.length) visit(rule.cssRules)
      } else if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) {
        visit((rule as CSSGroupingRule).cssRules)
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules)
    } catch {
      // A cross-origin sheet cannot be read; nothing of ours lives there.
    }
  }
  if (declared === null) return null
  if (property.startsWith("--")) return declared
  const probe = document.createElement("span")
  probe.style.setProperty(property, declared)
  element.parentElement!.appendChild(probe)
  const resolved = getComputedStyle(probe).getPropertyValue(property)
  probe.remove()
  return resolved
}
