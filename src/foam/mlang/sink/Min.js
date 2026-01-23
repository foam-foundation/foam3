/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Min',
  extends: 'foam.mlang.sink.AbstractUnarySink',
  implements: [ 'foam.mlang.sink.Reducible' ],

  documentation: 'A Sink which remembers the minimum value put().',

  properties: [
    {
      class: 'Object',
      name: 'value'
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, s) {
        if ( ! this.hasOwnProperty('value') || foam.util.compare(this.value, this.arg1.f(obj) ) > 0) {
          this.value = this.arg1.f(obj);
        }
      },
      javaCode: `
Object newValue = getArg1().f(obj);

// If we don't have a current minimum, use the new value
if ( getValue() == null ) {
  setValue(newValue);
  return;
}

// If new value is null, keep current minimum
if ( newValue == null ) {
  return;
}

// Both values are non-null, compare them
if ( ((Comparable)newValue).compareTo(getValue()) < 0 ) {
  setValue(newValue);
}`
    },
    {
      name: 'reduce',
      args: 'foam.mlang.sink.Reducible other',
      code: function reduce(other) {
        if ( ! other || ! foam.mlang.sink.Min.isInstance(other) ) return;

        if ( ! this.hasOwnProperty('value') || foam.util.compare(other.value, this.value) < 0 ) {
          this.value = other.value;
        }

      },
      javaCode: `
if (other == null) return;
if (other instanceof foam.mlang.sink.Min) {
  foam.mlang.sink.Min min = (foam.mlang.sink.Min) other;
  if (min.getValue() == null) return;

  if (getValue() == null) {
    setValue(min.getValue());
    return;
  }

  if (((Comparable) min.getValue()).compareTo(getValue()) < 0) {
    setValue(min.getValue());
  }
}
      `
    },
    {
      name: 'reset',
      code: function() { this.value = 0; },
      swiftCode: 'value = 0'
    },
    function toSummary() { return this.value; },
    function valueOf() { return this.value; },
    function addToE(e) { e.add(this.value); },

    function toProperties() {
      var name = 'min_' + this.arg1.name;
      var propClass = this.arg1.cls_?.id || 'String';
      return [ { class: propClass, name: name, label: 'MIN(' + foam.String.labelize(this.arg1.name) + ')' } ];
    },

    function setPropertyValues(o, sink, ps) {
      ps[0].set(o, sink.value);
    }
  ]
});
