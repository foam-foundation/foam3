/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'LabeledSink',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'A sink that wraps another sink with a label, allowing named results that can be retrieved in genModel',

  properties: [
    {
      class: 'String',
      name: 'label',
      documentation: 'Label to identify this sink result'
    },
    {
      class: 'foam.mlang.SinkProperty',
      name: 'delegate',
      documentation: 'The sink to delegate to',
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
      code: function(obj, s) {
        if ( this.delegate ) {
          this.delegate.put(obj, s);
        }
      },
      javaCode: `if ( getDelegate() != null ) {
  getDelegate().put(obj, sub);
}`
    },
    {
      name: 'toString',
      code: function() {
        return 'LabeledSink(' + this.label + ': ' + (this.delegate ? this.delegate.toString() : 'null') + ')';
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
        // Get properties from delegate and override their labels
        var props = this.delegate.toProperties();
        if ( Array.isArray(props)  && props.length > 0  && this.label) {
          return props.map(p => {
            // Clone the property and set its label to include our label prefix
            var newProp = p.clone ? p.clone() : foam.util.clone(p);
            newProp.name = this.label;
            newProp.label = foam.String.labelize(this.label);
            return newProp;
          });
        }
        return props;
      } else if ( this.delegate && ! this.delegate.toProperties ) {
        console.error('LabeledSink: delegate ' + this.delegate.cls_.id + ' does not implement toProperties(). Add toProperties() method to the delegate sink class.');
        throw new Error('LabeledSink: delegate ' + this.delegate.cls_.id + ' does not implement toProperties()');
      }
    },

    function setPropertyValues(o, sink, ps) {
      if ( this.delegate && this.delegate.setPropertyValues ) {
        // Delegate to the wrapped sink and return result (may be array of rows)
        return this.delegate.setPropertyValues(o, sink.delegate, ps);
      } else if ( ps && ps.length > 0 ) {
        // Set the value using our label
        ps[0].set(o, this.value);
      }
    },

    function reduce(other) {
      if ( ! other || ! foam.mlang.sink.LabeledSink.isInstance(other) ) return;
      if ( this.label !== other.label ) return;

      if ( this.delegate && this.delegate.reduce && other.delegate ) {
        this.delegate.reduce(other.delegate);
      }
    }
  ]
});