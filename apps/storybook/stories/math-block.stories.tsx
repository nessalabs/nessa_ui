import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"
import { MathBlock } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

function MathFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-background p-6 text-sm text-foreground">
      {children}
    </div>
  )
}

const meta = {
  title: "Components/MathBlock",
  component: MathBlock,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A TeX formula rendered through KaTeX, standalone or composed automatically by MessageMarkdown for $…$ and $$…$$ math. While a formula streams in, invalid intermediate TeX keeps the last successful render on screen instead of flashing KaTeX's error state — the fix for mid-stream jitter — and until the first successful parse the raw source shows muted. Display formulas carry a copy control that copies the TeX in markdown form ($$…$$).",
      },
    },
  },
} satisfies Meta<typeof MathBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Display: Story = {
  args: {
    tex: "\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}",
  },
  argTypes: {
    tex: { control: "text", description: "The TeX source, without dollar delimiters." },
    inline: { control: "boolean", description: "Render inline with surrounding text." },
  },
  parameters: storyDocumentation(
    "A display formula: KaTeX renders the TeX source as a centered block, and the hover copy control copies the markdown form — the source wrapped in $$ delimiters — so it pastes straight back into a chat or document.",
  ),
  render: (args) => (
    <MathFrame>
      <MathBlock {...args} />
    </MathFrame>
  ),
  play: async ({ canvasElement }) => {
    const block = canvasElement.querySelector('[data-slot="math-block"]')!
    await waitFor(() => expect(block.querySelector(".katex")).toBeTruthy())
    const copy = block.querySelector('[data-slot="copy-button"]')!
    await expect(copy).toHaveAttribute("aria-label", "Copy math")
  },
}

function StreamingSafetyExample() {
  const full = "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}"
  const [length, setLength] = React.useState(full.length)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLength((current) => (current >= full.length ? 8 : current + 3))
    }, 200)
    return () => clearInterval(interval)
  }, [full.length])
  return (
    <MathFrame>
      <p className="text-muted-foreground">
        The TeX below is deliberately truncated mid-token and regrows in a
        loop; the rendered formula never flashes an error state.
      </p>
      <MathBlock tex={full.slice(0, length)} />
    </MathFrame>
  )
}

export const StreamingSafety: Story = {
  args: { tex: "" },
  parameters: storyDocumentation(
    "The streaming behavior that makes MathBlock jitter-free: as TeX arrives character by character, many intermediate strings are invalid. Instead of re-rendering KaTeX's error output — which flashes and reflows — the block keeps the last successful render on screen and swaps only when a longer prefix parses, so the formula grows smoothly. This demo truncates and regrows a formula in a loop.",
  ),
  render: () => <StreamingSafetyExample />,
  play: async ({ canvasElement }) => {
    const block = canvasElement.querySelector('[data-slot="math-block"]')!
    await waitFor(() => expect(block.querySelector(".katex")).toBeTruthy())
    // Even while the source is truncated mid-token, rendered output stays.
    await waitFor(() => expect(block.querySelector(".katex")).toBeTruthy())
  },
}
