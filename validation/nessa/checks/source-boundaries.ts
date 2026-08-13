import ts from "typescript"
import selectorParser from "postcss-selector-parser"

import { exceptions, type OccurrenceException } from "../../exceptions.ts"
import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

const occurrenceExceptions = exceptions.filter((entry): entry is OccurrenceException => entry.kind === "occurrence")

export function selectorCanTargetHostRoot(selector: string): boolean {
  let targetsHost = false
  try {
    selectorParser((root) => {
      root.walk((node) => {
        if (node.type === "tag" && ["body", "html"].includes(node.value.toLowerCase())) targetsHost = true
        if (node.type === "pseudo" && node.value.toLowerCase() === ":root") targetsHost = true
      })
    }).processSync(selector)
  } catch {
    return true
  }
  return targetsHost
}

function stringElementName(node: ts.ElementAccessExpression): string | null {
  return node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : null
}

function accessPath(node: ts.Expression, aliases: ReadonlyMap<string, string>): string | null {
  if (ts.isIdentifier(node)) return aliases.get(node.text) ?? node.text
  if (ts.isPropertyAccessExpression(node)) {
    const base = accessPath(node.expression, aliases)
    return base ? `${base}.${node.name.text}` : null
  }
  if (ts.isElementAccessExpression(node)) {
    const base = accessPath(node.expression, aliases)
    const name = stringElementName(node)
    return base && name ? `${base}.${name}` : null
  }
  return null
}

function withinClassSurface(node: ts.Node): boolean {
  let current: ts.Node | undefined = node
  while (current && !ts.isStatement(current) && !ts.isSourceFile(current)) {
    if (ts.isJsxAttribute(current) && current.name.getText() === "className") return true
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression) && ["cn", "cva"].includes(current.expression.text)) return true
    current = current.parent
  }
  return false
}

export function classTokens(ast: ts.SourceFile): string[] {
  const importedBindings = new Set<string>()
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith(".")) continue
    if (statement.importClause.name) importedBindings.add(statement.importClause.name.text)
    const bindings = statement.importClause.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) importedBindings.add(bindings.name.text)
    if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) importedBindings.add(element.name.text)
  }
  const importedMarker = "__nessa_imported_class__:"
  const declarations = new Map<string, Array<{ initializer: ts.Expression | null; scope: ts.Node; depth: number }>>()
  const lexicalScope = (node: ts.Node): { scope: ts.Node; depth: number } => {
    let current: ts.Node | undefined = node.parent
    while (current && !ts.isSourceFile(current)) {
      if (ts.isBlock(current) || ts.isFunctionLike(current)) {
        let depth = 0
        for (let ancestor: ts.Node | undefined = current; ancestor; ancestor = ancestor.parent) depth += 1
        return { scope: current, depth }
      }
      current = current.parent
    }
    return { scope: ast, depth: 0 }
  }
  const addBinding = (name: ts.BindingName, initializer: ts.Expression | null, owner: ts.Node): void => {
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) if (ts.isBindingElement(element)) addBinding(element.name, null, owner)
      return
    }
    const { scope, depth } = lexicalScope(owner)
    declarations.set(name.text, [...(declarations.get(name.text) ?? []), { initializer, scope, depth }])
  }
  ast.forEachChild(function collect(node) {
    if (ts.isVariableDeclaration(node)) {
      const isConst = ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0
      addBinding(node.name, isConst ? node.initializer ?? null : null, node)
    }
    if (ts.isParameter(node)) addBinding(node.name, null, node)
    if (ts.isCatchClause(node) && node.variableDeclaration) addBinding(node.variableDeclaration.name, null, node.variableDeclaration)
    ts.forEachChild(node, collect)
  })

  const isStaticAlias = (node: ts.Expression): boolean =>
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node) ||
    ts.isIdentifier(node) ||
    (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(ast) === "Object" && node.expression.name.text === "freeze" && node.arguments.length === 1 && ts.isArrayLiteralExpression(node.arguments[0]))

  const resolve = (node: ts.Node, seen = new Set<string>()): string[] => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text]
    if (ts.isIdentifier(node)) {
      const declaration = (declarations.get(node.text) ?? [])
        .filter(({ scope }) => scope.pos <= node.pos && node.end <= scope.end)
        .sort((left, right) => right.depth - left.depth)[0]
      if (!declaration && importedBindings.has(node.text)) return [`${importedMarker}${node.text}`]
      if (!declaration?.initializer || !isStaticAlias(declaration.initializer)) return []
      const binding = `${node.text}:${declaration.initializer.pos}`
      if (seen.has(binding)) return []
      return resolve(declaration.initializer, new Set([...seen, binding]))
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((element) => resolve(element, seen))
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(ast) === "Object" && node.expression.name.text === "freeze" && node.arguments.length === 1) return resolve(node.arguments[0]!, seen)
    if (ts.isCallExpression(node)) return node.arguments.flatMap((argument) => resolve(argument, seen))
    if (ts.isTemplateExpression(node)) {
      let values = [node.head.text]
      for (const span of node.templateSpans) {
        const replacements = resolve(span.expression, seen)
        if (!replacements.length) return []
        values = values.flatMap((prefix) => replacements.map((value) => `${prefix}${value}${span.literal.text}`))
      }
      return values
    }
    const nested: string[] = []
    node.forEachChild((child) => { nested.push(...resolve(child, seen)) })
    return nested
  }

  const surfaces: ts.Node[] = []
  function findSurfaces(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.getText() === "className") {
      if (node.initializer) surfaces.push(ts.isJsxExpression(node.initializer) ? node.initializer.expression ?? node.initializer : node.initializer)
      return
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["cn", "cva"].includes(node.expression.text) && !withinClassSurface(node.parent)) {
      surfaces.push(...node.arguments)
      return
    }
    ts.forEachChild(node, findSurfaces)
  }
  findSurfaces(ast)
  return surfaces.flatMap((surface) => resolve(surface)).flatMap((value) => value.split(/\s+/).filter(Boolean))
}

export function importedClassSurfaceReferences(ast: ts.SourceFile): string[] {
  const marker = "__nessa_imported_class__:"
  return [...new Set(classTokens(ast)
    .filter((token) => token.includes(marker))
    .map((token) => token.slice(token.indexOf(marker) + marker.length).replace(/[^A-Za-z0-9_$].*$/, "")))]
    .filter(Boolean)
    .sort()
}

export function privateAliasReferences(ast: ts.SourceFile): string[] {
  const references = new Set<string>()
  const imports = new Set<string>()
  const bindings = new Map<string, Array<{ initializer: ts.Expression | null; scope: ts.Node; depth: number }>>()
  const assignments: Array<{ target: ts.Identifier; value: ts.Expression }> = []
  const scopeFor = (node: ts.Node): { scope: ts.Node; depth: number } => {
    let current: ts.Node | undefined = node.parent
    while (current && !ts.isSourceFile(current)) {
      if (ts.isBlock(current) || ts.isFunctionLike(current)) {
        let depth = 0
        for (let ancestor: ts.Node | undefined = current; ancestor; ancestor = ancestor.parent) depth += 1
        return { scope: current, depth }
      }
      current = current.parent
    }
    return { scope: ast, depth: 0 }
  }
  const addBinding = (name: ts.BindingName, initializer: ts.Expression | null, owner: ts.Node): void => {
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) if (ts.isBindingElement(element)) addBinding(element.name, null, owner)
      return
    }
    const { scope, depth } = scopeFor(owner)
    bindings.set(name.text, [...(bindings.get(name.text) ?? []), { initializer, scope, depth }])
  }
  ast.forEachChild(function collect(node) {
    if (ts.isImportDeclaration(node) && node.importClause && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith(".")) {
      if (node.importClause.name) imports.add(node.importClause.name.text)
      const named = node.importClause.namedBindings
      if (named && ts.isNamespaceImport(named)) imports.add(named.name.text)
      if (named && ts.isNamedImports(named)) for (const element of named.elements) imports.add(element.name.text)
    }
    if (ts.isVariableDeclaration(node)) addBinding(node.name, node.initializer ?? null, node)
    if (ts.isParameter(node)) addBinding(node.name, null, node)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) assignments.push({ target: node.left, value: node.right })
    ts.forEachChild(node, collect)
  })
  const bindingsFor = (node: ts.Identifier) => {
    const candidates = (bindings.get(node.text) ?? [])
      .filter(({ scope }) => scope.pos <= node.pos && node.end <= scope.end)
      .sort((a, b) => b.depth - a.depth)
    const nearest = candidates[0]
    return nearest ? candidates.filter((candidate) => candidate.scope === nearest.scope) : []
  }
  const resolved = (node: ts.Node | undefined, seen = new Set<string>()): string[] => {
    if (!node) return []
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text]
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return resolved(node.expression, seen)
    if (ts.isConditionalExpression(node)) return [...resolved(node.whenTrue, seen), ...resolved(node.whenFalse, seen)]
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) return [...resolved(node.left, seen), ...resolved(node.right, seen)]
    if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.flatMap((span) => [...resolved(span.expression, seen), span.literal.text])]
    if (ts.isIdentifier(node)) {
      const selectedBindings = bindingsFor(node)
      const binding = selectedBindings[0]
      if (!binding) return imports.has(node.text) ? [`__nessa_unresolved_private_import__:${node.text}`] : []
      const key = `${node.text}:${binding.scope.pos}`
      if (seen.has(key)) return []
      const nextSeen = new Set([...seen, key])
      const values = selectedBindings.flatMap((candidate) => resolved(candidate.initializer ?? undefined, nextSeen))
      for (const assignment of assignments) {
        const assignmentBinding = bindingsFor(assignment.target)[0]
        if (assignment.target.pos < node.pos && assignmentBinding?.scope === binding.scope) values.push(...resolved(assignment.value, nextSeen))
      }
      return values
    }
    return []
  }
  function record(values: string | readonly string[]): void {
    for (const text of typeof values === "string" ? [values] : values) if (text.includes("--_nessa-") || text.startsWith("__nessa_unresolved_private_import__:")) references.add(text)
  }
  function visit(node: ts.Node): void {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      const parent = node.parent
      const isPropertyName = (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === node
      const isElementKey = ts.isElementAccessExpression(parent) && parent.argumentExpression === node
      const isCssPropertyCall = ts.isCallExpression(parent) && parent.arguments.includes(node) && ts.isPropertyAccessExpression(parent.expression) && ["setProperty", "getPropertyValue", "removeProperty"].includes(parent.expression.name.text)
      let inJsxStyle = false
      let current: ts.Node | undefined = node
      while (current && !ts.isStatement(current) && !ts.isSourceFile(current)) {
        if (ts.isJsxAttribute(current) && current.name.getText() === "style") inJsxStyle = true
        current = current.parent
      }
      if (isPropertyName || isElementKey || isCssPropertyCall || inJsxStyle) record(node.text)
    }
    if (ts.isComputedPropertyName(node)) record(resolved(node.expression))
    if (ts.isElementAccessExpression(node)) record(resolved(node.argumentExpression))
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["setProperty", "getPropertyValue", "removeProperty"].includes(node.expression.name.text)) record(resolved(node.arguments[0]))
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return [...references]
}

export function hostBoundaryAccesses(ast: ts.SourceFile): string[] {
  const aliases = collectAliases(ast)
  const accesses = new Set<string>()
  const queryMethods = ["querySelector", "querySelectorAll", "getElementsByTagName"]
  const documentRoots = ["document", "window.document", "globalThis.document"]
  const memberName = (node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | null =>
    ts.isPropertyAccessExpression(node) ? node.name.text : stringElementName(node)
  const destructuredPropertyName = (name: ts.PropertyName | undefined): string | null => {
    if (!name) return null
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text
    if (ts.isComputedPropertyName(name)) return ts.isStringLiteral(name.expression) || ts.isNoSubstitutionTemplateLiteral(name.expression) ? name.expression.text : null
    return null
  }
  function visit(node: ts.Node): void {
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) && ts.isVariableDeclaration(node.parent.parent) && node.parent.parent.initializer) {
      const base = accessPath(node.parent.parent.initializer, aliases)
      const property = node.propertyName ? destructuredPropertyName(node.propertyName) : node.name.getText(ast)
      if (base && property && ["body", "documentElement"].includes(property) && ["document", "window.document", "globalThis.document"].includes(base)) accesses.add(`${base}.${property}`)
      if (base && property && queryMethods.includes(property) && documentRoots.includes(base)) accesses.add(`${base}.${property} extraction`)
      if (base && property === null && documentRoots.includes(base)) accesses.add(`${base}.dynamic computed extraction`)
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isObjectLiteralExpression(node.left)) {
      const base = accessPath(node.right, aliases)
      if (base && documentRoots.includes(base)) {
        for (const property of node.left.properties) {
          if (ts.isSpreadAssignment(property)) { accesses.add(`${base}.rest assignment extraction`); continue }
          const name = destructuredPropertyName(property.name)
          if (name === null) accesses.add(`${base}.dynamic computed assignment extraction`)
          else if (queryMethods.includes(name)) accesses.add(`${base}.${name} assignment extraction`)
        }
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const target = accessPath(node, aliases)
      if (target && [
        "document.body", "document.documentElement", "window.document.body", "window.document.documentElement",
        "globalThis.document.body", "globalThis.document.documentElement",
      ].includes(target)) accesses.add(target)
      if (target && ["document", "window.document", "globalThis.document"].some((root) => queryMethods.some((method) => target === `${root}.${method}`))) {
        const directCall = ts.isCallExpression(node.parent) && node.parent.expression === node
        if (!directCall) accesses.add(`${target} extraction`)
      }
    }
    if (ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))) {
      const owner = accessPath(node.expression.expression, aliases)
      const method = memberName(node.expression)
      if (["document", "window.document", "globalThis.document"].includes(owner ?? "") && method && ["querySelector", "querySelectorAll", "getElementsByTagName"].includes(method)) {
        const argument = node.arguments[0]
        const selector = argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) ? argument.text.trim().toLowerCase() : null
        const forbidden = selector === null ||
          (["querySelector", "querySelectorAll"].includes(method) ? selectorCanTargetHostRoot(selector) : ["body", "html"].includes(selector))
        if (forbidden) accesses.add(`${owner}.${method}(${selector === null ? "dynamic" : `\"${selector}\"`})`)
      }
      if (documentRoots.includes(owner ?? "") && method === null) accesses.add(`${owner}.dynamic query method`)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return [...accesses].sort()
}

function collectAliases(ast: ts.SourceFile): Map<string, string> {
  const aliases = new Map<string, string>([["document", "document"], ["window", "window"], ["globalThis", "globalThis"]])
  let changed = true
  while (changed) {
    changed = false
    ast.forEachChild(function collect(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const resolved = accessPath(node.initializer, aliases)
        if (resolved && aliases.get(node.name.text) !== resolved) { aliases.set(node.name.text, resolved); changed = true }
      }
      if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && ts.isObjectBindingPattern(node.parent) && ts.isVariableDeclaration(node.parent.parent) && node.parent.parent.initializer) {
        const base = accessPath(node.parent.parent.initializer, aliases)
        const property = node.propertyName?.getText(ast) ?? node.name.text
        if (base && ["localStorage", "sessionStorage", "indexedDB", "cookieStore", "cookie"].includes(property)) {
          const resolved = `${base}.${property}`
          if (aliases.get(node.name.text) !== resolved) { aliases.set(node.name.text, resolved); changed = true }
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
        const resolved = accessPath(node.right, aliases)
        if (resolved && aliases.get(node.left.text) !== resolved) { aliases.set(node.left.text, resolved); changed = true }
      }
      ts.forEachChild(node, collect)
    })
  }
  return aliases
}

export function forbiddenPersistenceAccesses(ast: ts.SourceFile): string[] {
  const aliases = collectAliases(ast)
  const accesses = new Set<string>()
  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      const parent = node.parent
      const declarationSite = ts.isBindingElement(parent) || ts.isVariableDeclaration(parent) && parent.name === node ||
        ts.isParameter(parent) || ts.isImportSpecifier(parent) || ts.isPropertyAccessExpression(parent) && parent.name === node
      if (!declarationSite) {
        const target = accessPath(node, aliases)
        const forbidden = target ? forbiddenPersistenceRoot(target) : null
        if (forbidden) accesses.add(forbidden)
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const parentContinues = ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node || ts.isElementAccessExpression(node.parent) && node.parent.expression === node
      if (!parentContinues) {
        const target = accessPath(node, aliases)
        const forbidden = target ? forbiddenPersistenceRoot(target) : null
        if (forbidden) accesses.add(forbidden)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return [...accesses].sort()
}

export function isPersistenceIdentifierReference(node: ts.Identifier): boolean {
  if (!["localStorage", "sessionStorage", "indexedDB", "cookieStore"].includes(node.text)) return false
  const parent = node.parent
  if ((ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodSignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) ||
      ts.isImportSpecifier(parent) || ts.isBindingElement(parent) || ts.isParameter(parent) || ts.isVariableDeclaration(parent)) return false
  return true
}

export function isForbiddenPersistenceTarget(target: string): boolean {
  return Boolean(forbiddenPersistenceRoot(target))
}

export function forbiddenPersistenceRoot(target: string): string | null {
  return [
    "window.localStorage", "window.sessionStorage", "window.indexedDB", "window.cookieStore",
    "globalThis.localStorage", "globalThis.sessionStorage", "globalThis.indexedDB", "globalThis.cookieStore", "document.cookie",
  ].find((root) => target === root || target.startsWith(`${root}.`)) ?? null
}

export const sourceBoundariesCheck = defineCheck({
  id: "source-boundaries",
  ...checkMetadata["source-boundaries"],
  async run(context) {
    const findings = []
    const paths = context.files.match(["packages/react/src/**/*.{ts,tsx,css}"])
    const exceptionByPath = new Map<string, OccurrenceException[]>()
    for (const entry of occurrenceExceptions) exceptionByPath.set(entry.path, [...(exceptionByPath.get(entry.path) ?? []), entry])

    for (const filePath of paths) {
      const entries = exceptionByPath.get(filePath) ?? []
      let semanticTokens: string[] = []
      if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
        const ast = await context.parseTypeScript(filePath)
        semanticTokens = classTokens(ast)
        const importedClassReferences = importedClassSurfaceReferences(ast)
        if (importedClassReferences.length) findings.push(context.fail(`Imported class surface ${importedClassReferences.join(", ")} cannot be statically validated; keep governed class constants in the consuming module.`, { contractId: "SRC-002", path: filePath }))
        if (filePath.includes("/components/") && privateAliasReferences(ast).length) findings.push(context.fail("Registry-targeted component references a private Nessa alias.", { contractId: "SRC-003", path: filePath }))
        for (const target of hostBoundaryAccesses(ast)) findings.push(context.fail(`Library runtime accesses forbidden host root ${target}.`, { contractId: "SRC-001", path: filePath }))
        for (const target of forbiddenPersistenceAccesses(ast)) findings.push(context.fail(`Library runtime owns persistence through ${target}.`, { contractId: "SRC-001", path: filePath }))
        function visit(node: ts.Node): void {
          if (ts.isIdentifier(node) && isPersistenceIdentifierReference(node)) findings.push(context.fail(`Library runtime references persistence global ${node.text}.`, { contractId: "SRC-001", path: filePath }))
          ts.forEachChild(node, visit)
        }
        visit(ast)
      } else {
        const root = await context.parseCss(filePath)
        root.walkAtRules((rule) => { semanticTokens.push(rule.name === "custom-variant" ? `@custom-variant ${rule.params.split(/\s+/)[0] ?? ""}` : `@${rule.name} ${rule.params}`.trim()) })
      }

      for (const entry of entries) {
        const count = semanticTokens.filter((token) => token === entry.needle).length
        if (count !== entry.maximumOccurrences) findings.push(context.fail(`${entry.path} exception for ${entry.needle} is stale or changed (${count}/${entry.maximumOccurrences}).`, { contractId: entry.contractId, path: entry.path, repair: count === 0 ? "Remove the stale ledger entry." : "Do not broaden the occurrence; amend the contract explicitly if unavoidable." }))
        else findings.push(context.exception(`${entry.needle} remains an exact transitional occurrence.`, { contractId: entry.contractId, path: entry.path, repair: entry.removalCondition }))
      }

      if (filePath.includes("/components/") && semanticTokens.some((token) => token.includes("--_nessa-"))) findings.push(context.fail("Registry-targeted component references a private Nessa alias in a class surface.", { contractId: "SRC-003", path: filePath }))
      for (const token of semanticTokens.filter((value) => value.startsWith("dark:"))) {
        if (!entries.some((entry) => entry.needle === token)) findings.push(context.fail(`Unledgered Nessa-owned dark variant: ${token}.`, { contractId: "SRC-002", path: filePath }))
      }
      if (semanticTokens.includes("@custom-variant dark") && !entries.some((entry) => entry.needle === "@custom-variant dark")) findings.push(context.fail("Unledgered global dark custom variant.", { contractId: "SRC-002", path: filePath }))
    }
    if (!findings.some((finding) => finding.state === "FAIL")) findings.push(context.pass("Library runtime boundaries and exact source exceptions are contained.", { contractId: "SRC-001" }))
    return findings
  },
})
