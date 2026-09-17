/**
 * A mid-sized consumer: a picker and the surfaces it opens.
 *
 * Radix, a portalled popover, and the listbox engine, but none of the
 * Markdown, syntax-highlighting or diagram stack.
 */
import { Button, ModelPicker, SearchableListbox } from "@nessalabs/ui"

export function App() {
  return (
    <>
      <Button>Open</Button>
      <ModelPicker
        groups={[{ id: "p", label: "Provider", models: [{ id: "m", label: "Model" }] }]}
        value={{ providerId: "p", modelId: "m" }}
        onValueChange={() => {}}
      />
      <SearchableListbox
        items={[{ id: "a", label: "Alpha" }]}
        getItemId={(item) => item.id}
        getItemKeywords={(item) => [item.label]}
        renderItem={(item) => item.label}
        listLabel="Items"
      />
    </>
  )
}
