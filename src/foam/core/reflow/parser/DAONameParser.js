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
    async function aInit() {
      const p          = this.Parsers.create();
      const dao        = this.cSpecDAO.where(this.CSpec.SERVED_DAOS);
      const comparator = (a, b) => b.length - a.length || foam.util.compare(a, b);

      (await dao.select()).array.sort(comparator).forEach(c => {
        this.alt.args.push(p.sug(p.literalIC(c.id), {
          text:     c.id,
          label:    c.id,
          prependSpaceOnSelect: false,
          category: c.keywords.indexOf('custom') == -1 ? 'standard' : 'custom'}));
      });
    },

    function grammar(alt) {
      return {
        START: this.alt
      };
    }
  ]

});
