import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"
import { hasUnscopedUniversal, ruleOwnsGlobalReset, selectorOwnership } from "./css-ownership.ts"

interface PackageJson {
  peerDependencies?: Record<string, string>
  exports?: Record<string, unknown>
  sideEffects?: string[]
  files?: string[]
  scripts?: Record<string, string>
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`
  return JSON.stringify(value)
}

export function hasUseClientDirective(source: string): boolean {
  return /^\s*["']use client["'];?/.test(source)
}

export function packageDeclarationIssues(pkg: PackageJson): string[] {
  const issues: string[] = []
  if (pkg.peerDependencies?.react !== ">=19.0.0" || pkg.peerDependencies?.["react-dom"] !== ">=19.0.0") issues.push("react peers")
  const expectedExports: Record<string, unknown> = {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./styles.css": "./dist/styles.css",
    "./theme.css": "./dist/theme.css",
    "./app.css": "./dist/app.css",
  }
  if (canonicalJson(pkg.exports) !== canonicalJson(expectedExports)) issues.push("exact exports")
  if (!pkg.sideEffects?.includes("**/*.css")) issues.push("css side effects")
  if (pkg.scripts?.prepack !== "pnpm build") issues.push("prepack build")
  for (const file of ["dist", "README.md", "LICENSE"]) if (!pkg.files?.includes(file)) issues.push(`published ${file}`)
  return issues
}

export const packageArtifactsCheck = defineCheck({
  id: "package-artifacts",
  ...checkMetadata["package-artifacts"],
  async run(context) {
    const findings = []
    const pkg = await context.readJson<PackageJson>("packages/react/package.json")
    const issues = new Set(packageDeclarationIssues(pkg))
    if (issues.has("react peers")) {
      findings.push(context.fail("React and React DOM peer floors must remain explicit at >=19.0.0.", { contractId: "PKG-001" }))
    }
    if (issues.has("exact exports")) findings.push(context.fail("Package exports must exactly map root types/import and the three CSS contracts to their intended dist artifacts.", { contractId: "PKG-002" }))
    if (issues.has("css side effects")) findings.push(context.fail("CSS side effects declaration is missing.", { contractId: "PKG-002" }))
    if (issues.has("prepack build")) findings.push(context.fail("prepack must build a fresh package.", { contractId: "PKG-003" }))
    for (const file of ["dist", "README.md", "LICENSE"]) {
      if (issues.has(`published ${file}`)) findings.push(context.fail(`Published files omit ${file}.`, { contractId: "PKG-003" }))
    }
    if (!context.files.has("packages/react/LICENSE") || !context.files.has("packages/react/README.md")) {
      findings.push(context.fail("Package README or LICENSE is absent.", { contractId: "PKG-003" }))
    }
    if (!findings.length) findings.push(context.pass("Package peer, export, side-effect, and publication declarations are intact.", { contractId: "PKG-001" }))
    return findings
  },
})

export const packageArtifactsBuiltCheck = defineCheck({
  id: "package-artifacts-built",
  ...checkMetadata["package-artifacts-built"],
  async run(context) {
    const findings = []
    for (const filePath of [
      "packages/react/dist/index.js",
      "packages/react/dist/index.d.ts",
      "packages/react/dist/theme.css",
      "packages/react/dist/styles.css",
      "packages/react/dist/app.css",
    ]) {
      if (!context.files.has(filePath)) findings.push(context.fail(`Fresh package build omitted ${filePath}.`, { contractId: "PKG-003", path: filePath }))
    }
    for (const modulePath of context.files.match(["packages/react/dist/**/*.js"])) {
      if (!hasUseClientDirective(await context.readText(modulePath))) {
        findings.push(context.fail("Built package module lost its React client boundary.", { contractId: "PKG-003", path: modulePath }))
      }
    }
    if (context.files.has("packages/react/dist/styles.css")) {
      const styles = await context.parseCss("packages/react/dist/styles.css")
      let forbidden = false
      styles.walkRules((rule) => { forbidden ||= ruleOwnsGlobalReset(rule) })
      if (forbidden) {
        findings.push(context.fail("Built styles.css contains Preflight/body ownership.", { contractId: "CSS-002" }))
      }
    }
    if (context.files.has("packages/react/dist/app.css")) {
      const app = await context.parseCss("packages/react/dist/app.css")
      let hasBodyBaseline = false
      let hasPreflightReset = false
      app.walkRules((rule) => {
        const declarations = new Map(rule.nodes.filter((node): node is import("postcss").Declaration => node.type === "decl").map((declaration) => [declaration.prop, declaration.value]))
        if (selectorOwnership(rule.selector).body && declarations.get("background-color") === "var(--background)" && declarations.get("color") === "var(--foreground)") hasBodyBaseline = true
        if (hasUnscopedUniversal(rule.selector) && declarations.get("box-sizing") === "border-box" && declarations.get("margin") === "0" && declarations.get("padding") === "0") hasPreflightReset = true
      })
      if (!hasPreflightReset || !hasBodyBaseline) {
        findings.push(context.fail("Built app.css does not contain Preflight and body baseline.", { contractId: "CSS-003" }))
      }
    }
    if (!findings.length) findings.push(context.pass("Fresh package artifacts contain the required JS, declarations, and CSS ownership split.", { contractId: "PKG-003" }))
    return findings
  },
})
