import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { ProportionBar, type ProportionBarSegment } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Charts/ProportionBar",
  component: ProportionBar,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Parts of a whole as one bar. Each segment is sized by its share, and keeps at least a few pixels however small, so no part with a value disappears. `weighting=\"log\"` sizes each segment by `ln(1 + value / smallest)` instead, where `smallest` is the smallest positive value in the bar: order and equal values are kept, units do not matter, and a part a thousand times larger than the smallest is drawn about ten times wider rather than a thousand — so a handful of cases beside ten thousand still reads as a segment. Log widths are no longer shares, which is why the exact values belong in the legend or the summary. Segments take the categorical chart ramp's strong step by input position, so a segment keeps its colour while values change and segments are appended; a host that removes or reorders segments pins colours with a tone. A `tone` names a ramp slot or one of two neutrals, and `color` takes any CSS colour. `max` measures the bar against a larger value, leaving the rest of the track empty. The optional legend lists each label with its value as the host formats it. The bar speaks a summary of the same values (`summary` replaces it), and is hidden from assistive technology while the legend says the same thing; the host names the whole with `aria-label`.",
      },
    },
  },
} satisfies Meta<typeof ProportionBar>

export default meta
type Story = StoryObj<typeof meta>

const bytes = (value: number) =>
  value >= 1e9 ? `${(value / 1e9).toFixed(1)} GB` : `${Math.round(value / 1e6)} MB`

/** A disk, by what is filling it. */
const STORAGE: ProportionBarSegment[] = [
  { id: "media", label: "Media", value: 182e9 },
  { id: "apps", label: "Applications", value: 64e9 },
  { id: "documents", label: "Documents", value: 38e9 },
  { id: "system", label: "System", value: 21e9, tone: "neutral" },
]

export const WithLegend: Story = {
  parameters: storyDocumentation(
    "A disk by what fills it, with a legend of labels and values formatted by the host. The first three segments take ramp slots in order; System is context rather than a category, so it takes the `neutral` tone. The play test proves the legend carries every formatted value, that the bar is hidden from assistive technology while the legend says the same thing, and that widths follow the shares.",
  ),
  args: {
    segments: STORAGE,
    legend: true,
    formatValue: bytes,
    "aria-label": "Disk usage by kind",
  },
  render: (args) => (
    <div className="w-96">
      <ProportionBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = await canvas.findByRole("group", { name: "Disk usage by kind" })
    const items = within(group).getAllByRole("listitem")
    await expect(items.map((item) => item.textContent)).toEqual([
      "Media182.0 GB",
      "Applications64.0 GB",
      "Documents38.0 GB",
      "System21.0 GB",
    ])
    const track = canvasElement.querySelector('[data-slot="proportion-bar-track"]')!
    await expect(track).toHaveAttribute("aria-hidden", "true")
    const widths = [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-slot="proportion-bar-segment"]'),
    ].map((segment) => segment.getBoundingClientRect().width)
    // Media is 182 / 64 of Applications; gaps take a couple of pixels each.
    await expect(widths[0]! / widths[1]!).toBeGreaterThan(2.6)
    await expect(widths[0]! / widths[1]!).toBeLessThan(3)
  },
}

/** A test suite against its previous run: nearly all unchanged. */
const SUITE: ProportionBarSegment[] = [
  { id: "passing", label: "Still passing", value: 11_806, tone: "neutral" },
  { id: "fixed", label: "Fixed", value: 3, tone: "series-6" },
  { id: "broke", label: "Broke", value: 1, tone: "series-5" },
  { id: "failing", label: "Still failing", value: 190, tone: "muted" },
]

const count = (value: number) => value.toLocaleString("en-US")

export const TinySegment: Story = {
  parameters: storyDocumentation(
    "One bar with a tiny part beside a huge one, drawn both ways. Linearly, one broken case out of twelve thousand is a hairline held open only by the minimum width; log-weighted, it is a segment you can see, still the narrowest and still narrower than the three fixed. The legend states the exact counts either way, and the bar speaks them. The play test measures the tiny segment in both bars, proves the log bar gives it real width while keeping the order, and reads the spoken summary.",
  ),
  args: { segments: SUITE, formatValue: count },
  render: (args) => (
    <div className="flex w-96 flex-col gap-6 font-sans">
      <div className="flex flex-col gap-2">
        <span className="nessa-text-2 text-muted-foreground">Linear</span>
        <ProportionBar {...args} data-testid="linear" aria-label="Test cases, linear" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="nessa-text-2 text-muted-foreground">Log-weighted</span>
        <ProportionBar
          {...args}
          weighting="log"
          legend
          data-testid="log"
          aria-label="Test cases, log-weighted"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const widthOf = (bar: string, id: string) =>
      canvasElement
        .querySelector<HTMLElement>(
          `[data-testid="${bar}"] [data-slot="proportion-bar-segment"][data-segment-id="${id}"]`,
        )!
        .getBoundingClientRect().width

    // Linear: a thirteen-thousandth of the bar is held at the minimum width.
    const linearBroke = widthOf("linear", "broke")
    await expect(linearBroke).toBeGreaterThanOrEqual(3.5)
    await expect(linearBroke).toBeLessThan(6)

    // Log: the same part gets real width, and the order survives.
    const logBroke = widthOf("log", "broke")
    const logFixed = widthOf("log", "fixed")
    const logPassing = widthOf("log", "passing")
    // ln 2 against ln 11,807 and the rest: about four percent of the bar.
    await expect(logBroke).toBeGreaterThan(10)
    await expect(logBroke).toBeGreaterThan(linearBroke * 2.5)
    await expect(logBroke).toBeLessThan(logFixed)
    await expect(logFixed).toBeLessThan(logPassing)

    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("img", {
        name: "Still passing 11,806, Fixed 3, Broke 1, Still failing 190",
      }),
    ).toBeVisible()
  },
}

/** Lines changed per folder: added and removed, against the busiest folder. */
const FOLDERS = [
  { path: "src/desktop", added: 412, removed: 96 },
  { path: "src/runtime", added: 120, removed: 134 },
  { path: "docs", added: 38, removed: 2 },
]
const BUSIEST = Math.max(...FOLDERS.map((folder) => folder.added + folder.removed))

export const AgainstMax: Story = {
  parameters: storyDocumentation(
    "`max` measures each bar against a larger value — here the busiest folder — so a column of bars compares across rows while each still splits into its own parts; the rest of the track stays empty. A `summary` replaces the default spoken list with the host's own sentence. The play test proves the filled length follows each row's total against the maximum.",
  ),
  args: { segments: [], formatValue: String },
  render: () => (
    <ul className="m-0 flex w-96 list-none flex-col gap-3 p-0 font-sans">
      {FOLDERS.map((folder) => (
        <li key={folder.path} className="flex items-center gap-3">
          <span className="w-28 truncate nessa-text-2">{folder.path}/</span>
          <ProportionBar
            className="flex-1"
            size="sm"
            max={BUSIEST}
            formatValue={String}
            data-testid={folder.path}
            aria-label={`Lines changed in ${folder.path}`}
            summary={`${folder.added} lines added, ${folder.removed} removed`}
            segments={[
              { id: "added", label: "Added", value: folder.added, tone: "series-6" },
              { id: "removed", label: "Removed", value: folder.removed, tone: "series-5" },
            ]}
          />
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    for (const folder of FOLDERS) {
      const bar = canvasElement.querySelector<HTMLElement>(
        `[data-testid="${folder.path}"]`,
      )!
      const track = bar.querySelector('[data-slot="proportion-bar-track"]')!
      const segments = bar.querySelectorAll('[data-slot="proportion-bar-segment"]')
      // What is actually painted: the last segment's right edge, not the
      // fill's declared width.
      const trackBox = track.getBoundingClientRect()
      const painted =
        segments[segments.length - 1]!.getBoundingClientRect().right - trackBox.left
      await expect(painted / trackBox.width).toBeCloseTo(
        (folder.added + folder.removed) / BUSIEST,
        2,
      )
      await expect(track).toHaveAttribute(
        "aria-label",
        `${folder.added} lines added, ${folder.removed} removed`,
      )
    }
  },
}
