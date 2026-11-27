/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'RadarChart',
  extends: 'foam.u2.chart.ChartView',

  documentation: `
    One spoke per label, spread evenly around a circle starting at twelve
    o'clock and running clockwise. Each dataset is a closed polygon whose
    corner on a spoke sits as far from the centre as the value: 0 at the
    centre, the largest value at the rim. Request counts per severity, say,
    with labels: [ 'INFO', 'WARN', 'ERROR' ] and
    datasets: [ { label: 'Today', data: [ 120, 35, 8 ] } ].
    The rings are drawn at round values (0, 50, 100, 150), and hiding a
    dataset from the legend rescales them to the datasets that are left.

    Hovering a corner, or the spoke near the pointer, shows the label with
    the value of every visible dataset on it. Clicking a corner calls
    onPointClick(datasetIndex, index, event) with the dataset and the
    position of the spoke. A value missing from data counts as 0.
  `,

  requires: [
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.SVGPath'
  ],

  constants: [
    {
      name: 'DOT_PX',
      documentation: 'Radius of the dot on each polygon corner, in pixels: big enough to see, small enough that two close values stay apart.',
      value: 3
    },
    {
      name: 'HIT_SLACK_PX',
      documentation: 'How far outside a dot the pointer still counts as on it, so a corner is easy to hover and click.',
      value: 4
    },
    {
      name: 'SPOKE_HIT_PX',
      documentation: 'How far from a spoke the pointer still counts as on it: 10 gives a 20-pixel wide band along the spoke.',
      value: 10
    },
    {
      name: 'RING_STEPS',
      documentation: 'About how many rings the scale has; the scale picks the closest round step, so 0 to 190 with 4 steps gets rings at 50, 100, 150 and 200.',
      value: 4
    },
    {
      name: 'FILL_OPACITY',
      documentation: 'How see-through a polygon is: at 0.2 the rings and the other polygons still show through it.',
      value: 0.2
    },
    {
      name: 'LABEL_GAP_PX',
      documentation: 'Space between the rim and a spoke label.',
      value: 8
    },
    {
      name: 'MAX_LABEL_PX',
      documentation: 'Widest a spoke label may be before it ends in an ellipsis; the full text stays in the hover tooltip.',
      value: 100
    },
    {
      name: 'EDGE_PX',
      documentation: 'Gap between the labels and the edge of the chart, so none is cut off.',
      value: 4
    },
    {
      name: 'RING_LABEL_NUDGE_PX',
      documentation: 'How far a ring value sits to the right of the first spoke, so the spoke does not run through its digits.',
      value: 4
    },
    {
      name: 'SIDE_SLACK',
      documentation: 'A spoke that leans less than this share of the radius to the left or right of straight up or down counts as vertical, and its label is centred above or below it. At 0.1 the top and bottom labels are centred and a spoke 30 degrees off vertical (0.5) is not.',
      value: 0.1
    }
  ],

  css: `
    <<grid { fill: none; }
    <<spoke { stroke: $borderLight; stroke-width: 1; shape-rendering: crispEdges; }
    <<hit { stroke: transparent; }
    <<polygon { stroke-width: 2; stroke-linejoin: round; pointer-events: none; }
    <<dot { stroke: transparent; }
    <<dot:hover { filter: brightness(0.92); }
    <<clickable <<dot { cursor: pointer; }
    <<ring-label {
      font-size: 1rem;
      /* A halo in the background colour keeps the value readable over a polygon. */
      paint-order: stroke;
      stroke: $backgroundDefault;
      stroke-width: 3;
      stroke-linejoin: round;
    }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<polygons, <<animated <<dots {
        animation-name: foam-u2-chart-RadarChart-grow;
        animation-timing-function: ease-out;
        /* The centre of the whole chart, not of the polygon, so each polygon grows out of the middle. */
        transform-box: view-box;
        transform-origin: 50% 50%;
      }
    }
    @keyframes foam-u2-chart-RadarChart-grow { from { opacity: 0; transform: scale(0); } }
  `,

  properties: [
    {
      class: 'Function',
      name: 'onPointClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (datasetIndex, index, event) when a polygon corner is clicked.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onPointClick$.map(function(f) { return !! f; }));
    },

    function visibleSets_() {
      // Each visible dataset with its value on every spoke, as
      // { ds, i, values }, i being the dataset's index. A value that is
      // missing or not a number counts as 0.
      var self = this;
      return this.datasets
        .map(function(ds, i) {
          var values = self.labels.map(function(l, j) {
            var v = Number(( ds.data || [] )[j]);
            return isFinite(v) ? v : 0;
          });
          return { ds: ds, i: i, values: values };
        })
        .filter(function(s) { return ! self.isHidden(s.i); });
    },

    function buildScale_(sets, radius) {
      // 0 sits at the centre and the largest visible value at the rim, so a
      // chart of small values is not squeezed into a dot. A negative value
      // moves the centre down to it.
      var lo = 0, hi = 0;
      sets.forEach(function(s) { s.values.forEach(function(v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }); });
      var scale = this.LinearScale.create({ min: lo, max: hi, tickCount: this.RING_STEPS }).nice();
      scale.start = 0;
      scale.end   = radius;
      return scale;
    },

    function polygonPath_(radii, cx, cy) {
      // A closed shape through one point per spoke, radii[j] from the centre.
      var self = this;
      var path = this.SVGPath.create();
      radii.forEach(function(r, j) {
        var p = self.pointAt_(cx, cy, r, j, radii.length);
        if ( j ) path.lineTo(p.x, p.y); else path.moveTo(p.x, p.y);
      });
      return path.close();
    },

    function pointAt_(cx, cy, r, j, n) {
      // The point r from the centre on spoke j of n. Spoke 0 points straight
      // up and the rest follow clockwise.
      var a = -Math.PI / 2 + 2 * Math.PI * j / n;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), cos: Math.cos(a), sin: Math.sin(a) };
    },

    function drawChart(svg, w, h) {
      var self = this;
      var n    = this.labels.length;
      if ( ! n ) return;

      var sets  = this.visibleSets_();
      var fp    = this.fontPx();
      var names = this.labels.map(function(l) { return String(l); });
      var shown = names.map(function(l) { return self.truncate(l, self.MAX_LABEL_PX); });
      var wide  = shown.reduce(function(m, l) { return Math.max(m, self.textWidth(l)); }, 0);
      var cx = w / 2, cy = h / 2;
      var gap = this.LABEL_GAP_PX, edge = this.EDGE_PX;
      // Room for the widest label to the left and right of the rim, and one
      // line of text above and below it.
      var radius = Math.max(0, Math.min(cx - wide - gap - edge, cy - fp - gap - edge));
      var scale  = this.buildScale_(sets, radius);
      var rings  = scale.ticks().filter(function(t) { return scale.map(t) > 0; });
      var rim    = function(j) { return self.pointAt_(cx, cy, radius, j, n); };
      var color  = function(s) { return self.seriesColor(s.i); };

      svg.start('g')
        .forEach(rings, function(t) {
          var rr = scale.map(t);
          this.start('path').addClass(self.myClass('grid'))
            .attrs({ d: self.polygonPath_(names.map(function() { return rr; }), cx, cy).toString() })
          .end();
        })
        .forEach(names, function(l, j) {
          var p = rim(j);
          this.start('line').addClass(self.myClass('spoke')).attrs({ x1: cx, y1: cy, x2: p.x, y2: p.y }).end();
        })
        .forEach(rings, function(t) {
          this.start('text').addClass(self.myClass('text')).addClass(self.myClass('ring-label'))
            .attrs({ x: cx + self.RING_LABEL_NUDGE_PX, y: cy - scale.map(t), 'text-anchor': 'start', 'dominant-baseline': 'auto' })
            .add(scale.format(t))
          .end();
        })
      .end();

      svg.start('g').addClass(this.myClass('polygons'))
        .forEach(sets, function(s) {
          this.start('path').addClass(self.myClass('polygon'))
            .attrs({
              d: self.polygonPath_(s.values.map(function(v) { return scale.map(v); }), cx, cy).toString(),
              fill: color(s), 'fill-opacity': self.FILL_OPACITY, stroke: color(s)
            })
          .end();
        })
      .end();

      // A band along each spoke, so the pointer lands on something before it
      // is near a corner.
      svg.start('g').addClass(this.myClass('hits'))
        .forEach(names, function(l, j) {
          var p = rim(j);
          this.start('line').addClass(self.myClass('hit'))
            .attrs({ x1: cx, y1: cy, x2: p.x, y2: p.y, 'stroke-width': 2 * self.SPOKE_HIT_PX })
            .on('mousemove', function(evt) { self.showSpokeTooltip_(evt, j, sets); })
            .on('mouseleave', self.hideTooltip)
          .end();
        })
      .end();

      svg.start('g').addClass(this.myClass('dots'))
        .forEach(sets, function(s) {
          this.forEach(s.values, function(v, j) {
            var p = self.pointAt_(cx, cy, scale.map(v), j, n);
            this.start('circle').addClass(self.myClass('dot'))
              .attrs({ cx: p.x, cy: p.y, r: self.DOT_PX, fill: color(s), 'stroke-width': 2 * self.HIT_SLACK_PX })
              .on('mousemove', function(evt) { self.showSpokeTooltip_(evt, j, sets); })
              .on('mouseleave', self.hideTooltip)
              .on('click', function(evt) { if ( self.onPointClick ) self.onPointClick(s.i, j, evt); })
            .end();
          });
        })
      .end();

      svg.start('g')
        .forEach(names, function(l, j) {
          var p = rim(j);
          var x = p.x + p.cos * gap, y = p.y + p.sin * gap;
          this.start('text').addClass(self.myClass('text')).addClass(self.myClass('spoke-label'))
            .attrs({
              x: x, y: y,
              'text-anchor': Math.abs(p.cos) < self.SIDE_SLACK ? 'middle' : p.cos > 0 ? 'start' : 'end',
              'dominant-baseline': Math.abs(p.sin) < self.SIDE_SLACK ? 'middle' : p.sin > 0 ? 'hanging' : 'auto'
            })
            .add(shown[j])
            .callIf(shown[j] !== l, function() { this.start('title').add(l).end(); })
          .end();
        })
      .end();
    },

    function showSpokeTooltip_(evt, j, sets) {
      var self = this;
      this.showTooltip(evt, String(this.labels[j]),
        sets.map(function(s) {
          return { color: self.seriesColor(s.i), label: s.ds.label || '', value: self.formatValue(s.values[j]) };
        }),
        this.showTooltipSum ? this.sumLine(sets.map(function(s) { return s.values[j]; })) : undefined);
    }
  ]
});
