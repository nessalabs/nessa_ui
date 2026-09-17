/** @responsibility Verifies that components render on a server, where no browser global exists. */

import assert from "node:assert/strict"
import test from "node:test"

import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"

// Imported by module rather than through the barrel, deliberately. The barrel
// pulls in every rich-content surface, and one of those imports a stylesheet —
// which Node cannot load at all. That is worth knowing (it is why a server
// importing the package needs a bundler that handles CSS side effects) but it
// is not what this file is testing, and going through it would mean this
// never ran.
import { Badge } from "./components/badge"
import { Button } from "./components/button"
import { Card, CardContent } from "./components/card"
import { Checkbox } from "./components/checkbox"
import { Input } from "./components/input"
import { Message } from "./components/message"
import { SearchableListbox } from "./components/searchable-listbox"
import { SectionedListbox } from "./components/sectioned-listbox"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/tabs"

/**
 * The environment no browser test can reach.
 *
 * Every Nessa component carries `"use client"`, which says where it *hydrates*
 * — not that it is exempt from being rendered on a server first. A Next.js or
 * Remix app renders the client component's initial HTML in Node, where there
 * is no `window`, no `document`, and no `matchMedia`. A component that reads
 * one of those during render does not degrade there; it throws, and the page
 * fails to render at all.
 *
 * The Storybook suite runs in a browser, so every global is present and this
 * class of defect is invisible to it no matter how many engines it covers.
 * That is the gap this file exists for: the assertion is simply that the
 * render completes and produces markup.
 *
 * Effects are deliberately not covered. `useEffect` does not run on the
 * server, so a component reading `window` inside one is correct; the defect is
 * reading it in the render body, in a `useState` initializer, or in a
 * `useMemo` — all of which run here.
 */

/** Renders one element and returns its markup, letting a throw fail the test. */
function server(element: React.ReactElement): string {
  return renderToStaticMarkup(element)
}

test("primitives render without a browser global", () => {
  assert.ok(server(<Button>Continue</Button>).includes("Continue"))
  assert.ok(server(<Badge>New</Badge>).includes("New"))
  assert.ok(server(<Input aria-label="Name" defaultValue="Ada" />).includes("Ada"))
  assert.ok(server(<Checkbox aria-label="Agree" />).length > 0)
  assert.ok(
    server(
      <Card>
        <CardContent>Body</CardContent>
      </Card>,
    ).includes("Body"),
  )
})

test("a Radix-backed composite renders its initial tab on the server", () => {
  const markup = server(
    <Tabs defaultValue="one">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">First panel</TabsContent>
      <TabsContent value="two">Second panel</TabsContent>
    </Tabs>,
  )
  assert.ok(markup.includes("First panel"))
  assert.ok(markup.includes("One"))
})

test("the listboxes render their rows on the server", () => {
  const items = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ]
  const searchable = server(
    <SearchableListbox
      items={items}
      getItemId={(item) => item.id}
      getItemKeywords={(item) => [item.label]}
      renderItem={(item) => item.label}
      listLabel="Items"
    />,
  )
  assert.ok(searchable.includes("Alpha"))
  assert.ok(searchable.includes("Beta"))

  const sectioned = server(
    <SectionedListbox
      sections={[{ id: "s", label: "Section", items }]}
      getItemId={(item) => item.id}
      renderItem={(item) => item.label}
      listLabel="Items"
    />,
  )
  assert.ok(sectioned.includes("Section"))
  assert.ok(sectioned.includes("Alpha"))
})

test("a conversation surface renders its content on the server", () => {
  assert.ok(server(<Message>Hello</Message>).includes("Hello"))
})

/**
 * The guard is only worth having if it fails on the thing it guards against,
 * so this proves the environment really is bare rather than quietly polyfilled
 * by the test runner.
 */
test("the render really does happen without a DOM", () => {
  assert.equal(typeof globalThis.document, "undefined")
  assert.equal(typeof globalThis.window, "undefined")
  function ReadsTheDom() {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return <span>{String(window.innerWidth)}</span>
  }
  assert.throws(() => server(<ReadsTheDom />))
})
