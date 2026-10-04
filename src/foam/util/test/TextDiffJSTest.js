/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'TextDiffJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'foam.util.TextDiff.lineDiff: LCS line diff shape and size guard.',

  methods: [
    function runTest(x) {
      var join = function(d) { return d.map(function(l) { return l.type + l.text; }).join('|'); };

      x.test(join(foam.util.TextDiff.lineDiff('a\nb\nc', 'a\nb\nc')) === ' a| b| c',
        'identical texts are all unchanged lines');

      x.test(join(foam.util.TextDiff.lineDiff('a\nb\nc', 'a\nB\nc')) === ' a|-b|+B| c',
        'a changed line is a removal then an addition in place');

      x.test(join(foam.util.TextDiff.lineDiff('a\nc', 'a\nb\nc')) === ' a|+b| c',
        'an inserted line is a single addition');

      x.test(join(foam.util.TextDiff.lineDiff('a\nb\nc', 'a\nc')) === ' a|-b| c',
        'a deleted line is a single removal');

      x.test(join(foam.util.TextDiff.lineDiff('', 'x')) === '-|+x',
        'empty old text is one removed empty line');

      var d = foam.util.TextDiff.lineDiff('a\nb', 'c\nd');
      x.test(d.filter(function(l) { return l.type === '-'; }).length === 2 &&
             d.filter(function(l) { return l.type === '+'; }).length === 2,
        'no common lines: every old line removed, every new line added');

      x.test(foam.util.TextDiff.lineDiff('a\nb\nc', 'a\nb\nc', 4) === null,
        'returns null above the cell limit');
    }
  ]
});
