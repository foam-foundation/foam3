/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.menu',
  name: 'AuthorizationStatus',

  values: [
    {
      name: 'AUTHENTICATED',
      label: 'Authenticated'
    },
    {
      name: 'UNAUTHENTICATED',
      label: 'Unauthenticated'
    },
    {
      name: 'PUBLIC',
      label: 'Public'
    }
  ]
});
