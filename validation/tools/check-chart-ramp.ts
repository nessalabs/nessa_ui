/**
 * Checks the categorical chart ramp: adjacent separation under normal and
 * colour-deficient vision, and each slot's contrast against the surface it is
 * painted on.
 *
 * The ramp's guarantee is that neighbouring slots stay apart when hue
 * collapses, which is bought with lightness stepping rather than hue (see
 * docs/architecture/chart-series-ramp.md). This tool is what makes "re-run the
 * validator" in that document something a contributor can actually do:
 *
 *   pnpm check:chart-ramp
 *
 * It reads the values out of packages/react/src/theme.css, so it checks what
 * ships rather than a copy. Both themes are held to the same bar — the light
 * ramp's own adjacent separations, slot by slot — because that ramp is the one
 * that cleared the gates when the ordering was chosen. Reordering slots to pass
 * is never the fix; re-step the lightness.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

type Rgb = [number, number, number]
type Lab = [number, number, number]
type Slot = { name: string; L: number; C: number; h: number }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** oklch → linear sRGB, clamped into gamut. */
function oklchToLinearSrgb(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

// Viénot–Brettel–Mollon simulation, in the LMS space its matrices are defined for.
const RGB_TO_LMS = [
  [0.31399022, 0.63951294, 0.04649755],
  [0.15537241, 0.75789446, 0.08670142],
  [0.01775239, 0.10944209, 0.87256922],
]
const LMS_TO_RGB = [
  [5.47221206, -4.6419601, 0.16963708],
  [-1.1252419, 2.29317094, -0.1678952],
  [0.02980165, -0.19318073, 1.16364789],
]
const DEFICIENCY = {
  deutan: [[1, 0, 0], [0.49421, 0, 1.24827], [0, 0, 1]],
  protan: [[0, 1.05118294, -0.05116099], [0, 1, 0], [0, 0, 1]],
} as const
type Vision = keyof typeof DEFICIENCY | "normal"

const apply = (matrix: number[][], v: Rgb): Rgb =>
  matrix.map((row) => row[0]! * v[0] + row[1]! * v[1] + row[2]! * v[2]) as Rgb

function simulate(linear: Rgb, vision: Vision): Rgb {
  if (vision === "normal") return linear
  const lms = apply(RGB_TO_LMS, linear)
  return apply(LMS_TO_RGB, apply(DEFICIENCY[vision] as unknown as number[][], lms)).map(
    clamp01,
  ) as Rgb
}

const WHITE_POINT = [0.95047, 1, 1.08883]
const pivot = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29)

function linearToLab([r, g, b]: Rgb): Lab {
  const xyz = [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ]
  const [fx, fy, fz] = xyz.map((v, i) => pivot(v / WHITE_POINT[i]!))
  return [116 * fy! - 16, 500 * (fx! - fy!), 200 * (fy! - fz!)]
}

/** CIEDE2000, the metric the ramp's separation floors are stated in. */
function deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab) {
  const rad = Math.PI / 180
  const deg = 180 / Math.PI
  const c1 = Math.hypot(a1, b1)
  const c2 = Math.hypot(a2, b2)
  const cBar = (c1 + c2) / 2
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)))
  const a1p = (1 + g) * a1
  const a2p = (1 + g) * a2
  const c1p = Math.hypot(a1p, b1)
  const c2p = Math.hypot(a2p, b2)
  const h1p = (Math.atan2(b1, a1p) * deg + 360) % 360
  const h2p = (Math.atan2(b2, a2p) * deg + 360) % 360
  const dLp = L2 - L1
  const dCp = c2p - c1p
  let dhp = 0
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * rad) / 2)
  const lBar = (L1 + L2) / 2
  const cBarP = (c1p + c2p) / 2
  let hBar = h1p + h2p
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hBar += h1p + h2p < 360 ? 360 : -360
    hBar /= 2
  }
  const t =
    1 -
    0.17 * Math.cos((hBar - 30) * rad) +
    0.24 * Math.cos(2 * hBar * rad) +
    0.32 * Math.cos((3 * hBar + 6) * rad) -
    0.2 * Math.cos((4 * hBar - 63) * rad)
  const sL = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2)
  const sC = 1 + 0.045 * cBarP
  const sH = 1 + 0.015 * cBarP * t
  const rt =
    -Math.sin(2 * (30 * Math.exp(-(((hBar - 275) / 25) ** 2))) * rad) *
    (2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7)))
  return Math.sqrt(
    (dLp / sL) ** 2 + (dCp / sC) ** 2 + (dHp / sH) ** 2 + rt * (dCp / sC) * (dHp / sH),
  )
}

const relativeLuminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** Reads one theme block's ramp out of theme.css. */
function readRamp(css: string, block: "light" | "dark"): Slot[] {
  const blocks = css.split(".dark {")
  const source = block === "light" ? blocks[0]! : blocks[1] ?? ""
  return Array.from({ length: 8 }, (_, index) => {
    const name = `--nessa-chart-series-${index + 1}`
    const match = source.match(
      new RegExp(`${name}: oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\);`),
    )
    if (!match) throw new Error(`No ${name} in the ${block} block of theme.css`)
    return { name, L: Number(match[1]), C: Number(match[2]), h: Number(match[3]) }
  })
}

const labFor = (slot: Slot, vision: Vision) =>
  linearToLab(simulate(oklchToLinearSrgb(slot.L, slot.C, slot.h), vision))

const separations = (ramp: Slot[]) =>
  ramp.slice(0, -1).map((slot, index) => ({
    pair: `${index + 1}-${index + 2}`,
    normal: deltaE2000(labFor(slot, "normal"), labFor(ramp[index + 1]!, "normal")),
    deutan: deltaE2000(labFor(slot, "deutan"), labFor(ramp[index + 1]!, "deutan")),
    protan: deltaE2000(labFor(slot, "protan"), labFor(ramp[index + 1]!, "protan")),
  }))

/** The two grounds a chart is painted on: the page in each theme. */
const SURFACES = { light: [1, 1, 1] as Rgb, dark: oklchToLinearSrgb(0.145, 0, 0) }

const css = readFileSync(join(root, "packages/react/src/theme.css"), "utf8")
const light = readRamp(css, "light")
const dark = readRamp(css, "dark")
const baseline = separations(light)
let failed = false

for (const [theme, ramp, surface] of [
  ["light", light, SURFACES.light],
  ["dark", dark, SURFACES.dark],
] as const) {
  console.log(`\n${theme} ramp`)
  for (const [index, row] of separations(ramp).entries()) {
    const bar = baseline[index]!
    const short = (["normal", "deutan", "protan"] as const).filter(
      (vision) => row[vision] < bar[vision] - 0.05,
    )
    if (theme === "dark" && short.length > 0) failed = true
    console.log(
      `  ${row.pair}  normal ${row.normal.toFixed(1)}  deutan ${row.deutan.toFixed(1)}` +
        `  protan ${row.protan.toFixed(1)}` +
        (theme === "dark"
          ? `   [light ramp: ${bar.normal.toFixed(1)} / ${bar.deutan.toFixed(1)} / ${bar.protan.toFixed(1)}]` +
            (short.length > 0 ? `  ← below on ${short.join(", ")}` : "")
          : ""),
    )
  }
  const ratios = ramp.map((slot) =>
    contrast(oklchToLinearSrgb(slot.L, slot.C, slot.h), surface),
  )
  console.log(
    `  contrast on the ${theme} surface: ${ratios.map((r) => r.toFixed(2)).join(", ")}` +
      `\n  (below 3:1 is the relief rule — direct labels — not a failure)`,
  )
}

if (failed) {
  console.error(
    "\nThe dark ramp separates worse than the light ramp on at least one adjacent pair.",
  )
  process.exit(1)
}
console.log("\nEvery adjacent pair holds the light ramp's separation in both themes.")
