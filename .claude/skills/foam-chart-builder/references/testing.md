# Testing a chart

The chart tests are client tests (`JSTest`). They draw the chart into the page and read the SVG back. Run them with:

```bash
./build.sh -W9090 client-tests:ChartViewTest,ChartScaleTest
./build.sh -W9090 client-tests:DashboardChartRenderTest,DashboardAgentShimTest   # after a dashboard change
```

Before a build, check each test file you changed parses: `node --check src/foam/u2/chart/test/ChartViewTest.js`. A test file that does not parse stops the test pom from loading; `build.sh` then runs no tests and still exits 0. A log with no `PASSED:` line is a failed run.

A browser test cannot read Java-only keys such as `javaFactory` or `javaCode`; to check a field reaches Java, check `generateJava !== false`. "Access missing import: dao" lines for every chart agent in the log are not a failure. The log prints a capped number of lines; trust the `PASSED:` count. A failure late in a long run can show as `FAILED: 1` with no message: run that case alone, with the earlier `await this.test…` calls in `runTest` commented out, to read it.

A scripted edit that leaves `,,` in a `methods:` list passes `node --check` (it is an array hole), and the build prints "Class definition error" far up the log. After a run with a surprise count, grep the log for `Class definition error` and `TypeError`.

The legend takes height from the plot, so a round chart's radius is not `min(w, h) / 2`. A test reads the radius from the drawn shape (a `circle`'s `r`), never works it out.

A `Date` property moves every value to 12:00 UTC on its day (`lang/types.js:242-249`), so a test that reads a minimum or maximum of a `Date` field expects `Date.UTC(y, m, d, 12)`, not midnight.

The headless test window is about 200 × 400 px, so `document.elementFromPoint` returns `null` right of about x = 200. A hover or hit test uses a mark on the left of the chart, or scans that mark's own box.

On a category x axis `XAxisType.CATEGORY.toX` returns the point's index (`XAxisType.js:57`), so an explicit `x` does not line points up across lines. A test of a line with a missing point uses `xType: 'linear'`.

`CSSAuditTest` is a server test: `./build.sh -W9090 server-tests:CSSAuditTest`. Listed under `client-tests` it is skipped with "Test not run", and the run exits 1 although nothing failed.

The `foam-test-builder` skill covers registering a test and reading results.

Passing tests are not enough for a dashboard chart. A flow copies the sink and can send it as JSON, which a unit test does not do, so open the chart in a running flow too (`references/dashboard-wiring.md`, "A chart with one mark per row").

## Which test

| Change | Test |
|---|---|
| a scale: ticks, bands, time steps, labels | `src/foam/u2/chart/test/ChartScaleTest.js` |
| a chart view: marks, colours, legend, tooltip, click | `src/foam/u2/chart/test/ChartViewTest.js` |
| a dashboard form field reaching the view | `core/reflow/dashboard/test/DashboardChartRenderTest.js` |
| an old flow shape still loading | `DashboardAgentShimTest`, `DashboardAgentJsonTest`, `DashboardAgentBaselineTest` |
| a chart field (Property, X Property) | `DashboardChartFieldTest` |

## A ChartViewTest case

Add an `async function testX(x)`, call it from `runTest`, and use the helpers already there (`ChartViewTest.js:83-118`):
- `mount(view)` turns animation off, gives the chart a 600 by 300 box and waits for the `<svg>`;
- `all(el, view, 'dot')` finds marks by their `myClass` name;
- `num(el, 'cx')` reads a numeric attribute;
- `fire(target, 'mousemove', x, y)` and `centreOf(el)` drive the pointer;
- `legendClass(name)` gives a `ChartLegend` class name, such as `item`, to find the entry to click;
- `redraw(done)` waits after a legend click until `done()` is true, for up to a second: pass the check you are about to make, such as `function() { return this.all(el, chart, 'bar').length === 1; }.bind(this)`;
- `unmount(view)` cleans up.

A chart draws its `<svg>` only once its ResizeObserver reports a size (`ChartView.js:217`, the redraw depends on `size_`). In `DashboardChartRenderTest`, a check right after the sink's `addToE` finds no `<svg>`: poll for it, as `mount` does.

Assert what a user would see:
- the count of marks;
- their sizes in proportion to the values;
- the resolved fill colours, with no `$` left;
- the tooltip text after a `mousemove`;
- the mark count after a legend click;
- the arguments a click handler received.

Put the value you got in the message, as the existing cases do: `'... Got ' + h.join()`.

```js
async function testScatter(x) {
  var chart = this.ScatterChart.create({ datasets: [ { label: 'A', data: [ { x: 1, y: 2 }, { x: 3, y: 4 } ] } ] }, x);
  var el   = await this.mount(chart);
  var dots = this.all(el, chart, 'dot');
  x.test(dots.length === 2, 'Scatter: one dot per point. Got ' + dots.length);
  this.unmount(chart);
}
```

Add the new class to `requires`, and call the new case from `runTest`.

## The manual check

A test build stops when its tests end, so it is no server to look at. Start one from the same checkout with `./build.sh -W<port>` on a free port; a second app running at the same time also needs its own deployment name (`./build.sh -h`). Open the Reflow `PieLegendTest` flow (`core/reflow/dashboard/flows.jrl`) and check:
- the legend sides;
- long labels;
- hiding a slice;
- dark mode.

For a new chart, add it to a scratch flow over a demo DAO, then check:
- hover;
- a legend click;
- a resize of the window;
- the theme switch.

Then export the flow to PDF and check the colours survive.
