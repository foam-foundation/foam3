/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Plot',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  properties: [
    {
      class: 'foam.mlang.ExprArrayProperty',
      name: 'args'
    },
    {
      class: 'List',
      name: 'data',
      factory: function() { return []; }
    }
  ],
  methods: [
    {
      name: 'put',
      code: function put(obj) {
        this.data.push(this.args.map(a => a.f(obj)));
      },
      javaCode: `
        Object[] args = new Object[getArgs().length];
        for ( int i = 0; i < getArgs().length ; i++ ) {
          args[i] = getArgs()[i].f(obj);
        }
        getData().add(args);
      `
    },
    {
      name: 'toString',
      documentation: `
        Names the args so a cached select tells two Plots apart: a Plot of
        "count" and a Plot of "total" must not share a cache key.
      `,
      code: function toString() {
        return 'plot(' + this.args.map(a => a.toString()).join(',') + ')';
      },
      javaCode: 'return "plot(" + java.util.Arrays.toString(getArgs()) + ")";'
    }
  ]
});
