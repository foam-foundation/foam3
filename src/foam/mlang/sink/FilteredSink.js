/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'FilteredSink',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'A sink that filters objects using a predicate before passing them to a delegate sink',

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'predicate',
      documentation: 'Predicate to filter objects with'
    },
    {
      class: 'foam.mlang.SinkProperty',
      name: 'delegate',
      documentation: 'The sink to delegate filtered objects to',
      required: true
    },
    {
      name: 'value',
      documentation: 'The value from the delegated sink',
      getter: function() {
        return this.delegate ? this.delegate.value : null;
      }
    }
  ],

  methods: [
    {
      name: 'put',
      code: async function(obj, s) {
        if ( this.predicate ) {
          try {
            var matches = await this.predicate.f(obj);
            if ( ! matches ) {
              return; // Skip this object
            }
          } catch (x) {
            // If predicate evaluation fails, log and skip
            console.warn('FilteredSink predicate evaluation failed:', x);
            return;
          }
        }

        if ( this.delegate ) {
          this.delegate.put(obj, s);
        }
      },
      javaCode: `if ( getPredicate() != null ) {
  try {
    boolean matches = getPredicate().f(obj);
    if ( ! matches ) {
      return; // Skip this object
    }
  } catch (Exception x) {
    // If predicate evaluation fails, log and skip
    System.err.println("FilteredSink predicate evaluation failed: " + x.getMessage());
    return;
  }
}

if ( getDelegate() != null ) {
  getDelegate().put(obj, sub);
}`
    },
    {
      name: 'toString',
      code: function() {
        return 'FilteredSink(' +
               (this.predicate ? this.predicate.toString() : 'no filter') +
               ' -> ' +
               (this.delegate ? this.delegate.toString() : 'null') + ')';
      }
    },

    function toSummary() {
      if ( this.delegate && this.delegate.toSummary ) {
        return this.delegate.toSummary();
      }
      return this.value;
    },

    function valueOf() {
      if ( this.delegate && this.delegate.valueOf ) {
        return this.delegate.valueOf();
      }
      return this.value;
    },

    function addToE(e) {
      if ( this.delegate && this.delegate.addToE ) {
        this.delegate.addToE(e);
      } else {
        e.add(this.value);
      }
    },

    function toProperties() {
      if ( this.delegate && this.delegate.toProperties ) {
        return this.delegate.toProperties();
      }
    },

    function setPropertyValues(o, sink, ps) {
      if ( this.delegate && this.delegate.setPropertyValues ) {
        // Delegate to the wrapped sink and return result (may be array of rows)
        return this.delegate.setPropertyValues(o, sink.delegate, ps);
      } else if ( ps && ps.length > 0 ) {
        ps[0].set(o, this.value);
      }
    },

    function reduce(other) {
      if ( ! other || ! foam.mlang.sink.FilteredSink.isInstance(other) ) return;

      // Only reduce if predicates are equivalent
      if ( this.predicate && other.predicate ) {
        if ( this.predicate.toString() !== other.predicate.toString() ) return;
      } else if ( this.predicate !== other.predicate ) {
        return;
      }

      if ( this.delegate && this.delegate.reduce && other.delegate ) {
        this.delegate.reduce(other.delegate);
      }
    }
  ]
});
