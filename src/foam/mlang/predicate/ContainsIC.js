/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'ContainsIC',
  extends: 'foam.mlang.predicate.Binary',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Predicate returns true iff second arg found in first array argument, ignoring case.',

  methods: [
    {
      name: 'f',
      code: function f(o) {
        var arg1 = this.arg1.f(o);
        var arg2 = this.arg2.f(o).toString().toUpperCase();
        if ( Array.isArray(arg1) ) {
          return arg1.some(function(a) {
            return a.toString().toUpperCase().indexOf(arg2) !== -1;
          })
        }
        return arg1 ? arg1.toString().toUpperCase().indexOf(arg2) !== -1 : false;
      },
      javaCode:
`Object s1 = getArg1().f(obj);
String s2 = ((String) getArg2().f(obj)).toUpperCase();
if ( s1 instanceof String[] ) {
  for ( String s : (String[]) s1 ) {
    if ( s.toUpperCase().contains(s2) )
      return true;
  }
}
return ( s1 instanceof String && ((String) s1).toUpperCase().contains(s2) );`
    },
    {
      name: 'createStatement',
      type: 'String',
      javaCode: `return " '" + getArg1().createStatement() + "' ilike '%" + getArg2().createStatement() + "%' ";`
    },

    function toMQL() {
      var arg2 = this.arg2ToMQL();
      if ( ! arg2 )
        return null;
      return this.arg1.name + ':' + arg2;
    }

  ]
});
