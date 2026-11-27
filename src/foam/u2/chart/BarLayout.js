/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.u2.chart',
  name: 'BarLayout',

  documentation: `
    How a BarChart arranges the series of one category. With Home 1,200 and
    Docs 1,800 in a category, STACKED piles them into one bar 3,000 tall,
    GROUPED stands them side by side, and PERCENT piles them into a bar
    that always fills the axis: Home takes 40% and Docs 60%.
    BarChart asks its barLayout each question, so a new arrangement is one
    more value here.
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'piles',
      documentation: 'Whether the series of a category pile up in one bar.'
    },
    {
      class: 'String',
      name: 'suffix',
      documentation: 'Written after each value-axis tick: "%" on a PERCENT axis.'
    },
    {
      class: 'Function',
      name: 'plotValue',
      documentation: 'plotValue(value, total): where a value is drawn on the value axis; total is its category\'s total.',
      value: function(v, total) { return v; }
    },
    {
      class: 'Function',
      name: 'range',
      documentation: 'range(lo, hi): the [lo, hi] the value axis covers, given what the plotted values cover.',
      value: function(lo, hi) { return [ lo, hi ]; }
    },
    {
      class: 'Function',
      name: 'tooltipValue',
      documentation: 'tooltipValue(value, total, format): the text beside a series in the tooltip; format writes a number.',
      value: function(v, total, format) { return format(v); }
    }
  ],

  values: [
    { name: 'STACKED', label: 'Stacked', piles: true },
    { name: 'GROUPED', label: 'Grouped' },
    {
      name: 'PERCENT',
      label: '100%',
      piles: true,
      suffix: '%',
      // A category whose total is 0 has no share to draw: its values plot
      // at 0 instead of dividing by 0.
      plotValue: function(v, total) { return total ? v / total * 100 : 0; },
      // The axis reads 0% to 100% even when every category is 0.
      range: function(lo, hi) { return [ lo, 100 ]; },
      // "40% (1,200)": the share of its category, then its real value.
      tooltipValue: function(v, total, format) {
        v = Number(v) || 0;
        return format(total ? v / total * 100 : 0) + '% (' + format(v) + ')';
      }
    }
  ]
});
