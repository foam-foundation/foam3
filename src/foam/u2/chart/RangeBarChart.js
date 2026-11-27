/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'RangeBarChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    A timeline: one horizontal lane per label, with a bar floating from a start
    value to an end value. Each dataset's data holds one { start, end } per
    label, and null for a label with no bar:
    labels: [ '/home', '/cart' ],
    datasets: [ { label: 'Visits', data: [ { start: '2024-03-01T08:15', end: '2024-03-01T17:40' }, null ] } ].
    The first bar says that /home was visited from 08:15 to 17:40.

    The value axis runs along the bottom and is read like a LineChart's x axis:
    xType LINEAR reads start and end as numbers, TIME as dates, ticked on each
    timeUnit. An end before its start is read as the other way round. A bar
    whose start equals its end is MIN_BAR_PX wide, so it can still be seen.
    With several datasets, the bars of one lane stand one under the other.

    Hovering a lane shows its label and each bar's start, end and length, the
    length of a time bar written as "3h 25min". Clicking a lane calls
    onBarClick(datasetIndex, index, event).
  `,

  requires: [
    'foam.u2.chart.BandScale',
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.TimeScale',
    'foam.u2.chart.TimeUnit',
    'foam.u2.chart.XAxisType'
  ],

  constants: [
    {
      name: 'MIN_BAR_PX',
      documentation: 'Narrowest a bar gets, so a range of one instant (start equal to end) is still a visible mark.',
      value: 2
    },
    {
      name: 'TIME_TICK_PX',
      documentation: 'About how far apart time ticks are, so a date label fits between two: a 600-pixel axis gets ten.',
      value: 60
    },
    {
      name: 'MAX_DURATION_PARTS',
      documentation: 'Most units a length is written in: 3 days, 4 hours and 5 minutes reads "3d 4h".',
      value: 2
    }
  ],

  css: `
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }
    <<bar { pointer-events: none; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<bar {
        animation-name: foam-u2-chart-RangeBarChart-grow;
        animation-timing-function: ease-out;
        transform-box: fill-box;
        transform-origin: 0 50%;
      }
    }
    @keyframes foam-u2-chart-RangeBarChart-grow { from { transform: scaleX(0); } }
  `,

  messages: [
    { name: 'START',   message: 'Start' },
    { name: 'END',     message: 'End' },
    { name: 'LENGTH',  message: 'Length' },
    { name: 'UNIT_DAY',    message: 'd' },
    { name: 'UNIT_HOUR',   message: 'h' },
    { name: 'UNIT_MINUTE', message: 'min' },
    { name: 'UNIT_SECOND', message: 's' },
    { name: 'UNIT_MILLI',  message: 'ms' }
  ],

  properties: [
    {
      class: 'Enum',
      of: 'foam.u2.chart.XAxisType',
      name: 'xType',
      value: 'LINEAR',
      documentation: 'How start and end are read: LINEAR as numbers, TIME as dates. A name such as \'time\' adapts to its value.'
    },
    {
      class: 'Enum',
      of: 'foam.u2.chart.TimeUnit',
      name: 'timeUnit',
      value: 'DAY',
      documentation: 'For a time axis: the period its ticks mark. A unit too fine for the range moves up to the next that fits.'
    },
    {
      class: 'Boolean',
      name: 'utc',
      documentation: 'For a time axis: read the dates in UTC, for dates stored as midnight UTC. Off, times read in the viewer\'s zone.'
    },
    { name: 'xMin', documentation: 'Left end of the value axis: a number or a Date. Unset means the data decides.' },
    { name: 'xMax', documentation: 'Right end of the value axis. Unset means the data decides.' },
    {
      class: 'Function',
      name: 'onBarClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (datasetIndex, index, event) when a lane is clicked, index being its position in labels.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onBarClick$.map(function(f) { return !! f; }));
    },

    function isSet_(v) { return v !== undefined && v !== null && v !== ''; },

    function bar_(d) {
      // { lo, hi }, the range of one { start, end } as positions on the axis,
      // or null when it has no drawable range.
      if ( d == null || d.start == null || d.end == null ) return null;
      var s = this.xType.toX({ x: d.start }), e = this.xType.toX({ x: d.end });
      if ( ! isFinite(s) || ! isFinite(e) ) return null;
      return { lo: Math.min(s, e), hi: Math.max(s, e) };
    },

    function visibleSets_() {
      // The datasets not hidden, each with bars[j]: the bar of label j or null.
      var self = this;
      return this.datasets
        .map(function(ds, i) { return { ds: ds, i: i, bars: ( ds.data || [] ).map(function(d) { return self.bar_(d); }) }; })
        .filter(function(s) { return ! self.isHidden(s.i); });
    },

    function durationText_(ms) {
      // 12300000 -> "3h 25min": the largest units first, at most MAX_DURATION_PARTS of them.
      var U    = this.TimeUnit;
      var rest = Math.round(ms);
      var out  = [];
      [ [ U.DAY, this.UNIT_DAY ], [ U.HOUR, this.UNIT_HOUR ], [ U.MINUTE, this.UNIT_MINUTE ], [ U.SECOND, this.UNIT_SECOND ] ].forEach(function(u) {
        var n = Math.floor(rest / u[0].ms);
        if ( ! n ) return;
        out.push(n + u[1]);
        rest -= n * u[0].ms;
      });
      return out.length ? out.slice(0, this.MAX_DURATION_PARTS).join(' ') : rest + ' ' + this.UNIT_MILLI;
    },

    function timeText_(v, scale) {
      // A moment for the tooltip. Ticks of a day or more name the date; finer
      // ones need the time of day, to the second.
      if ( this.timeUnit.ms >= this.TimeUnit.DAY.ms ) return scale.format(v, true);
      var opts = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
      if ( this.utc ) opts.timeZone = 'UTC';
      return new Date(v).toLocaleString(foam.locale, opts);
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var labels = this.labels.map(String);
      var n      = labels.length;
      var xType  = this.xType;
      var sets   = this.visibleSets_();

      var xs = [];
      sets.forEach(function(s) { s.bars.forEach(function(b) { if ( b ) xs.push(b.lo, b.hi); }); });
      var xr = xType.range(xs, labels);
      var lo = this.isSet_(this.xMin) ? xType.parse(this.xMin) : xr[0];
      var hi = this.isSet_(this.xMax) ? xType.parse(this.xMax) : xr[1];

      // Lay out with the ticks a full-width axis gets, then again with the
      // ticks the plot's own width gets: the time axis picks its unit by width.
      var tickLabels = function(ax) { return ax.ticks.map(function(v) { return xType.tickLabel(ax.scale, labels, v); }); };
      var axis = xType.scale(this, lo, hi, w);
      var a    = this.layout(w, h, tickLabels(axis), labels);
      axis     = xType.scale(this, lo, hi, a.width);
      a        = this.layout(w, h, tickLabels(axis), labels);
      var xScale = axis.scale;
      xScale.start = a.left; xScale.end = a.left + a.width;

      var band = this.BandScale.create({ count: n, start: a.top, end: a.top + a.height });
      this.drawAxes(svg, a,
        axis.ticks.map(function(v) { return { pos: xScale.map(v), label: xType.tickLabel(xScale, labels, v) }; }),
        labels.map(function(l, j) { return { pos: band.center(j), label: l }; }));

      var step   = Math.abs(band.step());
      var groupW = sets.length ? band.bandwidth() / sets.length : 0;
      var clamp  = function(v) { return Math.max(a.left, Math.min(a.left + a.width, xScale.map(v))); };
      // The top of the first bar of lane j; the bars of one lane stand one under the other.
      var laneTop = function(j) { return band.center(j) - groupW * sets.length / 2; };

      svg.start('g').forEach(labels, function(l, j) {
        sets.forEach(function(s, k) {
          var b = s.bars[j];
          // A hand-set range can leave a bar out of the plot.
          if ( ! b || b.hi < xScale.min || b.lo > xScale.max ) return;
          var x0 = clamp(b.lo);
          this.start('rect').addClass(self.myClass('bar'))
            .attrs({ x: x0, y: laneTop(j) + k * groupW, width: Math.max(self.MIN_BAR_PX, clamp(b.hi) - x0), height: groupW, fill: self.seriesColor(s.i, j) })
          .end();
        }, this);
      }).end();

      // One transparent lane per label on top of the bars catches the pointer.
      svg.start('g').forEach(labels, function(l, j) {
        this.start('rect').addClass(self.myClass('hit'))
          .attrs({ x: a.left, y: band.center(j) - step / 2, width: a.width, height: step })
          .on('mousemove', function(evt) { self.showBarTooltip_(evt, j, sets, xScale); })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) {
            if ( ! self.onBarClick || ! sets.length ) return;
            var y = evt.clientY - evt.target.ownerSVGElement.getBoundingClientRect().top;
            var k = Math.max(0, Math.min(sets.length - 1, Math.floor(( y - laneTop(j) ) / groupW)));
            if ( sets[k].bars[j] ) self.onBarClick(sets[k].i, j, evt);
          })
        .end();
      }).end();
    },

    function showBarTooltip_(evt, j, sets, xScale) {
      // One series: its start, end and length. Several: a row for each.
      var self   = this;
      var isTime = this.xType === this.XAxisType.TIME;
      var text   = function(v) { return isTime ? self.timeText_(v, xScale) : self.formatValue(v); };
      var length = function(b) { return isTime ? self.durationText_(b.hi - b.lo) : self.formatValue(b.hi - b.lo); };
      var rows   = [];
      sets.forEach(function(s) {
        var b = s.bars[j];
        if ( ! b ) return;
        var color = self.seriesColor(s.i, j);
        if ( sets.length > 1 ) {
          rows.push({ color: color, label: s.ds.label || '', value: text(b.lo) + ' – ' + text(b.hi) + ' (' + length(b) + ')' });
        } else {
          rows.push({ color: color, label: self.START,  value: text(b.lo) },
                    { color: color, label: self.END,    value: text(b.hi) },
                    { color: color, label: self.LENGTH, value: length(b) });
        }
      });
      this.showTooltip(evt, this.labels[j], rows);
    }
  ]
});
