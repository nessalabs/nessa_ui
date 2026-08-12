import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

interface RegistryFile { path: string; content?: string }
interface RegistryItem {
  [key: string]: unknown
  name: string
  type: string
  registryDependencies?: string[]
  dependencies?: string[]
  files?: RegistryFile[]
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`
  return JSON.stringify(value)
}

export function sourceOwnedProjection(item: RegistryItem): Record<string, unknown> {
  return Object.fromEntries(Object.entries(item).filter(([key]) => key !== "$schema").map(([key, value]) => [
    key,
    key === "files" && Array.isArray(value) ? value.map((file) => {
      const { content: _content, ...metadata } = file as RegistryFile & Record<string, unknown>
      return metadata
    }) : value,
  ]))
}

export function embeddedSourceMatches(generated: string, canonical: string): boolean {
  return generated.replaceAll("\r\n", "\n") === canonical.replaceAll("\r\n", "\n")
}

export function requiredRegistryDependenciesPresent(dependencies: readonly string[]): boolean {
  return dependencies.includes("nessalabs/nessa_ui/nessa-base") && dependencies.includes("nessalabs/nessa_ui/utils")
}

export function dependenciesFromSource(ast: ts.SourceFile): { packages: string[]; registry: string[] } {
  const packages = new Set<string>()
  const registry = new Set<string>()
  ast.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const specifier = node.moduleSpecifier.text
    if (specifier === "react") return
    if (specifier === "@/lib/utils") registry.add("nessalabs/nessa_ui/utils")
    else if (specifier.startsWith("@/components/ui/")) registry.add(`nessalabs/nessa_ui/${specifier.split("/").at(-1)}`)
    else if (!specifier.startsWith(".") && !specifier.startsWith("@/")) packages.add(specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!)
  })
  return { packages: [...packages].sort(), registry: [...registry].sort() }
}

export const registryParityCheck = defineCheck({
  id: "registry-parity",
  ...checkMetadata["registry-parity"],
  async run(context) {
    const findings = []
    const registry = await context.readJson<{ items: RegistryItem[] }>("registry.json")
    const catalog = await context.readJson<{ items: RegistryItem[] }>("public/r/registry.json")
    if (canonicalJson(registry.items.map(sourceOwnedProjection)) !== canonicalJson(catalog.items.map(sourceOwnedProjection))) findings.push(context.fail("Public registry catalog metadata drifted from registry.json.", { contractId: "REG-001" }))

    for (const item of registry.items) {
      const publicPath = `public/r/${item.name}.json`
      if (!context.files.has(publicPath)) {
        findings.push(context.fail(`Generated registry item is missing: ${publicPath}.`, { contractId: "REG-001" }))
        continue
      }
      const published = await context.readJson<RegistryItem>(publicPath)
      if (canonicalJson(sourceOwnedProjection(published)) !== canonicalJson(sourceOwnedProjection(item))) findings.push(context.fail(`${item.name} generated metadata drifted from registry.json.`, { contractId: "REG-001", path: publicPath }))
      const requiredPackages = new Set<string>()
      const requiredRegistry = new Set<string>()
      for (const file of item.files ?? []) {
        const generatedFile = published.files?.find((candidate) => candidate.path === file.path)
        if (!generatedFile?.content) {
          findings.push(context.fail(`${item.name} lacks embedded content for ${file.path}.`, { contractId: "REG-002", path: publicPath }))
          continue
        }
        const canonical = (await context.readText(file.path)).replaceAll("\r\n", "\n")
        if (!embeddedSourceMatches(generatedFile.content, canonical)) {
          findings.push(context.fail(`${item.name} embeds stale source for ${file.path}.`, { contractId: "REG-002", path: publicPath }))
        }
        const required = dependenciesFromSource(await context.parseTypeScript(file.path))
        for (const dependency of required.packages) requiredPackages.add(dependency)
        for (const dependency of required.registry) requiredRegistry.add(dependency)
      }
      if ((item.files ?? []).length) {
        if (item.type === "registry:ui") requiredRegistry.add("nessalabs/nessa_ui/nessa-base")
        if (JSON.stringify([...(item.dependencies ?? [])].sort()) !== JSON.stringify([...requiredPackages].sort())) findings.push(context.fail(`${item.name} package dependencies do not match the union of canonical imports.`, { contractId: "REG-003", path: "registry.json" }))
        if (JSON.stringify([...(item.registryDependencies ?? [])].sort()) !== JSON.stringify([...requiredRegistry].sort())) findings.push(context.fail(`${item.name} registry dependencies do not match the union of canonical imports.`, { contractId: "REG-003", path: "registry.json" }))
      }
      if (item.type === "registry:ui") {
        const dependencies = item.registryDependencies ?? []
        if (!requiredRegistryDependenciesPresent(dependencies)) {
          findings.push(context.fail(`${item.name} must depend on Nessa base and utils.`, { contractId: "REG-003", path: "registry.json" }))
        }
        if (JSON.stringify(published.registryDependencies ?? []) !== JSON.stringify(dependencies)) {
          findings.push(context.fail(`${item.name} generated registry dependencies drifted.`, { contractId: "REG-003", path: publicPath }))
        }
      }
    }
    if (!findings.length) findings.push(context.pass("Registry catalog, embedded source, and dependencies match canonical inputs.", { contractId: "REG-001" }))
    return findings
  },
})
import ts from "typescript"
