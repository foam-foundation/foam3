/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'QueryCachingDAO',
  extends: 'foam.dao.ProxyDAO',
  requires: [ 'foam.dao.FnSink' ],
  documentation: 'Javascript DAO Decorator which adds select caching to a delegate DAO.',

  properties: [
    {
      // The cache for local storage and fast access
      name: 'cache',
      factory: function() { return {}; }
    }
  ],

  methods: [
    function init() {
      // if anything changes in the delegate -> clear cache
      // Can happen if the dao is modified outside the DAOController (for eg. in wizards)
      this.onDetach(this.delegate.listen(this.FnSink.create({
        fn: () => { this.purgeCache() }
      })));
      this.onDetach(this.on.reset.sub(this.purgeCache.bind(this)));
    },

    function purgeCache() {
      this.cache = {};
    },

    function detach() {
      this.SUPER();
      this.cache = {};
    },

    // Put invalidates cache and is forwarded to the source.
    function put_(x, o) {
      this.purgeCache();
      return this.delegate.put_(x, o);
    },

    function select_(x, sink, skip, limit, order, predicate) {
      // console.log('************ QUERYCache', skip, limit);
      if (
        // Only cache selects that have limit provided
        limit === undefined
        // Only handle query caching for ArraySink and Projection
        || ! (foam.dao.ArraySink.isInstance(sink) || foam.mlang.sink.Projection.isInstance(sink))
      ) {
        return this.SUPER(x, sink, skip, limit, order, predicate);
      }

      let self = this;
      let key  = [sink, order, predicate].toString();

      return new Promise(function(resolve, reject) {
        // console.log('******** QUERYCACHE: predicate: ' + predicate + ' in cache: ' +  ( self.cache[key] ? 'true' : 'false' ));
        let requestStartIdx = skip || 0;
        let requestEndIdx   = requestStartIdx + limit;

        // Ensure we have cache for request
        self.fillCache_(key, requestStartIdx, requestEndIdx, x, sink, order, predicate).then(() => {
          // Re-create cache entry if purged during async fillCache_
          if ( ! self.cache[key] ) self.cache[key] = [];

          let endIdx = requestEndIdx <= self.cache[key].length ? requestEndIdx : self.cache[key].length;

          //console.log('*** QCD *** size: ' + self.cache[key].length + ' : endIdx: ' + endIdx + ' : for predicate: ' + predicate);


          // Return data from cache
          for ( let idx = requestStartIdx ; idx < endIdx ; idx++ ) {
            if ( foam.dao.ArraySink.isInstance(sink) ) {
                sink.array[idx-requestStartIdx] = self.cache[key][idx];
            } else if ( foam.mlang.sink.Projection.isInstance(sink) ) {
                sink.projectionWithClass[idx-requestStartIdx] = self.cache[key][idx];
            }
          }

          sink.eof();

          resolve(sink);
        });
      });
    },

    // Remove invalidates cache and is forwarded to the source.
    function remove_(x, o) {
      this.purgeCache();
      return this.delegate.remove_(x, o);
    },

    // RemoveAll invalidates cache and is forwarded to the source.
    function removeAll_(x, skip, limit, order, predicate) {
      this.purgeCache();
      this.delegate.removeAll_(x, skip, limit, order, predicate);
    },

    function cmd_(x, obj) {
      if ( foam.dao.DAO.PURGE_CMD === obj ) {
        this.purgeCache();
      }

      this.SUPER(x, obj);
    },

    function fillCache_(key, requestStartIdx, requestEndIdx, x, sink, order, predicate) {
      // Pre-check cache for elements
      let startIdx = -1;
      let endIdx   = -1;
      let hasMissingData = false;

      if ( this.cache[key] ) {
        // Cycle through exising cached elements to verify all requested are present
        for ( let idx = requestStartIdx ; idx < requestEndIdx ; idx++ ) {
          if ( ! this.cache[key][idx] ) {
            // Found start of missing data within requested block
            hasMissingData = true;
            startIdx = idx;
            break;
          }
        }

        if ( hasMissingData ) {
          for ( let idx = requestEndIdx - 1 ; idx >= startIdx ; idx-- ) {
            if ( ! this.cache[key][idx] ) {
              // Found end of missing data within requested block
              endIdx = idx + 1;
              break;
            }
          }
        }
      } else {
        // No data present load entire block
        hasMissingData  = true;
        startIdx        = requestStartIdx;
        endIdx          = requestEndIdx;
        this.cache[key] = [];
      }

      if ( hasMissingData ) {
        // console.log('******** QUERYCACHE*** HAS MISSING DATA ***: predicte: ' + predicate + ' startIdx: ' + startIdx + ' endIdx: ' + endIdx);
        let self = this;
        return this.delegate.select_(x, sink, startIdx, endIdx - startIdx, order, predicate).then(function(result) {
          // Re-create cache entry if purged during async select
          if ( ! self.cache[key] ) self.cache[key] = [];

          if ( foam.dao.ArraySink.isInstance(sink) ) {
            // ArraySink
            // Update cache with missing data
            for ( let idx = 0 ; idx < result.array.length ; idx++ ) {
              self.cache[key][startIdx + idx] = result.array[idx];
            }
          } else if ( foam.mlang.sink.Projection.isInstance(sink) ) {
            // Projection
            // Update cache with missing data
            for ( let idx = 0 ; idx < result.projectionWithClass.length ; idx++ ) {
              self.cache[key][startIdx + idx] = result.projectionWithClass[idx];
            }
          }
        });
      }

      return Promise.resolve();
    }
  ]
});
