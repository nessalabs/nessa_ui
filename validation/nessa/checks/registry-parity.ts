import path from "node:path"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

interface RegistryFile { path: string; content?: string; target?: string }
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

/**
 * Resolves a `@/…` import specifier to the registry item it names and the
 * installation directory that specifier expects the item's files to live in.
 */
export function registryAliasFromSpecifier(specifier: string): { itemName: string; targetPrefix: string } | null {
  const segments = specifier.split("/")
  if (specifier.startsWith("@/components/ui/") && segments[3]) return { itemName: segments[3], targetPrefix: `components/ui/${segments[3]}` }
  if ((specifier.startsWith("@/components/") || specifier.startsWith("@/lib/")) && segments[2]) return { itemName: segments[2], targetPrefix: `${segments[1]}/${segments[2]}` }
  return null
}

export function dependenciesFromSource(
  ast: ts.SourceFile,
  relativeRegistryItems: ReadonlyMap<string, string> = new Map(),
): { packages: string[]; registry: string[] } {
  const packages = new Set<string>()
  const registry = new Set<string>()
  ast.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const specifier = node.moduleSpecifier.text
    if (specifier === "react") return
    const alias = registryAliasFromSpecifier(specifier)
    if (alias) registry.add(`nessalabs/nessa_ui/${alias.itemName}`)
    else if (relativeRegistryItems.has(specifier)) registry.add(`nessalabs/nessa_ui/${relativeRegistryItems.get(specifier)}`)
    else if (!specifier.startsWith(".") && !specifier.startsWith("@/")) packages.add(specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!)
  })
  return { packages: [...packages].sort(), registry: [...registry].sort() }
}

/**
 * Collects every `@/…` import in a file that names a registry item, so the
 * check can confirm the alias matches where that item actually installs.
 */
export function registryAliasImports(ast: ts.SourceFile): Array<{ specifier: string; itemName: string; targetPrefix: string }> {
  const imports: Array<{ specifier: string; itemName: string; targetPrefix: string }> = []
  ast.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const alias = registryAliasFromSpecifier(node.moduleSpecifier.text)
    if (alias) imports.push({ specifier: node.moduleSpecifier.text, ...alias })
  })
  return imports
}

/**
 * Whether an installed file target sits inside the directory an import
 * alias points at (the directory itself, a file in it, or "<dir>.tsx").
 */
export function targetMatchesAlias(target: string, targetPrefix: string): boolean {
  return target === targetPrefix || target.startsWith(`${targetPrefix}/`) || target.startsWith(`${targetPrefix}.`)
}

interface RegistryFileLocation {
  owner: string
  target: string
}

function moduleStem(value: string) {
  return value.replace(/\.(?:[cm]?[jt]sx?)$/, "")
}

export function relativeRegistryTopology(
  ast: ts.SourceFile,
  sourcePath: string,
  sourceTarget: string,
  owner: string,
  registryFileBySourceStem: ReadonlyMap<string, RegistryFileLocation>,
) {
  const relativeRegistryItems = new Map<string, string>()
  const issues: string[] = []
  ast.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const specifier = node.moduleSpecifier.text
    if (!specifier.startsWith(".")) return
    const resolvedSourceStem = moduleStem(path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier)))
    const dependency = registryFileBySourceStem.get(resolvedSourceStem) ?? registryFileBySourceStem.get(`${resolvedSourceStem}/index`)
    if (!dependency) {
      issues.push(`${specifier} is not copied by any registry item`)
      return
    }
    if (dependency.owner !== owner) relativeRegistryItems.set(specifier, dependency.owner)
    const resolvedTargetStem = moduleStem(path.posix.normalize(path.posix.join(path.posix.dirname(sourceTarget), specifier)))
    const dependencyTargetStem = moduleStem(dependency.target)
    if (dependencyTargetStem !== resolvedTargetStem && dependencyTargetStem !== `${resolvedTargetStem}/index`) {
      issues.push(`${specifier} resolves to ${resolvedTargetStem} after installation, not ${dependencyTargetStem}`)
    }
  })
  return { issues, relativeRegistryItems }
}

export const registryParityCheck = defineCheck({
  id: "registry-parity",
  ...checkMetadata["registry-parity"],
  async run(context) {
    const findings = []
    const registry = await context.readJson<{ items: RegistryItem[] }>("registry.json")
    const catalog = await context.readJson<{ items: RegistryItem[] }>("public/r/registry.json")
    const registryFileBySourceStem = new Map<string, RegistryFileLocation>()
    for (const candidate of registry.items) {
      for (const file of candidate.files ?? []) {
        if (file.target) registryFileBySourceStem.set(moduleStem(file.path), { owner: candidate.name, target: file.target })
      }
    }
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
        const ast = await context.parseTypeScript(file.path)
        const topology = relativeRegistryTopology(ast, file.path, file.target ?? file.path, item.name, registryFileBySourceStem)
        for (const issue of topology.issues) findings.push(context.fail(`${item.name} relative import ${issue}.`, { contractId: "REG-003", path: file.path }))
        const required = dependenciesFromSource(ast, topology.relativeRegistryItems)
        for (const dependency of required.packages) requiredPackages.add(dependency)
        for (const dependency of required.registry) requiredRegistry.add(dependency)
        // A cross-item import is only installable when the imported item's
        // files actually land where the alias points.
        for (const aliasImport of registryAliasImports(ast)) {
          const imported = registry.items.find((candidate) => candidate.name === aliasImport.itemName)
          if (!imported || imported.name === item.name) continue
          const misplaced = (imported.files ?? []).filter((candidate) => candidate.target && !targetMatchesAlias(candidate.target, aliasImport.targetPrefix))
          if (misplaced.length) {
            findings.push(context.fail(`${item.name} imports ${aliasImport.specifier} but ${aliasImport.itemName} installs at ${misplaced[0]!.target}; the alias would not resolve in a consuming project.`, { contractId: "REG-003", path: "registry.json" }))
          }
        }
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
