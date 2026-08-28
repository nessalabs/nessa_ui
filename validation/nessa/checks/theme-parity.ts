import type { Root } from "postcss"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

export interface ThemeTokens {
  light: Record<string, string>
  dark: Record<string, string>
}

export function extractThemeTokens(root: Root): ThemeTokens {
  const result: ThemeTokens = { light: {}, dark: {} }
  root.walkRules((rule) => {
    const target = rule.selector.trim() === ":root" ? result.light : rule.selector.trim() === ".dark" ? result.dark : null
    if (!target) return
    rule.walkDecls(/^--/, (declaration) => {
      target[declaration.prop.slice(2)] = declaration.value.trim()
    })
  })
  return result
}

export const typographyLevels = Object.freeze([1, 2, 3, 4, 5, 6, 7] as const)
/**
 * Deliberately constrained, Radix-Themes-style. Within ±10–25% the whole
 * system scales coherently: type stays on its hierarchy and controls keep
 * legal touch targets. Larger swings are browser zoom's job, which also
 * scales the tokens that must never follow this factor (borders, radii).
 */
export const scalePresets = Object.freeze({ "90": "0.9", "95": "0.95", "100": "1", "105": "1.05", "110": "1.1", "125": "1.25" })

const entries = <Value,>(build: (level: number) => readonly [string, Value]) => Object.fromEntries(typographyLevels.map(build))

/**
 * The registry base must install the same scale chain and typography helpers the
 * package emits, in the same order, so a copied component renders identically to
 * its packaged twin under every scale preset.
 */
const scaleCss = {
  ":where(:root, [data-nessa-root])": { "--_nessa-scale-factor": "1" },
  ...Object.fromEntries(Object.entries(scalePresets).map(([preset, factor]) => [
    `:where([data-nessa-scale="${preset}"])`,
    { "--_nessa-scale-factor": factor },
  ])),
  ":where(:root, [data-nessa-root], [data-nessa-theme], [data-nessa-scale])": {
    ...entries((level) => [`--_nessa-font-size-${level}`, `calc(var(--nessa-font-size-${level}) * var(--_nessa-scale-factor))`]),
    ...entries((level) => [`--_nessa-line-height-${level}`, `var(--nessa-line-height-${level})`]),
    ...entries((level) => [`--_nessa-letter-spacing-${level}`, `var(--nessa-letter-spacing-${level})`]),
  },
  // Tailwind v4 sizing utilities resolve `--spacing` per element, so this one
  // redeclaration scales geometry with the same factor as type. The bare
  // `:root` outranks Tailwind's own `:root, :host` earlier in the theme layer.
  ":root, :where([data-nessa-root], [data-nessa-theme], [data-nessa-scale])": {
    "--spacing": "calc(0.25rem * var(--_nessa-scale-factor))",
  },
  "@layer components": {
    ...entries((level) => [`.nessa-text-${level}`, {
      "font-size": `var(--_nessa-font-size-${level})`,
      "line-height": `var(--_nessa-line-height-${level})`,
      "letter-spacing": `var(--_nessa-letter-spacing-${level})`,
    }]),
    ".nessa-text-input": {
      "font-size": "max(1rem, var(--_nessa-font-size-4))",
      "line-height": "var(--_nessa-line-height-4)",
      "letter-spacing": "var(--_nessa-letter-spacing-4)",
    },
    ".nessa-text-input-2": {
      "font-size": "max(1rem, var(--_nessa-font-size-2))",
      "line-height": "var(--_nessa-line-height-2)",
      "letter-spacing": "var(--_nessa-letter-spacing-2)",
    },
    "@media (width >= 48rem)": {
      ".nessa-text-input": { "font-size": "var(--_nessa-font-size-4)" },
      ".nessa-text-input-2": { "font-size": "var(--_nessa-font-size-2)" },
    },
  },
}

const baseCss = {
  ...scaleCss,
  "@media (prefers-reduced-motion: reduce)": {
    ":root, :where([data-nessa-root], [data-nessa-theme], [data-nessa-scale])": {
      "--nessa-motion-duration-fast": "0ms",
      "--nessa-motion-duration-normal": "0ms",
      "--nessa-motion-duration-slow": "0ms",
      "--nessa-motion-duration-ambient": "0ms",
    },
  },
}

export const themeParityCheck = defineCheck({
  id: "theme-parity",
  ...checkMetadata["theme-parity"],
  async run(context) {
    const findings = []
    const tokens = extractThemeTokens(await context.parseCss("packages/react/src/theme.css"))
    const registry = await context.readJson<{ items: { name: string; cssVars?: { theme?: Record<string, string>; light?: Record<string, string>; dark?: Record<string, string> }; css?: Record<string, unknown> }[] }>("registry.json")
    const publicBase = await context.readJson<{ cssVars?: { theme?: Record<string, string>; light?: Record<string, string>; dark?: Record<string, string> }; css?: Record<string, unknown> }>("public/r/nessa-base.json")
    const sourceBase = registry.items.find((item) => item.name === "nessa-base")
    if (!sourceBase?.cssVars || !publicBase.cssVars) {
      return [context.fail("nessa-base cssVars are missing.", { contractId: "TOKEN-001" })]
    }
    for (const mode of ["light", "dark"] as const) {
      const expected = Object.fromEntries(Object.entries(tokens[mode]).filter(([name]) => name !== "nessa-font-sans" && name !== "nessa-font-mono" && name !== "radius"))
      const source = sourceBase.cssVars[mode] ?? {}
      const published = publicBase.cssVars[mode] ?? {}
      for (const [name, value] of Object.entries(expected)) {
        if (source[name] !== value || published[name] !== value) {
          findings.push(context.fail(`${mode} --${name} differs across package/registry artifacts.`, {
            contractId: "TOKEN-003",
            repair: `Expected ${value}; registry=${source[name] ?? "missing"}; public=${published[name] ?? "missing"}.`,
          }))
        }
      }
      const expectedNames = Object.keys(expected).sort().join("\n")
      if (Object.keys(source).sort().join("\n") !== expectedNames || Object.keys(published).sort().join("\n") !== expectedNames) {
        findings.push(context.fail(`${mode} token key sets differ across package/registry artifacts.`, { contractId: "TOKEN-003" }))
      }
    }
    const themeVars = sourceBase.cssVars.theme ?? {}
    const publicThemeVars = publicBase.cssVars.theme ?? {}
    const fontSans = tokens.light["nessa-font-sans"]
    const fontMono = tokens.light["nessa-font-mono"]
    const radius = tokens.light.radius
    if (themeVars["font-sans"] !== fontSans || publicThemeVars["font-sans"] !== fontSans || !fontSans?.startsWith('"Geist Variable"')) {
      findings.push(context.fail("Geist sans stack drifted or uses the wrong Fontsource family.", { contractId: "TOKEN-002" }))
    }
    if (themeVars["font-mono"] !== fontMono || publicThemeVars["font-mono"] !== fontMono || !fontMono?.startsWith('"Geist Mono Variable"')) {
      findings.push(context.fail("Geist mono stack drifted or uses the wrong Fontsource family.", { contractId: "TOKEN-002" }))
    }
    if (themeVars.radius !== radius || publicThemeVars.radius !== radius) {
      findings.push(context.fail("Radius drifted across package and registry base.", { contractId: "TOKEN-003" }))
    }
    if (
      JSON.stringify(sourceBase.css) !== JSON.stringify(baseCss) ||
      JSON.stringify(publicBase.css) !== JSON.stringify(baseCss)
    ) {
      findings.push(context.fail("Scale, typography-helper, or reduced-motion base CSS differs across package and registry artifacts.", { contractId: "TOKEN-003" }))
    }
    if (!findings.length) findings.push(context.pass("Light/Dark tokens, fonts, radius, scale chain, and helper CSS match package and registry artifacts.", { contractId: "TOKEN-003" }))
    return findings
  },
})
