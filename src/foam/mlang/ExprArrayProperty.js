/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang',
  name: 'ExprArrayProperty',
  extends: 'FObjectArray',

  flags: [],

  requires: [
    'foam.mlang.ExprProperty'
  ],

  documentation: 'Property for Expr values.',

  properties: [
    ['of', 'foam.mlang.Expr'],
    {
      name: 'javaInfoType',
      value: 'foam.lang.PolymorphicFObjectArrayPropertyInfo',
      flags: ['java']
    },
    {
      name: 'adaptArrayElement',
      value: function(o) {
        // TODO: This is probably a little hacky, should have a more
        // declarative way of saying all the ways things can be
        // adapted to an expression.
        return this.ExprProperty.prototype.adaptValue.call(this, o);
      }
    }
  ]
});
