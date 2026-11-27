/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'ScatterChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    One dot per { x, y } point, one colour per dataset. Both axes are
    numeric: response time against payload size, say, with
    datasets: [ { label: 'GET', data: [ { x: 120, y: 35 }, { x: 800, y: 210 } ] } ].
    Each axis stretches to the visible points, so hiding a dataset from the
    legend rescales the axes to what is left.

    Hovering a dot shows its series with its x and y, named by xAxisLabel and
    yAxisLabel when they are set. Clicking a dot calls
    onPointClick(datasetIndex, index, event) with the dataset and the
    position of the point in its data.
  `,

  requires: [
    'foam.u2.chart.LinearScale'
  ],

  constants: [
    {
      name: 'DOT_PX',
      documentation: 'Radius of a dot, in pixels: big enough to see, small enough that 500 points stay apart.',
      value: 4
    },
    {
      name: 'HIT_SLACK_PX',
      documentation: 'How far outside a dot the pointer still counts as on it, so a dot is easy to hover and click.',
      value: 4
    },
    {
      name: 'X_TICK_PX',
      documentation: 'About how far apart x ticks are: a 600-pixel axis gets seven. Wider than VALUE_TICK_PX because x labels run along the axis.',
      value: 80
    }
  ],

  css: `
    <<dot { stroke: transparent; }
    <<dot:hover { filter: brightness(0.92); }
    <<clickable <<dot { cursor: pointer; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<dot {
        animation-name: foam-u2-chart-ScatterChart-pop;
        animation-timing-function: ease-out;
        transform-box: fill-box;
        transform-origin: center;
      }
    }
    @keyframes foam-u2-chart-ScatterChart-pop { from { opacity: 0; transform: scale(0); } }
  `,

  properties: [
    {
      class: 'Function',
      name: 'onPointClick',
      documentation: 'Called with (datasetIndex, index, event) when a dot is clicked.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onPointClick$.map(function(f) { return !! f; }));
    },

    function visibleSets_() {
      // Each visible dataset with its points as { x, y, j }, j being the
      // position in data. A point missing either number is not drawn.
      var self = this;
      return this.datasets
        .map(function(ds, i) {
          var pts = [];
          ( ds.data || [] ).forEach(function(p, j) {
            if ( p == null || p.x == null || p.y == null ) return;
            var x = Number(p.x), y = Number(p.y);
            if ( isFinite(x) && isFinite(y) ) pts.push({ x: x, y: y, j: j });
          });
          return { ds: ds, i: i, pts: pts };
        })
        .filter(function(s) { return ! self.isHidden(s.i); });
    },

    function extent_(values) {
      // [ lowest, highest ]; with no values, [ 0, 1 ] so an empty chart still draws axes.
      if ( ! values.length ) return [ 0, 1 ];
      return values.reduce(function(r, v) { return [ Math.min(r[0], v), Math.max(r[1], v) ]; }, [ values[0], values[0] ]);
    },

    function tickCount_(size, spacing) {
      return Math.max(this.MIN_VALUE_TICKS, Math.min(this.MAX_VALUE_TICKS, Math.round(size / spacing)));
    },

    function drawChart(svg, w, h) {
      var self = this;
      var sets = this.visibleSets_();
      var xs = [], ys = [];
      sets.forEach(function(s) { s.pts.forEach(function(p) { xs.push(p.x); ys.push(p.y); }); });
      var xr = this.extent_(xs), yr = this.extent_(ys);

      var scale = function(range, n) { return self.LinearScale.create({ min: range[0], max: range[1], tickCount: n }).nice(); };
      var lay   = function(xScale, yScale) {
        return self.layout(w, h,
          xScale.ticks().map(function(t) { return xScale.format(t); }),
          yScale.ticks().map(function(t) { return yScale.format(t); }));
      };

      // Same two passes as layoutForValues, once per axis: the tick count
      // follows the plot size, and the plot size follows the label widths.
      var first  = lay(scale(xr, this.FIRST_LAYOUT_TICKS), scale(yr, this.FIRST_LAYOUT_TICKS));
      var xScale = scale(xr, this.tickCount_(first.width, this.X_TICK_PX));
      var yScale = scale(yr, this.tickCount_(first.height, this.VALUE_TICK_PX));
      var a      = lay(xScale, yScale);
      xScale.start = a.left;              xScale.end = a.left + a.width;
      yScale.start = a.top + a.height;    yScale.end = a.top;

      this.drawAxes(svg, a,
        xScale.ticks().map(function(t) { return { pos: xScale.map(t), label: xScale.format(t) }; }),
        yScale.ticks().map(function(t) { return { pos: yScale.map(t), label: yScale.format(t) }; }));

      svg.start('g').addClass(this.myClass('dots'))
        .forEach(sets, function(s) {
          var color = self.seriesColor(s.i);
          this.forEach(s.pts, function(p) {
            this.start('circle').addClass(self.myClass('dot'))
              .attrs({
                cx: xScale.map(p.x), cy: yScale.map(p.y), r: self.DOT_PX,
                fill: color, 'stroke-width': 2 * self.HIT_SLACK_PX
              })
              .on('mousemove', function(evt) { self.showPointTooltip_(evt, s, p, color); })
              .on('mouseleave', self.hideTooltip)
              .on('click', function(evt) { if ( self.onPointClick ) self.onPointClick(s.i, p.j, evt); })
            .end();
          });
        })
      .end();
    },

    function showPointTooltip_(evt, s, p, color) {
      this.showTooltip(evt, s.ds.label || '', [
        { color: color, label: this.xAxisLabel || 'x', value: this.formatValue(p.x) },
        { color: color, label: this.yAxisLabel || 'y', value: this.formatValue(p.y) }
      ]);
    }
  ]
});
