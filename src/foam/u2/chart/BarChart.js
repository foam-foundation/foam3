/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'BarChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    Bars, one per label and dataset. With several datasets the bars of one
    label stand side by side, or on top of each other when stacked is on.
    horizontal turns the chart on its side, categories down the left.

    Hovering a category shows one tooltip for every dataset at that label,
    with a "Sum:" line when showTooltipSum is on. Clicking a bar calls
    onBarClick(datasetIndex, index, event) with the bar under the pointer.
  `,

  requires: [
    'foam.u2.chart.BandScale',
    'foam.u2.chart.LinearScale'
  ],

  constants: [
    {
      name: 'HIT_SLACK_PX',
      documentation: 'How far outside a bar a click still counts as on it, so a one-pixel bar can be clicked.',
      value: 1
    }
  ],

  css: `
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<bar {
        animation-name: foam-u2-chart-BarChart-grow-y;
        animation-timing-function: ease-out;
        transform-box: fill-box;
        transform-origin: 50% 100%;
      }
      <<animated<<horizontal <<bar {
        animation-name: foam-u2-chart-BarChart-grow-x;
        transform-origin: 0 50%;
      }
    }
    @keyframes foam-u2-chart-BarChart-grow-y { from { transform: scaleY(0); } }
    @keyframes foam-u2-chart-BarChart-grow-x { from { transform: scaleX(0); } }
  `,

  properties: [
    { class: 'Boolean', name: 'horizontal' },
    { class: 'Boolean', name: 'stacked' },
    {
      class: 'Int',
      name: 'barThickness',
      documentation: 'Widest a bar may be, in pixels; 0 lets the bars fill their band.'
    },
    {
      class: 'Function',
      name: 'onBarClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (datasetIndex, index, event) when a bar is clicked.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this
        .enableClass(this.myClass('horizontal'), this.horizontal$)
        .enableClass(this.myClass('clickable'), this.onBarClick$.map(function(f) { return !! f; }));
    },

    function visibleSets_() {
      var self = this;
      return this.datasets
        .map(function(ds, i) { return { ds: ds, i: i }; })
        .filter(function(s) { return ! self.isHidden(s.i); });
    },

    function valueRange_(sets, n) {
      // Stacked bars add up per label, positives up and negatives down.
      var lo = 0, hi = 0;
      for ( var j = 0 ; j < n ; j++ ) {
        var pos = 0, neg = 0;
        sets.forEach(function(s) {
          var v = Number(s.ds.data[j]) || 0;
          if ( this.stacked ) { if ( v >= 0 ) pos += v; else neg += v; }
          else { pos = Math.max(pos, v); neg = Math.min(neg, v); }
        }, this);
        hi = Math.max(hi, pos);
        lo = Math.min(lo, neg);
      }
      return [ lo, hi ];
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var labels = this.labels.map(String);
      var n      = labels.length;
      var sets   = this.visibleSets_();
      var range  = this.valueRange_(sets, n);
      var fit = this.layoutForValues(w, h, labels, this.horizontal,
        function(n) { return self.LinearScale.create({ min: range[0], max: range[1], tickCount: n }).nice(); },
        function(scale) { return scale.ticks(); });
      var a      = fit.area;
      var vScale = fit.scale;
      var vTicks = vScale.ticks();

      var band = this.BandScale.create({ count: n });
      if ( this.horizontal ) {
        band.start   = a.top;           band.end   = a.top + a.height;
        vScale.start = a.left;          vScale.end = a.left + a.width;
      } else {
        band.start   = a.left;          band.end   = a.left + a.width;
        vScale.start = a.top + a.height; vScale.end = a.top;
      }

      var catTicks = labels.map(function(l, i) { return { pos: band.center(i), label: l }; });
      var valTicks = vTicks.map(function(t) { return { pos: vScale.map(t), label: vScale.format(t) }; });
      this.drawAxes(svg, a, this.horizontal ? valTicks : catTicks, this.horizontal ? catTicks : valTicks);

      // rects[j] lists the bars of label j as { di, lo, hi } in pixels along the value axis.
      var rects   = labels.map(function() { return []; });
      var bw      = band.bandwidth();
      var groupW  = this.stacked || ! sets.length ? bw : bw / sets.length;
      if ( this.barThickness > 0 ) groupW = Math.min(groupW, this.barThickness);
      var groupsW = this.stacked ? groupW : groupW * sets.length;

      svg.start('g').call(function() {
        var g = this;
        for ( var j = 0 ; j < n ; j++ ) {
          var pos = 0, neg = 0;
          var c0  = band.center(j) - groupsW / 2;
          sets.forEach(function(s, k) {
            var v = Number(s.ds.data[j]) || 0;
            var from = 0;
            if ( self.stacked ) { from = v >= 0 ? pos : neg; if ( v >= 0 ) pos += v; else neg += v; }
            var p0 = vScale.map(from), p1 = vScale.map(from + v);
            var lo = Math.min(p0, p1), len = Math.abs(p1 - p0);
            var c  = self.stacked ? c0 : c0 + k * groupW;
            rects[j].push({ di: s.i, lo: lo, hi: lo + len });
            if ( ! len ) return;
            g.start('rect').addClass(self.myClass('bar'))
              .attrs(self.horizontal ?
                { x: lo, y: c, width: len, height: groupW } :
                { x: c, y: lo, width: groupW, height: len })
              .attrs({ fill: self.seriesColor(s.i, j) })
            .end();
          });
        }
      }).end();

      // One transparent column per label on top of the bars catches the
      // pointer: it shades on hover, shows the tooltip and finds the clicked bar.
      svg.start('g').forEach(labels, function(l, j) {
        var x0 = band.center(j) - Math.abs(band.step()) / 2;
        var r  = self.horizontal ?
          { x: a.left, y: x0, width: a.width, height: Math.abs(band.step()) } :
          { x: x0, y: a.top, width: Math.abs(band.step()), height: a.height };
        this.start('rect').addClass(self.myClass('hit')).attrs(r)
          .on('mousemove', function(evt) { self.showBarTooltip_(evt, j); })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) {
            if ( ! self.onBarClick ) return;
            var at  = self.pointerAt_(evt);
            var p   = self.horizontal ? at.x : at.y;
            var hit = rects[j].find(function(b) { return p >= b.lo - self.HIT_SLACK_PX && p <= b.hi + self.HIT_SLACK_PX; });
            if ( hit ) self.onBarClick(hit.di, j, evt);
          })
        .end();
      }).end();
    },

    function pointerAt_(evt) {
      var box = evt.target.ownerSVGElement.getBoundingClientRect();
      return { x: evt.clientX - box.left, y: evt.clientY - box.top };
    },

    function showBarTooltip_(evt, j) {
      var self = this;
      var sets = this.visibleSets_();
      var rows = sets.map(function(s) {
        return { color: self.seriesColor(s.i, j), label: s.ds.label || '', value: self.formatValue(s.ds.data[j]) };
      });
      var footer = this.showTooltipSum && sets.length ?
        this.sumLine(sets.map(function(s) { return s.ds.data[j]; })) : undefined;
      this.showTooltip(evt, this.labels[j], rows, footer);
    }
  ]
});
