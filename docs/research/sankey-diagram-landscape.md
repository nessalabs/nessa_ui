# Sankey diagram landscape

Research against primary sources (official docs, API references, READMEs), 2026-08-28.
Note: `docs/` had `architecture/` and `plans/` but no research directory; `docs/research/` was created for this file per task convention.

## 1. d3-sankey (the reference layout engine)

Source: https://github.com/d3/d3-sankey (README/API).

- **Alignment** — `sankey.nodeAlign(align)` with four built-ins:
  - `sankeyLeft` — column = `node.depth` (distance from a source).
  - `sankeyRight` — column = `n - 1 - node.height` (distance from a sink).
  - `sankeyCenter` — like left, but nodes with no incoming links are pushed rightward.
  - `sankeyJustify` (default) — like left, but nodes with no outgoing links are moved to the far right.
  - Custom align: `(node, n) => integer in [0, n-1]` — arbitrary column assignment.
- **Crossing minimization** — `sankey.iterations(n)`, default **6** relaxation passes that reorder/reposition nodes vertically to reduce link crossings (weighted-barycenter style relaxation).
- **Ordering** — `nodeSort` / `linkSort`: `undefined` (default) = automatic order from the layout; `null` = frozen input order; or a custom comparator.
- **Geometry** — `nodeWidth` default 24px, `nodePadding` default 8px, `extent` default `[[0,0],[1,1]]` (`size()` is sugar for an extent anchored at 0,0). `nodeId` defaults to `d.index`, customizable for string ids.
- **Links** — `sankeyLinkHorizontal()` produces a cubic Bézier ribbon (a `d3.linkHorizontal` variant) from `[source.x1, link.y0]` to `[target.x0, link.y1]`; link thickness = `link.width` (value-proportional), drawn as a stroked path.
- **Cycles** — documented only for a "directed acyclic network"; there is no cycle support. (In the source, depth computation loops over the graph and throws "circular link" when it fails to converge; the community `d3-sankey-circular` fork exists precisely because of this.)

## 2. Apache ECharts (`series-sankey`)

Source: https://echarts.apache.org/en/option.html#series-sankey (option doc source: https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/series/sankey.md).

- **orient**: `horizontal` (default) | `vertical`.
- **nodeAlign**: `justify` (default) | `left` | `right`.
- **layoutIterations**: default **32**; set `0` to keep the input order (their documented way to get deterministic ordering).
- **draggable**: default `true` — users can drag nodes freely.
- **levels**: per-depth styling array (`depth`, `itemStyle`, `lineStyle`) — style whole columns at once.
- **Edge color**: `lineStyle.color` = a color | `'source'` | `'target'` | `'gradient'` (source→target blend, v5+); `lineStyle.opacity` default 0.2, `curveness` default 0.5.
- **Sizing**: `nodeWidth` 20, `nodeGap` 8.
- **emphasis.focus: 'adjacency'** — hovering a node/edge highlights adjacent nodes and edges, fading the rest.
- **Tooltip**: standard series-level tooltip works on both nodes and links; labels default to right of node.

## 3. Highcharts sankey

Sources: https://www.highcharts.com/docs/chart-and-series-types/sankey-diagram, https://api.highcharts.com/highcharts/series.sankey.

- Data model: links `{from, to, weight}`; nodes are **generated dynamically** from links, with an optional `nodes` array for per-node overrides (`color`, `colorIndex`, id).
- **nodes.column** — pin a node to a specific column; **nodes.offset** — nudge a node from its computed position.
- **curveFactor** default 0.33; **linkOpacity** default 0.5; **linkColorMode** default `"from"`; **minLinkWidth** default 0 (floor so tiny flows stay visible); `nodeWidth` 20, `nodePadding` 10; `colorByPoint` true.
- **dataLabels** configurable on nodes and links; `chart.inverted: true` yields a vertical sankey.
- Inherits standard Highcharts tooltips, legend, accessibility, and export.

## 4. Plotly sankey

Source: https://plotly.com/javascript/reference/sankey/.

- **arrangement**: `snap` (default — free drag with snapping to preserve gaps) | `perpendicular` (nodes move only perpendicular to flow) | `freeform` (move anywhere) | `fixed` (stationary). Node dragging is on by default in the first three modes.
- **Manual positions**: `node.x` / `node.y` (normalized 0–1), typically combined with `fixed`/`snap` for pinned layouts.
- **Hover**: `node.hoverinfo` and `link.hoverinfo` (`all`/`none`/`skip`), plus `hovertemplate` with `%{value}`, `%{label}` etc. for both nodes and links.
- **Styling**: `link.color` accepts an array (per-link colors, incl. translucent RGBA — default translucent grey); `node.thickness` 20, `node.pad` 20.
- **Units**: `valueformat` (d3-format, default `.3s`) and `valuesuffix` for units in hover text.
- **orientation** `h`/`v`; also a `reversed` direction option.

## 5. amCharts 5 and Nivo

### amCharts 5
Source: https://www.amcharts.com/docs/v5/charts/flow-charts/sankey-diagram/.

- `orientation` horizontal (default) / vertical; `nodeAlign`: `left` (default) | `right` | `center` | `justify`.
- `nodeWidth` default 10, `nodePadding` gap control; `linkSort` (custom fn or `null` to keep data order).
- **linkTension** 0–1 (default 0.5; 1 = straight lines) — curvature control.
- **fillStyle** on links: `"gradient"` (default source→target blend) | `"solid"` | `"source"` | `"target"`.
- Nodes are **draggable and clickable (toggle) by default** (`draggable: false`, `toggleKey: "none"` to disable); customizable tooltips on nodes and links; label templates with placeholders (`{name}`, `{sumOutgoing}`).

### Nivo (@nivo/sankey)
Source: https://nivo.rocks/sankey/.

- `layout` horizontal/vertical; `align` and `sort` props (d3-sankey underneath); `nodeThickness`, `nodeSpacing`.
- **enableLinkGradient** (source→target gradient), `linkBlendMode`, full theming/colors.
- Labels: `labelPosition`, `labelOrientation`, custom `label`/format functions.
- Interactivity: `onClick`, hover highlight, custom tooltips; springs-based **motion** config.
- Explicit cycle stance: "it does not support cyclic dependencies… `A —> B —> C —> A` will crash."

### visx
`@visx/sankey` exists — added in visx v3.12.0 (Nov 2024): a thin React wrapper over d3-sankey exposing `Sankey` plus the d3 align helpers (e.g. `sankeyCenter`). Sources: https://github.com/airbnb/visx/releases/tag/v3.12.0, https://www.npmjs.com/package/@visx/sankey.

## 6. Synthesis — canonical feature set

**Layout**
- Four alignments (left/right/center/justify) + custom align — universal (d3, ECharts*, amCharts, Nivo; *ECharts lacks center).
- Crossing-minimization via iterative relaxation with an `iterations` knob and a "0 / null = keep input order" escape hatch (d3 `nodeSort: null`, ECharts `layoutIterations: 0`, amCharts `linkSort: null`).
- Horizontal + vertical orientation (all but d3-sankey core, which is horizontal-only by convention).
- Manual overrides are a differentiator: Highcharts `node.column`/`offset`, Plotly `node.x/y` + `arrangement: fixed`.
- Cycles: **nobody supports them in core** — d3 throws, Nivo crashes; only community forks (d3-sankey-circular) handle them. A component should validate and error clearly.

**Interaction**
- Hover emphasis with **adjacency focus** (dim non-connected) — ECharts' `emphasis.focus: 'adjacency'` is the gold standard; Nivo/amCharts do hover highlight.
- Tooltips on both nodes and links, with value formatting/units (Plotly `valueformat`/`valuesuffix`).
- Node dragging: on by default in ECharts, Plotly, amCharts — expected in interactive libs; absent in d3/Nivo/visx.
- Click selection/toggle: amCharts toggleKey, Nivo onClick.

**Styling**
- Per-node colors + per-link color modes: solid | inherit-source | inherit-target | **gradient source→target** (ECharts, amCharts, Nivo all ship gradient; Highcharts `linkColorMode`).
- Link opacity and curvature knobs (curveFactor / curveness / linkTension).
- Label placement (inside/outside, left/right of node), orientation, and formatter; per-level/column styling (ECharts `levels`).
- `minLinkWidth` floor (Highcharts) so tiny flows remain visible.

**Data**
- Nodes + links `{source, target, value}`; auto-generating nodes from links (Highcharts) is a nice ergonomics win; string ids (d3 `nodeId`).
- Multi-stage flows fall out of the layout; units/percent via value formatters.
- Zero/negative values: no library gives negatives meaning (weights are magnitudes); zero-weight links render at 0 or `minLinkWidth`.
- Streaming/dynamic updates: none has a dedicated streaming story — ECharts/Plotly re-render via `setOption`/`react`; Nivo animates transitions via motion springs (the closest to "animated updates").

## Feature matrix

| Feature | d3-sankey | ECharts | Highcharts | Plotly | Nivo |
|---|---|---|---|---|---|
| Align left/right/justify | yes (+center, custom fn) | yes (no center) | via node.column | via node.x/y | yes (+center) |
| Iterations knob / keep-order escape | 6 / nodeSort:null | 32 / iterations:0 | auto | auto | via d3 sort |
| Vertical orientation | no | yes | inverted chart | yes | yes |
| Manual node positioning | no | drag only | column+offset | node.x/y + fixed | no |
| Cycle support | no (throws) | no | no | no | no (crashes) |
| Node dragging | no | default on | no | default on (snap) | no |
| Adjacency hover focus | n/a (layout only) | yes (emphasis.focus) | hover state | hover | yes |
| Tooltips (node + link) | n/a | yes | yes | hovertemplate | yes, custom |
| Link gradient source→target | manual SVG | yes (v5) | linkColorMode | per-link colors | enableLinkGradient |
| Link curvature knob | fixed Bézier | curveness 0.5 | curveFactor 0.33 | fixed | fixed |
| Min link width floor | no | no | yes (minLinkWidth) | no | no |
| Per-level/column styling | no | yes (levels) | no | no | no |
| Value format / units | n/a | formatter | formatter | valueformat/suffix | format fn |
| Animated transitions | no | built-in | built-in | limited | motion springs |
| Click selection/toggle | n/a | events | events | events | onClick |
