/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Unique',
  extends: 'foam.dao.ProxySink',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Sink decorator which only put()\'s a single obj for each unique expression value.',

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'expr'
    },
    {
      name: 'values',
      class: 'Map',
      factory: function() { return {}; },
      javaFactory: 'return new java.util.HashMap();'
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) {
        var value = this.expr.f(obj);
        if ( Array.isArray(value) ) {
          throw 'Unique does not support Array values.';
        } else {
          if ( ! this.values.hasOwnProperty(value) ) {
            this.values[value] = obj;
            this.delegate.put(obj, sub);
          }
        }
      },
      javaCode: `
      var value = getExpr().f(obj);
      if ( ! getValues().containsKey(value) ) {
        getValues().put(value, null);
        getDelegate().put(obj, sub);
      }
      `
    },

    function eof() { },

    function clone() {
      // Don't use the default clone because we don't want to copy 'values'.
      return this.cls_.create({ expr: this.expr, delegate: this.delegate });
    },

    function toString() {
      return this.values.toString();
    }
  ]
});
