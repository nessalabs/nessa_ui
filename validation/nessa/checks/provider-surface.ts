import ts from "typescript"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

const providerPath = "packages/react/src/provider/nessa-provider.tsx"
const colorModePath = "packages/react/src/provider/nessa-color-mode.ts"
const scopePath = "packages/react/src/provider/nessa-scope.tsx"
const themeScopePath = "packages/react/src/theme/nessa-theme-scope.tsx"
const themeCssPath = "packages/react/src/theme.css"

/** Every JSX attribute name written anywhere in a file, with its literal value. */
function jsxAttributes(ast: ts.SourceFile) {
  const found: { name: string; value: string | null }[] = []
  ast.forEachChild(function visit(node) {
    if (ts.isJsxAttribute(node)) {
      const initializer = node.initializer
      found.push({
        name: node.name.getText(ast),
        value:
          initializer && ts.isStringLiteral(initializer)
            ? initializer.text
            : null,
      })
    }
    ts.forEachChild(node, visit)
  })
  return found
}

/** Every string literal in a file, for asserting what a scope writes. */
function stringLiterals(ast: ts.SourceFile) {
  const found: string[] = []
  ast.forEachChild(function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      found.push(node.text)
    }
    ts.forEachChild(node, visit)
  })
  return found
}

/** Names bound to a hook's result, e.g. `const layerScope = useNessaLayerScope()`. */
function hookBindings(ast: ts.SourceFile, hookName: string): Set<string> {
  const names = new Set<string>()
  ast.forEachChild(function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === hookName
    ) {
      names.add(node.name.text)
    }
    ts.forEachChild(node, visit)
  })
  return names
}

export const layerModeAttribute = "data-nessa-mode"

/**
 * Whether anything *inside* this element carries the resolved mode.
 *
 * Either by spreading a binding the layer-scope hook returned, whose contents
 * the provider check settles separately, or by writing the attribute out. The
 * rule is about the attribute arriving, not about the mechanism that brought
 * it: `data-nessa-mode` is what every dark token selector matches, so an
 * element without it resolves against whatever the page did.
 */
function carriesLayerScope(element: ts.JsxElement, scopes: ReadonlySet<string>): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (
      ts.isJsxSpreadAttribute(node) &&
      ts.isIdentifier(node.expression) &&
      scopes.has(node.expression.text)
    ) {
      found = true
      return
    }
    if (ts.isJsxAttribute(node) && node.name.getText(node.getSourceFile()) === layerModeAttribute) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  // The children only: a spread on the portal itself lands on a wrapper that
  // draws nothing, not on the element whose tokens are being asked about.
  for (const child of element.children) visit(child)
  return found
}

/** The object literal behind a value, through a binding and a `useMemo`. */
function objectLiteralBehind(
  ast: ts.SourceFile,
  expression: ts.Expression,
): ts.ObjectLiteralExpression | null {
  let current: ts.Expression = expression
  while (ts.isParenthesizedExpression(current)) current = current.expression
  if (ts.isObjectLiteralExpression(current)) return current
  if (ts.isCallExpression(current)) {
    const callee = current.expression
    const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : null
    if (name === "useMemo" && current.arguments[0] && ts.isArrowFunction(current.arguments[0])) {
      const body = (current.arguments[0] as ts.ArrowFunction).body
      return ts.isBlock(body) ? null : objectLiteralBehind(ast, body)
    }
    return null
  }
  if (!ts.isIdentifier(current)) return null
  let resolved: ts.ObjectLiteralExpression | null = null
  const name = current.text
  ast.forEachChild(function visit(node) {
    if (
      resolved === null &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      resolved = objectLiteralBehind(ast, node.initializer)
    }
    ts.forEachChild(node, visit)
  })
  return resolved
}

/** Property names an object literal assigns, quoted or not. */
function objectKeys(object: ts.ObjectLiteralExpression): string[] {
  return object.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) return []
    const name = property.name
    if (ts.isStringLiteral(name) || ts.isIdentifier(name)) return [name.text]
    return []
  })
}

/**
 * The attribute names the provider publishes for its layers to carry.
 *
 * A layer spreading the hook's result is only carrying the mode if the mode
 * is in what the provider put there, so this settles the other end of the
 * chain the portal scan checks: published here, spread onto the element
 * there.
 *
 * @returns The keys, or null when no `scope` is published at all.
 */
export function publishedLayerScopeKeys(ast: ts.SourceFile): string[] | null {
  let keys: string[] | null = null
  ast.forEachChild(function visit(node) {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null
    if (opening && opening.tagName.getText(ast) === "PortalContainerProvider") {
      const scope = opening.attributes.properties.find(
        (property): property is ts.JsxAttribute =>
          ts.isJsxAttribute(property) && property.name.getText(ast) === "scope",
      )
      if (scope?.initializer && ts.isJsxExpression(scope.initializer) && scope.initializer.expression) {
        const object = objectLiteralBehind(ast, scope.initializer.expression)
        if (object) keys = objectKeys(object)
      }
    }
    ts.forEachChild(node, visit)
  })
  return keys
}

/**
 * Portals whose destination the provider governs, and whose content does not
 * carry the scope onto itself.
 *
 * A portal reached through `usePortalContainer` is one the provider answers
 * for: it lands in a panel's own container, or in the body, and in the second
 * case it leaves the tree entirely. The tokens its class names read are
 * declared on `data-nessa-*`, so an element that arrives without them renders
 * against whatever the page resolved rather than against the scope it was
 * opened from — a picker in a Dark provider on a Light page coming up light.
 *
 * Calling the hook is not the claim; spreading it onto the element is. This
 * reads the JSX rather than the file's text so a call whose result goes
 * nowhere fails exactly as a missing call does.
 *
 * @returns One description per offending portal, empty when the file governs
 * no portal or every governed portal carries the scope.
 */
export function unscopedPortalLayers(ast: ts.SourceFile): string[] {
  const containers = hookBindings(ast, "usePortalContainer")
  if (!containers.size) return []
  const scopes = hookBindings(ast, "useNessaLayerScope")
  const offenders: string[] = []
  ast.forEachChild(function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node
      const tag = opening.tagName.getText(ast)
      if (tag === "Portal" || tag.endsWith(".Portal")) {
        const container = opening.attributes.properties.find(
          (property): property is ts.JsxAttribute =>
            ts.isJsxAttribute(property) && property.name.getText(ast) === "container",
        )
        const destination =
          container?.initializer &&
          ts.isJsxExpression(container.initializer) &&
          container.initializer.expression &&
          ts.isIdentifier(container.initializer.expression)
            ? container.initializer.expression.text
            : null
        // A portal pointed somewhere else — a panel's own ref, a container a
        // caller passed in — is not the provider's to answer for.
        if (destination && containers.has(destination)) {
          const carried =
            ts.isJsxElement(node) && carriesLayerScope(node, scopes)
          if (!carried) {
            const { line } = ast.getLineAndCharacterOfPosition(node.getStart(ast))
            offenders.push(`${tag} at line ${line + 1}`)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  })
  return offenders
}

/**
 * PROVIDER-001: the provider surface, checked against the parts of its frozen
 * contract a source reader can settle.
 *
 * Three properties matter more than the rest, because each one fails silently
 * and looks like a styling bug rather than a contract breach:
 *
 * 1. `data-nessa-mode` never carries `system`. It is the attribute every dark
 *    token selector matches, so a third value would leave those selectors
 *    asking a question CSS cannot answer.
 * 2. The provider mutates one element it owns and never the document itself.
 *    A design system that reached for `documentElement` could not appear twice
 *    on a page, or inside a host that owns its own root. The layers opened
 *    inside it are not Nessa's to move either: they carry the scope onto
 *    their own element and stay where they were going, so the root never
 *    becomes their clipping or containing-block ancestor.
 * 3. A theme-bearing scope re-emits the resolved mode. Dark selectors match
 *    the nearest scope rather than any dark ancestor, which is the whole
 *    mechanism behind a light region inside a dark one.
 */
export const providerSurfaceCheck = defineCheck({
  id: "provider-surface",
  ...checkMetadata["provider-surface"],
  async run(context) {
    const findings = []
    const provider = await context.parseTypeScript(providerPath)
    const colorMode = await context.parseTypeScript(colorModePath)
    const themeScope = await context.parseTypeScript(themeScopePath)
    const providerSource = provider.getFullText()
    const colorModeSource = colorMode.getFullText()
    const themeScopeSource = themeScope.getFullText()

    // 1. The resolved mode is the two appearances, never the request.
    if (
      !colorModeSource.includes("export type NessaResolvedColorMode") ||
      !/NessaResolvedColorMode\s*=\s*\|?\s*typeof NessaColorMode\.Light\s*\|\s*typeof NessaColorMode\.Dark/.test(
        colorModeSource,
      )
    ) {
      findings.push(
        context.fail(
          "NessaResolvedColorMode must be exactly Light | Dark, so `system` can never reach the DOM.",
          { contractId: "PROVIDER-001", path: colorModePath },
        ),
      )
    }
    const providerAttributes = jsxAttributes(provider)
    const providerProps = stringLiterals(provider)
    for (const attribute of [
      "data-nessa-root",
      "data-nessa-theme",
      "data-nessa-mode",
      "data-nessa-scale",
    ]) {
      if (!providerProps.includes(attribute)) {
        findings.push(
          context.fail(`NessaProvider must emit ${attribute} on its scope element.`, {
            contractId: "PROVIDER-001",
            path: providerPath,
          }),
        )
      }
    }
    if (!providerSource.includes('"data-nessa-mode": resolvedMode')) {
      findings.push(
        context.fail(
          "NessaProvider must write the resolved mode into data-nessa-mode, not the requested one.",
          { contractId: "PROVIDER-001", path: providerPath },
        ),
      )
    }

    // 2. One owned element. The document is not Nessa's to touch.
    for (const forbidden of [
      "document.documentElement",
      "document.body",
      "documentElement.classList",
    ]) {
      for (const [path, source] of [
        [providerPath, providerSource],
        [themeScopePath, themeScopeSource],
      ] as const) {
        if (source.includes(forbidden)) {
          findings.push(
            context.fail(
              `${path} touches ${forbidden}; the provider owns its own element and nothing else.`,
              { contractId: "PROVIDER-001", path },
            ),
          )
        }
      }
    }
    // The provider carries the theme to its layers rather than relocating
    // them under the scope. The element an application hands the provider is
    // where that application puts its own `overflow`, `transform` and layout;
    // a layer routed into it inherits all three, so a provider embedded in a
    // host's own clipping box would clip every menu opened inside it, and an
    // empty layer host would lay a page out differently for having adopted
    // the provider at all.
    if (providerSource.includes("createPortal")) {
      findings.push(
        context.fail(
          "NessaProvider must publish its layer scope for layers to carry, not a container that moves them under its own element.",
          { contractId: "PROVIDER-001", path: providerPath },
        ),
      )
    }
    // The other end of the chain the portal scan checks. A layer spreading
    // the hook's result carries the mode only if the provider put the mode
    // there, and `data-nessa-mode` is the one that fails silently: it is what
    // every dark token selector matches, so a layer without it resolves
    // against whatever the page did rather than against its own scope.
    const publishedScope = publishedLayerScopeKeys(provider)
    if (!publishedScope?.includes(layerModeAttribute)) {
      findings.push(
        context.fail(
          `NessaProvider must publish ${layerModeAttribute} on the layer scope; a layer that carries the rest resolves its dark tokens against the page.`,
          { contractId: "PROVIDER-001", path: providerPath },
        ),
      )
    }
    const scope = await context.parseTypeScript(scopePath)
    if (/trailing/.test(scope.getFullText())) {
      findings.push(
        context.fail(
          "A Nessa scope element renders its children and nothing else; a slot inside it would put layers back under the root's clipping.",
          { contractId: "PROVIDER-001", path: scopePath },
        ),
      )
    }
    // And every layer the provider governs actually carries it, read from the
    // JSX rather than from the file's text: the claim is the scope reaching
    // the element, not the hook being called somewhere above it.
    for (const layerPath of context.files.match([
      "packages/react/src/components/**/*.tsx",
    ])) {
      const layer = await context.parseTypeScript(layerPath)
      for (const offender of unscopedPortalLayers(layer)) {
        findings.push(
          context.fail(
            `${layerPath} portals through ${offender} without carrying the scope onto the layer it draws.`,
            { contractId: "PROVIDER-001", path: layerPath },
          ),
        )
      }
    }
    if (!providerSource.includes("colorScheme: resolvedMode")) {
      findings.push(
        context.fail(
          "NessaProvider must keep ownership of color-scheme so controls and scrollbars agree with the tokens.",
          { contractId: "PROVIDER-001", path: providerPath },
        ),
      )
    }

    // 3. A theme scope re-anchors the mode selectors; a scale-only one does not.
    if (!themeScopeSource.includes("useNessaColorMode()")) {
      findings.push(
        context.fail(
          "NessaThemeScope must read the resolved mode from the provider rather than deriving one.",
          { contractId: "PROVIDER-001", path: themeScopePath },
        ),
      )
    }
    if (
      !themeScopeSource.includes(
        '"data-nessa-mode": theme === undefined ? undefined : resolvedMode',
      )
    ) {
      findings.push(
        context.fail(
          "A theme-bearing NessaThemeScope must re-emit data-nessa-mode, and a scale-only one must not.",
          { contractId: "PROVIDER-001", path: themeScopePath },
        ),
      )
    }
    void providerAttributes

    // The CSS side of the same contract: the dark tokens have to be reachable
    // through the attribute the provider writes, or the provider changes an
    // attribute nothing reads.
    const css = await context.readText(themeCssPath)
    if (!css.includes('[data-nessa-mode="dark"]')) {
      findings.push(
        context.fail(
          "theme.css must anchor its Dark tokens to [data-nessa-mode=\"dark\"], or the provider's attribute styles nothing.",
          { contractId: "PROVIDER-001", path: themeCssPath },
        ),
      )
    }

    if (!findings.some((finding) => finding.state === "FAIL")) {
      findings.push(
        context.pass(
          "Provider and theme scope own one element each, resolve mode to Light or Dark, and anchor Dark tokens to the scope that resolved them.",
          { contractId: "PROVIDER-001" },
        ),
      )
    }
    return findings
  },
})
