/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.ruler',
  name: 'RuleRefreshService',

  skeleton: true,
  client: true,
  proxy: true,

  documentation: `
    Service to trigger a full DAO refresh for a given rule.
    This re-puts all records in the rule's target DAO, effectively
    triggering all onCreate rules to re-process the data.
  `,

  methods: [
    {
      name: 'refreshDAO',
      async: true,
      documentation: `
        Refresh all records in the DAO associated with the given rule.
        Selects all records and re-puts them to trigger onCreate rules.
      `,
      type: 'foam.core.ruler.RuleRefreshResult',
      args: 'String ruleId'
    }
  ]
});
