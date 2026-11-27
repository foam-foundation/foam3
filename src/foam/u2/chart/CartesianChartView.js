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

      var yMax  = widest(yLabels, Math.min(this.MAX_LABEL_PX, w * 0.3));
      var left  = Math.ceil(yMax) + 8 + ( this.yAxisLabel ? fp + 8 : 0 ) + 2;
      var right = 12;
      var top   = Math.ceil(fp / 2) + 2;
      var width = Math.max(10, w - left - right);

      var per    = width / Math.max(1, xLabels.length);
      var xMax   = widest(xLabels, this.MAX_LABEL_PX);
      var rotate = xMax + 8 > per;
      // Rotated labels stack about one and a half line heights apart.
      var every  = rotate && this.autoSkip ? Math.max(1, Math.ceil(fp * 1.6 / per)) : 1;
      var titleH = this.xAxisLabel ? fp + 10 : 0;
      // A rotated label's drop is its length times sin 45; keep the labels
      // to at most 40% of the chart so the bars keep most of the height.
      if ( rotate ) xMax = Math.min(xMax, Math.max(30, ( h * 0.4 - titleH ) / Math.SQRT1_2 - fp));
      var labelH = rotate ? Math.ceil(( xMax + fp ) * Math.SQRT1_2) + 6 : fp + 8;
      var bottom = labelH + titleH + 2;

      return {
        w: w, h: h, left: left, top: top, width: width,
        height: Math.max(10, h - top - bottom),
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
      var first = lay(valueScale(5));
      var scale = valueScale(Math.max(2, Math.min(10, Math.round(( horizontal ? first.width : first.height ) / 40))));
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
            x: a.left - 8, y: t.pos, 'text-anchor': 'end', 'dominant-baseline': 'middle'
          });
        })
        .forEach(xTicks, function(t, i) {
          if ( i % a.every ) return;
          var y = bottom + 6;
          self.label_(this, t.label, a.xMax, a.rotate ?
            { x: t.pos, y: y + fp * 0.3, 'text-anchor': 'end', 'dominant-baseline': 'middle',
              transform: 'rotate(-45 ' + t.pos + ' ' + ( y + fp * 0.3 ) + ')' } :
            { x: t.pos, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'hanging' });
        })
        .callIf(this.yAxisLabel, function() {
          var cy = a.top + a.height / 2;
          this.start('text').addClass(self.myClass('axis-title'))
            .attrs({ x: fp * 0.9, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
                     transform: 'rotate(-90 ' + ( fp * 0.9 ) + ' ' + cy + ')' })
            .add(self.yAxisLabel)
          .end();
        })
        .callIf(this.xAxisLabel, function() {
          this.start('text').addClass(self.myClass('axis-title'))
            .attrs({ x: a.left + a.width / 2, y: a.h - 2, 'text-anchor': 'middle' })
            .add(self.xAxisLabel)
          .end();
        })
      .end();
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
