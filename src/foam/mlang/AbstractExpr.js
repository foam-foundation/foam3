/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang',
  name: 'AbstractExpr',
  abstract: true,
  implements: [ 'foam.mlang.Expr' ],

  documentation: 'Abstract Expr base-class.',

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.X'
  ],

  javaCode: `
    // An expression or predicate is usually a tree of other expressions:
    // GT(DOT(User.MANAGER, User.SALARY), 50000) reads salary two levels down.
    // Authorizing every Expr, Predicate or comparator held in a property,
    // alone or in an array, covers each composite class without it having
    // to remember an authorize() override. Only set properties are walked,
    // so factory defaults such as an ALang argument's Constant are skipped.
    public static void authorizeProperties(X x, ClassInfo of, FObject obj) {
      for ( PropertyInfo p : obj.getClassInfo().getAxiomsByClass(PropertyInfo.class) ) {
        if ( ! p.isSet(obj) ) continue;

        Object value = p.get(obj);
        if ( value instanceof PropertyAuthorizable ) {
          ((PropertyAuthorizable) value).authorize(x, of);
        } else if ( value instanceof Object[] ) {
          for ( Object v : (Object[]) value ) {
            if ( v instanceof PropertyAuthorizable ) ((PropertyAuthorizable) v).authorize(x, of);
          }
        }
      }
    }
  `,

  methods: [
    // Safe to NOP fclone since Expressions should be stateless
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;'
    },
    {
      name: 'partialEval',
      code: function partialEval() { return this; },
      javaCode: 'return this;'
    },
    {
      name: 'createStatement',
      type: 'String',
      javaCode: 'return "";'
    },
    {
      name: 'prepareStatement',
      javaThrows: [ 'java.sql.SQLException' ],
      args: [
        {
          name: 'stmt',
          javaType: 'foam.dao.jdbc.IndexedPreparedStatement'
        }
      ],
      javaCode: ' '
    },
    {
      name: 'authorize',
      type: 'Void',
      javaCode: 'authorizeProperties(x, of, this);'
    }
  ]
});
