/**
 * The signal orb's code: how a pairing code becomes the dense and sparse
 * regions of an orb, and how a camera frame of the orb becomes the code
 * again. Framework-free, so the device that scans runs exactly the same
 * layout and decoder as the screen that draws.
 *
 * The orb is a disc of saturated colour on any background. Its edge (the
 * rim) is always dense, so a reader can find the disc and its size. Between
 * the centre and the rim, four rings of 22 sectors each are either dense (1)
 * or sparse (0). Two sectors per ring are sync sectors with a fixed value,
 * which confirm the orb's rotation; the other 80
 * carry the payload: 8 code symbols and 8 Reed–Solomon parity symbols of
 * 5 bits each, so up to 4 wrong symbols are corrected.
 */

/** The gateway's manual-code alphabet, one symbol per 5 bits. */
export const ORB_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
/** Symbols in a code. */
export const ORB_CODE_LENGTH = 8

const PARITY = 8
const SYMBOLS = ORB_CODE_LENGTH + PARITY
const BITS = 5

export const ORB_RINGS = 4
export const ORB_SECTORS = 22
/** Inner edge of the first ring and outer edge of the last, as fractions of the orb's radius. */
export const ORB_CORE_RADIUS = 0.22
export const ORB_RIM_RADIUS = 0.9
/** Sectors in every ring that carry a fixed value. */
const SYNC_SECTORS = [0, 11] as const
/** The fixed value of each ring's sync sectors, chosen so no rotation of one ring repeats another. */
const SYNC_VALUES: readonly (readonly [0 | 1, 0 | 1])[] = [
  [1, 0],
  [0, 1],
  [1, 0],
  [0, 1],
]

// ——— GF(32) and Reed–Solomon ———

const EXP = new Array<number>(62)
const LOG = new Array<number>(32).fill(0)
{
  let x = 1
  for (let i = 0; i < 31; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 32) x ^= 0b100101 // x^5 + x^2 + 1
  }
  for (let i = 31; i < 62; i++) EXP[i] = EXP[i - 31]!
}

function mul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!
}

function div(a: number, b: number): number {
  if (b === 0) throw new Error("division by zero in GF(32)")
  return a === 0 ? 0 : EXP[(LOG[a]! + 31 - LOG[b]!) % 31]!
}

function power(exponent: number): number {
  return EXP[((exponent % 31) + 31) % 31]!
}

/** Polynomials are arrays of coefficients, highest degree first. */
function polyMul(p: readonly number[], q: readonly number[]): number[] {
  const out = new Array<number>(p.length + q.length - 1).fill(0)
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) out[i + j]! ^= mul(p[i]!, q[j]!)
  }
  return out
}

function polyEval(p: readonly number[], x: number): number {
  let y = p[0]!
  for (let i = 1; i < p.length; i++) y = mul(y, x) ^ p[i]!
  return y
}

const GENERATOR = (() => {
  let g = [1]
  for (let i = 0; i < PARITY; i++) g = polyMul(g, [1, power(i)])
  return g
})()

/** The message followed by its parity symbols. */
function rsEncode(message: readonly number[]): number[] {
  const out = [...message, ...new Array<number>(PARITY).fill(0)]
  for (let i = 0; i < message.length; i++) {
    const coefficient = out[i]!
    if (coefficient === 0) continue
    for (let j = 1; j < GENERATOR.length; j++) out[i + j]! ^= mul(GENERATOR[j]!, coefficient)
  }
  return [...message, ...out.slice(message.length)]
}

/**
 * The corrected message and how many symbols were corrected, or null when
 * there are more than `limit` errors. A limit below the parity's capacity
 * keeps the rest for detection, so a garbage word is refused rather than
 * corrected into some other valid code.
 */
function rsCorrect(
  received: readonly number[],
  limit = PARITY / 2,
): { message: number[]; corrected: number } | null {
  const n = received.length
  const syndromes = Array.from({ length: PARITY }, (_, i) => polyEval(received, power(i)))
  if (syndromes.every((s) => s === 0)) return { message: received.slice(0, n - PARITY), corrected: 0 }

  // Berlekamp–Massey: the error locator, lowest degree first.
  let locator = [1]
  let previous = [1]
  let length = 0
  let shift = 1
  let last = 1
  for (let k = 0; k < PARITY; k++) {
    let delta = syndromes[k]!
    for (let i = 1; i <= length; i++) delta ^= mul(locator[i] ?? 0, syndromes[k - i]!)
    if (delta === 0) {
      shift++
      continue
    }
    const scale = div(delta, last)
    const next = [...locator]
    for (let i = 0; i < previous.length; i++) {
      const at = i + shift
      while (next.length <= at) next.push(0)
      next[at]! ^= mul(scale, previous[i]!)
    }
    if (2 * length <= k) {
      previous = locator
      length = k + 1 - length
      last = delta
      shift = 1
    } else {
      shift++
    }
    locator = next
  }
  while (locator.length > 1 && locator[locator.length - 1] === 0) locator.pop()
  const errors = locator.length - 1
  if (errors > limit) return null

  // Chien search: position p (from the end) is wrong when the locator vanishes at α^-p.
  const positions: number[] = []
  for (let p = 0; p < n; p++) {
    let value = 0
    for (let i = 0; i < locator.length; i++) value ^= mul(locator[i]!, power(-p * i))
    if (value === 0) positions.push(p)
  }
  if (positions.length !== errors) return null

  // Forney: the evaluator Ω = S·Λ mod x^PARITY, lowest degree first.
  const omega = new Array<number>(PARITY).fill(0)
  for (let i = 0; i < PARITY; i++) {
    for (let j = 0; j <= i && j < locator.length; j++) omega[i]! ^= mul(locator[j]!, syndromes[i - j]!)
  }
  const corrected = [...received]
  for (const p of positions) {
    let numerator = 0
    for (let i = 0; i < omega.length; i++) numerator ^= mul(omega[i]!, power(-p * i))
    let derivative = 0
    for (let i = 1; i < locator.length; i += 2) derivative ^= mul(locator[i]!, power(-p * (i - 1)))
    if (derivative === 0) return null
    // With first consecutive root α^0, the magnitude is X·Ω(X⁻¹)/Λ'(X⁻¹).
    const magnitude = mul(power(p), div(numerator, derivative))
    corrected[n - 1 - p]! ^= magnitude
  }
  const check = Array.from({ length: PARITY }, (_, i) => polyEval(corrected, power(i)))
  return check.every((s) => s === 0) ? { message: corrected.slice(0, n - PARITY), corrected: errors } : null
}

/** The corrected message, or null when there are more errors than the parity can fix. */
function rsDecode(received: readonly number[]): number[] | null {
  return rsCorrect(received)?.message ?? null
}

// ——— Code ↔ bits ———

/** The code's 8 symbols, from "ABCD-2345", "abcd2345" and the like; null when it is not a code. */
export function parseOrbCode(code: string): number[] | null {
  const bare = code.replace(/[\s-]/g, "").toUpperCase()
  if (bare.length !== ORB_CODE_LENGTH) return null
  const symbols = [...bare].map((character) => ORB_CODE_ALPHABET.indexOf(character))
  return symbols.every((symbol) => symbol >= 0) ? symbols : null
}

/** The code in its display form, two groups of four joined by a hyphen. */
export function formatOrbCode(symbols: readonly number[]): string {
  const text = symbols.map((symbol) => ORB_CODE_ALPHABET[symbol]).join("")
  return `${text.slice(0, 4)}-${text.slice(4)}`
}

/** A fixed mask over the payload, so every code — even all-A — mixes bright and dim. */
const WHITEN = Array.from({ length: SYMBOLS * BITS }, (_, i) => ((i * 2654435761) >>> 13) & 1)

/** Region index for ring and sector, ring-major. */
export function orbRegion(ring: number, sector: number): number {
  return ring * ORB_SECTORS + sector
}

/** Payload sectors in reading order: each ring's sectors, skipping its sync sectors. */
const PAYLOAD_REGIONS = (() => {
  const regions: number[] = []
  for (let ring = 0; ring < ORB_RINGS; ring++) {
    for (let sector = 0; sector < ORB_SECTORS; sector++) {
      if (!(SYNC_SECTORS as readonly number[]).includes(sector)) regions.push(orbRegion(ring, sector))
    }
  }
  return regions
})()

/**
 * The bright (1) and dim (0) value of every region for `code`, ring-major,
 * or null when `code` is not a code.
 */
export function encodeOrbCode(code: string): (0 | 1)[] | null {
  const symbols = parseOrbCode(code)
  if (!symbols) return null
  const word = rsEncode(symbols)
  const regions = new Array<0 | 1>(ORB_RINGS * ORB_SECTORS).fill(0)
  word.forEach((symbol, s) => {
    for (let b = 0; b < BITS; b++) {
      const at = s * BITS + b
      regions[PAYLOAD_REGIONS[at]!] = (((symbol >> (BITS - 1 - b)) & 1) ^ WHITEN[at]!) as 0 | 1
    }
  })
  SYNC_VALUES.forEach(([first, second], ring) => {
    regions[orbRegion(ring, SYNC_SECTORS[0])] = first
    regions[orbRegion(ring, SYNC_SECTORS[1])] = second
  })
  return regions
}

/** The code carried by these region values, or null when it cannot be recovered. */
export function decodeOrbRegions(regions: readonly (0 | 1)[]): string | null {
  return correctOrbRegions(regions)?.code ?? null
}

/** The code, and how many symbols had to be corrected, or null; `limit` caps the corrections. */
function correctOrbRegions(
  regions: readonly (0 | 1)[],
  limit = PARITY / 2,
): { code: string; corrected: number } | null {
  for (let ring = 0; ring < ORB_RINGS; ring++) {
    const [first, second] = SYNC_VALUES[ring]!
    if (regions[orbRegion(ring, SYNC_SECTORS[0])] !== first) return null
    if (regions[orbRegion(ring, SYNC_SECTORS[1])] !== second) return null
  }
  const word: number[] = []
  for (let s = 0; s < SYMBOLS; s++) {
    let symbol = 0
    for (let b = 0; b < BITS; b++) {
      const at = s * BITS + b
      symbol = (symbol << 1) | ((regions[PAYLOAD_REGIONS[at]!]! ^ WHITEN[at]!) & 1)
    }
    word.push(symbol)
  }
  const result = rsCorrect(word, limit)
  return result ? { code: formatOrbCode(result.message), corrected: result.corrected } : null
}

/**
 * Corrections the frame reader accepts. It tries hundreds of rotations and
 * scales per frame, and correcting up to four symbols on each would, now and
 * then, turn a garbage reading into some other valid code. Two leaves the
 * rest of the parity to refuse it.
 */
const READ_LIMIT = 2

// ——— Geometry ———

/** Inner and outer radius of `ring`, as fractions of the orb's radius. Rings have equal area. */
export function orbRingBounds(ring: number): [number, number] {
  const inner2 = ORB_CORE_RADIUS ** 2
  const outer2 = ORB_RIM_RADIUS ** 2
  const step = (outer2 - inner2) / ORB_RINGS
  return [Math.sqrt(inner2 + step * ring), Math.sqrt(inner2 + step * (ring + 1))]
}

/** Start and end angle of `sector`, in radians, clockwise from twelve o'clock. */
export function orbSectorBounds(sector: number): [number, number] {
  const span = (Math.PI * 2) / ORB_SECTORS
  return [sector * span, (sector + 1) * span]
}

// ——— Reading a frame ———

/** The parts of an `ImageData` the reader needs, so it runs off-DOM too. */
export interface OrbFrame {
  data: ArrayLike<number>
  width: number
  height: number
}

function brightness(frame: OrbFrame, x: number, y: number): number {
  const px = Math.min(frame.width - 1, Math.max(0, Math.round(x)))
  const py = Math.min(frame.height - 1, Math.max(0, Math.round(y)))
  const at = (py * frame.width + px) * 4
  return Math.max(frame.data[at]!, frame.data[at + 1]!, frame.data[at + 2]!)
}

/** Mean brightness of a small square patch, so sparse grains read as their region's level. */
function patch(frame: OrbFrame, x: number, y: number, half: number): number {
  let total = 0
  let count = 0
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      total += brightness(frame, x + dx, y + dy)
      count++
    }
  }
  return total / count
}

/**
 * The frame as colourfulness: how far each pixel's strongest colour channel
 * sits above its weakest. The orb is drawn in a saturated colour, while
 * white screens, dark screens and glare are all close to grey, so the orb
 * stands out on any background and glare washes it out rather than faking
 * it.
 */
function inkOf(frame: OrbFrame): OrbFrame {
  const { width, height, data } = frame
  const out = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const at = i * 4
    const r = data[at]!
    const g = data[at + 1]!
    const b = data[at + 2]!
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    out[at] = out[at + 1] = out[at + 2] = chroma
    out[at + 3] = 255
  }
  return { data: out, width, height }
}

/** Where the orb is in the frame: the bright core and rim bound it. */
function locate(frame: OrbFrame): { cx: number; cy: number; radius: number } | null {
  const { width, height } = frame
  const step = Math.max(1, Math.floor(Math.min(width, height) / 240))
  let peak = 0
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) peak = Math.max(peak, brightness(frame, x, y))
  if (peak < 40) return null
  const xs: number[] = []
  const ys: number[] = []
  const threshold = peak * 0.3
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (brightness(frame, x, y) >= threshold) {
        xs.push(x)
        ys.push(y)
      }
    }
  }
  if (xs.length < 50) return null
  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)
  const pick = (values: number[], q: number) => values[Math.min(values.length - 1, Math.floor(values.length * q))]!
  const left = pick(xs, 0.002)
  const right = pick(xs, 0.998)
  const top = pick(ys, 0.002)
  const bottom = pick(ys, 0.998)
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const rough = (right - left + bottom - top) / 4
  // The rim's outer edge is the orb's radius, measured where the mean
  // brightness around the centre falls to half the rim's own peak. Blur
  // spreads the rim equally inward and outward, so that half-way point
  // stays on the true edge, where a fixed brightness cut would not.
  const profile: number[] = []
  const limit = Math.ceil(rough * 1.4)
  for (let rho = 0; rho <= limit; rho++) {
    let total = 0
    for (let k = 0; k < 96; k++) {
      const angle = (k / 96) * Math.PI * 2
      total += brightness(frame, cx + Math.cos(angle) * rho, cy + Math.sin(angle) * rho)
    }
    profile.push(total / 96)
  }
  let peakAt = Math.floor(rough * 0.75)
  for (let rho = peakAt; rho <= Math.min(limit, Math.ceil(rough * 1.2)); rho++) {
    if (profile[rho]! > profile[peakAt]!) peakAt = rho
  }
  const half = profile[peakAt]! / 2
  let edge = peakAt
  while (edge < limit && profile[edge + 1]! >= half) edge++
  // Interpolate between the last pixel above half and the first below.
  const above = profile[edge]!
  const below = profile[edge + 1] ?? above
  const fraction = above === below ? 0 : (above - half) / (above - below)
  return { cx, cy, radius: (edge + fraction) / ORB_RIM_OUTER }
}

/** Outer edge of the always-bright rim, as a fraction of the orb's radius. */
export const ORB_RIM_OUTER = 1

/** Mean brightness of the middle of one region, away from its edges. */
function sampleRegion(
  frame: OrbFrame,
  orb: { cx: number; cy: number; radius: number },
  ring: number,
  sector: number,
  rotation: number,
): number {
  const [r0, r1] = orbRingBounds(ring)
  const [a0, a1] = orbSectorBounds(sector)
  const half = Math.max(1, Math.round(orb.radius / 90))
  let total = 0
  let count = 0
  for (let i = 1; i <= 4; i++) {
    const fraction = r0 + ((r1 - r0) * (i + 0.5)) / 6
    const r = fraction * orb.radius
    for (let j = 1; j <= 5; j++) {
      const a = a0 + ((a1 - a0) * (j + 0.5)) / 7 + rotation
      total += patch(frame, orb.cx + Math.sin(a) * r, orb.cy - Math.cos(a) * r, half)
      count++
    }
  }
  return total / count
}

/**
 * Otsu's split of a set of levels into dim and bright: the threshold that
 * best separates them, and how far apart the two classes' means are.
 */
function split(levels: readonly number[]): { threshold: number; contrast: number } {
  const sorted = [...levels].sort((a, b) => a - b)
  const total = sorted.reduce((sum, value) => sum + value, 0)
  let best = { score: -1, threshold: sorted[0]!, contrast: 0 }
  let below = 0
  for (let i = 1; i < sorted.length; i++) {
    below += sorted[i - 1]!
    const low = below / i
    const high = (total - below) / (sorted.length - i)
    const score = i * (sorted.length - i) * (high - low) ** 2
    if (score > best.score) best = { score, threshold: (sorted[i - 1]! + sorted[i]!) / 2, contrast: high - low }
  }
  return { threshold: best.threshold, contrast: best.contrast }
}

/** Bright or dim for every region, read at one rotation of a located orb. */
function readRegions(
  frame: OrbFrame,
  orb: { cx: number; cy: number; radius: number },
  rotation: number,
): (0 | 1)[] {
  const values = Array.from({ length: ORB_RINGS }, (_, ring) =>
    Array.from({ length: ORB_SECTORS }, (_, sector) => sampleRegion(frame, orb, ring, sector, rotation)),
  )
  // Each region is judged against its neighbourhood rather than one
  // global level, so glare or a vignette that lifts part of the orb lifts
  // the threshold with it. The payload is whitened, so a neighbourhood
  // nearly always holds both levels; where one shows no real contrast, the
  // whole orb's split is used instead.
  const whole = split(values.flat())
  const regions: (0 | 1)[] = []
  for (let ring = 0; ring < ORB_RINGS; ring++) {
    for (let sector = 0; sector < ORB_SECTORS; sector++) {
      const around: number[] = []
      // Only its own ring: an orb may grow denser or brighter from centre
      // to edge, and that must not move the threshold.
      const row = values[ring]!
      for (let ds = -5; ds <= 5; ds++) around.push(row[(sector + ds + ORB_SECTORS) % ORB_SECTORS]!)
      const local = split(around)
      const threshold = local.contrast >= whole.contrast * 0.45 ? local.threshold : whole.threshold
      regions.push(values[ring]![sector]! > threshold ? 1 : 0)
    }
  }
  return regions
}

/**
 * Reads the code from a camera frame or a rendered orb, or null when no orb
 * is found or its code cannot be recovered. The orb may sit anywhere in the
 * frame, at any rotation; perspective is not yet corrected, so hold the
 * camera square to the screen.
 */
export function readOrbFrame(frame: OrbFrame): string | null {
  const ink = inkOf(frame)
  const found = locate(ink)
  if (!found) return null
  const span = (Math.PI * 2) / ORB_SECTORS
  const steps = ORB_SECTORS * 8
  // Blur and exposure move where the rim's edge appears to be by a few
  // percent, so nearby scales are tried too, nearest first.
  let best: { code: string; corrected: number } | null = null
  for (const scale of [1, 1.03, 0.97, 1.06, 0.94]) {
    const orb = { ...found, radius: found.radius * scale }
    const read = readAt(ink, orb, span, steps)
    if (read && (!best || read.corrected < best.corrected)) best = read
    if (best?.corrected === 0) break
  }
  return best?.code ?? null
}

/** The code read at one scale of a located orb, searching every rotation. */
function readAt(
  frame: OrbFrame,
  orb: { cx: number; cy: number; radius: number },
  span: number,
  steps: number,
): { code: string; corrected: number } | null {
  let best: { code: string; corrected: number } | null = null
  for (let k = 0; k < steps; k++) {
    const rotation = (k / steps) * Math.PI * 2 - span / 2
    const regions = readRegions(frame, orb, rotation)
    // The sync sectors confirm the rotation, allowing a couple to be lost
    // to glare; Reed–Solomon is the final judge of the payload.
    let misses = 0
    for (let ring = 0; ring < ORB_RINGS; ring++) {
      SYNC_SECTORS.forEach((sector, which) => {
        const at = orbRegion(ring, sector)
        const expected = SYNC_VALUES[ring]![which]!
        if (regions[at] !== expected) misses++
        regions[at] = expected
      })
    }
    if (misses > 2) continue
    const read = correctOrbRegions(regions, READ_LIMIT)
    if (read && (!best || read.corrected < best.corrected)) best = read
    if (best?.corrected === 0) return best
  }
  return best
}

export const orbCodeInternals = { rsEncode, rsDecode, locate, readRegions, inkOf }
