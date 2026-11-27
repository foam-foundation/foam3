/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'HistogramChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    The distribution of numbers. Each dataset's data is a plain list of the
    raw values, such as response times:
    datasets: [ { label: 'GET', data: [ 120, 135, 80, 410, 95 ] } ].
    The chart cuts the range of the visible values into bins of equal width
    and draws one bar per bin, its height the number of values in it. Bars
    touch, since a bin ends where the next one starts. The x axis is the
    value axis, labelled at the bin edges; the y axis is the count.

    binCount asks for about that many bins. Edges land on round numbers (a
    step of 1, 2 or 5 times a power of ten), so values from 3 to 87 with
    binCount 10 give 9 bins of width 10, from 0 to 90. A bin holds its lower
    edge and not its upper one, except the last, which holds both.

    With several datasets the bins are shared and the bars of one bin stand
    side by side, one colour each. Side by side, not overlaid: overlaid bars
    hide each other where the series overlap, which is exactly where the
    series are compared, and three transparent colours mix into a fourth that
    belongs to no legend entry. Hiding a dataset in the legend recomputes the
    bins from what is left.

    Hovering a bar shows its bin range and the count of its dataset. Clicking
    a bar calls onBinClick(datasetIndex, binIndex, event).
  `,

  requires: [
    'foam.u2.chart.LinearScale'
  ],

  constants: [
    {
      name: 'MAX_BINS',
      documentation: 'Most bins binCount may ask for, so a huge number cannot build thousands of bars: 100 asked for gives at most 101 bins, and a LinearScale lists at most 200 ticks.',
      value: 100
    }
  ],

  css: `
    <<bar { stroke: $backgroundDefault; stroke-width: 1px; }
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<bar {
        animation-name: foam-u2-chart-HistogramChart-grow;
        animation-timing-function: ease-out;
        transform-box: fill-box;
        transform-origin: 50% 100%;
      }
    }
    @keyframes foam-u2-chart-HistogramChart-grow { from { transform: scaleY(0); } }
  `,

  properties: [
    {
      class: 'Int',
      name: 'binCount',
      value: 10,
      documentation: 'About how many bins to cut the range into; the edges are rounded to nice numbers, so the chart may draw a few more or fewer. Kept between 1 and MAX_BINS.'
    },
    {
      class: 'Function',
      name: 'onBinClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (datasetIndex, binIndex, event) when a bar is clicked. Binning gives the bin: bins().edges[binIndex] to bins().edges[binIndex + 1].'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onBinClick$.map(function(f) { return !! f; }));
    },

    function bins() {
      // The bins of the visible datasets:
      // { scale, edges: [0, 10, 20], counts: [ [3, 1], undefined, [0, 2] ], max }.
      // counts[i] is dataset i's count per bin and is undefined while its
      // legend entry is off; max is the tallest bar. Values that are not
      // finite numbers are left out. With no value at all there is one empty
      // bin, from 0 to 1, so the axes still draw.
      var self   = this;
      var values = [];
      this.datasets.forEach(function(ds, i) {
        values[i] = self.isHidden(i) ? null : ( ds.data || [] ).filter(function(v) {
          return typeof v === 'number' && isFinite(v);
        });
      });

      var all = [].concat.apply([], values.filter(function(v) { return v; }));
      var lo  = all.length ? all.reduce(function(m, v) { return Math.min(m, v); }, all[0]) : 0;
      var hi  = all.length ? all.reduce(function(m, v) { return Math.max(m, v); }, all[0]) : 0;

      var scale;
      if ( lo === hi ) {
        // Every value is equal. A scale would widen the flat range into
        // several bins; one bin of width 1 holds them: 5 is in 5 to 6.
        var floor = Math.floor(lo);
        scale = this.LinearScale.create({ min: floor, max: floor + 1, step: 1 });
      } else {
        var n = Math.max(1, Math.min(this.MAX_BINS, this.binCount));
        scale = this.LinearScale.create({ min: lo, max: hi, tickCount: n }).nice();
      }

      var edges  = scale.ticks();
      var bins   = edges.length - 1;
      var counts = [];
      var max    = 0;
      values.forEach(function(vs, i) {
        if ( ! vs ) return;
        var c = counts[i] = new Array(bins).fill(0);
        vs.forEach(function(v) {
          // The last bin also holds its upper edge, so the largest value is counted.
          var j = Math.min(bins - 1, Math.max(0, Math.floor(( v - scale.min ) / scale.step + scale.EPSILON)));
          max = Math.max(max, ++c[j]);
        });
      });
      return { scale: scale, edges: edges, counts: counts, max: max };
    },

    function countScale_(max, tickCount) {
      // The y axis. A count is whole, so the tick count never exceeds the
      // tallest bar: with 3 at most, ticks are 0, 1, 2, 3, never 0.5.
      return this.LinearScale.create({
        min: 0, max: max, tickCount: Math.max(1, Math.min(tickCount, max))
      }).nice();
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var b      = this.bins();
      var xScale = b.scale;
      var xLabel = b.edges.map(function(e) { return xScale.format(e); });
      var lay    = function(yScale) {
        return self.layout(w, h, xLabel, yScale.ticks().map(function(t) { return yScale.format(t); }));
      };

      // The tick count follows the plot height, and the plot height follows
      // the label widths: lay out once with a guess, size the axis, lay out again.
      var first  = lay(this.countScale_(b.max, this.FIRST_LAYOUT_TICKS));
      var yScale = this.countScale_(b.max, this.valueTickCount(first.height, this.VALUE_TICK_PX));
      var a      = lay(yScale);
      xScale.start = a.left;               xScale.end = a.left + a.width;
      yScale.start = a.top + a.height;     yScale.end = a.top;

      this.drawAxes(svg, a,
        b.edges.map(function(e) { return { pos: xScale.map(e), label: xScale.format(e) }; }),
        yScale.ticks().map(function(t) { return { pos: yScale.map(t), label: yScale.format(t) }; }));

      var sets = this.datasets
        .map(function(ds, i) { return { ds: ds, i: i }; })
        .filter(function(s) { return ! self.isHidden(s.i); });

      // One bar per bin and visible dataset, the bars of a bin side by side.
      svg.start('g').forEach(b.edges.slice(0, -1), function(e, j) {
        var x0 = xScale.map(e);
        var bw = ( xScale.map(b.edges[j + 1]) - x0 ) / sets.length;
        this.forEach(sets, function(s, k) {
          var c = b.counts[s.i][j];
          if ( ! c ) return;
          var top = yScale.map(c);
          this.start('rect').addClass(self.myClass('bar'))
            .attrs({ x: x0 + k * bw, y: top, width: bw, height: yScale.map(0) - top, fill: self.seriesColor(s.i) })
          .end();
        });
      }).end();

      // A transparent column the height of the plot over each bar, so a
      // short bar, or an empty one, is as easy to hover and click as a tall one.
      svg.start('g').forEach(b.edges.slice(0, -1), function(e, j) {
        var x0 = xScale.map(e);
        var bw = ( xScale.map(b.edges[j + 1]) - x0 ) / sets.length;
        this.forEach(sets, function(s, k) {
          this.start('rect').addClass(self.myClass('hit'))
            .attrs({ x: x0 + k * bw, y: a.top, width: bw, height: a.height })
            .on('mousemove', function(evt) { self.showBinTooltip_(evt, b, s, j); })
            .on('mouseleave', self.hideTooltip)
            .on('click', function(evt) { if ( self.onBinClick ) self.onBinClick(s.i, j, evt); })
          .end();
        });
      }).end();
    },

    function showBinTooltip_(evt, b, s, j) {
      var scale = b.scale;
      var title = scale.format(b.edges[j]) + ' – ' + scale.format(b.edges[j + 1]);
      this.showTooltip(evt, title, [
        { color: this.seriesColor(s.i), label: s.ds.label || '', value: this.formatValue(b.counts[s.i][j]) }
      ]);
    }
  ]
});
