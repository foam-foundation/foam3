/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'PolarAreaChart',
  extends: 'foam.u2.chart.ChartView',

  documentation: `
    One wedge per label, every wedge the same angle, starting at twelve
    o'clock and running clockwise. The first dataset holds one value per
    label, and a wedge reaches out until its AREA is in proportion to its
    value, so its radius grows with the square root of the value: 400 is
    twice as far from the centre as 100, and has four times the area.
    Request counts per severity, say, with labels: [ 'INFO', 'WARN', 'ERROR' ]
    and datasets: [ { data: [ 120, 35, 8 ] } ] draw three wedges of 120 degrees
    each, the INFO wedge reaching the rim.

    Rings are drawn at round values (0, 50, 100, 150), each labelled where it
    crosses the vertical line through the centre, and spaced by the same
    square root, so they crowd toward the rim. The legend has one entry per
    label; clicking one hides that wedge, leaves its slot empty so the others
    stay where they are, and rescales the rings to the wedges that are left.

    Hovering a wedge shows its label, its value and its share of the visible
    total. Clicking one calls onWedgeClick(index, event), where index is the
    position in labels. A negative, missing or non-numeric value counts as 0,
    since an area cannot be negative, and draws no wedge.
  `,

  requires: [
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.SVGPath'
  ],

  constants: [
    {
      name: 'EDGE_PX',
      documentation: 'Gap between the rim and the edge of the chart, so the outer ring is not cut off.',
      value: 4
    },
    {
      name: 'RING_STEPS',
      documentation: 'About how many rings the scale has; the scale picks the closest round step, so 0 to 190 with 4 steps gets rings at 50, 100, 150 and 200.',
      value: 4
    },
    {
      name: 'RING_LABEL_NUDGE_PX',
      documentation: 'How far a ring value sits to the right of the vertical line through the centre, so the first wedge\'s edge does not run through its digits.',
      value: 4
    },
    {
      name: 'HALF_TURN',
      documentation: 'A wedge sweeping more than this many radians (a half turn) is drawn as two arcs, since one arc cannot span a full turn: a single label is a full circle.',
      value: Math.PI
    }
  ],

  css: `
    <<ring { fill: none; stroke: $borderLight; stroke-width: 1; }
    <<wedge { stroke: $backgroundDefault; stroke-width: 1; pointer-events: none; }
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }
    <<ring-label {
      font-size: 1rem;
      /* A halo in the background colour keeps the value readable over a wedge. */
      paint-order: stroke;
      stroke: $backgroundDefault;
      stroke-width: 3;
      stroke-linejoin: round;
    }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<wedges {
        animation-name: foam-u2-chart-PolarAreaChart-grow;
        animation-timing-function: ease-out;
        /* The centre of the whole chart, not of the wedge, so each wedge grows out of the middle. */
        transform-box: view-box;
        transform-origin: 50% 50%;
      }
    }
    @keyframes foam-u2-chart-PolarAreaChart-grow { from { opacity: 0; transform: scale(0); } }
  `,

  messages: [
    { name: 'VALUE', message: 'Value' },
    { name: 'SHARE', message: 'Share of total' }
  ],

  properties: [
    {
      class: 'Function',
      name: 'onWedgeClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (index, event) when a wedge is clicked; index is its position in labels.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onWedgeClick$.map(function(f) { return !! f; }));
    },

    function values_() {
      // One number per label. A value that is negative, missing or not a
      // number counts as 0, so -5 and null both draw no wedge.
      var data = this.datasets.length ? this.datasets[0].data || [] : [];
      return this.labels.map(function(l, j) {
        var v = Number(data[j]);
        return isFinite(v) && v > 0 ? v : 0;
      });
    },

    function total_() {
      var self = this;
      return this.values_().reduce(function(sum, v, j) { return self.isHidden(j) ? sum : sum + v; }, 0);
    },

    function percent_(j) {
      // "12.3%" of the visible total; a share under 0.05% reads "<0.1%", not "0.0%", so a tiny wedge is not mistaken for an empty one.
      var total = this.total_();
      var pct   = total > 0 && ! this.isHidden(j) ? this.values_()[j] / total * 100 : 0;
      return pct > 0 && pct < 0.05 ? '<0.1%' : pct.toFixed(1) + '%';
    },

    function legendItems() {
      var self = this;
      return this.labels.map(function(l, j) {
        return { label: String(l), color: self.seriesColor(0, j), hidden: self.isHidden(j) };
      });
    },

    function seriesColor(i, opt_index) {
      // Wedges take the dataset's colours in turn, then the theme defaults.
      var ds = this.datasets[0];
      var bg = ds && ds.backgroundColor;
      var j  = opt_index || 0;
      if ( Array.isArray(bg) && bg.length ) return bg[j % bg.length];
      return this.defaultColor(j);
    },

    function buildScale_(values) {
      // 0 sits at the centre and the largest visible value, rounded up to a
      // round number, at the rim.
      var self = this;
      var hi   = values.reduce(function(m, v, j) { return self.isHidden(j) ? m : Math.max(m, v); }, 0);
      return this.LinearScale.create({ min: 0, max: hi, tickCount: this.RING_STEPS }).nice();
    },

    function wedgePath_(cx, cy, r, a0, a1) {
      // A wedge from angle a0 to a1, in radians clockwise from twelve o'clock.
      var pt   = function(ang) { return { x: cx + r * Math.sin(ang), y: cy - r * Math.cos(ang) }; };
      var path = this.SVGPath.create().moveTo(cx, cy);
      var arcs = a1 - a0 > this.HALF_TURN ? [ a0, ( a0 + a1 ) / 2, a1 ] : [ a0, a1 ];
      var p    = pt(arcs[0]);
      path.lineTo(p.x, p.y);
      for ( var k = 1 ; k < arcs.length ; k++ ) {
        p = pt(arcs[k]);
        path.arcTo(r, false, true, p.x, p.y);
      }
      return path.close();
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var n      = this.labels.length;
      if ( ! n ) return;

      var values = this.values_();
      var rim    = Math.max(0, Math.min(w, h) / 2 - this.EDGE_PX);
      var cx     = w / 2, cy = h / 2;
      var sweep  = 2 * Math.PI / n;
      var scale  = this.buildScale_(values);
      // Area grows with the square of the radius, so the radius grows with
      // the square root of the value.
      var radius = function(v) { return rim * Math.sqrt(Math.max(0, v) / scale.max); };
      var rings  = scale.ticks().filter(function(t) { return t > 0; });

      svg.start('g')
        .forEach(rings, function(t) {
          this.start('circle').addClass(self.myClass('ring')).attrs({ cx: cx, cy: cy, r: radius(t) }).end();
        })
      .end();

      svg.start('g').addClass(this.myClass('wedges'))
        .forEach(values, function(v, j) {
          if ( self.isHidden(j) || v <= 0 ) return;
          this.start('path').addClass(self.myClass('wedge'))
            .attrs({ d: self.wedgePath_(cx, cy, radius(v), j * sweep, ( j + 1 ) * sweep).toString(), fill: self.seriesColor(0, j) })
          .end();
        })
      .end();

      svg.start('g')
        .forEach(rings, function(t) {
          this.start('text').addClass(self.myClass('text')).addClass(self.myClass('ring-label'))
            // Hang each value just inside its ring, so the outer ring's value
            // stays inside the chart.
            .attrs({ x: cx + self.RING_LABEL_NUDGE_PX, y: cy - radius(t), 'text-anchor': 'start', 'dominant-baseline': 'hanging' })
            .add(scale.format(t))
          .end();
        })
      .end();

      // One transparent sector per label, as far out as the rim, on top, so a
      // thin wedge can still be hovered and clicked. A hidden label has none.
      svg.start('g').addClass(this.myClass('hits'))
        .forEach(values, function(v, j) {
          if ( self.isHidden(j) ) return;
          this.start('path').addClass(self.myClass('hit'))
            .attrs({ d: self.wedgePath_(cx, cy, rim, j * sweep, ( j + 1 ) * sweep).toString() })
            .on('mousemove', function(evt) { self.showWedgeTooltip_(evt, j); })
            .on('mouseleave', self.hideTooltip)
            .on('click', function(evt) { if ( self.onWedgeClick ) self.onWedgeClick(j, evt); })
          .end();
        })
      .end();
    },

    function showWedgeTooltip_(evt, j) {
      this.showTooltip(evt, String(this.labels[j]), [
        { color: this.seriesColor(0, j), label: this.VALUE, value: this.formatValue(this.values_()[j]) },
        { label: this.SHARE, value: this.percent_(j) }
      ]);
    }
  ]
});
