---
name: foam-chart-builder
description: Use when adding a new chart type or changing an existing chart in foam.u2.chart (BarChart, LineChart, PieChart, donut), or a Reflow dashboard chart (DashboardPieSink, DashboardBarSink, DashboardStackedBarSink, DashboardLineSink, a Dashboard*ChartDAOAgent, agents.jrl chart row). Triggers on chart, graph, bar, line, pie, donut, legend, tooltip, axis, ticks, scale, SVG chart, chart colours, chart option, chart_ expression, onClickScript drill-down.
---

# FOAM chart builder

Charts in FOAM are SVG views in `src/foam/u2/chart/`. A Reflow dashboard reaches them through a sink whose `chart_` expression builds the view. Read the layer you are changing before you write code. Each layer has a hook made for extending it, so a change rarely needs more than one class and its test.

Invoke `foam-design-patterns` and `foam-view-builder` first. This skill adds what is special to charts.

## The layers, bottom up

| Layer | Files | What it owns |
|---|---|---|
| Scales | `LinearScale.js`, `BandScale.js`, `TimeScale.js` | value to pixel, nice ticks, tick labels; pure JS, no DOM |
| Data | `Dataset.js`, `LineDataset.js` | one series: `label`, `data`, `backgroundColor`, `borderColor`; line drawing options with their defaults |
| Base view | `ChartView.js` | legend, plot size, redraw, tooltip, colours, text measuring; calls `drawChart(svg, w, h)` |
| Axes | `CartesianChartView.js` | room for tick labels, turned x labels, grid, axis titles: `layout()`, `layoutForValues()`, `drawAxes()` |
| Chart types | `BarChart.js`, `LineChart.js`, `PieChart.js` | the marks, their hover and click |
| Kinds | `XAxisType.js`, `LegendPosition.js`, `TimeUnit.js` | enums whose values carry the behaviour |
| Path builder | `SVGPath.js` | `moveTo`, `lineTo`, `curveTo`, `arcTo`, `close` |
| Dashboard | `core/reflow/dashboard/DashboardSinks.js`, `DashboardDAOAgents.js`, `core/reflow/agents.jrl` | form fields, data grouping, the `chart_` expression, the picker entry |

`ChartView.render()` (`ChartView.js:178-220`) draws the legend, then a plot div with a ResizeObserver. Whenever `labels`, `datasets`, `hidden_` or the plot size changes, it rebuilds the `<svg>` and calls `drawChart`. So a chart type never subscribes to anything: it reads its properties inside `drawChart`.

## What you are changing, and where

| Change | Where | Hook or pattern |
|---|---|---|
| A new kind of chart | new class extending `ChartView`, or `CartesianChartView` when it has axes | `drawChart(svg, w, h)`; see `references/new-chart-type.md` |
| What the legend lists | the chart class | override `legendItems()` (`ChartView.js:230-236`); `PieChart.js:112-123` lists one entry per slice |
| Legend size on the side | the chart class | override `styleLegend(legend, vertical)` (`PieChart.js:125-131`) |
| Tooltip content | the chart class | build `rows` of `{ color, label, value }` and call `showTooltip(evt, title, rows, footer)` (`ChartView.js:298-331`) |
| A click on a mark | a `Function` property on the chart | `BarChart.onBarClick(datasetIndex, index, event)` (`BarChart.js:64-72`, `value: null`, called at `:172-177`) |
| A per-series drawing option | `Dataset`, or a subclass such as `LineDataset` | a property with its default in `value:` (`LineDataset.js:30-47`) |
| A chart-wide option | a property on the chart class | read it in `drawChart` |
| A new kind of axis, legend side or time step | the enum | a new value; the chart asks the value (`XAxisType.js:52-90`) |
| Tick spacing or label rules | `CartesianChartView` or the scale | named constants (`CartesianChartView.js:24-105`) |
| A dashboard form field | the sink | a property, a `sections` entry, a parameter of `chart_`; see `references/edit-existing.md` |
| A new chart in the flow picker | sink, agent, `agents.jrl` | `references/dashboard-wiring.md` |

## Rules

- **No magic numbers.** A number with a reason is a `constants:` entry. Its `documentation` gives the reason and one value (`PieChart.js:27-43`, `ChartView.js:31-57`). Plain math such as halving stays inline.
- **No hand-written path strings.** Build every `d` with `SVGPath` (`PieChart.js:158`).
- **Options are model properties.** A default goes in `value:`, never in `ds.x === undefined ? 3 : ds.x`. `datasets` is an `FObjectArray`, so a caller's plain `{ label, data }` becomes a `Dataset` (`ChartView.js:126-131`).
- **Kinds are enum values with Function properties,** not string compares. `XAxisType` has `toX`, `range`, `scale` and `tickLabel`; `LineChart` only calls them (`LineChart.js:118-123`).
- **Mark colours go in SVG attributes, resolved.** Use `seriesColor(i, j)` or `defaultColor(i)`, which turns a token like `$primary400` into its value (`ChartView.js:240-253`). An attribute keeps the colour in a PDF or image export.
- **Text, grid and axis colours come from CSS tokens** in the class's `css:` (`ChartView.js:86-90`), so they follow a light or dark theme. `CSSAuditTest` fails a hard-coded colour or font value in `css:` (`core/theme/test/CSSAuditTest.js:432-440`). Use tokens such as `$textSecondary` and `$font-medium`.
- **Dates on a time axis go through `TimeScale` and `TimeUnit`,** which can read dates in UTC (`LineChart.js:85-89`). Never group by `getMonth()`.
- **Animate in CSS only.** Use the `<<animated` class, inside `@media (prefers-reduced-motion: no-preference)` (`BarChart.js:40-53`). `ChartView` drops the class after the first draw, so a resize or a legend click does not replay it (`ChartView.js:184-188`).
- **Hidden series:** check `isHidden(i)` while drawing. Never splice `datasets`, because the legend index must stay the dataset index.
- **Saved flows hold class and property names.** A flow stores the agent class and its props. Never rename a `Dashboard*ChartDAOAgent`, a `Dashboard*Sink` or a saved property. Keep an old name working with a setter shim on the agent (`DashboardDAOAgents.js:519-570`).
- **A dashboard sink keeps its rows in plain arrays or objects, `transient`,** never a `Map` or `Set`: a select can send the sink as JSON and back, and a `Map` returns as `{}` (`references/dashboard-wiring.md`).
- **A dashboard chart is done when it draws in a running flow.** Unit tests run every sink in the browser; a flow sends it as JSON and a grouping sink runs in Java on the server. So a sink can pass every test and still fail in a flow: a JS `Map` in its state, a grouping field without Java, a date expression on a number field.
- **A new dashboard chart matches its siblings:** a no-data message, axis titles from the field labels, an On Click Script, rows with an empty series left out, numbers only on a value axis (`references/dashboard-wiring.md`, "Match the sibling charts").
- **A new file gets a pom row** in `src/foam/u2/chart/pom.js` with `flags: 'web'`, in dependency order: base before subclass.

## References

- `references/new-chart-type.md`: the recipe for a new chart type, step by step, following `PieChart`.
- `references/edit-existing.md`: adding an option, changing the legend or tooltip, keeping old flows loading.
- `references/dashboard-wiring.md`: sink, agent and `agents.jrl` for a chart in the flow picker.
- `references/testing.md`: `ChartViewTest`, `ChartScaleTest`, the dashboard tests and the manual check.
