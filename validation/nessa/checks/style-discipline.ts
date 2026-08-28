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
  "bg", "text", "border", "border-t", "border-r", "border-b", "border-l", "border-x", "border-y", "border-s", "border-e",
  "ring", "ring-offset", "inset-ring", "outline", "fill", "stroke", "from", "via", "to", "divide",
  "decoration", "accent", "caret", "shadow", "inset-shadow", "text-shadow", "drop-shadow", "placeholder", "selection",
] as const

// Opacity modifiers may be numeric (/50), arbitrary (/[0.5]), or variable (/(--x));
// Tailwind v4 important is trailing (bg-red-500!), the legacy leading form (!bg-red-500) still parses.
const OPACITY_MODIFIER = "(?:/(?:\\d{1,3}|\\[[^\\]]+\\]|\\([^)]+\\)))?"

const rawPalettePattern = new RegExp(
  `(?:^|[:!])!?(?:${COLOR_UTILITY_ROOTS.join("|")})-(?:${PALETTE_SCALES.join("|")})-\\d{2,3}${OPACITY_MODIFIER}!?$`,
)

// CSS named colors (Level 4) minus the token-neutral keywords (transparent,
// currentColor, and the cascade-wide keywords), which defer to context
// instead of naming paint and are deliberately absent from this list.
const NAMED_COLORS = [
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black", "blanchedalmond", "blue",
  "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk",
  "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki",
  "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen", "darkslateblue",
  "darkslategray", "darkslategrey", "darkturquoise", "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey",
  "dodgerblue", "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod",
  "gray", "green", "greenyellow", "grey", "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender",
  "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral", "lightcyan", "lightgoldenrodyellow",
  "lightgray", "lightgreen", "lightgrey", "lightpink", "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray",
  "lightslategrey", "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon",
  "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue",
  "mediumspringgreen", "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin",
  "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid", "palegoldenrod", "palegreen",
  "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple",
  "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell",
  "sienna", "silver", "skyblue", "slateblue", "slategray", "slategrey", "snow", "springgreen", "steelblue", "tan",
  "teal", "thistle", "tomato", "turquoise", "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen",
  // CSS system colors resolve to UA-theme paint, which still bypasses the token chain.
  "canvas", "canvastext", "linktext", "visitedtext", "activetext", "buttonface", "buttontext", "buttonborder",
  "field", "fieldtext", "highlight", "highlighttext", "selecteditem", "selecteditemtext", "mark", "marktext",
  "graytext", "accentcolor", "accentcolortext",
] as const

const namedColorPattern = new RegExp(`(?<![A-Za-z0-9#-])(?:${NAMED_COLORS.join("|")})(?![A-Za-z0-9-])`, "i")

const colorConstructorPattern = /#[0-9a-fA-F]{3,8}\b|(?<![A-Za-z0-9-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/

const PAINT_PROPERTIES = new Set([
  "color", "background", "background-color", "background-image",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-inline", "border-block",
  "border-inline-start", "border-inline-end", "border-block-start", "border-block-end",
  "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-inline-color", "border-block-color", "border-inline-start-color", "border-inline-end-color",
  "border-block-start-color", "border-block-end-color",
  "outline", "outline-color", "box-shadow", "text-shadow", "fill", "stroke", "caret-color", "accent-color",
  "text-decoration", "text-decoration-color", "text-emphasis", "text-emphasis-color",
  "column-rule", "column-rule-color", "scrollbar-color",
  "stop-color", "flood-color", "lighting-color",
])

function stripPaintServerReferences(value: string): string {
  return value.replace(/url\(\s*['"]?#[^)]*\)/g, "url()")
}

export function containsLiteralColor(value: string): boolean {
  const cleaned = stripPaintServerReferences(value)
  return colorConstructorPattern.test(cleaned) || namedColorPattern.test(cleaned)
}

export function usesRawPalette(token: string): boolean {
  return rawPalettePattern.test(token)
}

const colorRootArbitraryPattern = new RegExp(`(?:^|[:!])!?(?:${COLOR_UTILITY_ROOTS.join("|")})-\\[([^\\]]+)\\]${OPACITY_MODIFIER}!?$`)
const arbitraryPropertyPattern = /(?:^|[:!])!?\[([a-zA-Z-]+):([^\]]+)\]!?$/

export function usesLiteralColorValue(token: string): boolean {
  const colorRoot = token.match(colorRootArbitraryPattern)
  if (colorRoot && containsLiteralColor(colorRoot[1]!)) return true
  const property = token.match(arbitraryPropertyPattern)
  if (property) {
    const name = property[1]!.toLowerCase()
    // Paint properties and custom-property definitions in class surfaces both
    // carry color; named colors elsewhere (grid areas, animation names) are
    // too ambiguous to match, so only those two surfaces use the named list.
    if ((PAINT_PROPERTIES.has(name) || name.startsWith("--")) && containsLiteralColor(property[2]!)) return true
  }
  // Literal color constructors anywhere else in an arbitrary value (e.g.
  // gradients on non-color roots) are still literals.
  return colorConstructorPattern.test(stripPaintServerReferences(token))
}

const STACKING_SCALE = new Set(["0", "10", "20", "30", "40", "50", "auto"])

export function offScaleStackingUtility(token: string): string | null {
  const property = token.match(arbitraryPropertyPattern)
  if (property && property[1]!.toLowerCase() === "z-index") return `[z-index:${property[2]!}]`
  const match = token.match(/(?:^|[:!])(-?z-(?:\[[^\]]+\]|\([^)]+\)|[a-z0-9]+))!?$/)
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

interface InlineStyleDeclaration {
  name: string
  literalValue: string | null
}

export function inlineStyleDeclarations(ast: ts.SourceFile): InlineStyleDeclaration[] {
  const declarations: InlineStyleDeclaration[] = []

  const unwrap = (node: ts.Expression): ts.Expression => {
    let current = node
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isNonNullExpression(current)) current = current.expression
    return current
  }

  // Scope-aware bindings: a name resolves to the innermost declaration whose
  // enclosing scope contains the use site, so a local style object never leaks
  // across components that reuse the name. Parameters and destructured names
  // register with a null initializer — they shadow outer declarations into
  // unresolvability instead of letting the audit read the wrong object.
  const bindings = new Map<string, Array<{ initializer: ts.Expression | null; scope: ts.Node; depth: number }>>()
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
    if (ts.isVariableDeclaration(node)) addBinding(node.name, ts.isIdentifier(node.name) ? node.initializer ?? null : null, node)
    if (ts.isParameter(node)) addBinding(node.name, null, node)
    if (ts.isCatchClause(node) && node.variableDeclaration) addBinding(node.variableDeclaration.name, null, node.variableDeclaration)
    ts.forEachChild(node, collect)
  })
  const bindingFor = (node: ts.Identifier): ts.Expression | null =>
    (bindings.get(node.text) ?? [])
      .filter(({ scope }) => scope.pos <= node.pos && node.end <= scope.end)
      .sort((left, right) => right.depth - left.depth)[0]?.initializer ?? null

  const callbackResults = (expression: ts.Expression): ts.Expression[] => {
    let callback = unwrap(expression)
    if (ts.isIdentifier(callback)) {
      const initializer = bindingFor(callback)
      if (!initializer) return []
      callback = unwrap(initializer)
    }
    if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) return []
    if (ts.isArrowFunction(callback) && !ts.isBlock(callback.body)) return [callback.body]
    const results: ts.Expression[] = []
    const resolved = callback
    const walk = (node: ts.Node): void => {
      if (ts.isReturnStatement(node) && node.expression) results.push(node.expression)
      if (!ts.isFunctionLike(node) || node === resolved) ts.forEachChild(node, walk)
    }
    walk(callback.body)
    return results
  }

  // Resolves statically knowable string values: literals, conditional and
  // logical branches, and identifier chains through in-scope bindings.
  const staticStringValues = (node: ts.Expression, seen: Set<ts.Node>): string[] => {
    const expression = unwrap(node)
    if (seen.has(expression)) return []
    seen.add(expression)
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return [expression.text]
    if (ts.isConditionalExpression(expression)) return [...staticStringValues(expression.whenTrue, seen), ...staticStringValues(expression.whenFalse, seen)]
    if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
      return [...staticStringValues(expression.left, seen), ...staticStringValues(expression.right, seen)]
    }
    if (ts.isIdentifier(expression)) {
      const initializer = bindingFor(expression)
      return initializer ? staticStringValues(initializer, seen) : []
    }
    return []
  }

  const record = (name: string, initializer: ts.Expression | null): void => {
    const values = initializer ? staticStringValues(initializer, new Set()) : []
    declarations.push({ name, literalValue: values.length ? values.join(" ") : null })
  }

  const recordObject = (object: ts.ObjectLiteralExpression, seen: Set<ts.Node>): void => {
    if (seen.has(object)) return
    seen.add(object)
    for (const property of object.properties) {
      if (ts.isSpreadAssignment(property)) {
        recordExpression(property.expression, seen)
        continue
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        record(property.name.text, null)
        continue
      }
      if (!ts.isPropertyAssignment(property)) continue
      const name = property.name
      if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
        record(name.text, property.initializer)
      } else if (ts.isComputedPropertyName(name)) {
        const expression = unwrap(name.expression)
        if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) record(expression.text, property.initializer)
        else record(UNRESOLVABLE_MARKER, null)
      }
    }
  }

  function recordExpression(node: ts.Expression, seen: Set<ts.Node>): void {
    const expression = unwrap(node)
    if (seen.has(expression)) return
    if (ts.isObjectLiteralExpression(expression)) {
      recordObject(expression, seen)
      return
    }
    seen.add(expression)
    if (ts.isConditionalExpression(expression)) {
      recordExpression(expression.whenTrue, seen)
      recordExpression(expression.whenFalse, seen)
    } else if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
      recordExpression(expression.left, seen)
      recordExpression(expression.right, seen)
    } else if (ts.isIdentifier(expression)) {
      const initializer = bindingFor(expression)
      if (initializer) recordExpression(initializer, seen)
    } else if (ts.isCallExpression(expression)) {
      const callee = unwrap(expression.expression)
      const calleeName = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null
      if (calleeName && ["useMemo", "useCallback"].includes(calleeName) && expression.arguments[0]) {
        for (const result of callbackResults(expression.arguments[0])) recordExpression(result, seen)
      }
    } else if (ts.isElementAccessExpression(expression) || ts.isPropertyAccessExpression(expression)) {
      // A map lookup (sizeStyles[size], styles.compact.header) is audited
      // against every object-literal value reachable through the access
      // chain, covering all statically visible variants at any depth. The
      // node re-enters the visited set inside objectCandidates, so release
      // the pre-dispatch entry first.
      seen.delete(expression)
      for (const object of objectCandidates(expression, seen)) recordObject(object, seen)
    }
  }

  // Resolves an expression to the object literals it can statically denote:
  // the literal itself, an in-scope binding's initializer, either branch of a
  // conditional, or — for property/element accesses — the named property of
  // each base candidate when the key is a literal, otherwise every
  // property-assignment value of each base candidate.
  function objectCandidates(node: ts.Expression, seen: Set<ts.Node>): ts.ObjectLiteralExpression[] {
    const expression = unwrap(node)
    if (ts.isObjectLiteralExpression(expression)) return [expression]
    if (seen.has(expression)) return []
    seen.add(expression)
    if (ts.isConditionalExpression(expression)) return [...objectCandidates(expression.whenTrue, seen), ...objectCandidates(expression.whenFalse, seen)]
    if (ts.isIdentifier(expression)) {
      const initializer = bindingFor(expression)
      return initializer ? objectCandidates(initializer, seen) : []
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const key = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : expression.argumentExpression && (ts.isStringLiteral(expression.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
          ? expression.argumentExpression.text
          : null
      const results: ts.ObjectLiteralExpression[] = []
      for (const base of objectCandidates(expression.expression, seen)) {
        for (const property of base.properties) {
          if (!ts.isPropertyAssignment(property)) continue
          const name = property.name
          const propertyName = ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) ? name.text : null
          if (key === null || propertyName === null || propertyName === key) results.push(...objectCandidates(property.initializer, seen))
        }
      }
      return results
    }
    return []
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.getText() === "style" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      recordExpression(node.initializer.expression, new Set())
    }
    // A literal props object spread onto an element ({...{ style: {...} }})
    // declares its style at the site; deeper indirection stays a documented
    // resolver limit.
    if (ts.isJsxSpreadAttribute(node)) {
      const spread = unwrap(node.expression)
      if (ts.isObjectLiteralExpression(spread)) {
        for (const property of spread.properties) {
          if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === "style") {
            recordExpression(property.initializer, new Set())
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return declarations
}

export function inlineStylePropertyNames(ast: ts.SourceFile): string[] {
  return inlineStyleDeclarations(ast).map((declaration) => declaration.name)
}

export function forbiddenInlineStyleProperties(ast: ts.SourceFile): string[] {
  return inlineStylePropertyNames(ast).filter((name) =>
    name !== UNRESOLVABLE_MARKER && !name.startsWith("--") && !INLINE_STYLE_ALLOWLIST.has(name),
  )
}

export function unresolvableInlineStyleKeys(ast: ts.SourceFile): number {
  return inlineStylePropertyNames(ast).filter((name) => name === UNRESOLVABLE_MARKER).length
}

export function literalColorCustomProperties(ast: ts.SourceFile): string[] {
  return inlineStyleDeclarations(ast)
    .filter((declaration) => declaration.name.startsWith("--") && declaration.literalValue !== null && containsLiteralColor(declaration.literalValue))
    .map((declaration) => declaration.name)
}

export const styleDisciplineCheck = defineCheck({
  id: "style-discipline",
  ...checkMetadata["style-discipline"],
  async run(context) {
    const findings = []
    const paths = context.files.match(["packages/react/src/**/*.{ts,tsx}"])
    const auditedPaths = new Set(paths)
    const exceptionByPath = new Map<string, StyleException[]>()
    for (const entry of styleExceptions) exceptionByPath.set(entry.path, [...(exceptionByPath.get(entry.path) ?? []), entry])

    for (const filePath of paths) {
      const ast = await context.parseTypeScript(filePath)
      const tokens = classTokens(ast)
      const entries = exceptionByPath.get(filePath) ?? []
      const excepted = (contractId: StyleException["contractId"], needle: string): StyleException | undefined =>
        entries.find((entry) => entry.contractId === contractId && entry.needle === needle)

      const paletteViolations = new Map<string, number>()
      for (const token of tokens) {
        if (usesRawPalette(token)) paletteViolations.set(token, (paletteViolations.get(token) ?? 0) + 1)
        else if (usesLiteralColorValue(token)) paletteViolations.set(token, (paletteViolations.get(token) ?? 0) + 1)
      }
      for (const [token, count] of paletteViolations) {
        const kind = usesRawPalette(token) ? "Raw palette utility" : "Literal color value in utility"
        findings.push(context.fail(`${kind} ${token} (${count} occurrence${count === 1 ? "" : "s"}) bypasses semantic tokens.`, { contractId: "STYLE-001", path: filePath, repair: "Route the color through a semantic token utility or a --nessa-* custom property." }))
      }
      const literalColorProps = literalColorCustomProperties(ast)
      for (const name of new Set(literalColorProps)) {
        if (!excepted("STYLE-003", name)) findings.push(context.fail(`Inline custom property ${name} carries a literal color value.`, { contractId: "STYLE-003", path: filePath, repair: "Point the custom property at a semantic token, or ledger an exact transitional exception." }))
      }

      const offScale = new Map<string, number>()
      for (const token of tokens) {
        const utility = offScaleStackingUtility(token)
        if (utility) offScale.set(utility, (offScale.get(utility) ?? 0) + 1)
      }
      for (const [utility, count] of offScale) {
        if (!excepted("STYLE-002", utility)) findings.push(context.fail(`Off-scale stacking utility ${utility} (${count} occurrence${count === 1 ? "" : "s"}); the frozen scale is z-0..z-50 and z-auto.`, { contractId: "STYLE-002", path: filePath, repair: "Move the layer onto the frozen scale or ledger an exact transitional exception." }))
      }

      const forbiddenNames = forbiddenInlineStyleProperties(ast)
      const forbidden = new Map<string, number>()
      for (const name of forbiddenNames) forbidden.set(name, (forbidden.get(name) ?? 0) + 1)
      for (const [name, count] of forbidden) {
        if (!excepted("STYLE-003", name)) findings.push(context.fail(`Inline style property ${name} (${count} occurrence${count === 1 ? "" : "s"}) is outside the computed-geometry allowlist.`, { contractId: "STYLE-003", path: filePath, repair: "Express it as a utility with semantic tokens, inject a --nessa-* custom property instead, or ledger an exact transitional exception." }))
      }
      const unresolvable = unresolvableInlineStyleKeys(ast)
      if (unresolvable) findings.push(context.fail(`${unresolvable} dynamically keyed inline style propert${unresolvable === 1 ? "y" : "ies"} cannot be statically validated.`, { contractId: "STYLE-003", path: filePath, repair: "Use literal property names (custom properties included) so the declaration is auditable." }))

      for (const entry of entries) {
        const count = entry.contractId === "STYLE-002"
          ? tokens.filter((token) => offScaleStackingUtility(token) === entry.needle).length
          : entry.needle.startsWith("--")
            ? literalColorProps.filter((name) => name === entry.needle).length
            : forbiddenNames.filter((name) => name === entry.needle).length
        if (count !== entry.maximumOccurrences) findings.push(context.fail(`${entry.path} exception for ${entry.needle} is stale or changed (${count}/${entry.maximumOccurrences}).`, { contractId: entry.contractId, path: entry.path, repair: count === 0 ? "Remove the stale ledger entry." : "Do not broaden the occurrence; amend the contract explicitly if unavoidable." }))
        else findings.push(context.exception(`${entry.needle} remains an exact transitional occurrence.`, { contractId: entry.contractId, path: entry.path, repair: entry.removalCondition }))
      }
    }

    for (const entry of styleExceptions) {
      if (!auditedPaths.has(entry.path)) findings.push(context.fail(`${entry.path} exception for ${entry.needle} points outside the audited source set.`, { contractId: entry.contractId, path: entry.path, repair: "Remove the stale ledger entry or move it to an audited path." }))
    }

    if (!findings.some((finding) => finding.state === "FAIL")) findings.push(context.pass("Class surfaces stay on semantic tokens, the frozen stacking scale, and the inline-style geometry allowlist.", { contractId: "STYLE-001" }))
    return findings
  },
})
