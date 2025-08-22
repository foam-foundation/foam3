/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Sum',
  extends: 'foam.mlang.sink.AbstractUnarySink',
  implements: [ 'foam.mlang.sink.Reducible' ],

  documentation: 'A Sink which sums put() values.',

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1'
    },
    {
      class: 'Double',
      name: 'value',
      value: 0
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) { this.value += this.arg1.f(obj); },
      javaCode: 'setValue(getValue() + ((Number) this.arg1_.f(obj)).doubleValue());'
    },
    {
      name: 'reduce',
      args: 'foam.mlang.sink.Reducible other',
      code: function reduce(other) {
        if ( ! other || ! foam.mlang.sink.Sum.isInstance(other) ) return;
        this.value += other.value;
      },
      javaCode: `
if (other == null) return;
if (other instanceof foam.mlang.sink.Sum) {
  setValue(getValue() + ((foam.mlang.sink.Sum) other).getValue());
}
      `
    },

    function toSummary() { return this.value; },

    function addToE(e) { e.add(this.value); },

    function toProperties() {
      var name = 'sum_' + this.arg1.name;
      return [ { class: 'Double', name: name , label: foam.String.labelize(name) } ];
    },

    function valueOf() { return this.value; },

    function setPropertyValues(o, sink, ps) {
      ps[0].set(o, sink.value);
    }
  ]
});
