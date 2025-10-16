/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron.test',
  name: 'OrScheduleTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.lang.X',
    'foam.core.cron.*',
    'foam.util.DateService',
    'java.time.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testSameTimezones(x);
        testDifferentTimezones(x);
      `
    },
    {
      name: 'testSameTimezones',
      args: 'X x',
      javaCode: `
        DateService dateService = (DateService) x.get("dateService");
        Schedule testTOD = new OrSchedule.Builder(x)
          .setDelegates(new Schedule[] {
            new TimeOfDaySchedule.Builder(x).setTimeZone(ZoneId.systemDefault().getId()).setTime(new foam.core.cron.TimeHMS.Builder(x).setHour(14).build()).build(),
            new TimeOfDaySchedule.Builder(x).setTimeZone(ZoneId.systemDefault().getId()).setTime(new foam.core.cron.TimeHMS.Builder(x).setHour(19).build()).build(),
          })
          .build();

        LocalDateTime now, next, expected;

        // Test 1: current time is before both schedules
        now = LocalDate.now().atTime(10, 0);
        next = dateService.dateToLocalDateTime(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDate(x, now)));
        expected = LocalDateTime.of(now.getYear(), now.getMonthValue(), now.getDayOfMonth(), 14, 0);

        test(next.equals(expected),
          "Same timezone: current time before both schedules - Expected: " + expected + ", Received: " + next);

        // Test 2: current time is between the two schedules
        now = LocalDate.now().atTime(16, 30);
        next = dateService.dateToLocalDateTime(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDate(x, now)));
        expected = LocalDateTime.of(now.getYear(), now.getMonthValue(), now.getDayOfMonth(), 19, 0);

        test(next.equals(expected),
          "Same timezone: current time between two schedules - Expected: " + expected + ", Received: " + next);

        // Test 3: current time is after both schedules
        now = LocalDate.now().atTime(22, 0);
        next = dateService.dateToLocalDateTime(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDate(x, now)));
        expected = LocalDateTime.of(now.getYear(), now.getMonthValue(), now.getDayOfMonth(), 14, 0);
        expected = expected.plusDays(1);

        test(next.equals(expected),
          "Same timezone: current time after both schedules - Expected: " + expected + ", Received: " + next);
      `
    },
    {
      name: 'testDifferentTimezones',
      args: 'X x',
      javaCode: `
        DateService dateService = (DateService) x.get("dateService");
        ZoneId zone_utc = dateService.getTimeZoneId(x, "GMT"); //UTC
        ZoneId zone_est5edt = dateService.getTimeZoneId(x, "EST5EDT");
        
        // First schedule   -   14:00 in UCT / 09:00 in EST / 10:00 in EDT
        // Second schedule  -   19:00 in UCT during daylight saving time or 18:00 in UCT during summer time / 14:00 EST/EDT
        Schedule testTOD = new OrSchedule.Builder(x)
          .setDelegates(new Schedule[] {
            new TimeOfDaySchedule.Builder(x).setTimeZone("GMT").setTime(new foam.core.cron.TimeHMS.Builder(x).setHour(14).build()).build(),
            new TimeOfDaySchedule.Builder(x).setTimeZone("EST5EDT").setTime(new foam.core.cron.TimeHMS.Builder(x).setHour(14).setMinute(0).setSecond(0).build()).build(),
          })
          .build();

        LocalDateTime now_utc, next_utc, expected_utc, now_est5edt, next_est5edt, expected_est5edt;

        // Test 1: current time is before both schedules
        now_utc = ZonedDateTime.of(2024, 3, 16, 8, 0, 0, 0, zone_utc).toLocalDateTime();
        next_utc = dateService.dateToLocalDateTime(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDateWithZone(x, now_utc, zone_utc)));
        expected_utc = ZonedDateTime.of(2024, 3, 16, 14, 0, 0, 0, zone_utc).toLocalDateTime();

        test(next_utc.equals(expected_utc),
          "Different timezones: current time before both schedules - Expected: " + expected_utc + ", Received: " + next_utc);

        // Test 2: current time is between the two schedules
        now_est5edt = ZonedDateTime.of(2024, 3, 16, 13, 0, 0, 0, zone_est5edt).toLocalDateTime();
        next_est5edt = dateService.dateToLocalDateTimeWithZone(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDateWithZone(x, now_est5edt, zone_est5edt)), zone_est5edt);
        expected_est5edt = ZonedDateTime.of(2024, 3, 16, 14, 0, 0, 0, zone_est5edt).toLocalDateTime();

        test(next_est5edt.equals(expected_est5edt),
          "Different timezones: current time between two schedules - Expected: " + expected_est5edt + ", Received: " + next_est5edt);

        // Test 3: current time is after both schedules
        now_est5edt = ZonedDateTime.of(2024, 3, 16, 15, 0, 0, 0, zone_est5edt).toLocalDateTime();
        next_utc = dateService.dateToLocalDateTime(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDateWithZone(x, now_est5edt, zone_est5edt)));
        expected_utc = ZonedDateTime.of(2024, 3, 17, 14, 0, 0, 0, zone_utc).toLocalDateTime();

        test(next_utc.equals(expected_utc),
          "Different timezones: current time after both schedules - Expected: " + expected_utc + ", Received: " + next_utc);
      `
    }
  ]
});
