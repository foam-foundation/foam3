/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'SunburstChart',
  extends: 'foam.u2.chart.PieChart',

  documentation: `
    A hierarchy of two levels drawn as rings. The inner ring has one slice
    per label, as wide as the label's total; the outer ring splits each inner
    slice by dataset, and stays inside its parent's angle. Visits by page
    (the labels) and then by hour (the datasets) give a ring of pages with,
    around each, a ring of the hours it was visited: Home at 10 and 11 sits
    inside Home.

    data[j] of a dataset is the value of the outer slice that the dataset
    names, inside label j. A label's total is the sum of that column over the
    datasets, so the parent always equals its children. The inner colours are
    the first dataset's backgroundColor, as on a pie; an outer slice takes a
    lighter shade of its parent's colour.

    Hovering a slice names its path ("Home / 10") with its value and its
    share of its parent and of the whole. The legend has one entry per label;
    clicking one hides that slice and its children, and the others grow to
    fill the circle.
  `,

  requires: [
    'foam.u2.chart.ColorScale',
    'foam.u2.chart.SVGPath'
  ],

  constants: [
    {
      name: 'INNER_RING_SHARE',
      documentation: 'The inner ring\'s share of the width between the hole and the rim: 0.4 on a 100px radius with no hole makes the inner ring 40px wide and the outer 60px, which has the longer arcs.',
      value: 0.4
    },
    {
      name: 'OUTER_TINT',
      documentation: 'Theme token the outer slices fade toward, so each is a lighter shade of its parent.',
      value: '$white'
    },
    {
      name: 'OUTER_FADES',
      documentation: 'How far an outer slice fades toward the tint, taken in turn among its parent\'s children: 0.3 then 0.5, so two neighbours differ.',
      value: [ 0.3, 0.5 ]
    },
    {
      name: 'PATH_SEPARATOR',
      documentation: 'Between the names in a slice\'s path: "Home / 10".',
      value: ' / '
    }
  ],

  css: `
    <<clickable <<slice { cursor: pointer; }
  `,

  messages: [
    { name: 'VALUE',     message: 'Value' },
    { name: 'OF_PARENT', message: 'Of parent' },
    { name: 'OF_TOTAL',  message: 'Of total' }
  ],

  properties: [
    {
      class: 'Function',
      name: 'onSliceClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (labelIndex, datasetIndex, event) when a slice is clicked; datasetIndex is -1 for an inner slice.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onSliceClick$.map(function(f) { return !! f; }));
    },

    function cell_(j, k) {
      // The value of outer slice k inside label j; a missing, negative or
      // non-numeric value is 0, and so draws nothing.
      var v = Number(( this.datasets[k].data || [] )[j]);
      return v > 0 ? v : 0;
    },

    function values_() {
      // What a pie calls the slice values, here the inner slices: a label's
      // total over every dataset. Hiding a label leaves its total in place,
      // as on a pie, and isHidden takes it out of the sums.
      var self = this;
      return this.labels.map(function(l, j) {
        return self.datasets.reduce(function(sum, ds, k) { return sum + self.cell_(j, k); }, 0);
      });
    },

    function outerColor_(j, k) {
      // A lighter shade of the parent's colour, both resolved colours. The
      // shade follows the slice's place among its parent's drawn children, so
      // two neighbours differ even when a dataset between them is empty.
      var n = 0;
      for ( var i = 0 ; i < k ; i++ ) if ( this.cell_(j, i) > 0 ) n++;
      var tint = foam.CSS.returnTokenValue(this.OUTER_TINT, this.cls_, this.__subContext__);
      return this.ColorScale.create().blend(this.seriesColor(0, j), tint, this.OUTER_FADES[n % this.OUTER_FADES.length]);
    },

    function labelText_(j) {
      return String(this.labels[j] === undefined ? '' : this.labels[j]);
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var inner  = this.values_();
      var total  = this.total_();
      var r      = Math.max(0, Math.min(w, h) / 2 - this.EDGE_PX);
      var r0     = r * Math.max(0, Math.min(this.MAX_CUTOUT, this.cutout)) / 100;
      var rMid   = r0 + ( r - r0 ) * this.INNER_RING_SHARE;
      var cx = w / 2, cy = h / 2;
      var dir = this.clockwise ? 1 : -1;
      var a   = this.rotation * Math.PI / 180;

      svg.start('g').addClass(this.myClass('slices')).call(function() {
        var g = this;
        inner.forEach(function(v, j) {
          if ( self.isHidden(j) || v <= 0 || total <= 0 ) return;
          var sweep = v / total * 2 * Math.PI * dir;
          g.start('path').addClass(self.myClass('slice')).addClass(self.myClass('inner'))
            .attrs({ d: self.slicePath(self.SVGPath.create(), cx, cy, rMid, r0, a, a + sweep), fill: self.seriesColor(0, j) })
            .on('mousemove', function(evt) { self.showSunburstTooltip_(evt, j, -1); })
            .on('mouseleave', self.hideTooltip)
            .on('click', function(evt) { if ( self.onSliceClick ) self.onSliceClick(j, -1, evt); })
          .end();

          // The children share the parent's angle, in dataset order.
          var b = a;
          self.datasets.forEach(function(ds, k) {
            var cv = self.cell_(j, k);
            if ( cv <= 0 ) return;
            var s = cv / total * 2 * Math.PI * dir;
            g.start('path').addClass(self.myClass('slice')).addClass(self.myClass('outer'))
              .attrs({ d: self.slicePath(self.SVGPath.create(), cx, cy, r, rMid, b, b + s), fill: self.outerColor_(j, k) })
              .on('mousemove', function(evt) { self.showSunburstTooltip_(evt, j, k); })
              .on('mouseleave', self.hideTooltip)
              .on('click', function(evt) { if ( self.onSliceClick ) self.onSliceClick(j, k, evt); })
            .end();
            b += s;
          });
          a += sweep;
        });
      }).end();
    },

    function sunburstRows_(j, k) {
      // The tooltip for label j, or for its outer slice k: the value, then
      // its share of its parent (an outer slice only) and of the whole.
      var parent = this.values_()[j];
      var v      = k < 0 ? parent : this.cell_(j, k);
      var total  = this.total_();
      var pct    = function(a, b) { return ( b > 0 ? a / b * 100 : 0 ).toFixed(1) + '%'; };
      var rows   = [ { color: k < 0 ? this.seriesColor(0, j) : this.outerColor_(j, k), label: this.VALUE, value: this.formatValue(v) } ];
      if ( k >= 0 ) rows.push({ label: this.OF_PARENT, value: pct(v, parent) });
      rows.push({ label: this.OF_TOTAL, value: pct(v, total) });
      return rows;
    },

    function sunburstTitle_(j, k) {
      return k < 0 ? this.labelText_(j) : this.labelText_(j) + this.PATH_SEPARATOR + ( this.datasets[k].label || '' );
    },

    function showSunburstTooltip_(evt, j, k) {
      this.showTooltip(evt, this.sunburstTitle_(j, k), this.sunburstRows_(j, k));
    }
  ],

  listeners: [
    function onLegendHover(i, evt) {
      if ( i < 0 ) { this.hideTooltip(); return; }
      // A hidden label has no share of the whole, so its tooltip is its name alone.
      if ( this.isHidden(i) ) { this.showTooltip(evt, this.labelText_(i), []); return; }
      this.showTooltip(evt, this.labelText_(i), this.sunburstRows_(i, -1));
    }
  ]
});
