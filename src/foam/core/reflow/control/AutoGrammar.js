/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.control',
  name: 'AutoGrammar',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.core.boot.CSpec',
    'foam.parse.Alternate',
    'foam.parse.Parsers',
    'foam.parse.SimpleQueryParser'
  ],

  imports: [
    'commandDAO',
    'AuthenticatedCSpecDAO as cSpecDAO',
//    'scope'
  ],

  properties: [
    {
      name: 'cmdsParser',
      factory: function() {
        return this.Alternate.create();
      }
    },
    {
      name: 'daosParser',
      factory: function() {
        return this.Alternate.create();
      }
    }
  ],

  methods: [
    async function aInit() {
      let p = this.Parsers.create();

      var dao  = this.cSpecDAO.where(this.CSpec.SERVED_DAOS);

      this.daosParser.args = (await this.cSpecDAO.select()).array.map(c => {
        //        console.log('***', c.id, c);
        return p.sug(p.literalIC(c.id), {
          text:     c.id,
          label:    c.id,
          prependSpaceOnSelect: false,
          category: c.keywords.indexOf('custom') == -1 ? 'standard' : 'custom'});
      });

      this.cmdsParser.args = (await this.commandDAO.select()).array.map(c => {
        return p.sug(p.literalIC(c.id), {
          text: c.id,
          label: c.id,
          prependSpaceOnSelect: false,
          category: 'command'});
      });
    },

    function grammar(alt, eof, seq0, seq, seq1, str, sug, sym, repeat, repeat0, anyChar, optional, notChars, literal, range, not, until0, literalIC) {
      return {
        START: alt(sym('autoCmd'), sym('jsCmd')),

        autoCmd: seq('/', sym('cmd'), optional(seq(' ', sym('dao')))),

        jsCmd: str(seq(not('/'), str(repeat(not(eof()), anyChar())))),

        cmd: this.cmdsParser,

        dao: seq(sym('daoName') , optional(seq(sym('where'), sym('query')))),

        where: sug(literalIC(' where'), {text: ' WHERE'}),

        daoName: this.daosParser,

        query: literal('-----------')
      };
    },

    function daoNameAction(v) {
      console.log('***** daoName ', v, this.__context__[v]);
      this.symbolMap_.query = this.SimpleQueryParser({of: dao.of});
      debugger;
      return v;
    }
  ]
});
