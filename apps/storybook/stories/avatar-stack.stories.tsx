import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { AvatarStack, Button, type AvatarStackItem } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const crew: readonly AvatarStackItem[] = [
  { seed: "agent-ada", name: "Ada" },
  { seed: "agent-grace", name: "Grace" },
  { seed: "agent-linus", name: "Linus" },
  { seed: "agent-margaret", name: "Margaret" },
  { seed: "agent-edsger", name: "Edsger" },
  { seed: "agent-barbara", name: "Barbara" },
]

const meta = {
  title: "Primitives/AvatarStack",
  component: AvatarStack,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A face pile: the first few members of a group as overlapping RandomAvatars, then a count of the rest. items is the group in the caller's order, max how many faces show (3 by default), label the group's accessible name, and formatMore the wording of the count. Each face is named by its item's name, as its accessible name and its hover text, and a busy item keeps its paint moving with a hairline ring around it. The stack is not interactive; wrap it in a Button when it opens something.",
      },
    },
  },
  args: { items: crew, label: "6 agents" },
} satisfies Meta<typeof AvatarStack>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: storyDocumentation(
    "Six agents, three shown. The play test proves the group is named by label, that exactly the first three faces render in the caller's order — each named, with its name as hover text — and that the other three collapse into +3.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("group", { name: "6 agents" })
    const faces = within(group).getAllByRole("img")
    await expect(faces.map((face) => face.getAttribute("aria-label"))).toEqual([
      "Ada",
      "Grace",
      "Linus",
    ])
    const wrappers = group.querySelectorAll('[data-slot="random-avatar"]')
    await expect(
      Array.from(wrappers, (wrapper) => wrapper.getAttribute("title")),
    ).toEqual(["Ada", "Grace", "Linus"])
    await expect(within(group).getByText("+3")).toBeVisible()
    // Faces overlap: each one starts before its predecessor ends.
    const [first, second] = Array.from(wrappers, (wrapper) =>
      wrapper.getBoundingClientRect(),
    )
    await expect(second.left).toBeLessThan(first.right)
  },
}

const many: readonly AvatarStackItem[] = Array.from(
  { length: 40 },
  (_, index) => ({ seed: `swarm-${index}`, name: `Agent ${index + 1}` }),
)

export const Many: Story = {
  parameters: storyDocumentation(
    "A large group, the overflow case: forty agents stay one compact row. The second stack shows five faces and writes its count through formatMore, the way a host supplies its own wording or locale. The play test asserts each stack renders only its max faces, that the counts read +37 and 35 more, and that neither stack wraps.",
  ),
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <AvatarStack items={many} label="40 agents" />
      <AvatarStack
        items={many}
        max={5}
        size="lg"
        label="40 agents, five shown"
        formatMore={(hidden) => `${hidden} more`}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const compact = canvas.getByRole("group", { name: "40 agents" })
    const large = canvas.getByRole("group", { name: "40 agents, five shown" })
    await expect(within(compact).getAllByRole("img")).toHaveLength(3)
    await expect(within(compact).getByText("+37")).toBeVisible()
    await expect(within(large).getAllByRole("img")).toHaveLength(5)
    await expect(within(large).getByText("35 more")).toBeVisible()
    for (const group of [compact, large]) {
      const tops = Array.from(
        group.querySelectorAll<HTMLElement>(
          '[data-slot="random-avatar"], [data-slot="avatar-stack-more"]',
        ),
        (node) => {
          const box = node.getBoundingClientRect()
          return box.top + box.height / 2
        },
      )
      // One row: every face and the count share a vertical centre.
      for (const centre of tops) {
        await expect(Math.abs(centre - tops[0])).toBeLessThan(1)
      }
    }
  },
}

export const Sizes: Story = {
  parameters: storyDocumentation(
    "The three sizes: sm (20px) for dense rows, md (24px) by default, lg (32px) for headers. The count scales its type with the faces. The play test measures each size's faces.",
  ),
  render: () => (
    <div className="flex flex-col items-start gap-4">
      {(["sm", "md", "lg"] as const).map((size) => (
        <AvatarStack key={size} items={crew} size={size} label={`${size} stack`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const expected = { sm: 20, md: 24, lg: 32 }
    for (const [size, pixels] of Object.entries(expected)) {
      const group = canvas.getByRole("group", { name: `${size} stack` })
      const face = group.querySelector<HTMLElement>('[data-slot="random-avatar"]')!
      await expect(face.getBoundingClientRect().width).toBe(pixels)
    }
  },
}

function WorkingDemo() {
  const [working, setWorking] = React.useState(true)
  const items = crew.map((item, index) => ({
    ...item,
    name: working && index < 2 ? `${item.name}, working` : item.name,
    busy: working && index < 2,
  }))
  return (
    <div className="flex flex-col items-center gap-3">
      <AvatarStack items={items} label="6 agents, 2 working" />
      <Button variant="outline" size="sm" onClick={() => setWorking((value) => !value)}>
        {working ? "Stop working" : "Start working"}
      </Button>
    </div>
  )
}

export const Working: Story = {
  // The ring has to carry the state when the paint holds still.
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "Busy items. A working face keeps its paint moving — held still under reduced motion — and a hairline ring settles just outside it, so the state never rests on motion alone; the face also carries aria-busy, and the host words its name (\"Ada, working\") so a screen reader hears it. The play test asserts the first two faces are busy and ringed while the third is not, then stops the work and asserts every face is at rest and unringed, leaving no animation running.",
  ),
  render: () => <WorkingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const faces = () =>
      Array.from(
        canvasElement.querySelectorAll<HTMLElement>('[data-slot="random-avatar"]'),
      )
    const ring = (face: HTMLElement) => getComputedStyle(face).outlineStyle
    const [ada, grace, linus] = faces()
    await expect(ada).toHaveAttribute("aria-busy", "true")
    await expect(grace).toHaveAttribute("aria-busy", "true")
    await expect(linus).not.toHaveAttribute("aria-busy")
    await expect(canvas.getByRole("img", { name: "Ada, working" })).toBeVisible()
    await expect(ring(ada)).toBe("solid")
    await expect(ring(linus)).toBe("none")

    await userEvent.click(canvas.getByRole("button", { name: "Stop working" }))
    await waitFor(async () => {
      for (const face of faces()) {
        await expect(face).not.toHaveAttribute("aria-busy")
      }
    })
    await expect(canvas.getByRole("img", { name: "Ada" })).toBeVisible()
    await expect(ring(ada)).toBe("none")
    // Stopping walks each wash home on a finite animation that RandomAvatar
    // starts a frame after the work ends. Wait for that frame to have run —
    // checking earlier would find nothing only because it had not started —
    // then land every animation, so nothing outlives the test.
    const view = canvasElement.ownerDocument.defaultView!
    await new Promise<void>((resolve) =>
      view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve())),
    )
    for (const animation of canvasElement.getAnimations({ subtree: true })) {
      animation.finish()
    }
    await expect(
      canvasElement
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running"),
    ).toHaveLength(0)
  },
}
