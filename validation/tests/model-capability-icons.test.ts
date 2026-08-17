import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

function componentScope(source: string, start: string, end: string) {
  return source.slice(source.indexOf(start), source.indexOf(end))
}

test("model capability icons use redistributable Lucide geometry and active state", async () => {
  const source = await readFile(
    "packages/react/src/components/model-capability-controls.tsx",
    "utf8",
  )
  const speed = componentScope(
    source,
    "function ModelFastModeIcon",
    "function ModelThinkingIcon",
  )
  const thinking = componentScope(
    source,
    "function ModelThinkingIcon",
    "export interface ModelFastModeProps",
  )
  const fastControl = componentScope(
    source,
    "function ModelFastMode(",
    "export interface ModelThinkingControlProps",
  )

  assert.match(speed, /<Zap/)
  assert.match(speed, /className=\{cn\("size-\[18px\]", className\)\}/)
  assert.match(speed, /fill=\{active \? "currentColor" : "none"\}/)
  assert.match(source, /const renderedIcon = typeof icon === "function" \? icon\(\{ pressed \}\) : icon/)
  assert.match(source, /\{renderedIcon \?\? <ModelFastModeIcon aria-hidden="true" active=\{pressed\} \/>\}/)
  assert.match(thinking, /<BrainCircuit/)
  assert.match(thinking, /className=\{cn\("size-4", className\)\}/)
  assert.match(source, /pressed && "text-\[var\(--nessa-fast-mode-active\)\]"/)
  assert.doesNotMatch(fastControl, /model-fast-mode-surface/)
  assert.doesNotMatch(fastControl, /color-mix/)
  assert.match(fastControl, /hover:bg-transparent/)
  assert.doesNotMatch(fastControl, /hover:text-/)
  assert.doesNotMatch(source, /React\.forwardRef/)
  assert.match(source, /ref\?: React\.Ref<HTMLButtonElement>/)
  assert.match(source, /if \(openProp === undefined\) setUncontrolledOpen\(false\)/)
})

test("new component APIs expose React 19 refs as ordinary props", async () => {
  const [composer, picker, listbox] = await Promise.all([
    readFile("packages/react/src/components/chat-composer.tsx", "utf8"),
    readFile("packages/react/src/components/model-picker.tsx", "utf8"),
    readFile("packages/react/src/components/searchable-listbox.tsx", "utf8"),
  ])

  assert.doesNotMatch(composer, /React\.forwardRef/)
  assert.match(composer, /React\.ComponentPropsWithRef<"textarea">/)
  assert.match(composer, /React\.ComponentPropsWithRef<"button">/)
  assert.match(picker, /ref\?: React\.Ref<HTMLButtonElement>/)
  assert.match(listbox, /ref\?: React\.Ref<HTMLDivElement>/)
  assert.match(composer, /focus-visible:outline-ring/)
  assert.match(listbox, /focus-visible:outline-ring/)
})

test("thinking slider isolates its stateful energy fill from slider behavior", async () => {
  const source = await readFile(
    "packages/react/src/components/model-capability-controls.tsx",
    "utf8",
  )
  const fill = componentScope(
    source,
    "function ModelThinkingSliderFill",
    "function ModelThinkingSlider(",
  )
  const slider = componentScope(
    source,
    "function ModelThinkingSlider(",
    "function ModelThinkingControl(",
  )

  assert.match(source, /interface ModelThinkingSliderFillProps \{\s+dir: "ltr" \| "rtl"\s+levelIndex: number\s+levelPosition: number\s+levelCount: number/)
  assert.match(fill, /previousIndexRef/)
  assert.match(fill, /surface\.dataset\.motionDirection = direction/)
  assert.doesNotMatch(fill, /surface\.animate\(/)
  assert.match(fill, /ultraStream\.animate\(/)
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.match(source, /query\.addEventListener\("change", callback\)/)
  assert.match(source, /query\.removeEventListener\("change", callback\)/)
  assert.match(
    fill,
    /\[dir, isUltra, levelCount, levelIndex, reducedMotion\]/,
  )
  assert.match(fill, /const checkpointEnergy = streamEnergyRef\.current/)
  assert.match(fill, /const checkpointOpacity = streamOpacityRef\.current/)
  assert.match(fill, /\[levelCount, reducedMotion\]/)
  assert.match(fill, /\[streamEnergy, streamSpeedMultiplier\]/)
  assert.equal(fill.match(/\.animate\(/g)?.length, 4)
  assert.match(fill, /for \(const animation of animations\) animation\.cancel\(\)/)
  assert.match(fill, /ultraStreamAnimationRef\.current = null\s+animation\.cancel\(\)/)
  assert.match(fill, /opacity: 0\.25, transform: "translateX\(0%\) scale\(1\)"/)
  assert.match(fill, /--nessa-thinking-fill-base/)
  assert.match(fill, /--nessa-thinking-fill-current/)
  assert.match(fill, /--nessa-thinking-fill-highlight/)
  assert.match(fill, /--nessa-motion-duration-slow/)
  assert.match(fill, /--nessa-motion-duration-ambient/)
  assert.match(fill, /--nessa-motion-easing-emphasized/)
  assert.doesNotMatch(fill, /\bwhite\b|\bblack\b/)
  assert.doesNotMatch(fill, /model-thinking-slider-wave/)
  assert.match(fill, /data-slot="model-thinking-slider-ultra-stream"/)
  assert.match(fill, /dir="ltr"[\s\S]*data-slot="model-thinking-slider-ultra-stream"/)
  assert.match(fill, /className="absolute inset-y-0 left-0 flex w-\[200%\] will-change-transform"/)
  assert.match(fill, /const streamEnergy = isUltra \? 1 : ordinalProgress \* 0\.72/)
  assert.match(fill, /0\.95 - streamEnergy \* 0\.68/)
  assert.match(fill, /surface\.dataset\.motionTension = checkpointEnergy\.toFixed\(2\)/)
  assert.equal(source.match(/radial-gradient\(ellipse/g)?.length ?? 0, 0)
  assert.match(source, /dir === "rtl" \? "270deg" : "90deg"/)
  assert.match(source, /function thinkingFillGradient/)
  assert.match(source, /const streamSheenTexture/)
  assert.match(
    source,
    /linear-gradient\(90deg, transparent 0%,[\s\S]*transparent 100%\)/,
  )
  assert.match(
    source,
    /linear-gradient\(90deg, (.+?) 0%,[\s\S]*\1 100%\)/,
  )
  assert.doesNotMatch(source, /repeating-linear-gradient/)
  assert.doesNotMatch(source, /model-thinking-slider-sweep|skewX/)
  assert.match(fill, /transform: "translateX\(0%\)"[\s\S]*transform: "translateX\(-50%\)"/)
  assert.equal(
    fill.match(/data-slot="model-thinking-slider-ultra-stream-period"/g)
      ?.length,
    2,
  )
  assert.match(fill, /className="h-full w-1\/2 shrink-0"/)
  assert.match(fill, /\.\.\.thinkingFillGradient\(dir\)/)
  assert.match(fill, /style=\{streamSheenTexture\}/)
  assert.match(fill, /easing: "linear"/)
  assert.match(fill, /iterations: Infinity/)
  assert.match(
    fill,
    /streamSpeedMultiplier \/ \(0\.95 - streamEnergy \* 0\.68\)/,
  )
  assert.match(source, /streamSpeedMultiplier\?: number/)
  assert.match(source, /const maxStreamSpeedMultiplier = 4/)
  assert.match(
    source,
    /Math\.min\(multiplier, maxStreamSpeedMultiplier\)/,
  )
  assert.match(
    source,
    /fastMode\?\.pressed[\s\S]*fastMode\.streamSpeedMultiplier \?\? 1\.6/,
  )
  assert.match(source, /icon=\{fastMode\.icon\}/)
  assert.doesNotMatch(fill, /model-thinking-slider-ultra-pulse-band/)
  assert.doesNotMatch(fill, /scaleX/)
  assert.match(source, /export type ModelThinkingSliderSize = "sm" \| "md"/)
  assert.match(source, /size = "sm"/)
  assert.match(source, /sliderSize = "sm"/)
  assert.match(source, /onCheckpoint\?: \(level: ModelThinkingLevel, index: number\) => void/)
  assert.match(slider, /onCheckpoint\?\.\(next, index\)/)
  assert.match(source, /data-slot="model-thinking-ultra-shader"/)
  assert.match(source, /data-active=\{selected\?\.accent === "ultra"\}/)
  assert.match(source, /size=\{sliderSize\}/)
  assert.match(slider, /data-size=\{size\}/)
  assert.match(slider, /--model-thinking-slider-size/)
  assert.match(slider, /data-\[dragging=true\]:scale-\[var\(--model-thinking-slider-drag-scale\)\]/)
  assert.match(slider, /cursor-grab/)
  assert.match(slider, /data-\[dragging=true\]:cursor-grabbing/)
  assert.match(slider, /data-\[disabled\]:cursor-default/)
  assert.match(slider, /window\.addEventListener\("blur", stopDragging/)
  assert.match(slider, /window\.removeEventListener\("blur", stopDraggingOnBlur\)/)
  assert.match(slider, /data-\[disabled\]:pointer-events-none/)
  assert.match(slider, /Math\.abs\(bounded - nearest\) <= 0\.14 \? nearest : bounded/)
  assert.match(slider, /const sliderPosition = singleLevel \? 1 : selectedIndex/)
  assert.match(slider, /const rootPosition =\s+dragPosition === null/)
  assert.match(slider, /Math\.max\(0, Math\.min\(semanticMax, dragPosition\)\)/)
  assert.match(slider, /const visualPosition = singleLevel \? 0 : rootPosition/)
  assert.match(slider, /max=\{Math\.max\(1, levels\.length - 1\)\}/)
  assert.match(slider, /step=\{0\.01\}/)
  assert.match(slider, /onPointerDown=\{beginDragging\}/)
  assert.match(slider, /if \(nearest !== previewIndexRef\.current\)/)
  assert.match(slider, /previewIndexRef\.current = nearest\s+selectIndex\(nearest\)/)
  assert.match(source, /dir\?: "ltr" \| "rtl"/)
  assert.match(source, /function ModelThinkingControl\(\{\s+ref,\s+levels,\s+icon,\s+dir,/)
  assert.match(source, /\{icon \?\? <ModelThinkingIcon aria-hidden="true" \/>\}/)
  assert.match(source, /<ModelThinkingSlider\s+dir=\{effectiveDir\}/)
  assert.match(source, /Direction\.useDirection\(dir\)/)
  assert.match(slider, /const rtl = effectiveDir === "rtl"/)
  assert.match(slider, /dir=\{effectiveDir\}/)
  assert.match(slider, /disabled=\{levels\.length <= 1\}/)
  assert.match(slider, /aria-valuemax=\{semanticMax\}/)
  assert.match(slider, /aria-valuetext=\{visualValueText\}/)
  assert.match(slider, /dragCatalogIdentityRef\.current !== catalogIdentity/)
  assert.match(slider, /event\.pointerId === activePointerIdRef\.current/)
  assert.doesNotMatch(slider, /key=\{catalogStructureIdentity\}/)
  assert.match(slider, /pointerTarget\.releasePointerCapture\(pointerId\)/)
  assert.match(slider, /event\.isPrimary === false/)
  assert.match(slider, /event\.preventDefault\(\)/)
  assert.match(slider, /data-active-pointer-id=/)
  assert.match(slider, /onLostPointerCapture=\{\(event\) => \{/)
  assert.match(slider, /window\.addEventListener\("pointerup", stopDragging/)
  assert.match(
    slider,
    /<ModelThinkingSliderFill\s+dir=\{effectiveDir\}\s+levelIndex=\{selectedIndex\}\s+levelPosition=\{visualPosition\}\s+levelCount=\{levels\.length\}\s+isUltra=\{visualLevel\?\.accent === "ultra"\}/,
  )
})
