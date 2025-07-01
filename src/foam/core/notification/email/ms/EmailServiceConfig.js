/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email.ms',
  name: 'EmailServiceConfig',

  refines: 'foam.core.notification.email.EmailServiceConfig',

  properties: [
    {
      name: 'password',
      label: 'Password / Client Secret',
      class: 'Password',
      value: null
    },
    {
      name: 'clientId',
      documentation: 'Microsoft Graph API client ID',
      class: 'String'
    },
    {
      name: 'tenantId',
      documentation: 'Microsoft Graph API tenant ID',
      class: 'String'
    }
  ]
});
