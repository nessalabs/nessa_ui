# Chart series ramp

This document describes the categorical colour ramp the Nessa charts draw
from, why its slot order is load-bearing, and the one limit that governs how
many series a chart may show at once.

## Colour is a token, treatment is a component

Chart colour is a system decision, not a per-component one. Three charts each
inventing a palette is the failure mode the ramp exists to prevent, so the
hues live once, as tokens, in `packages/react/src/theme.css` (`:root` and
`.dark`) and are mirrored in the `nessa-base` registry item's
`cssVars.light` / `cssVars.dark`. `TOKEN-003` checks that the package and the
registry artifacts stay in step.

The ramp has **two steps per slot**:

| Token | Role |
| --- | --- |
| `--nessa-chart-series-N` | the pale **fill** step, for large filled areas |
| `--nessa-chart-series-N-strong` | the solid step, for lines and edges |

A component takes the step its mark calls for, and that is the whole of the
per-component decision:

- **PieChart** — a wedge is a large filled area, so `pieChartPalette` takes
  the fill step and the gap between wedges does the separating.
- **FlowChart** — a ribbon is a large translucent area, so `flowChartPalette`
  takes the fill step.
- **RadarChart** — an outline is a two-pixel line, so `radarChartPalette`
  takes the **strong** step and dilutes that same colour for its area wash.

Both steps are tokens, so each theme carries its own pair: a pale tint on the
light surface, a deep one on the dark. Nothing in a component corrects a
colour at the point of use — an earlier revision mixed the line colour toward
`--foreground` to rescue a too-pale palette, and that workaround is exactly
what per-theme steps remove.

`N` runs 1..8: blue, orange, aqua, sand, rose, moss, violet, sky.

## The direction axis is not part of the ramp

Not every chart colours by category. A price series carries a **direction** —
up or down against a reference — which is one semantic pair, not two slots
drawn from a list. Assigning it ramp slots would say the wrong thing twice:
that the two readings are unrelated categories, and that a different chart
using slots 1 and 2 means the same thing by them.

That pair has its own tokens:

| Token | Role |
| --- | --- |
| `--nessa-market-gain` | a price above its reference |
| `--nessa-market-loss` | a price below it |

`PriceChart` takes them through `priceChartToneVariants`, the same
export-the-mapping move `pieChartPalette` and `radarChartPalette` make, so a
panel showing the same reading beside the chart (`StockQuote`'s headline
change) matches it without naming a token twice.

The pair is a **single step**, not a fill/strong pair, because a direction is
read as foreground wherever it appears: a hairline stroke, a change line, a
candle body, the percentage on a selection summary. `PriceChart` dilutes that
one colour for its area wash the way `RadarChart` dilutes its strong step,
rather than carrying a second token for it.

Both are therefore held to text contrast on the `A11Y-001` matrix against
`--card`, `--background`, and `--popover` — every surface they are painted on
as text — rather than to the categorical separation gates, which govern
*telling slots apart* and have nothing to say about a two-value semantic pair.

Direction is never carried by colour alone: every change line `StockQuote`
renders — the session's and the extended-hours one — ships an arrow glyph and
an off-screen "Up"/"Down", and a host embedding a bare `PriceChart` owes the
same relief the ramp's contrast rule asks for.

A future chart with its own semantic axis (pass/fail, over/under budget)
should follow this shape — a named pair of tokens and an exported mapping —
rather than borrowing ramp slots.

## Slot order is the safety mechanism

A slot is assigned by **input order** and always means the same entity. A
filter that drops a series, a sort that reorders it, or a value that
overtakes its neighbour mid-stream must never repaint the survivors —
otherwise a colour means "third largest right now" rather than naming a
thing. `PieChart` assigns from the input array for this reason, never from
the laid-out order the wedges end up in.

The **order of the hues themselves** is not cosmetic either. Colour-vision
deficiency collapses hue, so separation has to come from lightness: an
equal-lightness palette cannot be made safe by any means, which is why the
original pastel set failed (every hue sat near L 0.86, giving adjacent pairs
a deutan ΔE of 5.1 and a normal-vision ΔE of 9.1 against a floor of 15). The
current ramp varies lightness across slots, and the specific ordering is the
one that clears the separation gates in both themes.

Reordering the slots, or generating a ninth hue at runtime, breaks that
guarantee. A ninth series belongs in a rolled-up bucket (`groupThreshold` on
`PieChart`), in a second chart, or in small multiples.

## The adjacent-pair limit

The ramp is validated on the **adjacent** pairlist: slot 1 against 2, 2
against 3, and so on. That is the correct test for the charts here, because
adjacency is what a reader actually compares — neighbouring wedges around a
ring, neighbouring ribbons in a column, series listed in order.

It is **not** the whole story. A chart where any two marks can be compared
directly — a scatter, a bubble chart, a choropleth, small multiples, or a pie
where a reader compares two distant wedges — is governed by the *all-pairs*
list instead, and eight hues cannot clear the floors with all 28 pairs in
play. No ordering can: once every pair is on the list, the pairlist no longer
depends on order.

**Practical consequence.** Treat three slots as the all-pairs-safe budget.
Past that, on a chart form where distant marks get compared:

- fold the tail into a bucket (`groupThreshold`), or
- facet into small multiples, or
- carry identity with something other than colour as well — the direct labels
  both `PieChart` and `RadarChart` ship, a legend, or a texture.

## The contrast relief rule

Three light-mode slots sit below 3:1 contrast against the light surface. That
is a documented conditional, not a failure: it obliges **relief** — visible
direct labels or a table view — rather than a different colour.

Both charts satisfy it by default. `PieChart` labels every wedge above
`labelMinShare` with its name and share; `RadarChart` labels every axis, and
every series is a focusable button carrying its name and coverage in its
accessible name. A host that turns labels off (`labels="none"`, or
`labelWidth={0}`) takes on the obligation itself — a legend beside the chart
is the usual answer, and is what the gauge story does with its centre
readout.

## Changing the ramp

The values are generated and checked, not chosen by eye. To change them:

1. Edit both `packages/react/src/theme.css` and the `nessa-base` entry in
   `registry.json`; `pnpm validate` fails on `TOKEN-003` if they drift.
2. Re-run the categorical validator against **both** surfaces — light
   `oklch(1 0 0)` and dark `oklch(0.145 0 0)` — and clear the lightness band,
   chroma floor, adjacent CVD separation (ΔE ≥ 8), and the normal-vision
   floor (ΔE ≥ 15) in each. A contrast warning is the relief rule above, not
   a blocker.
3. Re-run `pnpm build:registry`, then `pnpm validate`.

Never reorder slots to make a validation run pass — re-step the lightness
instead. The order is the guarantee.
