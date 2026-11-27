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
    'foam.u2.chart.LineChart',
    'foam.u2.chart.PieChart',
    'foam.u2.chart.ScatterChart'
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
    }
  ]
});
