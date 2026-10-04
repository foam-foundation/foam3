/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.FSM({
  package: 'foam.lang.test',
  name: 'TestStateMachine',

  values: [
    {
      name: 'NEW',
      label: 'New',
      isInitial: true,
      transitions: ['ACTIVE']
    },
    {
      name: 'ACTIVE',
      label: 'Active',
      transitions: ['GUARDED', 'DEADLINE', 'DONE', 'FAILED'],
      guards: {
        GUARDED: function(x, obj) {
          return obj.allowGuarded ? null : 'guard blocked';
        }
      },
      permissions: {
        FAILED: 'test.fail.permission'
      }
    },
    {
      name: 'GUARDED',
      label: 'Guarded',
      transitions: ['DONE']
    },
    {
      name: 'DEADLINE',
      label: 'Deadline',
      transitions: ['DONE'],
      scheduledTime: 1000
    },
    {
      name: 'DONE',
      label: 'Done',
      transitions: []
    },
    {
      name: 'FAILED',
      label: 'Failed',
      transitions: ['NEW']
    }
  ]
});
