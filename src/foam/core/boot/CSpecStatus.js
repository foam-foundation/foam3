/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.boot',
  name: 'CSpecStatus',

  values: [
    {
      name: 'INITIAL',
      label: 'Initial',
      color: '$textSecondary',
      background: '$backgroundSecondary',
      borderColor: '$textSecondary',
    },
    {
      name: 'INITIALIZING',
      label: 'Initializing',
      color: '$yellow700',
      background: '$yellow100',
      borderColor: '$yellow700'
    },
    {
      name: 'REPLAYING',
      label: 'Replaying',
      color: '$blue500',
      background: '$blue50',
      borderColor: '$blue500'
    },
    {
      name: 'READY',
      label: 'Ready',
      color: '$green600',
      background: '$green50',
      borderColor: '$green600'
    },
    {
      name: 'ERROR',
      label: 'Error',
      color: '$red600',
      background: '$red50',
      borderColor: '$red600'
    }
  ]
});
