/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Draws each chart type into the page and reads the SVG back: one bar or
// slice per value, the colours a dashboard picked, what the legend and the
// tooltip say, and the arguments a click hands to a dashboard's drill-down.
foam.CLASS({
  package: 'foam.u2.chart.test',
  name: 'ChartViewTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.u2.chart.BarChart',
    'foam.u2.chart.BoxPlotChart',
    'foam.u2.chart.HeatmapChart',
    'foam.u2.chart.HistogramChart',
    'foam.u2.chart.LineChart',
    'foam.u2.chart.PieChart',
    'foam.u2.chart.BubbleChart',
    'foam.u2.chart.RadarChart',
    'foam.u2.chart.ScatterChart',
    'foam.u2.chart.TreemapChart',
    'foam.u2.chart.WaterfallChart'
  ],

  methods: [
    async function runTest(x) {
      await this.testBars(x);
      await this.testStackedAndHorizontal(x);
      await this.testBarClickAndTooltip(x);
      await this.testLegendAndOptions(x);
      await this.testPie(x);
      await this.testDonutAndPercentages(x);
      await this.testLine(x);
      await this.testTimeLine(x);
      await this.testLinearLine(x);
      await this.testScatter(x);
      await this.testBubble(x);
      await this.testRadar(x);
      await this.testRadarEdges(x);
      await this.testHeatmap(x);
      await this.testHeatmapEdges(x);
      await this.testHistogram(x);
      await this.testHistogramSeries(x);
      await this.testHistogramEdges(x);
      await this.testWaterfall(x);
      await this.testWaterfallEdges(x);
      await this.testBoxPlot(x);
      await this.testBoxPlotEdges(x);
      await this.testTreemap(x);
      await this.testTreemapLayout(x);
      await this.testTreemapEdges(x);
    },

    async function mount(view) {
      // A fixed 600 x 300 box, so the plot has a size for its ResizeObserver
      // to report; the chart draws once that size arrives.
      view.animate = false;
      view.style({ width: '600px', height: '300px', position: 'absolute', left: '0', top: '0' });
      view.write();
      for ( var i = 0 ; i < 50 && ! view.element_.querySelector('svg') ; i++ ) {
        await new Promise(function(r) { setTimeout(r, 20); });
      }
      return view.element_;
    },

    function unmount(view) {
      view.remove();
    },

    function all(el, view, name) {
      return Array.from(el.querySelectorAll('.' + view.myClass(name)));
    },

    function num(el, attr) { return Number(el.getAttribute(attr)); },

    function visible(el) { return getComputedStyle(el).display !== 'none'; },

    async function redraw(done) {
      // A legend click redraws on the next animation frame, which a busy test
      // browser can delay well past 30 ms. Wait until done() says the redraw
      // has happened, for up to a second. Without done(), as when a click
      // must change nothing, wait 30 ms and look.
      await new Promise(function(r) { setTimeout(r, 30); });
      for ( var i = 0 ; done && ! done() && i < 50 ; i++ ) {
        await new Promise(function(r) { setTimeout(r, 20); });
      }
    },

    function fire(target, type, clientX, clientY) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: clientX, clientY: clientY }));
    },

    function centreOf(el) {
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },

    async function testBars(x) {
      var chart = this.BarChart.create({ labels: [ 'Jan', 'Feb', 'Mar', 'Apr' ],
        datasets: [ { label: 'Sales', data: [ 10, 20, 0, 40 ], backgroundColor: [ '#ff0000', '#00ff00' ] } ] }, x);
      var el   = await this.mount(chart);
      var bars = this.all(el, chart, 'bar');

      x.test(bars.length === 3, 'Bar: one rect per non-zero value; a 0 draws nothing. Got ' + bars.length);
      var h = bars.map(function(b) { return this.num(b, 'height'); }, this);
      x.test(Math.abs(h[1] / h[0] - 2) < 0.02 && Math.abs(h[2] / h[0] - 4) < 0.02, 'Bar: heights follow the values 10, 20, 40. Got ' + h.join());
      x.test(bars[0].getAttribute('fill') === '#ff0000' && bars[1].getAttribute('fill') === '#00ff00' && bars[2].getAttribute('fill') === '#00ff00',
        'Bar: a per-value colour list is used in turn (Jan red, Feb green, Apr green). Got ' + bars.map(function(b) { return b.getAttribute('fill'); }).join());
      var bottoms = bars.map(function(b) { return Math.round(this.num(b, 'y') + this.num(b, 'height')); }, this);
      x.test(bottoms[0] === bottoms[1] && bottoms[1] === bottoms[2], 'Bar: every bar stands on the zero line');
      x.test(this.all(el, chart, 'text').some(function(t) { return t.textContent === 'Mar'; }), 'Bar: each label is written under its band, the empty one too');
      this.unmount(chart);

      // No colours given: each dataset takes a theme colour, resolved to a
      // real value so a PDF export keeps it.
      chart = this.BarChart.create({ labels: [ 'A' ], datasets: [ { data: [ 1 ] }, { data: [ 2 ] } ] }, x);
      el = await this.mount(chart);
      var fills = this.all(el, chart, 'bar').map(function(b) { return b.getAttribute('fill'); });
      x.test(fills.length === 2 && fills[0] && fills[0].indexOf('$') === -1 && fills[0] !== fills[1],
        'Colour: two datasets without colours get two different resolved theme colours. Got ' + fills.join());
      x.test(fills[0] === chart.defaultColor(0), 'Colour: the first default is the theme\'s first chart colour');
      this.unmount(chart);
    },

    async function testStackedAndHorizontal(x) {
      var labels   = [ 'A', 'B' ];
      var datasets = [ { label: 'Cash', data: [ 1, 2 ] }, { label: 'Card', data: [ 3, 4 ] } ];
      var chart = this.BarChart.create({ labels: labels, datasets: datasets, stacked: true }, x);
      var el    = await this.mount(chart);
      var bars  = this.all(el, chart, 'bar');
      x.test(bars.length === 4, 'Stacked: one segment per value');
      // Draw order is label by label: A-Cash, A-Card, B-Cash, B-Card.
      x.test(this.num(bars[0], 'x') === this.num(bars[1], 'x'), 'Stacked: segments of one label share a column');
      x.test(Math.abs(this.num(bars[1], 'y') + this.num(bars[1], 'height') - this.num(bars[0], 'y')) < 0.5,
        'Stacked: Card sits directly on top of Cash');
      this.unmount(chart);

      chart = this.BarChart.create({ labels: labels, datasets: datasets }, x);
      el    = await this.mount(chart);
      bars  = this.all(el, chart, 'bar');
      x.test(this.num(bars[1], 'x') > this.num(bars[0], 'x') && Math.abs(this.num(bars[0], 'y') + this.num(bars[0], 'height') - this.num(bars[1], 'y') - this.num(bars[1], 'height')) < 0.5,
        'Grouped: without stacking the two datasets stand side by side');
      this.unmount(chart);

      chart = this.BarChart.create({ labels: labels, datasets: datasets, horizontal: true, barThickness: 8 }, x);
      el    = await this.mount(chart);
      bars  = this.all(el, chart, 'bar');
      x.test(el.classList.contains(chart.myClass('horizontal')), 'Horizontal: the chart carries the horizontal class');
      x.test(Math.abs(this.num(bars[1], 'width') / this.num(bars[0], 'width') - 3) < 0.05, 'Horizontal: bar lengths follow the values 1 and 3');
      x.test(bars.every(function(b) { return this.num(b, 'height') <= 8; }, this), 'Bar thickness: no bar is thicker than 8 px');
      this.unmount(chart);
    },

    async function testBarClickAndTooltip(x) {
      var clicks = [];
      var chart = this.BarChart.create({
        labels: [ 'A', 'B' ], datasets: [ { label: 'Cash', data: [ 1, 2 ] }, { label: 'Card', data: [ 3, 4 ] } ],
        stacked: true,
        showTooltipSum: true,
        onBarClick: function(di, i) { clicks.push([ di, i ]); }
      }, x);
      var el   = await this.mount(chart);
      var bars = this.all(el, chart, 'bar');
      var hits = this.all(el, chart, 'hit');
      x.test(hits.length === 2, 'Click: one hover column per label');
      x.test(el.classList.contains(chart.myClass('clickable')), 'Click: a chart with onBarClick shows a pointer');

      // B-Card is the fourth segment; clicking its centre must report dataset 1, label 1.
      var c = this.centreOf(bars[3]);
      this.fire(hits[1], 'click', c.x, c.y);
      x.test(JSON.stringify(clicks) === '[[1,1]]', 'Click: the drill-down gets the clicked segment (dataset 1, label 1). Got ' + JSON.stringify(clicks));
      c = this.centreOf(bars[0]);
      this.fire(hits[0], 'click', c.x, c.y);
      x.test(JSON.stringify(clicks[1]) === '[0,0]', 'Click: the bottom segment of A is dataset 0, label 0. Got ' + JSON.stringify(clicks[1]));

      this.fire(hits[1], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip'));
      var text = tip.textContent;
      x.test(this.visible(tip), 'Tooltip: hovering a column shows the tooltip');
      x.test(text.indexOf('B') === 0 && text.indexOf('Cash: 2') !== -1 && text.indexOf('Card: 4') !== -1,
        'Tooltip: it names the label and every dataset at it. Got ' + text);
      x.test(text.indexOf('Sum: 6') !== -1, 'Tooltip: showTooltipSum adds "Sum: 6". Got ' + text);
      this.fire(el.querySelector('svg'), 'mouseleave', 0, 0);
      x.test(! this.visible(tip), 'Tooltip: leaving the chart hides it');
      this.unmount(chart);

      chart = this.BarChart.create({ labels: [ 'A' ], datasets: [ { data: [ 1 ] } ], showTooltips: false }, x);
      el = await this.mount(chart);
      c  = this.centreOf(this.all(el, chart, 'bar')[0]);
      this.fire(this.all(el, chart, 'hit')[0], 'mousemove', c.x, c.y);
      x.test(! this.visible(el.querySelector('.' + chart.myClass('tooltip'))), 'Tooltip: showTooltips off keeps it hidden');
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Click: a chart without onBarClick shows no pointer');
      this.unmount(chart);
    },

    async function testLegendAndOptions(x) {
      var chart = this.BarChart.create({
        labels: [ 'A' ], datasets: [ { label: 'Cash', data: [ 1 ] }, { label: 'Card', data: [ 3 ] } ],
        legendPosition: 'right',
        xAxisLabel: 'Month',
        yAxisLabel: 'Amount',
        showGridLines: false
      }, x);
      var el = await this.mount(chart);
      x.test(el.classList.contains(chart.myClass('legend-right')), 'Legend: legendPosition right puts it on the right');
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Cash,Card', 'Legend: one entry per dataset, in order');
      var titles = this.all(el, chart, 'axis-title').map(function(t) { return t.textContent; });
      x.test(titles.indexOf('Month') !== -1 && titles.indexOf('Amount') !== -1, 'Axes: both axis titles are written. Got ' + titles.join());
      x.test(this.all(el, chart, 'grid').length === 0, 'Axes: showGridLines off draws no grid lines');

      items[0].click();
      await this.redraw(function() { return this.all(el, chart, 'bar').length === 1; }.bind(this));
      x.test(this.all(el, chart, 'bar').length === 1, 'Legend: clicking Cash hides its bar');
      items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items[0].classList.contains(this.legendClass('hidden')), 'Legend: a hidden entry is struck through');
      items[0].click();
      await this.redraw(function() { return this.all(el, chart, 'bar').length === 2; }.bind(this));
      x.test(this.all(el, chart, 'bar').length === 2, 'Legend: clicking it again brings the bar back');
      this.unmount(chart);

      chart = this.BarChart.create({ labels: [ 'A' ], datasets: [ { label: 'Cash', data: [ 1 ] } ], showLegend: false }, x);
      el = await this.mount(chart);
      x.test(! el.querySelector('.' + chart.myClass('legend')), 'Legend: showLegend off draws none');
      x.test(this.all(el, chart, 'grid').length > 0, 'Axes: grid lines are on by default');
      this.unmount(chart);
    },

    function legendClass(name) {
      // The legend is its own view, so its entries carry ChartLegend's classes.
      return 'foam-u2-chart-ChartLegend-' + name;
    },

    async function testPie(x) {
      var chart = this.PieChart.create({ labels: [ 'Apples', 'Pears', 'Plums' ],
        datasets: [ { data: [ 1, 1, 2 ], backgroundColor: [ '#111111', '#222222', '#333333' ] } ] }, x);
      var el     = await this.mount(chart);
      var slices = this.all(el, chart, 'slice');
      x.test(slices.length === 3, 'Pie: one slice per value');
      x.test(slices.map(function(s) { return s.getAttribute('fill'); }).join() === '#111111,#222222,#333333', 'Pie: each slice takes its own colour');
      x.test(chart.percent(2) === '50.0%' && chart.percent(0) === '25.0%', 'Pie: Plums is 50.0% and Apples 25.0%');

      var legend = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      legend[2].click();
      await this.redraw(function() { return this.all(el, chart, 'slice').length === 2; }.bind(this));
      x.test(this.all(el, chart, 'slice').length === 2, 'Pie: clicking Plums in the legend hides its slice');
      x.test(chart.percent(0) === '50.0%', 'Pie: shares are of the visible slices, so Apples becomes 50.0%. Got ' + chart.percent(0));

      var c = this.centreOf(this.all(el, chart, 'slice')[0]);
      this.fire(this.all(el, chart, 'slice')[0], 'mousemove', c.x, c.y);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('Apples: 1') !== -1, 'Pie: hovering a slice names it with its value. Got ' + text);
      this.unmount(chart);

      chart = this.PieChart.create({ labels: [ 'A', 'B' ], datasets: [ { data: [ 1, 2 ] } ], disableLegendClick: true }, x);
      el = await this.mount(chart);
      el.querySelector('.' + this.legendClass('item')).click();
      await this.redraw();
      x.test(this.all(el, chart, 'slice').length === 2, 'Pie: with disableLegendClick a legend click hides nothing');
      this.unmount(chart);

      chart = this.PieChart.create({ labels: [ 'All' ], datasets: [ { data: [ 5 ] } ] }, x);
      el = await this.mount(chart);
      var d = this.all(el, chart, 'slice')[0].getAttribute('d');
      x.test(( d.match(/M/g) || [] ).length === 2, 'Pie: one slice of 100% is drawn as two half arcs, since one arc cannot close a circle');
      this.unmount(chart);
    },

    async function testDonutAndPercentages(x) {
      var chart = this.PieChart.create({
        labels: [ 'Tiny', 'Big' ], datasets: [ { data: [ 1, 99999 ] } ],
        cutout: 50,
        showPercentages: true,
        legendPosition: 'left',
        legendMaxWidthPercent: 30
      }, x);
      var el = await this.mount(chart);
      x.test(chart.percent(0) === '<0.1%', 'Percent: a slice under 0.05% reads "<0.1%", not "0.0%". Got ' + chart.percent(0));
      var legend = Array.from(el.querySelectorAll('.' + this.legendClass('item'))).map(function(i) { return i.textContent; });
      x.test(legend[1] === '100.0% Big', 'Percent: showPercentages starts each legend entry with its share. Got ' + legend.join(' | '));
      var d = this.all(el, chart, 'slice')[1].getAttribute('d');
      x.test(( d.match(/A/g) || [] ).length === 2, 'Donut: a cutout slice has an outer and an inner arc');
      var lg = el.querySelector('.' + chart.myClass('legend'));
      x.test(lg.style.maxWidth === '30%', 'Legend: legendMaxWidthPercent caps a side legend at 30%. Got ' + lg.style.maxWidth);
      this.unmount(chart);
    },

    async function testLine(x) {
      var chart = this.LineChart.create({
        labels: [ 'a', 'b', 'c' ], datasets: [
          { label: 'Cash', data: [ 1, 3, 2 ], fill: true, borderColor: '#123456' },
          { label: 'Card', data: [ 2, 2, 2 ], pointRadius: 0 }
        ],
        showTooltipSum: true,
        yMin: 0,
        yMax: 10
      }, x);
      var el     = await this.mount(chart);
      var lines  = this.all(el, chart, 'line');
      var series = this.all(el, chart, 'series');
      x.test(lines.length === 2, 'Line: one path per dataset');
      x.test(lines[0].getAttribute('stroke') === '#123456', 'Line: borderColor sets the stroke');
      x.test(foam.u2.chart.LineDataset.isInstance(chart.datasets[0]) && chart.datasets[0].pointRadius === 3 && chart.datasets[1].pointRadius === 0,
        'Line: a plain dataset becomes a LineDataset; unset pointRadius is 3, a given 0 stays 0');
      x.test(this.all(el, chart, 'area').length === 1, 'Line: fill draws an area under Cash only');
      x.test(series[0].querySelectorAll('circle').length === 3 && series[1].querySelectorAll('circle').length === 0,
        'Line: points show by default; pointRadius 0 hides them');
      var yLabels = this.all(el, chart, 'text').map(function(t) { return t.textContent; });
      x.test(yLabels.indexOf('0') !== -1 && yLabels.indexOf('10') !== -1, 'Line: yMin and yMax set the ends of the y axis to 0 and 10. Got ' + yLabels.join());

      var overlay = this.all(el, chart, 'overlay')[0];
      var r = overlay.getBoundingClientRect();
      this.fire(overlay, 'mousemove', r.left + r.width / 2, r.top + r.height / 2);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('b') === 0 && text.indexOf('Cash: 3') !== -1 && text.indexOf('Card: 2') !== -1 && text.indexOf('Sum: 5') !== -1,
        'Line: hovering the middle snaps to "b" and lists both series with their sum. Got ' + text);
      x.test(this.all(el, chart, 'guide').length === 1, 'Line: a guide line marks the hovered x');
      this.unmount(chart);

      chart = this.LineChart.create({ labels: [ 'a', 'b', 'c' ], datasets: [ { data: [ 1, 3, 2 ], tension: 0.4 } ] }, x);
      el = await this.mount(chart);
      x.test(/C/.test(this.all(el, chart, 'line')[0].getAttribute('d')), 'Line: tension draws curves');
      this.unmount(chart);

      chart = this.LineChart.create({ labels: [ 'a', 'b', 'c' ], datasets: [ { data: [ 1, 3, 2 ], stepped: true } ] }, x);
      el = await this.mount(chart);
      var d = this.all(el, chart, 'line')[0].getAttribute('d');
      x.test(( d.match(/V/g) || [] ).length === 2 && ( d.match(/H/g) || [] ).length === 2, 'Line: stepped draws an upright and a flat segment per step. Got ' + d);
      this.unmount(chart);
    },

    async function testLinearLine(x) {
      // A LINEAR axis places x by value: 1 to 9 is eight times as far as 0 to 1.
      var chart = this.LineChart.create({ xType: 'linear', datasets: [ { label: 'Sales', data: [
        { x: 0, y: 1 }, { x: 1, y: 2 }, { x: 9, y: 3 }, { x: 10, y: 4 } ] } ] }, x);
      var el = await this.mount(chart);
      x.test(chart.xType === foam.u2.chart.XAxisType.LINEAR, 'Linear: xType \'linear\' adapts to XAxisType.LINEAR');
      var cx = Array.from(el.querySelectorAll('circle')).map(function(c) { return Number(c.getAttribute('cx')); });
      x.test(cx.length === 4 && Math.abs(( cx[2] - cx[1] ) - 8 * ( cx[1] - cx[0] )) < 1,
        'Linear: points sit by value, so 1 to 9 is eight times 0 to 1. Got ' + cx.join());
      var texts = this.all(el, chart, 'text').map(function(t) { return t.textContent; });
      x.test(texts.indexOf('10') !== -1, 'Linear: the axis ends on a tick labelled 10. Got ' + texts.join());
      this.unmount(chart);

      // With a hand-set top of 2, the points at 3 and 4 lie above the plot;
      // the lines sit in a nested svg that hides what falls outside it.
      chart = this.LineChart.create({ xType: 'linear', yMax: 2, datasets: [ { data: [
        { x: 0, y: 1 }, { x: 1, y: 2 }, { x: 9, y: 3 }, { x: 10, y: 4 } ] } ] }, x);
      el = await this.mount(chart);
      var lines = this.all(el, chart, 'lines')[0];
      var top   = Math.min.apply(null, Array.from(el.querySelectorAll('circle')).map(function(c) { return Number(c.getAttribute('cy')); }));
      x.test(lines && getComputedStyle(lines).overflow === 'hidden' && top < Number(lines.getAttribute('y')),
        'Linear: points above a hand-set yMax fall outside the lines box, which hides them');
      this.unmount(chart);
    },

    async function testScatter(x) {
      var clicks = [];
      var chart = this.ScatterChart.create({
        datasets: [
          { label: 'A', data: [ { x: 10, y: 100 }, { x: 20, y: 300 }, { x: 30, y: 200 } ], backgroundColor: '#ff0000' },
          { label: 'B', data: [ { x: 1000, y: 50 } ] }
        ],
        xAxisLabel: 'Size',
        yAxisLabel: 'Time',
        onPointClick: function(di, i) { clicks.push([ di, i ]); }
      }, x);
      var el   = await this.mount(chart);
      var dots = this.all(el, chart, 'dot');
      x.test(dots.length === 4, 'Scatter: one dot per point. Got ' + dots.length);
      var fills = dots.map(function(d) { return d.getAttribute('fill'); });
      x.test(fills[0] === '#ff0000' && fills[1] === '#ff0000' && fills[3] && fills[3].indexOf('$') === -1 && fills[3] !== fills[0],
        'Scatter: a dataset keeps its colour, and one with none gets a resolved theme colour. Got ' + fills.join());

      // x 10, 20, 30 stand evenly apart; y 100, 300, 200: the first step up is twice the next step down.
      var cx = dots.slice(0, 3).map(function(d) { return this.num(d, 'cx'); }, this);
      var cy = dots.slice(0, 3).map(function(d) { return this.num(d, 'cy'); }, this);
      x.test(Math.abs(( cx[1] - cx[0] ) - ( cx[2] - cx[1] )) < 0.5 && cx[1] > cx[0],
        'Scatter: x positions follow the values 10, 20, 30. Got ' + cx.join());
      x.test(Math.abs(( cy[0] - cy[1] ) + 2 * ( cy[1] - cy[2] )) < 0.5 && cy[1] < cy[2] && cy[2] < cy[0],
        'Scatter: y positions follow the values 100, 300, 200, higher values higher up. Got ' + cy.join());
      var titles = this.all(el, chart, 'axis-title').map(function(t) { return t.textContent; });
      x.test(titles.indexOf('Size') !== -1 && titles.indexOf('Time') !== -1, 'Scatter: both axis titles are written. Got ' + titles.join());
      var labels = function() { return this.all(el, chart, 'text').map(function(t) { return t.textContent; }); }.bind(this);
      x.test(labels().indexOf('1,000') !== -1, 'Scatter: the x axis reaches 1,000 to hold dataset B. Got ' + labels().join());

      this.fire(dots[0], 'mousemove', this.centreOf(dots[0]).x, this.centreOf(dots[0]).y);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('A') === 0 && text.indexOf('Size: 10') !== -1 && text.indexOf('Time: 100') !== -1,
        'Scatter: hovering a dot shows its series, x and y. Got ' + text);

      this.fire(dots[1], 'click', 0, 0);
      x.test(JSON.stringify(clicks) === '[[0,1]]', 'Scatter: a click gives the dataset and the point\'s position. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Scatter: a chart with onPointClick shows a pointer');

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'A,B', 'Scatter: the legend has one entry per dataset');
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'dot').length === 3; }.bind(this));
      x.test(this.all(el, chart, 'dot').length === 3, 'Scatter: clicking B in the legend hides its dot');
      x.test(labels().indexOf('1,000') === -1, 'Scatter: with B hidden the x axis rescales to A. Got ' + labels().join());
      var after = this.num(this.all(el, chart, 'dot')[0], 'cx');
      x.test(after !== cx[0], 'Scatter: the remaining dots move to the new scale');
      this.unmount(chart);
    },

    async function testBubble(x) {
      var clicks = [];
      var chart = this.BubbleChart.create({
        datasets: [
          { label: 'A', data: [ { x: 10, y: 100, r: 100 }, { x: 20, y: 300, r: 25 }, { x: 30, y: 200, r: 0 }, { x: 40, y: 50, r: -5 }, { x: 50, y: 50 } ], backgroundColor: '#ff0000' },
          { label: 'B', data: [ { x: 1000, y: 50, r: 400 } ] }
        ],
        xAxisLabel: 'Size',
        yAxisLabel: 'Time',
        onPointClick: function(di, i) { clicks.push([ di, i ]); }
      }, x);
      var el   = await this.mount(chart);
      var dots = this.all(el, chart, 'dot');
      x.test(dots.length === 4, 'Bubble: one bubble per point with a size of 0 or more, none for r -5 or a missing r. Got ' + dots.length);

      // Largest first within a dataset, so A draws 100, 25, 0 and then B draws 400.
      var rs = dots.map(function(d) { return this.num(d, 'r'); }, this);
      var most = chart.MAX_RADIUS_PX, least = chart.MIN_RADIUS_PX;
      x.test(Math.abs(rs[3] - most) < 0.01, 'Bubble: the largest value (400) gets MAX_RADIUS_PX. Got ' + rs.join());
      x.test(Math.abs(rs[0] - most * 0.5) < 0.01, 'Bubble: 100 is a quarter of 400, so a quarter of the area and half the radius. Got ' + rs.join());
      x.test(Math.abs(rs[1] - Math.max(least, most * Math.sqrt(25 / 400))) < 0.01, 'Bubble: 25 is a sixteenth of the area of 400. Got ' + rs.join());
      x.test(rs[2] === least, 'Bubble: a value of 0 gets MIN_RADIUS_PX. Got ' + rs.join());
      x.test(dots.every(function(d) { return Number(d.getAttribute('fill-opacity')) < 1; }), 'Bubble: bubbles are see-through so overlaps show');
      var fills = dots.map(function(d) { return d.getAttribute('fill'); });
      x.test(fills[0] === '#ff0000' && fills[3].indexOf('$') === -1 && fills[3] !== fills[0], 'Bubble: one colour per dataset, resolved. Got ' + fills.join());

      // The plot is inset by the largest bubble, so one at the lowest x still
      // lies right of where a scatter draws a dot at that x.
      var sc = this.ScatterChart.create({ datasets: chart.datasets.map(function(d) { return { label: d.label, data: d.data }; }) }, x);
      var scEl = await this.mount(sc);
      var scLeft = Math.min.apply(null, this.all(scEl, sc, 'dot').map(function(d) { return this.num(d, 'cx'); }, this));
      this.unmount(sc);
      var bubLeft = Math.min.apply(null, dots.map(function(d) { return this.num(d, 'cx') - this.num(d, 'r'); }, this));
      x.test(bubLeft >= scLeft - 0.01, 'Bubble: the largest bubble at the lowest x stays inside the plot. Bubble left ' + bubLeft + ', scatter dot ' + scLeft);

      // Positions are the scatter's: y 100, 300 and 0-size point at y 200; higher value higher up.
      var cy = dots.slice(0, 3).map(function(d) { return this.num(d, 'cy'); }, this);
      x.test(cy[1] < cy[0] || cy[1] < cy[2], 'Bubble: y follows the value. Got ' + cy.join());
      var titles = this.all(el, chart, 'axis-title').map(function(t) { return t.textContent; });
      x.test(titles.indexOf('Size') !== -1 && titles.indexOf('Time') !== -1, 'Bubble: both axis titles are written. Got ' + titles.join());

      var first = dots.filter(function(d) { return this.num(d, 'cx') < 100 && this.num(d, 'r') === rs[0]; }, this)[0] || dots[0];
      this.fire(first, 'mousemove', this.centreOf(first).x, this.centreOf(first).y);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('A') === 0 && text.indexOf('Size: 10') !== -1 && text.indexOf('Time: 100') !== -1 && text.indexOf('Size: 100') !== -1,
        'Bubble: hovering shows series, x, y and size (default label "Size", x titled Size here too). Got ' + text);
      chart.sizeLabel = 'Calls';
      await this.redraw();
      dots = this.all(el, chart, 'dot');
      this.fire(dots[0], 'mousemove', this.centreOf(dots[0]).x, this.centreOf(dots[0]).y);
      text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('Calls: 100') !== -1, 'Bubble: sizeLabel names the size in the tooltip. Got ' + text);

      this.fire(dots[1], 'click', 0, 0);
      x.test(JSON.stringify(clicks) === '[[0,1]]', 'Bubble: a click gives the dataset and the point\'s position in data (the 25 is index 1). Got ' + JSON.stringify(clicks));

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'A,B', 'Bubble: the legend has one entry per dataset');
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'dot').length === 3; }.bind(this));
      dots = this.all(el, chart, 'dot');
      x.test(dots.length === 3, 'Bubble: clicking B in the legend hides its bubble. Got ' + dots.length);
      x.test(Math.abs(this.num(dots[0], 'r') - most) < 0.01, 'Bubble: with B hidden, 100 is the largest and gets MAX_RADIUS_PX. Got ' + this.num(dots[0], 'r'));
      this.unmount(chart);

      chart = this.BubbleChart.create({ datasets: [ { label: 'A', data: [] } ] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'dot').length === 0 && !! el.querySelector('svg'), 'Bubble: with no points it draws no bubbles and still draws its axes');
      this.unmount(chart);
    },

    async function testRadar(x) {
      var clicks = [];
      var chart = this.RadarChart.create({
        labels: [ 'INFO', 'WARN', 'ERROR', 'DEBUG' ],
        datasets: [
          { label: 'Today', data: [ 100, 50, 25, 0 ], backgroundColor: '#ff0000' },
          { label: 'Last week', data: [ 400, 100, 200, 300 ] }
        ],
        showTooltipSum: true,
        onPointClick: function(di, i) { clicks.push([ di, i ]); }
      }, x);
      var el      = await this.mount(chart);
      var spokes  = this.all(el, chart, 'spoke');
      var dots    = this.all(el, chart, 'dot');
      var polys   = this.all(el, chart, 'polygon');
      var centre  = { x: this.num(spokes[0], 'x1'), y: this.num(spokes[0], 'y1') };
      var dist    = function(d) { return Math.hypot(this.num(d, 'cx') - centre.x, this.num(d, 'cy') - centre.y); }.bind(this);
      x.test(spokes.length === 4 && polys.length === 2 && dots.length === 8, 'Radar: four spokes, a polygon per dataset, a dot per value. Got ' + [ spokes.length, polys.length, dots.length ].join());

      // Spoke 0 is straight up, and the rest follow clockwise.
      var tips = spokes.map(function(s) { return { x: this.num(s, 'x2') - centre.x, y: this.num(s, 'y2') - centre.y }; }, this);
      x.test(Math.abs(tips[0].x) < 0.5 && tips[0].y < 0 && tips[1].x > 0 && Math.abs(tips[1].y) < 0.5 && Math.abs(tips[2].x) < 0.5 && tips[2].y > 0 && tips[3].x < 0,
        'Radar: spokes start at the top and run clockwise (top, right, bottom, left). Got ' + JSON.stringify(tips));

      // The rim is the largest value, 400, so dots sit at value / 400 of the radius.
      var rim = Math.hypot(tips[0].x, tips[0].y);
      var d   = dots.map(dist);
      x.test(Math.abs(d[0] - rim / 4) < 0.5 && Math.abs(d[1] - rim / 8) < 0.5 && Math.abs(d[2] - rim / 16) < 0.5,
        'Radar: Today\'s corners are 100, 50 and 25 of 400 from the centre. Got ' + d.join() + ' with the rim at ' + rim);
      x.test(d[3] < 0.5 && Math.abs(d[4] - rim) < 0.5, 'Radar: 0 is at the centre and the maximum on the rim. Got ' + d[3] + ' and ' + d[4]);
      x.test(this.num(dots[0], 'cx') === centre.x && this.num(dots[0], 'cy') < centre.y, 'Radar: the first spoke\'s corner is straight above the centre');

      x.test(polys[0].getAttribute('fill') === '#ff0000' && polys[0].getAttribute('stroke') === '#ff0000' && Number(polys[0].getAttribute('fill-opacity')) < 1,
        'Radar: a polygon is its colour, translucent, with a solid outline of the same colour');
      x.test(polys[1].getAttribute('fill') && polys[1].getAttribute('fill').indexOf('$') === -1 && polys[1].getAttribute('fill') !== '#ff0000',
        'Radar: a dataset with no colour gets a resolved theme colour. Got ' + polys[1].getAttribute('fill'));
      x.test(( polys[0].getAttribute('d').match(/L/g) || [] ).length === 3 && /Z$/.test(polys[0].getAttribute('d')), 'Radar: a polygon runs through four corners and closes');

      var rings = this.all(el, chart, 'grid');
      var ringLabels = this.all(el, chart, 'ring-label').map(function(t) { return t.textContent; });
      x.test(rings.length === 4 && ringLabels.join() === '100,200,300,400', 'Radar: rings at the round values 100 to 400, each labelled. Got ' + rings.length + ' rings, ' + ringLabels.join());
      var spokeLabels = this.all(el, chart, 'spoke-label').map(function(t) { return t.textContent; });
      x.test(spokeLabels.join() === 'INFO,WARN,ERROR,DEBUG', 'Radar: each spoke is labelled outside the rim. Got ' + spokeLabels.join());
      var lx = this.num(this.all(el, chart, 'spoke-label')[1], 'x');
      x.test(lx > centre.x + rim, 'Radar: the right-hand label sits beyond the rim');

      // Hover a corner: the label with every visible dataset's value.
      this.fire(dots[1], 'mousemove', this.centreOf(dots[1]).x, this.centreOf(dots[1]).y);
      var tip  = el.querySelector('.' + chart.myClass('tooltip'));
      var text = tip.textContent;
      x.test(this.visible(tip) && text.indexOf('WARN') === 0 && text.indexOf('Today: 50') !== -1 && text.indexOf('Last week: 100') !== -1 && text.indexOf('Sum: 150') !== -1,
        'Radar: hovering a corner shows the label, both values and their sum. Got ' + text);
      this.fire(dots[1], 'mouseleave', 0, 0);
      x.test(! this.visible(tip), 'Radar: leaving a corner hides the tooltip');
      // Hover the spoke band, away from any corner.
      this.fire(this.all(el, chart, 'hit')[2], 'mousemove', 0, 0);
      x.test(this.visible(tip) && tip.textContent.indexOf('ERROR') === 0 && tip.textContent.indexOf('Last week: 200') !== -1, 'Radar: hovering near a spoke shows its tooltip. Got ' + tip.textContent);

      this.fire(dots[6], 'click', 0, 0);
      x.test(JSON.stringify(clicks) === '[[1,2]]', 'Radar: a click gives the dataset and the spoke. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Radar: a chart with onPointClick shows a pointer');

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Today,Last week', 'Radar: the legend has one entry per dataset');
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'polygon').length === 1; }.bind(this));
      x.test(this.all(el, chart, 'polygon').length === 1 && this.all(el, chart, 'dot').length === 4, 'Radar: clicking Last week hides its polygon and dots');
      ringLabels = this.all(el, chart, 'ring-label').map(function(t) { return t.textContent; });
      x.test(ringLabels.join() === '50,100', 'Radar: with Last week hidden the rings rescale to Today\'s 100. Got ' + ringLabels.join());
      d = this.all(el, chart, 'dot').map(dist);
      x.test(Math.abs(d[0] - rim) < 0.5, 'Radar: Today\'s 100 now reaches the rim. Got ' + d[0] + ' against ' + rim);
      this.unmount(chart);
    },

    async function testRadarEdges(x) {
      // Nothing to draw: no labels, no error.
      var chart = this.RadarChart.create({ labels: [], datasets: [ { label: 'A', data: [] } ] }, x);
      var el = await this.mount(chart);
      x.test(this.all(el, chart, 'polygon').length === 0 && this.all(el, chart, 'dot').length === 0, 'Radar: no labels draws no polygon');
      this.unmount(chart);

      // A short data array counts as 0 on the spokes it misses; a long label is cut short with the full text in a title.
      var long = 'A very long category name that cannot fit beside the rim';
      chart = this.RadarChart.create({ labels: [ long, 'B', 'C' ], datasets: [ { label: 'A', data: [ 5 ] } ] }, x);
      el = await this.mount(chart);
      var dots = this.all(el, chart, 'dot');
      var polyD = this.all(el, chart, 'polygon')[0].getAttribute('d');
      x.test(dots.length === 3 && polyD.indexOf('NaN') === -1, 'Radar: a short data array still gives a corner per spoke. Got ' + dots.length);
      var label = this.all(el, chart, 'spoke-label')[0];
      var cut = label.firstChild.textContent;
      x.test(cut.indexOf('…') !== -1 && cut.length < long.length && label.querySelector('title').textContent === long,
        'Radar: a long label ends in an ellipsis and keeps its full text in a title. Got ' + cut);
      var box = el.querySelector('svg').getBoundingClientRect();
      var lb  = label.getBoundingClientRect();
      x.test(lb.left >= box.left - 1 && lb.right <= box.right + 1, 'Radar: the truncated label stays inside the chart');
      this.unmount(chart);

      // A dataset of zeros has no range to scale: the rings still come out with real numbers.
      chart = this.RadarChart.create({ labels: [ 'A', 'B', 'C' ], datasets: [ { label: 'Z', data: [ 0, 0, 0 ] } ] }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'polygon')[0].getAttribute('d').indexOf('NaN') === -1, 'Radar: a dataset of zeros draws without NaN');
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Radar: with no onPointClick the corners are not clickable');
      this.unmount(chart);
    },

    async function testHeatmap(x) {
      var clicks = [];
      var chart = this.HeatmapChart.create({
        labels: [ 'A', 'B', 'C' ],
        datasets: [
          { label: 'r1', data: [ 0, 5, 10 ], backgroundColor: '#0000ff' },
          { label: 'r2', data: [ null, 10, undefined ] }
        ],
        showValues: true,
        xAxisLabel: 'Hour',
        yAxisLabel: 'Level',
        onCellClick: function(xi, yi) { clicks.push([ xi, yi ]); }
      }, x);
      var el    = await this.mount(chart);
      var cells = this.all(el, chart, 'cell');
      x.test(cells.length === 6, 'Heatmap: one cell per label and row. Got ' + cells.length);

      // Draw order is row by row: r1-A, r1-B, r1-C, r2-A, r2-B, r2-C.
      var px = cells.map(function(c) { return this.num(c, 'x'); }, this);
      var py = cells.map(function(c) { return this.num(c, 'y'); }, this);
      x.test(px[0] < px[1] && px[1] < px[2] && px[0] === px[3], 'Heatmap: columns follow the labels, left to right. Got ' + px.join());
      x.test(py[0] === py[1] && py[3] > py[0] && py[3] === py[5], 'Heatmap: the first row is drawn above the second. Got ' + py.join());
      x.test(cells.every(function(c) { return this.num(c, 'width') === this.num(cells[0], 'width') && this.num(c, 'height') === this.num(cells[0], 'height'); }, this),
        'Heatmap: every cell is the same size');

      var red = function(c) { return parseInt(c.getAttribute('fill').substr(1, 2), 16); };
      x.test(cells[2].getAttribute('fill') === '#0000ff', 'Heatmap: the highest value, 10, is the dataset colour. Got ' + cells[2].getAttribute('fill'));
      x.test(red(cells[0]) > red(cells[1]) && red(cells[1]) > red(cells[2]), 'Heatmap: cells get stronger with the value 0, 5, 10. Got ' + [ 0, 1, 2 ].map(function(i) { return cells[i].getAttribute('fill'); }).join());
      x.test(cells[4].getAttribute('fill') === cells[2].getAttribute('fill'), 'Heatmap: two cells with the same value, 10, have the same colour');

      var empty = this.all(el, chart, 'empty-cell');
      x.test(empty.length === 2 && empty[0] === cells[3] && empty[1] === cells[5] && cells[3].getAttribute('fill') && cells[3].getAttribute('fill').indexOf('$') === -1 && cells[3].getAttribute('fill') !== cells[0].getAttribute('fill'),
        'Heatmap: a null and a missing value are empty cells in the neutral colour as a fill attribute, while 0 is a coloured cell. Got ' + empty.length);

      var texts = this.all(el, chart, 'cell-value');
      x.test(texts.map(function(t) { return t.textContent; }).join() === '0,5,10,10', 'Heatmap: Show Values writes the value in each cell that has one. Got ' + texts.map(function(t) { return t.textContent; }).join());
      var white = foam.CSS.returnTokenValue(chart.LIGHT_TEXT_COLOR, chart.cls_, chart.__subContext__);
      var black = foam.CSS.returnTokenValue(chart.DARK_TEXT_COLOR, chart.cls_, chart.__subContext__);
      // The pale end follows the theme (white in a light one, dark in a dark
      // one), so each text is checked against its own cell: light text on the
      // dark blue, and on every cell the colour foam.Color picks for contrast.
      var withValue = [ cells[0], cells[1], cells[2], cells[4] ];
      x.test(texts[2].getAttribute('fill') === white && texts.every(function(t, i) {
        return t.getAttribute('fill') === foam.Color.getBestForeground(withValue[i].getAttribute('fill'), black, white);
      }), 'Heatmap: each value is written in the text colour that reads best on its cell. Got ' + texts.map(function(t) { return t.getAttribute('fill'); }).join());

      var axisTitles = this.all(el, chart, 'axis-title').map(function(t) { return t.textContent; });
      x.test(axisTitles.indexOf('Hour') !== -1 && axisTitles.indexOf('Level') !== -1, 'Heatmap: both axis titles are written. Got ' + axisTitles.join());
      var labels = this.all(el, chart, 'text').map(function(t) { return t.textContent; });
      x.test([ 'A', 'B', 'C', 'r1', 'r2' ].every(function(l) { return labels.indexOf(l) !== -1; }), 'Heatmap: column and row labels are written. Got ' + labels.join());
      x.test(this.all(el, chart, 'grid').length === 0, 'Heatmap: no grid lines by default, the cells are the grid');

      // Legend: a colour scale with the lowest and highest value, no per-series entries.
      var scale = el.querySelector('.' + chart.myClass('scale'));
      var ends  = scale ? Array.from(scale.querySelectorAll('span')).map(function(s) { return s.textContent; }) : [];
      x.test(ends.join() === '0,10', 'Heatmap: the colour scale legend shows the lowest and highest value. Got ' + ends.join());
      x.test(scale && scale.querySelector('.' + chart.myClass('scale-bar')).style.background.indexOf('gradient') !== -1, 'Heatmap: the scale is a gradient');
      x.test(el.querySelectorAll('.' + this.legendClass('item')).length === 0, 'Heatmap: no per-series legend entries');

      this.fire(cells[4], 'mousemove', this.centreOf(cells[4]).x, this.centreOf(cells[4]).y);
      var tip = el.querySelector('.' + chart.myClass('tooltip'));
      x.test(this.visible(tip) && tip.textContent.indexOf('r2') !== -1 && tip.textContent.indexOf('B') !== -1 && tip.textContent.indexOf('10') !== -1,
        'Heatmap: hovering a cell shows its row, column and value. Got ' + tip.textContent);
      this.fire(cells[4], 'mouseleave', 0, 0);
      x.test(! this.visible(tip), 'Heatmap: the tooltip goes when the pointer leaves the cell');

      this.fire(cells[5], 'click', 0, 0);
      x.test(clicks.length === 0, 'Heatmap: clicking an empty cell does nothing');
      this.fire(cells[4], 'click', 0, 0);
      x.test(JSON.stringify(clicks) === '[[1,1]]', 'Heatmap: a click gives the column and row index. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Heatmap: a chart with onCellClick shows a pointer');
      this.unmount(chart);

      chart = this.HeatmapChart.create({ labels: [ 'A', 'B' ], datasets: [ { label: 'r', data: [ 1, 2 ] } ] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'cell-value').length === 0, 'Heatmap: values are not written unless Show Values is on');
      var fills = this.all(el, chart, 'cell').map(function(c) { return c.getAttribute('fill'); });
      x.test(fills[1].toLowerCase() === chart.defaultColor(0).toLowerCase(), 'Heatmap: with no colour set the highest value takes the first theme colour. Got ' + fills.join());
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Heatmap: with no onCellClick the cells are not clickable');
      this.unmount(chart);
    },

    async function testHistogram(x) {
      var clicks = [];
      var chart = this.HistogramChart.create({
        datasets: [ { label: 'Latency', data: [ 3, 12, 14, 15, 28, 45, 87 ] } ],
        onBinClick: function(di, j) { clicks.push([ di, j ]); }
      }, x);
      var el   = await this.mount(chart);
      var bars = this.all(el, chart, 'bar');
      var hits = this.all(el, chart, 'hit');
      var text = function() { return this.all(el, chart, 'text').map(function(t) { return t.textContent; }); }.bind(this);

      // 3 to 87 asked for 10 bins rounds to a step of 10: 0 to 90, nine bins, five of them not empty.
      x.test(hits.length === 9, 'Histogram: 3 to 87 gives nine bins of width 10. Got ' + hits.length);
      x.test(bars.length === 5, 'Histogram: one bar per non-empty bin. Got ' + bars.length);
      x.test(text().indexOf('0') !== -1 && text().indexOf('90') !== -1 && text().indexOf('50') !== -1,
        'Histogram: the x axis is labelled at the bin edges. Got ' + text().join());

      var x0 = this.num(bars[0], 'x'), w0 = this.num(bars[0], 'width');
      x.test(Math.abs(this.num(bars[1], 'x') - ( x0 + w0 )) < 0.01,
        'Histogram: neighbouring bars touch. Got ' + x0 + '+' + w0 + ' then ' + this.num(bars[1], 'x'));
      x.test(Math.abs(this.num(bars[1], 'height') - 3 * this.num(bars[0], 'height')) < 0.5,
        'Histogram: bin 10 to 20 holds 3 values, three times bin 0 to 10. Got ' + this.num(bars[1], 'height') + ' and ' + this.num(bars[0], 'height'));
      x.test(text().every(function(t) { return t.indexOf('.') === -1; }), 'Histogram: counts are whole. Got ' + text().join());
      x.test(bars[0].getAttribute('fill').indexOf('$') === -1, 'Histogram: the bar colour is resolved');

      var c = this.centreOf(hits[1]);
      this.fire(hits[1], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(tip.indexOf('10 – 20') !== -1 && tip.indexOf('Latency: 3') !== -1, 'Histogram: hover shows the bin range and its count. Got ' + tip);
      this.fire(hits[1], 'click', c.x, c.y);
      x.test(JSON.stringify(clicks) === '[[0,1]]', 'Histogram: a click gives the dataset and the bin. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Histogram: a chart with onBinClick shows a pointer');

      this.unmount(chart);

      chart = this.HistogramChart.create({ datasets: [ { label: 'Latency', data: [ 3, 12, 14, 15, 28, 45, 87 ] } ], binCount: 3 }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'hit').length === 2, 'Histogram: binCount 3 gives 2 bins of width 50. Got ' + this.all(el, chart, 'hit').length);
      this.unmount(chart);
    },

    async function testHistogramSeries(x) {
      var chart = this.HistogramChart.create({
        datasets: [ { label: 'A', data: [ 3, 12, 14, 15, 28, 45, 87 ] }, { label: 'B', data: [ 95, 96, 99 ] } ]
      }, x);
      var el   = await this.mount(chart);
      var text = function() { return this.all(el, chart, 'text').map(function(t) { return t.textContent; }); }.bind(this);
      var bars = this.all(el, chart, 'bar');

      x.test(this.all(el, chart, 'hit').length === 20, 'Histogram: two datasets share ten bins, a hover column each. Got ' + this.all(el, chart, 'hit').length);
      x.test(bars.length === 6, 'Histogram: A has five non-empty bins and B one. Got ' + bars.length);
      x.test(text().indexOf('100') !== -1, 'Histogram: the shared x axis reaches 100. Got ' + text().join());
      var fills = bars.map(function(b) { return b.getAttribute('fill'); });
      x.test(fills[0] !== fills[5], 'Histogram: each dataset has its own colour. Got ' + fills.join());
      // Side by side: A's first bar and B's bar in bin 9 are half a bin wide.
      var bin = this.num(this.all(el, chart, 'hit')[0], 'width') * 2;
      x.test(Math.abs(this.num(bars[0], 'width') * 2 - bin) < 0.01, 'Histogram: with two datasets a bar is half a bin wide');

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'bar').length === 5; }.bind(this));
      x.test(this.all(el, chart, 'bar').length === 5, 'Histogram: hiding B leaves A\'s five bars');
      x.test(this.all(el, chart, 'hit').length === 9 && text().indexOf('100') === -1 && text().indexOf('90') !== -1,
        'Histogram: hiding B recomputes the bins from A alone. Got ' + this.all(el, chart, 'hit').length + ' bins, ' + text().join());
      this.unmount(chart);
    },

    async function testHistogramEdges(x) {
      var chart = this.HistogramChart.create({ datasets: [ { label: 'Same', data: [ 5, 5, 5 ] } ] }, x);
      var el    = await this.mount(chart);
      var text  = function() { return this.all(el, chart, 'text').map(function(t) { return t.textContent; }); }.bind(this);
      x.test(this.all(el, chart, 'bar').length === 1 && this.all(el, chart, 'hit').length === 1,
        'Histogram: equal values make one bin, one bar. Got ' + this.all(el, chart, 'bar').length + ' bars');
      x.test(text().indexOf('5') !== -1 && text().indexOf('6') !== -1 && ! text().some(function(t) { return /NaN|Infinity/.test(t); }),
        'Histogram: the single bin runs 5 to 6, with no NaN. Got ' + text().join());
      this.unmount(chart);

      chart = this.HistogramChart.create({ datasets: [ { label: 'None', data: [] } ] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'bar').length === 0 && ! text().some(function(t) { return /NaN|Infinity/.test(t); }),
        'Histogram: no values draw empty axes, no bars, no NaN. Got ' + text().join());
      this.unmount(chart);

      chart = this.HistogramChart.create({ datasets: [ { label: 'Mixed', data: [ 1, 'x', null, NaN, 2, Infinity, 3 ] } ] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'bar').length >= 1 && ! text().some(function(t) { return /NaN|Infinity/.test(t); }),
        'Histogram: text, null, NaN and Infinity are left out. Got ' + text().join());
      this.unmount(chart);

      chart = this.HistogramChart.create({ datasets: [ { label: 'Small', data: [ 0.1, 0.2, 0.3, 0.35 ] } ], binCount: 5 }, x);
      el    = await this.mount(chart);
      x.test(text().indexOf('0.35') !== -1 || text().indexOf('0.4') !== -1,
        'Histogram: fractional edges keep their decimals. Got ' + text().join());
      this.unmount(chart);
    },

    async function testHeatmapEdges(x) {
      // Nothing but empty cells: neutral cells, and no colour scale to explain.
      var chart = this.HeatmapChart.create({ labels: [ 'A', 'B' ], datasets: [ { label: 'r', data: [ null, null ] } ] }, x);
      var el    = await this.mount(chart);
      x.test(this.all(el, chart, 'empty-cell').length === 2, 'Heatmap: with no values every cell is empty');
      x.test(! el.querySelector('.' + chart.myClass('scale')), 'Heatmap: with no values there is no colour scale');
      this.unmount(chart);

      // A single value: its cell takes the strong colour, and a long label is cut short.
      var long = 'Monthly Subscription Renewals by Region and Channel, Third Quarter, Annual Plan Only';
      chart = this.HeatmapChart.create({ labels: [ 'A' ], datasets: [ { label: long, data: [ 7 ], backgroundColor: '#ff0000' } ] }, x);
      el    = await this.mount(chart);
      var cell = this.all(el, chart, 'cell')[0];
      x.test(cell.getAttribute('fill') === '#ff0000', 'Heatmap: a lone value is drawn in the strong colour. Got ' + cell.getAttribute('fill'));
      var t = this.all(el, chart, 'text').filter(function(e) { return e.textContent.indexOf('Monthly') === 0; })[0];
      x.test(t && t.firstChild.textContent.slice(-1) === '…' && t.querySelector('title').textContent === long,
        'Heatmap: a long row label ends in an ellipsis and keeps its full text as the hover title. Got ' + ( t && t.firstChild.textContent ));
      this.unmount(chart);

      // Values wider than their cell are not written.
      chart = this.HeatmapChart.create({ labels: [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z' ],
        datasets: [ { label: 'r', data: Array.apply(null, Array(26)).map(function(_, i) { return 1000000 + i; }) } ], showValues: true }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'cell').length === 26 && this.all(el, chart, 'cell-value').length === 0,
        'Heatmap: a value that does not fit its cell is left out. Got ' + this.all(el, chart, 'cell-value').length + ' values');
      this.unmount(chart);
    },

    async function testWaterfall(x) {
      var clicks = [];
      // Running totals: 0 to 40, 40 to 25, 25 to 50, 50 to -30, then the total bar from 0 to -30.
      var chart = this.WaterfallChart.create({
        labels: [ 'Jan', 'Feb', 'Mar', 'Apr' ],
        datasets: [ { label: 'Change', data: [ 40, -15, 25, -80 ] } ],
        xAxisLabel: 'Month',
        onStepClick: function(i) { clicks.push(i); }
      }, x);
      var el   = await this.mount(chart);
      var bars = this.all(el, chart, 'bar');
      x.test(bars.length === 5, 'Waterfall: one bar per step and a total bar. Got ' + bars.length);

      var top = bars.map(function(b) { return this.num(b, 'y'); }, this);
      var len = bars.map(function(b) { return this.num(b, 'height'); }, this);
      var bottom = top.map(function(y, i) { return y + len[i]; });
      var near = function(a, b) { return Math.abs(a - b) < 0.5; };
      x.test(near(len[1] / len[0], 15 / 40) && near(len[2] / len[0], 25 / 40) && near(len[3] / len[0], 80 / 40) && near(len[4] / len[0], 30 / 40),
        'Waterfall: bar heights follow the changes 40, 15, 25, 80 and the total 30. Got ' + len.join());
      x.test(near(top[1], top[0]) && near(bottom[1], bottom[2]) && near(top[3], top[0] + len[0] - 50 / 40 * len[0]),
        'Waterfall: each bar starts at the total before it (Feb hangs from the top of Jan, Mar rests on the end of Feb, Apr from 50). Got top ' + top.join());
      x.test(near(top[4], bottom[0]), 'Waterfall: a total below zero hangs from the zero line. Got ' + top[4] + ' vs ' + bottom[0]);

      var fills = bars.map(function(b) { return b.getAttribute('fill'); });
      x.test(fills[0] === fills[2] && fills[1] === fills[3] && fills[0] !== fills[1] && fills[4] !== fills[0] && fills[4] !== fills[1] &&
        fills.every(function(f) { return f && f.indexOf('$') === -1; }),
        'Waterfall: rises share one resolved colour, falls another, the total a third. Got ' + fills.join());

      var texts = this.all(el, chart, 'text').map(function(e) { return e.textContent; });
      x.test(texts.indexOf('Total') !== -1 && texts.some(function(s) { return /^[-−]\d/.test(s); }),
        'Waterfall: the total bar is labelled and the value axis reaches below zero. Got ' + texts.join());
      x.test(this.all(el, chart, 'axis-title').map(function(e) { return e.textContent; }).indexOf('Month') !== -1, 'Waterfall: the x axis title is written');

      // A line joins the end of each bar to the start of the next, at the same total.
      var lines = this.all(el, chart, 'connector');
      x.test(lines.length === 4 && near(this.num(lines[0], 'y1'), top[0]) && near(this.num(lines[1], 'y1'), bottom[1]) && near(this.num(lines[3], 'y1'), bottom[3]) &&
        this.num(lines[0], 'x2') > this.num(lines[0], 'x1') && this.num(lines[0], 'x2') <= this.num(bars[1], 'x'),
        'Waterfall: four connectors, each at the total between two bars and in the gap. Got ' + lines.map(function(l) { return l.getAttribute('y1'); }).join());

      // Legend: rise, fall and total; a click hides nothing, as every bar rests on the ones before it.
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Rise,Fall,Total', 'Waterfall: the legend lists rise, fall and total. Got ' + items.map(function(i) { return i.textContent; }).join());
      items[0].click();
      await this.redraw();
      x.test(this.all(el, chart, 'bar').length === 5 && ! items[0].classList.contains(this.legendClass('hidden')),
        'Waterfall: clicking a legend entry hides no bars');

      var hits = this.all(el, chart, 'hit');
      x.test(hits.length === 5, 'Waterfall: one hover column per bar. Got ' + hits.length);
      var c = this.centreOf(hits[1]);
      this.fire(hits[1], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip'));
      x.test(this.visible(tip) && tip.textContent.indexOf('Feb') === 0 && /Change: [-−]15/.test(tip.textContent) && tip.textContent.indexOf('Running total: 25') !== -1,
        'Waterfall: hovering a step shows its name, its signed change and the running total. Got ' + tip.textContent);
      this.fire(hits[0], 'mousemove', c.x, c.y);
      x.test(tip.textContent.indexOf('Change: +40') !== -1 && tip.textContent.indexOf('Running total: 40') !== -1,
        'Waterfall: a rise is shown with a plus sign. Got ' + tip.textContent);
      this.fire(hits[4], 'mousemove', c.x, c.y);
      x.test(tip.textContent.indexOf('Total') === 0 && /Running total: [-−]30/.test(tip.textContent), 'Waterfall: the total bar shows the end total. Got ' + tip.textContent);

      this.fire(hits[2], 'click', c.x, c.y);
      this.fire(hits[4], 'click', c.x, c.y);
      x.test(JSON.stringify(clicks) === '[2,4]', 'Waterfall: a click gives the step index, 4 for the total bar. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Waterfall: a chart with onStepClick shows a pointer');
      this.unmount(chart);
    },

    async function testWaterfallEdges(x) {
      // showTotal off: no total bar, no Total legend entry; a colour list sets rise, fall, total.
      var chart = this.WaterfallChart.create({
        labels: [ 'A', 'B' ],
        datasets: [ { data: [ 10, -4 ], backgroundColor: [ '#00aa00', '#aa0000', '#0000aa' ] } ],
        showTotal: false
      }, x);
      var el   = await this.mount(chart);
      var bars = this.all(el, chart, 'bar');
      x.test(bars.length === 2 && bars[0].getAttribute('fill') === '#00aa00' && bars[1].getAttribute('fill') === '#aa0000',
        'Waterfall: showTotal off draws only the steps, in the rise and fall colours given. Got ' + bars.map(function(b) { return b.getAttribute('fill'); }).join());
      x.test(Array.from(el.querySelectorAll('.' + this.legendClass('item'))).map(function(i) { return i.textContent; }).join() === 'Rise,Fall',
        'Waterfall: showTotal off drops the Total legend entry');
      x.test(this.all(el, chart, 'connector').length === 1, 'Waterfall: one connector between two steps and no total');
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Waterfall: with no onStepClick the bars are not clickable');
      this.unmount(chart);

      // Only falls: the running total dips below zero, and the axis must still reach it.
      chart = this.WaterfallChart.create({ labels: [ 'A', 'B' ], datasets: [ { data: [ -10, -20 ] } ] }, x);
      el    = await this.mount(chart);
      bars  = this.all(el, chart, 'bar');
      var svgH = el.querySelector('svg').getBoundingClientRect().height;
      x.test(bars.length === 3 && bars.every(function(b) { return this.num(b, 'y') >= 0 && this.num(b, 'y') + this.num(b, 'height') <= svgH; }, this),
        'Waterfall: running totals of -10, -30 stay inside the plot');
      this.unmount(chart);

      // A step of 0 draws no bar but can still be hovered; a value that is not a number counts as 0.
      chart = this.WaterfallChart.create({ labels: [ 'A', 'B', 'C' ], datasets: [ { data: [ 5, 0, 'x' ] } ] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'bar').length === 2 && this.all(el, chart, 'hit').length === 4,
        'Waterfall: 0 and a non-number draw no bar, and the total is still drawn. Got ' + this.all(el, chart, 'bar').length);
      this.unmount(chart);

      // No data: nothing is drawn (the dashboard sink shows the message).
      chart = this.WaterfallChart.create({ labels: [], datasets: [] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'bar').length === 0 && this.all(el, chart, 'axis').length === 0,
        'Waterfall: with no data the chart draws no bars and no axes. Got ' + JSON.stringify(el.textContent));
      this.unmount(chart);
    },

    async function testTreemap(x) {
      // Labels are not in value order, so the tests also show the biggest
      // rectangle comes first whatever its index.
      var chart = this.TreemapChart.create({ labels: [ 'Small', 'Big', 'Mid', 'Tiny' ],
        datasets: [ { data: [ 15, 50, 30, 0.5 ], backgroundColor: [ '#111111', '#222222', '#333333', '#444444' ] } ] }, x);
      var clicks = [];
      chart.onRectClick = function(i) { clicks.push(i); };
      var el    = await this.mount(chart);
      var svg   = el.querySelector('svg');
      var area  = this.num(svg, 'width') * this.num(svg, 'height');
      var tiles = this.all(el, chart, 'tile');
      var areas = tiles.map(function(t) { return this.num(t, 'width') * this.num(t, 'height'); }, this);
      var total = 95.5;
      x.test(tiles.length === 4, 'Treemap: one rectangle per positive value. Got ' + tiles.length);
      x.test(tiles.map(function(t) { return t.getAttribute('fill'); }).join() === '#222222,#333333,#111111,#444444',
        'Treemap: rectangles run biggest first (Big, Mid, Small, Tiny), each in its own colour. Got ' + tiles.map(function(t) { return t.getAttribute('fill'); }).join());
      x.test([ 50, 30, 15, 0.5 ].every(function(v, k) { return Math.abs(areas[k] / area - v / total) < 0.001; }),
        'Treemap: areas follow the values 50, 30, 15, 0.5. Got ' + areas.map(function(a) { return ( a / area * 100 ).toFixed(1) + '%'; }).join());
      x.test(Math.abs(areas.reduce(function(a, b) { return a + b; }, 0) - area) < 1, 'Treemap: the rectangles fill the plot');
      x.test(this.num(tiles[0], 'x') === 0 && this.num(tiles[0], 'y') === 0, 'Treemap: the biggest sits in the top left corner');

      var labels = this.all(el, chart, 'tile-label').map(function(t) { return t.textContent; });
      x.test(labels.indexOf('Big') !== -1 && labels.indexOf('Tiny') === -1,
        'Treemap: a rectangle that fits shows its name and one too small shows none. Got ' + labels.join());
      var values = this.all(el, chart, 'tile-value').map(function(t) { return t.textContent; });
      x.test(values.indexOf('50') !== -1, 'Treemap: the value is written under the name. Got ' + values.join());

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Small,Big,Mid,Tiny', 'Treemap: the legend lists every label in order');
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'tile').length === 3; }.bind(this));
      tiles = this.all(el, chart, 'tile');
      areas = tiles.map(function(t) { return this.num(t, 'width') * this.num(t, 'height'); }, this);
      x.test(tiles.length === 3 && Math.abs(areas[0] / area - 30 / 45.5) < 0.001,
        'Treemap: hiding Big in the legend lays the rest out again, Mid now 30 of 45.5. Got ' + areas.map(function(a) { return ( a / area * 100 ).toFixed(1) + '%'; }).join());
      x.test(chart.percent(2) === '65.9%', 'Treemap: shares are of the visible rectangles. Got ' + chart.percent(2));
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'tile').length === 4; }.bind(this));

      tiles = this.all(el, chart, 'tile');
      var c = this.centreOf(tiles[0]);
      this.fire(tiles[0], 'mousemove', c.x, c.y);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('Big: 50 (52.4%)') !== -1, 'Treemap: hovering shows the name, value and share. Got ' + text);
      tiles[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      tiles[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      x.test(JSON.stringify(clicks) === '[1,0]', 'Treemap: a click gives the label index, not the draw order. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Treemap: a chart with onRectClick shows a pointer');
      this.unmount(chart);
    },

    async function testTreemapLayout(x) {
      // Seven values in a 600 x 400 box: the squarified layout keeps every
      // rectangle near a square (a plain one-direction slicing gives 6 by 1).
      var chart = this.TreemapChart.create({}, x);
      var r     = chart.squarify([ 6, 6, 4, 3, 2, 2, 1 ], 0, 0, 600, 400);
      var area  = r.reduce(function(a, t) { return a + t.w * t.h; }, 0);
      var worst = Math.max.apply(null, r.map(function(t) { return Math.max(t.w / t.h, t.h / t.w); }));
      x.test(r.length === 7 && Math.abs(area - 240000) < 1, 'Treemap layout: seven rectangles covering the box. Got ' + r.length + ' / ' + area);
      x.test(worst < 3, 'Treemap layout: no rectangle is longer than 3 times its width. Got ' + worst.toFixed(2));
      x.test(r.every(function(t) { return t.x >= -1e-6 && t.y >= -1e-6 && t.x + t.w <= 600 + 1e-6 && t.y + t.h <= 400 + 1e-6; }), 'Treemap layout: every rectangle is inside the box');
      var overlap = r.some(function(a, i) {
        return r.some(function(b, j) {
          return j > i && a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
        });
      });
      x.test(! overlap, 'Treemap layout: no two rectangles overlap');
      x.test(r[0].x === 0 && r[0].y === 0 && r[0].i === 0, 'Treemap layout: the biggest starts at the top left');
    },

    async function testTreemapEdges(x) {
      var chart = this.TreemapChart.create({ labels: [ 'A', 'B', 'C', 'D' ], datasets: [ { data: [ 10, 0, -5, 5 ], backgroundColor: [ '#000000', '#111111', '#222222', '#ffffff' ] } ] }, x);
      var el    = await this.mount(chart);
      var tiles = this.all(el, chart, 'tile');
      x.test(tiles.length === 2, 'Treemap: a zero or negative value gets no rectangle. Got ' + tiles.length);
      var fills = this.all(el, chart, 'tile-label').map(function(t) { return t.getAttribute('fill'); });
      x.test(fills.length === 2 && fills[0] !== fills[1], 'Treemap: text on a dark rectangle and on a light one differ in colour. Got ' + fills.join());
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Treemap: with no onRectClick the rectangles are not clickable');
      // No Legend entries are dropped for a zero value.
      x.test(el.querySelectorAll('.' + this.legendClass('item')).length === 4, 'Treemap: the legend keeps an entry for a zero value');
      this.unmount(chart);

      chart = this.TreemapChart.create({ labels: [ 'Only' ], datasets: [ { data: [ 7 ] } ] }, x);
      el = await this.mount(chart);
      var svg = el.querySelector('svg');
      tiles = this.all(el, chart, 'tile');
      x.test(tiles.length === 1 && this.num(tiles[0], 'width') === this.num(svg, 'width') && this.num(tiles[0], 'height') === this.num(svg, 'height'),
        'Treemap: a single value fills the plot');
      this.unmount(chart);

      chart = this.TreemapChart.create({ labels: [], datasets: [] }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'tile').length === 0, 'Treemap: with no data nothing is drawn');
      this.unmount(chart);
    },

    async function testTimeLine(x) {
      var pts = [ [ 2024, 0, 15 ], [ 2024, 1, 10 ], [ 2024, 2, 1 ], [ 2024, 3, 20 ] ].map(function(d, i) {
        return { x: new Date(Date.UTC(d[0], d[1], d[2])), y: i + 1 };
      });
      var chart = this.LineChart.create({ xType: 'time', timeUnit: 'month', utc: true, datasets: [ { label: 'Sales', data: pts } ] }, x);
      x.test(chart.xType === foam.u2.chart.XAxisType.TIME, 'Time: xType \'time\' adapts to XAxisType.TIME');
      var el    = await this.mount(chart);
      var march = new Date(Date.UTC(2024, 2, 1)).toLocaleString(foam.locale, { timeZone: 'UTC', month: 'short', year: 'numeric' });
      var texts = this.all(el, chart, 'text').map(function(t) { return t.textContent; });
      x.test(texts.indexOf(march) !== -1, 'Time: a month axis labels March 2024 as "' + march + '". Got ' + texts.join());
      this.unmount(chart);

      chart = this.LineChart.create({ xType: 'time', timeUnit: 'millisecond', datasets: [ { data: pts } ] }, x);
      el    = await this.mount(chart);
      var grid = this.all(el, chart, 'grid').length;
      x.test(grid < 40, 'Time: a millisecond unit over three months moves up to a coarser one, about one tick per 60 px. Got ' + grid + ' grid lines');
      this.unmount(chart);
    },

    async function testBoxPlot(x) {
      var clicks = [];
      // Eleven values. Linear interpolation puts Q1 at index 2.5 (between 3 and
      // 4, so 3.5), the median at index 5 (6) and Q3 at index 7.5 (between 8
      // and 9, so 8.5). The box is 5 tall, so a value counts as inside the
      // whiskers up to 8.5 + 7.5 = 16: 10 is the top whisker and 30 an outlier.
      var data = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 30 ];
      var chart = this.BoxPlotChart.create({
        labels: [ 'A', 'B', 'C' ],
        datasets: [ { label: 'Latency', data: [ data, [], [ 5 ] ], backgroundColor: '#ff0000' } ],
        onBoxClick: function(di, i) { clicks.push([ di, i ]); }
      }, x);
      var st = chart.stats_(data);
      x.test(st.min === 1 && st.q1 === 3.5 && st.median === 6 && st.q3 === 8.5 && st.max === 10 && st.outliers.join() === '30',
        'BoxPlot: quartiles of 1..10 and 30 are 3.5, 6, 8.5, whiskers 1 to 10, outlier 30. Got ' + JSON.stringify(st));
      x.test(chart.stats_([ 1, 2, 3, 4 ]).q1 === 1.75, 'BoxPlot: the first quartile of 1, 2, 3, 4 is 1.75 by linear interpolation');
      var skew = chart.stats_([ 0, 0, 0, 100 ]);
      x.test(skew.q3 === 25 && skew.max === 25 && skew.min === 0 && skew.outliers.join() === '100',
        'BoxPlot: with 0, 0, 0, 100 the upper whisker ends at Q3 (25), not below it; 100 is an outlier. Got ' + JSON.stringify(skew));

      var el    = await this.mount(chart);
      var boxes = this.all(el, chart, 'box');
      x.test(boxes.length === 2, 'BoxPlot: one box per category with numbers; empty B is skipped. Got ' + boxes.length);
      x.test(boxes[0].getAttribute('fill') === '#ff0000', 'BoxPlot: the dataset colour fills the box');

      var top = this.num(boxes[0], 'y'), hgt = this.num(boxes[0], 'height'), bottom = top + hgt;
      var med = this.all(el, chart, 'median')[0];
      x.test(Math.abs(( bottom - this.num(med, 'y1') ) / hgt - 0.5) < 0.01,
        'BoxPlot: the median line sits halfway up this box (6 between 3.5 and 8.5). Got ' + ( bottom - this.num(med, 'y1') ) / hgt);
      var dots = this.all(el, chart, 'outlier');
      x.test(dots.length === 1, 'BoxPlot: one dot per outlier. Got ' + dots.length);
      x.test(Math.abs(( bottom - this.num(dots[0], 'cy') ) / hgt - 5.3) < 0.02,
        'BoxPlot: the outlier 30 stands 26.5 above Q1, 5.3 box heights. Got ' + ( bottom - this.num(dots[0], 'cy') ) / hgt);
      x.test(this.num(boxes[1], 'height') === chart.MIN_BOX_PX, 'BoxPlot: a single value draws a flat box of the least height. Got ' + this.num(boxes[1], 'height'));

      var hits = this.all(el, chart, 'hit');
      x.test(hits.length === 2, 'BoxPlot: one hover column per drawn box. Got ' + hits.length);
      var c = this.centreOf(hits[0]);
      this.fire(hits[0], 'mousemove', c.x, c.y);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      var want = [ 'A', 'Min: 1', 'Q1: 3.5', 'Median: 6', 'Q3: 8.5', 'Max: 10', 'Outliers: 1' ];
      x.test(want.every(function(w) { return text.indexOf(w) !== -1; }), 'BoxPlot: the tooltip lists ' + want.join(', ') + '. Got ' + text);

      this.fire(hits[1], 'click', 0, 0);
      x.test(JSON.stringify(clicks) === '[[0,2]]', 'BoxPlot: a click gives the dataset and the category position. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'BoxPlot: a chart with onBoxClick shows a pointer');
      this.unmount(chart);

      chart = this.BoxPlotChart.create({ labels: [ 'A' ], datasets: [ { data: [ [ 1, 2, 3 ] ] } ] }, x);
      el = await this.mount(chart);
      x.test(! el.classList.contains(chart.myClass('clickable')), 'BoxPlot: a chart without onBoxClick shows no pointer');
      this.unmount(chart);
    },

    async function testBoxPlotEdges(x) {
      // Two datasets side by side; hiding one rescales the axis.
      var chart = this.BoxPlotChart.create({
        labels: [ 'A', 'B' ],
        datasets: [
          { label: 'Low',  data: [ [ 1, 2, 3, 4, 5 ], [ 2, 3, 4 ] ] },
          { label: 'High', data: [ [ 100, 110, 120 ], [ 90, 100 ] ] }
        ]
      }, x);
      var el    = await this.mount(chart);
      var boxes = this.all(el, chart, 'box');
      x.test(boxes.length === 4, 'BoxPlot: two datasets draw two boxes per category. Got ' + boxes.length);
      // Boxes come dataset by dataset: Low A, Low B, High A, High B.
      var pair = [ boxes[0], boxes[2] ];
      var xs = pair.map(function(b) { return this.num(b, 'x'); }, this);
      var ws = pair.map(function(b) { return this.num(b, 'width'); }, this);
      x.test(xs[1] > xs[0] + ws[0] && ws[0] === ws[1], 'BoxPlot: boxes of one category stand side by side, as wide as each other. Got x ' + xs.join() + ' width ' + ws.join());
      var fills = pair.map(function(b) { return b.getAttribute('fill'); });
      x.test(fills[0] !== fills[1] && fills[1].indexOf('$') === -1, 'BoxPlot: each dataset gets its own resolved colour. Got ' + fills.join());
      var labels = function() { return this.all(el, chart, 'text').map(function(t) { return t.textContent; }); }.bind(this);
      x.test(labels().indexOf('120') !== -1 || labels().indexOf('100') !== -1, 'BoxPlot: the value axis reaches High. Got ' + labels().join());

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Low,High', 'BoxPlot: the legend has one entry per dataset');
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'box').length === 2; }.bind(this));
      x.test(this.all(el, chart, 'box').length === 2, 'BoxPlot: clicking High in the legend hides its boxes');
      x.test(labels().indexOf('100') === -1 && labels().indexOf('120') === -1, 'BoxPlot: with High hidden the axis rescales to Low. Got ' + labels().join());
      var wide = this.num(this.all(el, chart, 'box')[0], 'width');
      x.test(wide > ws[0], 'BoxPlot: the remaining box takes the whole slot. Got ' + wide + ' against ' + ws[0]);
      this.unmount(chart);

      // No numbers at all: no boxes, and no error.
      chart = this.BoxPlotChart.create({ labels: [ 'A', 'B' ], datasets: [ { label: 'None', data: [ [], [ 'x', null ] ] } ] }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'box').length === 0 && !! el.querySelector('svg'), 'BoxPlot: categories without numbers draw no box, only the axes');
      this.unmount(chart);

      // Equal values: a flat box with no outliers.
      var st = this.BoxPlotChart.create({}, x).stats_([ 5, 5, 5, 5 ]);
      x.test(st.min === 5 && st.q1 === 5 && st.q3 === 5 && st.max === 5 && ! st.outliers.length, 'BoxPlot: equal values give a flat box with no outliers. Got ' + JSON.stringify(st));
    }
  ]
});
