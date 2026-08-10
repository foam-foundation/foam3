/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'DAONameParser',

  extends: 'foam.parse.Grammar',

  requires: [
    'foam.core.boot.CSpec',
    'foam.parse.Alternate',
    'foam.parse.Parsers',
    'foam.parse.SimpleQueryParser'
  ],

  imports: [
    'AuthenticatedCSpecDAO as cSpecDAO'
  ],

  properties: [ { name: 'alt', factory: function() { return this.Alternate.create(); } } ],

  methods: [
    async function aDAONames() {
      // The names this grammar offers, as { id, category }. Subclasses override
      // to widen the set; aInit owns the sorting, so overrides only supply
      // entries.
      return (await this.cSpecDAO.where(this.CSpec.SERVED_DAOS).select()).array.map(c => ({
        id:       c.id,
        category: c.keywords.indexOf('custom') == -1 ? 'standard' : 'custom'
      }));
    },

    async function aInit() {
      const p          = this.Parsers.create();
      // Longest name first: alternatives are tried in order and the first match
      // wins, so a shorter name sharing a longer one's prefix would otherwise
      // leave the tail unparsed.
      const comparator = (a, b) => b.id.length - a.id.length || foam.util.compare(a.id, b.id);

      (await this.aDAONames()).sort(comparator).forEach(c => {
        this.alt.args.push(p.sug(p.literalIC(c.id), {
          text:     c.id,
          showText: false,
          label:    c.id.endsWith('DAO') ? c.id.substring(0, c.id.length-3) : c.id,
          prependSpaceOnSelect: false,
          category: c.category}));
      });
    },

    function grammar(alt) {
      return {
        START: this.alt
      };
    }
  ]

});
