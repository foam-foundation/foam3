/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.order',
  name: 'Desc',

  implements: [
    'foam.mlang.order.Comparator',
    'foam.lang.Serializable',
    'foam.dao.SQLStatement'
  ],

  documentation: 'Comparator Decorator which reverses direction of comparison. Short for "descending".',

  properties: [
    {
      class: 'FObjectProperty',
      name: 'arg1',
      of: 'foam.mlang.order.Comparator',
      adapt: function(o, n, prop) {
        var ret  = foam.compare.toCompare(n);
        var type = prop.of;
        if ( type.isInstance(ret) ) {
          return ret;
        }
        return foam.lang.FObjectProperty.ADAPT.value.call(this, o, n, prop);
      },
      javaJSONParser: 'foam.lib.json.ExprParser.instance()'
    }
  ],

  methods: [
    {
      name: 'compare',
      code: function compare(o1, o2) {
        return -1 * this.arg1.compare(o1, o2);
      },
      javaCode: 'return -1 * getArg1().compare(o1, o2);',
      swiftCode: 'return -1 * self.arg1!.compare(o1, o2);'
    },
    {
      name: 'createStatement',
      javaCode: 'return " " + getArg1().createStatement() + " DESC ";'
    },
    {
      name: 'prepareStatement',
      javaCode: '//noop'
    },
    {
      name: 'toString',
      code: function toString() { return 'DESC(' + this.arg1.toString() + ')'; },
      javaCode: 'return "DESC(" + getArg1().toString() + ")";'
    },
    function toIndex(tail) { return this.arg1 && this.arg1.toIndex(tail); },
    function orderTail() { return; },
    function orderPrimaryProperty() { return this.arg1; },
    function orderDirection() { return -1 * this.arg1.orderDirection(); }
  ]
});
