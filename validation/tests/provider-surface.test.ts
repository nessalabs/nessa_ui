import assert from "node:assert/strict"
import test from "node:test"
import ts from "typescript"

import {
  layerModeAttribute,
  publishedLayerScopeKeys,
  unscopedPortalLayers,
} from "../nessa/checks/provider-surface.ts"

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

test("a layer that writes the mode out carries it as surely as one that spreads it", () => {
  // The rule is the attribute arriving, not the mechanism that brought it.
  assert.deepEqual(
    unscopedPortalLayers(
      parse(`function Layer() {
  const container = usePortalContainer()
  const { resolvedMode } = useNessaColorMode()
  return (<Menu.Portal container={container}><Menu.Content data-nessa-mode={resolvedMode} /></Menu.Portal>)
}`),
    ),
    [],
  )
  // A neighbouring attribute from the same family is not the one that matters.
  assert.deepEqual(
    unscopedPortalLayers(
      parse(`function Layer() {
  const container = usePortalContainer()
  const { theme } = useNessaTheme()
  return (<Menu.Portal container={container}><Menu.Content data-nessa-theme={theme} /></Menu.Portal>)
}`),
    ),
    ["Menu.Portal at line 4"],
  )
})

test("the published layer scope is read through the binding and the memo", () => {
  const memo = `function Provider() {
  const layerScope = React.useMemo(() => ({
    "data-nessa-theme": theme,
    "data-nessa-mode": resolvedMode,
    "data-nessa-scale": scale,
  }), [resolvedMode, scale, theme])
  return (<PortalContainerProvider container={null} scope={layerScope}>{element}</PortalContainerProvider>)
}`
  assert.deepEqual(publishedLayerScopeKeys(parse(memo)), [
    "data-nessa-theme",
    layerModeAttribute,
    "data-nessa-scale",
  ])
  // Inline, and through a plain binding.
  assert.deepEqual(
    publishedLayerScopeKeys(
      parse('const view = <PortalContainerProvider container={null} scope={{ "data-nessa-mode": resolved }}>{children}</PortalContainerProvider>'),
    ),
    [layerModeAttribute],
  )
  assert.deepEqual(
    publishedLayerScopeKeys(
      parse('const scope = { "data-nessa-mode": resolved }; const view = <PortalContainerProvider container={null} scope={scope}>{children}</PortalContainerProvider>'),
    ),
    [layerModeAttribute],
  )
  // A scope that publishes everything except the mode, and no scope at all.
  assert.deepEqual(
    publishedLayerScopeKeys(
      parse('const view = <PortalContainerProvider container={null} scope={{ "data-nessa-theme": theme }}>{children}</PortalContainerProvider>'),
    ),
    ["data-nessa-theme"],
  )
  assert.equal(
    publishedLayerScopeKeys(parse('const view = <PortalContainerProvider container={host}>{children}</PortalContainerProvider>')),
    null,
  )
})
