/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'In',
  extends: 'foam.mlang.predicate.ArrayBinary',
  implements: [
    'foam.lang.Serializable',
    { path: 'foam.mlang.Expressions', flags: ['js'], java: false }
  ],

  documentation: 'Predicate returns true iff arg1 is a substring of arg2, or if arg2 is an array, arg1 is an element of arg2.',

  requires: [ 'foam.mlang.Constant' ],

  javaImports: [
    'foam.mlang.ArrayConstant',
    'foam.mlang.Constant',
    'java.util.List'
  ],

  properties: [
    {
      name: 'arg1',
      postSet: function(old, nu) {
        // this is slightly slower when an expression on upperCase_
        this.upperCase_ = nu && foam.lang.Enum.isInstance(nu);
      }
    },
    {
      name: 'upperCase_',
      hidden: 'true'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function f(o) {
        var lhs = this.arg1.f(o);
        var rhs = this.arg2.f(o);

        if ( ! rhs ) return false;

        for ( var i = 0 ; i < rhs.length ; i++ ) {
          var v = rhs[i];

          if ( foam.String.isInstance(v) && this.upperCase_ ) v = v.toUpperCase();
          if ( foam.util.equals(lhs, v) ) return true;
        }
        return false;

        // TODO: This is not a sufficient enough check for valueSet_.
        // We can have constants that contain other FObjects, in
        // particular with multi part id support.So this code path is
        // disabled for now.

        // If arg2 is a constant array, we use valueSet for it.
        if ( this.Constant.isInstance(this.arg2) )
          return !! this.valueSet_[lhs];

        return rhs ? rhs.indexOf(lhs) !== -1 : false;
      },
      swiftCode: `
let lhs = arg1!.f(obj)
let rhs = arg2!.f(obj)
if ( rhs == nil ) {
  return false
}

if let values = rhs as? [Any] {
  for value in values {
    if ( FOAM_utils.equals(lhs, value) ) {
      return true
    }
  }
} else if let rhsStr = rhs as? String, let lhsStr = lhs as? String {
  return rhsStr.contains(lhsStr)
}

return false
      `,
      javaCode:
  `
  Object lhs = getArg1().f(obj);
  // boolean uppercase = lhs.getClass().isEnum(); TODO: Account for ENUMs? (See js)
  Object rhs = getArg2().f(obj);

  if ( rhs instanceof List ) {
    List list = (List) rhs;
    for ( Object o : list ) {
      if ( ( ( (Comparable) lhs ).compareTo( (Comparable) o ) ) == 0 ) {
        return true;
      }
    }
  } else if ( rhs instanceof Object[] ) {
    // Checks if rhs array contains the lhs object
    Object[] values = (Object[]) rhs;

    for ( int i = 0 ; i < values.length ; i++ ) {
      if ( ( ( (Comparable) lhs ).compareTo( (Comparable) values[i] ) ) == 0 ) {
        return true;
      }
    }
  } else if ( rhs instanceof String ) {
    // Checks if lhs is substring of rhs
    return ( lhs instanceof String ) &&
      ( ( (String) rhs ).contains( (String) lhs ) );
  }

  return false;
  `
    },
    {
      name: 'createStatement',
      type: 'String',
      javaCode: 'return " " + getArg1().createStatement() + " in " + getArg2().createStatement();'
    },
    {
      name: 'partialEval',
      code: function partialEval() {
        var value = this.arg2;
        if ( this.Constant.isInstance(this.arg2) ) value = this.arg2.value;

        if ( ! value )
          return this.FALSE;

        if ( foam.Array.isInstance(value) ) {
          if ( value.length == 0 ) return this.FALSE;
          if ( value.length == 1 ) return this.Eq.create({arg1: this.arg1, arg2: value[0]});
        }

        return this;
      },
      javaCode: `
        if ( getArg2() instanceof ArrayBinary || getArg2() instanceof Constant ) {
          Object[] arr = null;
          Object arg2 = getArg2().f(null);

          if ( arg2 instanceof List ) {
            arr = ((List) arg2).toArray();
          } else if ( arg2 instanceof Object[] ) {
            arr = (Object[]) arg2;
          } else {
            return this;
          }

          if ( arr.length == 0 ) {
            return foam.mlang.MLang.FALSE;
          }
          if ( arr.length == 1 ) {
            return new Eq.Builder(getX())
              .setArg1(getArg1())
              .setArg2(new Constant(arr[0]))
              .build();
          }
        }
        return this;
      `
    },
    function toMQL() {
      var arg2 = this.arg2ToMQL();
      if ( ! arg2 )
        return null;
      return this.arg1.name + ':' + arg2.join(',');
    }
  ]
});
