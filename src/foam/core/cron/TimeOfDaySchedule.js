/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron',
  name: 'TimeOfDaySchedule',

  documentation: `
    Schedule every day at a specific time.

    For example, to run a task at midnight:
    { time: { hour: 0, minute: 0, second: 0 } }
  `,

  implements: [
    'foam.core.cron.Schedule'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.util.DateService',
    'java.time.*'
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.time.TimeZone',
      name: 'timeZone',
      value: 'GMT'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.cron.TimeHMS',
      name: 'time',
      factory: () => {
        return foam.core.cron.TimeHMS.create();
      }
    }
  ],

  methods: [
    {
      name: 'getNextScheduledTime',
      type: 'DateTime',
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
        DateService dateService = (DateService) x.get("dateService");
        ZoneId zone = dateService.getTimeZoneId(x, getTimeZone());
        LocalDateTime now = dateService.dateToLocalDateTimeWithZone(x, from, zone);
        LocalDateTime nextTOD = ZonedDateTime.of(now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
          getTime().getHour(), getTime().getMinute(), getTime().getSecond(), 0, zone).toLocalDateTime();

        // Increment the date if time now is after scheduled time of day
        if ( now.isAfter(nextTOD) ) {
          nextTOD = nextTOD.plusDays(1);
        }

        return dateService.localDateTimeToDateWithZone(x, nextTOD, zone);
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
