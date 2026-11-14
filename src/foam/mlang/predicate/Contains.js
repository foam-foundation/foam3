/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Contains',
  extends: 'foam.mlang.predicate.Binary',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Predicate returns true iff second arg found in first array argument.',

  methods: [
    {
      name: 'f',
      code: function(o) {
        var arg1 = this.arg1.f(o);
        var arg2 = this.arg2.f(o);
        if ( Array.isArray(arg1) ) {
          return arg1.some(function(a) {
            return a.indexOf(arg2) !== -1;
          })
        }
        // An empty string still holds "", as Java's "".contains("") does.
        return arg1 || arg1 === '' ? arg1.indexOf(arg2) !== -1 : false;
      },
      javaCode:
`Object s1 = getArg1().f(obj);
String s2 = (String) getArg2().f(obj);
if ( s1 instanceof String[] ) {
  for ( String s : (String[]) s1 ) {
    if ( s.contains(s2) )
      return true;
  }
}
return ( s1 instanceof String && ((String) s1).contains(s2) );`
    },
    {
      name: 'createStatement',
      javaCode: `return " '" + getArg1().createStatement() + "' like '%" + getArg2().createStatement() + "%' ";`
    }
  ]
});
