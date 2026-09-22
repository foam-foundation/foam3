/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.job',
  name: 'JobStatus',

  documentation: `Lifecycle of a Job in the jobDAO.

    Modelled on ScriptStatus, less UNSCHEDULED and INTERRUPTED: a Job is
    submitted to run once, so it is never parked unscheduled, and there is no
    interrupt path to cancel one. COMPLETED and FAILED are terminal, and are
    the only states the retention sweep removes.`,

  values: [
    {
      name: 'SCHEDULED',
      label: 'Scheduled',
      ordinal: 0,
      color: '$textSecondary',
      background: '$statusNeutralBackground'
    },
    {
      name: 'RUNNING',
      label: 'Running',
      ordinal: 1,
      color: '$statusWarnText',
      background: '$statusWarnBackground'
    },
    {
      name: 'COMPLETED',
      label: 'Completed',
      ordinal: 2,
      color: '$statusSuccessText',
      background: '$statusSuccessBackground'
    },
    {
      name: 'FAILED',
      label: 'Failed',
      ordinal: 3,
      color: '$statusDangerText',
      background: '$statusDangerBackground'
    }
  ]
});
