/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'LoginAttempt',

  documentation: '',

  implements: [
    'foam.core.auth.CreatedAware'
  ],

  properties: [
    {
      name: 'id',
      class: 'String',
      hidden: true
    },
    {
      name: 'identifier',
      class: 'String'
    },
    {
      name: 'ipAddress',
      class: 'String'
    },
    {
      name: 'failureMessage',
      class: 'String'
    }
  ]
});
