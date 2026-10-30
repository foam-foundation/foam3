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
    pending past showDelay, asks the PartitionLoadWatcher to watch this
    DAO's serviceKey; the watcher shows a Dock card for matching
    partition-load status rows. Unwatches when the operation settles.
    partitionLoadWatcher is an optional import -- if no such service is
    registered in this context, tracking is a no-op passthrough.`,

  imports: [ 'partitionLoadWatcher?' ],

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
      var watcher = this.partitionLoadWatcher;
      if ( ! watcher ) return p;
      var self    = this;
      var settled = false;
      var watched = false;
      var timer   = setTimeout(function() {
        if ( ! settled ) { watched = true; watcher.watch(self.serviceKey); }
      }, this.showDelay);
      var settle = function() {
        settled = true;
        clearTimeout(timer);
        if ( watched ) watcher.unwatch(self.serviceKey);
      };
      p.then(settle, settle);
      return p;
    }
  ]
});
