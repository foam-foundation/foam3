/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Pivot',
  extends: 'foam.dao.AbstractSink',

  documentation: 'A Pivot Table',

  implements: [
    'foam.mlang.Expressions',
    'foam.lang.Serializable'
  ],

  javaImports: [
    'java.util.Arrays',
    'java.util.List',
    'java.util.stream.Collectors',
    'static foam.mlang.MLang.*'
  ],

  requires: [
    'foam.core.reflow.PivotTableView'
  ],

  properties: [
    {
      class: 'Array',
      of: 'foam.mlang.Expr',
      name:  'xFunc',
      label: 'X-Axis Function',
      help:  'Sub-expression'
    },
    {
      class: 'Array',
      of: 'foam.mlang.Expr',
      name:  'yFunc',
      label: 'Y-Axis Function',
      help:  'Sub-expression'
    },
    {
      class: 'foam.mlang.SinkProperty',
      name:  'acc',
      label: 'Accumulator',
      help:  'Sub-expression',
    },
    {
      class: 'foam.mlang.SinkProperty',
      name:  'rows',
      javaCloneProperty: '// noop',
      javaFactory: `
        if ( getYFunc() == null ) return null;
        var x =  getAcc();
        if ( getXFunc() != null ) {
          for (int i = getXFunc().length - 1; i >= 0; i-- ) {
            x = GROUP_BY((foam.mlang.Expr) getXFunc()[i], x);
          }
        }
        var y = x;
        for (int i = getYFunc().length - 1; i >= 0; i-- ) {
          y = GROUP_BY((foam.mlang.Expr) getYFunc()[i], y);
        }
        return y;
      `,
      factory: function() {
        if ( this.yFunc == null ) return null;
        var x = this.acc;
        if ( this.xFunc ) {
          for ( var i = this.xFunc.length - 1; i >= 0; i-- ) {
            x = this.GROUP_BY(this.xFunc[i], x);
          }
        }
        var y = x
        for ( var i = this.yFunc.length - 1; i >= 0; i-- ) {
          y = this.GROUP_BY(this.yFunc[i], y);
        }
        return y;
      }
    },
    {
      class: 'foam.mlang.SinkProperty',
      name:  'cols',
      label: 'Columns',
      help:  'Columns.',
      javaCloneProperty: '// noop',
      javaFactory: `
        if ( getXFunc() == null ) return null;
        var ret = GROUP_BY((foam.mlang.Expr) getXFunc()[getXFunc().length - 1]);
        for (int i = getXFunc().length - 2; i >= 0; i-- ) {
          ret = GROUP_BY((foam.mlang.Expr) getXFunc()[i], ret);
        }
        return ret;
      `,
      factory: function() {
        if ( ! this.xFunc ) return null;
        var ret = this.GROUP_BY(this.xFunc[this.xFunc.length - 1]);
        for ( var i = this.xFunc.length - 2; i >= 0; i-- ) {
          ret = this.GROUP_BY(this.xFunc[i], ret);
        }
        return ret;
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
        this.cols && this.cols.put(obj);
        this.rows && this.rows.put(obj);
      },
      javaCode: `
        if ( getCols() != null ) getCols().put(obj, sub);
        if ( getRows() != null ) getRows().put(obj, sub);
      `
    },

    function addToE(e) {
      e.tag(this.PivotTableView, {data: this, x$: this.x$, y$: this.y$});
    },

    {
      name: 'toString',
      code: function toString() {
        var x = `[${this.xFunc.map(a => a.name)}]`;
        var y = `[${this.yFunc.map(a => a.name)}]`;
        return `pivot(${x}, ${y}, ${this.acc})`;
      },
      javaCode: `
        List<String> xNames = Arrays.asList(getXFunc()).stream().map(a -> ((foam.mlang.Expr)a).toString()).collect(Collectors.toList());
        List<String> yNames = Arrays.asList(getXFunc()).stream().map(a -> ((foam.mlang.Expr)a).toString()).collect(Collectors.toList());
        return "pivot(" + xNames + ", " + yNames + ", " + getAcc() + ")";
      `
    }
  ]
});
