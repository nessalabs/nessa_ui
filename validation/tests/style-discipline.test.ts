import assert from "node:assert/strict"
import test from "node:test"

import ts from "typescript"

import {
  containsLiteralColor,
  forbiddenInlineStyleProperties,
  inlineStylePropertyNames,
  literalColorCustomProperties,
  offScaleStackingUtility,
  unresolvableInlineStyleKeys,
  usesLiteralColorValue,
  usesRawPalette,
} from "../nessa/checks/style-discipline.ts"

const parse = (source: string): ts.SourceFile =>
  ts.createSourceFile("component.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

test("raw palette utilities are detected through variants, important, and opacity forms", () => {
  assert.equal(usesRawPalette("bg-red-500"), true)
  assert.equal(usesRawPalette("hover:text-zinc-400"), true)
  assert.equal(usesRawPalette("dark:group-hover:border-slate-200/50"), true)
  assert.equal(usesRawPalette("!bg-emerald-950"), true)
  assert.equal(usesRawPalette("bg-red-500!"), true)
  assert.equal(usesRawPalette("hover:bg-red-500!"), true)
  assert.equal(usesRawPalette("text-red-500/[0.5]"), true)
  assert.equal(usesRawPalette("text-red-500/(--my-opacity)"), true)
  assert.equal(usesRawPalette("border-s-red-500"), true)
  assert.equal(usesRawPalette("inset-ring-blue-400"), true)
  assert.equal(usesRawPalette("text-shadow-red-500"), true)
  assert.equal(usesRawPalette("focus-visible:ring-blue-600"), true)
})

test("semantic and structural utilities never match the raw palette rule", () => {
  assert.equal(usesRawPalette("bg-background"), false)
  assert.equal(usesRawPalette("text-destructive/90"), false)
  assert.equal(usesRawPalette("ring-[3px]"), false)
  assert.equal(usesRawPalette("bg-(--nessa-diff-add)"), false)
  assert.equal(usesRawPalette("grid-cols-3"), false)
  assert.equal(usesRawPalette("border-red-loading"), false)
  assert.equal(usesRawPalette("w-52"), false)
})

test("literal color values inside arbitrary utilities are detected", () => {
  assert.equal(usesLiteralColorValue("bg-[#fff]"), true)
  assert.equal(usesLiteralColorValue("bg-[#fff]!"), true)
  assert.equal(usesLiteralColorValue("text-[oklch(0.7_0.1_20)]"), true)
  assert.equal(usesLiteralColorValue("shadow-[0_0_0_1px_rgb(0,0,0)]"), true)
  assert.equal(usesLiteralColorValue("shadow-[0_0_0_4px_color-mix(in_oklab,var(--ring)_15%,transparent)]"), false)
  assert.equal(usesLiteralColorValue("shadow-[0_0_0_4px_color-mix(in_oklab,rgb(255,0,0)_15%,transparent)]"), true)
  assert.equal(usesLiteralColorValue("bg-[var(--nessa-thinking-fill-1)]"), false)
  assert.equal(usesLiteralColorValue("w-[min(22rem,calc(100vw-1.5rem))]"), false)
  assert.equal(usesLiteralColorValue("grid-cols-[2rem_minmax(0,1fr)]"), false)
})

test("named colors and paint arbitrary properties are literal color values", () => {
  assert.equal(usesLiteralColorValue("bg-[red]"), true)
  assert.equal(usesLiteralColorValue("text-[white]"), true)
  assert.equal(usesLiteralColorValue("shadow-[0_0_1px_rebeccapurple]"), true)
  assert.equal(usesLiteralColorValue("bg-[transparent]"), false)
  assert.equal(usesLiteralColorValue("text-[inherit]"), false)
  assert.equal(usesLiteralColorValue("[color:red]"), true)
  assert.equal(usesLiteralColorValue("[background:linear-gradient(to_right,red,blue)]"), true)
  assert.equal(usesLiteralColorValue("[color:var(--nessa-x)]"), false)
  assert.equal(usesLiteralColorValue("[transition-duration:var(--nessa-motion-duration-fast)]"), false)
  assert.equal(usesLiteralColorValue("[scrollbar-color:var(--color-border)_transparent]"), false)
  assert.equal(usesLiteralColorValue("fill-[url(#a1b2c3)]"), false)
  assert.equal(usesLiteralColorValue("fill-[url(#fade)]"), false)
  assert.equal(containsLiteralColor("var(--nessa-red-tone)"), false)
})

test("stacking utilities off the frozen scale are detected exactly", () => {
  assert.equal(offScaleStackingUtility("z-50"), null)
  assert.equal(offScaleStackingUtility("focus:z-10"), null)
  assert.equal(offScaleStackingUtility("z-auto"), null)
  assert.equal(offScaleStackingUtility("z-[60]"), "z-[60]")
  assert.equal(offScaleStackingUtility("z-[60]!"), "z-[60]")
  assert.equal(offScaleStackingUtility("hover:z-[1]"), "z-[1]")
  assert.equal(offScaleStackingUtility("z-60"), "z-60")
  assert.equal(offScaleStackingUtility("-z-10"), "-z-10")
  assert.equal(offScaleStackingUtility("z-(--layer)"), "z-(--layer)")
  assert.equal(offScaleStackingUtility("[z-index:9999]"), "[z-index:9999]")
  assert.equal(offScaleStackingUtility("gap-z-fake"), null)
  assert.equal(offScaleStackingUtility("bg-background"), null)
})

test("inline style keys are collected through literals, custom properties, spreads, and aliases", () => {
  const names = inlineStylePropertyNames(parse(`
    const shared = { backgroundImage: gradient, "--nessa-x": "1" }
    export const Component = ({ style }: { style?: object }) => (
      <div style={{ left: 4, ...shared, ...style, ["--nessa-y"]: value }} />
    )
  `))
  assert.deepEqual([...names].sort(), ["--nessa-x", "--nessa-y", "backgroundImage", "left"])
})

test("only non-custom properties outside the geometry allowlist are forbidden", () => {
  const forbidden = forbiddenInlineStyleProperties(parse(`
    export const Component = () => (
      <div style={{ left: x, width: w, transform: t, opacity: o, "--nessa-motion": m, boxShadow: s, backgroundColor: c }} />
    )
  `))
  assert.deepEqual([...forbidden].sort(), ["backgroundColor", "boxShadow"])
})

test("conditional and aliased style expressions are still audited", () => {
  const forbidden = forbiddenInlineStyleProperties(parse(`
    const shimmer = { color: "transparent" }
    export const Component = ({ active }: { active: boolean }) => (
      <span style={active ? shimmer : { top: 0 }} />
    )
  `))
  assert.deepEqual(forbidden, ["color"])
})

test("alias resolution is scope-aware, never leaking a same-named object across components", () => {
  const source = `
    const styles = { top: 0 }
    export const A = () => <div style={styles} />
    export const B = () => {
      const styles = { color: "red", backgroundColor: "blue" }
      return <div style={styles} />
    }
  `
  assert.deepEqual([...forbiddenInlineStyleProperties(parse(source))].sort(), ["backgroundColor", "color"])
  const flipped = `
    export const B = () => {
      const styles = { color: "red" }
      return <div style={styles} />
    }
    const styles = { top: 0 }
    export const A = () => <div style={styles} />
  `
  assert.deepEqual(forbiddenInlineStyleProperties(parse(flipped)), ["color"])
})

test("useMemo results and object-map lookups are resolved", () => {
  const memo = forbiddenInlineStyleProperties(parse(`
    export const Component = () => {
      const style = React.useMemo(() => ({ backgroundColor: "red", width: 4 }), [])
      return <div style={style} />
    }
  `))
  assert.deepEqual(memo, ["backgroundColor"])
  const lookup = forbiddenInlineStyleProperties(parse(`
    const sizeStyles = { sm: { "--slider-size": "1rem" }, lg: { filter: "blur(2px)" } }
    export const Component = ({ size }: { size: "sm" | "lg" }) => <div style={sizeStyles[size]} />
  `))
  assert.deepEqual(lookup, ["filter"])
})

test("dynamically keyed style properties are surfaced instead of silently dropped", () => {
  const ast = parse(`
    export const Component = ({ k }: { k: string }) => <div style={{ [k]: "red" }} />
  `)
  assert.equal(unresolvableInlineStyleKeys(ast), 1)
  assert.deepEqual(forbiddenInlineStyleProperties(ast), [])
})

test("inline custom properties carrying literal colors are detected", () => {
  const props = literalColorCustomProperties(parse(`
    export const Component = () => (
      <div style={{ "--diffs-dark-addition-color": "#2ea043", "--nessa-ok": "var(--nessa-diff-addition)", "--mix": "light-dark(color-mix(in lab, var(--a) 88%, var(--b)), var(--c))" }} />
    )
  `))
  assert.deepEqual(props, ["--diffs-dark-addition-color"])
})
