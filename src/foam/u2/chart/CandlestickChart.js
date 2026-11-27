/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'CandlestickChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    One candle per time step: how a value moved during it. The first
    dataset's data is a list of { x, open, high, low, close }, x being a Date
    or a time in milliseconds:
    datasets: [ { data: [ { x: '2024-03-01', open: 10, high: 14, low: 8, close: 13 } ] } ].
    Time runs along the x axis, ticked on each timeUnit like a LineChart's
    time axis, and the value up the y axis, which stretches to the lowest low
    and the highest high rather than starting at zero.

    A thin line runs from the low to the high, and a box from the open to the
    close. The box is one colour when the close is at or above the open (a
    rise: 10 to 13 above) and another when it fell. The first dataset's
    backgroundColor may be a list of two colours, rise then fall; without it
    the colours come from the theme. An entry with a missing or non-number
    value, or a time that is not a date, is left out.

    The legend explains the two colours, and a click on it hides nothing.

    Hovering a candle shows its time, open, high, low and close. Clicking one
    calls onCandleClick(index, event), where index is the position of the
    candle in the dataset's data.
  `,

  requires: [
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.TimeScale',
    'foam.u2.chart.TimeUnit',
    'foam.u2.chart.XAxisType'
  ],

  constants: [
    {
      name: 'BOX_FILL',
      documentation: 'Share of the room between two candles that a box covers; 0.7 leaves 6 of 20 pixels free.',
      value: 0.7
    },
    {
      name: 'BOX_MAX_PX',
      documentation: 'Widest a box gets, so a few candles on a wide chart stay candles and not slabs.',
      value: 24
    },
    {
      name: 'MIN_BOX_PX',
      documentation: 'Thinnest a box gets, so 500 candles on a narrow chart still show.',
      value: 1
    },
    {
      name: 'MIN_BOX_HEIGHT_PX',
      documentation: 'Shortest a box gets, so a candle that closed where it opened (a flat box) is still a visible bar.',
      value: 1
    },
    {
      name: 'LINE_PX',
      documentation: 'Thickness of the line from the low to the high.',
      value: 1
    },
    {
      name: 'TIME_TICK_PX',
      documentation: 'About how far apart time ticks are, so a date label fits between two: a 600-pixel axis gets ten.',
      value: 60
    },
    {
      name: 'RISE_COLOR',
      documentation: 'Theme token for a candle that closed at or above its open, when the dataset sets no colour.',
      value: '$green400'
    },
    {
      name: 'FALL_COLOR',
      documentation: 'Theme token for a candle that closed below its open, when the dataset sets no colour.',
      value: '$red400'
    }
  ],

  css: `
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }
    <<wick { shape-rendering: crispEdges; pointer-events: none; }
    <<box { pointer-events: none; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<candles {
        animation-name: foam-u2-chart-CandlestickChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-CandlestickChart-fade { from { opacity: 0; } }
  `,

  messages: [
    { name: 'RISE',  message: 'Rise' },
    { name: 'FALL',  message: 'Fall' },
    { name: 'OPEN',  message: 'Open' },
    { name: 'HIGH',  message: 'High' },
    { name: 'LOW',   message: 'Low' },
    { name: 'CLOSE', message: 'Close' }
  ],

  properties: [
    {
      class: 'Enum',
      of: 'foam.u2.chart.TimeUnit',
      name: 'timeUnit',
      value: 'DAY',
      documentation: 'The period the x ticks mark: MINUTE for a candle a minute. A name such as \'hour\' adapts to its value.'
    },
    {
      class: 'Boolean',
      name: 'utc',
      documentation: 'Read the dates in UTC, for dates stored as midnight UTC. Off, times read in the viewer\'s zone.'
    },
    {
      class: 'Function',
      name: 'onCandleClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (index, event) when a candle is clicked.'
    },
    {
      // Hiding the rises would leave the falls alone on a scale made for both.
      name: 'legendClickable',
      value: false
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onCandleClick$.map(function(f) { return !! f; }));
    },

    function candles_() {
      // The first dataset's drawable entries as { j, t, open, high, low, close, rise }, in data
      // order: j is the position in data and t the time in milliseconds. An entry whose four
      // numbers are not all numbers, or whose x is not a date, has no candle.
      var xType = this.XAxisType.TIME;
      var data  = this.datasets.length ? this.datasets[0].data || [] : [];
      var out   = [];
      data.forEach(function(d, j) {
        if ( d == null || d.x == null ) return;
        var c = { j: j, t: xType.toX(d), open: d.open, high: d.high, low: d.low, close: d.close };
        var nums = [ c.open, c.high, c.low, c.close ];
        if ( ! isFinite(c.t) || ! nums.every(function(v) { return typeof v === 'number' && isFinite(v); }) ) return;
        c.rise = c.close >= c.open;
        out.push(c);
      });
      return out;
    },

    function kindColor_(rise) {
      var bg = this.datasets.length ? this.datasets[0].backgroundColor : null;
      var c  = Array.isArray(bg) ? bg[rise ? 0 : 1] : null;
      return c || foam.CSS.returnTokenValue(rise ? this.RISE_COLOR : this.FALL_COLOR, this.cls_, this.__subContext__);
    },

    function legendItems() {
      if ( ! this.candles_().length ) return [];
      return [
        { label: this.RISE, color: this.kindColor_(true),  hidden: false },
        { label: this.FALL, color: this.kindColor_(false), hidden: false }
      ];
    },

    function drawChart(svg, w, h) {
      var self    = this;
      var xType   = this.XAxisType.TIME;
      var candles = this.candles_();

      var ts = candles.map(function(c) { return c.t; });
      var xr = xType.range(ts);
      // High and low bound the candle; open and close are included so an entry whose
      // high or low is wrong still stays inside the plot.
      var ys = [];
      candles.forEach(function(c) { ys.push(c.open, c.high, c.low, c.close); });
      var lo = ys.length ? Math.min.apply(null, ys) : 0;
      var hi = ys.length ? Math.max.apply(null, ys) : 1;

      var xAxis  = xType.scale(this, xr[0], xr[1], w);
      var xScale = xAxis.scale;
      var xLabel = function(v, long) { return xType.tickLabel(xScale, [], v, long); };

      var fit = this.layoutForValues(w, h, xAxis.ticks.map(function(v) { return xLabel(v); }), false,
        function(n) { return self.LinearScale.create({ min: lo, max: hi, tickCount: n }).nice(); },
        function(s) { return s.ticks(); });
      var a      = fit.area;
      var yScale = fit.scale;
      yScale.start = a.top + a.height; yScale.end = a.top;
      // Inset the time axis by half the widest box, so a candle at either end stays inside the plot.
      var pad = this.BOX_MAX_PX / 2;
      xScale.start = a.left + pad; xScale.end = a.left + a.width - pad;

      this.drawAxes(svg, a,
        xAxis.ticks.map(function(v) { return { pos: xScale.map(v), label: xLabel(v) }; }),
        yScale.ticks().map(function(t) { return { pos: yScale.map(t), label: yScale.format(t) }; }));

      // The room each candle has is the gap to its nearest neighbour, so the boxes never touch.
      var xs  = ts.map(function(t) { return xScale.map(t); }).sort(function(l, r) { return l - r; });
      var gap = Infinity;
      xs.forEach(function(x, k) { if ( k && x > xs[k - 1] ) gap = Math.min(gap, x - xs[k - 1]); });
      var room = Math.min(gap, this.BOX_MAX_PX / this.BOX_FILL);
      var bw   = Math.max(this.MIN_BOX_PX, room * this.BOX_FILL);

      svg.start('g').addClass(this.myClass('candles')).forEach(candles, function(c) {
        var cx = xScale.map(c.t), color = self.kindColor_(c.rise);
        var yo = yScale.map(c.open), yc = yScale.map(c.close);
        var top = Math.min(yo, yc), height = Math.max(self.MIN_BOX_HEIGHT_PX, Math.abs(yo - yc));
        this.start('line').addClass(self.myClass('wick'))
          .attrs({ x1: cx, x2: cx, y1: yScale.map(c.high), y2: yScale.map(c.low), stroke: color, 'stroke-width': self.LINE_PX })
        .end()
        .start('rect').addClass(self.myClass('box'))
          .attrs({ x: cx - bw / 2, y: top, width: bw, height: height, fill: color })
        .end();
      }).end();

      // One transparent column per candle on top, so a thin box can still be hovered and clicked.
      svg.start('g').forEach(candles, function(c) {
        this.start('rect').addClass(self.myClass('hit'))
          .attrs({ x: xScale.map(c.t) - room / 2, y: a.top, width: room, height: a.height })
          .on('mousemove', function(evt) { self.showCandleTooltip_(evt, c, xLabel(c.t, true)); })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) { if ( self.onCandleClick ) self.onCandleClick(c.j, evt); })
        .end();
      }).end();
    },

    function showCandleTooltip_(evt, c, title) {
      var color = this.kindColor_(c.rise), self = this;
      var rows  = [
        [ this.OPEN, c.open ], [ this.HIGH, c.high ], [ this.LOW, c.low ], [ this.CLOSE, c.close ]
      ].map(function(r) { return { color: color, label: r[0], value: self.formatValue(r[1]) }; });
      this.showTooltip(evt, title, rows);
    }
  ]
});
