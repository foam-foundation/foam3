/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'All',
  extends: 'foam.mlang.predicate.AbstractPredicate',

  documentation: 'Expression which always returns true. Like foam.mlang.predicate.True except it causes all partitions to be traversed.',

  axioms: [ foam.pattern.Singleton.create() ],

  methods: [
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;'
    },
    {
      name: 'f',
      code: function() { return true; },
      javaCode: 'return true;'
    },
    {
      name: 'partialEval',
      code: function() { return this },
      javaCode: 'return this;'
    }
  ]
});
