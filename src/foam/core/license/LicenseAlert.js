/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.license',
  name: 'LicenseAlert',
  extends: 'foam.core.notification.Notification',

  properties: [
    {
      class: 'String',
      name: 'clientName'
    },
    {
      class: 'String',
      name: 'licenseName'
    },
    {
  		class: 'Reference',
  		of: 'foam.core.auth.ServiceProvider',
      name: 'spid'
    },
    {
      class: 'String',
      name: 'daoKey'
    }
  ]
});