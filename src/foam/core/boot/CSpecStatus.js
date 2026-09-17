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
      background: '$statusNeutralBackground',
      borderColor: '$textSecondary',
    },
    {
      name: 'INITIALIZING',
      label: 'Initializing',
      color: '$statusWarnText',
      background: '$statusWarnBackground',
      borderColor: '$yellow700'
    },
    {
      name: 'REPLAYING',
      label: 'Replaying',
      color: '$statusInfoText',
      background: '$statusInfoBackground',
      borderColor: '$blue500'
    },
    {
      name: 'READY',
      label: 'Ready',
      color: '$statusSuccessText',
      background: '$statusSuccessBackground',
      borderColor: '$green600'
    },
    {
      name: 'ERROR',
      label: 'Error',
      color: '$statusDangerText',
      background: '$statusDangerBackground',
      borderColor: '$red600'
    }
  ]
});
