/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: historyParser doesn't update when history changes
foam.CLASS({
  package: 'foam.core.reflow.parse',
  name: 'FromParser',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.core.reflow.parser.DAONameParser',
    'foam.core.reflow.parser.SinkParser',
    'foam.core.reflow.parser.PropertyParser',
    'foam.parse.Parsers',
    'foam.parse.SimpleQueryParser'
  ],

  properties: [
    {
      name: 'daoNameParser',
      factory: function() { return this.DAONameParser.create(); }
    },
    {
      name: 'sinkParser',
      factory: function() { return this.SinkParser.create(); }
    }
  ],

  methods: [
    async function aInit() {
      await this.daoNameParser.aInit();
      await this.sinkParser.aInit();
    },

    function grammar(alt, eof, seq0, seq, seq1, str, sug, substring, sym, repeat, repeat0, anyChar, optional, notChars, literal, range, not, until0, literalIC) {
      return {
        START: sym('cmd'),

        cmd: seq(
          ' ',
          sym('dao'),
          optional(sym('skipClause')),
          optional(sym('limitClause')),
          optional(sym('whereClause')),
          optional(sym('orderClause')),
          optional(sym('columnsClause')),
          optional(sym('toClause')),
          optional(sym('labelClause'))  // ???: Is this still used?
        ),

        dao: this.daoNameParser,

        skipClause: seq1(2,
          sug(literalIC(' skip'), {text: ' SKIP', prependSpaceOnSelect: false}),
          ' ',
          sym('number')),

        limitClause: seq1(2,
          sug(literalIC(' limit'), {text: ' LIMIT', prependSpaceOnSelect: false}),
          ' ',
          sym('number')),

        orderClause: seq1(2,
          sug(literalIC(' order by'), {text: ' ORDER BY', prependSpaceOnSelect: false}),
          ' ',
          substring(sym('order'))),

        columnsClause: seq1(2,
          sug(literalIC(' columns'), {text: ' COLUMNS', prependSpaceOnSelect: false}),
          ' ',
          substring(sym('columns'))),

        whereClause: seq1(2,
          sug(literalIC(' where'), {text: ' WHERE', prependSpaceOnSelect: false}),
          ' ',
          substring(sym('query'))),

        toClause: seq1(2,
          sug(literalIC(' to'), {text: ' TO', prependSpaceOnSelect: false}),
          ' ',
          sym('sink')),

        labelClause: seq1(1,
          sug(literalIC(' label "'), {text: ' LABEL "', prependSpaceOnSelect: false}),
          sym('label'),
          '"'),

        query: seq1(0), // placeholder, filled in when the dao name is parsed

        order: seq1(0), // placeholder, filled in when the dao name is parsed

        columns: seq1(0), // placeholder, filled in when the dao name is parsed

        sink: this.sinkParser,

        number: str(repeat(range('0', '9'), null, 1)),

        label: str(repeat(notChars('"')))
      };
    },

    function numberAction(v) {
      return parseInt(v);
    },

    function STARTAction(a) {
      // TODO: this shouldn't be necessary
      if ( ! foam.Array.isInstance(a) ) return a;

      let m = { daoKey: a[1] };

      if ( a[2] ) m.skip     = a[2];
      if ( a[3] ) m.limit    = a[3];
      if ( a[4] ) m.aql      = a[4];
      if ( a[5] ) m.order    = a[5];
      if ( a[6] ) m.columns  = a[6];
      if ( a[7] ) m.select   = foam.lookup(a[7].value).create();
      if ( a[8] ) m.label    = a[8];

      debugger;
      return m;
    },

    function daoAction(daoName) {
      let dao = this.__context__[daoName];

      this.getSymbol('query').args[0]   = this.SimpleQueryParser.create({of: dao.of});
      this.getSymbol('order').args[0]   = this.PropertyParser.create({of: dao.of}).getSymParser('comparator');
      this.getSymbol('columns').args[0] = this.PropertyParser.create({of: dao.of}).getSymParser('propertyList');

      return daoName;
    }
  ]
});
