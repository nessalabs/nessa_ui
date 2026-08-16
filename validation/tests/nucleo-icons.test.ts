import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import ts from "typescript"

const root = path.resolve(import.meta.dirname, "../..")
const nucleoDirectory = path.join(
  root,
  "apps/storybook/stories/icons/nucleo",
)

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrapExpression(expression.expression)
  }
  return expression
}

function componentNameForId(id: string): string {
  return `${id
    .split("-")
    .map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`)
    .join("")}Icon`
}

test("the Nucleo icon inventory and copyright count stay exact", async () => {
  const [entries, inventorySource, indexSource, notice] = await Promise.all([
    readdir(nucleoDirectory),
    readFile(path.join(nucleoDirectory, "inventory.ts"), "utf8"),
    readFile(path.join(nucleoDirectory, "index.ts"), "utf8"),
    readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8"),
  ])
  const iconIds = entries
    .filter((entry) => entry.endsWith("-icon.tsx"))
    .map((entry) => entry.replace(/-icon\.tsx$/, ""))
    .sort()
  const inventoryAst = ts.createSourceFile(
    "inventory.ts",
    inventorySource,
    ts.ScriptTarget.ES2022,
    true,
  )
  const indexAst = ts.createSourceFile(
    "index.ts",
    indexSource,
    ts.ScriptTarget.ES2022,
    true,
  )
  const importedFrom = new Map<string, string>()
  let inventoryArray: ts.ArrayLiteralExpression | undefined

  for (const statement of inventoryAst.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) {
        importedFrom.set(element.name.text, statement.moduleSpecifier.text)
      }
    }
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "nucleoIconInventory" &&
        declaration.initializer
      ) {
        const initializer = unwrapExpression(declaration.initializer)
        if (ts.isArrayLiteralExpression(initializer)) inventoryArray = initializer
      }
    }
  }

  assert.ok(inventoryArray, "nucleoIconInventory must be an array literal")
  const inventoryEntries = inventoryArray.elements.map((element) => {
    assert.ok(ts.isObjectLiteralExpression(element))
    const properties = new Map(
      element.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return []
        const name = property.name
        const key = ts.isIdentifier(name) || ts.isStringLiteral(name)
          ? name.text
          : undefined
        return key ? [[key, property.initializer] as const] : []
      }),
    )
    const id = properties.get("id")
    const component = properties.get("component")
    assert.ok(id && ts.isStringLiteral(id), "every inventory entry needs a string id")
    assert.ok(
      component && ts.isIdentifier(component),
      `${id.text} needs a component identifier`,
    )
    return { id: id.text, component: component.text }
  })
  const inventoryIds = inventoryEntries.map((entry) => entry.id).sort()

  assert.deepEqual(inventoryIds, iconIds)
  assert.equal(new Set(inventoryIds).size, inventoryIds.length)
  assert.match(
    notice,
    new RegExp(`Current tracked Nucleo icon count: ${iconIds.length}\\b`),
  )

  for (const { id, component } of inventoryEntries) {
    const expectedComponent = componentNameForId(id)
    assert.equal(component, expectedComponent, `${id} is bound to the wrong component`)
    assert.equal(
      importedFrom.get(component),
      `./${id}-icon`,
      `${component} must be imported from its matching icon module`,
    )
    const matchingExport = indexAst.statements.find(
      (statement): statement is ts.ExportDeclaration =>
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === `./${id}-icon` &&
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some(
          (element) => !element.isTypeOnly && element.name.text === component,
        ),
    )
    assert.ok(matchingExport, `${component} must be named-exported from the barrel`)

    const source = await readFile(
      path.join(nucleoDirectory, `${id}-icon.tsx`),
      "utf8",
    )
    assert.match(source, /Nucleo icon\. See \/THIRD_PARTY_NOTICES\.md\./)
    assert.match(source, new RegExp(`data-nucleo-icon="${id}"`))
    assert.match(source, /stroke="currentColor"/)
    assert.match(source, /aria-hidden="true"/)
    assert.match(source, /focusable="false"/)
  }
})
