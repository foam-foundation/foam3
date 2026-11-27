# Changing an existing chart

## Add an option

1. **The view.** Add a property to the chart class, or to `Dataset` or `LineDataset` when it differs per series.
   - Give it `documentation` that says what it does in one example. Put the default in `value:`.
   - Read it in `drawChart`. A redraw happens on its own when `labels`, `datasets`, `hidden_` or the size change (`ChartView.js:217-224`).
   - **An option that changes after the first draw:** the base view does not watch other properties. Read it inside a `dynamic` of your own, or have the dashboard rebuild the chart. A sink's `chart_` expression builds a new view whenever one of its parameters changes.
2. **The dashboard form,** if a flow should set it. In the sink (`core/reflow/dashboard/DashboardSinks.js`):
   - Add a property with a `label`. Add `help` when the name does not say enough.
   - Add its name to one of the `sections` (`DashboardSinks.js:263-272` on the pie).
   - Add it as a parameter of the `chart_` expression and pass it to `create` (`DashboardSinks.js:343-398`).
   - A field shared by every chart (legend, tooltips, height, animation) goes in `ChartDisplayMixin` instead (`DashboardDAOAgents.js:134-345`).
3. **A test.** Add a case to `ChartViewTest`, plus `DashboardChartRenderTest` when the form field was added (`references/testing.md`).

## Rename, move or drop an option

A saved flow holds the agent class, and the props it had when it was saved. Old flows must keep loading.

- **Never rename** a `Dashboard*ChartDAOAgent`, a `Dashboard*Sink` or a saved property. A flow saved with the old name fails to load.
- **Moved to the sink form:** keep the old name on the agent as a hidden, transient, setter-only shim that forwards the value (`DashboardDAOAgents.js:587-638`):
  ```js
  { name: 'cutoutPercentage', hidden: true, transient: true,
    setter: function(v) { this.displaySink.cutoutPercentage = v; } }
  ```
- **Dropped:** keep the name as a shim that ignores the value, so old flows still parse. `DashboardAgentShimTest` covers the shims.
- **Added to the sink only:** a new sink property with a `value:` needs no agent shim. A flow saved before has no value for it and loads with the default, which should draw as before.
- **A switch turned into a choice** (a Boolean into an enum): keep the old name as a `transient` property with a `getter` that reads the new one and a `setter` that writes it, so callers and saved flows that set the old name still work.
- **A Chart.js-era name** that a sink still accepts maps onto the view property in `chart_`. Keep the sink name and map it, for example the sink's `cutoutPercentage` to the view's `cutout`.

## Change what is drawn

| To change | Edit |
|---|---|
| bar width, gap, stacking | `BarChart.drawChart` (`BarChart.js:128-157`) |
| line shape: tension, steps, fill, dots | `LineDataset` properties, then `LineChart.drawChart` |
| stacked lines | `LineChart.stack_`: every line gets a point at every x, its y the running total and `own` its value; bands are drawn top-first and opaque, each down to the axis, so the lower band covers the upper one |
| pie slices, hole, start angle | `PieChart.drawChart` and `slicePath` (`PieChart.js:138-161`) |
| tick count, tick spacing, label turning | constants in `CartesianChartView` (`CartesianChartView.js:26-107`) |
| tick labels for dates | `TimeUnit` and `TimeScale` |
| how a kind of x axis behaves | its value in `XAxisType` (`XAxisType.js:52-90`) |
| tooltip text | the chart's `show*Tooltip_` method, which builds rows for `showTooltip` |
| percentages on a pie | `PieChart.percent` (`PieChart.js:105-110`) |
| default series colours | `ChartView.DEFAULT_COLORS` (`ChartView.js:37-41`), as theme tokens |
| legend look | `ChartLegend` CSS (`ChartLegend.js:20-51`) |

## Change a dashboard's grouping or totals

This belongs to the sink, not the view.
- The sink groups rows: `TopNGroupBy` for a bar or pie, `GridBy` for a stacked bar or multi-line.
- `chart_` turns the groups into `labels` and `datasets`.
- The sink totals with `buildTotal_()`, using the form's Sum or Count (`DashboardDAOAgents.js:265-274`).

A wrong total is fixed in the sink. A wrong picture of a right total is fixed in the view.
