/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'FlowNameParser',
  extends: 'foam.parse.Grammar',
  implements: [ 'foam.mlang.Expressions' ],

  requires: [
    'foam.core.reflow.Flow',
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

      // Only the name and category are needed; a projection avoids pulling
      // every flow's full script and blocks just to list them.
      const sink = await this.flowDAO.select(
        this.PROJECTION(this.Flow.NAME, this.Flow.CATEGORY));

      sink.projection.sort((a, b) => comparator(a[0], b[0])).forEach(row => {
        const [ name, category ] = row;
        this.alt.args.push(p.sug(p.literalIC(name), {
          text: name,
          prependSpaceOnSelect: false,
          category: category || 'flow'}));
      });
    },

    function grammar() {
      return {
        START: this.alt
      };
    }
  ]
});
