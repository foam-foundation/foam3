/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'NamedProperty',
  extends: 'foam.mlang.AbstractExpr',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Stores propName as a property and returns property when f() is called.',

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.mlang.Expr',
    'java.util.List',
    'java.util.Map',
    'java.util.concurrent.ConcurrentHashMap'
  ],

  axioms: [
    foam.pattern.Multiton.create({property: 'propName'}),
    {
      name: 'javaExtras',
      buildJavaClass: function(cls) {
        cls.extras.push(
          `
  protected final static Map map__ = new ConcurrentHashMap();
  public static NamedProperty create(String propName) {
    NamedProperty p = (NamedProperty) map__.get(propName);

    if ( p == null ) {
      p = new NamedProperty();
      p.setPropName(propName);
      map__.put(propName, p);
    }

    return p;
  }
 `
        );
      }
    }
  ],

  properties: [
    {
      class: 'Map',
      name: 'specializations_',
      factory: function() { return {}; },
      javaFactory: 'return new java.util.concurrent.ConcurrentHashMap<ClassInfo, Expr>();'
    },
    {
      class: 'String',
      name: 'propName'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(o) {
        return this.specialization(o.model_).f(o);
      },
      javaCode: `
        if ( obj instanceof foam.lang.X )
          return foam.mlang.ContextObject.create(getPropName());

        if ( obj instanceof FObject )
          return specialization(((FObject) obj).getClassInfo()).f(obj);

        return false;
      `
    },
    {
      name: 'specialization',
      args: 'ClassInfo model',
      type: 'Expr',
      code: function(model) {
        return this.specializations_[model.name] ||
          ( this.specializations_[model.name] = this.specialize(model) );
      },
      javaCode: `
        if ( getSpecializations_().get(model) == null ) {
          Expr prop = specialize(model);
          if ( prop != null ) getSpecializations_().put(model, specialize(model));
        }
        return (Expr) getSpecializations_().get(model);
      `
    },
    {
      name: 'specialize',
      args: 'ClassInfo model',
      type: 'Expr',
      code: function(model) {
        for ( var i = 0; i < model.properties.length; i++  ) {
          var prop = model.properties[i];
          if ( this.propName == prop.name || this.propName == prop.shortName || prop.aliases.includes(this.propName) ) return prop;
        }
        return;
      },
      javaCode: `
        List<PropertyInfo> properties  = model.getAxiomsByClass(PropertyInfo.class);

        for ( PropertyInfo prop : properties ) {
          if ( prop.getName().equals(getPropName()) || prop.getShortName() != null && prop.getShortName().equals(getPropName()) ) return prop;

          for ( int i = 0; i < prop.getAliases().length; i++) {
            if ( getPropName().equals(prop.getAliases()[i]) ) return prop;
          }
        }

        return null;
      `
    },
    {
      name: 'authorize',
      javaCode: `
        // A property named by string, such as "salary", only resolves to its
        // PropertyInfo once the class is known. An unknown name resolves to
        // null and reads nothing, so it has nothing to check.
        Expr prop = specialization(of);
        if ( prop != null ) prop.authorize(x, of);
      `
    },
    function toString() {
      return this.propName;
    }
  ]
});
