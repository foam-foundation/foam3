/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'SVGPath',

  documentation: `
    Builds the d attribute of an SVG <path> one named step at a time, so a
    chart says what it draws instead of writing path letters:
    SVGPath.create().moveTo(0, 0).lineTo(10, 0).close().toString() is
    "M0,0 L10,0 Z". Each step returns the path, so steps chain.
  `,

  properties: [
    {
      class: 'StringArray',
      name: 'steps_',
      documentation: 'The path steps written so far, one SVG path command each.'
    }
  ],

  methods: [
    function add_(step) { this.steps_.push(step); return this; },

    function moveTo(x, y)   { return this.add_('M' + x + ',' + y); },
    function lineTo(x, y)   { return this.add_('L' + x + ',' + y); },
    function horizontalTo(x) { return this.add_('H' + x); },
    function verticalTo(y)  { return this.add_('V' + y); },

    function curveTo(x1, y1, x2, y2, x, y) {
      // A cubic Bezier curve to (x, y), pulled toward (x1, y1) as it leaves
      // and toward (x2, y2) as it arrives.
      return this.add_('C' + x1 + ',' + y1 + ' ' + x2 + ',' + y2 + ' ' + x + ',' + y);
    },

    function arcTo(r, largeArc, clockwise, x, y) {
      // A circular arc of radius r to (x, y). largeArc picks the longer of
      // the two arcs between the points; clockwise picks the direction.
      return this.add_('A' + r + ',' + r + ' 0 ' + ( largeArc ? 1 : 0 ) + ' ' + ( clockwise ? 1 : 0 ) + ' ' + x + ',' + y);
    },

    function close() { return this.add_('Z'); },

    function toString() { return this.steps_.join(' '); }
  ]
});
