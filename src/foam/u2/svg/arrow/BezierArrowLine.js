/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.svg.arrow',
  name: 'BezierArrowLine',
  extends: 'foam.u2.svg.arrow.ArrowLine',
  documentation: `
    An ArrowLine rendered as a cubic bezier curve between startPos and
    endPos. The curve's control points are offset horizontally from each
    endpoint by half the horizontal distance between them, clamped to a
    minimum of minOffset. For a back edge (endPos to the left of startPos)
    this clamp keeps the control points on the outward side of each
    endpoint, so the curve reads as an S instead of looping back on itself.
  `,

  requires: [
    'foam.u2.svg.arrow.SimpleArrowHead'
  ],

  css: `
    ^ path {
      fill: none;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'kind',
      documentation: 'Adds the CSS class myClass(kind) so consumers can style per kind.'
    },
    {
      class: 'Boolean',
      name: 'arrowHead',
      documentation: 'Draw a SimpleArrowHead at endPos pointing right.'
    },
    {
      class: 'Float',
      name: 'headSize',
      value: 6
    },
    {
      class: 'Float',
      name: 'minOffset',
      value: 40,
      documentation: 'Minimum horizontal control-point offset; keeps back-edges readable as an S.'
    }
  ],

  methods: [
    function pathFor (x1, y1, x2, y2, minOffset) {
      const dx = Math.max(minOffset, (x2 - x1) / 2);
      return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    },
    function render () {
      this.SUPER();
      this.addClass(this.myClass());
      if ( this.kind ) this.addClass(this.myClass(this.kind));
      this
        .start('path')
          .attrs({
            d: this.slot(function (startPos$x, startPos$y, endPos$x, endPos$y) {
              return this.pathFor(startPos$x, startPos$y, endPos$x, endPos$y, this.minOffset);
            })
          })
        .end();
      if ( this.arrowHead ) {
        this.tag(this.SimpleArrowHead, {
          pos: this.endPos,
          angle: Math.PI / 2,
          size: this.headSize
        });
      }
    }
  ]
});
