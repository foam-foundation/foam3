/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'BoxPlotChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    The spread of a number per category. A dataset holds, for each label, the
    raw numbers of that category: response times per endpoint, say, with
    labels: [ 'GET', 'POST' ] and
    datasets: [ { label: 'Latency', data: [ [ 12, 15, 18, 40 ], [ 30, 31, 90 ] ] } ].
    One box is drawn per category: it runs from the first quartile (a quarter
    of the values lie below it) to the third quartile (three quarters do), a
    line marks the median, and whiskers reach to the furthest values within
    WHISKER_IQR times the box height (the interquartile range, IQR) beyond the
    box. A value past a whisker is an outlier and gets a dot of its own.

    Quartiles use linear interpolation between the sorted values, the method
    of Excel's QUARTILE.INC: for n values the p-quantile sits at index
    (n - 1) * p, and a fractional index blends its two neighbours. For
    1, 2, 3, 4 the first quartile is at index 0.75, three quarters of the way
    from 1 to 2, so 1.75.

    Several datasets stand side by side inside each category. A category with
    no numbers in a dataset is left blank; a single number draws a flat box.
    Entries that are not numbers are ignored.

    Hovering a box shows its category and its minimum, quartiles, median,
    maximum (the whisker ends, not the outliers) and outlier count. Clicking
    calls onBoxClick(datasetIndex, index, event) with the dataset and the
    position of the category in labels.
  `,

  requires: [
    'foam.u2.chart.BandScale',
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.SVGPath'
  ],

  constants: [
    {
      name: 'WHISKER_IQR',
      documentation: 'How many box heights past the box a value may lie and still be inside the whisker: with Q1 3.25 and Q3 7.75 (box height 4.5), values from -3.5 to 14.5 are inside.',
      value: 1.5
    },
    {
      name: 'BOX_SHARE',
      documentation: 'Share of its slot a box covers; the rest keeps boxes of neighbouring datasets apart.',
      value: 0.85
    },
    {
      name: 'CAP_SHARE',
      documentation: 'Width of a whisker cap as a share of the box width.',
      value: 0.5
    },
    {
      name: 'MIN_BOX_PX',
      documentation: 'Least height of a box, so a box of equal quartiles (one value, say) is still a visible bar.',
      value: 2
    },
    {
      name: 'OUTLIER_PX',
      documentation: 'Radius of an outlier dot, in pixels.',
      value: 3
    }
  ],

  css: `
    <<median { stroke: $backgroundDefault; stroke-width: 2; shape-rendering: crispEdges; }
    <<whisker, <<cap { stroke-width: 1.5; fill: none; }
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<box-group {
        animation-name: foam-u2-chart-BoxPlotChart-grow;
        animation-timing-function: ease-out;
        transform-box: fill-box;
        transform-origin: 50% 50%;
      }
    }
    @keyframes foam-u2-chart-BoxPlotChart-grow { from { opacity: 0; transform: scaleY(0); } }
  `,

  messages: [
    { name: 'LOWEST',   message: 'Min' },
    { name: 'FIRST_QUARTILE', message: 'Q1' },
    { name: 'MEDIAN',   message: 'Median' },
    { name: 'THIRD_QUARTILE', message: 'Q3' },
    { name: 'HIGHEST',  message: 'Max' },
    { name: 'OUTLIERS', message: 'Outliers' }
  ],

  properties: [
    {
      class: 'Function',
      name: 'onBoxClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (datasetIndex, index, event) when a box is clicked.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onBoxClick$.map(function(f) { return !! f; }));
    },

    function quantile_(sorted, p) {
      // The p-quantile of sorted numbers, blending the two values around the
      // index (n - 1) * p: for 1, 2, 3, 4 the first quartile (p 0.25) sits at
      // index 0.75, three quarters of the way from 1 to 2, so it is 1.75.
      var at = ( sorted.length - 1 ) * p;
      var lo = Math.floor(at), hi = Math.ceil(at);
      return sorted[lo] + ( sorted[hi] - sorted[lo] ) * ( at - lo );
    },

    function stats_(values) {
      // The numbers a box is drawn from, or null when values holds no number:
      // { min, q1, median, q3, max, outliers } where min and max are the
      // whisker ends and outliers lists the values past them, in order.
      var nums = ( values || [] ).filter(function(v) { return typeof v === 'number' && isFinite(v); });
      if ( ! nums.length ) return null;
      var sorted = nums.slice().sort(function(a, b) { return a - b; });
      var q1 = this.quantile_(sorted, 0.25), q3 = this.quantile_(sorted, 0.75);
      var reach = this.WHISKER_IQR * ( q3 - q1 );
      var inside = sorted.filter(function(v) { return v >= q1 - reach && v <= q3 + reach; });
      // The whiskers never end inside the box: for 0, 0, 0, 100 the only
      // value in reach below Q3 (25) is 0, so the upper whisker ends at Q3.
      return {
        min:      Math.min(inside[0], q1),
        q1:       q1,
        median:   this.quantile_(sorted, 0.5),
        q3:       q3,
        max:      Math.max(inside[inside.length - 1], q3),
        outliers: sorted.filter(function(v) { return v < q1 - reach || v > q3 + reach; })
      };
    },

    function visibleSets_() {
      // Each visible dataset with the stats of every label, as
      // { ds, i, boxes } where boxes[j] is stats_ of label j or null.
      var self = this;
      return this.datasets
        .map(function(ds, i) {
          return { ds: ds, i: i, boxes: self.labels.map(function(l, j) { return self.stats_(( ds.data || [] )[j]); }) };
        })
        .filter(function(s) { return ! self.isHidden(s.i); });
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var labels = this.labels.map(String);
      var n      = labels.length;
      var sets   = this.visibleSets_();

      // The value axis reaches the lowest and highest number shown, outliers included.
      var lo = Infinity, hi = -Infinity;
      sets.forEach(function(s) {
        s.boxes.forEach(function(b) {
          if ( ! b ) return;
          lo = Math.min(lo, b.min, b.outliers.length ? b.outliers[0] : b.min);
          hi = Math.max(hi, b.max, b.outliers.length ? b.outliers[b.outliers.length - 1] : b.max);
        });
      });
      if ( lo > hi ) { lo = 0; hi = 1; }

      var fit = this.layoutForValues(w, h, labels, false,
        function(t) { return self.LinearScale.create({ min: lo, max: hi, tickCount: t }).nice(); },
        function(scale) { return scale.ticks(); });
      var a      = fit.area;
      var vScale = fit.scale;
      var band   = this.BandScale.create({ count: n, start: a.left, end: a.left + a.width });
      vScale.start = a.top + a.height;
      vScale.end   = a.top;

      this.drawAxes(svg,  a,
        labels.map(function(l, j) { return { pos: band.center(j), label: l }; }),
        vScale.ticks().map(function(t) { return { pos: vScale.map(t), label: vScale.format(t) }; }));

      var slotW = sets.length ? band.bandwidth() / sets.length : 0;
      var boxW  = slotW * this.BOX_SHARE;
      var slotX = function(j, k) { return band.center(j) - band.bandwidth() / 2 + k * slotW; };

      svg.start('g').forEach(sets, function(s, k) {
        var color = self.seriesColor(s.i);
        this.forEach(s.boxes, function(b, j) {
          if ( ! b ) return;
          var cx   = slotX(j, k) + slotW / 2;
          var y    = function(v) { return vScale.map(v); };
          var capW = boxW * self.CAP_SHARE;
          var top  = Math.min(y(b.q3), y(b.q1));
          var hgt  = Math.max(self.MIN_BOX_PX, Math.abs(y(b.q1) - y(b.q3)));
          this.start('g').addClass(self.myClass('box-group'))
            .start('path').addClass(self.myClass('whisker')).attrs({
              stroke: color,
              d: self.SVGPath.create().moveTo(cx, y(b.q3)).lineTo(cx, y(b.max))
                  .moveTo(cx, y(b.q1)).lineTo(cx, y(b.min)).toString()
            }).end()
            .start('path').addClass(self.myClass('cap')).attrs({
              stroke: color,
              d: self.SVGPath.create().moveTo(cx - capW / 2, y(b.max)).lineTo(cx + capW / 2, y(b.max))
                  .moveTo(cx - capW / 2, y(b.min)).lineTo(cx + capW / 2, y(b.min)).toString()
            }).end()
            .start('rect').addClass(self.myClass('box'))
              .attrs({ x: cx - boxW / 2, y: top, width: boxW, height: hgt, fill: color })
            .end()
            .start('line').addClass(self.myClass('median'))
              .attrs({ x1: cx - boxW / 2, x2: cx + boxW / 2, y1: y(b.median), y2: y(b.median) })
            .end()
            .forEach(b.outliers, function(v) {
              this.start('circle').addClass(self.myClass('outlier'))
                .attrs({ cx: cx, cy: y(v), r: self.OUTLIER_PX, fill: color })
              .end();
            })
          .end();
        });
      }).end();

      // A transparent column over each box and its whiskers catches the
      // pointer, so a one-pixel box can be hovered and clicked.
      svg.start('g').forEach(sets, function(s, k) {
        this.forEach(s.boxes, function(b, j) {
          if ( ! b ) return;
          this.start('rect').addClass(self.myClass('hit'))
            .attrs({ x: slotX(j, k), y: a.top, width: slotW, height: a.height })
            .on('mousemove', function(evt) { self.showBoxTooltip_(evt, s, b, j); })
            .on('mouseleave', self.hideTooltip)
            .on('click', function(evt) { if ( self.onBoxClick ) self.onBoxClick(s.i, j, evt); })
          .end();
        });
      }).end();
    },

    function showBoxTooltip_(evt, s, b, j) {
      var self  = this;
      var color = this.seriesColor(s.i);
      var rows  = [];
      // With one dataset the swatch and name add nothing; with several they say whose box this is.
      if ( this.datasets.length > 1 ) rows.push({ color: color, label: '', value: s.ds.label || '' });
      [
        [ this.LOWEST, b.min ], [ this.FIRST_QUARTILE, b.q1 ], [ this.MEDIAN, b.median ],
        [ this.THIRD_QUARTILE, b.q3 ], [ this.HIGHEST, b.max ], [ this.OUTLIERS, b.outliers.length ]
      ].forEach(function(r) { rows.push({ label: r[0], value: self.formatValue(r[1]) }); });
      this.showTooltip(evt, this.labels[j], rows);
    }
  ]
});
