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
    "A host element under `asChild` carries the scope, and the scope's answers win on it. A `data-nessa-*` the host wrote itself is replaced rather than left standing or silently dropped — React context and the DOM would otherwise disagree about which appearance the tree is in — and `color-scheme` follows them, because controls that disagree with their surface read as broken. Ownership stops there: an ordinary style passed to the provider keeps Slot's usual precedence and loses to the child's.",
  ),
  args: { children: <div /> },
  render: () => (
    <NessaProvider
      defaultMode={NessaColorMode.Dark}
      theme="default"
      scale={NessaScale.Larger}
      style={{ padding: "8px", color: "rgb(255, 0, 0)" }}
      asChild
    >
      <section
        data-testid="scope"
        data-nessa-mode="light"
        data-nessa-theme="borrowed"
        data-nessa-scale={NessaScale.Smaller}
        className="rounded-md border"
        style={{ padding: "24px", color: "rgb(0, 0, 255)", colorScheme: "light" }}
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

    // Ownership stops where the scope's own declarations stop. `color-scheme`
    // is the one the scope owns, so it wins; `padding` and `color` are
    // ordinary styles the host happened to pass to the provider, and lose to
    // the child's exactly as they would under a bare Slot.
    await expect(scope.tagName).toBe("SECTION")
    await expect(scope.className).toContain("rounded-md")
    await expect(scope.style.colorScheme).toBe(NessaColorMode.Dark)
    await expect(scope.style.padding).toBe("24px")
    await expect(scope.style.color).toBe("rgb(0, 0, 255)")
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

export const TheProviderLaysNothingOut: Story = {
  parameters: storyDocumentation(
    "Adopting the provider moves nothing on the page. A root that is itself a flex or grid container counts the items it was given and no others, with the menu closed and with it open: a layer is not part of the content it was opened from, so nothing is added to that content to hold one.",
  ),
  args: { children: <div /> },
  render: () => <LayerHostLayoutProbe />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const column = canvas.getByTestId("column")
    // Two 32px rows and one 16px gap. A layer host rendered as a third child
    // would add a second gap and stand the column up 16px taller, whether or
    // not anything had been opened.
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

function ClippingAncestorProbe() {
  return (
    // The clipping box is outside the provider, which is the case a host
    // creates simply by mounting Nessa inside a region it already owns — a
    // card, a preview pane, a transformed panel. The provider's own element
    // clips too, so both ancestors are under test at once.
    <div
      data-testid="clip"
      className="overflow-hidden rounded-md border"
      style={{ width: "240px", height: "80px", transform: "translateZ(0)" }}
    >
      <NessaProvider
        defaultMode={NessaColorMode.Dark}
        className="flex h-full items-center overflow-hidden px-3"
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
    </div>
  )
}

export const LayersAreThemedWithoutBeingClipped: Story = {
  parameters: storyDocumentation(
    "A menu opened inside a Dark provider reads the Dark tokens, and neither the provider's root nor the clipping region a host mounted it in cuts the menu off. Theme ownership and clipping ownership are separate jobs: the layer carries the scope's attributes onto its own element and stays where it was already going, rather than being moved somewhere themed and inheriting that somewhere's `overflow` and `transform`.",
  ),
  args: { children: <div /> },
  render: () => <ClippingAncestorProbe />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const clip = canvas.getByTestId("clip")
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

    // Unclipped, asserted where it matters: the last row sits past the
    // bottom of an 80px clipping box, and what is actually painted there is
    // that row — so a pointer lands on it rather than on the page behind.
    const items = within(menu).getAllByRole("menuitem")
    const last = items[items.length - 1]
    if (!last) throw new Error("The menu rendered no items.")
    const lastRect = last.getBoundingClientRect()
    await expect(lastRect.top).toBeGreaterThan(clip.getBoundingClientRect().bottom)
    const painted = document.elementFromPoint(
      lastRect.left + lastRect.width / 2,
      lastRect.top + lastRect.height / 2,
    )
    await expect(last === painted || last.contains(painted)).toBe(true)

    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(menu).not.toBeInTheDocument())
  },
}
