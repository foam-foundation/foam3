/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'BezierArrowLineTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.u2.svg.arrow.BezierArrowLine'
  ],

  methods: [
    async function runTest(x) {
      var line = this.BezierArrowLine.create();

      x.test(
        line.pathFor(0, 0, 100, 50, 40) === 'M 0 0 C 50 0, 50 50, 100 50',
        'pathFor: forward edge uses half the horizontal distance'
      );

      x.test(
        line.pathFor(100, 0, 0, 50, 40) === 'M 100 0 C 140 0, -40 50, 0 50',
        'pathFor: back edge (endPos left of startPos) clamps to minOffset ' +
        'so the curve reads as an S'
      );

      x.test(
        line.pathFor(0, 0, 10, 0, 40) === 'M 0 0 C 40 0, -30 0, 10 0',
        'pathFor: short forward edge clamps to minOffset'
      );

      var kinded = this.BezierArrowLine.create({ kind: 'reaction' });
      x.test(
        kinded.myClass('reaction') === 'foam-u2-svg-arrow-BezierArrowLine-reaction',
        'kind adds a myClass()-derived CSS class consumers can target'
      );
    }
  ]
});
