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
      color: '$statusWarnText',
      background: '$statusWarnBackground',
    },
    {
      name: 'ACTIVE',
      label: 'Active',
      color: '$statusSuccessText',
      background: '$statusSuccessBackground',
    },
    {
      name: 'REJECTED',
      label: 'Rejected',
      color: '$statusDangerText',
      background: '$statusDangerBackground',
    },
    {
      name: 'DELETED',
      label: 'Deleted',
      color: '$statusDangerText',
      background: '$statusDangerBackground',
    },
    {
      name: 'DISABLED',
      label: 'Disabled',
      color: '$statusNeutralText',
      background: '$statusNeutralBackground',
    }
  ]
});
