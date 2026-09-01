/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron',
  name: 'OrSchedule',

  documentation: `
    Schedule to pick the nearest time from a number of delegate schedules.
  `,

  implements: [
    'foam.core.cron.Schedule'
  ],

  javaImports: [
    'foam.lang.X',
    'java.util.Date'
  ],

  properties: [
    {
      name: 'delegates',
      class: 'FObjectArray',
      of: 'foam.core.cron.Schedule',
      view: () => {
        return {
          class: 'foam.u2.view.FObjectArrayView',
          of: 'foam.core.cron.Schedule',
          valueView: {
            class: 'foam.u2.view.FObjectView',
            of: 'foam.core.cron.Schedule'
          },
          defaultNewItem: foam.core.cron.IntervalSchedule.create({
            start: "2019-10-14",
            duration: foam.core.cron.TimeHMS.create({
              hour: 0, minute: 0, second: 0
            })
          })
        };
      }
    }
  ],

  methods: [
    {
      name: 'getNextScheduledTime',
      args: [
        {
          name: 'x',
          type: 'X'
        },
        {
          name: 'from',
          type: 'java.util.Date'
        }
      ],
      javaCode: `
        Date min = null;
        for ( Schedule sched : getDelegates() ) {
          Date next = sched.getNextScheduledTime(x, from);
          if ( min == null ) {
            min = sched.getNextScheduledTime(x, from);
          } else if ( next.getTime() < min.getTime() ) {
            min = next;
          }
        }
        return min;
      `
    },
    {
      name: 'postExecution',
      javaCode: `
        return;
      `
    }
  ]
});
