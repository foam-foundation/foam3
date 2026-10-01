/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.license',
  name: 'License',
  documentation: 'Model that restricts the number of "things" that can be active on a given DAO (e.g. only three Users, only 10000 transactions) per SPID',

  implements: [ 'foam.core.auth.ServiceProviderAware' ],

  ids: [ 'daoKey', 'spid' ],

  messages: [
    {
      name: 'LTE_ZERO_QUOTA_MSG',
      messageMap: {
        en: "The quota must be at least 1",
        fr: "Le quota doit être d'au moins 1"
      }
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'name',
      required: true,
      documentation: 'Name of the License'
    },
    {
      class: 'String',
      name: 'description',
      documentation: 'Description of what this License governs, who it applies to, variations of it, etc.'
    },
    {
      class: 'Reference',
      name: 'daoKey',
      of: 'foam.core.boot.CSpec',
      targetDAOKey: 'cSpecDAO',
      label: 'DAO',
      required: true,
      documentation: 'Name of the DAO this License applies to',
      view: function(_, X) { // Need acces to service.read.ruleDAO for this to populate
        var E = foam.mlang.Expressions.create();

        var promise = X.ruleDAO.select().then(function(sink) {
          // Keep only rules whose action is a LicenseRuleAction, and collect their daoKeys
          var daoKeys = sink.array
            .filter(function(rule) {
              return foam.core.license.LicenseRuleAction.isInstance(rule.action);
            })
            .map(function(rule) { return rule.daoKey; });

          return X.cSpecDAO.where(E.IN(foam.core.boot.CSpec.ID, daoKeys));
        });

        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          sections: [
            {
              heading: 'Licensable DAOs',
              dao: foam.dao.PromisedDAO.create({ promise: promise }, X)
            }
          ]
        };
      },
      tableWidth: 125
    },
    {
      class: 'Long',
      name: 'quota',
      required: true,
      documentation: 'Maximum number of "things" that can be active at a time',
      validateObj: function(quota) {
        if ( quota <= 0 ) return this.LTE_ZERO_QUOTA_MSG;
      }
    },
    {
      class: 'Boolean',
      name: 'blocking',
      documentation: 'Whether this License blocks operations that would cause the count to exceed the quota, or just sends a warning'
    },
    {
      class: 'Enum',
      of: 'foam.core.license.LicenseStatus',
      name: 'status',
      value: 'INITIATED',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      documentation: 'Current status of the License (COMPLIANT, EXCEEDED, or INITIATED)'
    },
    {
      class: 'Long',
      name: 'count',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      documentation: 'Current number of active "things". Updated when daoKey puts or removes'
    }
  ],

  methods: [
    { // Override toSummary() to display the License's name rather than its Id in DetailView
      name: 'toSummary',
      type: 'String',
      code: function() { return this.name; },
      javaCode: ' return getName(); '
    }
  ]
});