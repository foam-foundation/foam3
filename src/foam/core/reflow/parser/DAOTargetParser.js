/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'DAOTargetParser',
  extends: 'foam.parse.Grammar',

  documentation: `Autocompletes a single target DAO name for commands that act on
    one DAO (e.g. "add"). Consumes the space after the command id, then delegates
    to DAONameParser for served-DAO suggestions. Unlike FromParser it offers no
    query clauses (SKIP/LIMIT/WHERE/...), so the prompt only asks for a DAO.`,

  requires: [
    'foam.core.reflow.parser.DAONameParser'
  ],

  properties: [
    {
      name: 'daoNameParser',
      factory: function() { return this.DAONameParser.create(); }
    }
  ],

  methods: [
    async function aInit() {
      await this.daoNameParser.aInit();
    },

    function grammar(seq1, sym) {
      return {
        START: seq1(1, ' ', sym('dao')),
        dao: this.daoNameParser
      };
    }
  ]
});
