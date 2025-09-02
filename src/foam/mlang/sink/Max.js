/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Max',
  extends: 'foam.mlang.sink.AbstractUnarySink',
  implements: [ 'foam.mlang.sink.Reducible' ],

  documentation: 'A Sink which remembers the maximum value put().',

  properties: [
    {
      class: 'Object',
      name: 'value'
    }
  ],

  methods: [
    {
      name: 'put',
      code: function(obj, sub) {
        if ( ! this.hasOwnProperty('value') || foam.util.compare(this.value, this.arg1.f(obj)) < 0 ) {
          this.value = this.arg1.f(obj);
        }
      },
      swiftCode: `
        let arg1 = self.arg1!
        if !hasOwnProperty("value") || FOAM_utils.compare(value, arg1.f(obj)) < 0 {
          value = arg1.f(obj);
        }
      `,
      javaCode: `
Object newValue = getArg1().f(obj);

// If we don't have a current maximum, use the new value
if ( getValue() == null ) {
  setValue(newValue);
  return;
}

// If new value is null, keep current maximum
if ( newValue == null ) {
  return;
}

// Both values are non-null, compare them
if ( ((Comparable)newValue).compareTo(getValue()) > 0 ) {
  setValue(newValue);
}`
    },
    {
      name: 'reduce',
      args: 'foam.mlang.sink.Reducible other',
      code: function reduce(other) {
        if ( ! other || ! foam.mlang.sink.Max.isInstance(other) ) return;

        if ( ! this.hasOwnProperty('value') || foam.util.compare(other.value, this.value) > 0 ) {
          this.value = other.value;
        }

      },
      javaCode: `
if (other == null) return;
if (other instanceof foam.mlang.sink.Max) {
  foam.mlang.sink.Max max = (foam.mlang.sink.Max) other;
  if (max.getValue() == null) return;

  if (getValue() == null) {
    setValue(max.getValue());
    return;
  }

  if (((Comparable) max.getValue()).compareTo(getValue()) > 0) {
    setValue(max.getValue());
  }
}
      `
    },
    function toSummary() { return this.value; },
    function valueOf() { return this.value; },
    function addToE(e) { e.add(this.value); }
  ]
});
