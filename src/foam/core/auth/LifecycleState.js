/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.auth',
  name: 'LifecycleState',

  values: [
    {
      name: 'PENDING',
      label: 'Pending',
      color: '$orange600',
      background: '$warn50',
    },
    {
      name: 'ACTIVE',
      label: 'Active',
      color: '$success600',
      background: '#e7f1e9',
    },
    {
      name: 'REJECTED',
      label: 'Rejected',
      color: '$red600',
      background: '$red50',
    },
    {
      name: 'DELETED',
      label: 'Deleted',
      color: '$red600',
      background: '$red50',
    },
    {
      name: 'DISABLED',
      label: 'Disabled',
      color: '$grey600',
      background: '$grey50',
    }
  ]
});
