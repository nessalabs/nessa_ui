import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Hexagon, Sparkle } from "lucide-react"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ModelLevelPicker,
  type ModelLevelPickerGroup,
  type ModelLevelPickerLevel,
  type ModelLevelPickerModel,
  type ModelLevelPickerModelRef,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const level = (value: string, label: string): ModelLevelPickerLevel => ({ value, label })
const five = [
  level("low", "Low"),
  level("medium", "Medium"),
  level("high", "High"),
  level("xhigh", "Extra high"),
  level("max", "Max"),
]
const withNone = [{ value: "none", label: "None", unlit: true }, ...five]
const rank = ["none", "low", "medium", "high", "xhigh", "max"]

// Generic glyphs stand in for provider marks: a story must not draw a real logo.
const groups: ModelLevelPickerGroup[] = [
  {
    id: "studio",
    label: "Studio",
    icon: <Sparkle />,
    accent: "#D97757",
    accentForeground: "#fff",
    models: [
      { id: "studio-large", label: "Studio Large 5", shortLabel: "Large 5", levels: five },
      { id: "studio-medium", label: "Studio Medium 5", shortLabel: "Medium 5", levels: five },
      { id: "studio-small", label: "Studio Small 4", shortLabel: "Small 4" },
    ],
  },
  {
    id: "forge",
    label: "Forge",
    icon: <Hexagon />,
    models: [
      { id: "forge-6", label: "Forge 6", levels: five },
      { id: "forge-5-mini", label: "Forge 5 Mini", levels: withNone },
    ],
  },
  {
    id: "open",
    label: "Open Models",
    models: [
      { id: "pebble", label: "Pebble" },
      { id: "harbor", label: "Harbor Free" },
    ],
  },
]

/** The level a model shows: the host's, or the nearest it offers below it. */
function nearest(model: ModelLevelPickerModel, value: string) {
  const levels = model.levels ?? []
  if (levels.length === 0) return undefined
  if (levels.some((each) => each.value === value)) return value
  let below = levels[0]?.value
  for (const each of levels) if (rank.indexOf(each.value) <= rank.indexOf(value)) below = each.value
  return below
}

function Example({ defaultOpen = false, swipeLevels = false }: { defaultOpen?: boolean; swipeLevels?: boolean }) {
  const [model, setModel] = React.useState<ModelLevelPickerModelRef>({
    providerId: "studio",
    modelId: "studio-large",
  })
  const [chosenLevel, setLevel] = React.useState("low")
  const [starred, setStarred] = React.useState<ModelLevelPickerModelRef[]>([
    { providerId: "studio", modelId: "studio-large" },
    { providerId: "forge", modelId: "forge-6" },
  ])
  const [fast, setFast] = React.useState(false)
  const fastModels = new Set(["studio-large", "forge-6", "forge-5-mini"])
  return (
    <div className="flex min-h-96 w-[min(48rem,calc(100vw-2rem))] items-end justify-end rounded-3xl border border-border bg-card p-6 text-card-foreground">
      <output data-testid="choice" className="mr-auto nessa-text-3 text-muted-foreground">
        {`${model.providerId}/${model.modelId} · ${chosenLevel} · fast ${fast && fastModels.has(model.modelId)}`}
      </output>
      <ModelLevelPicker
        groups={groups}
        value={model}
        levelFor={(each) => nearest(each, chosenLevel)}
        onValueChange={({ providerId, modelId, level }) => {
          setModel({ providerId, modelId })
          if (level) setLevel(level)
        }}
        starred={starred}
        onStarredChange={setStarred}
        fast={{ available: fastModels.has(model.modelId), pressed: fast, onPressedChange: setFast }}
        defaultOpen={defaultOpen}
        swipeLevels={swipeLevels}
      />
    </div>
  )
}

const meta = {
  title: "Conversation/ModelLevelPicker",
  component: ModelLevelPicker,
  tags: ["autodocs", "test"],
  args: { groups },
  parameters: {
    docs: {
      description: {
        component:
          "The model and its thinking level, chosen in one modal: providers down a rail, each model's levels as bars on its row, stars, and Fast beside search.",
      },
    },
  },
} satisfies Meta<typeof ModelLevelPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Pressing a name keeps the level; pressing a bar chooses the model at that level. The chosen model's mark is filled with its provider's colour.",
  ),
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole("button", { name: "Change model, currently Studio Large 5, Low" }))
    const dialog = await body.findByRole("dialog", { name: "Choose a model" })
    // Opens on the starred list, with focus in search.
    await expect(within(dialog).getAllByRole("option")).toHaveLength(2)
    await expect(canvasElement.ownerDocument.activeElement).toBe(within(dialog).getByLabelText("Search models"))

    // A bar picks the model at that level, and closes the picker.
    await userEvent.click(within(dialog).getByRole("button", { name: "Forge 6, High" }))
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument())
    await expect(canvas.getByTestId("choice")).toHaveTextContent("forge/forge-6 · high · fast false")

    // A name keeps the level; a model without levels shows no level on the chip.
    await userEvent.click(canvas.getByRole("button", { name: "Change model, currently Forge 6, High" }))
    const again = await body.findByRole("dialog", { name: "Choose a model" })
    await userEvent.click(within(again).getByRole("button", { name: "All models" }))
    await userEvent.click(within(again).getByText("Pebble"))
    await expect(canvas.getByTestId("choice")).toHaveTextContent("open/pebble · high")
    await expect(canvas.getByRole("button", { name: "Change model, currently Pebble" })).toBeVisible()

    // The lowest bar, pressed while it alone is lit, turns thinking off.
    const pick = async (bar: string) => {
      await userEvent.click(canvas.getByRole("button", { name: /^Change model, currently/ }))
      const open = await body.findByRole("dialog", { name: "Choose a model" })
      await userEvent.click(within(open).getByRole("button", { name: "All models" }))
      await userEvent.click(within(open).getByRole("button", { name: bar }))
      await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument())
    }
    await pick("Forge 5 Mini, Low")
    await expect(canvas.getByTestId("choice")).toHaveTextContent("forge/forge-5-mini · low")
    await pick("Forge 5 Mini, None")
    await expect(canvas.getByTestId("choice")).toHaveTextContent("forge/forge-5-mini · none")
  },
}

export const StarsSearchAndKeys: Story = {
  parameters: storyDocumentation(
    "Search across every provider, star with S, step a level with ← →, and Fast is disabled for a model that has none.",
  ),
  render: () => <Example defaultOpen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: "Choose a model" })
    const search = within(dialog).getByLabelText("Search models")
    await userEvent.type(search, "mini")
    await expect(within(dialog).getAllByRole("option")).toHaveLength(1)
    await userEvent.keyboard("{ArrowDown}")
    const row = within(dialog).getByRole("option", { name: /Forge 5 Mini/ })
    await expect(row).toHaveFocus()
    await userEvent.keyboard("s")
    await expect(within(row).getByRole("button", { name: "Unstar Forge 5 Mini" })).toHaveAttribute("aria-pressed", "true")
    // → steps the row's model a level up without closing.
    await userEvent.keyboard("{ArrowRight}")
    await expect(canvas.getByTestId("choice")).toHaveTextContent("forge/forge-5-mini · medium")
    await expect(body.getByRole("dialog")).toBeVisible()
    // Escape with a search clears it and keeps the picker open.
    await userEvent.keyboard("{Escape}")
    await expect(search).toHaveValue("")
    await expect(search).toHaveFocus()
    await expect(body.getByRole("dialog")).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "Starred" }))
    await expect(within(dialog).getAllByRole("option")).toHaveLength(3)
    // The list is one Tab stop, however many models it shows.
    await expect(within(dialog).getAllByRole("option").filter((option) => option.tabIndex === 0)).toHaveLength(1)
    // Unstarred from the keyboard on Starred, a model leaves and the keys go to the next one.
    within(dialog).getAllByRole("option")[0]!.focus()
    await userEvent.keyboard("s")
    await waitFor(() => expect(within(dialog).getAllByRole("option")).toHaveLength(2))
    await expect(within(dialog).getAllByRole("option")[0]).toHaveFocus()
    // Pebble has no Fast mode: the bolt is there and disabled.
    await userEvent.click(within(dialog).getByRole("button", { name: "Open Models" }))
    await userEvent.click(within(dialog).getByText("Pebble"))
    await userEvent.click(canvas.getByRole("button", { name: /Change model, currently Pebble/ }))
    const reopened = await body.findByRole("dialog", { name: "Choose a model" })
    await expect(within(reopened).getByRole("button", { name: "Fast mode" })).toBeDisabled()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument())
  },
}

const wheel = (target: Element, deltaX: number, deltaY: number) =>
  target.dispatchEvent(new WheelEvent("wheel", { deltaX, deltaY, bubbles: true, cancelable: true }))
const pause = () => new Promise((resolve) => setTimeout(resolve, 200))

export const SwipeLevels: Story = {
  parameters: storyDocumentation(
    "With `swipeLevels`, a sideways trackpad swipe over a model's row moves that model's level without closing; fingers moving right light more bars. Scrolling up and down still scrolls the list.",
  ),
  render: () => <Example defaultOpen swipeLevels />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: "Choose a model" })
    const list = within(dialog).getByRole("listbox", { name: "Models" })
    const forge = within(dialog).getByRole("option", { name: /Forge 6/ })
    // Up and down is left to the list's own scroll: no level changes.
    wheel(forge, 0, 30)
    await expect(canvas.getByTestId("choice")).toHaveTextContent("studio/studio-large · low")
    // Fingers moving right (a negative deltaX) over Forge 6 light one bar more on it.
    await pause()
    await expect(wheel(forge, -50, 2)).toBe(false)
    await waitFor(() => expect(canvas.getByTestId("choice")).toHaveTextContent("forge/forge-6 · medium"))
    await expect(body.getByRole("dialog")).toBeVisible()
    // A short swipe is not yet a step; the rest of the same gesture makes one, back down.
    await pause()
    wheel(forge, 20, 0)
    await expect(canvas.getByTestId("choice")).toHaveTextContent("forge/forge-6 · medium")
    wheel(forge, 30, 0)
    await waitFor(() => expect(canvas.getByTestId("choice")).toHaveTextContent("forge/forge-6 · low"))
    // A swipe that begins between rows changes nothing.
    await pause()
    wheel(list, -60, 0)
    await expect(canvas.getByTestId("choice")).toHaveTextContent("forge/forge-6 · low")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument())
  },
}
