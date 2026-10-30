/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Binary',
  extends: 'foam.mlang.predicate.AbstractPredicate',
  abstract: true,

  javaImports:[
    'foam.lang.PropertyInfo',
    'foam.mlang.Constant'
  ],

  documentation: 'Abstract Binary (two-argument) Predicate base-class.',

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1',
      gridColumns: 6
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg2',
      gridColumns: 6,
      adapt: function(old, nu, prop) {
        var value = prop.adaptValue(nu);
        var arg1 = this.arg1;
        if ( foam.mlang.Constant.isInstance(value) && arg1 && arg1.adapt ) {
          var value = this.arg1.adapt.call(null, old, value.value, arg1);
          if ( value !== value.value ) return foam.mlang.Constant.create({value: value});
          return nu;
        }

        return value;
      },
      javaPreSet: `
        if ( val instanceof Constant && getArg1() instanceof PropertyInfo ) {
          Constant c = (Constant) val;
          Object value = c.getValue();
          PropertyInfo prop = (PropertyInfo) getArg1();
          c.setValue(prop.castObject(value));
        }
      `
    }
  ],

  methods: [
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;'
    },
    function toIndex(tail) {
      return this.arg1 && this.arg1.toIndex(tail);
    },
    function toSummary() {
      return this.toString();
    },
    {
      name: 'toString',
      code: function() {
        return foam.String.constantize(this.cls_.name) + '(' +
            (this.arg1 && this.arg1.toString() || 'NA') + ', ' +
            (this.arg2 && this.arg2.toString() || 'NA') + ')';
      },
      javaCode: `
        String arg1 = getArg1() != null ? getArg1().toString() : "NA";
        String arg2 = getArg2() != null ? getArg2().toString() : "NA";
        return String.format("%s(%s, %s)", getClass().getSimpleName(), arg1, arg2);
      `
    },
    {
      name: 'prepareStatement',
      javaCode: `getArg1().prepareStatement(stmt);
getArg2().prepareStatement(stmt);`
    },
    function arg2ToMQL() {
      return this.arg2 && this.arg2.toMQL ? this.arg2.toMQL() : this.arg2;
    },
    {
      name: 'partialEval',
      code: function partialEval() {
        if ( ! this.arg1?.partialEval || ! this.arg2?.partialEval ) return this;

        var newArg1 = this.arg1.partialEval();
        var newArg2 = this.arg2.partialEval();

        if ( this.arg1 === newArg1 && this.arg2 === newArg2 ) return this;
        return this.cls_.create({arg1: newArg1, arg2: newArg2});
      },
      javaCode: `
        var newArg1 = getArg1().partialEval();
        var newArg2 = getArg2().partialEval();

        if ( getArg1() == newArg1 && getArg2() == newArg2 )
          return this;

        try {
          var nu = (Binary) getClass().getDeclaredConstructor().newInstance();
          nu.setArg1(newArg1);
          nu.setArg2(newArg2);
          return nu;
        } catch ( Throwable e ) {
          return this;
        }
      `
    }
  ]
});
