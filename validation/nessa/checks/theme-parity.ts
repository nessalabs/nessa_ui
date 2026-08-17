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

const reducedMotionCss = {
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
      JSON.stringify(sourceBase.css) !== JSON.stringify(reducedMotionCss) ||
      JSON.stringify(publicBase.css) !== JSON.stringify(reducedMotionCss)
    ) {
      findings.push(context.fail("Reduced-motion token overrides differ across package and registry artifacts.", { contractId: "TOKEN-003" }))
    }
    if (!findings.length) findings.push(context.pass("Light/Dark tokens, fonts, radius, and reduced-motion overrides match package and registry artifacts.", { contractId: "TOKEN-003" }))
    return findings
  },
})
