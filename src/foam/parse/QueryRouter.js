/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'QueryRouter',
  extends: 'foam.parse.Grammar',

  documentation: `
    A query parser which delegates to several underlying query parsers like:
      AQL: The SimpleQueryParser (default)
      MQL: QueryParser
      TEXT: full text search using the KEYWORD mlang
      and possibly others in the future like SQL: or FSCRIPT:
  `,

  requires: [
    'foam.comics.SearchMode',
    'foam.parse.QueryParser',
    'foam.parse.SimpleQueryParser'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  properties: [
    {
      class: 'Enum',
      of: 'foam.comics.SearchMode',
      name: 'searchMode',
      value: 'MQL'
    },
    'of',
    {
      name: 'aql',
      factory: function() {
        return this.SimpleQueryParser.create({of: this.of}).grammar_;
      }
    },
    {
      name: 'mql',
      factory: function() {
        return this.QueryParser.create({of: this.of}).grammar_;
      }
    }
  ],

  methods: [
    function grammar(sym, alt, seq1, repeat, literalIC, sug, anyChar, opt, str) {
      let enableQuery = this.searchMode === this.SearchMode.FULL || this.searchMode === this.SearchMode.MQL;

      function key(s, p, label) {
        return sug(p, {text: s, label: label, category: 'keyword'});
      }

      return {
        START: sym(this.searchMode.toString()), // Delgate to SIMPLE or MQL

        // Text Only
        SIMPLE: sym('text'),

        // Query Only
        MQL: sym('query'),

        // Don't bother building query parsers if not needed
        ... (enableQuery ? {
          // Text or Query
          FULL: alt(sym('query'), sym('text')),

          query: alt(sym('aql')/*, sym('mql')*/),

          aql: this.aql,
//          aql: seq1(1, opt(key('AQL:', 'Automatic Query Language')), this.aql),

//          mql: seq1(1, key('MQL:', 'Legacy MQL Support'), this.mql)
        } : {}),

        text: seq1(1, key('TEXT:', alt(literalIC('TEXT:'), ':'), 'Full-Text Search'), str(repeat(anyChar(), null, 1)))
      };
    },

    function textAction(v) {
      return this.KEYWORD(v.trim());
    },

    function STARTAction(v) {
      if ( v && v.partialEval ) v = v.partialEval();
      return v;
    }
  ]
});
