import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Button } from "@nessalabs/ui"
import { ArrowRight, ChevronDown, Plus } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Button",
  component: Button,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "The primary action primitive for Nessa interfaces. Button is built on the shadcn/Radix composition model, supports semantic variants and sizes, and can render another element through `asChild`. Use one primary action per decision area and reserve `destructive` for irreversible outcomes.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "outline",
        "ghost",
        "link",
        "destructive",
        "tinted",
        "plain",
        "inverse",
        "danger",
      ],
      description: "Controls the action's semantic emphasis.",
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg", "icon", "icon-sm", "30", "28", "26", "24", "22"],
      description: "Controls the button's height and horizontal padding.",
    },
    shape: {
      control: "inline-radio",
      options: ["default", "pill"],
      description: "Keeps the theme's control radius, or rounds the ends fully.",
    },
    asChild: {
      description:
        "Merges Button behavior and styles onto its single child element.",
    },
  },
  args: {
    children: "Continue",
    variant: "default",
    size: "default",
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Use the controls to compare Button hierarchy and sizing with one stable action label.",
  ),
}

export const WithIcon: Story = {
  parameters: storyDocumentation(
    "Place a quiet 16px icon after the label when it reinforces the action.",
  ),
  render: () => (
    <Button>
      Continue
      <ArrowRight />
    </Button>
  ),
}

export const IconOnly: Story = {
  parameters: storyDocumentation(
    "Icon-only buttons require an accessible name through `aria-label`.",
  ),
  render: () => (
    <Button size="icon" aria-label="Create item">
      <Plus />
    </Button>
  ),
}

export const CompactIcon: Story = {
  parameters: storyDocumentation(
    "`size=\"icon-sm\"` is a 28px square for toolbars, titlebars and rows, beside the 36px `icon`. The play test measures both.",
  ),
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="icon" variant="ghost" aria-label="Create item">
        <Plus />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Create item, compact">
        <Plus />
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const regular = canvas.getByRole("button", { name: "Create item" }).getBoundingClientRect()
    const compact = canvas.getByRole("button", { name: "Create item, compact" }).getBoundingClientRect()
    await expect([regular.width, regular.height]).toEqual([36, 36])
    await expect([compact.width, compact.height]).toEqual([28, 28])
  },
}

export const AllVariants: Story = {
  parameters: storyDocumentation(
    "Semantic variants establish hierarchy without changing the component API.",
  ),
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

const compactSizes = ["30", "28", "26", "24", "22"] as const

export const Compact: Story = {
  parameters: storyDocumentation(
    "The compact family for toolbars, rows and headers: `tinted`, `plain`, `inverse` and `danger` at 22–30px with `shape=\"pill\"`. A selected chip says so with `aria-pressed`. The play test measures each height, proves `plain` has no fill at rest while `tinted` does, that a pressed chip holds the hover fill, and that keyboard focus draws a 1.5px solid outline rather than the 3px ring.",
  ),
  render: () => (
    <div className="flex flex-col gap-3">
      {compactSizes.map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          <Button shape="pill" size={size} variant="tinted" data-testid={`tinted-${size}`}>
            Open
          </Button>
          <Button shape="pill" size={size} variant="plain">
            Filter
            <ChevronDown />
          </Button>
          <Button shape="pill" size={size} variant="inverse">
            Approve
          </Button>
          <Button shape="pill" size={size} variant="danger">
            Revoke
          </Button>
          <Button shape="pill" size={size} variant="link">
            Details
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <Button shape="pill" size="22" variant="plain" aria-pressed="true">
          Running 3
        </Button>
        <Button shape="pill" size="22" variant="plain" aria-pressed="false">
          Waiting 1
        </Button>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const size of compactSizes) {
      const height = canvas.getByTestId(`tinted-${size}`).getBoundingClientRect().height
      await expect(height).toBe(Number(size))
    }
    const [plain] = canvas.getAllByRole("button", { name: "Filter" })
    const [tinted] = canvas.getAllByRole("button", { name: "Open" })
    await expect(getComputedStyle(plain!).backgroundColor).toBe("rgba(0, 0, 0, 0)")
    await expect(getComputedStyle(tinted!).backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    const pressed = canvas.getByRole("button", { name: "Running 3", pressed: true })
    const resting = canvas.getByRole("button", { name: "Waiting 1", pressed: false })
    await expect(getComputedStyle(pressed).backgroundColor).not.toBe(
      getComputedStyle(resting).backgroundColor,
    )
    pressed.blur()
    resting.focus()
    await userEvent.tab({ shift: true })
    await expect(pressed).toHaveFocus()
    // Read the settled style, not the first frame: the button transitions
    // its box-shadow, so a ring that grows from 0 would still read as 0 the
    // moment focus lands. Wait out the declared duration, then any animation
    // still running.
    const duration = Math.max(
      ...getComputedStyle(pressed).transitionDuration.split(",").map((value) => parseFloat(value) * 1000),
    )
    await new Promise((resolve) => setTimeout(resolve, duration + 50))
    await Promise.all(pressed.getAnimations().map((animation) => animation.finished))
    const focused = getComputedStyle(pressed)
    await expect(focused.outlineStyle).toBe("solid")
    // Chromium snaps outline widths down to whole device pixels, so the
    // 1.5px token draws 1px at 1x and 1.5px at 2x.
    const dpr = window.devicePixelRatio
    await expect(focused.outlineWidth).toBe(`${Math.max(1, Math.floor(1.5 * dpr)) / dpr}px`)
    // The 3px ring is gone, not just hidden: every length in the shadow is 0.
    const lengths = [...focused.boxShadow.matchAll(/(-?[\d.]+)px/g)].map((match) => Number(match[1]))
    await expect(lengths.every((length) => length === 0)).toBe(true)
  },
}

export const SurfaceHooks: Story = {
  parameters: storyDocumentation(
    "How a surface maps the compact variants to its own inks: custom properties on any ancestor — `--nessa-button-<variant>-ink`, `-rest`, `-hover` (also selected and open), `-press`, and `plain`'s `-hover-ink` — each defaulting to the kit's value. The play test proves the defaults are exactly the kit's (against reference elements drawn with the kit's own classes) and that each property set on a wrapper reaches the button, including the selected state.",
  ),
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button shape="pill" size="28" variant="tinted">Tinted</Button>
        <Button shape="pill" size="28" variant="plain">Plain</Button>
        <Button shape="pill" size="28" variant="plain" aria-pressed="true">Plain on</Button>
        <Button shape="pill" size="28" variant="inverse">Inverse</Button>
        <Button shape="pill" size="28" variant="danger">Danger</Button>
      </div>
      <div className="flex gap-1">
        <span data-ref="hover" className="size-2 bg-foreground/(--nessa-state-hover)" />
        <span data-ref="strong" className="size-2 bg-foreground/(--nessa-state-hover-strong)" />
        <span data-ref="fg" className="size-2 bg-foreground text-background" />
        <span data-ref="muted" className="text-muted-foreground">a</span>
        <span data-ref="destructive" className="text-destructive">a</span>
        <span data-ref="ink" className="text-foreground">a</span>
      </div>
      <div
        className="flex gap-2"
        style={
          {
            "--nessa-button-tinted-rest": "rgb(230, 230, 240)",
            "--nessa-button-tinted-ink": "rgb(20, 20, 30)",
            "--nessa-button-plain-ink": "rgb(70, 70, 80)",
            "--nessa-button-plain-hover": "rgb(225, 225, 235)",
            "--nessa-button-plain-hover-ink": "rgb(10, 10, 20)",
            "--nessa-button-inverse-rest": "rgb(30, 30, 40)",
            "--nessa-button-inverse-ink": "rgb(250, 250, 255)",
            "--nessa-button-danger-ink": "rgb(160, 20, 20)",
          } as React.CSSProperties
        }
      >
        <Button shape="pill" size="28" variant="tinted">Mapped tinted</Button>
        <Button shape="pill" size="28" variant="plain">Mapped plain</Button>
        <Button shape="pill" size="28" variant="plain" aria-pressed="true">Mapped plain on</Button>
        <Button shape="pill" size="28" variant="inverse">Mapped inverse</Button>
        <Button shape="pill" size="28" variant="danger">Mapped danger</Button>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ref = (name: string) => getComputedStyle(canvasElement.querySelector(`[data-ref=${name}]`)!)
    const style = (name: string) => getComputedStyle(canvas.getByRole("button", { name }))
    await expect(style("Tinted").backgroundColor).toBe(ref("hover").backgroundColor)
    await expect(style("Tinted").color).toBe(ref("ink").color)
    await expect(style("Plain").backgroundColor).toBe("rgba(0, 0, 0, 0)")
    await expect(style("Plain").color).toBe(ref("muted").color)
    await expect(style("Plain on").backgroundColor).toBe(ref("strong").backgroundColor)
    await expect(style("Plain on").color).toBe(ref("ink").color)
    await expect(style("Inverse").backgroundColor).toBe(ref("fg").backgroundColor)
    await expect(style("Inverse").color).toBe(ref("fg").color)
    await expect(style("Danger").color).toBe(ref("destructive").color)

    await expect(style("Mapped tinted").backgroundColor).toBe("rgb(230, 230, 240)")
    await expect(style("Mapped tinted").color).toBe("rgb(20, 20, 30)")
    await expect(style("Mapped plain").color).toBe("rgb(70, 70, 80)")
    await expect(style("Mapped plain on").backgroundColor).toBe("rgb(225, 225, 235)")
    await expect(style("Mapped plain on").color).toBe("rgb(10, 10, 20)")
    await expect(style("Mapped inverse").backgroundColor).toBe("rgb(30, 30, 40)")
    await expect(style("Mapped inverse").color).toBe("rgb(250, 250, 255)")
    await expect(style("Mapped danger").color).toBe("rgb(160, 20, 20)")
  },
}

export const Wrap: Story = {
  parameters: storyDocumentation(
    "`wrap` lets a long label break onto more lines: the size's height becomes a minimum. The play test proves a wrapping button in a narrow column grows past 26px and stays at least 26px, while the same label without `wrap` stays one 26px line.",
  ),
  render: () => (
    <div className="flex w-40 flex-col items-start gap-2">
      <Button shape="pill" size="26" variant="plain" wrap>
        Allow the agent to read every file in this project
      </Button>
      <Button shape="pill" size="26" variant="plain" wrap>
        Allow
      </Button>
      <Button shape="pill" size="26" variant="plain" className="max-w-40 overflow-hidden">
        Allow the agent to read every file in this project
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [long, short, single] = within(canvasElement).getAllByRole("button")
    await expect(long!.getBoundingClientRect().height).toBeGreaterThan(26)
    await expect(long!.getBoundingClientRect().width).toBeLessThanOrEqual(160)
    await expect(short!.getBoundingClientRect().height).toBe(26)
    await expect(single!.getBoundingClientRect().height).toBe(26)
  },
}

function FormComposition() {
  const [submits, setSubmits] = React.useState(0)
  const [picked, setPicked] = React.useState(0)
  const [deletes, setDeletes] = React.useState(0)
  return (
    <form
      className="flex flex-col items-start gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setSubmits((count) => count + 1)
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setPicked((count) => count + 1)}>Choose</Button>
        <Button asChild type="button">
          <button onClick={() => setPicked((count) => count + 1)}>Choose (slotted)</button>
        </Button>
        <Button asChild disabled>
          <button onClick={() => setDeletes((count) => count + 1)}>Delete</button>
        </Button>
        <Button type="submit" variant="secondary">Save</Button>
      </div>
      <p className="font-mono nessa-text-2 text-muted-foreground">
        <span data-testid="submits">submits: {submits}</span>{" · "}
        <span data-testid="picked">picked: {picked}</span>{" · "}
        <span data-testid="deletes">deletes: {deletes}</span>
      </p>
    </form>
  )
}

export const FormAndDisabledComposition: Story = {
  parameters: storyDocumentation(
    "Button defaults to `type=\"button\"`, so an action inside a form never submits it by accident, and an explicitly supplied `type` survives `asChild`. A disabled slotted child keeps its native disabled behavior rather than relying on a handler that Slot would run after the child's own.",
  ),
  render: () => <FormComposition />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const submits = canvas.getByTestId("submits")
    const picked = canvas.getByTestId("picked")
    const deletes = canvas.getByTestId("deletes")

    // A plain action in a form is not a submit control.
    await userEvent.click(canvas.getByRole("button", { name: "Choose" }))
    await expect(picked).toHaveTextContent("picked: 1")
    await expect(submits).toHaveTextContent("submits: 0")

    // Nor is a slotted one that was given `type="button"` explicitly: the
    // type has to survive the slot, or the child falls back to native submit.
    const slotted = canvas.getByRole("button", { name: "Choose (slotted)" })
    await expect(slotted).toHaveAttribute("type", "button")
    await userEvent.click(slotted)
    await expect(picked).toHaveTextContent("picked: 2")
    await expect(submits).toHaveTextContent("submits: 0")

    // A disabled slotted child must not run its own handler. Slot composes
    // the child's handler ahead of the slot's, so this can only be enforced
    // by the child actually being disabled.
    const remove = canvas.getByRole("button", { name: "Delete" })
    await expect(remove).toBeDisabled()
    await userEvent.click(remove, { pointerEventsCheck: 0 })
    remove.focus()
    await userEvent.keyboard("{Enter}")
    await expect(deletes).toHaveTextContent("deletes: 0")
    await expect(submits).toHaveTextContent("submits: 0")

    // The one control that does submit still does.
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
    await expect(submits).toHaveTextContent("submits: 1")
  },
}
