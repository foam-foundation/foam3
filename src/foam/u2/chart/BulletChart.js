/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'BulletChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    One value per category against a target, drawn as a row of shaded ranges
    with a thin bar for the value and a short tick for the target. labels name
    the rows, top to bottom, and the first dataset holds one value per row:
    labels: [ 'Mon', 'Tue' ], datasets: [ { label: 'Requests', data: [ 70, 40 ] } ],
    target: 60 draws two rows with the first bar passing the tick at 60 and
    the second stopping short of it.

    bands are the ranges behind every row, for example poor up to 50, fair up
    to 80 and good up to 100. They are shaded from light to dark in order
    unless a band has a colour of its own. All rows share one value axis along
    the bottom, which reaches the largest of the values, the target and the
    last band's upTo. With no target set no tick is drawn.

    A negative value draws its bar to the left of 0. A value that is not a
    number leaves its row with ranges and tick but no bar.

    Hovering a row shows its value, the target and the band the value is in; a
    value past the last band's upTo counts as in the last band. The legend is
    off by default and lists the bands when on; a click on an entry hides
    nothing. Clicking a row calls onRowClick(index, event).
  `,

  requires: [
    'foam.u2.chart.BandScale',
    'foam.u2.chart.GaugeBand',
    'foam.u2.chart.LinearScale'
  ],

  constants: [
    {
      name: 'ROW_SHARE',
      documentation: 'How much of its slot a row of ranges fills, the rest being the gap between rows: 0.7 on a 50 pixel slot is a 35 pixel row.',
      value: 0.7
    },
    {
      name: 'MAX_ROW_PX',
      documentation: 'Tallest a row of ranges is drawn, so three rows on a tall card are not three huge slabs.',
      value: 40
    },
    {
      name: 'BAR_SHARE',
      documentation: 'Height of the value bar as a share of the row: a third of a 30 pixel row is a 10 pixel bar.',
      value: 1 / 3
    },
    {
      name: 'TARGET_SHARE',
      documentation: 'Height of the target tick as a share of the row, taller than the bar and shorter than the ranges.',
      value: 0.6
    },
    {
      name: 'TARGET_PX',
      documentation: 'Thickness of the target tick, so it stays visible on a narrow card.',
      value: 3
    },
    {
      name: 'BAND_SHADES',
      documentation: 'Theme tokens for ranges with no colour of their own, from light to dark. Three ranges take the first, third and fifth.',
      value: [ '$grey200', '$grey300', '$grey400', '$grey500', '$grey600' ]
    }
  ],

  css: `
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }
    <<target { stroke: $textDefault; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<value-bar {
        animation-name: foam-u2-chart-BulletChart-grow;
        animation-timing-function: ease-out;
        transform-box: fill-box;
        transform-origin: 0 50%;
      }
    }
    @keyframes foam-u2-chart-BulletChart-grow { from { transform: scaleX(0); } }
  `,

  messages: [
    { name: 'TARGET_NAME', message: 'Target' },
    { name: 'BAND', message: 'Band' }
  ],

  properties: [
    {
      class: 'Double',
      name: 'target',
      documentation: 'Where the tick stands on the value axis, the same for every row. Left unset, no tick is drawn.'
    },
    {
      class: 'FObjectArray',
      of: 'foam.u2.chart.GaugeBand',
      name: 'bands',
      documentation: 'The ranges behind each row. A plain object such as { upTo, color } adapts to a GaugeBand; with no color the range takes a grey shade.'
    },
    {
      class: 'Function',
      name: 'onRowClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (index, event) when a row is clicked, index being the position in labels.'
    },
    {
      // The legend explains the bands, which a bullet row already shows.
      name: 'showLegend',
      value: false
    },
    {
      // The legend explains the ranges; hiding one would change nothing.
      name: 'legendClickable',
      value: false
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onRowClick$.map(function(f) { return !! f; }));
    },

    function values_() {
      // The first dataset's value for each label, or null where it is not a number.
      var ds = this.datasets[0];
      return this.labels.map(function(l, j) {
        var v = ds && ds.data ? ds.data[j] : null;
        return typeof v === 'number' && isFinite(v) ? v : null;
      });
    },

    function hasTarget_() {
      return this.hasOwnProperty('target') && isFinite(this.target);
    },

    function range_(values) {
      // The lowest and highest the value axis must reach: 0 or below, and the
      // largest of the values, the target and every band's end.
      var nums = values.filter(function(v) { return v !== null; });
      if ( this.hasTarget_() ) nums.push(this.target);
      this.bands.forEach(function(b) { if ( isFinite(b.upTo) ) nums.push(b.upTo); });
      return [ Math.min.apply(null, nums.concat(0)), Math.max.apply(null, nums.concat(0)) ];
    },

    function shade_(i, n) {
      // The token for range i of n: the first takes the lightest shade, the
      // last the darkest, one range sits in the middle.
      var last = this.BAND_SHADES.length - 1;
      return this.BAND_SHADES[n < 2 ? Math.floor(last / 2) : Math.round(i * last / ( n - 1 ))];
    },

    function bandRanges_(low) {
      // The bands in order of upTo, each as { from, to, color }: a band starts
      // where the one before it ends, and the first at low.
      var self = this;
      var from = low;
      var live = this.bands
        .filter(function(b) { return isFinite(b.upTo); })
        .sort(function(a, b) { return a.upTo - b.upTo; });
      return live.map(function(b, i) {
        var range = {
          from:  from,
          to:    b.upTo,
          color: foam.CSS.returnTokenValue(b.color || self.shade_(i, live.length), self.cls_, self.__subContext__)
        };
        from = b.upTo;
        return range;
      });
    },

    function bandOf_(ranges, v) {
      // The band v is in: the first whose end reaches it, or the last band
      // for a value past them all. Null when there are no bands.
      return ranges.find(function(r) { return v <= r.to; }) || ranges[ranges.length - 1] || null;
    },

    function bandLabel_(range) {
      return this.formatValue(range.from) + ' – ' + this.formatValue(range.to);
    },

    function legendItems() {
      var self = this;
      return this.bandRanges_(this.range_(this.values_())[0]).map(function(r) {
        return { label: self.bandLabel_(r), color: r.color, hidden: false };
      });
    },

    function drawChart(svg, w, h) {
      var self    = this;
      var labels  = this.labels.map(String);
      var n       = labels.length;
      var values  = this.values_();
      var range   = this.range_(values);
      var ranges  = this.bandRanges_(range[0]);
      var fit = this.layoutForValues(w, h, labels, true,
        function(count) { return self.LinearScale.create({ min: range[0], max: range[1], tickCount: count }).nice(); },
        function(scale) { return scale.ticks(); });
      var a      = fit.area;
      var vScale = fit.scale;

      var band = this.BandScale.create({ count: n, start: a.top, end: a.top + a.height });
      vScale.start = a.left;
      vScale.end   = a.left + a.width;

      var catTicks = labels.map(function(l, j) { return { pos: band.center(j), label: l }; });
      var valTicks = vScale.ticks().map(function(t) { return { pos: vScale.map(t), label: vScale.format(t) }; });
      this.drawAxes(svg, a, valTicks, catTicks);

      var slot  = Math.abs(band.step());
      var rowH  = Math.min(slot * this.ROW_SHARE, this.MAX_ROW_PX);
      var barH  = rowH * this.BAR_SHARE;
      var tickH = rowH * this.TARGET_SHARE;
      var zero  = vScale.map(0);
      var barColor = this.seriesColor(0);

      svg.start('g').forEach(labels, function(l, j) {
        var c = band.center(j);
        var g = this;
        ranges.forEach(function(r) {
          var x0 = vScale.map(Math.max(r.from, vScale.min)), x1 = vScale.map(Math.min(r.to, vScale.max));
          if ( x1 <= x0 ) return;
          g.start('rect').addClass(self.myClass('range'))
            .attrs({ x: x0, y: c - rowH / 2, width: x1 - x0, height: rowH, fill: r.color })
          .end();
        });
        var v = values[j];
        if ( v !== null && vScale.map(v) !== zero ) {
          var p = vScale.map(v);
          g.start('rect').addClass(self.myClass('value-bar'))
            .attrs({ x: Math.min(zero, p), y: c - barH / 2, width: Math.abs(p - zero), height: barH, fill: barColor })
          .end();
        }
        if ( self.hasTarget_() ) {
          var tx = vScale.map(self.target);
          g.start('line').addClass(self.myClass('target'))
            .attrs({ x1: tx, x2: tx, y1: c - tickH / 2, y2: c + tickH / 2, 'stroke-width': self.TARGET_PX })
          .end();
        }
      }).end();

      // One transparent row on top of each row's marks catches the pointer,
      // so the whole row, not just a thin bar, shows the tooltip and clicks.
      svg.start('g').forEach(labels, function(l, j) {
        this.start('rect').addClass(self.myClass('hit'))
          .attrs({ x: a.left, y: band.center(j) - slot / 2, width: a.width, height: slot })
          .on('mousemove', function(evt) { self.showRowTooltip_(evt, j, ranges); })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) { if ( self.onRowClick ) self.onRowClick(j, evt); })
        .end();
      }).end();
    },

    function showRowTooltip_(evt, j, ranges) {
      var v    = this.values_()[j];
      var rows = [];
      if ( v !== null ) rows.push({ color: this.seriesColor(0), label: this.datasets[0].label || '', value: this.formatValue(v) });
      if ( this.hasTarget_() ) rows.push({ label: this.TARGET_NAME, value: this.formatValue(this.target) });
      var inBand = v === null ? null : this.bandOf_(ranges, v);
      if ( inBand ) rows.push({ color: inBand.color, label: this.BAND, value: this.bandLabel_(inBand) });
      this.showTooltip(evt, this.labels[j], rows);
    }
  ]
});
