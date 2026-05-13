/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'PredicateProperty',
  extends: 'FObjectProperty',

  flags: [],

  documentation: 'Property for Predicate values.',

  properties: [
    [ 'of', 'foam.mlang.predicate.Predicate' ],
    {
      name: 'adapt',
      value: function(_, o, prop) {
        if ( foam.Function.isInstance(o) && ! o.f ) return foam.mlang.predicate.Func.create({ fn: o });

        const OLD_ADAPT = foam.lang.FObjectProperty.ADAPT.value;
        return OLD_ADAPT.call(this, null, o, prop);
      }
    }
  ]
});
