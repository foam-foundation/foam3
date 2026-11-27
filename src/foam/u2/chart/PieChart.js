/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'PieChart',
  extends: 'foam.u2.chart.ChartView',

  documentation: `
    A pie, or a donut when cutout is above zero, of the first dataset: one
    slice per label. The legend has one entry per slice; clicking one hides
    that slice and the others grow to fill the circle, unless
    disableLegendClick is on.

    Percentages are shares of the visible slices, so after hiding one the
    rest still add up to 100%. A slice under 0.05% reads "<0.1%" rather than
    "0.0%", so a tiny slice is not mistaken for an empty one.
  `,

  css: `
    <<slice { stroke: $backgroundDefault; stroke-width: 1; }
    <<slice:hover { filter: brightness(0.92); }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<slices {
        animation-name: foam-u2-chart-PieChart-grow;
        animation-timing-function: ease-out;
        transform-box: fill-box;
        transform-origin: center;
      }
    }
    @keyframes foam-u2-chart-PieChart-grow { from { opacity: 0; transform: scale(0.6) rotate(-60deg); } }
  `,

  properties: [
    {
      class: 'Int',
      name: 'cutout',
      documentation: 'Size of the hole as a percentage of the radius: 0 is a pie, 50 a donut.'
    },
    {
      class: 'Int',
      name: 'rotation',
      documentation: 'Where the first slice starts, in degrees clockwise from twelve o\'clock.'
    },
    { class: 'Boolean', name: 'clockwise', value: true },
    {
      class: 'Boolean',
      name: 'showPercentages',
      documentation: 'Start each legend entry with its slice\'s share, e.g. "38.9% Apples".'
    },
    { class: 'Boolean', name: 'disableLegendClick' },
    {
      name: 'legendClickable',
      expression: function(disableLegendClick) { return ! disableLegendClick; }
    },
    {
      class: 'Int',
      name: 'legendMinWidthPercent',
      documentation: 'For a legend left or right: its least width as a share of the chart. Equal min and max line up the circles of pies stacked in a column.'
    },
    {
      class: 'Int',
      name: 'legendMaxWidthPercent',
      documentation: 'For a legend left or right: its greatest width as a share of the chart; longer labels end in an ellipsis.'
    }
  ],

  methods: [
    function values_() {
      var ds = ( this.data.datasets || [] )[0] || {};
      return ( ds.data || [] ).map(function(v) { return Number(v) || 0; });
    },

    function total_() {
      var self = this;
      return this.values_().reduce(function(sum, v, i) { return self.isHidden(i) ? sum : sum + v; }, 0);
    },

    function percent(i) {
      var total = this.total_();
      var v     = this.isHidden(i) ? 0 : this.values_()[i];
      var pct   = total > 0 ? v / total * 100 : 0;
      return pct > 0 && pct < 0.05 ? '<0.1%' : pct.toFixed(1) + '%';
    },

    function legendItems() {
      var self   = this;
      var labels = this.data.labels || [];
      return this.values_().map(function(v, i) {
        var label = String(labels[i] === undefined ? '' : labels[i]);
        return {
          label:  self.showPercentages ? self.percent(i) + ' ' + label : label,
          color:  self.seriesColor(0, i),
          hidden: self.isHidden(i)
        };
      });
    },

    function styleLegend(legend, vertical) {
      if ( ! vertical ) return;
      legend.style({
        minWidth: this.legendMinWidthPercent > 0 ? this.legendMinWidthPercent + '%' : '',
        maxWidth: this.legendMaxWidthPercent > 0 ? this.legendMaxWidthPercent + '%' : ''
      });
    },

    function seriesColor(i, opt_index) {
      // Slices take the dataset's colours in turn, then the theme defaults.
      var ds = ( this.data.datasets || [] )[0] || {};
      var bg = ds.backgroundColor;
      var j  = opt_index || 0;
      if ( Array.isArray(bg) && bg.length ) return bg[j % bg.length];
      return this.defaultColor(j);
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var values = this.values_();
      var total  = this.total_();
      var r      = Math.max(0, Math.min(w, h) / 2 - 4);
      var r0     = r * Math.max(0, Math.min(95, this.cutout)) / 100;
      var cx = w / 2, cy = h / 2;
      var dir = this.clockwise ? 1 : -1;
      var a   = this.rotation * Math.PI / 180;

      svg.start('g').addClass(this.myClass('slices')).call(function() {
        var g = this;
        values.forEach(function(v, i) {
          if ( self.isHidden(i) || v <= 0 || total <= 0 ) return;
          var sweep = v / total * 2 * Math.PI * dir;
          g.start('path').addClass(self.myClass('slice'))
            .attrs({ d: self.slicePath(cx, cy, r, r0, a, a + sweep), fill: self.seriesColor(0, i) })
            .on('mousemove', function(evt) { self.showSliceTooltip_(evt, i); })
            .on('mouseleave', self.hideTooltip)
          .end();
          a += sweep;
        });
      }).end();
    },

    function slicePath(cx, cy, r, r0, a0, a1) {
      // Angles run clockwise from twelve o'clock, so a0 = 0 points straight up.
      var pt = function(rad, ang) { return [ cx + rad * Math.sin(ang), cy - rad * Math.cos(ang) ]; };
      // A full circle cannot be one arc: its start and end are the same point.
      if ( Math.abs(a1 - a0) >= 2 * Math.PI - 1e-6 ) {
        var mid = a0 + ( a1 - a0 ) / 2;
        return this.slicePath(cx, cy, r, r0, a0, mid) + ' ' + this.slicePath(cx, cy, r, r0, mid, a1);
      }
      var large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
      var sweep = a1 > a0 ? 1 : 0;
      var p0 = pt(r, a0), p1 = pt(r, a1);
      if ( ! r0 ) {
        return 'M' + cx + ',' + cy + ' L' + p0 + ' A' + r + ',' + r + ' 0 ' + large + ' ' + sweep + ' ' + p1 + ' Z';
      }
      var q1 = pt(r0, a1), q0 = pt(r0, a0);
      return 'M' + p0 + ' A' + r + ',' + r + ' 0 ' + large + ' ' + sweep + ' ' + p1 +
             ' L' + q1 + ' A' + r0 + ',' + r0 + ' 0 ' + large + ' ' + ( 1 - sweep ) + ' ' + q0 + ' Z';
    },

    function sliceRow_(i) {
      var labels = this.data.labels || [];
      var v      = this.values_()[i];
      return {
        color: this.seriesColor(0, i),
        label: String(labels[i] === undefined ? '' : labels[i]),
        value: this.formatValue(v) + ( this.showPercentages ? ' (' + this.percent(i) + ')' : '' )
      };
    },

    function showSliceTooltip_(evt, i) {
      this.showTooltip(evt, '', [ this.sliceRow_(i) ],
        this.showTooltipSum ? this.sumLine(this.values_().filter(function(v, j) { return ! this.isHidden(j); }, this)) : undefined);
    }
  ],

  listeners: [
    function onLegendHover(i, evt) {
      // A legend entry may be cut short by the legend's max width; hovering
      // it shows the whole label with its value and share.
      if ( i < 0 ) { this.hideTooltip(); return; }
      var row = this.sliceRow_(i);
      row.value = this.formatValue(this.isHidden(i) ? 0 : this.values_()[i]) + ' (' + this.percent(i) + ')';
      this.showTooltip(evt, '', [ row ]);
    }
  ]
});
