/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'SinkParser',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.parse.Alternate',
    'foam.parse.Parsers'
  ],

  imports: [
    'agentDAO'
  ],

  properties: [ { name: 'alt', factory: function() { return this.Alternate.create(); } } ],

  methods: [
    async function aInit() {
      const p          = this.Parsers.create();
      const comparator = (a, b) => b.length - a.length || foam.util.compare(a, b);

      (await this.agentDAO.select()).array.sort(comparator).forEach(a => {
        this.alt.args.push(p.sug(p.literalIC(a.label, a), {
          text: a.label,
          prependSpaceOnSelect: false,
          category: 'target'}));
      });
    },

    function grammar() {
      return {
        START: this.alt
      };
    }
  ]
});
