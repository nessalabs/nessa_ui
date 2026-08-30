import ts from "typescript"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

/**
 * The files allowed to narrow raw JSON by hand.
 *
 * `json.ts` is where the narrowing lives on purpose. Each transport's decoder
 * sits upstream of it, deciding whether a decoded line is an object at all, and
 * cannot use a reader that already assumes one. The exemption is the decoder
 * *name*, at any depth: `wire.ts` for a type-tagged stream, `frame.ts` for a
 * JSON-RPC conversation. A one-segment path would miss every nested transport
 * (`claude/stream/wire.ts`, `codex/exec/wire.ts`, …) and ACP's frame decoder.
 */
export function ownsNarrowing(filePath: string): boolean {
  if (filePath === "packages/agent-stream/src/json.ts") return true
  if (!filePath.startsWith("packages/agent-stream/src/")) return false
  return filePath.endsWith("/wire.ts") || filePath.endsWith("/frame.ts")
}

const NARROWED_PRIMITIVES = new Set(["string", "number", "boolean", "object"])

function walk(ast: ts.SourceFile, visit: (node: ts.Node) => void) {
  ast.forEachChild(function step(node) {
    visit(node)
    ts.forEachChild(node, step)
  })
}

/** A string literal, whichever spelling — `"string"` and `` `string` `` are the same test. */
function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

/**
 * Hand-rolled narrowing, in every spelling that does the same job.
 *
 * Matching only `typeof x === "string"` would leave the rule trivially evaded
 * by swapping the operands, using `==`, using a template literal, or switching
 * on `typeof` — none of which is a different practice, so none of them should
 * be a different answer.
 */
function handRolledNarrowing(ast: ts.SourceFile): ts.Node[] {
  const found: ts.Node[] = []
  walk(ast, (node) => {
    if (ts.isSwitchStatement(node) && ts.isTypeOfExpression(node.expression)) {
      found.push(node)
      return
    }
    if (!ts.isBinaryExpression(node)) return
    const operator = node.operatorToken.kind
    const compares =
      operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      operator === ts.SyntaxKind.EqualsEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsToken
    if (!compares) return
    // Either side may hold the `typeof`; `"string" === typeof x` is the same test.
    const literal = literalText(node.right) ?? literalText(node.left)
    const hasTypeof = ts.isTypeOfExpression(node.left) || ts.isTypeOfExpression(node.right)
    if (!hasTypeof || literal === null) return
    if (!NARROWED_PRIMITIVES.has(literal)) return
    found.push(node)
  })
  return found
}

/** TypeScript `enum` declarations, which are nominal and do not survive JSON. */
function enumDeclarations(ast: ts.SourceFile): ts.EnumDeclaration[] {
  const found: ts.EnumDeclaration[] = []
  walk(ast, (node) => {
    if (ts.isEnumDeclaration(node)) found.push(node)
  })
  return found
}

/** Whether an expression is wrapped in `Object.freeze(...)`. */
function isFrozen(node: ts.Expression, ast: ts.SourceFile): boolean {
  return ts.isCallExpression(node) && node.expression.getText(ast) === "Object.freeze"
}

/**
 * Exported object and array literals that are not frozen.
 *
 * `as const` is a compile-time promise only: the object it describes is still
 * mutable at runtime, and an exported vocabulary a consumer can mutate is a
 * shared global anyone can corrupt. Checked by looking for the freeze call
 * rather than by inferring it from the literal's shape — every spelling of an
 * exported literal is covered (`as const`, `satisfies`, and a bare one), so the
 * rule cannot be side-stepped by dropping the assertion that made it visible.
 */
function unfrozenVocabularies(ast: ts.SourceFile): ts.VariableDeclaration[] {
  const found: ts.VariableDeclaration[] = []
  walk(ast, (node) => {
    if (!ts.isVariableStatement(node)) return
    const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (exported !== true) return
    for (const declaration of node.declarationList.declarations) {
      let initializer = declaration.initializer
      if (initializer === undefined) continue
      if (isFrozen(initializer, ast)) continue
      // Unwrap `as const` / `satisfies X`, which describe the literal without
      // changing what it is at runtime.
      while (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer)) {
        initializer = initializer.expression
      }
      if (isFrozen(initializer, ast)) continue
      if (!ts.isObjectLiteralExpression(initializer) && !ts.isArrayLiteralExpression(initializer)) continue
      found.push(declaration)
    }
  })
  return found
}

function line(ast: ts.SourceFile, node: ts.Node): number {
  return ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
}

export const parserHygieneCheck = defineCheck({
  id: "parser-hygiene",
  ...checkMetadata["parser-hygiene"],
  async run(context) {
    const findings = []

    for (const filePath of context.files.match(["packages/agent-stream/src/**/*.ts"])) {
      const ast = await context.parseTypeScript(filePath)

      for (const declaration of enumDeclarations(ast)) {
        findings.push(
          context.fail(
            `TypeScript enum ${declaration.name.getText(ast)} at line ${line(ast, declaration)}: a wire vocabulary must be a frozen object with a derived union, because an enum is nominal and no value decoded from JSON can ever be one without a cast.`,
            { contractId: "PARSE-001", path: filePath },
          ),
        )
      }

      for (const declaration of unfrozenVocabularies(ast)) {
        findings.push(
          context.fail(
            `Exported const vocabulary ${declaration.name.getText(ast)} at line ${line(ast, declaration)} is not frozen: \`as const\` is a compile-time promise, so wrap the object in Object.freeze to make it one at runtime too.`,
            { contractId: "PARSE-002", path: filePath },
          ),
        )
      }

      // A test asserting a runtime shape is doing so on purpose — that is the
      // assertion, not a narrowing shortcut.
      if (ownsNarrowing(filePath) || filePath.endsWith(".test.ts")) continue
      for (const comparison of handRolledNarrowing(ast)) {
        findings.push(
          context.fail(
            `Hand-rolled narrowing at line ${line(ast, comparison)}: use the named readers in @nessa-ui/agent-stream's json.ts (asString, asNumber, asRecord, asOneOf) so every wire value is narrowed one way, in one place.`,
            { contractId: "PARSE-003", path: filePath },
          ),
        )
      }
    }

    if (findings.length === 0) {
      findings.push(
        context.pass("Parser vocabularies are frozen unions and every wire value is narrowed through the shared readers.", {
          contractId: "PARSE-001",
        }),
      )
    }
    return findings
  },
})
