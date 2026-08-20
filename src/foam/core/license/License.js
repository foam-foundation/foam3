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

  properties: [
    {
      class: 'String',
      name: 'daoKey',
      documentation: 'DAO this License applies to'
    },
    {
      class: 'Int',
      name: 'quota',
      documentation: 'Maximum number of "things" that can be active at a time'
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
      documentation: 'Current status of the License (COMPLIANT or VIOLATED)'
    },
    {
      class: 'Int',
      name: 'count',
      documentation: 'Current number of active "things". Updated when daoKey puts or removes'
    }
  ]
});