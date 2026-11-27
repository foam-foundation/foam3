# A chart in the Reflow flow picker

Three pieces put a chart in a flow:
1. A **sink** collects the rows and builds the view.
2. An **agent** holds the sink's form and gives each run a fresh sink.
3. A **row** in `agents.jrl` lists the agent in the picker.

Copy the pie: `DashboardPieSink` (`core/reflow/dashboard/DashboardSinks.js:251-441`) and `DashboardPieChartDAOAgent` (`DashboardDAOAgents.js:497-585`).

## 1. The sink (DashboardSinks.js)

- **`extends`:** the grouping sink whose result the chart draws.
  - `foam.mlang.sink.TopNGroupBy` gives one value per group, keeps the top N by value and folds the rest into "Others" (bar, pie).
  - `foam.mlang.sink.GroupBy` gives one value for every group, in key order: for a chart whose order is the key's, such as hours on a waterfall.
  - `foam.core.reflow.GridBy` gives a value per row and column (stacked bar, multi-line). A chart keyed by two fields, such as a heatmap, copies `DashboardStackedBarSink` and its agent (`DashboardSinks.js:446`, `DashboardDAOAgents.js:396`).
  - **Every raw value per group** (a box plot needs the numbers, not a total): a `GridBy` whose accumulator is a `foam.mlang.sink.Plot`. `Plot` keeps each value as a one-entry list `[ value ]` and has Java, so it runs on the server (`mlang/sink/Plot.js:9-35`).
  - A date field groups through the expressions in `foam/mlang/expr/DateTo*Expr.js`: hour (`DateToHHExpr`), day, week, month, quarter, year and day of year. There is no day of the week. The hour is zero-padded ("08"), so sorted keys are in hour order (`DateToHHExpr.js:33`).
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

A grouping sink (`GroupBy`, `GridBy`) is `Serializable`, so the select runs it on the server, in Java (`core/reflow/GridBy.js:14-17`, its `put` has `javaCode` at `:99-104`). A `put` overridden in JS never runs there. Leave out unwanted keys, such as an empty category, where the sink's result becomes the chart (`chart_`), or in the query. The fields that `put` reads (`xFunc`, `yFunc` on a `GridBy`) need their Java: a field redeclared with `generateJava: false` is left out of the Java class, so the server groups by nothing and the chart says "No data" while every client test passes. `generateJava: false` is right only on form-only fields such as `aggregation` and on a sink that never runs on the server (`DashboardLineSink`'s `yFunc` is read only after the agent swaps in the multi-line sink).

**A Serializable sink comes back as the server's copy.** The client draws the copy the server returns, and that copy holds only the fields its Java class has. So every field `chart_` reads needs Java on such a sink, including the class an `FObjectArray` holds (its pom row needs a Java flag, not `web`). A form-only field such as `aggregation` is fine without Java only while `chart_` does not read it; name the value from the total's own `arg1` instead.

**Every field that changes the result must show in the sink's `toString`.** A client DAO caches a select for minutes, keyed on the sink's `toString` (`dao/TTLSelectCachingDAO.js:88`). `GridBy` prints its accumulator (`core/reflow/GridBy.js:114-118`), so an accumulator without its own `toString` prints only its class name: two runs over different value fields share one key, and the chart redraws the old field. Give such a sink a `toString` that names its args, as `GroupBy` does (`mlang/sink/GroupBy.js:211-216`); `TopNGroupBy` already names its Top N settings (`mlang/sink/TopNGroupBy.js:241-243`). `ChartDisplayMixin` has its own `toString` (`DashboardDAOAgents.js:237`), and a mixin's methods install after the class's own, so a sink's `toString` goes on a parent class, not on the sink. A default that differs from the mixin's (`showLegend: false`) goes in the agent's `displaySink` factory for the same reason.

**No `messages:` on `ChartDisplayMixin`.** Some sinks reach it twice (directly and through `LineChartMixin`, `DashboardSinks.js:682-686`), a mixin installs its axioms again on every path (`lang/Mixin.js:30`), and a message's getter is not configurable (`i18n/Messages.js:156-162`), so the class fails to build with "Cannot redefine property". Put a shared message on the chart view, such as `ChartView`.

### A chart with one mark per row

A chart with one mark per row (a scatter, a calendar) does no grouping. Copy `DashboardCalendarSink` and its agent `DashboardCalendarChartDAOAgent` instead (`DashboardSinks.js:1765-1892`, `DashboardDAOAgents.js:802-885`):
- **The sink extends `foam.dao.AbstractSink`.** Its `put(obj)` reads the fields with `.f(obj)` and keeps what it needs in a plain object or array.
- **The rows it keeps are plain arrays or objects, marked `transient`.** A select can copy the sink and send it to the server as JSON and back. A JS `Map` or `Set` comes back as `{}`, and the next `put` fails with "this.series_.has is not a function", in a live flow only: a unit test that never sends the sink passes. `transient` keeps one run's points out of the saved flow. Calendar keeps `map_` as a plain object (`DashboardSinks.js:1821`). Test it with a JSON round trip: `foam.json.parseString(foam.json.stringify(agent.createSink()), x)`, then select into the copy.
- **Its fields carry `generateJava: false`.** `DashboardSinks.js` is built for Java too, and this `put` has no Java (`DashboardSinks.js:1798-1800`).
- **It creates the chart once** (`chart_` is a factory) and reads it in `addToE` after the select finishes, not from an expression. A factory that builds the datasets from the kept rows is enough: when a sink has both, the page calls `addToE` and never `toE` (`u2/Element2.js:1356-1362`).
- **A shared switch the chart does not use:** `ChartDisplayMixin` adds switches such as `showTooltipSum`. A mixin's properties install after the class's own, so an override cannot hide them. Put them in a section that is never shown: `{ name: 'unused', isAvailable: function() { return false; }, properties: [...] }` (`DashboardSinks.js:1786-1790`).
- **Its agent extends `AbstractSinkDAOAgent`,** as the line chart's does (`DashboardDAOAgents.js:592-593`). It needs no shim. The calendar's agent extends `GroupByDAOAgent` only because it existed before, so its inherited `prop` needs a shim with `validateObj: null` (`DashboardDAOAgents.js:825-827`).

- **A sink for a chart subclass extends the parent's sink** and overrides the same kind of small hooks. A property redeclared with only the keys that change (`help`, `label`) keeps the parent's class and settings: FOAM clones the parent's property and copies the new keys over it (`lang/Property.js:351-357`, `:714-728`). Redeclared with another `class:`, it replaces the parent's whole. A `sections` entry with the parent's section name replaces that section, so list all of its properties again.

### Match the sibling charts

Every new sink gives a user what the existing charts already give. Unit tests pass without any of these, so check each one:
- **No rows, no axes.** Show a message in place of the chart, `emptyValueMessage` on the form, as the pie does (`DashboardSinks.js:339`, `:402-439`). Empty axes from 0 to 1 tell the user nothing.
- **Axis titles fall back to the field's label** (a chart with axes) when none is typed: "Amount", not a blank axis (`DashboardSinks.js:826`).
- **A clickable chart gets an On Click Script** on the form, a `Code` property, turned into the chart's click handler (`DashboardSinks.js:490`, `:619-630`). Document its arguments in the property's `help`.
- **A row with an empty category or series value is left out,** as the calendar does (`DashboardSinks.js:1837`), not drawn as a series called "undefined".
- **A value axis takes numbers only.** Check `typeof v === 'number'`: `isFinite()` also passes a date, `''` and `true`, so a date field would plot as milliseconds since 1970.

Test each of these in `DashboardChartRenderTest`, over rows that have a missing value and a date field.

## 2. The agent (DashboardDAOAgents.js)

- **`extends`:** `foam.core.reflow.AbstractSinkDAOAgent` for a new chart. `GroupByDAOAgent` and `GridByDAOAgent` carry setter shims for flows saved before; a new agent has none to keep.
- **`displaySink`:** an `FObjectProperty` of the sink, with `hidden: true` and `autoValidate: true`. Its factory creates an empty sink (`DashboardDAOAgents.js:508-516`). An empty required field turns Run off.
- **`createSink()`:** returns a new copy on every run, `this.displaySink.clone(this)`, then calls `buildTotal_()` (`DashboardDAOAgents.js:573-577`). The flow runs the same agent again when the query or the data changes, so a reused sink counts twice (`DashboardDAOAgents.js:375-381`). Call `buildTotal_()` when the chart shows a value per mark: with no aggregation picked it builds a Count (`DashboardDAOAgents.js:245-248`). A chart that plots row values as they are, such as a scatter, has no total and skips it.
- **`addToE`:** shows the form with `ReactiveSectionedDetailView` over `displaySink$`.
- **Shims:** only for names that flows saved before. A new chart has none, and its flows save the form as `displaySink: {...}`.

## 3. The picker row (core/reflow/agents.jrl)

```
p({"class":"foam.core.reflow.SinkAgent", "id": <next free id>, "label":"Scatter Chart", "value":"foam.core.reflow.dashboard.DashboardScatterChartDAOAgent", "sink":true, "type":"chart", permissionRequired: true})
```

- **`id`:** one above the highest id in the file. Never fill a gap: a removed agent's id can still be granted in some deployment's permissions.
- **`permissionRequired: true`:** a user then needs `agent.read.<id>` to see the chart (`SinkAgent.js:55-66`). foam3 grants none of these; each app grants them to the group that builds dashboards. Tell the app's owners the new id, or the chart stays hidden there for everyone but admins.
- **`type: "chart"`:** files it with the other charts. The aggregation picker inside a chart form also hides `chart` types (`disabledTypes`, `DashboardSinks.js:299`).

## 4. Text and the demo flow

- **Translations:** each new `messages:` entry gets a French row in `src/foam/i18n/fr_fr/locales.jrl`, as `ChartView.SUM` has (`locales.jrl:988`).
- **The `ChartDemo` flow** in `core/reflow/dashboard/flows.jrl` shows every chart type. Its `"script"` is one JSON string holding the flow's compact JSON, with every quote escaped (`flows.jrl:12`). Add a block by editing that string; keep it on one line. The file holds more than one flow and each row spans several lines: ChartDemo's script is the first `"script":` line after `"name":"ChartDemo",`, not the first in the file. Read and write the script in Python: `v = json.loads(json.loads('"' + raw + '"'))`, change `v`, then write back `json.dumps(json.dumps(v, separators=(',', ':'), ensure_ascii=False), ensure_ascii=False)[1:-1]`.
- **Demo data must vary on a fresh server.** Every `om1MinuteDAO` row is a counter, so its `average` is always 1: a scatter of count against average draws a flat line. Check the two fields on a running server before you pick them.
- **Count of rows can be the same everywhere.** `om1MinuteDAO` holds one row per key per minute, so counting its rows per hour gives the same number in every cell. Sum a value instead, such as `Candlestick.count`.
- **A date expression needs a date field.** `LogMessage.created` is a `Long` (`core/logger/LogMessage.js:48-51`), so `DateToHHExpr` on it fails on the server with "java.lang.Long cannot be cast to java.util.Date". Use a `Date` or `DateTime` field, such as `Candlestick.closeTime` (`core/analytics/Candlestick.js:66-68`).

## 5. Pom

- `DashboardSinks` and `DashboardDAOAgents` are already listed (`core/reflow/dashboard/pom.js:14-15`).
- A new sink or agent class in those files needs no pom change.
- A new file needs its own row.
