import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  cn,
  Input,
  randomAvatarTones,
  RandomAvatar,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/RandomAvatar",
  component: RandomAvatar,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A deterministic generative avatar, painted rather than drawn: two to five translucent pools of pigment dropped on tinted paper, their edges pulled apart by turbulence so they bleed and granulate like a wet wash, multiplying where they overlap. The seed decides the hue, the number of passes, where each pool lands, and how far its edge wanders, so the same identity always paints the same abstract — no image to upload, fetch, or cache. Colour is configured in independent halves: hues picks the part of the wheel, hueSpread how far one painting wanders across it, tone how dilute the paint is (pastel, soft, vivid, deep, or a custom lightness/chroma range). Size comes from the box (size-* through className) and name supplies the accessible label. Several seeds paint one group picture, ground=\"ink\" moves the paint onto a dark surface, animateOnMount blooms the pools on, busy floods them to show an agent working, and speed, flood, bleed, and grain tune the paint and its motion.",
      },
    },
  },
} satisfies Meta<typeof RandomAvatar>

export default meta
type Story = StoryObj<typeof meta>

const teammates = [
  "Chief",
  "Sales Outbound",
  "Inbox Manager",
  "Account Manager",
  "Talent Scout",
  "Expense Manager",
  "Offsite crew",
  "Research Desk",
]

export const Roster: Story = {
  parameters: storyDocumentation(
    "A conversation roster, the avatar's home habitat: one painting per teammate, at the size a list row uses. The play test asserts the row draws distinct figures and that the avatar sits where the label expects it.",
  ),
  args: { seed: "Chief" },
  render: () => (
    <ul className="flex w-64 flex-col gap-2">
      {teammates.map((teammate) => (
        <li key={teammate} className="flex items-center gap-3 rounded-lg p-2">
          <RandomAvatar seed={teammate} className="size-9" />
          <span className="text-sm font-medium">{teammate}</span>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = canvas.getByText("Chief").previousElementSibling
    await expect(first).toHaveAttribute("data-slot", "random-avatar")
    const rendered = canvasElement.querySelectorAll("[data-slot=random-avatar]")
    await expect(rendered).toHaveLength(teammates.length)
    const figures = new Set(
      [...rendered].map((node) => node.getAttribute("data-figure")),
    )
    await expect(figures.size).toBeGreaterThan(1)
  },
}

const gallerySeeds = Array.from({ length: 40 }, (_unused, index) => `agent-${index}`)

// Paper varies across the wall the way a sketchbook does: some sheets smooth,
// some rough. Unlabelled on purpose — it should read as texture, not as a
// specimen chart.
const galleryGrain = [0, 0.5, 1, 1.5, 2, 2.5]

function GalleryWall() {
  const [working, setWorking] = React.useState(false)
  return (
    <div className="flex flex-col items-center gap-8 p-8">
      <h2 className="text-2xl font-semibold tracking-tight">Agent Avatars</h2>
      <div className="grid grid-cols-8 gap-6">
        {gallerySeeds.map((seed, index) => (
          <RandomAvatar
            key={seed}
            seed={seed}
            grain={galleryGrain[index % galleryGrain.length]}
            busy={working}
            className="size-14"
          />
        ))}
      </div>
      <Button variant="secondary" onClick={() => setWorking((live) => !live)}>
        {working ? "Stop all" : "Animate all"}
      </Button>
    </div>
  )
}

export const Gallery: Story = {
  parameters: storyDocumentation(
    "Forty seeds, forty paintings, on paper of varying tooth: the number of passes, where each pool lands, how far its edge wanders, and how the hues drift all come from the seed, so the family is open-ended rather than a menu of pictures. Animate all puts every painting into its working state at once, which is the quickest way to see how the flooding reads across hues, wash counts, and densities. The play test asserts the wall draws many distinct signatures and that the toggle reaches every avatar.",
  ),
  args: { seed: "gallery" },
  render: () => <GalleryWall />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const drawn = canvasElement.querySelectorAll("[data-slot=random-avatar]")
    await expect(drawn).toHaveLength(gallerySeeds.length)
    const figures = new Set(
      [...drawn].map((node) => node.getAttribute("data-figure")),
    )
    await expect(figures.size).toBeGreaterThan(12)
    await userEvent.click(canvas.getByRole("button", { name: "Animate all" }))
    await expect(
      canvasElement.querySelectorAll("[data-slot=random-avatar][aria-busy]"),
    ).toHaveLength(gallerySeeds.length)
  },
}

export const Spread: Story = {
  parameters: storyDocumentation(
    "The two knobs that shape what is on the paper. hueSpread controls how far a single wash wanders from the base hue — 0 mixes every pass from one pigment, 80 turns polychrome — and washes controls how many passes are laid down, from a single spill to five overlapping pools. The play test asserts a one-pass row and a five-pass row both render.",
  ),
  args: { seed: "spread" },
  render: () => (
    <div className="flex flex-col gap-5">
      {[0, 20, 45, 80].map((spread) => (
        <div key={spread} className="flex items-center gap-5">
          <span className="w-20 text-xs text-muted-foreground">
            spread {spread}
          </span>
          {teammates.slice(0, 6).map((teammate) => (
            <RandomAvatar
              key={teammate}
              seed={teammate}
              hueSpread={spread}
              className="size-14"
            />
          ))}
        </div>
      ))}
      {([[1, 1], [5, 5]] as const).map(([min, max]) => (
        <div
          key={min}
          data-testid={`washes-${min}`}
          className="flex items-center gap-5"
        >
          <span className="w-20 text-xs text-muted-foreground">
            {min} wash{min === 1 ? "" : "es"}
          </span>
          {teammates.slice(0, 6).map((teammate) => (
            <RandomAvatar
              key={teammate}
              seed={teammate}
              washes={[min, max]}
              className="size-14"
            />
          ))}
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const drawn = canvasElement.querySelectorAll("[data-slot=random-avatar]")
    await expect(drawn).toHaveLength(36)
    // Scoped to the pinned rows: the hueSpread rows above draw their own wash
    // count from the default band and can land on 1 or 5 by chance.
    for (const [count, testId] of [
      ["1w", "washes-1"],
      ["5w", "washes-5"],
    ] as const) {
      const row = canvasElement.querySelector(`[data-testid="${testId}"]`)
      await expect(
        row?.querySelectorAll(`[data-figure^="${count}"]`).length,
      ).toBe(6)
    }
  },
}

function DeterminismDemo() {
  const [seed, setSeed] = React.useState("saurav@nessa.dev")
  return (
    <div className="flex w-72 flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <RandomAvatar seed={seed} name={seed} className="size-16" />
        <RandomAvatar
          seed={seed}
          name={seed}
          className="size-16"
          data-testid="twin"
        />
      </div>
      <label className="sr-only" htmlFor="random-avatar-seed">
        Avatar seed
      </label>
      <Input
        id="random-avatar-seed"
        value={seed}
        onChange={(domEvent) => setSeed(domEvent.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Both spheres share one seed, so they always draw the same picture.
      </p>
    </div>
  )
}

export const Determinism: Story = {
  parameters: storyDocumentation(
    "Two avatars on one editable seed. The play test reads both painting signatures and asserts they match, then names the picture through the name prop so the pair exposes an image role with the seed as its accessible name.",
  ),
  args: { seed: "saurav@nessa.dev" },
  render: () => <DeterminismDemo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    // data-figure summarises only wash count and hue, so two different
    // paintings can share one. The real contract is the geometry: every pool
    // outline the seed produced, in order.
    const outlines = () =>
      [...canvasElement.querySelectorAll("[data-slot=random-avatar]")].map(
        (node) =>
          [...node.querySelectorAll("path")]
            .map((path) => path.getAttribute("d"))
            .join("|"),
      )
    const [first, second] = outlines()
    await expect(first).toBe(second)
    await expect(first?.length ?? 0).toBeGreaterThan(0)
    await expect(
      canvas.getAllByRole("img", { name: "saurav@nessa.dev" }),
    ).toHaveLength(2)
    await step("a different seed paints a different picture", async () => {
      const field = canvas.getByLabelText("Avatar seed")
      await userEvent.clear(field)
      await userEvent.type(field, "someone-else@nessa.dev")
      const [changedFirst, changedSecond] = outlines()
      await expect(changedFirst).toBe(changedSecond)
      await expect(changedFirst).not.toBe(first)
    })
  },
}

export const Tones: Story = {
  parameters: storyDocumentation(
    "The same eight seeds at every tone preset, plus a custom lightness/chroma range on the last row. Soft is the default because a roster of avatars should sit quietly beside its labels; heavier presets suit a sparse surface where the avatar is the subject. The play test asserts every row paints.",
  ),
  args: { seed: "tone" },
  render: () => (
    <div className="flex flex-col gap-5">
      {(["pastel", "soft", "vivid", "deep"] as const).map((tone) => (
        <div key={tone} className="flex items-center gap-5">
          <span className="w-32 text-xs text-muted-foreground">
            {tone} · L {randomAvatarTones[tone].lightness.join("–")}
          </span>
          {teammates.map((teammate) => (
            <RandomAvatar
              key={teammate}
              seed={teammate}
              tone={tone}
              className="size-10"
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-5">
        <span className="w-14 text-xs text-muted-foreground">custom</span>
        {teammates.map((teammate) => (
          <RandomAvatar
            key={teammate}
            seed={teammate}
            tone={{ lightness: [0.93, 0.96], chroma: [0.03, 0.05] }}
            className="size-10"
          />
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const drawn = canvasElement.querySelectorAll("[data-slot=random-avatar]")
    await expect(drawn).toHaveLength(teammates.length * 5)
  },
}

function WorkingDemo() {
  const [busy, setBusy] = React.useState(true)
  return (
    <div className="flex w-80 flex-col items-center gap-5">
      <div className="flex items-center gap-4">
        {["Sales Outbound", "Inbox Manager", "Talent Scout"].map((agent) => (
          <RandomAvatar
            key={agent}
            seed={agent}
            name={agent}
            busy={busy}
            className="size-16"
          />
        ))}
      </div>
      <Button variant="secondary" onClick={() => setBusy((live) => !live)}>
        {busy ? "Stop working" : "Start working"}
      </Button>
      <p className="text-xs text-muted-foreground">
        busy: <span data-testid="busy-state">{String(busy)}</span>
      </p>
    </div>
  )
}

export const Working: Story = {
  parameters: storyDocumentation(
    "The working state. While busy is true each wash swells past its own edge, peaks, and gives way to the next, so the paint keeps flooding the paper for as long as the agent is working — phases are spread across the cycle, so a wash is always at full strength and the painting never blinks empty. The avatar carries aria-busy, which marks it as mid-update so assistive technology can defer reporting it; announcing that an agent is working is the host's job, through a live region or a status beside the avatar. It settles to the still painting under prefers-reduced-motion. The play test toggles the state, asserts aria-busy follows, and checks that the washes walk home from where they had got to rather than snapping.",
  ),
  args: { seed: "working" },
  render: () => <WorkingDemo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    // The role and label live on the picture so `children` stay reachable;
    // the busy state belongs to the avatar as a whole, one level up.
    const picture = canvas.getByRole("img", { name: "Inbox Manager" })
    const agent = picture.closest("[data-slot=random-avatar]")!
    await expect(agent).toHaveAttribute("aria-busy", "true")
    const pool = agent.querySelector("svg g[filter] g > g")!
    await waitFor(() => expect(pool.getAnimations()).toHaveLength(1))

    await userEvent.click(canvas.getByRole("button", { name: "Stop working" }))
    await expect(canvas.getByTestId("busy-state")).toHaveTextContent("false")
    await expect(agent).not.toHaveAttribute("aria-busy")

    await step("the washes walk home rather than snapping", async () => {
      // Asserting the animation exists is not enough: a walk home built from
      // a transform read after the flood was cancelled animates rest to rest.
      // It plays, it counts, and it moves nothing — so the keyframe itself has
      // to be checked for somewhere to walk back from.
      await waitFor(() => {
        const [settling] = pool.getAnimations()
        const [first] = (
          settling?.effect as KeyframeEffect | undefined
        )?.getKeyframes() ?? []
        expect(first).toBeDefined()
        expect(
          first?.translate !== "none" || first?.scale !== "none",
        ).toBe(true)
      })
    })
  },
}

function PaintOnDemo() {
  const [take, setTake] = React.useState(0)
  return (
    <div className="flex w-80 flex-col items-center gap-5">
      <div className="flex items-center gap-4">
        {["Chief", "Account Manager", "Research Desk"].map((agent) => (
          <RandomAvatar
            key={`${agent}-${take}`}
            seed={agent}
            animateOnMount
            className="size-16"
          />
        ))}
      </div>
      <Button variant="secondary" onClick={() => setTake((count) => count + 1)}>
        Paint again
      </Button>
      <p className="text-xs text-muted-foreground">
        take <span data-testid="take-count">{take}</span>
      </p>
    </div>
  )
}

export const PaintOn: Story = {
  parameters: storyDocumentation(
    "animateOnMount blooms the pools on in sequence, each landing while the last is still spreading — the way a loaded brush is touched in beside a wet wash. It is off by default, since a list should not animate on every render; use it when an agent first appears. The play test repaints and asserts the avatars remount.",
  ),
  args: { seed: "paint-on" },
  render: () => <PaintOnDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The keys change on every take, so the old nodes must leave the document
    // — that detachment is the only observable proof the entrance replayed.
    const before = canvasElement.querySelector("[data-slot=random-avatar]")
    await userEvent.click(canvas.getByRole("button", { name: "Paint again" }))
    await expect(canvas.getByTestId("take-count")).toHaveTextContent("1")
    await expect(before?.isConnected).toBe(false)
    await expect(
      canvasElement.querySelectorAll("[data-slot=random-avatar]"),
    ).toHaveLength(3)
  },
}

/** Two pigments and the tone their overlap makes, on both grounds. */
function MixSwatch({
  from,
  to,
  ground,
}: {
  from: string
  to: string
  ground: "paper" | "ink"
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg bg-background p-3",
        ground === "ink" && "dark",
      )}
    >
      <div className="relative h-12 w-20">
        <div
          className="absolute left-0 top-0 size-12 rounded-full"
          style={{ background: from }}
        />
        <div
          className="absolute left-8 top-0 size-12 rounded-full"
          style={{
            background: to,
            mixBlendMode: ground === "ink" ? "screen" : "multiply",
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {ground === "ink" ? "screen — builds to light" : "multiply — builds to dark"}
      </span>
    </div>
  )
}

export const Tuning: Story = {
  parameters: storyDocumentation(
    "The tuning knobs a host can override. bleed sets how far pigment creeps at the edges — 0 gives clean shapes with no diffusion, higher values dissolve the pools into the paper. grain sets how much tooth the paper has, from a smooth print at 0 to rough stock. speed multiplies the working cycle, and flood sets how far a wash expands while working: 1 is a full takeover, 0.25 only breathes. flood is additionally scaled by wash count, so a sparse painting holds back where a dense one floods. Every row is the same six seeds, so the knob is the only thing changing. The play test asserts every row paints and that only the animated rows are busy.",
  ),
  args: { seed: "tuning" },
  render: () => (
    <div className="flex flex-col gap-5">
      {[0, 0.5, 1, 2].map((bleed) => (
        <div key={bleed} className="flex items-center gap-5">
          <span className="w-24 text-xs text-muted-foreground">
            bleed {bleed}
          </span>
          {teammates.slice(0, 6).map((teammate) => (
            <RandomAvatar
              key={teammate}
              seed={teammate}
              bleed={bleed}
              className="size-14"
            />
          ))}
        </div>
      ))}
      {[0, 1, 3].map((grain) => (
        <div key={grain} className="flex items-center gap-5">
          <span className="w-24 text-xs text-muted-foreground">
            grain {grain}
          </span>
          {teammates.slice(0, 6).map((teammate) => (
            <RandomAvatar
              key={teammate}
              seed={teammate}
              grain={grain}
              className="size-14"
            />
          ))}
        </div>
      ))}
      {[0.25, 0.6, 1].map((flood) => (
        <div key={flood} className="flex items-center gap-5">
          <span className="w-24 text-xs text-muted-foreground">
            flood {flood}
          </span>
          {teammates.slice(0, 6).map((teammate) => (
            <RandomAvatar
              key={teammate}
              seed={teammate}
              flood={flood}
              busy
              className="size-14"
            />
          ))}
        </div>
      ))}
      {[0.4, 1, 2.5].map((speed) => (
        <div key={speed} className="flex items-center gap-5">
          <span className="w-24 text-xs text-muted-foreground">
            speed {speed}
          </span>
          {teammates.slice(0, 6).map((teammate) => (
            <RandomAvatar
              key={teammate}
              seed={teammate}
              speed={speed}
              busy
              className="size-14"
            />
          ))}
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const drawn = canvasElement.querySelectorAll("[data-slot=random-avatar]")
    await expect(drawn).toHaveLength(78)
    await expect(
      canvasElement.querySelectorAll("[data-slot=random-avatar][aria-busy]"),
    ).toHaveLength(36)
  },
}

export const Mixing: Story = {
  parameters: storyDocumentation(
    "What the paint does where it overlaps. Pools are laid down with a blend mode rather than stacked opaquely, so a crossing is a real mix: on paper they multiply and the overlap deepens toward the darker pigment, on ink they screen and it builds toward the light. While busy, consecutive washes sweep on opposite headings, so the overlap region grows and shrinks and the mixed tone moves across the painting — the mixing is the animation, not a side effect of it. A wide hueSpread is what gives a painting two pigments to mix in the first place. The play test asserts the mixing row paints on both grounds.",
  ),
  args: { seed: "mixing" },
  render: () => (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-5">
        {["Chief", "Sales Outbound", "Inbox Manager", "Talent Scout"].map(
          (agent) => (
            <RandomAvatar
              key={agent}
              seed={agent}
              hueSpread={90}
              washes={[3, 4]}
              busy
              className="size-20"
            />
          ),
        )}
      </div>
      <div className="dark flex items-center gap-5 rounded-xl bg-background p-4">
        {["Chief", "Sales Outbound", "Inbox Manager", "Talent Scout"].map(
          (agent) => (
            <RandomAvatar
              key={agent}
              seed={agent}
              hueSpread={90}
              washes={[3, 4]}
              ground="ink"
              busy
              className="size-20"
            />
          ),
        )}
      </div>
      <div className="flex gap-4">
        <MixSwatch
          from="oklch(0.79 0.12 250)"
          to="oklch(0.79 0.12 55)"
          ground="paper"
        />
        <MixSwatch
          from="oklch(0.5 0.12 250)"
          to="oklch(0.5 0.12 55)"
          ground="ink"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const drawn = canvasElement.querySelectorAll("[data-slot=random-avatar]")
    await expect(drawn).toHaveLength(8)
    await expect(
      canvasElement.querySelectorAll('[data-slot=random-avatar][aria-busy]'),
    ).toHaveLength(8)
  },
}

export const OnInk: Story = {
  parameters: storyDocumentation(
    "The ink ground, for dark surfaces: the same pigment on a dark paper, screening together instead of multiplying so the passes build toward the light. Painted on a light ground a dark sidebar avatar reads as a bright coin; this keeps its structure. The play test asserts both grounds render the same seeds.",
  ),
  args: { seed: "ink" },
  render: () => (
    <div className="dark flex flex-col gap-5 rounded-xl bg-background p-6">
      <div className="flex gap-5">
        {teammates.slice(0, 6).map((teammate) => (
          <RandomAvatar
            key={teammate}
            seed={teammate}
            ground="ink"
            className="size-14"
          />
        ))}
      </div>
      <div className="flex gap-5">
        {teammates.slice(0, 6).map((teammate) => (
          <RandomAvatar
            key={teammate}
            seed={teammate}
            ground="ink"
            tone="vivid"
            className="size-14"
          />
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const drawn = canvasElement.querySelectorAll("[data-slot=random-avatar]")
    await expect(drawn).toHaveLength(12)
  },
}

export const Agents: Story = {
  parameters: storyDocumentation(
    "Several seeds paint one picture: each agent brings its own pigment to shared paper, which is the group counterpart of a facepile. Membership is the identity — the list is treated as a set, so reordering it paints the same picture, while adding or removing an agent repaints the group. The play test asserts the reported group sizes and that two same-size groups differing by one member paint different geometry.",
  ),
  args: { seed: "crew" },
  render: () => (
    <ul className="flex w-72 flex-col gap-2">
      {[
        {
          label: "Field team",
          seeds: ["Chief", "Sales Outbound", "Talent Scout"],
        },
        {
          label: "Night shift",
          seeds: ["Talent Scout", "Chief", "Expense Manager"],
        },
        { label: "Launch room", seeds: ["Inbox Manager", "Research Desk"] },
        { label: "Pipeline squad", seeds: ["Account Manager", "Expense Manager", "Chief", "Research Desk"] },
      ].map((room) => (
        <li key={room.label} className="flex items-center gap-3 rounded-lg p-2">
          <RandomAvatar seed={room.seeds} name={room.label} className="size-11" />
          <span className="text-sm font-medium">{room.label}</span>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const outline = (node: Element) =>
      [...node.querySelectorAll("path")]
        .map((path) => path.getAttribute("d"))
        .join("|")
    const avatar = (name: string) =>
      canvas.getByRole("img", { name }).closest("[data-slot=random-avatar]")!
    const field = avatar("Field team")
    const night = avatar("Night shift")
    const launch = avatar("Launch room")
    await expect(field.getAttribute("data-figure")).toMatch(/x3$/)
    await expect(launch.getAttribute("data-figure")).toMatch(/x2$/)
    // Same size, one member different: comparing the geometry rather than the
    // signature, since two groups of three always share the "x3" suffix.
    await expect(outline(field)).not.toBe(outline(night))
  },
}

export const TintedWheel: Story = {
  parameters: storyDocumentation(
    "One workspace, one narrowed hue wheel: hues restricts the palette while the seed still varies the pools; the second row pins a single hue so a whole surface reads as one colour. The play test asserts both rows render.",
  ),
  args: { seed: "workspace" },
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-5">
        {teammates.slice(0, 6).map((teammate) => (
          <RandomAvatar
            key={teammate}
            seed={teammate}
            hues={[152, 192]}
            className="size-12"
          />
        ))}
      </div>
      <div className="flex gap-5">
        {teammates.slice(0, 6).map((teammate) => (
          <RandomAvatar
            key={teammate}
            seed={teammate}
            hues={[292]}
            className="size-12"
          />
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const drawn = canvasElement.querySelectorAll("[data-slot=random-avatar]")
    await expect(drawn).toHaveLength(12)
    const figures = new Set(
      [...drawn].map((node) => node.getAttribute("data-figure")),
    )
    await expect(figures.size).toBeGreaterThan(1)
  },
}
