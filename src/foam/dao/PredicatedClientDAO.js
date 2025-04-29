/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'PredicatedClientDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `DAO that filters delegate selects using a predicate.
  Client side only, useful for filtering a DAO on the client side when server
  decorators populate data on the fly since FilteredDAO filtering takes place in the MDAO.
  
  For example, an account model may have it's balance populated by a server decorator based on
  previous transactions. In this case, the balance property is not populated in the MDAO and 
  any balance filtering will not work. In this case, a PredicatedClientDAO can be used to filter the DAO
  after the decorator has populated balance and returned the data to the client.`,

  properties: [
    {
      name: 'predicate',
      required: true,
      class: 'foam.mlang.predicate.PredicateProperty'
    }
  ],

  methods: [
    function select_(x, sink, skip, limit, order, predicate_) {
      let self = this;
      return this.delegate.select_(x, foam.dao.ArraySink.create(), skip, limit, order, predicate_).then(function(res) {
        if ( ! sink ) {
          return res;
        }

        var sub = foam.lang.FObject.create();
        var detached = false;
        sub.onDetach(function() { detached = true; });

        for ( var i = 0 ; i < res.array.length ; i++ ) {
          if ( detached ) break;
          if ( self.predicate.f(res.array[i]) ) {
            sink.put(res.array[i], sub);
          }
        }

        sink.eof();

        return sink;
      });
    }
  ]
});
