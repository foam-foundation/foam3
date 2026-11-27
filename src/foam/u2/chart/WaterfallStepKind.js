/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.u2.chart',
  name: 'WaterfallStepKind',

  documentation: `
    The three kinds of bar in a WaterfallChart: a RISE (a step above zero),
    a FALL (a step below zero) and the TOTAL bar that shows where the running
    total ended. The ordinal picks the colour from a dataset's
    backgroundColor list: RISE first, FALL second, TOTAL third.
  `,

  properties: [
    {
      class: 'String',
      name: 'color',
      documentation: 'Theme token for the bar when the dataset sets no colour of its own.'
    }
  ],

  values: [
    { name: 'RISE',  label: 'Rise',  color: '$green400' },
    { name: 'FALL',  label: 'Fall',  color: '$red400' },
    { name: 'TOTAL', label: 'Total', color: '$primary400' }
  ]
});
