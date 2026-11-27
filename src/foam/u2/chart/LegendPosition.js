/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.u2.chart',
  name: 'LegendPosition',

  documentation: `
    Which side of a chart its legend sits on. A legend LEFT or RIGHT is
    vertical: its entries stack in a column beside the plot.
  `,

  properties: [
    { class: 'Boolean', name: 'vertical' }
  ],

  values: [
    { name: 'TOP',    label: 'Top' },
    { name: 'RIGHT',  label: 'Right',  vertical: true },
    { name: 'BOTTOM', label: 'Bottom' },
    { name: 'LEFT',   label: 'Left',   vertical: true }
  ]
});
