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

  imports: [
    'cSpecDAO',
    'ruleDAO'
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
        let E = foam.mlang.Expressions.create();
        let dao = X.data.slot(function(daoKeys) {
          if ( ! daoKeys || daoKeys.length == 0 ) {
            // FIXME: The rule dao select in init is not working
            // and an empty array appears to generate
            // Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'f')
            // at Object.value (PredicateArray.js:27:18)
            // at foam.CLASS.properties.name (FObjectArray.js:88:23)
            return X.data.cSpecDAO;
          }
          return X.data.cSpecDAO.where(E.IN(foam.core.boot.CSpec.ID, daoKeys || []));
        });

        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          sections: [
            {
              heading: 'Licensable DAOs',
              dao$: dao
            }
          ]
        };
      },
      tableWidth: 125
    },
    {
      class: 'Long',
      name: 'quota',
      documentation: 'Maximum number of "things" that can be active at a time',
      value: 1,
      min: 1
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
    },
    {
      class: 'Array',
      name: 'daoKeys',
      hidden: true,
      value: []
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      let self = this;

      this.ruleDAO.select().then(function(sink) {
        self.daoKeys = sink.array.filter(function(rule) {
          return foam.core.license.LicenseRuleAction.isInstance(rule.action);
        }).map(function(rule) { return rule && rule.daoKey; });
      });
    },
    { // Override toSummary() to display the License's name rather than its Id in DetailView
      name: 'toSummary',
      type: 'String',
      code: function() { return this.name; },
      javaCode: ' return getName(); '
    }
  ]
});
