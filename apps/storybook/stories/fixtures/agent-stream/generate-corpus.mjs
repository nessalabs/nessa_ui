/**
 * Deterministic filler. A seeded PRNG over the system word list, so the corpus
 * is reproducible, contains no authored content, and does not compress into
 * nothing the way repeated text would.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
const [dir, count, kb] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])]
const words = readFileSync("/usr/share/dict/words", "utf8").split("\n").filter((w) => w.length > 3 && w.length < 11)
let seed = 20260828
const next = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
mkdirSync(dir, { recursive: true })
for (let f = 1; f <= count; f += 1) {
  const lines = []
  while (lines.join("\n").length < kb * 1024) {
    const n = 8 + Math.floor(next() * 6)
    lines.push(Array.from({ length: n }, () => words[Math.floor(next() * words.length)]).join(" "))
  }
  const name = `part-${String(f).padStart(2, "0")}.txt`
  writeFileSync(`${dir}/${name}`, lines.join("\n") + "\n")
}
console.log(`wrote ${count} files of ~${kb}KB`)
