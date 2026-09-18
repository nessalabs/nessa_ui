import assert from "node:assert/strict"
import test from "node:test"
import ts from "typescript"

import { unscopedPortalLayers } from "../nessa/checks/provider-surface.ts"

const parse = (source: string) =>
  ts.createSourceFile("fixture.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

const portal = (body: string) => `function Layer() {
  const container = usePortalContainer()
  const layerScope = useNessaLayerScope()
  return (${body})
}`

test("a governed portal passes only when the scope reaches the element inside it", () => {
  assert.deepEqual(
    unscopedPortalLayers(
      parse(portal('<Menu.Portal container={container}><Menu.Content {...layerScope} /></Menu.Portal>')),
    ),
    [],
  )
  // Through a wrapper, which is how a surface component composes the content.
  assert.deepEqual(
    unscopedPortalLayers(
      parse(portal('<Menu.Portal container={container}><Surface asChild><Menu.Content {...layerScope} /></Surface></Menu.Portal>')),
    ),
    [],
  )
  // The bare primitive name, not only the qualified one.
  assert.deepEqual(
    unscopedPortalLayers(
      parse(portal('<Portal container={container}><Content {...layerScope} /></Portal>')),
    ),
    [],
  )
})

test("calling the hook is not the claim; the value has to land on the element", () => {
  // The case a text search cannot see: the hook is called and its result goes
  // nowhere, so the layer portals out of the tree carrying nothing.
  assert.deepEqual(
    unscopedPortalLayers(parse(portal('<Menu.Portal container={container}><Menu.Content /></Menu.Portal>'))),
    ["Menu.Portal at line 4"],
  )
  // Spread onto the portal instead of the content: the portal is a wrapper
  // that draws nothing, so the attributes reach no rendered surface.
  assert.deepEqual(
    unscopedPortalLayers(parse(portal('<Menu.Portal {...layerScope} container={container}><Menu.Content /></Menu.Portal>'))),
    ["Menu.Portal at line 4"],
  )
  // Nothing inside it at all.
  assert.deepEqual(
    unscopedPortalLayers(parse(portal('<Menu.Portal container={container} />'))),
    ["Menu.Portal at line 4"],
  )
  assert.deepEqual(
    unscopedPortalLayers(
      parse(`function Layer() {
  const container = usePortalContainer()
  return (<Menu.Portal container={container}><Menu.Content /></Menu.Portal>)
}`),
    ),
    ["Menu.Portal at line 3"],
  )
})

test("a portal the provider does not answer for is left alone", () => {
  // A container a caller passed in, or a panel's own ref: where these land is
  // not the provider's question, and neither is what they carry.
  assert.deepEqual(
    unscopedPortalLayers(
      parse(`function Panel({ container }: { container?: HTMLElement }) {
  const resolved = usePortalContainer()
  return (<Dialog.Portal container={container}><Dialog.Content /></Dialog.Portal>)
}`),
    ),
    [],
  )
  assert.deepEqual(
    unscopedPortalLayers(
      parse(`function Panel() {
  const hostRef = React.useRef<HTMLElement>(null)
  const resolved = usePortalContainer()
  return (<Dialog.Portal container={hostRef.current}><Dialog.Content /></Dialog.Portal>)
}`),
    ),
    [],
  )
  // A file that resolves no Nessa container is outside the rule entirely.
  assert.deepEqual(
    unscopedPortalLayers(parse('const view = <Dialog.Portal><Dialog.Content /></Dialog.Portal>')),
    [],
  )
})

test("each portal in a file is judged on its own", () => {
  const source = `function Content() {
  const container = usePortalContainer()
  const layerScope = useNessaLayerScope()
  return (<Menu.Portal container={container}><Menu.Content {...layerScope} /></Menu.Portal>)
}
function SubContent() {
  const container = usePortalContainer()
  const layerScope = useNessaLayerScope()
  return (<Menu.Portal container={container}><Menu.SubContent /></Menu.Portal>)
}`
  assert.deepEqual(unscopedPortalLayers(parse(source)), ["Menu.Portal at line 9"])
})
