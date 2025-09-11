/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Eq',
  extends: 'foam.mlang.predicate.Binary',

  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Binary Predicate returns true iff arg1 EQUALS arg2.',

  methods: [
    {
      name: 'f',
      code: function(o) {
        var v1 = this.arg1.f(o);
        var v2 = this.arg2.f(o);

        // TODO This first check shouldn't be necessary.
        // First check is so that EQ(Class.PROPERTY, null | undefined) works.
        return ( v1 === undefined && v2 === null ) || foam.util.equals(v1, v2);
      },
      swiftCode: `
let v1 = arg1!.f(obj)
let v2 = arg2!.f(obj)
return FOAM_utils.equals(v1, v2)
      `,
      javaCode: 'return foam.util.SafetyUtil.compare(getArg1().f(obj), getArg2().f(obj)) == 0;'
    },
    {
      name: 'createStatement',
      javaCode: 'return " " + getArg1().createStatement() + " = " + getArg2().createStatement() + " ";'
    },

    function reduceAnd(other) {
      var myArg1           = this.arg1;
      var myArg2           = this.arg2;
      var otherArg1        = other.arg1;
      var otherArg2        = other.arg2;
      var isConst          = foam.mlang.Constant.isInstance.bind(foam.mlang.Constant);
      var myArg1IsConst    = isConst(myArg1);
      var myArg2IsConst    = isConst(myArg2);
      var otherArg1IsConst = isConst(otherArg1);
      var otherArg2IsConst = isConst(otherArg2);

      // Require one const, one non-const in this and other.
      if ( myArg1IsConst === myArg2IsConst || otherArg1IsConst === otherArg2IsConst )
        return this.SUPER(other);

      // Require same expr.
      var myExpr    = myArg1IsConst ? myArg2 : myArg1;
      var otherExpr = otherArg1IsConst ? otherArg2 : otherArg1;
      var equals    = foam.util.equals;

      if ( ! equals(myExpr, otherExpr) ) return this.SUPER(other);

      // Reduce to FALSE when consts are not equal.
      var myConst    = myArg1IsConst    ? myArg1    : myArg2;
      var otherConst = otherArg1IsConst ? otherArg1 : otherArg2;

      return equals(myConst, otherConst) ? this.SUPER(other) : this.FALSE;
    },

    function toMQL() {
      var arg2 = this.arg2ToMQL();
      if ( ! arg2 )
        return null;
      return this.arg1.name + '=' + arg2;
    }
  ]
});


/** Binary expression for inequality of two arguments. */
