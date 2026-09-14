/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.rail',
  name: 'RailDemo',
  extends: 'foam.u2.View',

  documentation: 'Mounts the railroad viewer on a small hand-written grammar. Later PRs add a grammar picker to the viewer itself.',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailDiagramView'
  ],

  methods: [
    function toyGrammar() {
      // A comma list with nested lists, plus an ordered-choice trap (keyword: "do" before "double").
      return this.Grammar.create({ symbols: function(seq, sym, literal, plus, range, repeat, optional, alt, eof) {
        return {
          START:   alt(seq(sym('list'), eof()), seq(sym('keyword'), eof())),
          list:    seq(literal('['), optional(sym('ws')), repeat(sym('item'), seq(optional(sym('ws')), literal(','), optional(sym('ws')))), optional(sym('ws')), literal(']')),
          item:    alt(sym('number'), sym('word'), sym('list')),
          number:  plus(range('0', '9')),
          word:    plus(range('a', 'z')),
          ws:      plus(literal(' ')),
          keyword: alt(literal('do'), literal('double'))
        };
      } });
    },

    function render() {
      this.add(this.RailDiagramView.create({ grammar: this.toyGrammar() }));
    }
  ]
});
