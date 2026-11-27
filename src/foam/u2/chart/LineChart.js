/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'LineChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    One line per dataset (a LineDataset). Each dataset's data is a list of
    { x, y } points;
    xType (an XAxisType) says how x is placed: CATEGORY spaces the points
    evenly in data.labels order, LINEAR reads x as a number, and TIME reads
    it as a Date with ticks on each timeUnit.

    Each LineDataset sets how its line is drawn: borderColor for the line,
    backgroundColor for the area when fill is on, then borderWidth,
    tension, stepped, pointRadius and pointHoverRadius.

    With stacked on, the lines stack: each visible line is drawn on top of
    the ones below it as a filled band, so the top edge is their total. A line
    with no value at an x counts as 0 there, hiding a line in the legend
    restacks the rest, and the y axis covers the total. The tooltip lists
    each line's own value. Stack values that are not negative.

    Moving the pointer over the plot marks the nearest x with a dashed guide
    and shows every visible line's value there in one tooltip.
  `,

  requires: [
    'foam.u2.chart.LineDataset',
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.TimeScale',
    'foam.u2.chart.TimeUnit',
    'foam.u2.chart.XAxisType'
  ],

  css: `
    <<line  { fill: none; stroke-linejoin: round; stroke-linecap: round; }
    <<area  { stroke: none; fill-opacity: 0.25; }
    <<stackedArea { fill-opacity: 1; }
    <<overlay { fill: transparent; }
    <<lines   { overflow: hidden; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<series {
        animation-name: foam-u2-chart-LineChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-LineChart-fade { from { opacity: 0; transform: translateY(6px); } }
  `,

  constants: [
    {
      name: 'TIME_TICK_PX',
      documentation: 'About how far apart time ticks are, so a date label fits between two: a 600-pixel axis gets ten.',
      value: 60
    },
    {
      name: 'POINT_PAD_PX',
      documentation: 'How far past the plot the lines may draw, so a dot on the edge is not cut in half.',
      value: 4
    }
  ],

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.u2.chart.LineDataset',
      name: 'datasets',
      documentation: 'The lines. A plain object such as { label, data, fill: true } adapts to a LineDataset.'
    },
    {
      class: 'Enum',
      of: 'foam.u2.chart.XAxisType',
      name: 'xType',
      documentation: 'How x values are placed. A name such as \'time\' adapts to its value.'
    },
    {
      class: 'Enum',
      of: 'foam.u2.chart.TimeUnit',
      name: 'timeUnit',
      value: 'DAY',
      documentation: 'For a time axis: the period its ticks mark.'
    },
    {
      class: 'Boolean',
      name: 'utc',
      documentation: 'For a time axis: read the dates in UTC, for dates stored as midnight UTC. Off, times read in the viewer\'s zone.'
    },
    {
      class: 'Boolean',
      name: 'stacked',
      documentation: 'Stack the lines: each is drawn on the ones below it, as a filled band, and the top edge is the total.'
    },
    { name: 'xMin', documentation: 'Left end of the x axis: a number, a Date, or for a category axis a label index. Unset means the data decides.' },
    { name: 'xMax' },
    { name: 'yMin', documentation: 'Bottom of the y axis; unset means the data decides.' },
    { name: 'yMax' }
  ],

  methods: [
    function points_(ds) {
      // Normalises data to [{ x, y }]; a bare number list is read against data.labels.
      return ( ds.data || [] ).map(function(p, j) {
        return p !== null && typeof p === 'object' && 'y' in p ? p : { x: j, y: p };
      });
    },

    function visibleSets_() {
      var self = this;
      return this.datasets
        .map(function(ds, i) { return { ds: ds, i: i, pts: self.points_(ds) }; })
        .filter(function(s) { return ! self.isHidden(s.i); });
    },

    function xOf_(p, j) {
      // A stacked point carries its x position already (see stack_).
      return p.xv !== undefined ? p.xv : this.xType.toX(p, j);
    },

    function stack_(sets) {
      // Gives every visible line a point at every x any of them has, with y
      // the running total up to and including that line, and own the line's
      // value there (0 when it has none).
      var self = this, seen = {}, stops = [], total = {};
      sets.forEach(function(s) { s.pts.forEach(function(p, j) {
        var v = self.xType.toX(p, j);
        if ( p.y == null || seen[v] ) return;
        seen[v] = true;
        stops.push(v);
      }); });
      stops.sort(function(l, r) { return l - r; });
      return sets.map(function(s) {
        var own = {};
        s.pts.forEach(function(p, j) { if ( p.y != null ) own[self.xType.toX(p, j)] = Number(p.y); });
        return {
          ds: s.ds, i: s.i,
          pts: stops.map(function(v) {
            var y = own[v] || 0;
            total[v] = ( total[v] || 0 ) + y;
            return { xv: v, y: total[v], own: y };
          })
        };
      });
    },

    function isSet_(v) { return v !== undefined && v !== null && v !== ''; },

    function drawChart(svg, w, h) {
      var self   = this;
      var labels = this.labels.map(String);
      var sets   = this.visibleSets_();
      if ( this.stacked ) sets = this.stack_(sets);

      // x domain
      var xType = this.xType;
      var xs    = [];
      sets.forEach(function(s) { s.pts.forEach(function(p, j) { if ( p.y != null ) xs.push(self.xOf_(p, j)); }); });
      var xr  = xType.range(xs, labels);
      var xLo = this.isSet_(this.xMin) ? xType.parse(this.xMin) : xr[0];
      var xHi = this.isSet_(this.xMax) ? xType.parse(this.xMax) : xr[1];

      // y domain
      var ys = [];
      sets.forEach(function(s) { s.pts.forEach(function(p, j) {
        var x = self.xOf_(p, j);
        if ( p.y != null && x >= xLo && x <= xHi ) ys.push(Number(p.y));
      }); });
      if ( this.stacked ) ys.push(0);
      var yLo = ys.length ? Math.min.apply(null, ys) : 0;
      var yHi = ys.length ? Math.max.apply(null, ys) : 1;

      var xAxis       = xType.scale(this, xLo, xHi, w);
      var xScale      = xAxis.scale;
      var xTickValues = xAxis.ticks;
      var xLabel      = function(v, long) { return xType.tickLabel(xScale, labels, v, long); };

      var fit = this.layoutForValues(w, h, xTickValues.map(function(v) { return xLabel(v); }), false,
        function(n) {
          // Hand-set ends replace the rounded ones but keep their step.
          var s = self.LinearScale.create({ min: yLo, max: yHi, tickCount: n }).nice();
          var step = s.step;
          if ( self.isSet_(self.yMin) ) s.min = Number(self.yMin);
          if ( self.isSet_(self.yMax) ) s.max = Number(self.yMax);
          s.step = step;
          return s;
        },
        function(s) { return s.ticks(); });
      var a      = fit.area;
      var yScale = fit.scale;
      var yTicks = yScale.ticks();
      yScale.start = a.top + a.height; yScale.end = a.top;
      xScale.start = a.left; xScale.end = a.left + a.width;

      this.drawAxes(svg, a,
        xTickValues.map(function(v) { return { pos: xScale.map(v), label: xLabel(v) }; }),
        yTicks.map(function(t) { return { pos: yScale.map(t), label: yScale.format(t) }; }));

      var base = yScale.map(Math.max(yScale.min, Math.min(yScale.max, 0)));

      // A hand-set y range can put points outside the plot; a nested svg
      // cuts the lines at its edges. Its viewBox matches its box, so the
      // lines keep the outer chart's coordinates.
      var pad = this.POINT_PAD_PX;
      svg
        .start('svg').addClass(this.myClass('lines'))
          .attrs({
            x: a.left - pad, y: a.top - pad, width: a.width + 2 * pad, height: a.height + 2 * pad,
            viewBox: [ a.left - pad, a.top - pad, a.width + 2 * pad, a.height + 2 * pad ].join(' ')
          })
          // Stacked bands overlap down to the axis, so the top one goes first
          // and the ones below paint over it.
          .forEach(self.stacked ? sets.slice().reverse() : sets, function(s) {
            var px = [];
            s.pts.forEach(function(p, j) {
              if ( p.y == null ) return;
              px.push({ x: xScale.map(self.xOf_(p, j)), y: yScale.map(Number(p.y)) });
            });
            if ( ! px.length ) return;
            var color = self.seriesColor(s.i);
            this.start('g').addClass(self.myClass('series'))
              .callIf(s.ds.fill || self.stacked, function() {
                this.start('path').addClass(self.myClass('area')).enableClass(self.myClass('stackedArea'), self.stacked)
                  .attrs({
                    d: self.path_(px, s.ds, a).lineTo(px[px.length - 1].x, base).lineTo(px[0].x, base).close(),
                    fill: self.fillColor_(s.ds, color)
                  })
                .end();
              })
              .start('path').addClass(self.myClass('line'))
                .attrs({ d: self.path_(px, s.ds, a), stroke: color, 'stroke-width': s.ds.borderWidth })
              .end()
              .callIf(s.ds.pointRadius > 0, function() {
                this.forEach(px, function(p) {
                  this.start('circle').attrs({ cx: p.x, cy: p.y, r: s.ds.pointRadius, fill: color }).end();
                });
              })
            .end();
          })
        .end();

      this.drawHover_(svg, a, sets, xScale, yScale, xLabel);
    },

    function fillColor_(ds, color) {
      var bg = ds.backgroundColor;
      return bg && bg !== 'transparent' ? bg : color;
    },

    function drawHover_(svg, a, sets, xScale, yScale, xLabel) {
      // The x positions the guide can snap to: every x any visible line has.
      var self = this;
      var seen = {}, stops = [];
      sets.forEach(function(s) { s.pts.forEach(function(p, j) {
        var v = self.xOf_(p, j);
        if ( p.y == null || seen[v] ) return;
        seen[v] = true;
        stops.push(v);
      }); });
      stops.sort(function(l, r) { return l - r; });

      var marker;
      svg
        .start('g').call(function() { marker = this; }).end()
        .start('rect').addClass(this.myClass('overlay'))
          .attrs({ x: a.left, y: a.top, width: a.width, height: a.height })
          .on('mousemove', function(evt) {
            if ( ! stops.length ) return;
            var box = evt.target.ownerSVGElement.getBoundingClientRect();
            var mx  = evt.clientX - box.left;
            var v   = stops.reduce(function(best, s) {
              return Math.abs(xScale.map(s) - mx) < Math.abs(xScale.map(best) - mx) ? s : best;
            }, stops[0]);
            var gx = xScale.map(v);
            var rows = [], values = [];
            marker.removeAllChildren();
            marker.start('line').addClass(self.myClass('guide')).attrs({ x1: gx, x2: gx, y1: a.top, y2: a.top + a.height }).end();
            sets.forEach(function(s) {
              var j = s.pts.findIndex(function(p, k) { return p.y != null && self.xOf_(p, k) === v; });
              if ( j < 0 ) return;
              var y     = Number(s.pts[j].y);
              var own   = s.pts[j].own !== undefined ? s.pts[j].own : y;
              var color = self.seriesColor(s.i);
              var r     = s.ds.pointHoverRadius;
              if ( r > 0 ) marker.start('circle').attrs({ cx: gx, cy: yScale.map(y), r: r, fill: color }).end();
              rows.push({ color: color, label: s.ds.label || '', value: self.formatValue(own) });
              values.push(own);
            });
            var title = xLabel(v, true);
            self.showTooltip(evt, title, rows, self.showTooltipSum && rows.length > 1 ? self.sumLine(values) : undefined);
          })
          .on('mouseleave', function() { marker.removeAllChildren(); self.hideTooltip(); })
        .end();
    }
  ]
});
