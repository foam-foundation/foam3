/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.script',
  name: 'ScriptStatus',
  values: [
    {
      name: 'SCHEDULED',
      label: 'Scheduled',
      ordinal: 0,
      color: '$statusWarnText',
      background: '$statusWarnBackground'
    },
    {
      name: 'UNSCHEDULED',
      label: 'Unscheduled',
      ordinal: 1,
      color: '$statusNeutralText',
      background: '$statusNeutralBackground',
    },
    {
      name: 'RUNNING',
      label: 'Running',
      ordinal: 2,
      color: '$statusSuccessText',
      background: '$statusSuccessBackground',
    },
    {
      name: 'ERROR',
      label: 'Error',
      ordinal: 3,
      color: '$statusDangerText',
      background: '$statusDangerBackground'
    },
    {
      name: 'INTERRUPTED',
      label: 'Interrupted',
      ordinal: 4,
      color: '$statusWarnText',
      background: '$statusWarnBackground'
    }
  ]
});
