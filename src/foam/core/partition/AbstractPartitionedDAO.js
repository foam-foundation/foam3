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
      documentation: 'Character used to separate sections of the primary key.',
      value: '~'
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
      class: 'Object',
      name: 'idProperty',
      javaType: 'foam.lang.PropertyInfo',
      javaFactory: `
        return (foam.lang.PropertyInfo) getOf().getAxiomByName("id");
      `
    }
  ],

  methods: [
  ]
});
