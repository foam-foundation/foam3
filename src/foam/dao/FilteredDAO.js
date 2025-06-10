/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'FilteredDAO',
  extends: 'foam.dao.ProxyDAO',

  requires: [
    'foam.mlang.predicate.And'
  ],

  properties: [
    {
      // TODO: FObjectProperty of Predicate. Doing this currently breaks java.
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'predicate'
    }
  ],

  methods: [
    {
      type: 'foam.mlang.predicate.Predicate',
      name: 'predicateIn',
      args: [ 'Context x' ],
      code: function(x) { return this.predicate },
      javaCode: 'return getPredicate();'
    },
    {
      name: 'find_',
      code: function find_(x, key) {
        var predicate = this.predicateIn(x);
        return this.delegate.find_(x, key).then(function(o) {
          return ( o && predicate.f(o) ) ? o : null;
        });
      },
      javaCode: `foam.lang.FObject ret = super.find_(x, id);
if ( ret != null && predicateIn(x).f(ret) ) return ret;
return null;`
    },
    {
      name: 'select_',
      code: function(x, sink, skip, limit, order, predicate) {
        var thisPredicate = this.predicateIn(x);
        return this.delegate.select_(
          x, sink, skip, limit, order,
          predicate ?
            this.And.create({ args: [thisPredicate, predicate] }) :
            thisPredicate);
      },
      swiftCode: `
return try delegate.select_(
  x, sink, skip, limit, order,
  predicate != nil ?
    And_create(["args": [self.predicate, predicate!] ]) :
    self.predicate)
     `,
      javaCode: 'return super.select_(x, sink, skip, limit, order, predicate == null ? predicateIn(x) : foam.mlang.MLang.AND(predicateIn(x), predicate));'
    },

    {
      name: 'removeAll_',
      code: function removeAll_(x, skip, limit, order, predicate) {
        return this.delegate.removeAll_(
          x, skip, limit, order,
          predicate ?
            this.And.create({ args: [this.predicate, predicate] }) :
          this.predicate);
      },
      javaCode: 'super.removeAll_(x, skip, limit, order, predicate == null ? predicateIn(x) : foam.mlang.MLang.AND(predicateIn(x), predicate));'
    },

    {
      name: 'listen_',
      code: function listen_(x, sink, predicate) {
        return this.delegate.listen_(
          x, sink,
          predicate ?
            this.And.create({ args: [this.predicateIn(x), predicate] }) :
            this.predicateIn(x));
      },
      swiftCode: `
return try delegate.listen_(
  x, sink,
  predicate != nil ?
    And_create(["args": [self.predicate, predicate]]) :
    predicate)
      `,
      javaCode: 'super.listen_(x, sink, predicate == null ? getPredicate() : foam.mlang.MLang.AND(getPredicate(), predicate));'
    },
  ]
});
