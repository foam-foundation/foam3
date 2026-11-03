/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'AbstractPredicate',
  abstract: true,
  implements: [ 'foam.mlang.predicate.Predicate' ],

  documentation: 'Abstract Predicate base-class.',

  methods: [
    {
      name: 'f',
      type: 'Boolean',
      args: [
        {
          name: 'obj',
          type: 'Any'
        }
      ],
      javaCode: 'return false;',
      swiftCode: 'return false',
    },
    {
      name: 'toIndex',
      flags: ['js'],
      code: function() { },
    },

    {
      name: 'toDisjunctiveNormalForm',
      flags: ['js'],
      code: function() { return this },
      swiftCode: 'return self',
    },

    {
      name: 'partialEval',
      code: function() { return this },
      swiftCode: 'return self',
      javaCode: 'return this;'
    },

    function reduceAnd(other) {
      return foam.util.equals(this, other) ? this : null;
    },

    function reduceOr(other) {
      return foam.util.equals(this, other) ? this : null;
    },

    {
      name: 'toString',
      code: function toString() { return this.cls_.name; },
      javaCode: 'return getClass().getName();'
    },
    {
      name: 'createStatement',
      type: 'String',
      javaCode: 'return "";',
      swiftCode: 'return "";',
    },
    {
      name: 'prepareStatement',
      type: 'Void',
      javaThrows: [ 'java.sql.SQLException' ],
      args: [
        {
          name: 'stmt',
          javaType: 'foam.dao.jdbc.IndexedPreparedStatement'
        }
      ],
      javaCode: '//noop',
      swiftCode: '//noop'
    },
    {
      name: 'authorize',
      javaCode: 'foam.mlang.AbstractExpr.authorizeProperties(x, of, this);'
    }
  ]
});
