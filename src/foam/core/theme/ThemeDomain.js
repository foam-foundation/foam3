/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.theme',
  name: 'ThemeDomain',

  documentation: 'mapping of domain to Theme.',

  tableColumns: [
    'id',
    'theme.name'
  ],

  properties: [
    {
      name: 'id',
      class: 'String',
      label: 'Domain'
    },
    {
      name: 'theme',
      class: 'Reference',
      of: 'foam.core.theme.Theme',
      projectionSafe: false,
      tableCellFormatter: function(value, obj, axiom) {
        obj.theme$find
          .then((theme) => {
            if ( theme ) {
              this.add(theme.toSummary);
            }
          })
          .catch((error) => {
            this.add(value);
          });
      }
    },
    {
      class: 'String',
      name: 'subdomain'
    }
  ]
});

foam.RELATIONSHIP({
  cardinality: '*:*',
  sourceModel: 'foam.core.theme.ThemeDomain',
  targetModel: 'foam.core.crunch.Capability',
  forwardName: 'capabilities',
  inverseName: 'themeDomains'
});
