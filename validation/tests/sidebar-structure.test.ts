import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import ts from "typescript"

import {
  SidebarCollapsible,
  SidebarSide,
  SidebarVariant,
} from "../../packages/react/src/components/sidebar/sidebar-options.ts"

const root = path.resolve(import.meta.dirname, "../..")
const sidebarDirectory = "packages/react/src/components/sidebar"

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = `${directory}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(relativePath)
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
      ? [relativePath]
      : []
  }))
  return nested.flat()
}

test("sidebar options expose frozen enum-style values without changing string props", () => {
  assert.deepEqual(SidebarSide, { Left: "left", Right: "right" })
  assert.deepEqual(SidebarVariant, {
    Sidebar: "sidebar",
    Floating: "floating",
    Inset: "inset",
  })
  assert.deepEqual(SidebarCollapsible, {
    Offcanvas: "offcanvas",
    Icon: "icon",
    None: "none",
  })
  assert.ok(Object.isFrozen(SidebarSide))
  assert.ok(Object.isFrozen(SidebarVariant))
  assert.ok(Object.isFrozen(SidebarCollapsible))
})

test("sidebar keyboard shortcuts are explicit and application-configurable", async () => {
  const provider = await readFile(
    path.join(root, sidebarDirectory, "sidebar-provider.tsx"),
    "utf8",
  )

  assert.match(provider, /keyboardShortcut\?: SidebarKeyboardShortcut/)
  assert.doesNotMatch(provider, /keyboardShortcut = true/)
  assert.match(provider, /type SidebarShortcutModifier = "control" \| "meta" \| "mod"/)
})

test("sidebar sizing is application-configurable with stable defaults", async () => {
  const provider = await readFile(
    path.join(root, sidebarDirectory, "sidebar-provider.tsx"),
    "utf8",
  )

  assert.match(provider, /const DEFAULT_SIDEBAR_WIDTH = "17rem"/)
  assert.match(provider, /const DEFAULT_SIDEBAR_COLLAPSED_WIDTH = "3\.5rem"/)
  assert.match(provider, /sidebarWidth\?: string/)
  assert.match(provider, /collapsedSidebarWidth\?: string/)
  assert.match(provider, /"--nessa-sidebar-width": sidebarWidth/)
  assert.match(
    provider,
    /"--nessa-sidebar-width-icon": collapsedSidebarWidth/,
  )
})

test("every Sidebar module states its high-level responsibility", async () => {
  for (const relativePath of [
    "packages/react/src/components/sidebar.tsx",
    ...(await sourceFiles(sidebarDirectory)),
  ]) {
    const source = await readFile(path.join(root, relativePath), "utf8")
    assert.match(
      source,
      /\/\*\*\s*@responsibility\b[^]*?\*\//,
      `${relativePath} must include a stable module-responsibility comment`,
    )
  }
})

test("every named Sidebar function documents its inputs and output", async () => {
  const files = await sourceFiles(sidebarDirectory)

  for (const relativePath of files) {
    const absolutePath = path.join(root, relativePath)
    const sourceText = await readFile(absolutePath, "utf8")
    const source = ts.createSourceFile(
      absolutePath,
      sourceText,
      ts.ScriptTarget.ES2022,
      true,
      relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )

    const assertDocumentation = (
      node: ts.Node,
      name: string,
      parameterNames: string[],
    ) => {
      const documentation = sourceText
        .slice(node.getFullStart(), node.getStart(source))
        .match(/\/\*\*[^]*?\*\//g)
        ?.at(-1)

      assert.ok(
        documentation,
        `${relativePath}:${name} must have a JSDoc contract`,
      )
      assert.match(
        documentation,
        /@returns\b/,
        `${relativePath}:${name} must document its output`,
      )
      const documentedParameters = [
        ...documentation.matchAll(/@param\s+([A-Za-z_$][\w$]*)/g),
      ].map((match) => match[1])
      assert.deepEqual(
        documentedParameters,
        parameterNames,
        `${relativePath}:${name} must document every input by name and in declaration order`,
      )
    }

    const parameterNames = (
      parameters: ts.NodeArray<ts.ParameterDeclaration>,
    ) => parameters.map((parameter) =>
      ts.isIdentifier(parameter.name) ? parameter.name.text : "props",
    )

    function visit(node: ts.Node): void {
      if (ts.isFunctionDeclaration(node) && node.name) {
        assertDocumentation(node, node.name.text, parameterNames(node.parameters))
      }

      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
            continue
          }

          const initializer = declaration.initializer
          if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
            assertDocumentation(
              node,
              declaration.name.text,
              parameterNames(initializer.parameters),
            )
            continue
          }

          if (
            ts.isCallExpression(initializer) &&
            (declaration.name.text === "sidebarMenuItemVariants" ||
              (ts.isPropertyAccessExpression(initializer.expression) &&
                initializer.expression.name.text === "useCallback"))
          ) {
            const callback = initializer.arguments[0]
            const documentedParameterNames =
              callback &&
              (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
                ? parameterNames(callback.parameters)
                : declaration.name.text === "sidebarMenuItemVariants"
                  ? ["options"]
                  : []
            assertDocumentation(
              node,
              declaration.name.text,
              documentedParameterNames,
            )
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(source)
  }
})

test("every public sidebar barrel preserves the client boundary", async () => {
  for (const relativePath of [
    "packages/react/src/components/sidebar.tsx",
    `${sidebarDirectory}/index.ts`,
    `${sidebarDirectory}/sidebar-menu.tsx`,
  ]) {
    const source = await readFile(path.join(root, relativePath), "utf8")
    assert.match(
      source,
      /^\s*["']use client["'];?\s/,
      `${relativePath} must begin with the client directive`,
    )
  }
})

test("every public sidebar menu primitive is rendered in the menu Storybook catalog", async () => {
  const sidebarBarrelPath = path.join(
    root,
    sidebarDirectory,
    "index.ts",
  )
  const sidebarBarrel = ts.createSourceFile(
    sidebarBarrelPath,
    await readFile(sidebarBarrelPath, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
  )
  const expectedComponents = sidebarBarrel.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    statement.moduleSpecifier &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === "./sidebar-menu" &&
    statement.exportClause &&
    ts.isNamedExports(statement.exportClause)
      ? statement.exportClause.elements
          .filter(
            (element) =>
              !element.isTypeOnly && /^SidebarMenu/.test(element.name.text),
          )
          .map((element) => element.name.text)
      : [],
  ).sort()

  const storyPath = path.join(
    root,
    "apps/storybook/stories/sidebar-menu.stories.tsx",
  )
  const story = ts.createSourceFile(
    storyPath,
    await readFile(storyPath, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  )
  const renderedComponents = new Set<string>()
  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      renderedComponents.add(node.tagName.getText(story))
    }
    ts.forEachChild(node, visit)
  }
  visit(story)

  assert.deepEqual(
    expectedComponents.filter((component) => !renderedComponents.has(component)),
    [],
  )
})

test("sidebar Storybook catalog separates primitives, compositions, and examples", async () => {
  const storyTitles = new Map([
    ["apps/storybook/stories/sidebar.stories.tsx", "Shell/Sidebar/Examples"],
    ["apps/storybook/stories/sidebar-primitives.stories.tsx", "Shell/Sidebar/Primitives"],
    ["apps/storybook/stories/sidebar-compositions.stories.tsx", "Shell/Sidebar/Compositions"],
    ["apps/storybook/stories/sidebar-menu.stories.tsx", "Shell/Sidebar/Primitives/Menu"],
  ])
  const storyNames = await Promise.all([...storyTitles].map(async ([relativePath, title]) => {
    const absolutePath = path.join(root, relativePath)
    const text = await readFile(absolutePath, "utf8")
    assert.match(text, new RegExp(`title: ["']${title}["']`))
    assert.doesNotMatch(
      text,
      /from ["'][^"']*\.stories["']/,
      `${relativePath} must not import another CSF module`,
    )
    const source = ts.createSourceFile(
      absolutePath,
      text,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TSX,
    )
    return new Set(
      source.statements.flatMap((statement) =>
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )
          ? statement.declarationList.declarations.flatMap((declaration) =>
              ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
            )
          : [],
      ),
    )
  }))
  const allStoryNames = storyNames.flatMap((names) => [...names])
  assert.deepEqual(
    allStoryNames.filter((storyName) => storyName.endsWith("Fixture")),
    [],
  )
  const duplicates = allStoryNames
    .filter((storyName, index) => allStoryNames.indexOf(storyName) !== index)
    .filter((storyName, index, names) => names.indexOf(storyName) === index)
    .sort()

  assert.deepEqual(duplicates, [])
})

test("public sidebar primitives are grouped by responsibility", async () => {
  const barrelPath = path.join(root, sidebarDirectory, "index.ts")
  const source = await readFile(barrelPath, "utf8")
  const ast = ts.createSourceFile(barrelPath, source, ts.ScriptTarget.ES2022, true)

  const exportedComponents = new Map<string, string[]>()
  for (const statement of ast.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text === "./sidebar-options" ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue
    }

    const componentNames = statement.exportClause.elements
      .filter((element) => !element.isTypeOnly && /^Sidebar[A-Z]/.test(element.name.text))
      .map((element) => element.name.text)

    exportedComponents.set(statement.moduleSpecifier.text, componentNames)
  }

  assert.deepEqual(exportedComponents.get("./sidebar-group")?.sort(), [
    "SidebarGroup",
    "SidebarGroupAction",
    "SidebarGroupContent",
    "SidebarGroupLabel",
  ].sort())
  assert.deepEqual(exportedComponents.get("./sidebar-menu")?.sort(), [
    "SidebarMenu",
    "SidebarMenuItem",
    "SidebarMenuSkeleton",
  ].sort())

  const menuSource = await readFile(
    path.join(root, sidebarDirectory, "sidebar-menu.tsx"),
    "utf8",
  )
  for (const compositeProp of [
    "badge?: React.ReactNode",
    "description?: React.ReactNode",
    "icon?: React.ReactNode",
    "submenu?: React.ReactNode",
    "trailing?: React.ReactNode",
  ]) {
    assert.match(menuSource, new RegExp(compositeProp.replace(/[?.]/g, "\\$&")))
  }
  assert.doesNotMatch(
    menuSource,
    /function SidebarMenu(?:Action|Badge|Button|Content|Description|Label|Sub|Trailing)/,
  )

  const unexpectedFamilies = [...exportedComponents]
    .filter(([moduleName, componentNames]) =>
      !["./sidebar-group", "./sidebar-menu"].includes(moduleName) &&
      componentNames.length > 1,
    )
  assert.deepEqual(unexpectedFamilies, [])
})

test("npm and registry sidebar entrypoints expose the same public API", async () => {
  const sidebarBarrelPath = path.join(root, sidebarDirectory, "index.ts")
  const sidebarBarrel = ts.createSourceFile(
    sidebarBarrelPath,
    await readFile(sidebarBarrelPath, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
  )
  const packageIndexPath = path.join(root, "packages/react/src/index.ts")
  const packageIndex = ts.createSourceFile(
    packageIndexPath,
    await readFile(packageIndexPath, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
  )

  const exportRecords = (
    source: ts.SourceFile,
    moduleName?: string,
  ) => source.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    (!moduleName ||
      (statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === moduleName)) &&
    statement.exportClause &&
    ts.isNamedExports(statement.exportClause)
      ? statement.exportClause.elements.map((element) => ({
          exportedName: element.name.text,
          localName: element.propertyName?.text ?? element.name.text,
          typeOnly: statement.isTypeOnly || element.isTypeOnly,
        }))
      : [],
  ).sort((first, second) =>
    `${first.exportedName}:${first.localName}:${first.typeOnly}`.localeCompare(
      `${second.exportedName}:${second.localName}:${second.typeOnly}`,
    ),
  )

  const registryExports = exportRecords(sidebarBarrel)
  const packageExports = exportRecords(packageIndex, "./components/sidebar")

  assert.deepEqual(packageExports, registryExports)
})

test("the sidebar registry item copies the complete component folder", async () => {
  const files = await sourceFiles(sidebarDirectory)
  const expectedPaths = [
    "packages/react/src/components/sidebar.tsx",
    ...files,
  ].sort()
  const registry = JSON.parse(await readFile(path.join(root, "registry.json"), "utf8")) as {
    items: Array<{ name: string; files?: Array<{ path: string; target?: string }> }>
  }
  const sidebar = registry.items.find((item) => item.name === "sidebar")
  assert.ok(sidebar)

  const actualPaths = (sidebar.files ?? []).map((file) => file.path).sort()
  assert.deepEqual(actualPaths, expectedPaths)

  for (const file of sidebar.files ?? []) {
    const relative = path.posix.relative(sidebarDirectory, file.path)
    const expectedTarget = relative.startsWith("../")
      ? "components/ui/sidebar.tsx"
      : `components/ui/sidebar/${relative}`
    assert.equal(file.target, expectedTarget, `${file.path} must preserve the sidebar folder layout`)
  }
})
