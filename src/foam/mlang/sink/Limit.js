/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Limit',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Sink that only processes the first N records, then stops. Useful for sampling or limiting result sets.',

  properties: [
    {
      class: 'Int',
      name: 'limit',
      documentation: 'Maximum number of records to process',
      value: 1
    },
    {
      class: 'foam.mlang.SinkProperty',
      name: 'delegate',
      documentation: 'Delegate sink to receive limited records',
      factory: function() { return foam.mlang.sink.Count.create(); }
    },
    {
      class: 'Int',
      name: 'count_',
      hidden: true,
      value: 0,
      documentation: 'Internal counter for processed records'
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
      code: function(obj, sub) {
        // Only process if we haven't reached the limit
        if ( this.count_ < this.limit ) {
          this.count_++;
          if ( this.delegate ) {
            this.delegate.put(obj, sub);
          }
        }
        // Don't detach - that would break GroupBy sink chains
      },
      javaCode: `
        if ( getCount_() < getLimit() ) {
          setCount_(getCount_() + 1);
          if ( getDelegate() != null ) {
            getDelegate().put(obj, sub);
          }
        }
      `
    },
    {
      name: 'reset',
      code: function(sub) {
        this.count_ = 0;
        if ( this.delegate && this.delegate.reset ) {
          this.delegate.reset(sub);
        }
      },
      javaCode: `
        setCount_(0);
        if ( getDelegate() != null ) {
          getDelegate().reset(sub);
        }
      `
    },
    {
      name: 'eof',
      code: function() {
        if ( this.delegate && this.delegate.eof ) {
          this.delegate.eof();
        }
      },
      javaCode: `
        if ( getDelegate() != null ) {
          getDelegate().eof();
        }
      `
    },
    {
      name: 'toString',
      code: function() {
        return 'Limit(' + this.limit + ', ' + (this.delegate ? this.delegate.toString() : 'null') + ')';
      }
    },
    function toProperties() {
      if ( this.delegate && this.delegate.toProperties ) {
        return this.delegate.toProperties();
      }
    },
    function setPropertyValues(o, sink, ps) {
      if ( this.delegate && this.delegate.setPropertyValues ) {
        this.delegate.setPropertyValues(o, sink.delegate, ps);
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
    function processGroupValue(dao, proto, props) {
      if ( this.delegate && this.delegate.processGroupValue ) {
        this.delegate.processGroupValue(dao, proto, props);
      }
    }
  ]
});
