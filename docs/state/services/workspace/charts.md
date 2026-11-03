---
id: "ui-charts"
title: "Charts and values"
kind: "contract"
status: "implemented"
summary: "Charts draw data supplied by a host. The library computes layout and interaction geometry, while the host owns units, labels, ordering and what a number means."
parent: "ui-workspace"
sources:
  [
    "packages/react/src/lib/chart-geometry.ts",
    "packages/react/src/components/sparkline.tsx",
    "packages/react/src/components/proportion-bar.tsx",
    "packages/react/src/components/chart-tooltip.tsx",
    "packages/react/src/components/price-chart/index.ts",
    "packages/react/src/components/stock-quote.tsx",
    "packages/react/src/components/flow-chart/index.ts",
    "packages/react/src/components/radar-chart/index.ts",
    "packages/react/src/components/pie-chart/index.ts",
    "packages/react/src/components/activity-rings/index.ts",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Display data with explicit meaning

Charts draw data supplied by a host. The library computes layout and interaction geometry, while the host owns units, labels, ordering and what a number means.

| Family                          | Intended view                                              |
| ------------------------------- | ---------------------------------------------------------- |
| PriceChart and StockQuote       | A supplied price series, quote and selected range          |
| Sparkline                       | Small step or line series, optional markers/reference/area |
| ProportionBar and PieChart      | Parts of a supplied whole                                  |
| RadarChart                      | Values across named axes                                   |
| ActivityRings                   | Progress around rings                                      |
| FlowChart                       | Supplied relationships and their layout                    |
| ChartTooltip                    | A hover card constrained to a named boundary               |
| Stat, Delta, Meter, StatusLabel | Compact numerical/status presentation                      |

Chart geometry is framework-free and exported: axis ticks, scales, polylines, best-so-far steps, weights and tooltip placement can also serve host-built charts. The test suite exercises deterministic geometry for these families. None of those tests verifies the correctness of market data, a finance calculation, or the accuracy of a host label.

Price/history range selection must be wired to host data loading. ProportionBar can use logarithmic weights to keep small parts visible; that changes visual allocation, so keep the accessible/visible value labels truthful. Theme-aware chart ramps supply colors, and hosts overriding colors remain responsible for contrast. These are value/geometry contracts, so this atlas does not invent a runtime lifecycle or TLA model for each chart.
