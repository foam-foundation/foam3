/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron',
  name: 'IntervalSchedule',

  documentation: `
    Schedule periodically with a time duration (hours, minutes, seconds).

    For example, to run a task every 90 minutes:
    { start: "1970-01-01",
      duration: { hour: 1, minute: 30 , second: 0 } }
  `,

  implements: [
    'foam.core.cron.Schedule'
  ],

  javaImports: [
    'foam.lang.X',
    'java.util.Calendar',
    'java.util.Date'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.cron.TimeHMS',
      name: 'duration',
      factory: () => {
        return foam.core.cron.TimeHMS.create();
      },
      javaFactory: 'return new foam.core.cron.TimeHMS();'
    },
    {
      //TODO(jlhughes): split start into startDate and startTime
      class: 'DateTime',
      name: 'start'
    }
  ],

  methods: [
    {
      name: 'getNextScheduledTime',
      type: 'DateTime',
      args: 'X x, java.util.Date from',
      javaCode:
`
if ( getStart() != null &&
     getStart().getTime() > from.getTime() ) {
  return getStart();
}
Calendar next = Calendar.getInstance();
next.setTime(from);
if ( getDuration().getHour() == 0 &&
     getDuration().getMinute() == 0 &&
     getDuration().getSecond() == 0 ) {
  next.add(Calendar.DATE, 1);
} else {
  next.add(Calendar.HOUR_OF_DAY, getDuration().getHour());
  next.add(Calendar.MINUTE,      getDuration().getMinute());
  next.add(Calendar.SECOND,      getDuration().getSecond());
}
return next.getTime();
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
