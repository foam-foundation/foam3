# A chart in the Reflow flow picker

Three pieces put a chart in a flow:
1. A **sink** collects the rows and builds the view.
2. An **agent** holds the sink's form and gives each run a fresh sink.
3. A **row** in `agents.jrl` lists the agent in the picker.

Copy the pie: `DashboardPieSink` (`core/reflow/dashboard/DashboardSinks.js:251-441`) and `DashboardPieChartDAOAgent` (`DashboardDAOAgents.js:497-585`).

## 1. The sink (DashboardSinks.js)

- **`extends`:** the grouping sink whose result the chart draws.
  - `foam.mlang.sink.TopNGroupBy` gives one value per group (bar, pie).
  - `foam.core.reflow.GridBy` gives a value per row and column (stacked bar, multi-line).
- **`mixins`:** `ChartDisplayMixin` adds the shared form fields: height, legend, tooltips and animation. `ColorMappingMixin` adds `colors`.
- **`requires`:** the chart view, for example `foam.u2.chart.PieChart`.
- **Form fields:**
  - The field to group by is a `foam.core.reflow.dashboard.ChartFieldProperty` (`ChartFieldProperty.js:7-20`). It holds a property of the data or an expression on one.
  - Hide the grouping sink's internal properties with `{ name: 'arg2', hidden: true }` (`DashboardSinks.js:320-323`).
- **`sections`:** group the form into Data, chart settings, Display and Colors (`DashboardSinks.js:263-272`).
- **`chart_`:** a hidden, transient `expression` (`DashboardSinks.js:342-398`).
  - Its parameters are every property that should rebuild the chart.
  - It turns the groups into `labels` and `datasets` and resolves each colour with `foam.CSS.returnTokenValue`.
  - It returns `this.PieChart.create({...})`.
- **`addToE` and `toE`:** they place `chart_` in the page, with an empty-data message when there are no groups (`DashboardSinks.js:402-439`).
- **Click handler:** a drill-down script from the form becomes a click handler in `chart_`. On the stacked bar, `onClickScript` is called with `(yValue, xValue, stackValue, x, y, pageX, pageY)` (`DashboardSinks.js:619-630`).

### A chart with one mark per row

A chart with one mark per row (a scatter, a calendar) does no grouping. Copy `DashboardCalendarSink` and its agent `DashboardCalendarChartDAOAgent` instead (`DashboardSinks.js:1765-1892`, `DashboardDAOAgents.js:802-885`):
- **The sink extends `foam.dao.AbstractSink`.** Its `put(obj)` reads the fields with `.f(obj)` and keeps what it needs in a plain object.
- **Its fields carry `generateJava: false`.** `DashboardSinks.js` is built for Java too, and this `put` has no Java (`DashboardSinks.js:1798-1800`).
- **It creates the chart once** (`chart_` is a factory) and fills it in `addToE` after the select finishes, not from an expression.
- **A shared switch the chart does not use:** `ChartDisplayMixin` adds switches such as `showTooltipSum`. A mixin's properties install after the class's own, so an override cannot hide them. Put them in a section that is never shown: `{ name: 'unused', isAvailable: function() { return false; }, properties: [...] }` (`DashboardSinks.js:1786-1790`).
- **Its agent extends `GroupByDAOAgent`,** the same as the calendar's. Its inherited `prop` becomes a shim with `validateObj: null`, so the form checks the field (`DashboardDAOAgents.js:825-827`).

## 2. The agent (DashboardDAOAgents.js)

- **`extends`:** `foam.core.reflow.GroupByDAOAgent` (or `GridByDAOAgent`, or `AbstractSinkDAOAgent`), to match the sink.
- **`displaySink`:** an `FObjectProperty` of the sink, with `hidden: true` and `autoValidate: true`. Its factory creates an empty sink (`DashboardDAOAgents.js:508-516`). An empty required field turns Run off.
- **`createSink()`:** returns a new copy on every run, `this.displaySink.clone(this)`, then calls `buildTotal_()` (`DashboardDAOAgents.js:573-577`). The flow runs the same agent again when the query or the data changes, so a reused sink counts twice (`DashboardDAOAgents.js:375-381`). Call `buildTotal_()` even when the chart has no Sum or Count: with no aggregation it builds a Count (`DashboardDAOAgents.js:245-248`).
- **`addToE`:** shows the form with `ReactiveSectionedDetailView` over `displaySink$`.
- **Shims:** only for names that flows saved before. A new chart has none.

## 3. The picker row (core/reflow/agents.jrl)

```
p({"class":"foam.core.reflow.SinkAgent", "id": <next free id>, "label":"Scatter Chart", "value":"foam.core.reflow.dashboard.DashboardScatterChartDAOAgent", "sink":true, "type":"chart", permissionRequired: true})
```

- **`id`:** one above the highest id in the file. Never fill a gap: a removed agent's id can still be granted in some deployment's permissions.
- **`permissionRequired: true`:** a user then needs `agent.read.<id>` to see the chart (`SinkAgent.js:55-66`). Grant it where the other chart agents are granted.
- **`type: "chart"`:** files it with the other charts. The aggregation picker inside a chart form also hides `chart` types (`disabledTypes`, `DashboardSinks.js:299`).

## 4. Pom

- `DashboardSinks` and `DashboardDAOAgents` are already listed (`core/reflow/dashboard/pom.js:14-15`).
- A new sink or agent class in those files needs no pom change.
- A new file needs its own row.
