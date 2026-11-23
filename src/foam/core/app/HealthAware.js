/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.app',
  name: 'HealthAware',

  properties: [
    {
      class: 'String',
      name: 'health',
      label: 'Pulse Id',
      visibility: 'RO',
      readPermissionRequired: true,
      writePermissionRequired: true
    }
  ]
});
