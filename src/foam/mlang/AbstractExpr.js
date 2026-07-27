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
      javaCode: `//noop`
    }
  ]
});
