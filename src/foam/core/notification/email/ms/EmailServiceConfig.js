/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email.ms',
  name: 'EmailServiceConfig',
  extends: 'foam.core.notification.email.EmailServiceConfig',

  properties: [
    {
      name: 'password',
      label: 'Password / Client Secret',
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
