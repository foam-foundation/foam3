/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'AbstractPartitionedDAO',
  extends: 'foam.dao.AbstractDAO',
  abstract: true,

  javaImports: [
    'foam.core.script.BeanShellExecutor',
    'foam.dao.Sink',
    'foam.lang.*',
    'foam.mlang.order.Comparator',
    'foam.mlang.predicate.Predicate',
    'java.util.concurrent.ConcurrentHashMap'
  ],

  constants: [
    {
      name: 'SEPARATOR',
      type: 'String',
      documentation: 'Character used to sepatate sections of the primary key.',
      value: '§'
    }
  ],

  properties: [
    {
      class: 'Int',
      name: 'depth',
      javaValue: '1'
    },
    {
      class: 'String',
      name: 'dirName'
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'partitionProperty',
      documentation: 'Name of Property to be partitioned on.'
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'identityExpr',
      javaType: 'foam.mlang.Expr',
      documentation: 'Property for comparing. Defaults to ID. Intented to support models without an id property.',
      javaFactory: 'return new foam.mlang.IdentityExpr();'
    }
  ],

  methods: [
  ]
});
