/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: historyParser doesn't update when history changes
foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'HistoryParser',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.parse.Alternate',
    'foam.parse.Parsers',
  ],

  imports: [
    'history_',
  ],

  properties: [ { name: 'alt', factory: function() { return this.Alternate.create(); } } ],

  methods: [
    // Not actually async, but makes it consistent with the rest and in case it becomes in future
    async function aInit() {
      const p          = this.Parsers.create();
      const comparator = (a, b) => b.length - a.length || foam.util.compare(a, b);

      // Use Set to remove duplicates
      [...new Set(this.history_)].sort(comparator).forEach(h => {
        if ( h.length < 2 ) return;
        this.alt.args.push(p.sug(p.literalIC(h), {
          text:  h,
          prependSpaceOnSelect: false,
          category: 'history'}));
      });
    },

    function grammar() {
      return {
        START: this.alt
      };
    }
  ]
});
