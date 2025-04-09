/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.ruler',
  name: 'RulePredicate',
  documentation: 'Interface for a Predicate which takes both the old and new objects, and a Context.',

  methods: [
    {
      name: 'ruleF',
      type: 'Boolean',
      args: 'Context x, foam.lang.FObject o, foam.lang.FObject n'
    }
  ]
});


foam.CLASS({
  name: 'AddRulePredicateToPredicateRefine',
  refines: 'foam.mlang.predicate.Predicate',

  implements: [ 'foam.core.ruler.RulePredicate' ]
});


foam.CLASS({
  name: 'AddRulePredicateToAbstractPredicateRefine',
  refines: 'foam.mlang.predicate.AbstractPredicate',

  methods: [
    {
      name: 'ruleF',
      type: 'Boolean',
      args: 'Context x, foam.lang.FObject o, foam.lang.FObject n',
      code: 'return this.f(n);',
//      javaCode: 'return f(n);'
      javaCode: 'return f(x.put("OLD", o).put("NEW", n));'
    }
  ]
});


foam.CLASS({
  name: 'AddRulePredicateToAndRefine',
  refines: 'foam.mlang.predicate.And',

  methods: [
    {
      name: 'ruleF',
      javaCode: `
        for ( int i = 0 ; i < getArgs().length ; i++ ) {
          if ( ! getArgs()[i].ruleF(x, o, n) ) return false;
        }
        return true;
      `
    }
  ]
});


foam.CLASS({
  name: 'AddRulePredicateToOrRefine',
  refines: 'foam.mlang.predicate.Or',

  methods: [
    {
      name: 'ruleF',
      javaCode: `
        for ( int i = 0 ; i < getArgs().length ; i++ ) {
          if ( getArgs()[i].ruleF(x, o, n) ) return true;
        }
        return false;
      `
    }
  ]
});


foam.CLASS({
  name: 'AddRulePredicateToNotRefine',
  refines: 'foam.mlang.predicate.Not',

  methods: [
    {
      name: 'ruleF',
      javaCode: 'return ! getArg1().ruleF(x, o, n);'
    }
  ]
});


foam.RULE_PREDICATE_ = function(m, internal) {
  m.extends = 'foam.mlang.predicate.AbstractPredicate';

    //        implements: [ 'foam.core.ruler.RulePredicate' ],
  m.javaImports = (m.javaImports || []);
  m.javaImports.push('static foam.mlang.MLang.*');
  m.javaImports.push('foam.util.SafetyUtil');
  m.methods     = (m.methods     || []);
  m.methods.push({
    name: 'ruleF',
    args: internal ? 'foam.lang.X x, FObject o_, FObject n_' : 'foam.lang.X x, FObject o, FObject n',
    javaCode: m.ruleF
  });

  if ( m.properties && m.properties.length ) {
    m.javaGenerateConvenienceConstructor = true;
  } else {
    m.javaCode = `
      private static ${m.name} instance__ = new ${m.name}();
      public  static ${m.name} instance() { return instance__; }
    `;
  }

  delete m['ruleF'];

  return m;
};

foam.RULE_PREDICATE = function(m) {
  return foam.CLASS(foam.RULE_PREDICATE_(m));
}

/*
  TODO:

  Make into a Model/Class instead? Then it can be added to classes: instead of axioms:
    Any way to auto-populate 'of'?
  Better support for Java Singletons
  Ability to remove Builder generation. Might cause issues with asJavaValue and serialization.
*/
foam.CLASS({
  package: 'foam.core.ruler',
  name: 'RulePredicateAxiom',

  documentation: 'An Axiom for defining Rule Predicates.',

  properties: [
    'name',
    {
      class: 'Class',
      name: 'of'
    },
    {
      class: 'Boolean',
      name: 'strict'
    },
    {
      name: 'properties',
      factory: function() { return []; }
    },
    { name: 'javaCode', required: false },
    'documentation'
  ],

  methods: [
    function toString() {
      return this.name;
    },
    function installInClass(cls) {
      // RulePredicates are Java-only, so just record the class
      this.of = cls;
    },

    function buildJavaClass(cls) {
      var strictCheck = this.strict ?
        `if ( n.getClass() != ${this.of.id}.class ) return false;` :
        '' ;

      var javaCode = `
        try {
          var o = (${this.of.id}) o_;
          var n = (${this.of.id}) n_;
          ${strictCheck}
          ${this.javaCode}
        } catch (ClassCastException e) {
          return false;
        }
      `;

      var model = foam.RULE_PREDICATE_({
        name:       this.name,
        ruleF:      javaCode,
        properties: this.properties || []
      }, true);

      foam.lang.InnerClass.create({model: model}).buildJavaClass(cls);
    }
  ]
});

/*

foam.CLASS({
  refines: 'foam.lang.Model',
  package: 'foam.lang',
  name: 'ModelConstantRefine',
  properties: [
    {
      class: 'AxiomArray',
      of: 'Constant',
      name: 'constants',
      adapt: function(_, a, prop) {
        if ( ! a ) return [];
        if ( ! Array.isArray(a) ) {
          var cs = [];
          for ( var key in a ) {
            cs.push(foam.lang.Constant.create({name: key, value: a[key]}));
          }
          return cs;
        }
        var b = new Array(a.length);
        for ( var i = 0 ; i < a.length ; i++ ) {
          b[i] = prop.adaptArrayElement.call(this, a[i], prop);
        }
        return b;
      }
    }
  ]
});
*/
