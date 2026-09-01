/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.test',
  name: 'TestRun',

  implements: [
    'foam.core.auth.CreatedAware',
    'foam.core.auth.LastModifiedAware'
  ],

  tableColumns: [
    'created',
    'server',
    'description',
    'cases',
    'tests',
    'passed',
    'failed',
    'completed'
  ],

  properties: [
    {
      name: 'id',
      class: 'String'
    },
    {
      name: 'description',
      class: 'String'
    },
    {
      name: 'server',
      class: 'Boolean',
      value: true
    },
    {
      name: 'suites',
      class: 'String'
    },
    {
      name: 'filter',
      class: 'String'
    },
    {
      name: 'completed',
      class: 'Boolean'
    },
    {
      name: 'cases',
      class: 'Int'
    },
    {
      name: 'tests',
      class: 'Int'
    },
    {
      name: 'passed',
      class: 'Int'
    },
    {
      name: 'failed',
      class: 'Int'
    },
    {
      name: 'failures',
      class: 'List'
    }
  ],

  methods: [
    {
      name: 'advancedFrom',
      args: 'foam.core.test.TestRun prior',
      type: 'Boolean',
      documentation: `
        Whether this run has reported more work than prior did. A null prior counts
        as advanced so a watcher's first observation starts its idle clock instead of
        expiring it. Lets the watcher separate a run that is still reporting results
        from one that has stalled without knowing which counters mean progress.
      `,
      javaCode: `
        if ( prior == null ) return true;
        return getCases()  != prior.getCases()  ||
               getTests()  != prior.getTests()  ||
               getPassed() != prior.getPassed() ||
               getFailed() != prior.getFailed();
      `
    }
  ]
});
