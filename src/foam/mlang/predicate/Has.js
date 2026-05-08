/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Has',
  extends: 'foam.mlang.predicate.Unary',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Unary Predicate that returns true iff the given property has a value other than null, undefined, \'\', or [].',

  requires: [
    'foam.mlang.expr.PropertyExpr'
  ],

  properties: [
    {
      name: 'arg1',
      factory: function() {
        return this.PropertyExpr.create();
      }
    }
  ],

  methods: [
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;'
    },
    {
      name: 'f',
      code: function f(obj) {
        var value = this.arg1.f(obj);

        return ! (
          value === 0         ||
          value === undefined ||
          value === null      ||
          value === ''        ||
          (Array.isArray(value) && value.length === 0) );
      },
      // TODO(kgr): Instead of checking type, use polymorphims and add a
      // type-specific has() method to the Property.
      javaCode: `Object value = getArg1().f(obj);
        return ! (value == null ||
          (value instanceof Number && ((Number) value).intValue() == 0) ||
          (value instanceof String && ((String) value).length() == 0) ||
          (value.getClass().isArray() && java.lang.reflect.Array.getLength(value) == 0));`
    },
    {
      name: 'createStatement',
      // TODO: check for empty array
      javaCode: `return " (" + getArg1().createStatement() + " <> '') is not true ";`
    },
    function toMQL() {
      return this.arg1.name + ' IS NOT EMPTY';
    }
  ]
});
