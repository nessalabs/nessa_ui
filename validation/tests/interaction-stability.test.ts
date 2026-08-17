import assert from "node:assert/strict"
import test from "node:test"

import { interactionStabilityIssues } from "../nessa/checks/interaction-stability.ts"

const stableComponent = `
  interface ModelPickerProps { sideOffset?: number; tabsLabel?: string }
  interface ModelPickerModel { id: string; label: string }
  function ModelPicker({ sideOffset = 0, tabsLabel = "Model providers" }) {
    return <Popover.Content data-slot="model-picker-content" sideOffset={sideOffset} className="w-[min(24rem,calc(100vw-1.5rem))]">
      <div data-slot="model-picker-models" className="min-w-0">
        <div role={activeProvider ? "tabpanel" : undefined} id={activeProvider ? providerPanelId : undefined} aria-labelledby={activeProvider ? providerTabId(activeProvider.id) : undefined}>
          <SearchableListbox items={visibleItems} renderItem={renderModelItem} />
        </div>
        <div data-slot="model-picker-provider-tabs" role="tablist" aria-label={tabsLabel}>
          <button role="tab" aria-selected={selected} aria-controls={providerPanelId} tabIndex={selected ? 0 : -1} />
        </div>
      </div>
    </Popover.Content>
  }
`
const stableSearchableListbox = `
  function SearchableListbox() {
    const [highlightedId, setHighlightedId] = useState()
    return <div data-slot="searchable-listbox-list">
      <button
        data-slot="searchable-listbox-option"
        data-highlighted={highlightedId === itemId ? "true" : "false"}
        onPointerMove={() => setHighlightedId(itemId)}
        onFocus={() => setHighlightedId(itemId)}
      />
    </div>
  }
`
const stableStory = `
  const modelGroups = [{
    id: "provider",
    label: "Provider",
    models: [{ id: "model", label: "Model" }],
  }]
  export const StablePointerPreview = {
    parameters: { viewport: { defaultViewport: "mobile1" } },
    render: () => <ModelPicker groups={modelGroups} />,
    play: async () => {
      const modelRectBefore = modelSurface.getBoundingClientRect()
      const contentRectBefore = pickerContent.getBoundingClientRect()
      const triggerRectBefore = pickerTrigger.getBoundingClientRect()
      const providerTabsRectBefore = providerTabs.getBoundingClientRect()
      const solRectBefore = sol.getBoundingClientRect()
      const terraRectBefore = terra.getBoundingClientRect()
      await userEvent.hover(terra)
      const modelRectAfter = modelSurface.getBoundingClientRect()
      const contentRectAfter = pickerContent.getBoundingClientRect()
      const triggerRectAfter = pickerTrigger.getBoundingClientRect()
      const providerTabsRectAfter = providerTabs.getBoundingClientRect()
      const solRectAfter = sol.getBoundingClientRect()
      const terraRectAfter = terra.getBoundingClientRect()
      expect(canvasElement.ownerDocument.querySelector('[data-model-capability-control]')).not.toBeInTheDocument()
      for (const [before, after] of [
        [modelRectBefore, modelRectAfter],
        [contentRectBefore, contentRectAfter],
        [triggerRectBefore, triggerRectAfter],
        [providerTabsRectBefore, providerTabsRectAfter],
        [solRectBefore, solRectAfter],
        [terraRectBefore, terraRectAfter],
      ]) await expect(after.x).toBeCloseTo(before.x, 3)
      await expect(sol).toHaveAttribute("data-highlighted", "false")
    },
  }
  export const SingleProvider = { play: () => {
    getByRole("tablist"); getByRole("tab"); getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-controls"); expect(panel).toHaveAttribute("aria-labelledby")
  }}
  export const DisabledProviderFallback = { play: () => {
    click("Refresh catalog"); expect(tab).toBeDisabled();
    expect(active).toHaveAttribute("tabindex", "0"); expect(active).toHaveFocus()
  }}
  export const Loading = { play: () => {
    queryByRole("tablist"); queryByRole("tabpanel")
  }}
  export const Empty = { play: () => {
    queryByRole("tablist"); queryByRole("tabpanel")
  }}
`

const providerTabsStory = `
  export const ProviderTabs = {
    play: async () => {
      const contentRect = content.getBoundingClientRect()
      const triggerRect = trigger.getBoundingClientRect()
      const optionsRect = options.getBoundingClientRect()
      const providerTabsRect = providerTabs.getBoundingClientRect()
      await expect(triggerRect.top - contentRect.bottom).toBeCloseTo(0, 3)
      await expect(providerTabsRect.top - optionsRect.bottom).toBeCloseTo(0, 3)
    },
  }
`

test("interaction stability accepts independent portalled preview geometry", () => {
  assert.deepEqual(
    interactionStabilityIssues(
      stableComponent,
      `${stableStory}${providerTabsStory}`,
      stableSearchableListbox,
    ),
    [],
  )
})

test("interaction stability rejects structural and evidence regressions", () => {
  const mutations = [
    `${stableComponent}<div data-slot="model-picker-efforts" />`,
    stableComponent.replace(
      "</Popover.Content>",
      "{previewValue ? <Popover.Portal><div data-model-capability-control=\"thinking\" /></Popover.Portal> : null}</Popover.Content>",
    ),
    stableComponent.replace(
      "return <Popover.Content",
      "const capabilityPanel = previewValue ? <div className=\"fixed\" data-model-capability-control=\"hidden-hover-capability\" /> : null\n    return <>{capabilityPanel}<Popover.Content",
    ).replace("</Popover.Content>\n  }", "</Popover.Content></>\n  }"),
    stableComponent.replace(
      "return <Popover.Content",
      "const { modelId: hoverModelId } = previewValue ?? {}\n    const hoverPanel = hoverModelId ? <div className=\"fixed\">Thinking</div> : null\n    return <>{hoverPanel}<Popover.Content",
    ).replace("</Popover.Content>\n  }", "</Popover.Content></>\n  }"),
    stableComponent.replace(
      "return <Popover.Content",
      "const renderModelItem = (item, { selected, highlighted }) => <>{highlighted ? <aside>Preview</aside> : null}</>\n    return <Popover.Content",
    ),
    stableComponent.replace("<SearchableListbox", "<LegacyListbox"),
    stableComponent.replace('className="min-w-0"', 'className="md:w-[min(29rem,calc(100vw-14rem))]"'),
    stableComponent.replace('className="min-w-0"', 'className="w-[30rem]"'),
    stableComponent.replace('className="min-w-0"', 'className="transition-all"'),
    stableComponent.replace('className="min-w-0"', 'className="transition-[transform]"'),
  ]
  for (const [index, mutated] of mutations.entries()) {
    assert.notDeepEqual(
      interactionStabilityIssues(
        mutated,
        `${stableStory}${providerTabsStory}`,
        stableSearchableListbox,
      ),
      [],
      `mutation ${index} must fail closed`,
    )
  }
  const adjacencyComponentMutations = [
    stableComponent.replace("sideOffset?: number", "offset?: number"),
    stableComponent.replace("sideOffset = 0", "sideOffset = 8"),
    stableComponent.replace("sideOffset={sideOffset}", "sideOffset={8}"),
    stableComponent.replace("SearchableListbox", "LegacyListbox"),
    stableComponent.replace(
      "model-picker-provider-tabs",
      "model-picker-provider-row",
    ),
    stableComponent.replace(
      "interface ModelPickerModel { id: string; label: string }",
      "interface ModelPickerModel { id: string; label: string; capabilities?: ModelCapabilities }",
    ),
    stableComponent.replace(
      "interface ModelPickerModel { id: string; label: string }",
      "interface ModelPickerModel { id: string; label: string; modes?: string[] }",
    ),
    stableComponent.replace(
      "interface ModelPickerModel { id: string; label: string }",
      "interface ModelPickerModel { id: string; label: string }\ninterface ModelPickerGroup { thinking?: string[] }",
    ),
    stableComponent.replace(
      "interface ModelPickerModel { id: string; label: string }",
      "type ModelPickerModel = { id: string; label: string; modes?: string[] }",
    ),
    stableComponent.replace(
      "interface ModelPickerModel { id: string; label: string }",
      "interface ModeCarrier { thinking?: string[] }\ninterface ModelPickerModel extends ModeCarrier { id: string; label: string }",
    ),
    stableComponent.replace(
      "interface ModelPickerProps { sideOffset?: number; tabsLabel?: string }",
      'interface ModelPickerProps { sideOffset?: number; providerLayout?: "sections" | "tabs" }',
    ),
    stableComponent.replace(
      "interface ModelPickerProps { sideOffset?: number; tabsLabel?: string }",
      'interface ModelPickerProps { sideOffset?: number; view?: "grouped" | "tabs" }',
    ),
    stableComponent.replace(
      "interface ModelPickerProps { sideOffset?: number; tabsLabel?: string }",
      'interface ModelPickerProps { sideOffset?: number; mode?: "grouped" | "tabs" }',
    ),
    stableComponent.replace(
      'function ModelPicker({ sideOffset = 0, tabsLabel = "Model providers" })',
      'function ModelPicker({ sideOffset = 0, tabsLabel = "Model providers", providerLayout = "sections" })',
    ),
    stableComponent.replace(
      'function ModelPicker({ sideOffset = 0, tabsLabel = "Model providers" })',
      'function ModelPicker({ sideOffset = 0, tabsLabel = "Model providers", mode = "tabs" })',
    ),
    stableComponent.replace('role="tablist"', 'role="group"'),
    stableComponent.replace('aria-label={tabsLabel}', 'aria-label="Providers"'),
    stableComponent.replace('tabsLabel = "Model providers"', 'tabsLabel = "Providers"'),
    stableComponent.replace('role="tab"', 'role="button"'),
    stableComponent.replace('aria-controls={providerPanelId}', 'aria-controls="wrong-panel"'),
    stableComponent.replace('tabIndex={selected ? 0 : -1}', 'tabIndex={-1}'),
    stableComponent.replace(
      'role={activeProvider ? "tabpanel" : undefined}',
      'role="tabpanel"',
    ),
    stableComponent.replace(
      'id={activeProvider ? providerPanelId : undefined}',
      'id="provider-panel"',
    ),
    stableComponent.replace(
      'aria-labelledby={activeProvider ? providerTabId(activeProvider.id) : undefined}',
      'aria-label="Models"',
    ),
  ]
  for (const [index, mutated] of adjacencyComponentMutations.entries()) {
    assert.notDeepEqual(
      interactionStabilityIssues(
        mutated,
        `${stableStory}${providerTabsStory}`,
        stableSearchableListbox,
      ),
      [],
      `adjacency component mutation ${index} must fail closed`,
    )
  }
  const aliasedLayoutMutation = stableComponent
    .replace(
      "interface ModelPickerProps { sideOffset?: number; tabsLabel?: string }",
      'type PickerMode = "tabs" | "grouped"\ninterface ModelPickerProps { sideOffset?: number; mode?: PickerMode }',
    )
    .replace(
      'function ModelPicker({ sideOffset = 0, tabsLabel = "Model providers" })',
      "function ModelPicker({ sideOffset = 0, mode })",
    )
    .replace(
      '<SearchableListbox items={visibleItems} renderItem={renderModelItem} />',
      '{mode === "grouped" ? <SearchableListbox items={visibleItems} renderItem={renderModelItem} /> : <SearchableListbox items={visibleItems} renderItem={renderModelItem} />}',
    )
  assert.ok(
    interactionStabilityIssues(
      aliasedLayoutMutation,
      `${stableStory}${providerTabsStory}`,
      stableSearchableListbox,
    ).some((issue) => issue.includes("canonical provider-tab layout")),
    "aliased layout mode and grouped branch must fail the canonical-layout contract",
  )
  const adjacencyStoryMutations = [
    {
      source: `${stableStory}${providerTabsStory.replace(
      "triggerRect.top - contentRect.bottom",
      "triggerRect.top - triggerRect.top",
      )}`,
      issue: "flush with its trigger",
    },
    {
      source: `${stableStory}${providerTabsStory.replace(
      "providerTabsRect.top - optionsRect.bottom",
      "providerTabsRect.top - providerTabsRect.top",
      )}`,
      issue: "provider rail is flush",
    },
    {
      source: `${stableStory.replace(
      'models: [{ id: "model", label: "Model" }]',
      'models: [{ id: "model", label: "Model", capabilities: { fastMode: true } }]',
      )}${providerTabsStory}`,
      issue: "must not embed capability",
    },
    {
      source: `${stableStory.replace(
      'models: [{ id: "model", label: "Model" }]',
      'models: [{ id: "model", label: "Model", ["modes"]: ["fast", "slow"] }]',
      )}${providerTabsStory}`,
      issue: "must not embed capability",
    },
    {
      source: `${stableStory}\nconst thinkingFields = { thinking: ["high"] }\nconst spreadGroups = [{ id: "p", label: "P", models: [{ id: "m", label: "M", ...thinkingFields }] }]\nexport const SpreadCatalog = { render: () => <ModelPicker groups={spreadGroups} /> }${providerTabsStory}`,
      issue: "must not embed capability",
    },
    {
      source: `${stableStory.replace(
      "<ModelPicker groups={modelGroups} />",
      '<ModelPicker groups={modelGroups} providerLayout="tabs" />',
      )}${providerTabsStory}`,
      issue: "canonical provider-tab layout",
    },
    {
      source: `${stableStory.replace("export const SingleProvider", "export const OneProvider")}${providerTabsStory}`,
      issue: "SingleProvider must preserve",
    },
    {
      source: `${stableStory.replace("export const DisabledProviderFallback", "export const ProviderFallback")}${providerTabsStory}`,
      issue: "DisabledProviderFallback must preserve",
    },
    {
      source: `${stableStory.replace(
      'queryByRole("tabpanel")',
      'queryByRole("region")',
      )}${providerTabsStory}`,
      issue: "must preserve canonical provider-tab accessibility evidence",
    },
  ]
  for (const [index, mutation] of adjacencyStoryMutations.entries()) {
    assert.ok(
      interactionStabilityIssues(
        stableComponent,
        mutation.source,
        stableSearchableListbox,
      ).some((issue) => issue.includes(mutation.issue)),
      `adjacency story mutation ${index} must fail closed`,
    )
  }
  assert.deepEqual(
    interactionStabilityIssues(
      stableComponent,
      `${stableStory}${providerTabsStory}\nconst docsConfig = { mode: "docs" }`,
      stableSearchableListbox,
    ),
    [],
    "unrelated Storybook mode configuration must not be treated as model data",
  )
  assert.ok(
    interactionStabilityIssues(
      stableComponent,
      `${stableStory.replace('defaultViewport: "mobile1"', 'defaultViewport: "desktop"')}${providerTabsStory}`,
      stableSearchableListbox,
    ).some((issue) => issue.includes("narrow viewport")),
  )
  assert.ok(
    interactionStabilityIssues(
      stableComponent,
      `${stableStory.replaceAll("modelRectBefore", "modelBefore")}${providerTabsStory}`,
      stableSearchableListbox,
    ).some((issue) => issue.includes("lacks rendered evidence modelRectBefore")),
  )
  assert.ok(
    interactionStabilityIssues(
      stableComponent,
      `${stableStory
        .replace(
          "modelSurface.getBoundingClientRect()",
          "modelSurface.getBoundingClientRect()",
        )
        .replace(
          "const modelRectAfter = modelSurface.getBoundingClientRect()",
          "const modelRectAfter = modelRectBefore",
        )
        .replace(
          "const solRectAfter = sol.getBoundingClientRect()",
          "const solRectAfter = solRectBefore",
        )
        .replace(
          "const terraRectAfter = terra.getBoundingClientRect()",
          "const terraRectAfter = terraRectBefore",
        )}${providerTabsStory}`,
      stableSearchableListbox,
    ).some((issue) => issue.includes("must measure modelRectAfter from modelSurface")),
  )
})
