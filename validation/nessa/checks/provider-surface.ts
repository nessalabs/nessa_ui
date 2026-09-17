import ts from "typescript"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

const providerPath = "packages/react/src/provider/nessa-provider.tsx"
const colorModePath = "packages/react/src/provider/nessa-color-mode.ts"
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
 * 2. The provider mutates one element it owns and never the document. A
 *    design system that reached for `documentElement` could not appear twice
 *    on a page, or inside a host that owns its own root.
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
