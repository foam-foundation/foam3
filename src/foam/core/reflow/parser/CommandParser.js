/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: historyParser doesn't update when history changes
foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'CommandParser',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.parse.Alternate',
    'foam.parse.Parsers',
    'foam.parse.SimpleQueryParser'
  ],

  imports: [
    'commandDAO'
  ],

  properties: [ { name: 'alt', factory: function() { return this.Alternate.create(); } } ],

  methods: [
    async function aInit() {
      const p          = this.Parsers.create();
      const comparator = (a, b) => b.length - a.length || foam.util.compare(a, b);
      const cmds       = (await this.commandDAO.select()).array.sort(comparator);

      for ( let i = 0 ; i < cmds.length ; i++ ) {
        let c      = cmds[i];
        let parser = p.sug(p.literalIC(c.id), {
          text:  c.id,
          label: c.description,
          hint:  c.description,
          prependSpaceOnSelect: false,
          category: 'command'});

        if ( c.parser ) {
          if ( c.parser.aInit ) await c.parser.aInit();
          console.log('*************** ADDING COMMAND PARSER', parser.toString(), c.parser.toString());
          parser = p.seq(parser, c.parser);
        }

        this.alt.args.push(parser);
      }
    },

    function grammar() {
      return {
        START: this.alt
      };
    }
  ]
});


        /*
        // TODO: take custom parser from Command object itself
        if ( c.id === 'dao' || c.id === 'add' || c.id == 'from' || c.id == 'api' ) {
          parser = p.seq(parser, p.optional(p.seq(' ', p.sym('dao'))));
        } else if ( c.id === 'load' ) {
          parser = p.seq(parser, p.optional(p.seq(' ', p.sym('flowName'))));
        } else if ( c.id === 'history' ) {
          parser = p.seq(parser, p.optional(p.seq(' ', p.sym('historyCommand'))));
          }
        */
