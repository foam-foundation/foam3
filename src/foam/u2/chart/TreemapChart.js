/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'TreemapChart',
  extends: 'foam.u2.chart.ChartView',

  documentation: `
    One rectangle per label, its area in proportion to the label's value in
    the first dataset, together filling the plot: visits of 50, 30, 15 and 5
    give rectangles covering 50%, 30%, 15% and 5% of it. The biggest value
    sits in the top left corner.

    The rectangles are laid out with the squarified algorithm: each row of
    rectangles is extended while that keeps its worst rectangle closer to a
    square, so a long thin sliver is avoided where it can be. A rectangle
    shows its label and value when they fit and nothing when it is too small;
    hovering it always shows both with its share of the total.

    The legend has one entry per label; clicking one hides that rectangle and
    the others grow to fill the plot. A zero or negative value gets no
    rectangle.
  `,

  constants: [
    {
      name: 'TEXT_PAD_PX',
      documentation: 'Room kept between a rectangle\'s edge and the label written inside it.',
      value: 6
    },
    {
      name: 'MIN_LABEL_PX',
      documentation: 'Narrowest room, inside a rectangle, worth writing a label in: 40 leaves space for about five letters and an ellipsis.',
      value: 40
    },
    {
      name: 'LINE_HEIGHT_RATIO',
      documentation: 'Height of a line of label text as a multiple of the font size: 1.3 on a 12px font gives 15.6px.',
      value: 1.3
    },
    {
      name: 'PERCENT_DECIMALS',
      documentation: 'Decimals in the share shown in the tooltip: 1 reads "38.9%".',
      value: 1
    },
    {
      name: 'LIGHT_TEXT_COLOR',
      documentation: 'Theme token for the label written on a dark rectangle.',
      value: '$white'
    },
    {
      name: 'DARK_TEXT_COLOR',
      documentation: 'Theme token for the label written on a light rectangle.',
      value: '$black'
    }
  ],

  css: `
    <<tile { stroke: $backgroundDefault; stroke-width: 2; }
    <<tile:hover { filter: brightness(0.92); }
    <<clickable <<tile { cursor: pointer; }
    <<tile-label { pointer-events: none; font-size: 1.2rem; }
    <<tile-value { pointer-events: none; font-size: 1.2rem; opacity: 0.85; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<tile {
        animation-name: foam-u2-chart-TreemapChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-TreemapChart-fade { from { opacity: 0; } }
  `,

  properties: [
    {
      class: 'Function',
      name: 'onRectClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (index, event) when a rectangle is clicked; index is its position in labels.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onRectClick$.map(function(f) { return !! f; }));
    },

    function values_() {
      var ds = this.datasets[0];
      return ( ds ? ds.data : [] ).map(function(v) { return Number(v) || 0; });
    },

    function total_() {
      var self = this;
      return this.values_().reduce(function(sum, v, i) { return self.isHidden(i) || v <= 0 ? sum : sum + v; }, 0);
    },

    function percent(i) {
      var total = this.total_();
      var v     = this.isHidden(i) ? 0 : this.values_()[i];
      return ( total > 0 ? v / total * 100 : 0 ).toFixed(this.PERCENT_DECIMALS) + '%';
    },

    function legendItems() {
      var self   = this;
      var labels = this.labels;
      return this.values_().map(function(v, i) {
        return {
          label:  String(labels[i] === undefined ? '' : labels[i]),
          color:  self.seriesColor(0, i),
          hidden: self.isHidden(i)
        };
      });
    },

    function seriesColor(i, opt_index) {
      // Rectangles take the dataset's colours in turn, then the theme defaults.
      var ds = this.datasets[0];
      var bg = ds && ds.backgroundColor;
      var j  = opt_index || 0;
      if ( Array.isArray(bg) && bg.length ) return bg[j % bg.length];
      return this.defaultColor(j);
    },

    function squarify(values, x, y, w, h) {
      // Lays the positive values out in the box (x, y, w, h), biggest first
      // from the top left, and returns [{ i, x, y, w, h }] with i the index
      // into values. Each rectangle's area is its value's share of the box.
      var items = values
        .map(function(v, i) { return { i: i, v: v }; })
        .filter(function(e) { return e.v > 0; })
        .sort(function(a, b) { return b.v - a.v; });
      var sum = items.reduce(function(s, e) { return s + e.v; }, 0);
      var out = [];
      if ( ! sum || w <= 0 || h <= 0 ) return out;
      var scale = w * h / sum;
      items.forEach(function(e) { e.area = e.v * scale; });

      // The worst aspect ratio in a row of areas laid along a side of length
      // `side`: a 10 by 1 sliver is 10, a square is 1.
      var worst = function(row, rowSum, side) {
        var max = row[0].area, min = row[row.length - 1].area;
        return Math.max(side * side * max / ( rowSum * rowSum ), rowSum * rowSum / ( side * side * min ));
      };

      var k = 0;
      while ( k < items.length ) {
        var side   = Math.min(w, h);
        var end    = k + 1;
        var rowSum = items[k].area;
        // Items are in falling order, so a new one only ever becomes the row's smallest.
        while ( end < items.length ) {
          var next = rowSum + items[end].area;
          if ( worst(items.slice(k, end + 1), next, side) > worst(items.slice(k, end), rowSum, side) ) break;
          rowSum = next;
          end++;
        }
        var row = items.slice(k, end);
        if ( w >= h ) {
          // A column on the left, as wide as the row's area needs.
          var cw = rowSum / h, cy = y;
          row.forEach(function(e) {
            var eh = e.area / cw;
            out.push({ i: e.i, x: x, y: cy, w: cw, h: eh });
            cy += eh;
          });
          x += cw; w -= cw;
        } else {
          // A band along the top.
          var rh = rowSum / w, cx = x;
          row.forEach(function(e) {
            var ew = e.area / rh;
            out.push({ i: e.i, x: cx, y: y, w: ew, h: rh });
            cx += ew;
          });
          y += rh; h -= rh;
        }
        k = end;
      }
      return out;
    },

    function drawChart(svg, w, h) {
      var self   = this;
      var values = this.values_().map(function(v, i) { return self.isHidden(i) ? 0 : v; });
      var rects  = this.squarify(values, 0, 0, w, h);
      var light  = foam.CSS.returnTokenValue(this.LIGHT_TEXT_COLOR, this.cls_, this.__subContext__);
      var dark   = foam.CSS.returnTokenValue(this.DARK_TEXT_COLOR, this.cls_, this.__subContext__);
      var fp     = this.fontPx();
      var line   = fp * this.LINE_HEIGHT_RATIO;
      var pad    = this.TEXT_PAD_PX;

      svg.start('g').addClass(this.myClass('tiles')).call(function() {
        var g = this;
        rects.forEach(function(r) {
          var fill = self.seriesColor(0, r.i);
          g.start('rect').addClass(self.myClass('tile'))
            .attrs({ x: r.x, y: r.y, width: r.w, height: r.h, fill: fill })
            .on('mousemove', function(evt) { self.showRectTooltip_(evt, r.i); })
            .on('mouseleave', self.hideTooltip)
            .on('click', function(evt) { if ( self.onRectClick ) self.onRectClick(r.i, evt); })
          .end();

          var room = r.w - 2 * pad;
          if ( room < self.MIN_LABEL_PX || r.h < line + 2 * pad ) return;
          var text = foam.Color.getBestForeground(fill, dark, light);
          var name = self.truncate(self.labels[r.i] === undefined ? '' : self.labels[r.i], room);
          // A name cut down to nothing but its ellipsis tells the reader nothing.
          if ( name === '…' ) return;
          g.start('text').addClass(self.myClass('tile-label'))
            .attrs({ x: r.x + pad, y: r.y + pad + fp, fill: text })
            .add(name)
          .end();
          // The value goes on a second line, when that line fits too.
          var value = self.formatValue(values[r.i]);
          if ( r.h >= 2 * line + 2 * pad && self.textWidth(value) <= room ) {
            g.start('text').addClass(self.myClass('tile-value'))
              .attrs({ x: r.x + pad, y: r.y + pad + fp + line, fill: text })
              .add(value)
            .end();
          }
        });
      }).end();
    },

    function rectRow_(i) {
      var labels = this.labels;
      return {
        color: this.seriesColor(0, i),
        label: String(labels[i] === undefined ? '' : labels[i]),
        value: this.formatValue(this.values_()[i]) + ' (' + this.percent(i) + ')'
      };
    },

    function showRectTooltip_(evt, i) {
      this.showTooltip(evt, '', [ this.rectRow_(i) ]);
    }
  ],

  listeners: [
    function onLegendHover(i, evt) {
      if ( i < 0 ) { this.hideTooltip(); return; }
      this.showTooltip(evt, '', [ this.rectRow_(i) ]);
    }
  ]
});
