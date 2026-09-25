/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailBuilderTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailGeneric',
    'foam.parse.rail.RailSeq',
    'foam.parse.rail.RailStrip',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'The builder maps Literal/Sequence/Symbol (PR 2), assigns structural paths, and never throws on an unknown parser.',

  methods: [
    function grammar() {
      // Parameter names ARE the Parsers vocabulary: Grammar resolves them by name.
      return this.Grammar.create({ symbols: function(seq, sym, literal, literalIC, range, chars, notChars, anyChar, eof, cut) {
        return {
          START: seq(sym('item'), eof()),
          item:  seq(literal('['), sym('missingRule'), literalIC('x'), range('0', '9'), chars('ab'), notChars('"'), anyChar()),
          weird: cut(literal('a'))
        };
      } });
    },

    async function runTest(x) {
      var g = this.grammar();
      var b = this.RailBuilder.create({ grammar: g, theme: this.RailTheme.create(), measure: foam.graphics.TextUtil.estimateMeasurer(7) });
      var strips = b.buildStrips();

      x.test(strips.length === 3 && strips.every(this.RailStrip.isInstance.bind(this.RailStrip)), 'one strip per rule, in declaration order');
      x.test(strips[0].name === 'START' && strips[2].name === 'weird', 'strips carry rule names');
      x.test(strips[0].parser === g.getSymbol('START'), 'strip parser is the rule body');
      x.test(strips[0].pathIds.length === 1, 'a strip\'s path is its own rule root');

      var start = strips[0].track;
      x.test(this.RailSeq.isInstance(start) && start.items.length === 2, 'seq(sym, eof) is a two-item sequence');
      x.test(this.RailSymRef.isInstance(start.items[0]) && start.items[0].name === 'item', 'sym() is a rule reference');
      x.test(! start.items[0].missing && start.items[0].builder === b, 'a reference to an existing rule is not missing and knows its builder');
      x.test(this.RailTerminal.isInstance(start.items[1]) && start.items[1].text === '⊣', 'eof() is the end-stop terminal');

      // Paths: parent path + own id, so the same eof() singleton under two parents gets two keys.
      x.test(start.pathIds.length === 1 && start.pathKey === strips[0].pathKey, 'the track IS the rule root: same path as its strip');
      x.test(start.items[1].pathIds.length === 2, 'child path = parent path + own id');
      x.test(start.items[1].pathKey.indexOf(start.pathKey + '/') === 0, 'child key extends the parent key');

      var item = strips[1].track.items;
      x.test(item.length === 7, 'all seven items built');
      x.test(item[1].missing === true,                       'a reference to an undefined rule is flagged missing');
      x.test(item[2].text === '"x"' && item[2].badge === 'aA', 'literalIC gets the aA badge');
      x.test(item[3].text === '0…9' && item[4].text === '[ab]' && item[5].text === '¬["]' && item[6].text === '•', 'other terminals labelled');

      // cut() returns a plain object (no cls_): it must fall back to a generic box rather than throw.
      x.test(this.RailGeneric.isInstance(strips[2].track) && strips[2].track.text === '(plain object)', 'unknown parser kind -> RailGeneric with a clear name');

      // Every element got the builder's theme and measure.
      var ok = true;
      var walk = function(el) { if ( el.theme !== b.theme || el.measure !== b.measure ) ok = false; el.children.forEach(walk); };
      strips.forEach(walk);
      x.test(ok, 'theme and measure are injected into every element');
      x.test(b.hasSymbol('item') && ! b.hasSymbol('nope'), 'hasSymbol reads the grammar without asserting');
    }
  ]
});
