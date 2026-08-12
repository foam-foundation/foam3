/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionLoadProgressDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `Client-side decorator. While any operation on this DAO is
    pending past showDelay, asks the PartitionLoadToastStack to watch this
    DAO's serviceKey; the stack shows progress cards for matching
    partition-load status rows. Unwatches when the operation settles.`,

  requires: [ 'foam.core.partition.PartitionLoadToastStack' ],

  properties: [
    {
      class: 'String',
      name: 'serviceKey',
      documentation: 'Matches PartitionLoadStatus.serviceName rows on the server.'
    },
    { class: 'Int', name: 'showDelay', value: 400 }
  ],

  methods: [
    function select_(x, sink, skip, limit, order, predicate) {
      return this.track_(this.SUPER(x, sink, skip, limit, order, predicate));
    },
    function find_(x, id) {
      return this.track_(this.SUPER(x, id));
    },
    function put_(x, obj) {
      return this.track_(this.SUPER(x, obj));
    },
    function remove_(x, obj) {
      return this.track_(this.SUPER(x, obj));
    },
    function removeAll_(x, skip, limit, order, predicate) {
      return this.track_(this.SUPER(x, skip, limit, order, predicate));
    },

    function track_(p) {
      if ( ! this.serviceKey || ! p || ! p.then ) return p;
      var self    = this;
      var stack   = this.PartitionLoadToastStack.create();
      var settled = false;
      var timer   = setTimeout(function() {
        if ( ! settled ) stack.watch(self.serviceKey);
      }, this.showDelay);
      var settle = function() {
        settled = true;
        clearTimeout(timer);
        stack.unwatch(self.serviceKey);
      };
      p.then(settle, settle);
      return p;
    }
  ]
});
