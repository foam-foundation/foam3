/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'GaugeBand',

  documentation: `
    One coloured stretch of a gauge's track. A band runs from the previous
    band's upTo (or the gauge's min, for the first band) up to its own upTo:
    bands { upTo: 50, color: '$red400' }, { upTo: 80, color: '$orange400' }
    and { upTo: 100, color: '$green400' } colour a 0 to 100 dial red up to 50,
    amber from 50 to 80 and green from 80 to 100. A plain object such as
    { upTo: 50, color: '#ff0000' } given to a gauge's bands becomes a GaugeBand.
  `,

  properties: [
    {
      class: 'Double',
      name: 'upTo',
      documentation: 'Where the band ends, in the gauge\'s own units.'
    },
    {
      class: 'String',
      name: 'color',
      documentation: 'The band\'s colour: a theme token such as $red400, or a CSS colour. Unset takes a theme colour.'
    }
  ]
});
