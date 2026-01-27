/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Not',
  extends: 'foam.mlang.predicate.AbstractPredicate',
  implements: [ 'foam.lang.Serializable', { path: 'foam.mlang.Expressions', flags: ['js'], java: false } ],

  documentation: 'Unary Predicate which negates the value of its argument.',

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'arg1'
    }
  ],

  methods: [
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;'
    },
    {
      name: 'f',
      code: function f(obj) { return ! this.arg1.f(obj); },
      javaCode: 'return ! getArg1().f(obj);'
    },

    {
      name: 'toString',
      code: function() {
        return foam.String.constantize(this.cls_.name) + '(' + this.arg1.toString() + ')';
      },
      javaCode: 'return String.format("Not(%s)", getArg1().toString());'
    },
    {
      name: 'partialEval',
      code: function() {
        if ( this.arg1 && this.arg1.partialEval ) {
          this.arg1 = this.arg1.partialEval();
        }
        if ( this.Not.isInstance(this.arg1) ) {
          return this.arg1.arg1;
        } else if ( this.Eq.isInstance(this.arg1) ) {
          return this.Neq.create({arg1: this.arg1.arg1, arg2: this.arg1.arg2});
        } else if (this.Neq.isInstance(this.arg1)) {
          return this.Eq.create({arg1: this.arg1.arg1, arg2: this.arg1.arg2});
        } else if (this.Lt.isInstance(this.arg1)) {
          return this.Gte.create({arg1: this.arg1.arg1, arg2: this.arg1.arg2});
        } else if (this.Gte.isInstance(this.arg1)) {
          return this.Lt.create({arg1: this.arg1.arg1, arg2: this.arg1.arg2});
        } else if (this.Gt.isInstance(this.arg1)) {
          return this.Lte.create({arg1: this.arg1.arg1, arg2: this.arg1.arg22});
        } else if (this.Lte.isInstance(this.arg1)) {
          return this.Gt.create({arg1: this.arg1.arg1, arg2: this.arg1.arg2});
        } else if (this.And.isInstance(this.arg1)) {
          for ( var i = 0; i < this.arg1.args.length; i++ ) {
            this.arg1.args[i] = this.Not.create({ arg1: this.arg1.args[i] }).partialEval();
          }
          return this.Or.create({args: this.arg1.args});
        } else if (this.Or.isInstance(this.arg1)) {
          for ( var i = 0; i < this.arg1.args.length; i++ ) {
            this.arg1.args[i] = this.Not.create({ arg1: this.arg1.args[i] }).partialEval();
          }
          return this.And.create({args: this.arg1.args});
        }
        return this;
      },
      javaCode:
      `
    if ( this.arg1_ instanceof Not )
      return ((Not) arg1_).arg1_.partialEval();

    if ( arg1_.getClass().equals(Eq.class) ) {
      return new Neq.Builder(null)
        .setArg1(( (Binary) arg1_ ).getArg1())
        .setArg2(( (Binary) arg1_ ).getArg2())
        .build();
    }

    if ( arg1_.getClass().equals(Neq.class) ) {
      return new Eq.Builder(null)
        .setArg1(( (Binary) arg1_ ).getArg1())
        .setArg2(( (Binary) arg1_ ).getArg2())
        .build();
    }

    if ( arg1_.getClass().equals(Gt.class) ) {
      return new Lte.Builder(null)
        .setArg1(( (Binary) arg1_ ).getArg1())
        .setArg2(( (Binary) arg1_ ).getArg2())
        .build();
    }

    if ( arg1_.getClass().equals(Gte.class) ) {
      return new Lt.Builder(null)
        .setArg1(( (Binary) arg1_ ).getArg1())
        .setArg2(( (Binary) arg1_ ).getArg2())
        .build();
    }

    if ( arg1_.getClass().equals(Lt.class) ) {
      return new Gte.Builder(null)
        .setArg1(( (Binary) arg1_ ).getArg1())
        .setArg2(( (Binary) arg1_ ).getArg2())
        .build();
    }

    if ( arg1_.getClass().equals(Lte.class) ) {
      return new Gt.Builder(null)
        .setArg1(( (Binary) arg1_ ).getArg1())
        .setArg2(( (Binary) arg1_ ).getArg2())
        .build();
    }

//    Not predicate = (Not) this.fclone();
    Not predicate = this;
    if ( predicate.arg1_.getClass().equals(And.class) ) {
      int len = ( (And) predicate.getArg1() ).args_.length;
      for ( int i = 0; i < len; i++ ) {
        ( (And) predicate.getArg1() ).args_[i] = ( new Not.Builder(null).setArg1((( (And) predicate.getArg1() ).args_[i]) ).build().partialEval() );
      }
      return new Or.Builder(null).setArgs(( (And) predicate.getArg1() ).args_).build().partialEval();
    }
    if ( predicate.arg1_.getClass().equals(Or.class) ) {
      int len = ( (Or) predicate.getArg1() ).args_.length;
      for ( int i = 0; i < len; i++ ) {
        ( (Or) predicate.getArg1() ).args_[i] = ( new Not.Builder(null).setArg1((( (Or) predicate.getArg1() ).args_[i]) ).build().partialEval() );
      }
      return new And.Builder(null).setArgs((( (Or) predicate.getArg1() ).args_)).build().partialEval();
    }

    return this;`
    },
    {
      name: 'createStatement',
      javaCode: 'return " NOT (" + getArg1().createStatement() + ") ";'
    },

    {
      name: 'prepareStatement',
      javaCode: 'getArg1().prepareStatement(stmt);'
    },
    {
      name: 'authorize',
      javaCode: `
        getArg1().authorize(x);
      `
    }

    /*
      TODO: this isn't ported to FOAM2/FOAM3 yet.
    function partialEval() {
      return this;
      var newArg = this.arg1.partialEval();

      if ( newArg === TRUE ) return FALSE;
      if ( newArg === FALSE ) return TRUE;
      if ( NotExpr.isInstance(newArg) ) return newArg.arg1;
      if ( EqExpr.isInstance(newArg)  ) return NeqExpr.create(newArg);
      if ( NeqExpr.isInstance(newArg) ) return EqExpr.create(newArg);
      if ( LtExpr.isInstance(newArg)  ) return GteExpr.create(newArg);
      if ( GtExpr.isInstance(newArg)  ) return LteExpr.create(newArg);
      if ( LteExpr.isInstance(newArg) ) return GtExpr.create(newArg);
      if ( GteExpr.isInstance(newArg) ) return LtExpr.create(newArg);

      return this.arg1 === newArg ? this : NOT(newArg);
    }*/
  ]
});
