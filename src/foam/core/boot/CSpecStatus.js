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
      color: '$statusNeutralText',
      background: '$statusNeutralBackground'
    },
    {
      name: 'INITIALIZING',
      label: 'Initializing',
      color: '$statusWarnText',
      background: '$statusWarnBackground'
    },
    {
      name: 'REPLAYING',
      label: 'Replaying',
      color: '$statusInfoText',
      background: '$statusInfoBackground'
    },
    {
      name: 'READY',
      label: 'Ready',
      color: '$statusSuccessText',
      background: '$statusSuccessBackground'
    },
    {
      name: 'UNLOADED',
      label: 'Unloaded',
      color: '$statusNeutralText',
      background: '$statusNeutralBackground'
    },
    {
      name: 'ERROR',
      label: 'Error',
      color: '$statusDangerText',
      background: '$statusDangerBackground'
    }
  ]
});
