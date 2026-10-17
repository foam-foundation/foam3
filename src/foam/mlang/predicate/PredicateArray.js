/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'PredicateArray',
  extends: 'FObjectArray',

  flags: [],

  documentation: 'Property for storing arrays of Predicates.',

  properties: [
    {
      name: 'of',
      value: 'foam.mlang.predicate.Predicate'
    },
    {
      name: 'javaInfoType',
      value: 'foam.lang.PolymorphicFObjectArrayPropertyInfo',
      flags: ['java']
    },
    [ 'type', 'foam.mlang.predicate.Predicate[]' ],
    {
      name: 'adaptArrayElement',
      // TODO?: Make into a multi-method?
      value: function(o) {
        if ( o === null ) return foam.mlang.Constant.create({ value: o });
        if ( ! o.f && typeof o === "function" ) return foam.mlang.predicate.Func.create({ fn: o });
        if ( typeof o !== "object" ) return foam.mlang.Constant.create({ value: o });
        if ( Array.isArray(o) ) return foam.mlang.Constant.create({ value: o });
        if ( o === true ) return foam.mlang.predicate.True.create();
        if ( o === false ) return foam.mlang.predicate.False.create();
        if ( foam.lang.FObject.isInstance(o) ) return o;
        if ( o.class && this.__context__.maybeLookup(o.class) ) {
          return this.adaptArrayElement(this.__context__.lookup(o.class).create(o, this));
        }
        console.error('Invalid expression value: ', o);
      }
    }
  ]
});
