/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Neq',
  extends: 'foam.mlang.predicate.Binary',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Binary Predicate returns true iff arg1 does NOT EQUAL arg2.',

  methods: [
    {
      name: 'f',
      code: function(o) {
        var v1 = this.arg1.f(o);
        var v2 = this.arg2.f(o);

        // TODO This first check shouldn't be necessary.
        return  ( v1 !== undefined || v2 !== null ) && ! foam.util.equals(v1, v2);
      },
      swiftCode: `
let v1 = arg1!.f(obj)
let v2 = arg2!.f(obj)
return !FOAM_utils.equals(v1, v2)
`,
      javaCode: 'return ! foam.util.SafetyUtil.equals(getArg1().f(obj),getArg2().f(obj));'
    },
    {
      name: 'createStatement',
      javaCode: 'return " " + getArg1().createStatement() + " <> " + getArg2().createStatement() + " ";'
    },
    function toMQL() {
      var arg2 = this.arg2ToMQL();
      if ( arg2 == null ) return null;
      return '-' + this.arg1.name + '=' + arg2;
    }
  ]
});


/** Binary expression for "strictly less than". */
