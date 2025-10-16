/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Time To Live (TTL) Select Caching DAO only caches select() operations
 * for a limited amount of time.
*/
foam.CLASS({
  package: 'foam.dao',
  name: 'TTLSelectCachingDAO',
  extends: 'foam.dao.ProxyDAO',

  requires: [
    'foam.dao.DAOSink',
    'foam.dao.PromisedDAO'
  ],

  imports: [ 'merged' ],

  properties: [
    {
      /** The cache to read items quickly. */
      name: 'cache',
      factory: function() { return {}; }
    },
    {
       class: 'Long',
       name: 'purgeTime',
       documentation: 'Time to wait before purging cache.',
       units: 'ms',
       value: 25000
     },
     {
       class: 'Long',
       name: 'maxCacheSize',
       value: 20
     },
     {
       name: 'purgeCache',
       transient: true,
       expression: function(purgeTime) {
         return this.merged(() => { this.cache = {};}, purgeTime);
       }
     }
  ],

  methods: [
    /** Puts are sent to the cache and to the source, ensuring both
      are up to date. */
    function put_(x, o) {
      this.cache = {};
      return this.delegate.put_(x, o);
    },

    function select_(x, sink, skip, limit, order, predicate) {
      if ( ! foam.lang.Serializable.isInstance(sink) ) {
        // console.log('************************ TTL CACHING NON SERIALIZABLE SINK:', sink);
        return this.select_(x, foam.dao.ArraySink.create(), skip, limit, order, predicate).then(a => {
          // TODO: the below code should be a method on ArraySink
          var items    = a.array;
          var sub      = foam.lang.FObject.create();
          var detached = false;

          sub.onDetach(function() { detached = true; });

          for ( var i = 0 ; i < items.length ; i++ ) {
            if ( detached ) break;

            sink.put(items[i], sub);
          }

          sink.eof();

          return sink;
        });
      }

      if ( predicate && predicate.partialEval ) predicate = predicate.partialEval();

      var self = this;
      var key  = [sink, skip, limit, order, predicate].toString();

      if ( this.cache[key] ) {
        // console.log('************************ TTL CACHED:', key);
        if ( this.cache[key].clone ) {
          /// Need to clone to get expressions to re-evaluate
          return Promise.resolve(this.cache[key].clone());
        } else {
          return Promise.resolve(this.cache[key]);
        }
      }

      return new Promise(function (resolve, reject) {
        self.delegate.select_(x, sink, skip, limit, order, predicate).then(s => {
          // Clone before storing to prevent cache corruption from mutations.
          // Since objects are passed by reference in JavaScript, storing 's' directly
          // would cache the same object returned to the caller. Any mutations to the
          // returned sink (e.g., modifying array contents, changing properties) would
          // corrupt the cached copy, causing incorrect results on subsequent cache hits.
          var sinkToCache = s.clone ? s.clone() : s;
          self.cache[key] = sinkToCache;
          // console.log('************************ TTL CACHING:', key);
          // TODO: check if cache is > maxCacheSize and remove oldest entry if it is
          self.purgeCache();
          resolve(s);
        },
        e => {
          // console.log('************************ TTL ERROR:', e);
          self.cache = {};
          reject(e);
        });
      });
    },

    /** Removes are sent to the cache and to the source, ensuring both
      are up to date. */
    function remove_(x, o) {
      this.cache = {};
      return this.delegate.remove_(x, o);
    },

    /** removeAll is executed on the cache and the source, ensuring both are up to date. */
    function removeAll_(x, skip, limit, order, predicate) {
      this.cache = {};
      this.delegate.removeAll_(x, skip, limit, order, predicate);
    },

    function cmd_(x, obj) {
      if ( foam.dao.DAO.PURGE_CMD === obj ) {
        this.cache = {};
        return this.SUPER(x, obj) || true;
      }

      return this.SUPER(x, obj);
    }
  ]
});
