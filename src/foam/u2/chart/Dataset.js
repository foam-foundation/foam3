/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'Dataset',

  documentation: `
    One series of a chart: its name in the legend, one value per label and
    its colour. A plain object such as { label: 'Sales', data: [ 1, 2 ] }
    given to a chart's datasets becomes a Dataset.
  `,

  properties: [
    {
      class: 'String',
      name: 'label',
      documentation: 'The series name, shown in the legend and the tooltip.'
    },
    {
      class: 'Array',
      name: 'data',
      documentation: 'One value per label; a line chart also takes { x, y } points.'
    },
    {
      name: 'backgroundColor',
      documentation: 'The fill: one colour, or a list with one per value (a bar or slice each). Unset takes a theme colour.'
    },
    {
      class: 'String',
      name: 'borderColor',
      documentation: 'The outline, or the line itself on a line chart; when set, it also names the series colour.'
    }
  ]
});
