/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'Ref',
  extends: 'foam.mlang.AbstractExpr',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'An Unary Expression which returns reference property object',

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.core.logger.Logger',
    'foam.core.logger.StdoutLogger',
    'foam.util.StringUtil'
  ],

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(o) {
        //throw new Error('Ref is not supported');
        return null;
      },
      javaCode: `
        PropertyInfo p1 = (PropertyInfo) getArg1();
        FObject refObj = null;
        try {
          refObj = (FObject)obj.getClass().getMethod("find" + StringUtil.capitalize(p1.getName()), foam.lang.X.class)
            .invoke(obj, foam.lang.XLocator.get());
        } catch ( Throwable t ) {
          Logger logger = (Logger) getX().get("logger");
          if ( logger == null ) {
            logger = StdoutLogger.instance();
          }
          logger.error(t);
        }
        return refObj;
      `
    },

    function comparePropertyValues(o1, o2) {
      return this.arg1.comparePropertyValues(o1, o2);
    }
  ]
});

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'RefSummary',
  extends: 'foam.mlang.expr.Ref',

  documentation: `
    Same as Ref, but returns a map of { id, summary: obj.toSummary() }
    TODO: Maybe this should return a proper FObject of type referenceSummaryData
    Would make all the typechecking easier
  `,

  javaImports: [
    'foam.lang.FObject',
    'java.util.HashMap',
    'java.util.Map'
  ],

  methods: [
    // Delegates to Property.set() if arg1 is a Property, otherwise uses the property name or arg1 itself.
    {
      name: 'set',
      code: function(o, value) {
        if ( ! o || ! this.arg1 ) return;
        if ( foam.lang.Property.isInstance(this.arg1) ) {
          this.arg1.set(o, value);
        } else {
          o[this.arg1.name ?? this.arg1] = value;
        }
      }
    },
    {
      name: 'f',
      code: function(o) {   // js side is for DAOs with cache:true
        if ( ! o || ! this.arg1 ) return null;
        var name = this.arg1.name;
        if ( o[name] == null ) return null;
        var finder;
        try { finder = o[name + '$find']; }
        catch (e) { return null; }
        return finder.then(async function(ref) {
          if ( ref == null ) return null;
          var summary = ref.toSummary ? ref.toSummary() : null;
          if ( summary instanceof Promise ) summary = await summary;
          return { id: ref.id, summary: summary };
        });
      },
      javaCode: `
        // java side is for DAOs with cache:false
        FObject temp = (FObject) super.f(obj);
        if ( temp == null ) return null;
        Map<String, Object> result = new HashMap<>();
        result.put("id", temp.getProperty("id"));
        result.put("summary", temp.toSummary());
        return result;
      `
    }
  ]
});
