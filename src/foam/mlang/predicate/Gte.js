/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Gte',
  extends: 'foam.mlang.predicate.Binary',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Binary Predicate returns true iff arg1 is GREATER THAN or EQUAL to arg2.',

  methods: [
    {
      name: 'f',
      code: function(o) {
        return foam.util.compare(this.arg1.f(o), this.arg2.f(o)) >= 0;
      },
      javaCode: 'return  foam.util.SafetyUtil.compare(getArg1().f(obj),getArg2().f(obj))>=0;'
    },
    {
      name: 'createStatement',
      javaCode: 'return " " + getArg1().createStatement() + " >= " + getArg2().createStatement() + " ";'
    },
    function toMQL() {
      var arg2 = this.arg2ToMQL();
      if ( arg2 == null ) return null;
      return this.arg1.name + '>=' + arg2;
    }
  ]
});
