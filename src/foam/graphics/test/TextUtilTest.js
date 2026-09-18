/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics.test',
  name: 'TextUtilTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'TextUtil.truncate boundary cases with an injected character-width measurer.',

  methods: [
    async function runTest(x) {
      var T = foam.graphics.TextUtil;
      var m = T.estimateMeasurer(10);             // every character 10px wide, including the ellipsis

      x.test(T.truncate(m, 'abc', 'f', 30) === 'abc',   'fits exactly: unchanged');
      x.test(T.truncate(m, 'abc', 'f', 100) === 'abc',  'fits with room: unchanged');
      x.test(T.truncate(m, 'abcdef', 'f', 40) === 'abc…', 'too long: longest prefix + ellipsis that fits 40px');
      x.test(T.truncate(m, 'abcdef', 'f', 10) === '…',   'only the ellipsis fits');
      x.test(T.truncate(m, 'abcdef', 'f', 5) === '',     'nothing fits: empty string');
      x.test(T.truncate(m, '', 'f', 50) === '',          'empty text stays empty');

      var seen = [];
      var spy = function(text, font) { seen.push(font); return text.length * 10; };
      T.truncate(spy, 'abcdef', 'mono 12px', 40);
      x.test(seen.every(function(f) { return f === 'mono 12px'; }), 'the font is passed to every measurement');

      var ctx = { font: '', measureText: function(s) { return { width: s.length * 7 }; } };
      var cm = T.canvasMeasurer(ctx);
      x.test(cm('abcd', 'sans 10px') === 28 && ctx.font === 'sans 10px', 'canvasMeasurer sets ctx.font and reads measureText().width');
    }
  ]
});
