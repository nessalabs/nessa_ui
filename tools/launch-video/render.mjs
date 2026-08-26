#!/usr/bin/env node
/**
 * Renders frames.html into an MP4 using the "hyperframes" technique:
 * the page's whole timeline is CSS animations on one clock, a `__seek(t)`
 * hook pauses and scrubs them, and each frame is screenshotted
 * deterministically before ffmpeg stitches the stills into a video.
 *
 * Usage:
 *   node render.mjs --out <dir> [--fps 30] [--width 1920] [--height 1080]
 *                   [--chromium <path>] [--ffmpeg <path>] [--fonts <dir>]
 *
 * Requires playwright-core resolvable from the working directory, a
 * Chromium binary, and an H.264-capable ffmpeg. The --fonts directory
 * should hold the Geist variable woff2 files (see README.md); without it
 * the render falls back to system fonts.
 */
import { chromium } from "playwright-core"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

const args = {}
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1]
}

const outDir = path.resolve(args.out ?? "launch-video-out")
const fps = Number(args.fps ?? 30)
const width = Number(args.width ?? 1920)
const height = Number(args.height ?? 1080)
const chromiumPath = args.chromium ?? process.env.CHROMIUM_PATH
const ffmpegPath = args.ffmpeg ?? process.env.FFMPEG_PATH ?? "ffmpeg"

const workDir = path.join(outDir, "work")
const framesDir = path.join(workDir, "frames")
fs.mkdirSync(framesDir, { recursive: true })

// Stage the page next to its fonts so relative @font-face URLs resolve.
fs.copyFileSync(path.join(here, "frames.html"), path.join(workDir, "frames.html"))
const fontsSrc = args.fonts ? path.resolve(args.fonts) : path.join(here, "fonts")
if (fs.existsSync(fontsSrc)) {
  fs.cpSync(fontsSrc, path.join(workDir, "fonts"), { recursive: true })
} else {
  console.warn(`fonts directory not found at ${fontsSrc}; using system fonts`)
}

const browser = await chromium.launch({
  executablePath: chromiumPath,
  args: ["--force-color-profile=srgb", "--hide-scrollbars"],
})
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
})
await page.goto("file://" + path.join(workDir, "frames.html"))
await page.evaluate(() => document.fonts.ready)

const duration = await page.evaluate(() => window.__DURATION__)
const total = Math.round(duration * fps)
console.log(`rendering ${total} frames at ${fps}fps (${duration}s, ${width}x${height})`)

for (let i = 0; i < total; i++) {
  const t = i / fps
  await page.evaluate((tt) => window.__seek(tt), t)
  await page.screenshot({
    path: path.join(framesDir, `frame_${String(i).padStart(5, "0")}.png`),
  })
  if (i % 60 === 0) console.log(`  frame ${i}/${total} (t=${t.toFixed(2)}s)`)
}
await browser.close()

const outFile = path.join(outDir, "nessa-ui-components-launch.mp4")
const enc = spawnSync(
  ffmpegPath,
  [
    "-y",
    "-framerate", String(fps),
    "-i", path.join(framesDir, "frame_%05d.png"),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-crf", "18",
    "-preset", "medium",
    "-movflags", "+faststart",
    outFile,
  ],
  { stdio: "inherit" },
)
if (enc.status !== 0) {
  console.error("ffmpeg encode failed")
  process.exit(enc.status ?? 1)
}
console.log(`wrote ${outFile}`)
