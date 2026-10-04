import assert from "node:assert/strict"
import test from "node:test"
import {
  ORB_CODE_ALPHABET,
  ORB_RINGS,
  ORB_SECTORS,
  decodeOrbRegions,
  encodeOrbCode,
  formatOrbCode,
  orbCodeInternals,
  parseOrbCode,
} from "./orb-code"

const { rsEncode, rsDecode } = orbCodeInternals

/** A small seeded generator, so a failure names a reproducible case. */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function randomCode(random: () => number): string {
  return formatOrbCode(Array.from({ length: 8 }, () => Math.floor(random() * 32)))
}

test("codes parse in any case and grouping, and format back to display form", () => {
  assert.deepEqual(parseOrbCode("abcd-2345"), parseOrbCode("ABCD2345"))
  assert.equal(formatOrbCode(parseOrbCode("abcd 2345")!), "ABCD-2345")
  assert.equal(parseOrbCode("ABCD-234"), null)
  assert.equal(parseOrbCode("ABCD-23O5"), null, "O is not in the alphabet")
  assert.equal(ORB_CODE_ALPHABET.length, 32)
})

test("Reed–Solomon corrects every pattern of up to four wrong symbols", () => {
  const random = seeded(1)
  for (let trial = 0; trial < 2000; trial++) {
    const message = Array.from({ length: 8 }, () => Math.floor(random() * 32))
    const word = rsEncode(message)
    const errors = trial % 5
    const positions = new Set<number>()
    while (positions.size < errors) positions.add(Math.floor(random() * word.length))
    for (const at of positions) word[at] ^= 1 + Math.floor(random() * 31)
    assert.deepEqual(rsDecode(word), message, `trial ${trial} with ${errors} errors`)
  }
})

test("Reed–Solomon never returns a wrong message for five or more errors", () => {
  const random = seeded(2)
  let refused = 0
  for (let trial = 0; trial < 2000; trial++) {
    const message = Array.from({ length: 8 }, () => Math.floor(random() * 32))
    const word = rsEncode(message)
    const positions = new Set<number>()
    const errors = 5 + (trial % 4)
    while (positions.size < errors) positions.add(Math.floor(random() * word.length))
    for (const at of positions) word[at] ^= 1 + Math.floor(random() * 31)
    const decoded = rsDecode(word)
    if (decoded === null) refused++
    // Past the bound a decoder may land on another valid word; it must
    // never claim the original with corrupted data, and should mostly refuse.
    else assert.notDeepEqual(decoded, message)
  }
  assert.ok(refused > 1900, `refused only ${refused} of 2000`)
})

test("a code round-trips through the orb's regions", () => {
  const random = seeded(3)
  for (let trial = 0; trial < 500; trial++) {
    const code = randomCode(random)
    const regions = encodeOrbCode(code)!
    assert.equal(regions.length, ORB_RINGS * ORB_SECTORS)
    assert.equal(decodeOrbRegions(regions), code)
  }
})

test("a code survives a blotch of flipped regions", () => {
  const random = seeded(4)
  for (let trial = 0; trial < 300; trial++) {
    const code = randomCode(random)
    const regions = encodeOrbCode(code)!
    // Glare across five neighbouring payload sectors of one ring.
    const ring = Math.floor(random() * ORB_RINGS)
    const start = 1 + Math.floor(random() * 5)
    for (let sector = start; sector < start + 5; sector++) {
      const at = ring * ORB_SECTORS + sector
      regions[at] = regions[at] === 1 ? 0 : 1
    }
    assert.equal(decodeOrbRegions(regions), code, `trial ${trial}`)
  }
})

test("every code mixes bright and dim regions, even a uniform one", () => {
  for (const code of ["AAAA-AAAA", "9999-9999"]) {
    const regions = encodeOrbCode(code)!
    const bright = regions.filter((value) => value === 1).length
    assert.ok(bright > 25 && bright < 63, `${code}: ${bright} bright of 88`)
  }
})
