/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ruler',
  name: 'RuleRefreshResult',

  documentation: 'Result object returned by RuleRefreshService.refreshDAO()',

  properties: [
    {
      class: 'String',
      name: 'ruleId',
      documentation: 'The ID of the rule whose DAO was refreshed'
    },
    {
      class: 'String',
      name: 'daoKey',
      documentation: 'The DAO key that was refreshed'
    },
    {
      class: 'Long',
      name: 'processedCount',
      documentation: 'Number of records processed (re-put)'
    },
    {
      class: 'Long',
      name: 'updatedCount',
      documentation: 'Number of records that were actually modified by rules'
    },
    {
      class: 'Long',
      name: 'failedCount',
      documentation: 'Number of records that failed to process'
    },
    {
      class: 'Long',
      name: 'duration',
      documentation: 'Time taken to complete the refresh in milliseconds'
    },
    {
      class: 'Boolean',
      name: 'success',
      value: true,
      documentation: 'Whether the refresh completed successfully'
    },
    {
      class: 'String',
      name: 'errorMessage',
      documentation: 'Error message if the refresh failed'
    }
  ]
});
