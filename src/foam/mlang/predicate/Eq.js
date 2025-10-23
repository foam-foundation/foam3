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
      // If you query field=value1 AND field=value1, reduce to just field=value1
      // If you query field=value1 AND field=value2, reduce to FALSE
      if ( ! foam.util.equals(this.arg1, other.arg1) ) return SUPER(other);
      return foam.util.equals(this.arg2, other.arg2) ? this : foam.mlang.predicate.False.create();
    },

    function reduceOr(other) {
      // If you query field=value1 OR field=value1, reduce to just field=value1
      if ( ! foam.util.equals(this.arg1, other.arg1) ) return SUPER(other);
      return foam.util.equals(this.arg2, other.arg2) ? this : null;
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
