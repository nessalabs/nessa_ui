import * as React from "react"
import { Button } from "@nessalabs/ui"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { VirtualList } from "@nessalabs/ui"
import { expect, waitFor, within, userEvent } from "storybook/test"
import { storyDocumentation } from "./story-documentation"

const items = Array.from({ length: 10000 }, (_, index) => `Row ${index + 1}`)
const meta = { title: "Layout/Virtual List", component: VirtualList, tags: ["autodocs", "test"], parameters: { docs: { description: { component: "Reusable fixed-row virtual list. Supply items, stable getKey, and a row renderer. Default viewport 400px, rows 40px, overscan 5. Offscreen rows unmount; keep durable state in the host. A focused row is retained until focus leaves it. Use virtualize=false for full DOM traversal. Variable-height content needs a measured virtualizer instead." } } } } satisfies Meta<typeof VirtualList>
export default meta
type Story = StoryObj
export const Playground: Story = {
  parameters: storyDocumentation("Ten thousand simple rows with a bounded mounted window and accessible list positions."),
  render: () => <VirtualList debug aria-label="Example rows" items={items} getKey={(item) => item}>{(item) => <div className="flex h-full items-center border-b border-border px-3 font-sans nessa-text-3">{item}</div>}</VirtualList>,
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list")
    await expect(list.querySelectorAll('[role="listitem"]').length).toBeLessThan(30)
    list.scrollTop = list.scrollHeight
    list.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(within(list).getByText("Row 10000")).toBeVisible())
    list.scrollTop = 0
    list.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(within(list).getByText("Row 1")).toBeVisible())
  },
}

/** Exercises external refs, row recycling, focus retention, and shrinking data. */
function ChangingRows() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [rows, setRows] = React.useState(items)
  return <div className="space-y-3">
    <Button onClick={() => { if (ref.current) { ref.current.scrollTop = ref.current.scrollHeight; ref.current.dispatchEvent(new Event("scroll")) } }}>Last row</Button>
    <Button onClick={() => setRows(items.slice(0, 3))}>Keep three rows</Button>
    <VirtualList debug ref={ref} aria-label="Changing rows" items={rows} getKey={(item) => item}>{(item) => <Button className="h-full" variant="ghost">{item}</Button>}</VirtualList>
  </div>
}
export const ChangingData: Story = {
  render: () => <ChangingRows />,
  parameters: storyDocumentation("Uses the public viewport ref to jump to the end, retains focused rows during recycling, and clamps scrolling when data shrinks."),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole("list")
    const first = within(list).getByRole("button", { name: "Row 1" })
    first.focus()
    list.scrollTop = 20000
    list.dispatchEvent(new Event("scroll"))
    await expect(first).toHaveFocus()
    await userEvent.click(canvas.getByRole("button", { name: "Last row" }))
    await expect(within(list).getByRole("button", { name: "Row 10000" })).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Keep three rows" }))
    await waitFor(() => expect(list.scrollTop).toBe(0))
    await expect(within(list).getAllByRole("listitem")).toHaveLength(3)
  },
}
export const RapidScroll: Story = {
  ...Playground,
  parameters: storyDocumentation("Large jumps in both directions assert that every viewport row is already mounted when each scroll event returns, preventing a deferred React render from exposing a blank window."),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list")
    for (const top of [200000, 12000, 350000, 0, 399600, 80000, 0]) {
      list.scrollTop = top
      list.dispatchEvent(new Event("scroll"))
      const start = Math.floor(list.scrollTop / 40)
      const end = Math.min(9999, Math.ceil((list.scrollTop + list.clientHeight) / 40) - 1)
      for (let index = start; index <= end; index++) {
        await expect(list.querySelector(`[data-row-index="${index}"]`)).not.toBeNull()
      }
    }
  },
}
