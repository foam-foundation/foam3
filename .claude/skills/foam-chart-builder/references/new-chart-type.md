# A new chart type

Follow `src/foam/u2/chart/PieChart.js`. It is the smallest complete chart: no axes, one legend entry per value, a tooltip, a legend hover, and an animation.

## 1. Pick the base

- **`ChartView`** when the chart has no axes: a pie, a gauge or a treemap. You get the legend, size, tooltip and colours.
- **`CartesianChartView`** when values sit against an x and a y axis: a scatter, an area or a heatmap. You also get `layout()`, `layoutForValues()` and `drawAxes()` (`CartesianChartView.js:120-232`).
- **An existing chart type** when the new one is a variant of it. A stacked bar is `BarChart` with `stacked: true`, not a new class.

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
   - **Two value axes** (a scatter): `layoutForValues` sizes only one. Call `layout(w, h, xLabels, yLabels)` (`CartesianChartView.js:120-148`) yourself, twice. The first pass uses `FIRST_LAYOUT_TICKS` steps on both axes. The second uses the tick counts that the first pass's plot size allows. x labels are wider than y labels, so give the x axis its own spacing constant: `VALUE_TICK_PX` (40) crowds them.
   - `layout()` returns `{ left, top, width, height, rotate, every, xMax, yMax, w, h }`, and `drawAxes` needs all of it.
   - A `LinearScale` needs `min`, `max` and `tickCount` before `nice()` and `ticks()` (`LinearScale.js:13-15`). It also needs `start` and `end`, the pixel ends, before `map()`. Point the scales at the plot area: `scale.start = area.top + area.height; scale.end = area.top` (`BarChart.js:116-122`).
3. **Draw the axes:** `this.drawAxes(svg, area, xTicks, yTicks)`, with ticks as `[{ pos, label }]` in pixels (`BarChart.js:124-126`).
4. **Draw the marks** inside `svg.start('g') ... .end()`.
   - Add a class with `self.myClass('dot')`, so tests and CSS can find them.
   - Give the colour as an attribute: `.attrs({ fill: self.seriesColor(s.i, j) })`.
   - Build a path with `self.SVGPath.create().moveTo(...).lineTo(...).close()`; the result goes in `d`.
5. **Hover.** Use `.on('mousemove', evt => self.showTooltip(evt, title, rows, footer))` and `.on('mouseleave', self.hideTooltip)`. Each row is `{ color, label, value }`, written as "label: value", with the value passed through `formatValue`.
   - When `showTooltipSum` is on, the footer is `this.sumLine(values)`.
   - **Small or overlapping marks** need a bigger target, so the pointer always lands on something:
     - with categories, put one transparent hit shape per category on top, as `BarChart` does (`BarChart.js:159-177`);
     - with free points such as dots, give each mark a wide transparent stroke (`stroke: transparent; stroke-width: 8px`).
6. **Click.** Declare a `Function` property, for example `onPointClick(datasetIndex, index, event)`, and call it when it is set. Add a `<<clickable` class so the cursor shows it (`BarChart.js:36-38`, `:76`).

## 4. Legend

- **Default:** one entry per dataset, and a click hides that dataset.
- **One entry per value, as on a pie:** override `legendItems()` to return `[{ label, color, hidden }]`, and check `isHidden(j)` per value while drawing (`PieChart.js:112-123`).
- **A side legend needing a width:** override `styleLegend` (`PieChart.js:125-131`).
- **Something on legend hover:** override the `onLegendHover(i, evt)` listener. It gets `-1` when the pointer leaves (`PieChart.js:207-215`).

## 5. Animation

Put a keyframe on the marks' group under `<<animated`, inside `prefers-reduced-motion: no-preference` (`PieChart.js:49-57`). Name the keyframes after the class, for example `foam-u2-chart-ScatterChart-pop`, so two charts never share one.

## 6. Wire it in

- **Pom row:** add `{ name: 'ScatterChart', flags: 'web' }` to `src/foam/u2/chart/pom.js`, after its base class.
- **License header:** the same as the files next to it.
- **Test:** add a case to `test/ChartViewTest.js` (`references/testing.md`).
- **Dashboard:** to offer it in a flow, see `references/dashboard-wiring.md`.

## Checklist

- [ ] every tuning number is a documented constant
- [ ] every path is built with `SVGPath`
- [ ] colours come from `seriesColor` or `defaultColor`, and text colours from CSS tokens
- [ ] hidden series are skipped by `isHidden(i)`, and the indexes stay the dataset indexes
- [ ] the tooltip rows use `formatValue`
- [ ] the class documentation says what one mark means, and gives one example
