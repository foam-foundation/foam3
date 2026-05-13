/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'FlowNameParser',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.parse.Alternate',
    'foam.parse.Parsers'
  ],

  imports: [
    'flowDAO'
  ],

  properties: [ { name: 'alt', factory: function() { return this.Alternate.create(); } } ],

  methods: [
    async function aInit() {
      const p          = this.Parsers.create();
      const comparator = (a, b) => b.length - a.length || foam.util.compare(a, b);

      (await this.flowDAO.select()).array.sort(comparator).map(f => {
        this.alt.args.push(p.sug(p.literalIC(f.name), {
          text:  f.name,
          prependSpaceOnSelect: false,
          category: 'flow'}));
      });
    },

    function grammar() {
      return {
        START: this.alt
      };
    }
  ]
});
