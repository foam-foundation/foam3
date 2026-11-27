/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'BubbleChart',
  extends: 'foam.u2.chart.ScatterChart',

  documentation: `
    A scatter whose points also have a size: one bubble per { x, y, r } point,
    one colour per dataset. Requests by size and latency, with the number of
    calls as the bubble:
    datasets: [ { label: 'GET', data: [ { x: 120, y: 35, r: 900 }, { x: 800, y: 210, r: 40 } ] } ].

    The bubble's area, not its radius, follows r: a value four times larger
    covers four times the area. The largest visible r gets MAX_RADIUS_PX and
    the others scale down from it, but never below MIN_RADIUS_PX, so a tiny
    value stays visible (its area is then larger than r alone would give).
    A point whose r is not a number, or is below 0, is not drawn.

    It extends ScatterChart and keeps its axes, legend, hover target, click
    and animation: BubbleChart only says what a point holds (pointOf_), how
    big a mark is (radiusFn_), how it looks (markAttrs_) and what the tooltip
    lists (pointRows_). Larger bubbles are drawn first in each dataset, so a
    small one is never hidden under a large one.

    Hovering a bubble shows its series with x, y and size, named by
    xAxisLabel, yAxisLabel and sizeLabel when they are set. Clicking calls
    onPointClick(datasetIndex, index, event) as the scatter does.
  `,

  constants: [
    {
      name: 'MIN_RADIUS_PX',
      documentation: 'Radius of the smallest bubble, in pixels: a value of 0 still leaves a dot the pointer can hit.',
      value: 4
    },
    {
      name: 'MAX_RADIUS_PX',
      documentation: 'Radius of the bubble with the largest r, in pixels: big enough to show how much larger it is, small enough that ten of them fit a 300-pixel plot.',
      value: 30
    },
    {
      name: 'FILL_OPACITY',
      documentation: 'How solid a bubble is, from 0 to 1: at 0.6 two bubbles that overlap are both still visible.',
      value: 0.6
    }
  ],

  messages: [
    { name: 'SIZE', message: 'Size' }
  ],

  properties: [
    {
      class: 'String',
      name: 'sizeLabel',
      documentation: 'What the tooltip calls the size of a bubble. Left empty it says "Size".'
    }
  ],

  methods: [
    function pointOf_(d) {
      var p = this.SUPER(d);
      if ( ! p || d.r == null ) return null;
      p.r = Number(d.r);
      return isFinite(p.r) && p.r >= 0 ? p : null;
    },

    function visibleSets_() {
      // Largest first within a dataset, so the small bubbles sit on top. j,
      // the position in data, travels with each point.
      var sets = this.SUPER();
      sets.forEach(function(s) { s.pts.sort(function(a, b) { return b.r - a.r; }); });
      return sets;
    },

    function radiusFn_(sets) {
      // Area in proportion to r: radius = MAX_RADIUS_PX * sqrt(r / largest r),
      // not less than MIN_RADIUS_PX.
      var self = this;
      var most = 0;
      sets.forEach(function(s) { s.pts.forEach(function(p) { most = Math.max(most, p.r); }); });
      return function(p) {
        return most > 0 ? Math.max(self.MIN_RADIUS_PX, self.MAX_RADIUS_PX * Math.sqrt(p.r / most)) : self.MIN_RADIUS_PX;
      };
    },

    function markAttrs_() {
      return { 'fill-opacity': this.FILL_OPACITY };
    },

    function pointRows_(p, color) {
      var rows = this.SUPER(p, color);
      rows.push({ color: color, label: this.sizeLabel || this.SIZE, value: this.formatValue(p.r) });
      return rows;
    }
  ]
});
