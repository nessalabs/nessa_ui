import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import ts from "typescript"

const root = path.resolve(import.meta.dirname, "../..")
const storiesDirectory = path.join(root, "apps/storybook/stories")

test("every autodocs story publishes a real Storybook description", async () => {
  const storyFiles = (await readdir(storiesDirectory))
    .filter((fileName) => fileName.endsWith(".stories.tsx"))
    .sort()

  for (const fileName of storyFiles) {
    const absolutePath = path.join(storiesDirectory, fileName)
    const text = await readFile(absolutePath, "utf8")
    if (!/tags:\s*\[[^\]]*["']autodocs["']/.test(text)) continue

    const source = ts.createSourceFile(
      absolutePath,
      text,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TSX,
    )

    for (const statement of source.statements) {
      if (
        !ts.isVariableStatement(statement) ||
        !statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )
      ) {
        continue
      }

      for (const declaration of statement.declarationList.declarations) {
        if (
          !ts.isIdentifier(declaration.name) ||
          declaration.type?.getText(source) !== "Story" ||
          !declaration.initializer ||
          !ts.isObjectLiteralExpression(declaration.initializer)
        ) {
          continue
        }

        const storyName = declaration.name.text
        let hasDocumentation = false
        function visit(node: ts.Node): void {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "storyDocumentation"
          ) {
            const [description] = node.arguments
            assert.ok(
              description &&
                (!ts.isStringLiteralLike(description) ||
                  description.text.trim().length > 0),
              `${fileName}#${storyName} has an empty documentation description`,
            )
            hasDocumentation = true
          }
          ts.forEachChild(node, visit)
        }
        visit(declaration.initializer)

        assert.ok(
          hasDocumentation,
          `${fileName}#${storyName} must publish docs.description.story`,
        )
      }
    }
  }
})
