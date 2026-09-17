import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  NessaColorMode,
  NessaProvider,
  NessaScale,
  useNessaColorMode,
  type NessaResolvedColorMode,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Foundation/NessaProvider",
  component: NessaProvider,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "The root of a Nessa tree. It writes the theme, the resolved appearance, and the scale onto one element — its own, or the host's under `asChild` — and publishes the resolved mode to everything inside. `system` is a request that never reaches the DOM: what the attributes record is always `light` or `dark`. Floating layers opened inside it land in a boxless host beside that element, so they read the same tokens as the content that opened them without the root becoming their clipping ancestor.",
      },
    },
  },
} satisfies Meta<typeof NessaProvider>

export default meta
type Story = StoryObj<typeof meta>

/** The provider's own element, read back from the DOM rather than from props. */
function scopeAttributes(element: Element) {
  return {
    theme: element.getAttribute("data-nessa-theme"),
    mode: element.getAttribute("data-nessa-mode"),
    scale: element.getAttribute("data-nessa-scale"),
  }
}

export const AsChildKeepsTheScopesAttributes: Story = {
  parameters: storyDocumentation(
    "A host element under `asChild` carries the scope, and the scope's answers win on it. A `data-nessa-*` the host wrote itself is replaced rather than left standing or silently dropped — React context and the DOM would otherwise disagree about which appearance the tree is in — while the styles and classes the host brought survive untouched.",
  ),
  args: { children: <div /> },
  render: () => (
    <NessaProvider
      defaultMode={NessaColorMode.Dark}
      theme="default"
      scale={NessaScale.Larger}
      asChild
    >
      <section
        data-testid="scope"
        data-nessa-mode="light"
        data-nessa-theme="borrowed"
        data-nessa-scale={NessaScale.Smaller}
        className="rounded-md border p-4"
        style={{ outlineOffset: "4px" }}
      >
        <p className="text-sm">The host owns this element; Nessa owns its scope.</p>
      </section>
    </NessaProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scope = canvas.getByTestId("scope")

    // The scope's own answers, on the element, not merely in context.
    await expect(scopeAttributes(scope)).toEqual({
      theme: "default",
      mode: NessaColorMode.Dark,
      scale: NessaScale.Larger,
    })
    // `system` never reaches the DOM, and neither does the host's stale value.
    await expect(scope.getAttribute("data-nessa-mode")).not.toBe(NessaColorMode.Light)

    // Ownership stops at the scope's own prefix: what the host brought stays.
    await expect(scope.tagName).toBe("SECTION")
    await expect(scope.className).toContain("rounded-md")
    await expect(scope.style.outlineOffset).toBe("4px")
    await expect(scope.style.colorScheme).toBe(NessaColorMode.Dark)
  },
}

/** Every appearance that actually reached the screen, in the order it did. */
function CommittedModeTrail() {
  const { mode, resolvedMode, setMode } = useNessaColorMode()
  const [trail, setTrail] = React.useState<NessaResolvedColorMode[]>([])
  // After every commit, not on a dependency: the question is what was painted,
  // and a render React discards never gets here at all.
  React.useLayoutEffect(() => {
    setTrail((current) =>
      current[current.length - 1] === resolvedMode ? current : [...current, resolvedMode],
    )
  })
  return (
    <div className="flex flex-col items-start gap-3">
      <output data-testid="trail" className="font-mono text-xs">
        {trail.join(" → ")}
      </output>
      <output data-testid="requested" className="font-mono text-xs">
        {mode}
      </output>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setMode(NessaColorMode.System)}
      >
        Follow the system
      </Button>
    </div>
  )
}

/**
 * Reports Dark for the colour-scheme query and delegates every other query,
 * so only the appearance under test is stubbed.
 */
function installDarkOperatingSystem() {
  const original = window.matchMedia
  const stub = ((query: string) => {
    if (query !== "(prefers-color-scheme: dark)") return original.call(window, query)
    return {
      media: query,
      matches: true,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  }) as typeof window.matchMedia
  window.matchMedia = stub
  return () => {
    window.matchMedia = original
  }
}

export const EnteringSystemKeepsTheCommittedAppearance: Story = {
  parameters: storyDocumentation(
    "Switching a Dark tree to `system` under a Dark operating system stays dark the whole way. The seed answers what the first paint should be, which is a different question from what is on screen now, so entering an unsupplied `system` hands over to the committed appearance instead — and does it while rendering, because an effect could only repair the flash after it had already been painted.",
  ),
  args: { children: <div /> },
  beforeEach: () => installDarkOperatingSystem(),
  render: () => (
    <NessaProvider defaultMode={NessaColorMode.Dark}>
      <CommittedModeTrail />
    </NessaProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trail = canvas.getByTestId("trail")
    const scope = canvasElement.querySelector("[data-nessa-root]")
    if (!scope) throw new Error("The provider rendered no scope element.")

    await waitFor(() => expect(trail).toHaveTextContent(NessaColorMode.Dark))
    await expect(scope.getAttribute("data-nessa-mode")).toBe(NessaColorMode.Dark)

    await userEvent.click(canvas.getByRole("button", { name: "Follow the system" }))

    // The request changes; the appearance does not.
    await waitFor(() =>
      expect(canvas.getByTestId("requested")).toHaveTextContent(NessaColorMode.System),
    )
    await waitFor(() =>
      expect(scope.getAttribute("data-nessa-mode")).toBe(NessaColorMode.Dark),
    )
    // The whole trail, not just where it ended: a Light in the middle is the
    // white flash this is here to catch.
    await expect(trail.textContent).toBe(NessaColorMode.Dark)
  },
}

function LayerHostLayoutProbe() {
  return (
    <NessaProvider defaultMode={NessaColorMode.Dark} asChild>
      <div data-testid="column" className="flex flex-col gap-4">
        <div className="flex h-8 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Open a layer
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>Rename</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="h-8 rounded-md border" />
      </div>
    </NessaProvider>
  )
}

export const TheLayerHostLaysNothingOut: Story = {
  parameters: storyDocumentation(
    "Adopting the provider moves nothing on the page. A root that is itself a flex or grid container counts the items it was given and no others: the layer host is neither one of its children nor a box of its own, with the menu closed and with it open.",
  ),
  args: { children: <div /> },
  render: () => <LayerHostLayoutProbe />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const column = canvas.getByTestId("column")
    // Two 32px rows and one 16px gap. A host rendered as a third child would
    // add a second gap and stand the column up 16px taller, whether or not
    // anything had been opened.
    const closedHeight = Math.round(column.getBoundingClientRect().height)
    await expect(closedHeight).toBe(80)

    await userEvent.click(canvas.getByRole("button", { name: "Open a layer" }))
    const menu = await within(document.body).findByRole("menu")
    await expect(Math.round(column.getBoundingClientRect().height)).toBe(closedHeight)

    // Leave nothing open: a menu still animating is main-thread time every
    // later story pays for.
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(menu).not.toBeInTheDocument())
  },
}

function ClippingRootProbe() {
  return (
    <NessaProvider
      defaultMode={NessaColorMode.Dark}
      className="flex items-center overflow-hidden rounded-md border px-3"
      style={{ height: "48px", transform: "translateZ(0)" }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Trace actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom">
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuItem>Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </NessaProvider>
  )
}

export const LayersAreThemedWithoutBeingClipped: Story = {
  parameters: storyDocumentation(
    "A menu opened inside a Dark provider reads the Dark tokens, and a transformed, `overflow: hidden` root does not cut it off. Theme ownership and clipping ownership are separate jobs: the layer host carries the scope's attributes, and sits beside the root rather than inside it.",
  ),
  args: { children: <div /> },
  render: () => <ClippingRootProbe />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The provider renders no test id of its own; the scope is the element
    // carrying the root attribute, which is the contract under test anyway.
    const scope = canvasElement.querySelector("[data-nessa-root]")
    if (!scope) throw new Error("The provider rendered no scope element.")

    await userEvent.click(canvas.getByRole("button", { name: "Trace actions" }))
    const menu = await within(document.body).findByRole("menu")

    // Themed: the same scope answers, and so the same resolved token values.
    await expect(
      menu.closest("[data-nessa-mode]")?.getAttribute("data-nessa-mode"),
    ).toBe(NessaColorMode.Dark)
    await expect(
      getComputedStyle(menu).getPropertyValue("--popover").trim(),
    ).toBe(getComputedStyle(scope).getPropertyValue("--popover").trim())

    // Unclipped: it leaves the root's 48px box, and what is drawn at its
    // centre is the menu itself rather than whatever the root cut it down to.
    const menuRect = menu.getBoundingClientRect()
    const scopeRect = scope.getBoundingClientRect()
    await expect(menuRect.height).toBeGreaterThan(0)
    await expect(
      menuRect.bottom > scopeRect.bottom || menuRect.top < scopeRect.top,
    ).toBe(true)
    const painted = document.elementFromPoint(
      menuRect.left + menuRect.width / 2,
      menuRect.top + menuRect.height / 2,
    )
    await expect(menu.contains(painted)).toBe(true)

    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(menu).not.toBeInTheDocument())
  },
}
