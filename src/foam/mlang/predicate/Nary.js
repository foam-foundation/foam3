/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Nary',
  extends: 'foam.mlang.predicate.AbstractPredicate',
  abstract: true,

  documentation: 'Abstract n-ary (many-argument) Predicate base-class.',

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateArray',
      name: 'args'
    }
  ],

  methods: [
    function toSummary() {
      return this.toString();
    },
    {
      name: 'toString',
      code: function() {
        return foam.String.constantize(this.cls_.name) + '(' +
          this.args.map(a => a?.toString()) + ')';
      },
      javaCode: `
        StringBuilder sb = new StringBuilder();
        sb.append(getClass().getSimpleName()).append('(');
        for ( int i = 0; i < getArgs().length; i++ ) {
          if ( i > 0 ) sb.append(", ");
          sb.append(getArgs()[i].toString());
        }
        sb.append(')');
        return sb.toString();
      `
    },

    function reduce_(args, shortCircuit, methodName) {
      for ( var i = 0 ; i < args.length - 1 ; i++ ) {
        for ( var j = i + 1 ; j < args.length ; j++ ) {
          if ( args[i][methodName] ) {
            var newArg = args[i][methodName](args[j]);
            if ( newArg ) {
              if ( newArg === shortCircuit ) return shortCircuit;
              args[i] = newArg;
              args.splice(j, 1);
            }
          }
        }
      }
      return args;
    },
    {
      name: 'prepareStatement',
      javaCode: `
        for ( Predicate predicate : getArgs() ) {
          predicate.prepareStatement(stmt);
        }
      `
    },
    {
      name: 'authorize',
      javaCode: `
        for ( Predicate predicate : getArgs() ) {
          predicate.authorize(x);
        }
      `
    }
  ]
});
