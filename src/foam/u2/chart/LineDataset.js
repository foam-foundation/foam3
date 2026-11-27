/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'LineDataset',
  extends: 'foam.u2.chart.Dataset',

  documentation: 'One line of a LineChart: how it is drawn, on top of its values and colour.',

  properties: [
    {
      class: 'Boolean',
      name: 'fill',
      documentation: 'Shade the area between the line and zero in backgroundColor.'
    },
    {
      class: 'Float',
      name: 'tension',
      documentation: 'How much the line bends through its points: 0 draws straight segments, 0.4 a smooth curve.'
    },
    {
      class: 'Boolean',
      name: 'stepped',
      documentation: 'Draw steps instead of slopes: the line rises at each point, then runs flat to the next.'
    },
    {
      class: 'Float',
      name: 'borderWidth',
      value: 2,
      documentation: 'Line thickness, in pixels.'
    },
    {
      class: 'Float',
      name: 'pointRadius',
      value: 3,
      documentation: 'Radius of the dot on each point, in pixels; 0 draws no dots.'
    },
    {
      class: 'Float',
      name: 'pointHoverRadius',
      value: 4,
      documentation: 'Radius of the dot that marks a hovered point, in pixels; 0 draws none.'
    }
  ]
});
