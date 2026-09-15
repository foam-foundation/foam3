/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'ArrayBinary',
  extends: 'foam.mlang.predicate.Binary',
  abstract: true,

  documentation: 'Binary predicate that accepts an array in "arg2".',

  javaImports: [
    'foam.lang.PropertyInfo',
    'foam.mlang.ArrayConstant',
    'foam.mlang.Constant',
    'java.util.List'
  ],

  properties: [
    {
      name: 'arg2',
      adapt: function(old, nu, prop) {
        var value = prop.adaptValue(nu);
        var arg1  = this.arg1;

        // Adapt constant array elements when:
        // (1) Value is a constant (array);
        // (2) Value is truthy (empty arrays can be serialized as undefined);
        // (3) Arg1 has an adapt().
        if ( foam.mlang.Constant.isInstance(value) && value.value && arg1 && arg1.adapt ) {
          value = value.clone();
          var arrayValue = value.value;
          for ( var i = 0 ; i < arrayValue.length ; i++ ) {
            arrayValue[i] = arg1.adapt.call(null, old && old[i], arrayValue[i], arg1);
          }
        }

        return value;
      },
      javaPreSet: `
        if ( val instanceof Constant && getArg1() instanceof PropertyInfo ) {
          PropertyInfo prop  = (PropertyInfo) getArg1();
          Object       value = ((Constant) val).getValue();

          // A single value is a legal arg2 — IN(prop, x) asks whether a list-valued
          // property holds x, and the query parser builds exactly that — so cast it as
          // one element rather than casting the value itself to an array.
          if ( value instanceof List ) {
            List list = (List) value;
            for ( int i = 0 ; i < list.size() ; i++ ) {
              list.set(i, prop.castObject(list.get(i)));
            }
          } else if ( value instanceof Object[] ) {
            Object[] valArr = (Object[]) value;
            for ( int i = 0 ; i < valArr.length ; i++ ) {
              valArr[i] = prop.castObject(valArr[i]);
            }
          }
        }
      `
    },
    {
      name: 'valueSet_',
      documentation: 'arg2 as a JS hash for faster execution',
      transient: true,
      hidden: true,
      expression: function(arg2) {
        // only called when arg2 is a Constant
        var rhs = arg2.value;
        var set = {};
        for ( var i = 0 ; i < rhs.length ; i++ ) {
          var s = rhs[i];
          if ( this.upperCase_ ) s = s.toString().toUpperCase();
          set[s] = true;
        }
        return set;
      }
    }
  ],

  methods: [
    {
      name: 'toString',
      code: function() {
        return foam.String.constantize(this.cls_.name) + '(' +
            this.arg1.toString() + ', ' +
            this.arg2.toString() + ')';
      },
      javaCode: `
        StringBuilder b = new StringBuilder();
        if ( getArg2() instanceof ArrayBinary || getArg2() instanceof Constant ) {
          Object[] a = null;
          Object arg2 = getArg2().f(null);

          if ( arg2 instanceof List ) {
            a = ((List) arg2).toArray();
          } else if ( arg2 instanceof Object[] ) {
            a = (Object[]) arg2;
          } else if ( arg2 != null ) {
            b.append(arg2.toString());
          }

          if ( a != null ) {
            b.append("len: " + a.length + ",");
            for ( int i = 0 ; i < a.length ; i++ ) {
              b.append(a[i]);
              if ( i < a.length -1 ) b.append(',');
            }
          }
        } else {
          b.append(getArg2().toString());
        }
        return String.format("%s(%s, %s)", getClass().getSimpleName(), getArg1().toString(), b.toString());
      `
    }
  ]
});
