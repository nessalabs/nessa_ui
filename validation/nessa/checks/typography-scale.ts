import type { Root } from "postcss"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"
import { classTokens } from "./source-boundaries.ts"
import { scalePresets, typographyLevels } from "./theme-parity.ts"

const THEME_CSS = "packages/react/src/theme.css"
const STYLES_CSS = "packages/react/src/styles.css"
const APP_CSS = "packages/react/src/app.css"

const SCOPE_SELECTOR = ":where(\n  :root,\n  [data-nessa-root],\n  [data-nessa-theme],\n  [data-nessa-scale]\n)"

/**
 * Tailwind's own font-size utilities, which a Nessa surface must not name
 * directly — including the `/line-height` shorthand (`text-sm/6`) and the
 * `!` important suffix, which would otherwise slip past a bare `$` anchor.
 */
const TAILWIND_SIZE = /^(?:.+:)?text-(?:xs|sm|base|lg|[2-9]?xl)(?:\/\S+)?!?$/

/**
 * An arbitrary font size expressed in an absolute unit. `em` values stay legal:
 * they size relative to an already-scaled parent, so they follow the active
 * scale on their own and remain the only way to size a descendant a helper
 * class cannot reach.
 */
const ABSOLUTE_ARBITRARY_SIZE = /^(?:.+:)?text-\[(?:length:)?-?\d*\.?\d+(px|rem|pt|cm|mm|in|pc|q)\](?:\/\S+)?!?$/i

/** Whether a rule sits inside a conditional at-rule such as `@media`. */
function isConditional(rule: { parent?: unknown }): boolean {
  for (let node = rule.parent as { type?: string; name?: string; parent?: unknown } | undefined; node; node = node.parent as typeof node) {
    if (node.type === "atrule" && node.name !== "layer") return true
  }
  return false
}

/**
 * Declarations an unconditional rule makes, keyed by property, with whitespace
 * collapsed. Conditional copies of the same selector are skipped so a media
 * override cannot masquerade as the base declaration.
 */
function declarations(root: Root, selector: string): Map<string, string> {
  const found = new Map<string, string>()
  root.walkRules((rule) => {
    if (isConditional(rule)) return
    if (rule.selector.replaceAll(/\s+/g, " ").trim() !== selector.replaceAll(/\s+/g, " ").trim()) return
    rule.walkDecls((declaration) => { found.set(declaration.prop, declaration.value.replaceAll(/\s+/g, " ").trim()) })
  })
  return found
}

/** Declarations a selector makes inside `@media` blocks with the given params. */
function mediaDeclarations(root: Root, params: string, selector: string): Map<string, string> {
  const found = new Map<string, string>()
  root.walkAtRules("media", (atRule) => {
    if (atRule.params.replaceAll(/\s+/g, " ").trim() !== params) return
    atRule.walkRules((rule) => {
      if (rule.selector.replaceAll(/\s+/g, " ").trim() !== selector) return
      rule.walkDecls((declaration) => { found.set(declaration.prop, declaration.value.replaceAll(/\s+/g, " ").trim()) })
    })
  })
  return found
}

/** The position of the first rule matching a selector, in document order. */
function ruleIndex(root: Root, selector: string): number {
  let index = -1
  let position = 0
  root.walkRules((rule) => {
    if (index < 0 && rule.selector.replaceAll(/\s+/g, " ").trim() === selector) index = position
    position += 1
  })
  return index
}

/** The layer names a stylesheet orders, in the order its `@layer` statement lists them. */
export function layerOrder(root: Root): string[] {
  const order: string[] = []
  root.walkAtRules("layer", (rule) => {
    if (rule.nodes) return
    for (const name of rule.params.split(",")) order.push(name.trim())
  })
  return order
}

export const typographyScaleCheck = defineCheck({
  id: "typography-scale",
  ...checkMetadata["typography-scale"],
  async run(context) {
    const findings = []
    const theme = await context.parseCss(THEME_CSS)
    const styles = await context.parseCss(STYLES_CSS)

    const root = declarations(theme, ":root")
    for (const level of typographyLevels) {
      const size = root.get(`--nessa-font-size-${level}`)
      const lineHeight = root.get(`--nessa-line-height-${level}`)
      const tracking = root.get(`--nessa-letter-spacing-${level}`)
      if (!size || !/^\d*\.?\d+rem$/.test(size)) findings.push(context.fail(`--nessa-font-size-${level} must be a public rem token.`, { contractId: "TOKEN-004", path: THEME_CSS }))
      if (!lineHeight || !/^\d*\.?\d+$/.test(lineHeight)) findings.push(context.fail(`--nessa-line-height-${level} must be a unitless ratio so the line box scales exactly once.`, { contractId: "TOKEN-004", path: THEME_CSS }))
      // A suffix test would also accept `rem`; only a real em quantity passes.
      if (!tracking || !/^-?\d*\.?\d+em$/.test(tracking)) findings.push(context.fail(`--nessa-letter-spacing-${level} must be an em tracking token.`, { contractId: "TOKEN-004", path: THEME_CSS }))
    }

    const rootFactor = declarations(theme, ":where(:root, [data-nessa-root])").get("--_nessa-scale-factor")
    if (rootFactor !== "1") findings.push(context.fail("The unscoped baseline must resolve --_nessa-scale-factor to 1.", { contractId: "TOKEN-004", path: THEME_CSS }))
    // Every factor rule is :where() (zero specificity), so on the root
    // provider — which carries data-nessa-root AND data-nessa-scale per the
    // contract — a preset beats the baseline purely by source order. Pin it.
    const baselineIndex = ruleIndex(theme, ":where(:root, [data-nessa-root])")
    for (const [preset, factor] of Object.entries(scalePresets)) {
      const selector = `:where([data-nessa-scale="${preset}"])`
      const declared = declarations(theme, selector).get("--_nessa-scale-factor")
      if (declared !== factor) findings.push(context.fail(`Scale preset ${preset} must set --_nessa-scale-factor to ${factor}, not ${declared ?? "nothing"}.`, { contractId: "TOKEN-004", path: THEME_CSS }))
      const presetIndex = ruleIndex(theme, selector)
      if (baselineIndex < 0 || presetIndex >= 0 && presetIndex < baselineIndex) {
        findings.push(context.fail(`The zero-specificity baseline factor must precede preset ${preset} in source order, or a root provider carrying both attributes snaps back to factor 1.`, { contractId: "TOKEN-004", path: THEME_CSS }))
      }
    }

    // Redeclaring the computed aliases at every scope is what keeps a nested
    // theme or scale from inheriting a value computed against its parent.
    const aliases = declarations(theme, SCOPE_SELECTOR)
    for (const level of typographyLevels) {
      const size = aliases.get(`--_nessa-font-size-${level}`)
      if (size !== `calc(var(--nessa-font-size-${level}) * var(--_nessa-scale-factor))`) {
        findings.push(context.fail(`--_nessa-font-size-${level} must apply the active scale factor to the public baseline.`, { contractId: "TOKEN-004", path: THEME_CSS }))
      }
      if (aliases.get(`--_nessa-line-height-${level}`) !== `var(--nessa-line-height-${level})`) {
        findings.push(context.fail(`--_nessa-line-height-${level} must alias its public ratio directly and never multiply by scale.`, { contractId: "TOKEN-004", path: THEME_CSS }))
      }
      if (aliases.get(`--_nessa-letter-spacing-${level}`) !== `var(--nessa-letter-spacing-${level})`) {
        findings.push(context.fail(`--_nessa-letter-spacing-${level} must alias its public tracking directly.`, { contractId: "TOKEN-004", path: THEME_CSS }))
      }
    }
    // Geometry rides the same factor: Tailwind v4 sizing utilities resolve
    // `--spacing` at the element that uses them, so this one redeclaration is
    // the whole spacing ramp. The bare `:root` (not `:where`) must outrank
    // Tailwind's own `:root, :host` declaration earlier in the theme layer.
    const spacing = declarations(theme, ":root, :where([data-nessa-root], [data-nessa-theme], [data-nessa-scale])").get("--spacing")
    if (spacing !== "calc(0.25rem * var(--_nessa-scale-factor))") {
      findings.push(context.fail("--spacing must multiply Tailwind's 0.25rem base by the active scale factor so control geometry follows type.", { contractId: "TOKEN-004", path: THEME_CSS }))
    }

    // Entrance keyframes may animate `scale`; outside @keyframes the theme
    // must never reach for zoom/transform to implement the UI scale.
    let scalesByTransform = false
    theme.walkDecls(/^(?:zoom|transform|scale)$/, (declaration) => {
      for (let node = declaration.parent as { type?: string; name?: string; parent?: unknown } | undefined; node; node = node.parent as typeof node) {
        if (node.type === "atrule" && node.name === "keyframes") return
      }
      scalesByTransform = true
    })
    if (scalesByTransform) {
      findings.push(context.fail("Scale must not be implemented with CSS zoom or transforms.", { contractId: "TOKEN-004", path: THEME_CSS }))
    }

    for (const level of typographyLevels) {
      const helper = declarations(styles, `.nessa-text-${level}`)
      if (helper.get("font-size") !== `var(--_nessa-font-size-${level})` ||
        helper.get("line-height") !== `var(--_nessa-line-height-${level})` ||
        helper.get("letter-spacing") !== `var(--_nessa-letter-spacing-${level})`) {
        findings.push(context.fail(`.nessa-text-${level} must apply the coordinated size, line-height, and tracking aliases together.`, { contractId: "TOKEN-004", path: STYLES_CSS }))
      }
    }
    // Both input helpers carry the 1rem anti-zoom floor below the mobile
    // threshold and drop to their level's exact size at 48rem. The media
    // overrides are asserted too — theme-parity pins them only in the
    // registry artifacts, so without this the package copy could drift free.
    for (const [helper, level] of [[".nessa-text-input", 4], [".nessa-text-input-2", 2]] as const) {
      const input = declarations(styles, helper)
      if (input.get("font-size") !== `max(1rem, var(--_nessa-font-size-${level}))` ||
        input.get("line-height") !== `var(--_nessa-line-height-${level})` ||
        input.get("letter-spacing") !== `var(--_nessa-letter-spacing-${level})`) {
        findings.push(context.fail(`${helper} must floor at 1rem below the mobile viewport threshold and carry level ${level}'s coordinated aliases.`, { contractId: "TOKEN-004", path: STYLES_CSS }))
      }
      if (mediaDeclarations(styles, "(width >= 48rem)", helper).get("font-size") !== `var(--_nessa-font-size-${level})`) {
        findings.push(context.fail(`${helper} must drop its floor to level ${level}'s exact size at the 48rem threshold.`, { contractId: "TOKEN-004", path: STYLES_CSS }))
      }
    }

    // Helpers must lose to any Tailwind utility naming the same property, in the
    // package build and in a consuming application alike.
    for (const [filePath, css] of [[STYLES_CSS, styles], [APP_CSS, await context.parseCss(APP_CSS)]] as const) {
      const order = layerOrder(css)
      const helpers = order.indexOf("nessa-helpers")
      if (helpers < 0 || helpers > order.indexOf("nessa-components") || helpers > order.indexOf("utilities")) {
        findings.push(context.fail("The nessa-helpers layer must be ordered before the utility layers.", { contractId: "TOKEN-004", path: filePath }))
      }
    }

    for (const filePath of context.files.match(["packages/react/src/components/**/*.tsx", "packages/react/src/composites/**/*.tsx"])) {
      for (const token of new Set(classTokens(await context.parseTypeScript(filePath)))) {
        if (TAILWIND_SIZE.test(token)) {
          findings.push(context.fail(`${token} is a bare Tailwind size; use a coordinated nessa-text level.`, { contractId: "TOKEN-004", path: filePath }))
        } else if (ABSOLUTE_ARBITRARY_SIZE.test(token)) {
          findings.push(context.fail(`${token} pins an absolute font size outside the level ramp.`, {
            contractId: "TOKEN-004",
            path: filePath,
            repair: "Use a nessa-text level, or an em value when a descendant selector cannot carry a helper class.",
          }))
        }
      }
    }

    if (!findings.length) findings.push(context.pass("Coordinated typography levels, the scale chain (type and geometry), and helper ordering are intact across every Nessa surface.", { contractId: "TOKEN-004" }))
    return findings
  },
})
