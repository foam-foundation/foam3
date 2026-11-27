/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.u2.chart',
  name: 'XAxisType',

  documentation: `
    How a LineChart places its x values, ticks the axis and labels a tick.
    A point { x: '2024-03-01', y: 5 } sits at the third label on a CATEGORY
    axis, at March 1 on a TIME axis, and a LINEAR axis reads x as a number.
    LineChart asks its xType each question, so a new kind of axis is one more
    value here.
  `,

  properties: [
    {
      class: 'Function',
      name: 'toX',
      documentation: 'toX(point, index): the point\'s position on the axis, as a number.'
    },
    {
      class: 'Function',
      name: 'parse',
      documentation: 'parse(value): a hand-set end of the axis (xMin, xMax) as a position.',
      value: function(v) { return Number(v); }
    },
    {
      class: 'Function',
      name: 'range',
      documentation: 'range(positions, labels): the [lo, hi] the data covers.',
      value: function(xs) {
        return xs.length ? [ Math.min.apply(null, xs), Math.max.apply(null, xs) ] : [ 0, 1 ];
      }
    },
    {
      class: 'Function',
      name: 'scale',
      documentation: 'scale(chart, lo, hi, width): { scale, ticks } for an axis width pixels wide.'
    },
    {
      class: 'Function',
      name: 'tickLabel',
      documentation: 'tickLabel(scale, labels, position, long): the text for a tick; long is for the tooltip title.',
      value: function(scale, labels, v, long) { return scale.format(v, long); }
    }
  ],

  values: [
    {
      name: 'CATEGORY',
      label: 'Category',
      // Points are spaced evenly in data.labels order, whatever their x.
      toX: function(p, j) { return j; },
      range: function(xs, labels) { return [ 0, Math.max(0, labels.length - 1) ]; },
      scale: function(chart, lo, hi) {
        var ticks = [];
        for ( var j = Math.ceil(lo) ; j <= hi ; j++ ) ticks.push(j);
        return { scale: chart.LinearScale.create({ min: lo, max: hi }), ticks: ticks };
      },
      tickLabel: function(scale, labels, v) { return labels[v] === undefined ? '' : labels[v]; }
    },
    {
      name: 'LINEAR',
      label: 'Linear',
      toX: function(p) { return Number(p.x); },
      scale: function(chart, lo, hi) {
        // Round the ends only when the data chose them; hand-set ends stay put.
        var niced = chart.LinearScale.create({ min: lo, max: hi, tickCount: 6 }).nice();
        var scale = chart.isSet_(chart.xMin) || chart.isSet_(chart.xMax) ?
          chart.LinearScale.create({ min: lo, max: hi, step: niced.step }) : niced;
        return { scale: scale, ticks: chart.ticksWithin_(scale, scale.min, scale.max) };
      }
    },
    {
      name: 'TIME',
      label: 'Time',
      toX: function(p) { return new Date(p.x).getTime(); },
      parse: function(v) { return new Date(v).getTime(); },
      scale: function(chart, lo, hi, w) {
        // About one tick per 60 pixels; a finer unit moves up to the next that fits.
        var scale = chart.TimeScale.create({ unit: chart.timeUnit, utc: chart.utc, min: lo, max: hi })
          .fit(Math.max(2, Math.floor(w / 60))).nice();
        return { scale: scale, ticks: scale.ticks() };
      }
    }
  ]
});
