import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, within } from "storybook/test"
import {
  Button,
  ModelPicker,
  type ModelPickerGroup,
  type ModelPickerValue,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"
import { KimiModelIcon } from "./icons/model/kimi-model-icon"

function ModelAsset({ name, invert = false }: { name: string; invert?: boolean }) {
  return (
    <img
      src={`/model-icons/${name}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={invert ? "size-4 dark:invert" : "size-4"}
    />
  )
}

const modelGroups: ModelPickerGroup[] = [
  {
    id: "openai",
    label: "OpenAI",
    shortLabel: "GPT",
    icon: <ModelAsset name="openai" invert />,
    models: [
      {
        id: "gpt-5.6-sol",
        label: "GPT-5.6 Sol",
        description: "Planning and code review",
        icon: <ModelAsset name="openai" invert />,
      },
      {
        id: "gpt-5.6-terra",
        label: "GPT-5.6 Terra",
        description: "Fast implementation",
        icon: <ModelAsset name="openai" invert />,
      },
    ],
  },
  {
    id: "moonshot",
    label: "Moonshot AI",
    shortLabel: "Kimi",
    icon: <KimiModelIcon />,
    models: [
      {
        id: "kimi-k3",
        label: "Kimi K3",
        description: "Connected reasoning",
        icon: <KimiModelIcon />,
      },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    icon: <ModelAsset name="claude-color" />,
    models: [
      {
        id: "sonnet",
        label: "Sonnet",
        description: "Connected provider",
        icon: <ModelAsset name="claude-color" />,
      },
    ],
  },
]

function ModelPickerExample({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [value, setValue] = React.useState<ModelPickerValue>({
    providerId: "openai",
    modelId: "gpt-5.6-sol",
  })

  return (
    <div className="flex min-h-72 w-[min(48rem,calc(100vw-2rem))] items-end justify-end rounded-3xl border border-border bg-card p-6 text-card-foreground">
      <ModelPicker
        groups={modelGroups}
        value={value}
        onValueChange={setValue}
        defaultOpen={defaultOpen}
      />
    </div>
  )
}

function KimiPickerExample() {
  return (
    <div className="flex min-h-72 w-[min(48rem,calc(100vw-2rem))] items-end justify-end rounded-3xl border border-border bg-card p-6">
      <ModelPicker
        groups={modelGroups}
        defaultValue={{
          providerId: "moonshot",
          modelId: "kimi-k3",
        }}
        defaultOpen
      />
    </div>
  )
}

async function expectKimiTheme(
  canvasElement: HTMLElement,
  theme: "light" | "dark",
) {
  const lightIcons = Array.from(
    canvasElement.ownerDocument.querySelectorAll<HTMLImageElement>(
      '[data-kimi-theme="light"]',
    ),
  )
  const darkIcons = Array.from(
    canvasElement.ownerDocument.querySelectorAll<HTMLImageElement>(
      '[data-kimi-theme="dark"]',
    ),
  )

  await expect(lightIcons.length).toBeGreaterThan(0)
  await expect(darkIcons).toHaveLength(lightIcons.length)
  for (const icon of lightIcons) {
    if (theme === "light") await expect(icon).toBeVisible()
    else await expect(icon).not.toBeVisible()
  }
  for (const icon of darkIcons) {
    if (theme === "dark") await expect(icon).toBeVisible()
    else await expect(icon).not.toBeVisible()
  }
  const body = within(canvasElement.ownerDocument.body)
  const trigger = body.getByRole("button", {
    name: "Change model, currently Kimi K3",
  })
  await expect(trigger).toHaveTextContent("Kimi K3")
  await expect(trigger).not.toHaveTextContent(
    /\b(?:Fast|Slow|Medium|High|Max|Ultra)\b/,
  )
  await expect(body.queryByText(/^Mode$/i)).not.toBeInTheDocument()
  await expect(body.queryByText(/^(?:Fast|Slow)$/i)).not.toBeInTheDocument()
  await expect(
    canvasElement.ownerDocument.querySelector(
      '[data-slot="model-picker-content"] [data-model-capability-control]',
    ),
  ).not.toBeInTheDocument()
}

const meta = {
  title: "Components/ModelPicker",
  component: ModelPicker,
  tags: ["autodocs", "test"],
  args: {
    groups: modelGroups,
  },
  parameters: {
    docs: {
      description: {
        component:
          "A provider-aware, searchable chooser dedicated to model and provider selection.",
      },
    },
  },
} satisfies Meta<typeof ModelPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Use a controlled value when model selection must stay synchronized with application settings or an active agent.",
  ),
  render: () => <ModelPickerExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: /change model, currently gpt-5.6 sol/i }),
    )
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByPlaceholderText("Search models")).toBeVisible()
    await expect(body.getByRole("tablist", { name: "Model providers" })).toBeVisible()
    await expect(body.getAllByRole("tab")).toHaveLength(modelGroups.length)
    await userEvent.hover(body.getByRole("option", { name: /gpt-5.6 sol/i }))
    await expect(
      canvasElement.ownerDocument.querySelector(
        '[data-slot="model-picker-content"] [data-model-capability-control]',
      ),
    ).not.toBeInTheDocument()
    await expect(body.queryByText(/^Mode$/i)).not.toBeInTheDocument()
    await expect(body.queryByText(/^(?:Fast|Slow)$/i)).not.toBeInTheDocument()
    await userEvent.click(body.getByPlaceholderText("Search models"))
    await userEvent.type(body.getByPlaceholderText("Search models"), "terra")
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await expect(
      canvas.getByRole("button", { name: /change model, currently gpt-5.6 terra/i }),
    ).toBeVisible()
  },
}

export const Open: Story = {
  parameters: storyDocumentation(
    "The open state is dedicated to model discovery; capability controls never alter its layout.",
  ),
  render: () => <ModelPickerExample defaultOpen />,
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.hover(body.getByRole("option", { name: /gpt-5.6 sol/i }))
    await expect(
      canvasElement.ownerDocument.querySelector(
        '[data-slot="model-picker-content"] [data-model-capability-control]',
      ),
    ).not.toBeInTheDocument()
  },
}

export const KimiLightMode: Story = {
  parameters: storyDocumentation(
    "Kimi uses its dark K mark on light model-picker surfaces so the provider and model identity remain visible.",
  ),
  globals: { theme: "light" },
  render: () => <KimiPickerExample />,
  play: async ({ canvasElement }) => {
    await expectKimiTheme(canvasElement, "light")
  },
}

export const KimiDarkMode: Story = {
  parameters: storyDocumentation(
    "Kimi switches to its white K mark on dark model-picker surfaces while preserving the blue brand accent.",
  ),
  globals: { theme: "dark" },
  render: () => <KimiPickerExample />,
  play: async ({ canvasElement }) => {
    await expectKimiTheme(canvasElement, "dark")
  },
}

export const ProviderTabs: Story = {
  parameters: storyDocumentation(
    "The canonical picker shows one provider catalog at a time with the provider rail fixed to the bottom and explicit keyboard navigation.",
  ),
  render: () => {
    const [value, setValue] = React.useState<ModelPickerValue>({
      providerId: "openai",
      modelId: "gpt-5.6-sol",
    })
    return (
      <div className="flex min-h-72 w-[min(48rem,calc(100vw-2rem))] items-end justify-end rounded-3xl border border-border bg-card p-6 text-card-foreground">
        <ModelPicker
          groups={modelGroups}
          value={value}
          onValueChange={setValue}
          open
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByRole("tab", { name: "OpenAI" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    fireEvent.change(body.getByPlaceholderText("Search models"), {
      target: { value: "sonnet" },
    })
    const anthropicTab = body.getByRole("tab", { name: "Anthropic" })
    await expect(anthropicTab).toHaveAttribute("aria-selected", "true")
    await expect(body.queryByText("No models found")).not.toBeInTheDocument()
    await expect(anthropicTab).toHaveAttribute("aria-controls")
    await expect(
      body.getByRole("tabpanel", { name: "Anthropic" }),
    ).toHaveAttribute("id", anthropicTab.getAttribute("aria-controls"))
    await expect(body.getByRole("option", { name: /sonnet/i })).toBeVisible()
    await expect(body.queryByRole("option", { name: /gpt-5.6 sol/i })).not.toBeInTheDocument()
    await expect(body.getByRole("tab", { name: "OpenAI" })).toBeDisabled()
    anthropicTab.focus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(anthropicTab).toHaveFocus()
    await expect(anthropicTab).toHaveAttribute("tabindex", "0")
    const search = body.getByPlaceholderText("Search models")
    await userEvent.clear(search)
    await userEvent.type(search, "no-provider-matches-this")
    anthropicTab.focus()
    await userEvent.keyboard("{ArrowRight}")
    const openAiTab = body.getByRole("tab", { name: "OpenAI" })
    await expect(openAiTab).toHaveFocus()
    await expect(getComputedStyle(openAiTab).outlineStyle).not.toBe("none")
    await expect(openAiTab).toHaveAttribute("aria-selected", "true")
    await expect(openAiTab).toHaveAttribute("tabindex", "0")
    const content = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-picker-content"]',
    )!
    const trigger = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-picker-trigger"]',
    )!
    const options = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="searchable-listbox-list"]',
    )!
    const providerTabs = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-picker-provider-tabs"]',
    )!
    const contentRect = content.getBoundingClientRect()
    const triggerRect = trigger.getBoundingClientRect()
    const optionsRect = options.getBoundingClientRect()
    const providerTabsRect = providerTabs.getBoundingClientRect()
    await expect(triggerRect.top - contentRect.bottom).toBeCloseTo(0, 3)
    await expect(providerTabsRect.top - optionsRect.bottom).toBeCloseTo(0, 3)
  },
}

export const RtlProviderNavigation: Story = {
  parameters: storyDocumentation(
    "RTL direction mirrors horizontal provider-tab navigation while preserving the same logical provider order.",
  ),
  render: () => (
    <div className="flex min-h-72 w-[min(48rem,calc(100vw-2rem))] items-end justify-start rounded-3xl border border-border bg-card p-6 text-card-foreground">
      <ModelPicker
        dir="rtl"
        groups={modelGroups}
        defaultValue={{ providerId: "openai", modelId: "gpt-5.6-sol" }}
        defaultOpen
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const content = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-picker-content"]',
    )!
    const openai = body.getByRole("tab", { name: "OpenAI" })

    await expect(getComputedStyle(content).direction).toBe("rtl")
    openai.focus()
    await userEvent.keyboard("{ArrowLeft}")
    await expect(body.getByRole("tab", { name: "Moonshot AI" })).toHaveFocus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(openai).toHaveFocus()
  },
}

export const SingleProvider: Story = {
  parameters: storyDocumentation(
    "A one-provider catalog retains the same bottom rail and explicit tab-to-panel relationship as larger catalogs.",
  ),
  render: () => (
    <ModelPicker
      groups={[modelGroups[0]!]}
      defaultValue={{ providerId: "openai", modelId: "gpt-5.6-sol" }}
      defaultOpen
    />
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const tablist = body.getByRole("tablist", { name: "Model providers" })
    const tab = within(tablist).getByRole("tab", { name: "OpenAI" })
    const panel = body.getByRole("tabpanel", { name: "OpenAI" })
    await expect(tab).toHaveAttribute("aria-selected", "true")
    await expect(tab).toHaveAttribute("aria-controls", panel.id)
    await expect(panel).toHaveAttribute("aria-labelledby", tab.id)
  },
}

export const DisabledProviderFallback: Story = {
  parameters: storyDocumentation(
    "Catalog refreshes keep the provider rail's roving tab stop on an enabled provider when the previously active provider becomes unavailable.",
  ),
  render: () => {
    const [refreshed, setRefreshed] = React.useState(false)
    const groups = modelGroups.map((group) => ({
      ...group,
      disabled: refreshed
        ? group.id !== "anthropic"
        : group.id === "anthropic",
    }))
    return (
      <div className="flex min-h-72 flex-col items-end justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRefreshed(true)}
        >
          Refresh catalog
        </Button>
        <ModelPicker
          groups={groups}
          defaultValue={{ providerId: "openai", modelId: "gpt-5.6-sol" }}
          open
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByRole("tab", { name: "OpenAI" })).toHaveAttribute(
      "tabindex",
      "0",
    )
    await userEvent.click(canvas.getByRole("button", { name: "Refresh catalog" }))
    const anthropicTab = body.getByRole("tab", { name: "Anthropic" })
    await expect(anthropicTab).toHaveAttribute("aria-selected", "true")
    await expect(anthropicTab).toHaveAttribute("tabindex", "0")
    await expect(body.getByRole("tab", { name: "OpenAI" })).toBeDisabled()
    const search = body.getByPlaceholderText("Search models")
    await userEvent.type(search, "terra")
    await expect(anthropicTab).toHaveAttribute("aria-selected", "true")
    await expect(body.queryByRole("option", { name: /terra/i })).not.toBeInTheDocument()
    await userEvent.clear(search)
    search.focus()
    await userEvent.tab()
    await userEvent.tab()
    await expect(anthropicTab).toHaveFocus()
  },
}

export const StablePointerPreview: Story = {
  parameters: {
    ...storyDocumentation(
      "Pointer preview changes only row highlighting; model capabilities are rendered outside the picker so its hit-target geometry cannot shift.",
    ),
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  render: () => (
    <div className="flex min-h-72 w-[min(48rem,calc(100vw-2rem))] items-end justify-end rounded-3xl border border-border bg-card p-6 text-card-foreground">
      <ModelPicker
        groups={modelGroups}
        defaultValue={{
          providerId: "openai",
          modelId: "gpt-5.6-sol",
        }}
        defaultOpen
      />
    </div>
  ),
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const sol = body.getByRole("option", { name: /gpt-5.6 sol/i })
    const terra = body.getByRole("option", { name: /gpt-5.6 terra/i })
    const modelSurface = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-picker-models"]',
    )!
    const pickerContent = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-picker-content"]',
    )!
    const pickerTrigger = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-picker-trigger"]',
    )!
    const providerTabs = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-picker-provider-tabs"]',
    )!

    await userEvent.hover(sol)
    await expect(sol).toHaveAttribute("data-highlighted", "true")
    const modelRectBefore = modelSurface.getBoundingClientRect()
    const contentRectBefore = pickerContent.getBoundingClientRect()
    const triggerRectBefore = pickerTrigger.getBoundingClientRect()
    const providerTabsRectBefore = providerTabs.getBoundingClientRect()
    const solRectBefore = sol.getBoundingClientRect()
    const terraRectBefore = terra.getBoundingClientRect()

    await userEvent.hover(terra)
    await new Promise((resolve) => setTimeout(resolve, 250))
    await expect(terra).toHaveAttribute("data-highlighted", "true")
    await expect(sol).toHaveAttribute("data-highlighted", "false")
    const modelRectAfter = modelSurface.getBoundingClientRect()
    const contentRectAfter = pickerContent.getBoundingClientRect()
    const triggerRectAfter = pickerTrigger.getBoundingClientRect()
    const providerTabsRectAfter = providerTabs.getBoundingClientRect()
    const solRectAfter = sol.getBoundingClientRect()
    const terraRectAfter = terra.getBoundingClientRect()
    await expect(
      canvasElement.ownerDocument.querySelector(
        '[data-model-capability-control]',
      ),
    ).not.toBeInTheDocument()
    for (const [before, after] of [
      [modelRectBefore, modelRectAfter],
      [contentRectBefore, contentRectAfter],
      [triggerRectBefore, triggerRectAfter],
      [providerTabsRectBefore, providerTabsRectAfter],
      [solRectBefore, solRectAfter],
      [terraRectBefore, terraRectAfter],
    ] as const) {
      await expect(after.x).toBeCloseTo(before.x, 3)
      await expect(after.y).toBeCloseTo(before.y, 3)
      await expect(after.width).toBeCloseTo(before.width, 3)
      await expect(after.height).toBeCloseTo(before.height, 3)
    }
  },
}

export const ControlledProviderSync: Story = {
  parameters: storyDocumentation(
    "A controlled selection changed by the host reveals its provider while the picker is open without overriding deliberate provider browsing.",
  ),
  render: () => {
    const [value, setValue] = React.useState<ModelPickerValue>({
      providerId: "openai",
      modelId: "gpt-5.6-sol",
    })
    return (
      <div className="flex min-h-72 w-[min(48rem,calc(100vw-2rem))] flex-col items-end justify-end gap-3 rounded-3xl border border-border bg-card p-6 text-card-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setValue({ providerId: "anthropic", modelId: "sonnet" })
          }
        >
          Select Sonnet from host
        </Button>
        <ModelPicker
          groups={modelGroups}
          value={value}
          onValueChange={setValue}
          open
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole("button", { name: "Select Sonnet from host" }))
    await expect(body.getByRole("tab", { name: "Anthropic" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(body.getByRole("option", { name: /sonnet/i })).toBeVisible()
  },
}

export const ControlledOpenSync: Story = {
  parameters: storyDocumentation(
    "When selection changes while a controlled picker is closed, the next open synchronizes the visible provider to that selected model.",
  ),
  render: () => {
    const [open, setOpen] = React.useState(false)
    const [value, setValue] = React.useState<ModelPickerValue>({
      providerId: "openai",
      modelId: "gpt-5.6-sol",
    })
    return (
      <div className="flex min-h-72 w-[min(48rem,calc(100vw-2rem))] flex-col items-end justify-end gap-3 rounded-3xl border border-border bg-card p-6 text-card-foreground">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setValue({ providerId: "anthropic", modelId: "sonnet" })
            }
          >
            Select Sonnet while closed
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            Open picker
          </Button>
        </div>
        <ModelPicker
          groups={modelGroups}
          value={value}
          onValueChange={setValue}
          open={open}
          onOpenChange={setOpen}
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole("button", { name: "Select Sonnet while closed" }),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Open picker" }))
    await expect(body.getByRole("tab", { name: "Anthropic" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(body.getByRole("option", { name: /sonnet/i })).toBeVisible()
  },
}

export const ControlledAsyncCatalogSync: Story = {
  parameters: storyDocumentation(
    "A controlled value keeps its provider when an already-open picker receives its catalog asynchronously.",
  ),
  render: () => {
    const [groups, setGroups] = React.useState<ModelPickerGroup[]>([
      modelGroups[0]!,
    ])
    const [value, setValue] = React.useState<ModelPickerValue>({
      providerId: "moonshot",
      modelId: "kimi-k3",
    })
    return (
      <div className="flex min-h-72 flex-col items-end justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setGroups(modelGroups)}
        >
          Load controlled catalog
        </Button>
        <ModelPicker
          groups={groups}
          value={value}
          onValueChange={setValue}
          open
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole("button", { name: "Load controlled catalog" }),
    )
    await expect(body.getByRole("tab", { name: "Moonshot AI" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(body.getByRole("option", { name: /kimi k3/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  },
}

export const UncontrolledAsyncCatalogSync: Story = {
  parameters: storyDocumentation(
    "An uncontrolled default value keeps its provider when an already-open picker receives its catalog asynchronously.",
  ),
  render: () => {
    const [groups, setGroups] = React.useState<ModelPickerGroup[]>([
      modelGroups[0]!,
    ])
    return (
      <div className="flex min-h-72 flex-col items-end justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setGroups(modelGroups)}
        >
          Load uncontrolled catalog
        </Button>
        <ModelPicker
          groups={groups}
          defaultValue={{ providerId: "moonshot", modelId: "kimi-k3" }}
          open
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole("button", { name: "Load uncontrolled catalog" }),
    )
    await expect(body.getByRole("tab", { name: "Moonshot AI" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(body.getByRole("option", { name: /kimi k3/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  },
}

export const ControlledDisabledProviderSync: Story = {
  parameters: storyDocumentation(
    "A controlled selection returns from its catalog fallback when its disabled provider becomes eligible.",
  ),
  render: () => {
    const [groups, setGroups] = React.useState<ModelPickerGroup[]>(
      modelGroups.map((group) => ({
        ...group,
        disabled: group.id === "moonshot",
      })),
    )
    const value = { providerId: "moonshot", modelId: "kimi-k3" }
    return (
      <div className="flex min-h-72 flex-col items-end justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setGroups(modelGroups)}
        >
          Enable controlled provider
        </Button>
        <ModelPicker groups={groups} value={value} open />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole("button", { name: "Enable controlled provider" }),
    )
    await expect(body.getByRole("tab", { name: "Moonshot AI" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(body.getByRole("option", { name: /kimi k3/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  },
}

export const UncontrolledDisabledProviderSync: Story = {
  parameters: storyDocumentation(
    "An uncontrolled selection returns from its catalog fallback when its disabled provider becomes eligible.",
  ),
  render: () => {
    const [groups, setGroups] = React.useState<ModelPickerGroup[]>(
      modelGroups.map((group) => ({
        ...group,
        disabled: group.id === "moonshot",
      })),
    )
    return (
      <div className="flex min-h-72 flex-col items-end justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setGroups(modelGroups)}
        >
          Enable uncontrolled provider
        </Button>
        <ModelPicker
          groups={groups}
          defaultValue={{ providerId: "moonshot", modelId: "kimi-k3" }}
          open
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole("button", { name: "Enable uncontrolled provider" }),
    )
    await expect(body.getByRole("tab", { name: "Moonshot AI" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(body.getByRole("option", { name: /kimi k3/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  },
}

export const CollisionFreeIds: Story = {
  parameters: storyDocumentation(
    "Opaque provider and model IDs remain distinct in accessible relationships even when their punctuation would collide under lossy sanitization.",
  ),
  render: () => (
    <ModelPicker
      groups={[
        {
          id: "a",
          label: "Provider A",
          models: [{ id: "b-c", label: "First tuple model" }],
        },
        {
          id: "a-b",
          label: "Provider A-B",
          models: [{ id: "c", label: "Second tuple model" }],
        },
      ]}
      defaultValue={{ providerId: "a", modelId: "b-c" }}
      tabsLabel="Model vendors"
      defaultOpen
    />
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByRole("tablist", { name: "Model vendors" })).toBeVisible()
    const iconlessTab = body.getByRole("tab", { name: "Provider A-B" })
    await expect(iconlessTab).toHaveTextContent("Provider A-B")
    await expect(iconlessTab.getBoundingClientRect().width).toBeGreaterThanOrEqual(24)
    const firstOptionId = body.getByRole("option", {
      name: "First tuple model",
    }).id
    await userEvent.click(iconlessTab)
    const secondOptionId = body.getByRole("option", {
      name: "Second tuple model",
    }).id
    await expect(firstOptionId).not.toBe(secondOptionId)
  },
}

export const Loading: Story = {
  parameters: storyDocumentation(
    "Loading is explicit so applications can fetch a runtime catalog without inventing placeholder models.",
  ),
  render: () => (
    <ModelPicker groups={[]} loading defaultOpen placeholder="Loading catalog" />
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.queryByRole("tablist")).not.toBeInTheDocument()
    await expect(body.queryByRole("tabpanel")).not.toBeInTheDocument()
  },
}

export const Empty: Story = {
  parameters: storyDocumentation(
    "An empty catalog remains unselected and communicates that no models matched or were discovered.",
  ),
  render: () => (
    <ModelPicker
      groups={[]}
      defaultOpen
      placeholder="Choose model"
      emptyMessage="No models discovered"
    />
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.queryByRole("tablist")).not.toBeInTheDocument()
    await expect(body.queryByRole("tabpanel")).not.toBeInTheDocument()
  },
}
