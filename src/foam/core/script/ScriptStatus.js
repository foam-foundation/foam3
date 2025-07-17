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
      color: '$warn700',
      background: '$warn500'
    },
    {
      name: 'UNSCHEDULED',
      label: 'Unscheduled',
      ordinal: 1,
      color: '$grey700',
      background: '$grey300',
    },
    {
      name: 'RUNNING',
      label: 'Running',
      ordinal: 2,
      color: '$success500',
      background: '$success50',
    },
    {
      name: 'ERROR',
      label: 'Error',
      ordinal: 3,
      color: '$destructive500',
      background: '$destructive50'
    },
    {
      name: 'TIMEOUT',
      label: 'Timeout',
      ordinal: 4,
      color: '$warn700',
      background: '$warn500'
    }
  ]
});
