import type { Meta, StoryObj } from "@storybook/react-vite"

function Introduction() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 p-8 text-foreground">
      <header className="space-y-3">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Nessa Labs
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Nessa UI</h1>
        <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
          The shared interface language for Nessa products: calm, precise,
          accessible, and designed to be owned by the teams that use it.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Principles</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {[
            ["Accessible by default", "Keyboard, focus, contrast, and semantics are part of the component contract."],
            ["Tokens before exceptions", "Product surfaces use semantic variables instead of hard-coded theme colors."],
            ["Composable source", "Use the React package or copy source through the shadcn registry."],
            ["Document every state", "Components earn a public API after their variants and edge states exist here."],
          ].map(([title, description], index) => (
            <li className="rounded-lg border bg-card p-5 text-card-foreground" key={title}>
              <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Install</h2>
        <pre className="overflow-x-auto rounded-lg bg-foreground p-4 font-mono text-sm text-background">
          <code>pnpm add @nessalabs/ui</code>
        </pre>
      </section>
    </main>
  )
}

const meta = {
  title: "Nessa UI/Introduction",
  component: Introduction,
  tags: ["test"],
  parameters: {
    layout: "fullscreen",
    options: { showPanel: false },
  },
} satisfies Meta<typeof Introduction>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}

