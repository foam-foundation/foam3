# A new chart type

Follow `src/foam/u2/chart/PieChart.js`. It is the smallest complete chart: no axes, one legend entry per value, a tooltip, a legend hover, and an animation.

## 1. Pick the base

- **`ChartView`** when the chart has no axes: a pie, a gauge or a treemap. You get the legend, size, tooltip and colours. You do not get `label_()`, the cut-to-fit text helper, which is on `CartesianChartView` only (`CartesianChartView.js:232`); write labels with `truncate(s, maxPx)` (`ChartView.js:298`).
- **`CartesianChartView`** when values sit against an x and a y axis: a scatter, an area or a heatmap. You also get `layout()`, `layoutForValues()` and `drawAxes()` (`CartesianChartView.js:120-239`).
- **An existing chart type** when the new one is a variant of it. A stacked bar is `BarChart` with `stacked: true`, not a new class.
- **A subclass of a chart** when the new one adds to it: a bubble is a scatter whose dots have a size. Override small hook methods the parent calls (how to read a point, a dot's radius, the tooltip rows) instead of copying its `drawChart`; add those hooks to the parent if it has none. The parent's `css:` is expanded again under the subclass's own name, so `<<dot` becomes `.foam-u2-chart-BubbleChart-dot` (`u2/CSS.js:76-80`, one copy per `cls.id`), and `myClass()` returns the subclass's name, never the parent's (`u2/Element2.js:947-960`). A test passes the subclass view: `this.all(el, bubble, 'dot')`. A chart that keeps the parent's marks but reads its data another way overrides the parent's data hook: a sunburst extends `PieChart` and overrides `values_()` (`PieChart.js:95`), and the inherited legend, percentages and colours follow.

Ask first whether a property on an existing chart does the job. A donut is `PieChart` with `cutout` set (`PieChart.js:62-66`).

## 2. Skeleton

```js
foam.CLASS({
  package: 'foam.u2.chart',
  name: 'ScatterChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    One dot per { x, y } point, one colour per dataset. Hovering a dot shows
    its series, x and y.
  `,

  requires: [ 'foam.u2.chart.LinearScale' ],

  constants: [
    {
      name: 'DOT_PX',
      documentation: 'Radius of a dot, in pixels: big enough to hover, small enough that 500 points stay apart.',
      value: 4
    }
  ],

  css: `
    <<dot:hover { filter: brightness(0.92); }
  `,

  methods: [
    function drawChart(svg, w, h) {
      // Read the properties here. ChartView calls this again on every data,
      // size or legend change, so nothing needs to subscribe.
    }
  ]
});
```

## 3. drawChart

1. **Keep only the visible series:** `this.datasets.map((ds, i) => ({ ds, i })).filter(s => ! this.isHidden(s.i))` (`BarChart.js:79-84`). Keep `i`, the dataset index, for colours and the legend.
2. **Work out the domain and build the scales.**
   - **One category axis and one value axis** (bars, lines): call `layoutForValues(w, h, catLabels, horizontal, makeScale, listTicks)` (`CartesianChartView.js:151-167`). It sizes the value axis from the plot size and returns `{ area, scale }`.
   - **Two value axes** (a scatter): `layoutForValues` sizes only one and cannot be reused. Call `layout(w, h, xLabels, yLabels)` (`CartesianChartView.js:120-148`) yourself, twice, copying its two-pass logic. The first pass uses `FIRST_LAYOUT_TICKS` steps on both axes. The second uses the tick counts that the first pass's plot size allows. x labels are wider than y labels, so give the x axis its own spacing constant: `VALUE_TICK_PX` (40) crowds them.
   - `layout()` returns `{ left, top, width, height, rotate, every, xMax, yMax, w, h }`, and `drawAxes` needs all of it.
   - A `LinearScale` needs `min`, `max` and `tickCount` before `nice()` and `ticks()` (`LinearScale.js:13-15`). It also needs `start` and `end`, the pixel ends, before `map()`. Point the scales at the plot area: `scale.start = area.top + area.height; scale.end = area.top` (`BarChart.js:116-122`).
3. **Draw the axes:** `this.drawAxes(svg, area, xTicks, yTicks)`, with ticks as `[{ pos, label }]` in pixels (`BarChart.js:124-126`).
4. **Draw the marks** inside `svg.start('g') ... .end()`.
   - Add a class with `self.myClass('dot')`, so tests and CSS can find them.
   - Give the colour as an attribute: `.attrs({ fill: self.seriesColor(s.i, j) })`.
   - Build a path with `self.SVGPath.create().moveTo(...).lineTo(...).close()`; the result goes in `d`.
   - **An arc of a full turn draws nothing:** its start and end are the same point. Split a sweep near a full turn in two, as `slicePath` does (`PieChart.js:164-169`). A whole ring with nothing cut from it is a `circle` element, not a path.
   - **Text on a mark** picks dark or light with `foam.Color.getBestForeground(fill, dark, light)` (`color/colorlib.js:287`), the two colours read from text tokens so a theme switch follows. Fit text to the mark's width at the text's own top and bottom lines: on a tapered mark, the narrow end alone hides labels that fit.
5. **Hover.** Use `.on('mousemove', evt => self.showTooltip(evt, title, rows, footer))` and `.on('mouseleave', self.hideTooltip)`. Each row is `{ color, label, value }`, written as "label: value", with the value passed through `formatValue`, which keeps at most `MAX_DECIMALS` (2) digits after the point (`ChartView.js:310`).
   - When `showTooltipSum` is on, the footer is `this.sumLine(values)`.
   - **Small or overlapping marks** need a bigger target, so the pointer always lands on something:
     - with categories, put one transparent hit shape per category on top, as `BarChart` does (`BarChart.js:159-177`);
     - with free points such as dots, give each mark a wide transparent stroke (`stroke: transparent; stroke-width: 8px`).
     - never one transparent shape over the whole chart: it takes every pointer event, so a test or script that looks for the mark under the pointer never finds it. Put the handlers on the marks.
6. **Click.** Declare a `Function` property with `value: null`, for example `onPointClick(datasetIndex, index, event)`, and call it only when it is set. Without `value: null` it defaults to an empty function (`lang/types.js:471-472`), so a `<<clickable` class bound to `onX$.map(f => !! f)` would show the pointer on a chart nobody can click (`BarChart.js:36-38`, `:64-72`, `:79`).

Value ticks come from `LinearScale.nice()`, which rounds the step up to 1, 2 or 5 times a power of ten (`LinearScale.js:75`). So 0 to 100 asked for 4 steps gets a step of 50 (0, 50, 100), not 25. In a test, read the ticks the scale returns; do not work them out by hand.

- **A count axis with small counts** gets a step under 1: 0 to 2 asked for 5 steps gets a step of 0.5, and the axis reads 0.5 and 1.5. Ask for at most `max` steps, so the step stays a whole number.
- **A flat range** (every value 5) is widened by `FLAT_SPREAD` on both sides (`LinearScale.js:65-71`), so the axis does not start at 0.
- **A scale with its own step** needs no `nice()`: set `min`, `max` and `step`, and `ticks()` uses that step as given (`LinearScale.js:89-99`).

## 4. Legend

- **Default:** one entry per dataset, and a click hides that dataset.
- **One entry per value, as on a pie:** override `legendItems()` to return `[{ label, color, hidden }]`, and check `isHidden(j)` per value while drawing (`PieChart.js:112-123`). Colour each value with `valueColor(j)` (`ChartView.js:257`): override `seriesColor` to return it, as `PieChart` does (`PieChart.js:133-136`), so the legend and the marks agree.
- **A side legend needing a width:** override `styleLegend` (`PieChart.js:125-131`).
- **A colour scale instead of entries,** as on a heatmap: return `[]` from `legendItems()` and draw the scale inside `styleLegend(legend, vertical)`, which runs on the legend element (`ChartView.js:206`, `:226-232`).
- **Something on legend hover:** override the `onLegendHover(i, evt)` listener. It gets `-1` when the pointer leaves (`PieChart.js:203-210`).

## 5. Animation

Put a keyframe on the marks' group under `<<animated`, inside `prefers-reduced-motion: no-preference` (`PieChart.js:49-57`). Name the keyframes after the class, for example `foam-u2-chart-ScatterChart-pop`, so two charts never share one.

## 6. Wire it in

- **Pom row:** add `{ name: 'ScatterChart', flags: 'web' }` to `src/foam/u2/chart/pom.js`, after its base class. An enum that a dashboard sink holds travels to the server, so its row is `js|java`, as `TimeUnit` and `LegendPosition` are (`pom.js:16-17`); an enum only the view reads stays `web`.
- **License header:** the same as the files next to it.
- **Test:** add a case to `test/ChartViewTest.js` (`references/testing.md`).
- **Dashboard:** to offer it in a flow, see `references/dashboard-wiring.md`.

## Checklist

- [ ] every tuning number is a documented constant
- [ ] every path is built with `SVGPath`
- [ ] colours come from `seriesColor` or `defaultColor`, and text colours from CSS tokens
- [ ] hidden series are skipped by `isHidden(i)`, and the indexes stay the dataset indexes
- [ ] the tooltip rows use `formatValue`
- [ ] no message shares a name with an inherited method (`IN`, `OUT`): it replaces the method, and the only sign is "Change of Axiom … type from Method to MessageAxiom" in the test log
- [ ] no message shares a name with a constant FOAM makes: a property `target` makes the constant `TARGET`, and a message `TARGET` stops the class with "Class constant conflict"; every u2 view implements `foam.mlang.Expressions` (`u2/Element2.js:485-486`), so `COUNT`, `SUM`, `MAX`, `MIN` and the other query helpers are methods on every chart: end a message name in `_LABEL` (`ChartView.SUM_LABEL`); `DAYS`, `HOURS` and `MINUTES` are taken too (`mlang/Expressions.js:183-186`)
- [ ] every new name is free on the class and its bases: a property `layout` on a bar chart hides `CartesianChartView.layout()`, and an enum property `stacked` makes the constant `STACKED`, which clashes with an enum value `STACKED`. Check with `Cls.getAxiomByName(name)` before using a name
- [ ] a property's "was it set" test in JS is `hasOwnProperty(name)` (`lang/FObject.js:449`); `isPropertySet` exists in Java only
- [ ] shades that stand for no series (bands, a track behind a value) come from the grey tokens `$grey200` to `$grey600` (`u2/CSSTokens.js:73-77`), not hex
- [ ] an x axis from `XAxisType` gets what its scale reads from the chart: `LINEAR` reads `isSet_` and `xMin`, `TIME` reads `TIME_TICK_PX`, `timeUnit` and `utc`, and both create `chart.LinearScale` or `chart.TimeScale`, so list those in `requires` (`XAxisType.js:62-86`); only `LineChart` declares them, so copy them
- [ ] the class documentation says what one mark means, and gives one example
