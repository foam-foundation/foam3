/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.dao',
  name: 'PredicatedListener',
  extends: 'foam.dao.ProxySink',
  documentation: 'Turns all sink events into a reset event.',
  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      required: true,
      name: 'predicate'
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) {
        if ( this.predicate.f(obj) ) this.delegate.put(obj, sub);
      },
      swiftCode: 'if predicate.f(obj) { delegate.put(obj, sub) }',
      javaCode: `
        if ( getPredicate().f(obj) ) getDelegate().put(obj, sub);
        else getDelegate().remove(obj, sub);
      `
    },
    {
      name: 'remove',
      code: function remove(obj, sub) {
        if ( this.predicate.f(obj) ) this.delegate.remove(obj, sub);
      },
      swiftCode: 'if predicate.f(obj) { delegate.remove(obj, sub) }',
      javaCode: 'if ( getPredicate().f(obj) ) getDelegate().remove(obj, sub);'
    }
  ]
});
