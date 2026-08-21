/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.parse',
  name: 'GroupByParser',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.core.reflow.GroupByDAOAgent'
//    'foam.mlang.sink.GroupBy'
  ],

  imports: [ 'of', 'sinkParser', 'propertyParser' ],

  methods: [
    function grammar(seq, sym) {
      return {
        START: sym('groupBy'),

        groupBy: seq(
          { parse: ps => this.propertyParser.parse(ps) },
          ',',
          { parse: ps => this.sinkParser.parse(ps) }
        )
      };
    },

    function groupByAction(v) {
      // TODO: fix
      if ( ! foam.Array.isInstance(v) ) { debugger; return v; }
      var prop = this.of.getAxiomByName(v[0]);
      var agent = foam.String.isInstance(v[2].value) ? foam.lookup(v[2].value).create({}, this) : v[2];
      debugger;
      return this.GroupByDAOAgent.create({prop: prop, sink: agent});
//      return this.GroupBy.create({arg1: v[0], arg2: v[2]});
    }
  ]
});
