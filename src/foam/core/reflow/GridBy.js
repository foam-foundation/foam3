/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'GridBy',
  extends: 'foam.dao.AbstractSink',

  documentation: 'A two-dimensional GroupBy.',

  implements: [
    'foam.mlang.Expressions',
    'foam.lang.Serializable'
  ],

  javaImports: [ 'static foam.mlang.MLang.*' ],

  requires: [
    'foam.core.reflow.GridByView'
  ],

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name:  'xFunc',
      label: 'X-Axis Function',
      // type:  'Expr',
      help:  'Sub-expression'
    },
    {
      class: 'foam.mlang.ExprProperty',
      name:  'yFunc',
      label: 'Y-Axis Function',
      // type:  'Expr',
      help:  'Sub-expression'
    },
    {
      class: 'foam.mlang.SinkProperty',
      name:  'acc',
      label: 'Accumulator',
      // type:  'Expr',
      help:  'Sub-expression',
    },
    {
      class: 'foam.mlang.SinkProperty',
      name:  'rows',
      javaCloneProperty: '// noop',
      javaFactory: 'return GROUP_BY(getYFunc(), GROUP_BY(getXFunc(), getAcc()));',
      factory: function() {
        return this.GROUP_BY(this.yFunc, this.GROUP_BY(this.xFunc, this.acc));
      }
    },
    {
      class: 'foam.mlang.SinkProperty',
      name:  'cols',
      label: 'Columns',
      help:  'Columns.',
      javaCloneProperty: '// noop',
      javaFactory: 'return foam.mlang.MLang.GROUP_BY(getXFunc());',
      factory: function() {
        return this.GROUP_BY(this.xFunc);
      }
    },
    { name: 'selection', hidden: true, expression: function(y) { return y; } },
    { name: 'x', hidden: true },
    { name: 'y', hidden: true },
    {
      name: 'query',
      hidden: true,
      expression: function(x, y) {
        var query = '';
        if ( this.x !== null && this.x !== undefined ) query += this.xFunc.name + '="' + x + '"';
        if ( this.y !== null && this.y !== undefined ) query += ( query ? ' AND ' : '' ) + this.yFunc.name + '="' + y + '"';
        return query;
      }
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) {
        this.cols.put(obj);
        this.rows.put(obj);
      },
      javaCode: `
        getCols().put(obj, sub);
        getRows().put(obj, sub);
      `
    },

    function addToE(e) {
      e.tag(this.GridByView, {data: this, x$: this.x$, y$: this.y$});
    },

    function toString() {
      return `GridBy(${this.xFunc}, ${this.yFunc}, ${this.acc})`;
    }
  ]
});
