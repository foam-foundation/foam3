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
    One line per dataset. Each dataset's data is a list of { x, y } points;
    xType (an XAxisType) says how x is placed: CATEGORY spaces the points
    evenly in data.labels order, LINEAR reads x as a number, and TIME reads
    it as a Date with ticks on each timeUnit.

    Per dataset: borderColor (the line), backgroundColor (the area when fill
    is on), borderWidth, tension (0 draws straight segments, 0.4 smooth
    curves), stepped, pointRadius and pointHoverRadius.

    Moving the pointer over the plot marks the nearest x with a dashed guide
    and shows every visible line's value there in one tooltip.
  `,

  requires: [
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.TimeScale',
    'foam.u2.chart.TimeUnit',
    'foam.u2.chart.XAxisType'
  ],

  css: `
    <<line  { fill: none; stroke-linejoin: round; stroke-linecap: round; }
    <<area  { stroke: none; fill-opacity: 0.25; }
    <<overlay { fill: transparent; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<series {
        animation-name: foam-u2-chart-LineChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-LineChart-fade { from { opacity: 0; transform: translateY(6px); } }
  `,

  properties: [
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
      return ( this.data.datasets || [] )
        .map(function(ds, i) { return { ds: ds, i: i, pts: self.points_(ds) }; })
        .filter(function(s) { return ! self.isHidden(s.i); });
    },

    function isSet_(v) { return v !== undefined && v !== null && v !== ''; },

    function drawChart(svg, w, h) {
      var self   = this;
      var labels = ( this.data.labels || [] ).map(String);
      var sets   = this.visibleSets_();

      // x domain
      var xType = this.xType;
      var xs    = [];
      sets.forEach(function(s) { s.pts.forEach(function(p, j) { if ( p.y != null ) xs.push(xType.toX(p, j)); }); });
      var xr  = xType.range(xs, labels);
      var xLo = this.isSet_(this.xMin) ? xType.parse(this.xMin) : xr[0];
      var xHi = this.isSet_(this.xMax) ? xType.parse(this.xMax) : xr[1];

      // y domain
      var ys = [];
      sets.forEach(function(s) { s.pts.forEach(function(p, j) {
        var x = xType.toX(p, j);
        if ( p.y != null && x >= xLo && x <= xHi ) ys.push(Number(p.y));
      }); });
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
        function(s) { return self.ticksWithin_(s, s.min, s.max); });
      var a      = fit.area;
      var yScale = fit.scale;
      var yTicks = this.ticksWithin_(yScale, yScale.min, yScale.max);
      yScale.start = a.top + a.height; yScale.end = a.top;
      xScale.start = a.left; xScale.end = a.left + a.width;

      this.drawAxes(svg, a,
        xTickValues.map(function(v) { return { pos: xScale.map(v), label: xLabel(v) }; }),
        yTicks.map(function(t) { return { pos: yScale.map(t), label: yScale.format(t) }; }));

      var clipId = 'foam-u2-chart-clip-' + this.$UID;
      var base   = yScale.map(Math.max(yScale.min, Math.min(yScale.max, 0)));

      svg
        .start('defs').start('clipPath').attrs({ id: clipId })
          .start('rect').attrs({ x: a.left - 4, y: a.top - 4, width: a.width + 8, height: a.height + 8 }).end()
        .end().end()
        .start('g').attrs({ 'clip-path': 'url(#' + clipId + ')' })
          .forEach(sets, function(s) {
            var px = [];
            s.pts.forEach(function(p, j) {
              if ( p.y == null ) return;
              px.push({ x: xScale.map(xType.toX(p, j)), y: yScale.map(Number(p.y)) });
            });
            if ( ! px.length ) return;
            var color = self.seriesColor(s.i);
            var line  = self.path_(px, s.ds, a);
            this.start('g').addClass(self.myClass('series'))
              .callIf(s.ds.fill, function() {
                this.start('path').addClass(self.myClass('area'))
                  .attrs({ d: line + ' L' + px[px.length - 1].x + ',' + base + ' L' + px[0].x + ',' + base + ' Z',
                           fill: self.fillColor_(s.ds, color) })
                .end();
              })
              .start('path').addClass(self.myClass('line'))
                .attrs({ d: line, stroke: color, 'stroke-width': s.ds.borderWidth || 2 })
              .end()
              .callIf(( s.ds.pointRadius === undefined ? 3 : s.ds.pointRadius ) > 0, function() {
                var r = s.ds.pointRadius === undefined ? 3 : s.ds.pointRadius;
                this.forEach(px, function(p) {
                  this.start('circle').attrs({ cx: p.x, cy: p.y, r: r, fill: color }).end();
                });
              })
            .end();
          })
        .end();

      this.drawHover_(svg, a, sets, xScale, yScale, xLabel);
    },

    function ticksWithin_(scale, lo, hi) {
      // Round ticks inside [lo, hi] for a scale whose ends were set by hand.
      var step = scale.step;
      if ( ! step ) return [ lo, hi ];
      var d = Math.max(0, - Math.floor(Math.log10(step)));
      var ret = [];
      for ( var t = Math.ceil(lo / step - 1e-9) * step ; t <= hi + step * 1e-9 && ret.length < 200 ; t += step ) {
        ret.push(Number(t.toFixed(d)));
      }
      return ret;
    },

    function fillColor_(ds, color) {
      var bg = ds.backgroundColor;
      return bg && bg !== 'transparent' ? bg : color;
    },

    function path_(px, ds, a) {
      if ( px.length === 1 ) return 'M' + px[0].x + ',' + px[0].y;
      if ( ds.stepped ) {
        // Step before: the line rises at each point, then runs flat to the next.
        return px.map(function(p, i) {
          return i ? 'V' + p.y + ' H' + p.x : 'M' + p.x + ',' + p.y;
        }).join(' ');
      }
      var t = Number(ds.tension) || 0;
      if ( ! t ) return px.map(function(p, i) { return ( i ? 'L' : 'M' ) + p.x + ',' + p.y; }).join(' ');

      // A smooth curve through every point: each point's two control points
      // lie on the line through its neighbours, scaled by tension and by how
      // far each neighbour is, then kept inside the plot so a curve never
      // swings below the axis between two zero values.
      var clamp = function(y) { return Math.max(a.top, Math.min(a.top + a.height, y)); };
      var cps = px.map(function(p, i) {
        var prev = px[i - 1] || p, next = px[i + 1] || p;
        var d01 = Math.hypot(p.x - prev.x, p.y - prev.y), d12 = Math.hypot(next.x - p.x, next.y - p.y);
        var sum = d01 + d12 || 1;
        var fa  = t * d01 / sum, fb = t * d12 / sum;
        return {
          inX:  p.x - fa * ( next.x - prev.x ), inY:  clamp(p.y - fa * ( next.y - prev.y )),
          outX: p.x + fb * ( next.x - prev.x ), outY: clamp(p.y + fb * ( next.y - prev.y ))
        };
      });
      var d = 'M' + px[0].x + ',' + px[0].y;
      for ( var i = 1 ; i < px.length ; i++ ) {
        d += ' C' + cps[i - 1].outX + ',' + cps[i - 1].outY + ' ' + cps[i].inX + ',' + cps[i].inY + ' ' + px[i].x + ',' + px[i].y;
      }
      return d;
    },

    function drawHover_(svg, a, sets, xScale, yScale, xLabel) {
      // The x positions the guide can snap to: every x any visible line has.
      var self = this;
      var seen = {}, stops = [];
      sets.forEach(function(s) { s.pts.forEach(function(p, j) {
        var v = self.xType.toX(p, j);
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
              var j = s.pts.findIndex(function(p, k) { return p.y != null && self.xType.toX(p, k) === v; });
              if ( j < 0 ) return;
              var y     = Number(s.pts[j].y);
              var color = self.seriesColor(s.i);
              var r     = s.ds.pointHoverRadius === undefined ? 4 : s.ds.pointHoverRadius;
              if ( r > 0 ) marker.start('circle').attrs({ cx: gx, cy: yScale.map(y), r: r, fill: color }).end();
              rows.push({ color: color, label: s.ds.label || '', value: self.formatValue(y) });
              values.push(y);
            });
            var title = xLabel(v, true);
            self.showTooltip(evt, title, rows, self.showTooltipSum && rows.length > 1 ? self.sumLine(values) : undefined);
          })
          .on('mouseleave', function() { marker.removeAllChildren(); self.hideTooltip(); })
        .end();
    }
  ]
});
