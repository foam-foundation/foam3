/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Average',
  extends: 'foam.mlang.sink.AbstractUnarySink',
  implements: [ 'foam.mlang.sink.Reducible' ],

  documentation: 'A Sink which averages put() values.',

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1'
    },
    {
      class: 'Double',
      name: 'value',
      value: 0
    },
    {
      class: 'Long',
      name: 'count',
      value: 0
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) {
        this.count++;
        this.value = ( this.value * (this.count-1) + this.arg1.f(obj) ) / this.count;
      },
      javaCode: `
setCount(getCount() + 1);
setValue((getValue() * ( getCount()-1) + ((Number)this.getArg1().f(obj)).doubleValue()) / getCount());
      `,
    },
    {
      name: 'reduce',
      args: 'foam.mlang.sink.Reducible other',
      code: function reduce(other) {
        if ( ! other || ! foam.mlang.sink.Average.isInstance(other) || other.count === 0 ) return;
        var totalCount = this.count + other.count;
        this.value = (this.value * this.count + other.value * other.count) / totalCount;
        this.count = totalCount;
      },
      javaCode: `
if (other == null) return;
if (other instanceof foam.mlang.sink.Average) {
  foam.mlang.sink.Average avg = (foam.mlang.sink.Average) other;
  if (avg.getCount() == 0) return;

  long totalCount = getCount() + avg.getCount();
  double combinedValue = (getValue() * getCount() + avg.getValue() * avg.getCount()) / totalCount;
  setValue(combinedValue);
  setCount(totalCount);
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
    function addToE(e) { e.add(this.value); }
  ]
});
