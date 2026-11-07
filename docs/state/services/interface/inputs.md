---
id: "ui-inputs"
title: "Inputs and selection"
kind: "contract"
status: "implemented"
summary: "Choose the smallest control that matches the question. Input and SearchField collect text; Checkbox, Switch, Choices and CheckboxList express selection. The host owns the selected data and any action caused by it."
parent: "ui-interface"
sources:
  [
    "packages/react/src/components/searchable-listbox.tsx",
    "packages/react/src/components/sectioned-listbox.tsx",
    "packages/react/src/components/model-picker.tsx",
    "packages/react/src/components/model-capabilities.ts",
    "packages/react/src/components/model-capability-controls.tsx",
    "packages/react/src/components/checkbox.tsx",
    "packages/react/src/components/tabs.tsx",
    "packages/react/src/components/kbd.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Collect input and selection

Choose the smallest control that matches the question. Input and SearchField collect text; Checkbox, Switch, Choices and CheckboxList express selection. The host owns the selected data and any action caused by it.

SearchableListbox and SectionedListbox separate focus from selection and let hosts render item content. ModelPicker consumes a host-supplied provider/model catalog. ModelCapabilities and ModelCapabilityControls describe and choose supplied options such as thinking level or fast mode; they do not query a provider or guarantee that it accepts the requested setting. Read transport capabilities before enabling a control in an agent integration.

Tabs can select as keyboard focus moves or wait for confirmation in manual activation mode. SegmentedControl is a compact choice strip. Checkbox supports an indeterminate mixed state, useful when some child rows are selected; the prop remains authoritative even when the native click clears the DOM flag. A native disabled control prevents interaction but is not a backend authorization rule.

Button, Badge, Card, EmptyState, GroupHeader and SettingsGroup provide presentation and composition. StatusLabel maps host states to supplied tones. Stat, Delta and Meter display values and host-chosen meanings; a green number is not a computed financial recommendation. Kbd labels a keyboard chord but binds no shortcut. Tooltip provides help text and delay behavior; the actionable control still needs its own accessible name.
