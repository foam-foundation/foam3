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
    'foam.util.StringUtil',
    'java.util.Map'
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
          Map<String, FObject> cache = (Map<String, FObject>) ((FObject) obj).getX().get("projectionReferenceCache");
          var key = p1.getName() + "-" + ((FObject) obj).getProperty(p1.getName()).toString();
          if ( cache != null ) {
            refObj = cache.get(key);
            if ( refObj != null ) return refObj;
          }
          refObj = (FObject)obj.getClass().getMethod("find" + StringUtil.capitalize(p1.getName()), foam.lang.X.class)
            .invoke(obj, foam.lang.XLocator.get());
          if ( cache != null ) {
            cache.put(key, refObj);
          }
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
