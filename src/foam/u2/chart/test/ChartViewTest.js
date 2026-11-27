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
    'foam.u2.chart.BulletChart',
    'foam.u2.chart.CandlestickChart',
    'foam.u2.chart.ComboChart',
    'foam.u2.chart.FunnelChart',
    'foam.u2.chart.GaugeChart',
    'foam.u2.chart.HeatmapChart',
    'foam.u2.chart.HistogramChart',
    'foam.u2.chart.LineChart',
    'foam.u2.chart.PieChart',
    'foam.u2.chart.PolarAreaChart',
    'foam.u2.chart.BubbleChart',
    'foam.u2.chart.RadarChart',
    'foam.u2.chart.SankeyChart',
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
      await this.testStackedLine(x);
      await this.testTimeLine(x);
      await this.testLinearLine(x);
      await this.testCombo(x);
      await this.testComboLegend(x);
      await this.testComboEdges(x);
      await this.testScatter(x);
      await this.testBubble(x);
      await this.testCandlestick(x);
      await this.testCandlestickEdges(x);
      await this.testRadar(x);
      await this.testRadarEdges(x);
      await this.testPolarArea(x);
      await this.testPolarAreaEdges(x);
      await this.testHeatmap(x);
      await this.testHeatmapEdges(x);
      await this.testHistogram(x);
      await this.testHistogramSeries(x);
      await this.testHistogramEdges(x);
      await this.testWaterfall(x);
      await this.testWaterfallEdges(x);
      await this.testFunnel(x);
      await this.testFunnelEdges(x);
      await this.testBoxPlot(x);
      await this.testBoxPlotEdges(x);
      await this.testTreemap(x);
      await this.testTreemapLayout(x);
      await this.testTreemapEdges(x);
      await this.testGauge(x);
      await this.testGaugeBands(x);
      await this.testGaugeEdges(x);
      await this.testBullet(x);
      await this.testBulletEdges(x);
      await this.testSankey(x);
      await this.testSankeyEdges(x);
      await this.testTextWidthSpacing(x);
      this.testFormatValue(x);
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

    function pointOn(el, view, name, index) {
      // A point the browser says is on a drawn mark called name, as a real
      // pointer would land: { target, x, y }, or null when none is. A mark as
      // thin as the gauge's band ring needs index: the scan then covers the
      // index-th mark's own box, where the svg-wide grid steps over it. A mark's
      // box centre can be empty (a ring's is its hole), and a shape laid over
      // the mark would take the pointer, so ask the page what is there.
      var r = ( index === undefined ? el.querySelector('svg') : this.all(el, view, name)[index] ).getBoundingClientRect();
      for ( var i = 0 ; i < 60 ; i++ ) for ( var j = 0 ; j < 60 ; j++ ) {
        var px = r.left + r.width * i / 60, py = r.top + r.height * j / 60;
        var t  = document.elementFromPoint(px, py);
        if ( t && t.classList.contains(view.myClass(name)) ) return { target: t, x: px, y: py };
      }
      return null;
    },

    function centreOf(el) {
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },

    function testFormatValue(x) {
      // A tooltip shows at most MAX_DECIMALS digits after the point, so an
      // average such as 321.1333 does not print every digit it has.
      var chart = this.BarChart.create({}, x);
      var want  = (321.13).toLocaleString(foam.locale);
      x.test(chart.formatValue(321.1333) === want, 'Format: 321.1333 shows as ' + want + '. Got ' + chart.formatValue(321.1333));
      x.test(chart.formatValue(1200) === (1200).toLocaleString(foam.locale), 'Format: a whole number keeps no decimals. Got ' + chart.formatValue(1200));
    },

    async function testTextWidthSpacing(x) {
      // Labels are placed from textWidth, so it must count the page's
      // letter-spacing, or a long label runs past the chart's edge.
      var chart = this.BarChart.create({ labels: [ 'A' ], datasets: [ { data: [ 1 ] } ] }, x);
      var el = await this.mount(chart);
      el.style.letterSpacing = '0px';
      var plain = chart.textWidth('abcdef');
      el.style.letterSpacing = '2px';
      var spaced = chart.textWidth('abcdef');
      x.test(Math.abs(spaced - plain - 12) < 0.5, 'Text width: 2px letter-spacing adds 2px for each of 6 characters. Got ' + ( spaced - plain ));
      this.unmount(chart);
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

    async function testCombo(x) {
      var clicked = '';
      var chart = this.ComboChart.create({
        labels: [ 'a', 'b', 'c' ],
        datasets: [
          { label: 'Visits', data: [ 100, 300, 200 ] },
          { label: 'Load time', data: [ 10, 40, 20 ], borderColor: '#123456' }
        ],
        yAxisLabel: 'Visits',
        lineAxisLabel: 'ms',
        onCategoryClick: function(i, evt) { clicked = i; }
      }, x);
      var el   = await this.mount(chart);
      var bars = this.all(el, chart, 'bar');
      var dots = this.all(el, chart, 'dot');
      var line = this.all(el, chart, 'line');
      x.test(bars.length === 3 && dots.length === 3 && line.length === 1,
        'Combo: one bar and one dot per label, one line. Got ' + bars.length + '/' + dots.length + '/' + line.length);
      x.test(foam.u2.chart.LineDataset.isInstance(chart.datasets[0]) && chart.datasets[1].pointRadius === 3,
        'Combo: a plain dataset becomes a LineDataset with its default dots');
      var h = bars.map(function(b) { return this.num(b, 'height'); }, this);
      x.test(Math.abs(h[1] / h[0] - 3) < 0.01 && Math.abs(h[2] / h[0] - 2) < 0.01, 'Combo: bar heights are in proportion to 100, 300, 200. Got ' + h.join());
      x.test(line[0].getAttribute('stroke') === '#123456' && dots[0].getAttribute('fill') === '#123456', 'Combo: the line and its dots take borderColor');
      x.test(! /C/.test(line[0].getAttribute('d')), 'Combo: with no tension the line is straight');

      // The two values sit on their own scales: 300 on the left and 40 on the
      // right each reach the same height, so the tallest bar's top and the
      // highest dot are one pixel row.
      x.test(Math.abs(this.num(bars[1], 'y') - this.num(dots[1], 'cy')) < 1,
        'Combo: the tallest bar and the highest dot reach the same height on their own axes. Got ' + this.num(bars[1], 'y') + ' vs ' + this.num(dots[1], 'cy'));
      x.test(this.num(dots[0], 'cy') > this.num(dots[2], 'cy') && this.num(dots[2], 'cy') > this.num(dots[1], 'cy'),
        'Combo: the dots rise with 10, 20, 40');

      var texts = this.all(el, chart, 'text');
      var right = texts.filter(function(t) { return t.getAttribute('text-anchor') === 'start'; });
      var left  = texts.filter(function(t) { return t.getAttribute('text-anchor') === 'end'; });
      x.test(right.length >= 2 && left.length >= 2, 'Combo: both y axes have tick labels. Got right ' + right.length + ', left ' + left.length);
      var barRight = Math.max.apply(null, bars.map(function(b) { return this.num(b, 'x') + this.num(b, 'width'); }, this));
      x.test(right.every(function(t) { return this.num(t, 'x') > barRight; }, this), 'Combo: the right labels sit beyond the last bar');
      var svgW = el.querySelector('svg').getBoundingClientRect().width;
      x.test(right.every(function(t) { return t.getBoundingClientRect().right <= el.getBoundingClientRect().left + svgW + 0.5; }),
        'Combo: the right labels stay inside the chart');
      var titles = this.all(el, chart, 'axis-title').map(function(t) { return t.textContent; });
      x.test(titles.indexOf('Visits') !== -1 && titles.indexOf('ms') !== -1, 'Combo: both axis titles are written. Got ' + titles.join());
      x.test(this.all(el, chart, 'axis').length === 3, 'Combo: a bottom, a left and a right axis line');
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Visits,Load time', 'Combo: the legend has the bar value and the line value');

      var hit = this.all(el, chart, 'hit');
      x.test(hit.length === 3, 'Combo: one hover column per label');
      var c = this.centreOf(hit[1]);
      this.fire(hit[1], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(tip.indexOf('b') === 0 && tip.indexOf('Visits: 300') !== -1 && tip.indexOf('Load time: 40') !== -1,
        'Combo: hovering a category lists both values. Got ' + tip);
      hit[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      x.test(clicked === 2, 'Combo: clicking a category calls onCategoryClick with its index. Got ' + clicked);
      this.unmount(chart);

      chart = this.ComboChart.create({
        labels: [ 'a', 'b' ], datasets: [ { data: [ 1, 2 ] }, { data: [ 1, 2 ], tension: 0.4 } ]
      }, x);
      el = await this.mount(chart);
      x.test(/C/.test(this.all(el, chart, 'line')[0].getAttribute('d')), 'Combo: tension draws a curve');
      x.test(el.classList.contains(chart.myClass('clickable')) === false, 'Combo: with no onCategoryClick the columns are not clickable');
      this.unmount(chart);
    },

    async function testComboLegend(x) {
      var chart = this.ComboChart.create({
        labels: [ 'a', 'b', 'c' ],
        datasets: [ { label: 'Visits', data: [ 100, 300, 200 ] }, { label: 'Load time', data: [ 10, 40, 20 ] } ],
        yAxisLabel: 'Visits', lineAxisLabel: 'ms'
      }, x);
      var el    = await this.mount(chart);
      var items = function() { return Array.from(el.querySelectorAll('.' + this.legendClass('item'))); }.bind(this);
      var anchor = function(a) {
        return this.all(el, chart, 'text').filter(function(t) { return t.getAttribute('text-anchor') === a; }).length;
      }.bind(this);
      var dotX = this.num(this.all(el, chart, 'dot')[0], 'cx');
      var dotY = this.all(el, chart, 'dot').map(function(d) { return this.num(d, 'cy'); }, this);

      // Hiding the bars takes their axis and title with them; the line stays.
      items()[0].click();
      await this.redraw(function() { return this.all(el, chart, 'bar').length === 0; }.bind(this));
      var titles = this.all(el, chart, 'axis-title').map(function(t) { return t.textContent; });
      x.test(this.all(el, chart, 'bar').length === 0 && this.all(el, chart, 'dot').length === 3, 'Combo legend: hiding Visits hides the bars and keeps the line');
      x.test(anchor('end') === 0 && anchor('start') >= 2 && titles.join() === 'ms', 'Combo legend: the bars\' axis labels and title are gone, the line\'s stay. Got ' + titles.join() + ', left labels ' + anchor('end'));
      x.test(this.num(this.all(el, chart, 'dot')[0], 'cx') < dotX, 'Combo legend: the plot widens into the room the left axis left. Got ' + dotX + ' then ' + this.num(this.all(el, chart, 'dot')[0], 'cx'));
      x.test(this.all(el, chart, 'dot').every(function(d, i) { return Math.abs(this.num(d, 'cy') - dotY[i]) < 1; }, this), 'Combo legend: the line keeps its own scale');
      x.test(items()[0].classList.contains(this.legendClass('hidden')), 'Combo legend: the hidden entry is struck through');

      // Back, then hide the line: its axis and title go, the bars stay.
      items()[0].click();
      await this.redraw(function() { return this.all(el, chart, 'bar').length === 3; }.bind(this));
      items()[1].click();
      await this.redraw(function() { return this.all(el, chart, 'dot').length === 0; }.bind(this));
      titles = this.all(el, chart, 'axis-title').map(function(t) { return t.textContent; });
      x.test(this.all(el, chart, 'bar').length === 3 && this.all(el, chart, 'line').length === 0, 'Combo legend: hiding Load time hides the line and keeps the bars');
      x.test(anchor('start') === 0 && anchor('end') >= 2 && titles.join() === 'Visits', 'Combo legend: the line\'s axis labels and title are gone. Got ' + titles.join());

      // Both hidden: an empty plot, nothing thrown.
      items()[0].click();
      await this.redraw(function() { return this.all(el, chart, 'bar').length === 0; }.bind(this));
      x.test(el.querySelector('svg') && this.all(el, chart, 'bar').length === 0 && this.all(el, chart, 'dot').length === 0, 'Combo legend: with both hidden nothing is drawn');
      this.unmount(chart);
    },

    async function testComboEdges(x) {
      // A missing line value leaves its point out; the bar for it is still drawn.
      var chart = this.ComboChart.create({
        labels: [ 'a', 'b', 'c' ], datasets: [ { data: [ 5, 0, 8 ] }, { data: [ 1, null, 3 ] } ]
      }, x);
      var el = await this.mount(chart);
      x.test(this.all(el, chart, 'dot').length === 2 && this.all(el, chart, 'bar').length === 2,
        'Combo: a missing line value draws no dot, and a zero bar draws no bar. Got ' + this.all(el, chart, 'dot').length + ' dots, ' + this.all(el, chart, 'bar').length + ' bars');
      this.unmount(chart);

      // A negative bar hangs below zero: the axis covers it.
      chart = this.ComboChart.create({ labels: [ 'a', 'b' ], datasets: [ { data: [ -5, 10 ] }, { data: [ 1, 2 ] } ] }, x);
      el = await this.mount(chart);
      var bars = this.all(el, chart, 'bar');
      x.test(bars.length === 2 && Math.abs(this.num(bars[0], 'y') - ( this.num(bars[1], 'y') + this.num(bars[1], 'height') )) < 0.5,
        'Combo: a negative bar starts at the zero line, where the positive bar ends');
      this.unmount(chart);

      // A flat line (every value 5) still gets a range to draw on.
      chart = this.ComboChart.create({ labels: [ 'a', 'b' ], datasets: [ { data: [ 1, 2 ] }, { data: [ 5, 5 ] } ] }, x);
      el = await this.mount(chart);
      var dots = this.all(el, chart, 'dot');
      x.test(dots.length === 2 && isFinite(this.num(dots[0], 'cy')) && this.num(dots[0], 'cy') === this.num(dots[1], 'cy'), 'Combo: a flat line draws a level line');
      this.unmount(chart);

      // Nothing to draw: nothing drawn, nothing thrown.
      chart = this.ComboChart.create({ labels: [], datasets: [] }, x);
      el = await this.mount(chart);
      x.test(el.querySelector('svg') && this.all(el, chart, 'bar').length === 0, 'Combo: with no data the chart draws its axes and no marks');
      this.unmount(chart);

      // Only the bars given: no line, no right axis.
      chart = this.ComboChart.create({ labels: [ 'a' ], datasets: [ { data: [ 3 ] } ], lineAxisLabel: 'ms' }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'bar').length === 1 && this.all(el, chart, 'axis').length === 2 && this.all(el, chart, 'axis-title').length === 0,
        'Combo: with no line dataset there is no right axis and no right title');
      this.unmount(chart);
    },

    async function testStackedLine(x) {
      // B has no value at x = 1; it counts as 0 there.
      var pts = function(ys) { return ys.map(function(y, i) { return { x: i, y: y }; }); };
      var chart = this.LineChart.create({
        xType: 'linear', stacked: true, showTooltipSum: true,
        datasets: [
          { label: 'A', data: pts([ 1, 2, 3 ]), borderColor: '#010101' },
          { label: 'B', data: [ { x: 0, y: 2 }, { x: 2, y: 4 } ], borderColor: '#020202' },
          { label: 'C', data: pts([ 1, 1, 1 ]), borderColor: '#030303' }
        ]
      }, x);
      var el = await this.mount(chart);
      var self = this;
      // The y pixel of each series' point at label index i, by stroke colour.
      var ys = function(stroke, i) {
        var g = self.all(el, chart, 'series').filter(function(s) { return s.querySelector('.' + chart.myClass('line')).getAttribute('stroke') === stroke; })[0];
        return g ? self.num(g.querySelectorAll('circle')[i], 'cy') : NaN;
      };
      x.test(this.all(el, chart, 'area').length === 3, 'Stacked: every line is a filled band, even with fill unset');
      // At a the totals are 1, 3 and 4: the gaps from the bottom up stand 1 : 2 : 1.
      var a1 = ys('#010101', 0), a2 = ys('#020202', 0), a3 = ys('#030303', 0);
      x.test(a1 > a2 && a2 > a3 && Math.abs(( a2 - a3 ) * 2 - ( a1 - a2 )) < 1,
        'Stacked: B sits on A and C on B, in proportion to the values. Got ' + [ a1, a2, a3 ].join());
      x.test(Math.abs(ys('#020202', 1) - ys('#010101', 1)) < 0.5 && ys('#030303', 1) < ys('#020202', 1),
        'Stacked: a missing value counts as 0, so B adds nothing at x = 1');
      var yLabels = this.all(el, chart, 'text').map(function(t) { return Number(t.textContent); }).filter(function(n) { return ! isNaN(n); });
      x.test(Math.max.apply(null, yLabels) >= 8, 'Stacked: the y axis reaches the total at c (8). Got ' + yLabels.join());

      var overlay = this.all(el, chart, 'overlay')[0];
      var r = overlay.getBoundingClientRect();
      this.fire(overlay, 'mousemove', r.left + r.width / 2, r.top + r.height / 2);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('A: 2') !== -1 && text.indexOf('B: 0') !== -1 && text.indexOf('C: 1') !== -1 && text.indexOf('Sum: 3') !== -1,
        'Stacked: the tooltip lists each line\'s own value and their total. Got ' + text);

      // Hiding B restacks: C now sits on A, so at a it stands at 1 + 1 = 2.
      el.querySelectorAll('.' + this.legendClass('item'))[1].click();
      await this.redraw(function() { return this.all(el, chart, 'area').length === 2; }.bind(this));
      var base = ys('#010101', 0), top = ys('#030303', 0);
      var zero = a1 + ( a1 - a2 ) / 2;   // A is 1 and B 2, so one unit is ( a1 - a2 ) / 2 pixels
      x.test(this.all(el, chart, 'area').length === 2 && top < base && Math.abs(( 2 * base - top ) - zero) < 1,
        'Stacked: hiding B restacks C onto A');
      this.unmount(chart);

      chart = this.LineChart.create({ labels: [ 'a', 'b' ], datasets: [ { label: 'A', data: [ 1, 2 ] }, { label: 'B', data: [ 1, 1 ] } ] }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'area').length === 0, 'Stacked: off by default, lines draw with no area');
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

    async function testCandlestick(x) {
      var clicks = [];
      // Four days. Day 1 rises 10 to 13, day 2 falls 13 to 9, day 3 closes where it opened, day 4 has no close.
      var chart = this.CandlestickChart.create({
        datasets: [ { data: [
          { x: '2024-03-01', open: 10, high: 14, low: 8,  close: 13 },
          { x: '2024-03-02', open: 13, high: 16, low: 7,  close: 9 },
          { x: '2024-03-03', open: 9,  high: 12, low: 9,  close: 9 },
          { x: '2024-03-04', open: 9,  high: 10, low: 8 }
        ] } ],
        xAxisLabel: 'Day',
        yAxisLabel: 'Price',
        onCandleClick: function(i) { clicks.push(i); }
      }, x);
      var el      = await this.mount(chart);
      var boxes   = this.all(el, chart, 'box');
      var wicks   = this.all(el, chart, 'wick');
      var near    = function(a, b) { return Math.abs(a - b) < 0.5; };
      x.test(boxes.length === 3 && wicks.length === 3, 'Candlestick: one box and one line per candle, none for the one with no close. Got ' + boxes.length + ' and ' + wicks.length);

      // Box height follows |close - open|: 3 on day 1, 4 on day 2.
      var h = boxes.map(function(b) { return this.num(b, 'height'); }, this);
      x.test(near(h[1] / h[0], 4 / 3), 'Candlestick: box heights are in proportion to |close - open|, 3 and 4. Got ' + h.join());
      x.test(h[2] === chart.MIN_BOX_HEIGHT_PX, 'Candlestick: a candle that closed where it opened still shows as a thin bar. Got ' + h[2]);

      // The line runs from the high to the low, so its length follows high - low: 6 on day 1, 9 on day 2.
      var len = wicks.map(function(w) { return Math.abs(this.num(w, 'y2') - this.num(w, 'y1')); }, this);
      x.test(near(len[1] / len[0], 9 / 6), 'Candlestick: line lengths follow high - low, 6 and 9. Got ' + len.join());
      var top = function(w) { return Math.min(this.num(w, 'y1'), this.num(w, 'y2')); }.bind(this);
      x.test(near(top(wicks[1]) - top(wicks[0]), -( 16 - 14 ) / 6 * len[0]), 'Candlestick: the second line starts 2 above the first, higher is higher up. Got ' + top(wicks[0]) + ', ' + top(wicks[1]));

      // The box sits on the line, centred on it, and inside its length.
      var cx = this.num(wicks[0], 'x1');
      x.test(near(this.num(boxes[0], 'x') + this.num(boxes[0], 'width') / 2, cx) && this.num(boxes[0], 'y') >= top(wicks[0]) - 0.01,
        'Candlestick: the box is centred on its line and starts below the high. Got x ' + this.num(boxes[0], 'x'));

      // Days are an even step apart on the time axis.
      var xs = wicks.map(function(w) { return this.num(w, 'x1'); }, this);
      x.test(near(xs[1] - xs[0], xs[2] - xs[1]) && xs[1] > xs[0], 'Candlestick: candles stand an equal step apart, a day each. Got ' + xs.join());

      var fills = boxes.map(function(b) { return b.getAttribute('fill'); });
      x.test(fills[0] === fills[2] && fills[0] !== fills[1] && fills.every(function(f) { return f && f.indexOf('$') === -1; }),
        'Candlestick: a rise and a flat candle share one resolved colour, a fall has another. Got ' + fills.join());
      x.test(wicks[0].getAttribute('stroke') === fills[0] && wicks[1].getAttribute('stroke') === fills[1], 'Candlestick: a line takes its box\'s colour');

      var titles = this.all(el, chart, 'axis-title').map(function(t) { return t.textContent; });
      x.test(titles.indexOf('Day') !== -1 && titles.indexOf('Price') !== -1, 'Candlestick: both axis titles are written. Got ' + titles.join());

      // The y axis stretches to the lowest low and highest high instead of starting at zero.
      var ticks = this.all(el, chart, 'text').map(function(t) { return t.textContent; });
      x.test(ticks.indexOf('0') === -1, 'Candlestick: the value axis does not start at zero when the data sits at 7 to 16. Got ' + ticks.join());

      // Legend: rise and fall, and a click hides nothing.
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Rise,Fall', 'Candlestick: the legend lists rise and fall. Got ' + items.map(function(i) { return i.textContent; }).join());
      items[0].click();
      await this.redraw();
      x.test(this.all(el, chart, 'box').length === 3 && ! items[0].classList.contains(this.legendClass('hidden')), 'Candlestick: clicking a legend entry hides no candle');

      var hits = this.all(el, chart, 'hit');
      x.test(hits.length === 3, 'Candlestick: one hover column per candle. Got ' + hits.length);
      var c = this.centreOf(hits[1]);
      this.fire(hits[1], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip'));
      x.test(this.visible(tip) && /Mar/.test(tip.textContent) && /Open: 13/.test(tip.textContent) && /High: 16/.test(tip.textContent) &&
        /Low: 7/.test(tip.textContent) && /Close: 9/.test(tip.textContent),
        'Candlestick: hovering a candle shows its time, open, high, low and close. Got ' + tip.textContent);

      this.fire(hits[2], 'click', c.x, c.y);
      x.test(JSON.stringify(clicks) === '[2]', 'Candlestick: a click gives the candle\'s position in the data. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Candlestick: a chart with onCandleClick shows a pointer');
      this.unmount(chart);
    },

    async function testCandlestickEdges(x) {
      // A colour list sets rise then fall; a value that is text, null or NaN, and an x that is not a date, leave the entry out.
      var chart = this.CandlestickChart.create({
        datasets: [ { backgroundColor: [ '#00aa00', '#aa0000' ], data: [
          { x: 1700000000000, open: 1, high: 5, low: 0, close: 4 },
          { x: 1700086400000, open: 4, high: 5, low: 1, close: 2 },
          { x: 1700172800000, open: '3', high: 5, low: 1, close: 2 },
          { x: 1700259200000, open: 3, high: null, low: 1, close: 2 },
          { x: 1700345600000, open: 3, high: 5, low: NaN, close: 2 },
          { x: 'not a date', open: 3, high: 5, low: 1, close: 2 },
          { open: 3, high: 5, low: 1, close: 2 }
        ] } ]
      }, x);
      var el    = await this.mount(chart);
      var boxes = this.all(el, chart, 'box');
      x.test(boxes.length === 2 && boxes[0].getAttribute('fill') === '#00aa00' && boxes[1].getAttribute('fill') === '#aa0000',
        'Candlestick: entries with a missing or non-number value are left out, and the colour list sets rise then fall. Got ' + boxes.map(function(b) { return b.getAttribute('fill'); }).join());
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Candlestick: with no onCandleClick the candles are not clickable');
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.length === 2, 'Candlestick: the legend lists rise and fall. Got ' + items.length);
      this.unmount(chart);

      // One candle alone: it draws, and its box is no wider than BOX_MAX_PX.
      chart = this.CandlestickChart.create({ datasets: [ { data: [ { x: 1700000000000, open: 5, high: 9, low: 4, close: 6 } ] } ] }, x);
      el    = await this.mount(chart);
      boxes = this.all(el, chart, 'box');
      x.test(boxes.length === 1 && this.num(boxes[0], 'width') <= chart.BOX_MAX_PX && this.num(boxes[0], 'width') > 0,
        'Candlestick: a single candle draws with a box of at most BOX_MAX_PX. Got ' + boxes.map(function(b) { return b.getAttribute('width'); }).join());
      this.unmount(chart);

      // Many candles: the boxes shrink to fit and never overlap.
      var data = [];
      for ( var i = 0 ; i < 200 ; i++ ) data.push({ x: 1700000000000 + i * 3600000, open: 10 + i % 7, high: 20, low: 5, close: 10 + i % 5 });
      chart = this.CandlestickChart.create({ timeUnit: 'DAY', datasets: [ { data: data } ] }, x);
      el    = await this.mount(chart);
      boxes = this.all(el, chart, 'box');
      var xs = boxes.map(function(b) { return this.num(b, 'x'); }, this);
      var ok = boxes.length === 200 && xs.every(function(v, k) { return k === 0 || v + 0.01 >= xs[k - 1] + this.num(boxes[k - 1], 'width'); }, this);
      x.test(ok, 'Candlestick: 200 candles keep their boxes apart. Got ' + boxes.length + ' boxes');
      this.unmount(chart);

      // No data: nothing is drawn and the legend has no entries (the dashboard sink shows the message).
      chart = this.CandlestickChart.create({ datasets: [] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'box').length === 0 && el.querySelectorAll('.' + this.legendClass('item')).length === 0,
        'Candlestick: with no data it draws no candles and no legend entries');
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

    function wedgeGeom(wedge) {
      // The numbers of a wedge's path "M cx,cy L x0,y0 A r,r 0 0 1 x1,y1 Z":
      // the centre, the edge where the wedge starts, its radius and the edge
      // where it ends.
      var n = wedge.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g).map(Number);
      return { cx: n[0], cy: n[1], x0: n[2], y0: n[3], r: n[4], x1: n[9], y1: n[10] };
    },

    async function testPolarArea(x) {
      var clicks = [];
      var chart = this.PolarAreaChart.create({
        labels: [ 'A', 'B', 'C', 'D' ],
        datasets: [ { data: [ 400, 100, 0, 25 ], backgroundColor: [ '#ff0000', '#00ff00' ] } ],
        onWedgeClick: function(i) { clicks.push(i); }
      }, x);
      var el     = await this.mount(chart);
      var wedges = this.all(el, chart, 'wedge');
      var g      = wedges.map(this.wedgeGeom);
      x.test(wedges.length === 3, 'Polar: one wedge per label, and the 0 draws none. Got ' + wedges.length);

      // The rim, the outer ring, is the largest value, 400, rounded up to a
      // round number (it is one already). The legend takes some of the height.
      var rings = this.all(el, chart, 'ring');
      var rim   = this.num(rings[rings.length - 1], 'r');
      x.test(rim > 100 && rim < 146, 'Polar: the rim fits the plot under the legend. Got ' + rim);
      x.test(Math.abs(g[0].r - rim) < 0.5, 'Polar: the largest value reaches the rim. Got ' + g[0].r);
      // Area grows with the radius squared: 100 is a quarter of 400's area, so half its radius.
      x.test(Math.abs(g[1].r - rim / 2) < 0.5 && Math.abs(g[2].r - rim / 4) < 0.5,
        'Polar: radius follows the square root of the value, so 100 is half and 25 a quarter of 400\'s radius. Got ' + g.map(function(w) { return w.r; }).join());
      x.test(Math.abs(g[0].r * g[0].r / ( g[1].r * g[1].r ) - 4) < 0.05 && Math.abs(g[0].r * g[0].r / ( g[2].r * g[2].r ) - 16) < 0.2,
        'Polar: areas are in proportion to the values 400, 100, 25');

      // Four labels give four 90 degree wedges: A from straight up to straight right, B from there to straight down, D from left to up.
      x.test(Math.abs(g[0].x0 - g[0].cx) < 0.5 && g[0].y0 < g[0].cy && g[0].x1 > g[0].cx && Math.abs(g[0].y1 - g[0].cy) < 0.5,
        'Polar: the first wedge starts straight up and sweeps clockwise to straight right. Got ' + JSON.stringify(g[0]));
      x.test(g[1].x0 > g[1].cx && Math.abs(g[1].x1 - g[1].cx) < 0.5 && g[1].y1 > g[1].cy,
        'Polar: the second wedge follows, from straight right to straight down');
      x.test(g[2].x0 < g[2].cx && Math.abs(g[2].y0 - g[2].cy) < 0.5 && Math.abs(g[2].x1 - g[2].cx) < 0.5 && g[2].y1 < g[2].cy,
        'Polar: the fourth label\'s wedge, from straight left to straight up, is the last drawn (the third has a 0)');

      x.test(wedges[0].getAttribute('fill') === '#ff0000' && wedges[1].getAttribute('fill') === '#00ff00' && wedges[2].getAttribute('fill') === '#00ff00',
        'Polar: a colour list is used in turn by label position (C, the 0, keeps its turn, so D is green). Got ' + wedges.map(function(w) { return w.getAttribute('fill'); }).join());

      var ringLabels = this.all(el, chart, 'ring-label').map(function(t) { return t.textContent; });
      x.test(ringLabels.join() === '100,200,300,400' && rings.length === 4, 'Polar: rings at the round values 100 to 400, each labelled. Got ' + rings.length + ' rings, ' + ringLabels.join());
      var ringR = rings.map(function(r) { return this.num(r, 'r'); }, this);
      x.test(Math.abs(ringR[3] - rim) < 0.5 && Math.abs(ringR[0] - rim / 2) < 0.5,
        'Polar: rings are spaced by the same square root, so 100 is at half the rim. Got ' + ringR.join());

      // Hover a wedge: label, value and share of the 525 total.
      var hits = this.all(el, chart, 'hit');
      x.test(hits.length === 4, 'Polar: one hover sector per label, the 0 too. Got ' + hits.length);
      this.fire(hits[1], 'mousemove', this.centreOf(hits[1]).x, this.centreOf(hits[1]).y);
      var tip  = el.querySelector('.' + chart.myClass('tooltip'));
      var text = tip.textContent;
      x.test(this.visible(tip) && text.indexOf('B') === 0 && text.indexOf('Value: 100') !== -1 && text.indexOf('Share of total: 19.0%') !== -1,
        'Polar: hovering a wedge shows its label, value and share of the total. Got ' + text);
      this.fire(hits[1], 'mouseleave', 0, 0);
      x.test(! this.visible(tip), 'Polar: leaving a wedge hides the tooltip');

      this.fire(hits[3], 'click', 0, 0);
      x.test(JSON.stringify(clicks) === '[3]', 'Polar: a click gives the label\'s index. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Polar: a chart with onWedgeClick shows a pointer');

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'A,B,C,D', 'Polar: the legend has one entry per label');
      items[0].click();
      await this.redraw(function() { return this.all(el, chart, 'wedge').length === 2; }.bind(this));
      wedges = this.all(el, chart, 'wedge');
      g      = wedges.map(this.wedgeGeom);
      x.test(wedges.length === 2 && this.all(el, chart, 'hit').length === 3, 'Polar: clicking A hides its wedge and its hover sector');
      ringLabels = this.all(el, chart, 'ring-label').map(function(t) { return t.textContent; });
      x.test(ringLabels.join() === '50,100', 'Polar: with A hidden the rings rescale to B\'s 100. Got ' + ringLabels.join());
      x.test(Math.abs(g[0].r - rim) < 0.5 && Math.abs(g[1].r - rim / 2) < 0.5, 'Polar: B\'s 100 now reaches the rim and D\'s 25 is half of it. Got ' + g.map(function(w) { return w.r; }).join());
      x.test(g[0].x0 > g[0].cx && Math.abs(g[0].y0 - g[0].cy) < 0.5, 'Polar: B keeps its slot, from straight right, so the others do not move');
      this.fire(this.all(el, chart, 'hit')[0], 'mousemove', 0, 0);
      x.test(tip.textContent.indexOf('B') === 0 && tip.textContent.indexOf('Share of total: 80.0%') !== -1,
        'Polar: the share is of the wedges still shown (100 of 125). Got ' + tip.textContent);
      this.unmount(chart);
    },

    async function testPolarAreaEdges(x) {
      // Nothing to draw: no labels, no error.
      var chart = this.PolarAreaChart.create({ labels: [], datasets: [ { data: [] } ] }, x);
      var el = await this.mount(chart);
      x.test(this.all(el, chart, 'wedge').length === 0, 'Polar: no labels draws no wedge');
      this.unmount(chart);

      // A negative and a missing value count as 0; the legend still lists them, shown.
      chart = this.PolarAreaChart.create({ labels: [ 'A', 'B', 'C' ], datasets: [ { data: [ 10, -5, null ] } ] }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'wedge').length === 1, 'Polar: a negative and a missing value draw no wedge. Got ' + this.all(el, chart, 'wedge').length);
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.length === 3 && ! items[1].classList.contains(this.legendClass('hidden')), 'Polar: a label with a 0 value stays in the legend, not greyed out');
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Polar: with no onWedgeClick the wedges are not clickable');
      this.unmount(chart);

      // One label is a full circle, which one arc cannot draw.
      chart = this.PolarAreaChart.create({ labels: [ 'A' ], datasets: [ { data: [ 5 ] } ] }, x);
      el = await this.mount(chart);
      var wedges = this.all(el, chart, 'wedge');
      var d = wedges.length && wedges[0].getAttribute('d');
      x.test(wedges.length === 1 && d.indexOf('NaN') === -1 && ( d.match(/A/g) || [] ).length === 2, 'Polar: a single label draws a full disc from two arcs. Got ' + d);
      this.unmount(chart);

      // All zeros have no range to scale: the rings still come out with real numbers.
      chart = this.PolarAreaChart.create({ labels: [ 'A', 'B' ], datasets: [ { data: [ 0, 0 ] } ] }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'wedge').length === 0 && this.all(el, chart, 'ring').every(function(r) { return isFinite(this.num(r, 'r')); }, this),
        'Polar: all zeros draw no wedge and no NaN ring');
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

    function pathNumbers(el) {
      // "M 1,2 L 3,4 Z" -> [ 1, 2, 3, 4 ]
      return el.getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number);
    },

    async function testFunnel(x) {
      var clicks = [];
      var chart = this.FunnelChart.create({
        labels: [ 'Home', 'Product', 'Basket', 'Checkout' ],
        datasets: [ { data: [ 800, 600, 400, 200 ], backgroundColor: [ '#ff0000', '#00ff00' ] } ],
        onStepClick: function(i) { clicks.push(i); }
      }, x);
      var el    = await this.mount(chart);
      var bands = this.all(el, chart, 'band');
      x.test(bands.length === 4, 'Funnel: one band per step, the zero step too. Got ' + bands.length);
      var d = bands.map(this.pathNumbers, this);
      // d is [ x0, y0, x1, y1, x2, y2, x3, y3 ]: the top edge, then the bottom edge back.
      var top = d.map(function(n) { return n[2] - n[0]; });
      x.test(Math.abs(top[0] / top[2] - 2) < 0.02 && Math.abs(top[1] / top[2] - 1.5) < 0.02 && Math.abs(top[0] / top[3] - 4) < 0.02,
        'Funnel: band widths follow the values 800, 600, 400, 200. Got ' + top.join());
      x.test(d.every(function(n) { return Math.abs(( n[0] + n[2] ) / 2 - 300) < 0.5; }), 'Funnel: bands are centred in the 600 px plot');
      x.test(Math.abs(( d[0][4] - d[0][6] ) - top[1]) < 0.5 && Math.abs(( d[1][4] - d[1][6] ) - top[2]) < 0.5,
        'Funnel: the bottom of a band is as wide as the top of the next, so they join');
      x.test(d[0][1] < d[1][1] && d[1][1] < d[2][1] && d[2][1] < d[3][1] && d[1][1] > d[0][5],
        'Funnel: bands run top to bottom in label order with a gap between them');
      x.test(bands[0].getAttribute('fill') === '#ff0000' && bands[1].getAttribute('fill') === '#00ff00' && bands[2].getAttribute('fill') === '#ff0000',
        'Funnel: a colour list is used in turn. Got ' + bands.map(function(b) { return b.getAttribute('fill'); }).join());

      var texts = this.all(el, chart, 'band-label').map(function(t) { return t.textContent; });
      x.test(texts[0] === 'Home · 800 · 100%' && texts[1] === 'Product · 600 · 75%' && texts[2] === 'Basket · 400 · 50%',
        'Funnel: a band is labelled with its step, value and share of the first step. Got ' + texts.join('|'));

      var hits = this.all(el, chart, 'hit');
      x.test(hits.length === 4, 'Funnel: one hover row per band. Got ' + hits.length);
      var c = this.centreOf(hits[2]);
      this.fire(hits[2], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip'));
      x.test(this.visible(tip) && tip.textContent.indexOf('Basket') === 0 && tip.textContent.indexOf('Value: 400') !== -1
        && tip.textContent.indexOf('Of first step: 50%') !== -1 && tip.textContent.indexOf('Of previous step: 67%') !== -1,
        'Funnel: hovering a step shows its value, its share of the first step and of the one before. Got ' + tip.textContent);
      this.fire(hits[0], 'mousemove', c.x, c.y);
      x.test(tip.textContent.indexOf('Of previous step') === -1, 'Funnel: the first step has no step before it. Got ' + tip.textContent);

      this.fire(hits[1], 'click', c.x, c.y);
      this.fire(hits[3], 'click', c.x, c.y);
      x.test(JSON.stringify(clicks) === '[1,3]', 'Funnel: a click gives the step index. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Funnel: a chart with onStepClick shows a pointer');

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Home,Product,Basket,Checkout', 'Funnel: the legend has one entry per step');
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'band').length === 3; }.bind(this));
      x.test(this.all(el, chart, 'band').length === 3, 'Funnel: clicking Product hides its band');
      texts = this.all(el, chart, 'band-label').map(function(t) { return t.textContent; });
      x.test(texts[1] === 'Basket · 400 · 50%', 'Funnel: the funnel redraws without the hidden step. Got ' + texts.join('|'));
      items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      items[0].click();
      await this.redraw(function() { return this.all(el, chart, 'band').length === 2; }.bind(this));
      texts = this.all(el, chart, 'band-label').map(function(t) { return t.textContent; });
      x.test(texts[0] === 'Basket · 400 · 100%', 'Funnel: with Home and Product hidden the first visible step is 100%. Got ' + texts.join('|'));
      this.unmount(chart);
    },

    async function testFunnelEdges(x) {
      // A negative or missing value is left out; its legend entry shows as hidden.
      var chart = this.FunnelChart.create({ labels: [ 'A', 'B', 'C' ], datasets: [ { data: [ 10, -5, null ] } ] }, x);
      var el    = await this.mount(chart);
      x.test(this.all(el, chart, 'band').length === 1, 'Funnel: a negative and a missing value draw no band. Got ' + this.all(el, chart, 'band').length);
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.length === 3 && items[1].classList.contains(this.legendClass('hidden')), 'Funnel: a left-out step shows as hidden in the legend');
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Funnel: with no onStepClick the bands are not clickable');
      this.unmount(chart);

      // A step of 0 is a thin band, not nothing, and the rest keep their proportions.
      chart = this.FunnelChart.create({ labels: [ 'A', 'B' ], datasets: [ { data: [ 800, 0 ] } ] }, x);
      el    = await this.mount(chart);
      var w = this.all(el, chart, 'band').map(function(b) { var n = this.pathNumbers(b); return n[2] - n[0]; }, this);
      x.test(w.length === 2 && w[1] > 0 && w[1] < w[0] / 10, 'Funnel: a step of 0 is a thin band, not nothing. Got ' + w.join());
      this.unmount(chart);

      // Every step 0: no division by zero, thin bands.
      chart = this.FunnelChart.create({ labels: [ 'A', 'B' ], datasets: [ { data: [ 0, 0 ] } ] }, x);
      el    = await this.mount(chart);
      var d = this.all(el, chart, 'band').map(this.pathNumbers, this);
      x.test(d.length === 2 && d.every(function(n) { return n.every(isFinite) && n[2] - n[0] > 0; }), 'Funnel: all-zero steps draw thin bands, no NaN');
      this.unmount(chart);

      // A step too narrow for its label loses the text, or ends it in an ellipsis; it never spills out.
      chart = this.FunnelChart.create({ labels: [ 'Start', 'A step with a very long name' ], datasets: [ { data: [ 1000, 40 ] } ] }, x);
      el    = await this.mount(chart);
      var texts = this.all(el, chart, 'band-label').map(function(t) { return t.textContent; });
      x.test(texts.length === 1 || texts[1].slice(-1) === '…', 'Funnel: a narrow band\'s label is trimmed. Got ' + texts.join('|'));
      this.unmount(chart);

      // No data: nothing drawn, nothing thrown.
      chart = this.FunnelChart.create({ labels: [], datasets: [] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'band').length === 0, 'Funnel: no steps draw no bands');
      this.unmount(chart);
    },

    function gaugeGeometry(el, chart) {
      // The dial's centre and radius, read from its track: the track's outer
      // arc runs from the left end of the dial to the right end.
      var d = this.all(el, chart, 'track')[0].getAttribute('d');
      var m = /^M([-\d.e]+),([-\d.e]+) A([-\d.e]+),/.exec(d);
      var left = Number(m[1]), r = Number(m[3]);
      return { cx: left + r, cy: Number(m[2]), r: r };
    },

    function gaugeFraction(el, chart, name, index) {
      // How far round the dial (0 left, 1 right) the outer edge of the
      // index-th mark called name ends, read from its path.
      var geo = this.gaugeGeometry(el, chart);
      var d   = this.all(el, chart, name)[index || 0].getAttribute('d');
      var m   = /A[-\d.e]+,[-\d.e]+ 0 0 1 ([-\d.e]+),([-\d.e]+)/.exec(d);
      var ang = Math.atan2(geo.cy - Number(m[2]), Number(m[1]) - geo.cx);
      return 1 - ang / Math.PI;
    },

    function texts(el, chart, name) {
      return this.all(el, chart, name).map(function(t) { return t.textContent; }).join();
    },

    async function testBullet(x) {
      var clicks = [];
      var chart = this.BulletChart.create({
        labels: [ 'Mon', 'Tue', 'Wed' ],
        datasets: [ { label: 'Requests', data: [ 70, 40, 90 ], backgroundColor: '#0000ff' } ],
        target: 60,
        bands: [ { upTo: 100 }, { upTo: 50 }, { upTo: 80 } ],
        onRowClick: function(i, evt) { clicks.push(i + evt.type); }
      }, x);
      var el     = await this.mount(chart);
      var ranges = this.all(el, chart, 'range');
      var bars   = this.all(el, chart, 'value-bar');
      var ticks  = this.all(el, chart, 'target');
      x.test(ranges.length === 9 && bars.length === 3 && ticks.length === 3, 'Bullet: three ranges, a bar and a tick for each of three rows. Got ' + ranges.length + '/' + bars.length + '/' + ticks.length);

      var w = function(e) { return Number(e.getAttribute('width')); };
      var y = function(e) { return Number(e.getAttribute('y')); };
      x.test(Math.abs(w(bars[0]) / w(bars[1]) - 70 / 40) < 0.01 && Math.abs(w(bars[2]) / w(bars[1]) - 90 / 40) < 0.01,
        'Bullet: bar lengths follow the values 70, 40, 90. Got ' + bars.map(w).join());
      x.test(y(bars[0]) < y(bars[1]) && y(bars[1]) < y(bars[2]), 'Bullet: rows run top to bottom in label order');
      x.test(bars.every(function(b) { return b.getAttribute('fill') === '#0000ff'; }), 'Bullet: every bar takes the dataset colour');

      // The first row's three ranges, in order of upTo whatever the order given.
      var r0 = ranges.slice(0, 3);
      var whole = w(r0[0]) + w(r0[1]) + w(r0[2]);
      x.test(Math.abs(w(r0[0]) / whole - 0.5) < 0.01 && Math.abs(w(r0[1]) / whole - 0.3) < 0.01 && Math.abs(w(r0[2]) / whole - 0.2) < 0.01,
        'Bullet: ranges cover 0-50, 50-80 and 80-100 of the axis. Got ' + r0.map(w).join());
      x.test(this.num(r0[1], 'x') === this.num(r0[0], 'x') + w(r0[0]), 'Bullet: a range starts where the one before it ends');
      var fills = r0.map(function(r) { return r.getAttribute('fill'); });
      x.test(fills.every(function(f) { return f && f.indexOf('$') === -1; }) && new Set(fills).size === 3, 'Bullet: ranges with no colour take three resolved shades. Got ' + fills.join());
      var lum = function(f) { var h = f.replace('#', ''); return parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16); };
      x.test(lum(fills[0]) > lum(fills[1]) && lum(fills[1]) > lum(fills[2]), 'Bullet: shades run from light to dark. Got ' + fills.join());
      x.test(w(bars[0]) > 0 && this.num(bars[0], 'height') < this.num(r0[0], 'height') && this.num(bars[0], 'height') > 0, 'Bullet: the bar is thinner than the ranges');

      var tx = this.num(ticks[0], 'x1');
      x.test(Math.abs(( tx - this.num(r0[0], 'x') ) / whole - 0.6) < 0.01, 'Bullet: the target tick stands at 60 of 100. Got ' + tx);
      x.test(ticks.every(function(t) { return t.getAttribute('x1') === ticks[0].getAttribute('x1'); }), 'Bullet: the tick is at the same place on every row');
      var tickH = this.num(ticks[0], 'y2') - this.num(ticks[0], 'y1');
      x.test(tickH > this.num(bars[0], 'height') && tickH < this.num(r0[0], 'height'), 'Bullet: the tick is taller than the bar and shorter than the ranges. Got ' + tickH);
      var axis = Array.from(el.querySelectorAll('.' + chart.myClass('text'))).map(function(t) { return t.textContent; });
      x.test(axis.indexOf('100') !== -1 && axis.indexOf('Mon') !== -1, 'Bullet: the value axis reaches 100 and the rows are named. Got ' + axis.join());
      x.test(! el.querySelector('.' + this.legendClass('item')), 'Bullet: no legend by default');

      var hits = this.all(el, chart, 'hit');
      x.test(hits.length === 3, 'Bullet: one hover row per category. Got ' + hits.length);
      var c = this.centreOf(hits[2]);
      this.fire(hits[2], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip'));
      x.test(this.visible(tip) && tip.textContent.indexOf('Wed') === 0 && tip.textContent.indexOf('Requests: 90') !== -1
        && tip.textContent.indexOf(chart.TARGET_NAME + ': 60') !== -1 && tip.textContent.indexOf(chart.BAND + ': 80 – 100') !== -1,
        'Bullet: hovering a row shows its value, the target and its band. Got ' + tip.textContent);
      this.fire(hits[1], 'mousemove', c.x, c.y);
      x.test(tip.textContent.indexOf('Requests: 40') !== -1 && tip.textContent.indexOf(chart.BAND + ': 0 – 50') !== -1, 'Bullet: 40 is in the first band. Got ' + tip.textContent);
      this.fire(hits[1], 'click', c.x, c.y);
      this.fire(hits[2], 'click', c.x, c.y);
      x.test(JSON.stringify(clicks) === '["1click","2click"]', 'Bullet: a click gives the row index. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Bullet: a chart with onRowClick shows a pointer');
      this.unmount(chart);

      // Colours of their own, and the legend when asked for.
      chart = this.BulletChart.create({
        labels: [ 'A' ], datasets: [ { data: [ 60 ] } ], showLegend: true,
        bands: [ { upTo: 50, color: '#ff0000' }, { upTo: 100, color: '#00ff00' } ]
      }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'range').map(function(r) { return r.getAttribute('fill'); }).join() === '#ff0000,#00ff00', 'Bullet: a band with a colour keeps it');
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === '0 – 50,50 – 100', 'Bullet: the legend lists the bands. Got ' + items.map(function(i) { return i.textContent; }).join());
      items[0].click();
      await this.redraw();
      x.test(this.all(el, chart, 'range').length === 2, 'Bullet: a legend click hides nothing');
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Bullet: a chart without onRowClick shows no pointer');
      this.unmount(chart);
    },

    async function testBulletEdges(x) {
      // No target set: no tick. A value that is not a number: ranges but no bar.
      var chart = this.BulletChart.create({ labels: [ 'A', 'B' ], datasets: [ { data: [ 30, null ] } ], bands: [ { upTo: 50 } ] }, x);
      var el = await this.mount(chart);
      x.test(this.all(el, chart, 'target').length === 0, 'Bullet: with no target no tick is drawn');
      x.test(this.all(el, chart, 'value-bar').length === 1 && this.all(el, chart, 'range').length === 2, 'Bullet: a missing value draws no bar but keeps its ranges');
      var hits = this.all(el, chart, 'hit');
      var c = this.centreOf(hits[1]);
      this.fire(hits[1], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip'));
      x.test(this.visible(tip) && tip.textContent.indexOf('B') === 0 && tip.textContent.indexOf(chart.BAND) === -1, 'Bullet: a row with no value names no band. Got ' + tip.textContent);
      this.unmount(chart);

      // A value past the last band is in the last band; a target past the bands widens the axis.
      chart = this.BulletChart.create({ labels: [ 'A' ], datasets: [ { data: [ 130 ] } ], target: 200, bands: [ { upTo: 50 }, { upTo: 100 } ] }, x);
      el = await this.mount(chart);
      var ranges = this.all(el, chart, 'range');
      var bar    = this.all(el, chart, 'value-bar')[0];
      var tick   = this.all(el, chart, 'target')[0];
      var right  = this.num(ranges[1], 'x') + Number(ranges[1].getAttribute('width'));
      x.test(this.num(bar, 'x') + Number(bar.getAttribute('width')) > right && this.num(tick, 'x1') > this.num(bar, 'x') + Number(bar.getAttribute('width')),
        'Bullet: the axis reaches the target 200, past the value 130 and the last band');
      x.test(chart.bandOf_(chart.bandRanges_(0), 130).to === 100, 'Bullet: a value past the bands is in the last one');
      this.unmount(chart);

      // A negative value draws left of zero, and a target of 0 is a real target when set.
      chart = this.BulletChart.create({ labels: [ 'A', 'B' ], datasets: [ { data: [ -20, 40 ] } ], target: 0 }, x);
      el = await this.mount(chart);
      var bars = this.all(el, chart, 'value-bar');
      var zero = this.num(this.all(el, chart, 'target')[0], 'x1');
      x.test(this.num(bars[0], 'x') < zero && Math.abs(this.num(bars[0], 'x') + Number(bars[0].getAttribute('width')) - zero) < 0.5 && Math.abs(this.num(bars[1], 'x') - zero) < 0.5,
        'Bullet: -20 draws left of 0 and 40 right of it, both from the tick at 0');
      x.test(this.all(el, chart, 'range').length === 0, 'Bullet: with no bands no range is drawn');
      this.unmount(chart);

      // No rows: no marks.
      chart = this.BulletChart.create({ labels: [], datasets: [], target: 5 }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'value-bar').length === 0 && this.all(el, chart, 'target').length === 0, 'Bullet: no rows draw no marks');
      this.unmount(chart);
    },

    async function testGauge(x) {
      var clicks = [];
      var chart = this.GaugeChart.create({
        max: 200,
        datasets: [ { label: 'Visits', data: [ 150 ], backgroundColor: '#ff0000' } ],
        onValueClick: function(evt) { clicks.push(evt.type); }
      }, x);
      var el = await this.mount(chart);
      x.test(this.all(el, chart, 'track').length === 1 && this.all(el, chart, 'band').length === 0, 'Gauge: one track and no bands without bands');
      var geo = this.gaugeGeometry(el, chart);
      x.test(geo.r > 100 && geo.r <= 296, 'Gauge: the dial fills the 600 by 300 box, a 300 pixel half circle at most. Got radius ' + geo.r);
      x.test(Math.abs(geo.cx - 300) < 1, 'Gauge: the dial is centred. Got ' + geo.cx);
      var f = this.gaugeFraction(el, chart, 'value-arc');
      x.test(Math.abs(f - 0.75) < 0.001, 'Gauge: 150 on a 0 to 200 dial fills three quarters. Got ' + f);
      x.test(this.all(el, chart, 'value-arc')[0].getAttribute('fill') === '#ff0000', 'Gauge: with no bands the arc takes the dataset colour');
      x.test(this.texts(el, chart, 'min') === '0' && this.texts(el, chart, 'max') === '200' && this.texts(el, chart, 'value') === '150',
        'Gauge: 0 and 200 label the ends and 150 sits under the dial. Got ' + this.texts(el, chart, 'min') + ' ' + this.texts(el, chart, 'max') + ' ' + this.texts(el, chart, 'value'));
      x.test(! el.querySelector('.' + this.legendClass('item')) && chart.legendItems().length === 0, 'Gauge: no legend without bands');

      var on = this.pointOn(el, chart, 'value-arc');
      x.test(!! on, 'Gauge: a pointer over the value arc lands on the arc');
      this.fire(on.target, 'mousemove', on.x, on.y);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('Visits: 150') !== -1 && text.indexOf(chart.BAND) === -1, 'Gauge: the tooltip gives the value and, with no bands, no band. Got ' + text);
      this.fire(on.target, 'click', 0, 0);
      x.test(JSON.stringify(clicks) === '["click"]', 'Gauge: a click calls onValueClick with the event. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Gauge: a chart with onValueClick shows a pointer');
      this.unmount(chart);

      chart = this.GaugeChart.create({ datasets: [ { data: [ 1 ] } ] }, x);
      el = await this.mount(chart);
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Gauge: a chart without onValueClick shows no pointer');
      this.unmount(chart);
    },

    async function testGaugeBands(x) {
      var chart = this.GaugeChart.create({
        datasets: [ { label: 'Score', data: [ 60 ] } ],
        // Out of order on purpose: the dial takes them in order of upTo.
        bands: [ { upTo: 100, color: '#00ff00' }, { upTo: 50, color: '#ff0000' }, { upTo: 80, color: '#ffaa00' } ],
        showLegend: true
      }, x);
      var el    = await this.mount(chart);
      var bands = this.all(el, chart, 'band');
      x.test(bands.length === 3, 'Gauge: one segment per band. Got ' + bands.length);
      x.test(bands.map(function(b) { return b.getAttribute('fill'); }).join() === '#ff0000,#ffaa00,#00ff00',
        'Gauge: segments run red, amber, green. Got ' + bands.map(function(b) { return b.getAttribute('fill'); }).join());
      var ends = [ 0, 1, 2 ].map(function(i) { return this.gaugeFraction(el, chart, 'band', i); }, this);
      x.test(Math.abs(ends[0] - 0.5) < 0.001 && Math.abs(ends[1] - 0.8) < 0.001 && Math.abs(ends[2] - 1) < 0.001,
        'Gauge: the segments end at 50, 80 and 100 of the way round. Got ' + ends.join());
      var geo = this.gaugeGeometry(el, chart);
      x.test(bands.every(function(b) { return b.getAttribute('d').indexOf('A' + (geo.r + chart.BAND_GAP_PX + chart.BAND_RING_PX) + ',') !== -1; }),
        'Gauge: the bands form a ring just outside the track, ' + chart.BAND_GAP_PX + ' pixels off');
      x.test(this.all(el, chart, 'value-arc')[0].getAttribute('fill') === '#ffaa00', 'Gauge: 60 is in the amber band, so the arc is amber');

      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === '0 – 50,50 – 80,80 – 100',
        'Gauge: the legend lists the bands. Got ' + items.map(function(i) { return i.textContent; }).join());
      items[0].click();
      await this.redraw();
      x.test(this.all(el, chart, 'band').length === 3 && ! items[0].classList.contains(this.legendClass('hidden')), 'Gauge: a legend click hides nothing');

      var on = this.pointOn(el, chart, 'value-arc');
      this.fire(on.target, 'mousemove', on.x, on.y);
      var text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf('Score: 60') !== -1 && text.indexOf(chart.BAND + ': 50 – 80') !== -1, 'Gauge: the tooltip gives the value and its band. Got ' + text);
      // The ring is thin, so scan within one band's own box. The first band is
      // the one on the left, which the narrow test page shows.
      this.fire(on.target, 'mouseleave', 0, 0);
      on = this.pointOn(el, chart, 'band', 0);
      x.test(!! on, 'Gauge: a pointer over a band lands on the band');
      if ( ! on ) return;
      this.fire(on.target, 'mousemove', on.x, on.y);
      text = el.querySelector('.' + chart.myClass('tooltip')).textContent;
      x.test(text.indexOf(chart.BAND + ': 0 – 50') !== -1, 'Gauge: hovering a band names it. Got ' + text);
      this.unmount(chart);

      // The ring shows every band whole, whatever the value: red is 0 to 5,000
      // of 10,000 although 8,231 has passed it.
      chart = this.GaugeChart.create({
        max: 10000,
        datasets: [ { data: [ 8231 ] } ],
        bands: [ { upTo: 5000, color: '#ff0000' }, { upTo: 8000, color: '#ffaa00' }, { upTo: 10000, color: '#00ff00' } ]
      }, x);
      el = await this.mount(chart);
      var starts = this.all(el, chart, 'band').map(function(b) {
        var m = /^M([-\d.e]+),([-\d.e]+)/.exec(b.getAttribute('d'));
        var g = this.gaugeGeometry(el, chart);
        return 1 - Math.atan2(g.cy - Number(m[2]), Number(m[1]) - g.cx) / Math.PI;
      }, this);
      var stops = [ 0, 1, 2 ].map(function(i) { return this.gaugeFraction(el, chart, 'band', i); }, this);
      x.test(Math.abs(starts[0]) < 0.001 && Math.abs(stops[0] - 0.5) < 0.001 && Math.abs(stops[1] - 0.8) < 0.001 && Math.abs(stops[2] - 1) < 0.001,
        'Gauge: every band is drawn at its full angle, red 0 to 5,000 of 10,000, with the value at 8,231. Got ' + starts.join() + ' / ' + stops.join());
      x.test(Math.abs(this.gaugeFraction(el, chart, 'value-arc') - 0.8231) < 0.001 && this.all(el, chart, 'value-arc')[0].getAttribute('fill') === '#00ff00',
        'Gauge: the value arc stops at 8,231 in its band colour');
      this.unmount(chart);

      // Past the last band's end the value stays in the last band.
      chart = this.GaugeChart.create({ datasets: [ { data: [ 130 ] } ], bands: [ { upTo: 50, color: '#ff0000' }, { upTo: 100, color: '#00ff00' } ] }, x);
      x.test(chart.bandOf_(130).color === '#00ff00' && chart.bandOf_(-5).color === '#ff0000', 'Gauge: a value past the bands is in the last, one before the dial in the first');
    },

    async function testGaugeEdges(x) {
      // A value past either end: the arc stops at the end of the dial, and the label keeps the real number.
      var chart = this.GaugeChart.create({ datasets: [ { data: [ 500 ] } ] }, x);
      var el = await this.mount(chart);
      x.test(Math.abs(this.gaugeFraction(el, chart, 'value-arc') - 1) < 0.001, 'Gauge: 500 on a 0 to 100 dial fills the whole dial');
      x.test(this.texts(el, chart, 'value') === '500', 'Gauge: the label shows the real 500. Got ' + this.texts(el, chart, 'value'));
      this.unmount(chart);

      chart = this.GaugeChart.create({ min: 10, datasets: [ { data: [ -5 ] } ] }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'value-arc').length === 0 && this.texts(el, chart, 'value') === '-5', 'Gauge: a value below min draws no arc, and the label shows -5');
      this.unmount(chart);

      // No value: only the track.
      chart = this.GaugeChart.create({ datasets: [ { data: [ null ] } ] }, x);
      el = await this.mount(chart);
      var on = this.pointOn(el, chart, 'track');
      this.fire(on.target, 'mousemove', on.x, on.y);
      x.test(this.all(el, chart, 'track').length === 1 && this.all(el, chart, 'value-arc').length === 0 && this.all(el, chart, 'value').length === 0,
        'Gauge: with no value only the track is drawn');
      x.test(! chart.tooltip_.element_ || getComputedStyle(chart.tooltip_.element_).display === 'none', 'Gauge: with no value there is no tooltip');
      this.unmount(chart);

      // max not above min: no division by zero.
      chart = this.GaugeChart.create({ min: 5, max: 5, datasets: [ { data: [ 5 ] } ] }, x);
      el = await this.mount(chart);
      x.test(this.all(el, chart, 'value-arc').length === 0 && !! el.querySelector('svg'), 'Gauge: an empty range draws the track and no arc');
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
    },

    function flowGeometry(band) {
      // A band's path is M x,y C ... L x,y C ... Z: its height where it leaves
      // the source and where it reaches the target, and where each starts.
      var n = this.pathNumbers(band);
      return { sourceY: n[1], sourceHeight: n[15] - n[1], targetY: n[7], targetHeight: n[9] - n[7] };
    },

    async function testSankey(x) {
      var clicks = [];
      var chart = this.SankeyChart.create({
        labels: [ 'Cart', 'Search' ],
        datasets: [
          { label: 'Home',   data: [ 30, 70 ],   backgroundColor: '#ff0000' },
          { label: 'Offers', data: [ 10, null ], backgroundColor: '#0000ff' }
        ],
        onFlowClick: function(s, t) { clicks.push([ s, t ]); }
      }, x);
      var el    = await this.mount(chart);
      var flows = this.all(el, chart, 'flow');
      var nodes = this.all(el, chart, 'node');
      x.test(flows.length === 3, 'Sankey: one band for each pair with a value, none for the null. Got ' + flows.length);
      x.test(nodes.length === 4, 'Sankey: two source nodes and two target nodes. Got ' + nodes.length);

      // Draw order: Home to Cart, Home to Search, Offers to Cart; nodes are
      // Home, Offers, then Cart, Search.
      var g = flows.map(this.flowGeometry, this);
      var unit = g[0].sourceHeight / 30;
      x.test(unit > 0 && Math.abs(g[1].sourceHeight / 70 - unit) < 0.01 && Math.abs(g[2].sourceHeight / 10 - unit) < 0.01,
        'Sankey: a band is as thick as its value, 30, 70, 10. Got ' + g.map(function(b) { return b.sourceHeight; }).join());
      x.test(g.every(function(b) { return Math.abs(b.sourceHeight - b.targetHeight) < 0.01; }), 'Sankey: a band is as thick where it arrives as where it leaves');
      var h = nodes.map(function(n) { return this.num(n, 'height'); }, this);
      x.test(Math.abs(h[0] / unit - 100) < 0.01 && Math.abs(h[1] / unit - 10) < 0.01 && Math.abs(h[2] / unit - 40) < 0.01 && Math.abs(h[3] / unit - 70) < 0.01,
        'Sankey: a node is as tall as its total, on the same scale in both columns (100, 10, 40, 70). Got ' + h.map(function(v) { return v / unit; }).join());
      var y = nodes.map(function(n) { return this.num(n, 'y'); }, this);
      x.test(Math.abs(y[1] - ( y[0] + h[0] ) - chart.NODE_GAP_PX) < 0.01 && Math.abs(y[3] - ( y[2] + h[2] ) - chart.NODE_GAP_PX) < 0.01,
        'Sankey: nodes of a column are stacked with the documented gap. Got ' + ( y[1] - y[0] - h[0] ) + ' and ' + ( y[3] - y[2] - h[2] ));
      x.test(this.num(nodes[0], 'x') < this.num(nodes[2], 'x') && this.num(nodes[0], 'x') === this.num(nodes[1], 'x') && this.num(nodes[2], 'x') === this.num(nodes[3], 'x'),
        'Sankey: sources are the left column and targets the right');

      // A band leaves its source in target order and reaches its target in source order.
      x.test(g[0].sourceY < g[1].sourceY && Math.abs(g[1].sourceY - ( g[0].sourceY + g[0].sourceHeight )) < 0.01,
        'Sankey: Home hands out its height in target order, Cart then Search');
      x.test(g[0].targetY < g[2].targetY && Math.abs(g[2].targetY - ( g[0].targetY + g[0].targetHeight )) < 0.01,
        'Sankey: Cart receives in source order, Home then Offers');
      x.test(Math.abs(g[0].sourceY - y[0]) < 0.01 && Math.abs(g[2].targetY - ( y[2] + g[0].targetHeight )) < 0.01, 'Sankey: bands start at their node\'s edge');

      x.test(flows[0].getAttribute('fill') === '#ff0000' && flows[2].getAttribute('fill') === '#0000ff', 'Sankey: a band takes its source\'s colour. Got ' + flows.map(function(f) { return f.getAttribute('fill'); }).join());
      x.test(Number(flows[0].getAttribute('fill-opacity')) === chart.bandOpacity && chart.bandOpacity > 0 && chart.bandOpacity < 1, 'Sankey: bands are semi-transparent by default. Got ' + flows[0].getAttribute('fill-opacity'));
      x.test(nodes[0].getAttribute('fill') === '#ff0000' && nodes[1].getAttribute('fill') === '#0000ff' && nodes[2].getAttribute('fill') === nodes[3].getAttribute('fill') && nodes[2].getAttribute('fill').indexOf('$') === -1,
        'Sankey: source nodes take their colour, target nodes share a resolved neutral colour. Got ' + nodes.map(function(n) { return n.getAttribute('fill'); }).join());

      var labels = this.all(el, chart, 'node-label');
      x.test(labels.map(function(t) { return t.textContent; }).join() === 'Home,Offers,Cart,Search', 'Sankey: names are written beside the nodes. Got ' + this.texts(el, chart, 'node-label'));
      x.test(labels[0].getAttribute('text-anchor') === 'end' && labels[2].getAttribute('text-anchor') === 'start' && this.num(labels[0], 'x') < this.num(nodes[0], 'x') && this.num(labels[2], 'x') > this.num(nodes[2], 'x') + this.num(nodes[2], 'width'),
        'Sankey: source names sit left of the left column and target names right of the right column');

      // Hover.
      var c = this.centreOf(flows[1]);
      this.fire(flows[1], 'mousemove', c.x, c.y);
      var tip = el.querySelector('.' + chart.myClass('tooltip'));
      x.test(this.visible(tip) && tip.textContent.indexOf('Home → Search: 70') !== -1, 'Sankey: hovering a band shows "source → target: value". Got ' + tip.textContent);
      c = this.centreOf(nodes[2]);
      this.fire(nodes[2], 'mousemove', c.x, c.y);
      x.test(tip.textContent.indexOf('Cart') === 0 && tip.textContent.indexOf('In: 40') !== -1 && tip.textContent.indexOf('Out: 0') !== -1,
        'Sankey: hovering a target shows its total in and out. Got ' + tip.textContent);
      c = this.centreOf(nodes[0]);
      this.fire(nodes[0], 'mousemove', c.x, c.y);
      x.test(tip.textContent.indexOf('Home') === 0 && tip.textContent.indexOf('Out: 100') !== -1 && tip.textContent.indexOf('In: 0') !== -1,
        'Sankey: hovering a source shows its total in and out. Got ' + tip.textContent);
      this.fire(nodes[0], 'mouseleave', 0, 0);
      x.test(! this.visible(tip), 'Sankey: the tooltip goes when the pointer leaves');

      // Click.
      this.fire(flows[1], 'click', 0, 0);
      this.fire(flows[2], 'click', 0, 0);
      x.test(JSON.stringify(clicks) === '[[0,1],[1,0]]', 'Sankey: a click gives the source and target index. Got ' + JSON.stringify(clicks));
      x.test(el.classList.contains(chart.myClass('clickable')), 'Sankey: a chart with onFlowClick shows a pointer');

      // Legend: one entry per source; a click hides that source and the layout is worked out again.
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.map(function(i) { return i.textContent; }).join() === 'Home,Offers', 'Sankey: the legend has one entry per source. Got ' + items.map(function(i) { return i.textContent; }).join());
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'flow').length === 2; }.bind(this));
      flows = this.all(el, chart, 'flow');
      nodes = this.all(el, chart, 'node');
      x.test(flows.length === 2 && nodes.length === 3, 'Sankey: hiding Offers removes its band and its node. Got ' + flows.length + ' bands, ' + nodes.length + ' nodes');
      h = nodes.map(function(n) { return this.num(n, 'height'); }, this);
      x.test(Math.abs(h[1] / h[2] - 30 / 70) < 0.001 && h[0] > h[1], 'Sankey: Cart drops to 30 and the nodes are laid out again, 30 against 70. Got ' + h.join());
      items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      items[1].click();
      await this.redraw(function() { return this.all(el, chart, 'flow').length === 3; }.bind(this));
      x.test(this.all(el, chart, 'flow').length === 3, 'Sankey: a second click shows Offers again');
      this.unmount(chart);

      // bandOpacity is an option, and without a click handler nothing shows a pointer.
      chart = this.SankeyChart.create({ labels: [ 'A' ], datasets: [ { label: 'S', data: [ 5 ] } ], bandOpacity: 0.8 }, x);
      el    = await this.mount(chart);
      x.test(Number(this.all(el, chart, 'flow')[0].getAttribute('fill-opacity')) === 0.8, 'Sankey: bandOpacity sets the opacity of the bands');
      x.test(! el.classList.contains(chart.myClass('clickable')), 'Sankey: with no onFlowClick the bands are not clickable');
      x.test(this.all(el, chart, 'flow')[0].getAttribute('fill').toLowerCase() === chart.defaultColor(0).toLowerCase(), 'Sankey: with no colour set a source takes the first theme colour');
      this.unmount(chart);
    },

    async function testSankeyEdges(x) {
      // A zero, a negative number, text and a missing value are no band.
      var chart = this.SankeyChart.create({ labels: [ 'A', 'B', 'C', 'D', 'E' ], datasets: [ { label: 'S', data: [ 0, -4, 'x', undefined, 3 ] } ] }, x);
      var el    = await this.mount(chart);
      x.test(this.all(el, chart, 'flow').length === 1 && this.all(el, chart, 'node').length === 2,
        'Sankey: zero, negative, text and missing values draw no band and no node. Got ' + this.all(el, chart, 'flow').length + ' bands, ' + this.all(el, chart, 'node').length + ' nodes');
      this.unmount(chart);

      // A source with no band shows hidden in the legend and draws no node.
      chart = this.SankeyChart.create({ labels: [ 'A' ], datasets: [ { label: 'Full', data: [ 5 ] }, { label: 'Empty', data: [ null ] } ] }, x);
      el    = await this.mount(chart);
      var items = Array.from(el.querySelectorAll('.' + this.legendClass('item')));
      x.test(items.length === 2 && items[1].classList.contains(this.legendClass('hidden')) && this.all(el, chart, 'node').length === 2,
        'Sankey: a source with no value is hidden in the legend and has no node');
      this.unmount(chart);

      // Nothing to draw: nothing drawn, nothing thrown.
      chart = this.SankeyChart.create({ labels: [ 'A' ], datasets: [ { label: 'S', data: [ null ] } ] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'flow').length === 0 && this.all(el, chart, 'node').length === 0, 'Sankey: with no values nothing is drawn');
      this.unmount(chart);
      chart = this.SankeyChart.create({ labels: [], datasets: [] }, x);
      el    = await this.mount(chart);
      x.test(this.all(el, chart, 'flow').length === 0, 'Sankey: with no sources nothing is drawn');
      this.unmount(chart);

      // Long names are cut short, so the bands keep their room; the full name is in the tooltip.
      var long = 'A very long entry page name that would take half of the chart';
      chart = this.SankeyChart.create({ labels: [ long ], datasets: [ { label: long, data: [ 5 ] } ] }, x);
      el    = await this.mount(chart);
      var texts = this.all(el, chart, 'node-label');
      x.test(texts.length === 2 && texts.every(function(t) { return t.textContent.slice(-1) === '…'; }), 'Sankey: long names end in an ellipsis. Got ' + this.texts(el, chart, 'node-label'));
      var n = this.all(el, chart, 'node');
      x.test(this.num(n[1], 'x') - ( this.num(n[0], 'x') + this.num(n[0], 'width') ) > 600 / 3, 'Sankey: the bands keep at least a third of the width');
      var c = this.centreOf(n[0]);
      this.fire(n[0], 'mousemove', c.x, c.y);
      x.test(el.querySelector('.' + chart.myClass('tooltip')).textContent.indexOf(long) === 0, 'Sankey: the tooltip names the node in full');
      this.unmount(chart);

      // Many nodes: the gap shrinks so each keeps a height and the column fits the plot.
      var data = [], labels = [];
      for ( var i = 0 ; i < 40 ; i++ ) { labels.push('T' + i); data.push(1); }
      chart = this.SankeyChart.create({ labels: labels, datasets: [ { label: 'S', data: data } ] }, x);
      el    = await this.mount(chart);
      n = this.all(el, chart, 'node');
      var targets = n.slice(1);
      var top = this.num(targets[0], 'y'), last = targets[targets.length - 1];
      x.test(targets.length === 40 && targets.every(function(t) { return this.num(t, 'height') > 1; }, this) && top >= 0 && this.num(last, 'y') + this.num(last, 'height') <= el.querySelector('svg').getBoundingClientRect().height + 0.5,
        'Sankey: 40 targets still fit the plot with a height each');
      this.unmount(chart);
    }
  ]
});
