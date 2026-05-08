/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.order',
  name: 'ThenBy',

  implements: [
    'foam.lang.Serializable',
    'foam.mlang.order.Comparator'
  ],

  documentation: 'Binary Comparator, which sorts for first Comparator, then second.',

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.order.Comparator',
      adapt: function(_, a) {
        // TODO(adamvy): We should fix FObjectProperty's default adapt when the
        // of parameter is an interface rather than a class.
        return a;
      },
      javaJSONParser: 'foam.lib.json.ExprParser.instance()',
      name: 'head'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.order.Comparator',
      adapt: function(_, a) {
        // TODO(adamvy): We should fix FObjectProperty's default adapt when the
        // of parameter is an interface rather than a class.
        return a;
      },
      javaJSONParser: 'foam.lib.json.ExprParser.instance()',
      name: 'tail'
    }
  ],

  methods: [
    {
      name: 'compare',
      code: function(o1, o2) {
        // an equals of arg1.compare is falsy, which will then hit arg2
        return this.head.compare(o1, o2) || this.tail.compare(o1, o2);
      },
      javaCode: `
        int ret = getHead().compare(o1, o2);
        return ret == 0 ? getTail().compare(o1, o2) : ret;
      `
    },
    {
      name: 'toString',
      code: function() {
        return 'THEN_BY(' + this.head.toString() + ', ' +
          this.tail.toString() + ')';
      },
      javaCode: 'return "THEN_BY " + getHead().toString() + ", " + getTail().toString();'

    },
    {
      name: 'createStatement',
      javaCode: `return getHead().createStatement() + ", " + getTail().createStatement();`
    },
    {
      name: 'prepareStatement',
      javaCode: `return;`
    },
    function toIndex(tail) {
      return this.head && this.tail && this.head.toIndex(this.tail.toIndex(tail));
    },

    function orderTail() { return this.tail; },

    function orderPrimaryProperty() { return this.head.orderPrimaryProperty(); },

    function orderDirection() { return this.head.orderDirection(); }
  ]
});
