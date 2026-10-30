/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PieDAOAgent',
  extends: 'foam.core.reflow.GroupByDAOAgent',

  requires: [ 'foam.u2.mlang.Pie' ],

  properties: [ { class: 'Int', name: 'radius', value: 50 } ],

  methods: [
    function createSink() {
      return this.Pie.create({arg1: this.prop, radius: this.radius});
    },
    function addToE(e) {
      e.startContext({data: this}).start().style({display: 'flex'}).
        add(' r:', this.RADIUS,' ', this.PROP.__);
    }
  ]
});
