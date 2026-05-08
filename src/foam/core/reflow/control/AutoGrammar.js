/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: historyParser doesn't update when history changes
foam.CLASS({
  package: 'foam.core.reflow.control',
  name: 'AutoGrammar',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.core.reflow.parser.CommandParser',
    'foam.core.reflow.parser.FlowNameParser',
    'foam.core.reflow.parser.HistoryParser',
    'foam.parse.Parsers',
  ],

  properties: [
    {
      name: 'historyParser',
      factory: function() { return this.HistoryParser.create(); }
    },
    {
      name: 'commandParser',
      factory: function() { return this.CommandParser.create(); }
    }
  ],

  methods: [
    async function aInit() {
      await this.historyParser.aInit();
      await this.commandParser.aInit();
    },

    function grammar(alt, eof, seq0, seq, seq1, str, sug, sym, repeat, repeat0, anyChar, optional, notChars, literal, range, not, until0, literalIC) {
      return {
        START: alt(sym('historyCmd'), sym('autoCmd'), sym('jsCmd')),

        autoCmd: seq('/', this.commandParser),

        historyCmd: seq('~', this.historyParser),

        jsCmd: str(seq(notChars('~/'), str(repeat(not(eof()), anyChar()))))
      };
    }
  ]
});
