/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'CartesianChartView',
  extends: 'foam.u2.chart.ChartView',

  documentation: `
    Base for charts drawn against an x and a y axis: bars and lines. It works
    out how much room the tick labels need, keeps x labels from overlapping,
    and draws the gridlines, axis lines, labels and axis titles. A chart type
    calls layout() with its labels, builds its scales on the returned plot
    area, then calls drawAxes() with each tick's pixel position.

    When x labels are wider than the space each one gets (31 months on a
    500-pixel axis) they turn 45 degrees, and with autoSkip only every n-th
    one is written, so no two overlap.
  `,

  constants: [
    {
      name: 'MAX_LABEL_PX',
      documentation: 'Longest a tick label may be before it ends in an ellipsis; the full text stays in its hover title.',
      value: 140
    },
    {
      name: 'MAX_Y_LABEL_SHARE',
      documentation: 'Most of the chart\'s width the y labels may take, so a narrow chart keeps room to plot.',
      value: 0.3
    },
    {
      name: 'MAX_X_LABEL_SHARE',
      documentation: 'Most of the chart\'s height turned x labels may take, so the plot keeps most of it.',
      value: 0.4
    },
    {
      name: 'MIN_TURNED_LABEL_PX',
      documentation: 'Shortest a turned x label is cut to, however little height is left.',
      value: 30
    },
    {
      name: 'TURNED_LABEL_SPACING',
      documentation: 'How far apart turned labels sit along the axis, in line heights: closer and they overlap.',
      value: 1.6
    },
    {
      name: 'LABEL_GAP_PX',
      documentation: 'Space between a tick label and its axis, and between the y labels and the y title.',
      value: 8
    },
    {
      name: 'TITLE_GAP_PX',
      documentation: 'Space between the x labels and the x title.',
      value: 10
    },
    {
      name: 'TICK_DROP_PX',
      documentation: 'How far below the x axis its labels start.',
      value: 6
    },
    {
      name: 'EDGE_PX',
      documentation: 'Margin between the outermost text and the edge of the chart.',
      value: 2
    },
    {
      name: 'RIGHT_PAD_PX',
      documentation: 'Room right of the plot for the last x label, which is centred on its tick.',
      value: 12
    },
    {
      name: 'VALUE_TICK_PX',
      documentation: 'About how far apart value ticks are: a 200-pixel axis gets five.',
      value: 40
    },
    {
      name: 'MIN_VALUE_TICKS',
      documentation: 'Fewest steps a value axis has, so even a short one shows a scale.',
      value: 2
    },
    {
      name: 'MAX_VALUE_TICKS',
      documentation: 'Most steps a value axis has, so a tall one stays readable.',
      value: 10
    },
    {
      name: 'FIRST_LAYOUT_TICKS',
      documentation: 'Steps assumed for the first layout, before the plot size is known.',
      value: 5
    },
    {
      name: 'TURNED_LABEL_NUDGE',
      documentation: 'How far a turned label moves down, in line heights, so its end meets its tick.',
      value: 0.3
    },
    {
      name: 'Y_TITLE_X',
      documentation: 'Where the turned y title sits from the left edge, in line heights.',
      value: 0.9
    }
  ],

  properties: [
    { class: 'String', name: 'xAxisLabel' },
    { class: 'String', name: 'yAxisLabel' },
    { class: 'Boolean', name: 'showGridLines', value: true },
    {
      class: 'Boolean',
      name: 'autoSkip',
      value: true,
      documentation: 'Leave out x labels that would overlap. When off, every label is written, turned 45 degrees.'
    }
  ],

  methods: [
    function layout(w, h, xLabels, yLabels) {
      var self = this;
      var fp   = this.fontPx();
      var widest = function(labels, cap) {
        return Math.min(cap, labels.reduce(function(m, l) { return Math.max(m, self.textWidth(l)); }, 0));
      };

      var gap = this.LABEL_GAP_PX, edge = this.EDGE_PX;

      var yMax  = widest(yLabels, Math.min(this.MAX_LABEL_PX, w * this.MAX_Y_LABEL_SHARE));
      var left  = Math.ceil(yMax) + gap + ( this.yAxisLabel ? fp + gap : 0 ) + edge;
      var top   = Math.ceil(fp / 2) + edge;
      var width = Math.max(this.MIN_PLOT_PX, w - left - this.RIGHT_PAD_PX);

      var per    = width / Math.max(1, xLabels.length);
      var xMax   = widest(xLabels, this.MAX_LABEL_PX);
      var rotate = xMax + gap > per;
      var every  = rotate && this.autoSkip ? Math.max(1, Math.ceil(fp * this.TURNED_LABEL_SPACING / per)) : 1;
      var titleH = this.xAxisLabel ? fp + this.TITLE_GAP_PX : 0;
      // A label turned 45 degrees drops its length times sin 45.
      if ( rotate ) xMax = Math.min(xMax, Math.max(this.MIN_TURNED_LABEL_PX, ( h * this.MAX_X_LABEL_SHARE - titleH ) / Math.SQRT1_2 - fp));
      var labelH = rotate ? Math.ceil(( xMax + fp ) * Math.SQRT1_2) + this.TICK_DROP_PX : fp + gap;
      var bottom = labelH + titleH + edge;

      return {
        w: w, h: h, left: left, top: top, width: width,
        height: Math.max(this.MIN_PLOT_PX, h - top - bottom),
        rotate: rotate, every: every, xMax: xMax, yMax: yMax
      };
    },

    function layoutForValues(w, h, catLabels, horizontal, valueScale, valueTicks) {
      // The value axis holds about one tick every 40 pixels, so its tick
      // count depends on the plot size, and the plot size depends on how wide
      // the value labels are. Lay out with five steps, size the axis from
      // that plot, then lay out again with the labels that get written: a
      // taller axis can say "10,000" where five steps said "8,000".
      // valueScale(tickCount) builds the scale; valueTicks(scale) lists its ticks.
      var self = this;
      var lay  = function(scale) {
        var v = valueTicks(scale).map(function(t) { return scale.format(t); });
        return horizontal ? self.layout(w, h, v, catLabels) : self.layout(w, h, catLabels, v);
      };
      var first = lay(valueScale(this.FIRST_LAYOUT_TICKS));
      var size  = horizontal ? first.width : first.height;
      var scale = valueScale(Math.max(this.MIN_VALUE_TICKS, Math.min(this.MAX_VALUE_TICKS, Math.round(size / this.VALUE_TICK_PX))));
      return { area: lay(scale), scale: scale };
    },

    function drawAxes(svg, a, xTicks, yTicks) {
      // xTicks and yTicks are [{ pos, label }] with pos in pixels; a grid
      // line runs from each tick across the plot when showGridLines is on.
      var self   = this;
      var fp     = this.fontPx();
      var bottom = a.top + a.height;
      var right  = a.left + a.width;

      svg.start('g')
        .callIf(this.showGridLines, function() {
          this
            .forEach(yTicks, function(t) {
              this.start('line').addClass(self.myClass('grid'))
                .attrs({ x1: a.left, x2: right, y1: t.pos, y2: t.pos }).end();
            })
            .forEach(xTicks, function(t) {
              this.start('line').addClass(self.myClass('grid'))
                .attrs({ x1: t.pos, x2: t.pos, y1: a.top, y2: bottom }).end();
            });
        })
        .start('line').addClass(this.myClass('axis')).attrs({ x1: a.left, x2: right, y1: bottom, y2: bottom }).end()
        .start('line').addClass(this.myClass('axis')).attrs({ x1: a.left, x2: a.left, y1: a.top, y2: bottom }).end()
        .forEach(yTicks, function(t) {
          self.label_(this, t.label, a.yMax, {
            x: a.left - self.LABEL_GAP_PX, y: t.pos, 'text-anchor': 'end', 'dominant-baseline': 'middle'
          });
        })
        .forEach(xTicks, function(t, i) {
          if ( i % a.every ) return;
          var y = bottom + self.TICK_DROP_PX;
          var ty = y + fp * self.TURNED_LABEL_NUDGE;
          self.label_(this, t.label, a.xMax, a.rotate ?
            { x: t.pos, y: ty, 'text-anchor': 'end', 'dominant-baseline': 'middle', transform: self.rotate_(-45, t.pos, ty) } :
            { x: t.pos, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'hanging' });
        })
        .callIf(this.yAxisLabel, function() {
          var cx = fp * self.Y_TITLE_X, cy = a.top + a.height / 2;
          this.start('text').addClass(self.myClass('axis-title'))
            .attrs({ x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle', transform: self.rotate_(-90, cx, cy) })
            .add(self.yAxisLabel)
          .end();
        })
        .callIf(this.xAxisLabel, function() {
          this.start('text').addClass(self.myClass('axis-title'))
            .attrs({ x: a.left + a.width / 2, y: a.h - self.EDGE_PX, 'text-anchor': 'middle' })
            .add(self.xAxisLabel)
          .end();
        })
      .end();
    },

    function rotate_(degrees, x, y) {
      // An SVG transform that turns an element about (x, y); negative turns anticlockwise.
      return 'rotate(' + degrees + ' ' + x + ' ' + y + ')';
    },

    function label_(parent, text, maxPx, attrs) {
      var shown = this.truncate(text, maxPx);
      parent.start('text').addClass(this.myClass('text')).attrs(attrs)
        .add(shown)
        .callIf(shown !== String(text), function() { this.start('title').add(String(text)).end(); })
      .end();
    }
  ]
});
