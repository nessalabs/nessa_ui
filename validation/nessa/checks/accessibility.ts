import { converter, parse, type Color } from "culori"

import { exceptions, type ContrastException, type FocusContrastException, type ValidationException } from "../../exceptions.ts"
import { defineCheck } from "../../framework/define-check.ts"
import { contrastMatrix } from "../contrast-matrix.ts"
import { editableFocusDeclarations, focusGeometryClasses, focusSurfaces, focusTreatments, type EditableFocusDeclaration } from "../focus-treatments.ts"
import tsModule from "typescript"

import { classSurfaces, classTokens } from "./source-boundaries.ts"
import { extractThemeTokens } from "./theme-parity.ts"
import { checkMetadata } from "../check-metadata.ts"

const toRgb = converter("rgb")
const toLinear = converter("lrgb")
const validationExceptions: readonly ValidationException[] = exceptions
const contrastExceptions = validationExceptions.filter((entry): entry is ContrastException => entry.kind === "contrast")
const focusExceptions = validationExceptions.filter((entry): entry is FocusContrastException => entry.kind === "focus-contrast")

interface LinearColor { r: number; g: number; b: number; alpha: number; wideGamut: boolean }

function color(value: string): LinearColor {
  const parsed = parse(value)
  if (!parsed) throw new Error(`Unsupported color: ${value}`)
  const rgb = toRgb(parsed as Color)
  const linear = toLinear(parsed as Color)
  if (!rgb || !linear || ![rgb.r, rgb.g, rgb.b, linear.r, linear.g, linear.b].every(Number.isFinite)) {
    throw new Error(`Non-finite color: ${value}`)
  }
  return {
    r: linear.r,
    g: linear.g,
    b: linear.b,
    alpha: "alpha" in parsed && typeof parsed.alpha === "number" ? parsed.alpha : 1,
    wideGamut: rgb.r < 0 || rgb.r > 1 || rgb.g < 0 || rgb.g > 1 || rgb.b < 0 || rgb.b > 1,
  }
}

function composite(foreground: LinearColor, background: LinearColor, opacity = 1): LinearColor {
  const alpha = foreground.alpha * opacity
  if (background.alpha < 1) throw new Error("Adjacent background must resolve to an opaque color")
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    alpha: 1,
    wideGamut: foreground.wideGamut || background.wideGamut,
  }
}

function luminance(value: LinearColor): number {
  return 0.2126 * value.r + 0.7152 * value.g + 0.0722 * value.b
}

export function contrastRatio(foregroundValue: string, backgroundValue: string, opacity = 1, overlay?: { value: string; opacity: number }): { ratio: number; wideGamut: boolean } {
  const surface = color(backgroundValue)
  const background = overlay ? composite(color(overlay.value), surface, overlay.opacity) : surface
  const foreground = composite(color(foregroundValue), background, opacity)
  const first = luminance(foreground)
  const second = luminance(background)
  return { ratio: (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05), wideGamut: foreground.wideGamut }
}

function focusExceptionFor(component: string, state: string, mode: "light" | "dark", token: string, opacity: number, surface: string): FocusContrastException | undefined {
  return focusExceptions.find((entry) => entry.component === component && entry.state === state && entry.mode === mode && entry.token === token && entry.opacity === opacity && entry.surface === surface)
}

export function focusExceptionFingerprintMatches(exception: FocusContrastException, tokenValue: string, surfaceValue: string, requiredRatio = 3): boolean {
  return exception.expectedTokenValue === tokenValue && exception.expectedSurfaceValue === surfaceValue && exception.requiredRatio === requiredRatio
}

export function resolveTokenValue(tokens: Readonly<Record<string, string>>, token: string, seen = new Set<string>()): string {
  const name = token.startsWith("--") ? token.slice(2) : token
  if (seen.has(name)) throw new Error(`Cyclic token reference: ${[...seen, name].join(" -> ")}`)
  const value = tokens[name]
  if (!value) throw new Error(`Missing token --${name}`)
  const reference = value.trim().match(/^var\((--[a-z0-9-]+)\)$/i)
  if (!reference) return value
  return resolveTokenValue(tokens, reference[1]!, new Set([...seen, name]))
}

export function discoverFocusClasses(source: string): string[] {
  return source.match(/(?:dark:)?(?:focus-visible|aria-invalid):(?:(?:ring|border)-|-?outline-(?!\d|offset-))[^\s"'`]+/g) ?? []
}

export function focusClassesFromAst(ast: import("typescript").SourceFile): string[] {
  return classTokens(ast).filter((token) => /^(?:dark:)?(?:focus-visible|aria-invalid):-?(?:ring|border|outline)-.+$/.test(token))
}

/**
 * A focus indicator proper: something that appears *because the element is
 * focused*. An `aria-invalid:` treatment is a validity state, not focus — a
 * valid focused field carrying only that renders no indicator at all — so it
 * can never prove an `own` declaration, and never violates a `none` one.
 */
const focusIndicatorPattern = /^(?:dark:)?focus-visible:-?(?:ring|border|outline)-.+$/

/** One editable element, found by walking the tree rather than by its classes. */
export interface EditableSurface {
  element: "textarea" | "contenteditable"
  /** The element's `data-slot`, when it has a literal one: its stable name. */
  slot: string | null
  classes: string[]
}

/**
 * Every editable element a component renders, one entry per element, with the
 * focus indicators drawn on that element.
 *
 * Discovery walks JSX elements directly, not class surfaces: a bare
 * `<textarea />` owns no `className` and would otherwise produce no entry at
 * all, which is exactly the surface most likely to have been added without
 * anyone deciding what focus should do. Class surfaces are then joined onto
 * the element that owns them.
 */
export function editableFocusSurfaces(ast: import("typescript").SourceFile): EditableSurface[] {
  const ts = tsModule
  const byElement = new Map<number, string[]>()
  for (const surface of classSurfaces(ast)) {
    if (surface.elementPos === null) continue
    byElement.set(surface.elementPos, [...(byElement.get(surface.elementPos) ?? []), ...surface.tokens])
  }
  const found: EditableSurface[] = []
  const visit = (node: import("typescript").Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes = node.attributes.properties.flatMap((property) =>
        ts.isJsxAttribute(property) ? [property] : [],
      )
      const named = (name: string) => attributes.find((attribute) => attribute.name.getText() === name)
      const element = node.tagName.getText() === "textarea"
        ? "textarea" as const
        : named("contentEditable")
          ? "contenteditable" as const
          : null
      if (element) {
        const slotAttribute = named("data-slot")?.initializer
        const slot = slotAttribute && ts.isStringLiteral(slotAttribute) ? slotAttribute.text : null
        found.push({
          element,
          slot,
          classes: (byElement.get(node.pos) ?? []).filter((token) => focusIndicatorPattern.test(token)),
        })
      }
    }
    node.forEachChild(visit)
  }
  ast.forEachChild(visit)
  return found
}

export const accessibilityCheck = defineCheck({
  id: "accessibility",
  ...checkMetadata.accessibility,
  async run(context) {
    const findings = []
    const activeContrastExceptions: string[] = []
    const activeFocusExceptions: string[] = []
    const tokens = extractThemeTokens(await context.parseCss("packages/react/src/theme.css"))

    for (const mode of ["light", "dark"] as const) {
      for (const pair of contrastMatrix) {
        const label = pair.overlay ? `${pair.foreground}/${pair.background}+${pair.overlay.token}@${pair.overlay.opacity}` : `${pair.foreground}/${pair.background}`
        let foreground: string | undefined
        let background: string | undefined
        let overlayValue: string | undefined
        try {
          foreground = resolveTokenValue(tokens[mode], pair.foreground)
          background = resolveTokenValue(tokens[mode], pair.background)
          if (pair.overlay) overlayValue = resolveTokenValue(tokens[mode], pair.overlay.token)
        } catch (error) {
          findings.push(context.fail(error instanceof Error ? error.message : String(error), { contractId: "A11Y-001" }))
          continue
        }
        if (!foreground || !background) {
          findings.push(context.fail(`${mode} contrast pair is missing ${pair.foreground} or ${pair.background}.`, { contractId: "A11Y-001" }))
          continue
        }
        try {
          // Contrast exceptions identify token-on-token pairs only; overlay
          // pairs cannot be excepted and fail closed.
          const exception = pair.overlay ? undefined : contrastExceptions.find((entry) => entry.mode === mode && entry.foreground === pair.foreground && entry.background === pair.background)
          if (exception && (exception.expectedForegroundValue !== foreground || exception.expectedBackgroundValue !== background || exception.requiredRatio !== pair.minimum)) {
            findings.push(context.fail(`Contrast exception fingerprint changed for ${mode} ${label}.`, { contractId: "A11Y-001" }))
            continue
          }
          const measured = contrastRatio(foreground, background, 1, pair.overlay && overlayValue ? { value: overlayValue, opacity: pair.overlay.opacity } : undefined)
          if (measured.wideGamut) {
            findings.push(context.review(`${mode} ${label} is valid wider-gamut color and needs browser evidence.`, { contractId: "A11Y-004" }))
            continue
          }
          if (measured.ratio + 1e-6 < pair.minimum) {
            if (exception) activeContrastExceptions.push(`${mode} ${label}=${measured.ratio.toFixed(2)}:1`)
            else findings.push(context.fail(`${mode} ${label} is ${measured.ratio.toFixed(2)}:1 (requires ${pair.minimum}:1).`, { contractId: "A11Y-001" }))
          } else if (exception) {
            findings.push(context.fail(`Contrast exception is stale because ${mode} ${label} now passes.`, { contractId: "A11Y-001", repair: "Remove the exception." }))
          }
        } catch (error) {
          findings.push(context.fail(error instanceof Error ? error.message : String(error), { contractId: "A11Y-001" }))
        }
      }
    }

    // Composites carry focus treatments too (for example the dock resize
    // separator), so they are scanned alongside the component primitives.
    const componentPaths = context.files.match([
      "packages/react/src/components/**/*.tsx",
      "packages/react/src/composites/**/*.tsx",
    ])
    const scannedComponents = new Set<string>()
    for (const componentPath of componentPaths) {
      const component = componentPath.replace(/^packages\/react\/src\/(?:components|composites)\//, "").replace(/\.tsx$/, "")
      scannedComponents.add(component)
      const componentTreatments = focusTreatments.filter((candidate) => candidate.component === component)
      const allowedClasses = new Set([
        ...componentTreatments.flatMap((treatment) => [treatment.className, treatment.darkClassName].filter((value): value is string => Boolean(value))),
        ...focusGeometryClasses.filter((entry) => entry.component === component).map((entry) => entry.className),
      ])
      const discovered = focusClassesFromAst(await context.parseTypeScript(componentPath))
      const counts = new Map<string, number>()
      for (const className of discovered) counts.set(className, (counts.get(className) ?? 0) + 1)
      for (const className of discovered) {
        if (!allowedClasses.has(className)) findings.push(context.fail(`Unregistered focus treatment ${className} in ${component}.`, { contractId: "A11Y-002" }))
      }
      for (const treatment of componentTreatments) {
        const expectedCount = treatment.count ?? 1
        if (counts.get(treatment.className) !== expectedCount || (treatment.darkClassName && counts.get(treatment.darkClassName) !== expectedCount)) {
          findings.push(context.fail(`Focus treatment inventory is stale for ${component} ${treatment.state}.`, { contractId: "A11Y-002" }))
        }
      }
      for (const geometry of focusGeometryClasses.filter((entry) => entry.component === component)) if (counts.get(geometry.className) !== ("count" in geometry ? geometry.count : 1)) findings.push(context.fail(`Focus geometry inventory is stale for ${component} ${geometry.className}.`, { contractId: "A11Y-003" }))
    }
    // A11Y-005 asks which element reads as the field; A11Y-006 is the half a
    // checker can decide — that somebody answered the question for every
    // editable element, and that the answer matches what the element draws.
    const usedDeclarations = new Set<EditableFocusDeclaration>()
    for (const componentPath of componentPaths) {
      const component = componentPath.replace(/^packages\/react\/src\/(?:components|composites)\//, "").replace(/\.tsx$/, "")
      // Each element is judged on its own: two textareas in one file can
      // disagree, and a bare second one must not pass on the first's ring.
      for (const surface of editableFocusSurfaces(await context.parseTypeScript(componentPath))) {
        const candidates = editableFocusDeclarations.filter((entry) => entry.component === component && entry.element === surface.element)
        // A slot-specific record wins over the component-wide one, which is
        // how a file whose editables differ expresses that.
        const declaration = candidates.find((entry) => entry.slot !== undefined && entry.slot === surface.slot)
          ?? candidates.find((entry) => entry.slot === undefined)
        const named = surface.slot ? `${surface.element} ${surface.slot}` : surface.element
        if (!declaration) {
          findings.push(context.fail(`${component} renders a ${named} that declares no focus intent.`, { contractId: "A11Y-006", path: componentPath }))
          continue
        }
        usedDeclarations.add(declaration)
        if (declaration.indicator === "none" && surface.classes.length) {
          findings.push(context.fail(`${component} declares no focus indicator on its ${named} but draws ${surface.classes.join(", ")}.`, { contractId: "A11Y-006", path: componentPath }))
        }
        if (declaration.indicator === "own" && !surface.classes.length) {
          findings.push(context.fail(`${component} declares its ${named} draws its own focus indicator, but no focus-visible treatment is present.`, { contractId: "A11Y-006", path: componentPath }))
        }
      }
    }
    for (const declaration of editableFocusDeclarations) {
      if (!usedDeclarations.has(declaration)) {
        findings.push(context.fail(`Editable focus declaration for ${declaration.component} ${declaration.element}${declaration.slot ? ` ${declaration.slot}` : ""} matches no rendered surface.`, { contractId: "A11Y-006" }))
      }
    }
    for (const treatment of focusTreatments) if (!scannedComponents.has(treatment.component)) findings.push(context.fail(`Focus inventory references missing component ${treatment.component}.`, { contractId: "A11Y-002" }))
    for (const geometry of focusGeometryClasses) if (!scannedComponents.has(geometry.component)) findings.push(context.fail(`Focus geometry inventory references missing component ${geometry.component}.`, { contractId: "A11Y-003" }))

    const usedFocusExceptions = new Set<FocusContrastException>()
    for (const treatment of focusTreatments) {
      for (const mode of ["light", "dark"] as const) {
        const spec = treatment[mode]
        let tokenValue: string
        try { tokenValue = resolveTokenValue(tokens[mode], spec.token) }
        catch (error) { findings.push(context.fail(`${mode}: ${error instanceof Error ? error.message : String(error)}`, { contractId: "A11Y-002" })); continue }
        for (const surface of treatment.surfaces ?? focusSurfaces) {
          let surfaceValue: string
          try { surfaceValue = resolveTokenValue(tokens[mode], surface) }
          catch (error) { findings.push(context.fail(`${mode}: ${error instanceof Error ? error.message : String(error)}`, { contractId: "A11Y-002" })); continue }
          const exception = focusExceptionFor(treatment.component, treatment.state, mode, spec.token, spec.opacity, surface)
          try {
            if (exception && !focusExceptionFingerprintMatches(exception, tokenValue, surfaceValue)) {
              findings.push(context.fail(`Focus exception fingerprint changed for ${mode} ${treatment.component} ${treatment.state} on ${surface}.`, { contractId: "A11Y-002" }))
              continue
            }
            const measured = contrastRatio(tokenValue, surfaceValue, spec.opacity)
            if (measured.wideGamut) {
              findings.push(context.review(`${mode} ${treatment.component} ${treatment.state} on ${surface} needs wider-gamut browser evidence.`, { contractId: "A11Y-004" }))
            } else if (measured.ratio + 1e-6 < 3) {
              if (exception) {
                usedFocusExceptions.add(exception)
                activeFocusExceptions.push(`${mode} ${treatment.component} ${treatment.state} ${surface}=${measured.ratio.toFixed(2)}:1`)
              } else {
                findings.push(context.fail(`Unledgered focus failure: ${mode} ${treatment.component} ${treatment.state} on ${surface} is ${measured.ratio.toFixed(2)}:1.`, { contractId: "A11Y-002" }))
              }
            } else if (exception) {
              findings.push(context.fail(`Focus exception is stale because ${mode} ${treatment.component} ${treatment.state} on ${surface} now passes.`, { contractId: "A11Y-002" }))
            }
          } catch (error) {
            findings.push(context.fail(error instanceof Error ? error.message : String(error), { contractId: "A11Y-002" }))
          }
        }
      }
    }
    for (const exception of focusExceptions) {
      if (!usedFocusExceptions.has(exception)) findings.push(context.fail(`Unused focus exception: ${exception.mode} ${exception.component} ${exception.state} ${exception.surface}.`, { contractId: "A11Y-002" }))
    }
    if (activeContrastExceptions.length) {
      findings.push(context.exception(`${activeContrastExceptions.length} exact canonical boundary exceptions remain: ${activeContrastExceptions.join(", ")}.`, {
        contractId: "A11Y-001",
        repair: "Remove each entry as the canonical accessible boundary palette lands.",
      }))
    }
    if (activeFocusExceptions.length) {
      findings.push(context.exception(`${activeFocusExceptions.length} exact focus-treatment exceptions remain; all unlisted tuples fail.`, {
        contractId: "A11Y-002",
        repair: "Remove them with the semantic focus/invalid token migration before provider stabilization.",
      }))
    }
    if (!findings.some((finding) => finding.state === "FAIL")) findings.push(context.pass("Canonical contrast and effective focus treatment inventory are contained.", { contractId: "A11Y-001" }))
    return findings
  },
})
