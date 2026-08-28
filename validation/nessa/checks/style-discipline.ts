import ts from "typescript"

import { exceptions, type StyleException } from "../../exceptions.ts"
import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"
import { classTokens } from "./source-boundaries.ts"

const styleExceptions = exceptions.filter((entry): entry is StyleException => entry.kind === "style")

const PALETTE_SCALES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo",
  "violet", "purple", "fuchsia", "pink", "rose", "slate", "gray", "zinc", "neutral", "stone",
] as const

const COLOR_UTILITY_ROOTS = [
  "bg", "text", "border", "border-t", "border-r", "border-b", "border-l", "border-x", "border-y",
  "ring", "ring-offset", "outline", "fill", "stroke", "from", "via", "to", "divide",
  "decoration", "accent", "caret", "shadow", "inset-shadow", "placeholder", "selection",
] as const

const rawPalettePattern = new RegExp(
  `(?:^|[:!])!?(?:${COLOR_UTILITY_ROOTS.join("|")})-(?:${PALETTE_SCALES.join("|")})-\\d{2,3}(?:/\\d{1,3})?$`,
)

const literalColorValuePattern = /\[[^\]]*(?:#[0-9a-fA-F]{3,8}\b|(?<![A-Za-z0-9-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\()/

export function usesRawPalette(token: string): boolean {
  return rawPalettePattern.test(token)
}

export function usesLiteralColorValue(token: string): boolean {
  return literalColorValuePattern.test(token)
}

const STACKING_SCALE = new Set(["0", "10", "20", "30", "40", "50", "auto"])

export function offScaleStackingUtility(token: string): string | null {
  const match = token.match(/(?:^|[:!])(-?z-(?:\[[^\]]+\]|[a-z0-9]+))$/)
  if (!match) return null
  const utility = match[1]!
  if (utility.startsWith("-")) return utility
  return STACKING_SCALE.has(utility.slice(2)) ? null : utility
}

const INLINE_STYLE_ALLOWLIST = new Set([
  "left", "right", "top", "bottom",
  "inset", "insetInline", "insetBlock", "insetInlineStart", "insetInlineEnd", "insetBlockStart", "insetBlockEnd",
  "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "flexBasis", "flexGrow", "flexShrink",
  "transform", "translate", "rotate", "scale", "transformOrigin", "transformBox",
  "opacity",
])

const UNRESOLVABLE_MARKER = "__nessa_unresolvable_style_key__"

export function inlineStylePropertyNames(ast: ts.SourceFile): string[] {
  const names: string[] = []
  const constObjectInitializer = (name: string): ts.ObjectLiteralExpression | null => {
    let found: ts.ObjectLiteralExpression | null = null
    ast.forEachChild(function collect(node) {
      if (found) return
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
        const initializer = unwrap(node.initializer)
        if (ts.isObjectLiteralExpression(initializer)) found = initializer
      }
      ts.forEachChild(node, collect)
    })
    return found
  }
  const unwrap = (node: ts.Expression): ts.Expression => {
    let current = node
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) current = current.expression
    return current
  }
  const recordObject = (object: ts.ObjectLiteralExpression, seen: Set<ts.Node>): void => {
    if (seen.has(object)) return
    seen.add(object)
    for (const property of object.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = unwrap(property.expression)
        if (ts.isObjectLiteralExpression(spread)) recordObject(spread, seen)
        else if (ts.isIdentifier(spread)) {
          const initializer = constObjectInitializer(spread.text)
          if (initializer) recordObject(initializer, seen)
        }
        continue
      }
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue
      const name = property.name
      if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) names.push(name.text)
      else if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) names.push(name.text)
      else if (ts.isComputedPropertyName(name)) {
        const expression = unwrap(name.expression)
        if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) names.push(expression.text)
        else names.push(UNRESOLVABLE_MARKER)
      }
    }
  }
  const recordExpression = (node: ts.Expression, seen: Set<ts.Node>): void => {
    const expression = unwrap(node)
    if (ts.isObjectLiteralExpression(expression)) recordObject(expression, seen)
    else if (ts.isConditionalExpression(expression)) {
      recordExpression(expression.whenTrue, seen)
      recordExpression(expression.whenFalse, seen)
    } else if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
      recordExpression(expression.left, seen)
      recordExpression(expression.right, seen)
    } else if (ts.isIdentifier(expression)) {
      const initializer = constObjectInitializer(expression.text)
      if (initializer) recordObject(initializer, seen)
    }
  }
  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.getText() === "style" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      recordExpression(node.initializer.expression, new Set())
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return names
}

export function forbiddenInlineStyleProperties(ast: ts.SourceFile): string[] {
  return inlineStylePropertyNames(ast).filter((name) =>
    name !== UNRESOLVABLE_MARKER && !name.startsWith("--") && !INLINE_STYLE_ALLOWLIST.has(name),
  )
}

export function unresolvableInlineStyleKeys(ast: ts.SourceFile): number {
  return inlineStylePropertyNames(ast).filter((name) => name === UNRESOLVABLE_MARKER).length
}

export const styleDisciplineCheck = defineCheck({
  id: "style-discipline",
  ...checkMetadata["style-discipline"],
  async run(context) {
    const findings = []
    const paths = context.files.match(["packages/react/src/**/*.tsx"])
    const exceptionByPath = new Map<string, StyleException[]>()
    for (const entry of styleExceptions) exceptionByPath.set(entry.path, [...(exceptionByPath.get(entry.path) ?? []), entry])

    for (const filePath of paths) {
      const ast = await context.parseTypeScript(filePath)
      const tokens = classTokens(ast)
      const entries = exceptionByPath.get(filePath) ?? []
      const excepted = (contractId: StyleException["contractId"], needle: string): StyleException | undefined =>
        entries.find((entry) => entry.contractId === contractId && entry.needle === needle)

      for (const token of tokens) {
        if (usesRawPalette(token)) findings.push(context.fail(`Raw palette utility ${token} bypasses semantic tokens.`, { contractId: "STYLE-001", path: filePath, repair: "Use a semantic token utility (background, foreground, primary, destructive, --nessa-*) or add the value to the theme." }))
        if (usesLiteralColorValue(token)) findings.push(context.fail(`Literal color value in utility ${token} bypasses semantic tokens.`, { contractId: "STYLE-001", path: filePath, repair: "Route the color through a semantic or --nessa-* custom property." }))
      }

      const offScale = new Map<string, number>()
      for (const token of tokens) {
        const utility = offScaleStackingUtility(token)
        if (utility) offScale.set(utility, (offScale.get(utility) ?? 0) + 1)
      }
      for (const [utility, count] of offScale) {
        const entry = excepted("STYLE-002", utility)
        if (!entry) findings.push(context.fail(`Off-scale stacking utility ${utility} (${count} occurrence${count === 1 ? "" : "s"}); the frozen scale is z-0..z-50 and z-auto.`, { contractId: "STYLE-002", path: filePath, repair: "Move the layer onto the frozen scale or ledger an exact transitional exception." }))
      }

      const forbidden = new Map<string, number>()
      for (const name of forbiddenInlineStyleProperties(ast)) forbidden.set(name, (forbidden.get(name) ?? 0) + 1)
      for (const [name, count] of forbidden) {
        const entry = excepted("STYLE-003", name)
        if (!entry) findings.push(context.fail(`Inline style property ${name} (${count} occurrence${count === 1 ? "" : "s"}) is outside the computed-geometry allowlist.`, { contractId: "STYLE-003", path: filePath, repair: "Express it as a utility with semantic tokens, inject a --nessa-* custom property instead, or ledger an exact transitional exception." }))
      }

      for (const entry of entries) {
        const count = entry.contractId === "STYLE-002"
          ? tokens.filter((token) => offScaleStackingUtility(token) === entry.needle).length
          : forbiddenInlineStyleProperties(ast).filter((name) => name === entry.needle).length
        if (count !== entry.maximumOccurrences) findings.push(context.fail(`${entry.path} exception for ${entry.needle} is stale or changed (${count}/${entry.maximumOccurrences}).`, { contractId: entry.contractId, path: entry.path, repair: count === 0 ? "Remove the stale ledger entry." : "Do not broaden the occurrence; amend the contract explicitly if unavoidable." }))
        else findings.push(context.exception(`${entry.needle} remains an exact transitional occurrence.`, { contractId: entry.contractId, path: entry.path, repair: entry.removalCondition }))
      }
    }

    for (const entry of styleExceptions) {
      if (!context.files.has(entry.path)) findings.push(context.fail(`${entry.path} exception for ${entry.needle} points at a missing file.`, { contractId: entry.contractId, path: entry.path, repair: "Remove the stale ledger entry." }))
    }

    if (!findings.some((finding) => finding.state === "FAIL")) findings.push(context.pass("Class surfaces stay on semantic tokens, the frozen stacking scale, and the inline-style geometry allowlist.", { contractId: "STYLE-001" }))
    return findings
  },
})
