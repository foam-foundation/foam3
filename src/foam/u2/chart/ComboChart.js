/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'ComboChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    Bars and a line over the same categories, each with its own y axis: visits
    as bars on the left axis and the average load time as a line with dots on
    the right axis, say. labels name the categories. The first of datasets
    holds the bar values (one per label), the second the line values; a
    LineDataset's tension, borderWidth and pointRadius shape the line.

    Each axis has its own scale and title: yAxisLabel for the bars on the
    left, lineAxisLabel for the line on the right. The legend lists the two
    series, and a click hides one: its axis goes away and the other axis,
    now alone, rescales to its own values.

    Hovering a category shows one tooltip with the bar value and the line
    value. Clicking a category calls onCategoryClick(index, event).
  `,

  requires: [
    'foam.u2.chart.BandScale',
    'foam.u2.chart.LineDataset',
    'foam.u2.chart.LinearScale'
  ],

  constants: [
    {
      name: 'BAR',
      documentation: 'Position of the bar series in datasets, which is also its legend index.',
      value: 0
    },
    {
      name: 'LINE',
      documentation: 'Position of the line series in datasets, which is also its legend index.',
      value: 1
    }
  ],

  css: `
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }
    <<line { fill: none; stroke-linejoin: round; stroke-linecap: round; pointer-events: none; }
    <<dot  { pointer-events: none; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<bar {
        animation-name: foam-u2-chart-ComboChart-grow;
        animation-timing-function: ease-out;
        transform-box: fill-box;
        transform-origin: 50% 100%;
      }
      <<animated <<series {
        animation-name: foam-u2-chart-ComboChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-ComboChart-grow { from { transform: scaleY(0); } }
    @keyframes foam-u2-chart-ComboChart-fade { from { opacity: 0; transform: translateY(6px); } }
  `,

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.u2.chart.LineDataset',
      name: 'datasets',
      documentation: 'The bars, then the line. A plain object such as { label, data } adapts to a LineDataset.'
    },
    {
      class: 'String',
      name: 'lineAxisLabel',
      documentation: 'Title of the right y axis, the one the line reads against. yAxisLabel titles the bars\' axis on the left.'
    },
    {
      class: 'Int',
      name: 'barThickness',
      documentation: 'Widest a bar may be, in pixels; 0 lets the bars fill their band.'
    },
    {
      class: 'Function',
      name: 'onCategoryClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (index, event) when the category at that index is clicked.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onCategoryClick$.map(function(f) { return !! f; }));
    },

    function series_(i) {
      // The dataset at position i when it exists and the legend has not
      // hidden it, else null.
      return this.datasets[i] && ! this.isHidden(i) ? this.datasets[i] : null;
    },

    function numbers_(ds) {
      // The values of ds that are numbers, so a missing one adds nothing to a range.
      return ( ds.data || [] ).filter(function(v) { return typeof v === 'number' && isFinite(v); });
    },

    function extent_(values, opt_zero) {
      // [ lowest, highest ] of values; bars pass opt_zero so their range
      // holds 0, as a bar starts there. With no values, [ 0, 1 ], so an empty
      // chart still draws an axis.
      if ( opt_zero ) values = values.concat(0);
      if ( ! values.length ) return [ 0, 1 ];
      return [ Math.min.apply(null, values), Math.max.apply(null, values) ];
    },

    function yTitle_() {
      // With the bars hidden their axis is gone, and so is its title.
      return this.series_(this.BAR) ? this.yAxisLabel : '';
    },

    function rightRoom_(w, scale) {
      // How much narrower than the chart the plot must be so the right axis
      // fits beside it: its labels, its title and the gaps, less the margin
      // the plot already keeps on the right.
      if ( ! scale ) return 0;
      var self = this;
      var fp   = this.fontPx();
      var gap  = this.LABEL_GAP_PX;
      var cap  = Math.min(this.MAX_LABEL_PX, w * this.MAX_Y_LABEL_SHARE);
      var most = scale.ticks().reduce(function(m, t) { return Math.max(m, self.textWidth(scale.format(t))); }, 0);
      var room = Math.ceil(Math.min(cap, most)) + gap + ( this.lineAxisLabel ? fp + gap : 0 ) + this.EDGE_PX;
      return Math.max(0, room - this.RIGHT_PAD_PX);
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var labels = this.labels.map(String);
      var n      = labels.length;
      var bars   = this.series_(this.BAR);
      var line   = this.series_(this.LINE);

      var makeScale = function(range) {
        return function(count) { return self.LinearScale.create({ min: range[0], max: range[1], tickCount: count }).nice(); };
      };
      var barRange  = this.extent_(bars ? this.numbers_(bars) : [], true);
      var lineRange = this.extent_(line ? this.numbers_(line) : []);
      var lineScale = makeScale(lineRange);

      // The right axis takes room from the plot, and how many ticks it has
      // (so how wide its labels are) depends on the plot's height. Lay out
      // with a first guess, size the right axis from that plot, then lay out
      // again with the room it needs.
      var fit = function(room) {
        return self.layoutForValues(w - room, h, labels, false, makeScale(barRange),
          function(s) { return bars ? s.ticks() : []; });
      };
      var first = fit(this.rightRoom_(w, line && lineScale(this.FIRST_LAYOUT_TICKS)));
      var rScale = line && lineScale(this.valueTickCount(first.area.height, this.VALUE_TICK_PX));
      var layout = fit(this.rightRoom_(w, rScale));
      var a      = layout.area;
      var lScale = layout.scale;

      var band = this.BandScale.create({ count: n, start: a.left, end: a.left + a.width });
      lScale.start = a.top + a.height; lScale.end = a.top;
      if ( rScale ) { rScale.start = a.top + a.height; rScale.end = a.top; }

      var catTicks = labels.map(function(l, i) { return { pos: band.center(i), label: l }; });
      var barTicks = bars ? lScale.ticks().map(function(t) { return { pos: lScale.map(t), label: lScale.format(t) }; }) : [];
      this.drawAxes(svg, a, catTicks, barTicks);
      if ( rScale ) this.drawLineAxis_(svg, a, rScale, w, ! bars);

      var gw = band.bandwidth();
      if ( this.barThickness > 0 ) gw = Math.min(gw, this.barThickness);
      if ( bars ) {
        svg.start('g').forEach(labels, function(l, j) {
          var v    = Number(bars.data[j]) || 0;
          var p0   = lScale.map(0), p1 = lScale.map(v);
          var len  = Math.abs(p1 - p0);
          if ( ! len ) return;
          this.start('rect').addClass(self.myClass('bar'))
            .attrs({ x: band.center(j) - gw / 2, y: Math.min(p0, p1), width: gw, height: len, fill: self.seriesColor(self.BAR, j) })
          .end();
        }).end();
      }

      var px = [];
      if ( line ) {
        ( line.data || [] ).forEach(function(v, j) {
          if ( typeof v === 'number' && isFinite(v) && j < n ) px.push({ x: band.center(j), y: rScale.map(v), j: j });
        });
        this.drawLine_(svg, line, px, a);
      }

      // One transparent column per category on top catches the pointer: it
      // shades on hover, shows both values and reports the click.
      var step = Math.abs(band.step());
      svg.start('g').forEach(labels, function(l, j) {
        this.start('rect').addClass(self.myClass('hit'))
          .attrs({ x: band.center(j) - step / 2, y: a.top, width: step, height: a.height })
          .on('mousemove', function(evt) { self.showCategoryTooltip_(evt, j); })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) { if ( self.onCategoryClick ) self.onCategoryClick(j, evt); })
        .end();
      }).end();
    },

    function drawLine_(svg, ds, px, a) {
      if ( ! px.length ) return;
      var self  = this;
      var color = this.seriesColor(this.LINE);
      svg.start('g').addClass(this.myClass('series'))
        .start('path').addClass(this.myClass('line'))
          .attrs({ d: this.path_(px, ds, a), stroke: color, 'stroke-width': ds.borderWidth })
        .end()
        .callIf(ds.pointRadius > 0, function() {
          this.forEach(px, function(p) {
            this.start('circle').addClass(self.myClass('dot')).attrs({ cx: p.x, cy: p.y, r: ds.pointRadius, fill: color }).end();
          });
        })
      .end();
    },

    function drawLineAxis_(svg, a, scale, w, opt_grid) {
      // The right y axis: a line, its tick labels and its title. opt_grid
      // draws the horizontal gridlines from its ticks, for when the bars'
      // axis, which normally draws them, is hidden.
      var self  = this;
      var fp    = this.fontPx();
      var right = a.left + a.width;
      var ticks = scale.ticks().map(function(t) { return { pos: scale.map(t), label: scale.format(t) }; });
      var cap   = Math.min(this.MAX_LABEL_PX, w * this.MAX_Y_LABEL_SHARE);
      svg.start('g')
        .callIf(opt_grid && this.showGridLines, function() {
          this.forEach(ticks, function(t) {
            this.start('line').addClass(self.myClass('grid')).attrs({ x1: a.left, x2: right, y1: t.pos, y2: t.pos }).end();
          });
        })
        .start('line').addClass(this.myClass('axis')).attrs({ x1: right, x2: right, y1: a.top, y2: a.top + a.height }).end()
        .forEach(ticks, function(t) {
          self.label_(this, t.label, cap, {
            x: right + self.LABEL_GAP_PX, y: t.pos, 'text-anchor': 'start', 'dominant-baseline': 'middle'
          });
        })
        .callIf(this.lineAxisLabel, function() {
          // Mirrors the left title: the same distance from the edge, turned the other way.
          var cx = w - fp * self.Y_TITLE_X, cy = a.top + a.height / 2;
          this.start('text').addClass(self.myClass('axis-title'))
            .attrs({ x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle', transform: self.rotate_(90, cx, cy) })
            .add(self.lineAxisLabel)
          .end();
        })
      .end();
    },

    function showCategoryTooltip_(evt, j) {
      var self = this;
      var rows = [ this.BAR, this.LINE ]
        .filter(function(i) { return self.series_(i); })
        .map(function(i) {
          var ds = self.datasets[i];
          return { color: self.seriesColor(i, j), label: ds.label || '', value: self.formatValue(ds.data[j]) };
        });
      this.showTooltip(evt, this.labels[j], rows);
    }
  ]
});
