import { defineCheck } from "../../framework/define-check.ts"
import selectorParser from "postcss-selector-parser"
import { checkMetadata } from "../check-metadata.ts"

function importTarget(params: string): string {
  const match = params.trim().match(/^(?:url\(\s*)?["']?([^"')\s]+)["']?\s*\)?/)
  if (!match) throw new Error(`Unsupported @import syntax: ${params}`)
  return match[1]!
}

export function importsExactly(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

export function selectorOwnership(selector: string): { body: boolean; universal: boolean } {
  const result = { body: false, universal: false }
  selectorParser((root) => {
    root.walk((node) => {
      if (node.type === "tag" && node.value.toLowerCase() === "body") result.body = true
      if (node.type === "universal") result.universal = true
    })
  }).processSync(selector)
  return result
}

export function ruleOwnsGlobalReset(rule: { selector: string; nodes?: readonly { type: string; prop?: string }[] }): boolean {
  const ownership = selectorOwnership(rule.selector)
  if (ownership.body) return true
  if (!hasUnscopedUniversal(rule.selector)) return false
  const hasNonCustomDeclaration = (rule.nodes ?? []).some((node) => node.type === "decl" && !node.prop?.startsWith("--"))
  return hasNonCustomDeclaration
}

export function hasUnscopedUniversal(selector: string): boolean {
  let unscoped = false
  selectorParser((root) => {
    root.walkUniversals((universal) => {
      const positiveScope = (node: any): boolean => {
        if (["class", "id", "attribute"].includes(node.type)) return true
        if (node.type === "tag") return !["html", "body"].includes(node.value)
        if (node.type === "pseudo") return node.value !== ":not" && (node.nodes ?? []).some((child: any) => positiveScope(child))
        if (node.type === "selector" || node.type === "root") return (node.nodes ?? []).some((child: any) => positiveScope(child))
        return false
      }
      let current: any = universal
      let scoped = false
      while (current.parent) {
        if (current.parent.type === "pseudo" && current.parent.value === ":not") return
        const siblings = current.parent.nodes ?? []
        if (siblings.slice(0, siblings.indexOf(current)).some((node: any) => positiveScope(node))) scoped = true
        current = current.parent
      }
      if (!scoped) unscoped = true
    })
  }).processSync(selector)
  return unscoped
}

export const cssOwnershipCheck = defineCheck({
  id: "css-ownership",
  ...checkMetadata["css-ownership"],
  async run(context) {
    const findings = []
    const files = ["packages/react/src/theme.css", "packages/react/src/styles.css", "packages/react/src/app.css"] as const
    const roots = await Promise.all(files.map((filePath) => context.parseCss(filePath)))

    for (const [index, root] of roots.entries()) {
      const filePath = files[index]!
      root.walkRules((rule) => {
        const ownership = selectorOwnership(rule.selector)
        if (filePath !== "packages/react/src/app.css" && (ownership.body || ownership.universal)) {
            findings.push(context.fail(`${filePath} owns forbidden ${ownership.body ? "body" : "universal"} selector ${rule.selector}.`, {
              contractId: filePath.endsWith("theme.css") ? "CSS-001" : "CSS-002",
              path: filePath,
              line: rule.source?.start?.line,
              column: rule.source?.start?.column,
            }))
        }
      })
    }

    const [themeRoot, stylesRoot, appRoot] = roots
    if (themeRoot!.nodes.some((node) => node.type === "atrule" && node.name === "import")) {
      findings.push(context.fail("theme.css must remain import-free.", { contractId: "CSS-001", path: files[0] }))
    }
    const styleImports: string[] = []
    stylesRoot!.walkAtRules("import", (rule) => { styleImports.push(importTarget(rule.params)) })
    const expectedStyleImports = ["tailwindcss/theme.css", "./theme.css", "tailwindcss/utilities.css"]
    if (styleImports.includes("tailwindcss") || styleImports.some((value) => value.includes("preflight"))) {
      findings.push(context.fail("styles.css imports aggregate Tailwind or Preflight.", { contractId: "CSS-002", path: files[1] }))
    }
    if (!importsExactly(styleImports, expectedStyleImports)) {
      findings.push(context.fail(`styles.css imports must be exactly ${expectedStyleImports.join(", ")} in order.`, { contractId: "CSS-002", path: files[1] }))
    }
    const appImports: string[] = []
    appRoot!.walkAtRules("import", (rule) => { appImports.push(importTarget(rule.params)) })
    const expectedAppImports = ["tailwindcss/preflight.css", "./styles.css"]
    if (!importsExactly(appImports, expectedAppImports)) {
      findings.push(context.fail(`app.css imports must be exactly ${expectedAppImports.join(", ")} in order.`, { contractId: "CSS-003", path: files[2] }))
    }
    let hasSourceBodyBaseline = false
    appRoot!.walkRules((rule) => {
      if (!selectorOwnership(rule.selector).body) return
      rule.walkAtRules("apply", (apply) => {
        const utilities = new Set(apply.params.split(/\s+/))
        if (utilities.has("bg-background") && utilities.has("text-foreground")) hasSourceBodyBaseline = true
      })
    })
    if (!hasSourceBodyBaseline) findings.push(context.fail("app.css must own a real body rule applying the background/foreground baseline.", { contractId: "CSS-003" }))

    const pkg = await context.readJson<{ exports?: Record<string, unknown>; sideEffects?: string[] }>("packages/react/package.json")
    for (const exportName of ["./theme.css", "./styles.css", "./app.css"]) {
      if (!pkg.exports?.[exportName]) findings.push(context.fail(`Package export ${exportName} is missing.`, { contractId: exportName === "./theme.css" ? "CSS-001" : exportName === "./app.css" ? "CSS-003" : "CSS-002" }))
    }
    if (!pkg.sideEffects?.includes("**/*.css")) findings.push(context.fail("Package CSS must be declared as side effects.", { contractId: "CSS-002" }))
    if (!findings.length) findings.push(context.pass("CSS ownership and package export split are intact.", { contractId: "CSS-001" }))
    return findings
  },
})
