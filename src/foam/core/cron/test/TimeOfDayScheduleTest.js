/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron.test',
  name: 'TimeOfDayScheduleTest',
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
        testBeforeScheduled(x);
        testAfterScheduled(x);
        testBeforeScheduledDifferentTimezones(x);
        testAfterScheduledDifferentTimezones(x);
      `
    },
    {
      name: 'testBeforeScheduled',
      args: 'X x',
      documentation: 'Test if next scheduled time is on the same day if current time is before the next scheduled time',
      javaCode: `
        // Create schedule for 1:02:03 PM
        Schedule testTOD = new TimeOfDaySchedule.Builder(x)
          .setTimeZone(ZoneId.systemDefault().getId())
          .setTime(new TimeHMS.Builder(x)
            .setHour(13)
            .setMinute(2)
            .setSecond(3)
            .build())
          .build();

        // Set current time to 1:00:00 PM
        LocalDateTime now = LocalDate.now().atTime(13, 0);

        DateService dateService = (DateService) x.get("dateService");
        LocalDateTime next = dateService.dateToLocalDateTime(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDate(x, now)));

        LocalDateTime expected = LocalDateTime.of(now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
          13, 2, 3);

        test(next.equals(expected),
          "testBeforeScheduled - Expected: " + expected + ", Received: " + next);
      `
    },
    {
      name: 'testAfterScheduled',
      documentation: 'Test if next scheduled time is on the next day if current time is after the next scheduled time',
      args: 'X x',
      javaCode: `
        // Create schedule for 1:02:03 PM
        Schedule testTOD = new TimeOfDaySchedule.Builder(x)
          .setTimeZone(ZoneId.systemDefault().getId())
          .setTime(new TimeHMS.Builder(x)
            .setHour(13)
            .setMinute(2)
            .setSecond(3)
            .build())
          .build();

        // Set current time to 2:00:00 PM
        LocalDateTime now = LocalDate.now().atTime(14, 0);

        DateService dateService = (DateService) x.get("dateService");
        LocalDateTime next = dateService.dateToLocalDateTime(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDate(x, now)));

        LocalDateTime expected = LocalDateTime.of(now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
          13, 2, 3);
        expected = expected.plusDays(1);

        test(next.equals(expected),
          "testAfterScheduled - Expected: " + expected + ", Received: " + next);
      `
    },
    {
      name: 'testBeforeScheduledDifferentTimezones',
      documentation: `
        Tests if next scheduled time is on the same day if current time is before the next scheduled time.
        The schedule has a different timezone to that of the system.
      `,
      args: 'X x',
      javaCode: `
        DateService dateService = (DateService) x.get("dateService");
        ZoneId systemZone = dateService.getTimeZoneId(x, "GMT"); //UTC
        ZoneId customZone = dateService.getTimeZoneId(x, "EST5EDT");

        // Create schedule for 1:02:03 PM in EST/EDT
        Schedule testTOD = new TimeOfDaySchedule.Builder(x)
          .setTimeZone("EST5EDT")
          .setTime(new TimeHMS.Builder(x)
            .setHour(13)
            .setMinute(2)
            .setSecond(3)
            .build())
          .build();

        // Set current time to 5:00 PM in UTC which is in EST/EDT before the next scheduled time, 1:02:03 PM in EST/EDT
        // 5:00 PM in UTC == 1:00 PM in EDT == 12:00 PM in EST
        LocalDateTime now_utc = ZonedDateTime.of(2024, 3, 16, 17, 0, 0, 0, systemZone).toLocalDateTime();

        LocalDateTime next_est5edt = dateService.dateToLocalDateTimeWithZone(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDateWithZone(x, now_utc, systemZone)), customZone);

        LocalDateTime expected_est5edt = ZonedDateTime.of(2024, 3, 16, 13, 2, 3, 0, customZone).toLocalDateTime();

        test(next_est5edt.equals(expected_est5edt),
          "testBeforeScheduledDifferentTimezones - Expected: " + expected_est5edt + ", Received: " + next_est5edt);

        /* second test start */

        // Test when date changes in different timezones

        testTOD = new TimeOfDaySchedule.Builder(x)
          .setTimeZone("EST5EDT")
          .setTime(new TimeHMS.Builder(x)
            .setHour(23)
            .build())
          .build();

        // Set current time to midnight in UTC which is in EST/EDT before the next scheduled time, 11:00 PM in EST/EDT
        // midnight in UTC == 20:00 PM in EDT (-1 day) == 19:00 PM in EST (-1 day)
        now_utc = ZonedDateTime.of(2025, 1, 1, 0, 0, 0, 0, systemZone).toLocalDateTime();

        next_est5edt = dateService.dateToLocalDateTimeWithZone(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDateWithZone(x, now_utc, systemZone)), customZone);

        expected_est5edt = ZonedDateTime.of(2024, 12, 31, 23, 0, 0, 0, customZone).toLocalDateTime();

        test(next_est5edt.equals(expected_est5edt),
          "testBeforeScheduledDifferentTimezones (date changes in two time zones) - Expected: " + expected_est5edt + ", Received: " + next_est5edt);
      `
    },
    {
      name: 'testAfterScheduledDifferentTimezones',
      documentation: `
        Tests if next scheduled time is on the next day if current time is after the next scheduled time.
        The schedule has a different timezone to that of the system.
      `,
      args: 'X x',
      javaCode: `
        DateService dateService = (DateService) x.get("dateService");
        ZoneId systemZone = dateService.getTimeZoneId(x, "GMT"); //UTC
        ZoneId customZone = dateService.getTimeZoneId(x, "EST5EDT");

        // Create schedule for 1:02:03 PM in EST/EDT
        Schedule testTOD = new TimeOfDaySchedule.Builder(x)
          .setTimeZone("EST5EDT")
          .setTime(new TimeHMS.Builder(x)
            .setHour(13)
            .setMinute(2)
            .setSecond(3)
            .build())
          .build();

        // Set current time to 7:00 PM in UTC which is in EST/EDT after the next scheduled time, 1:02:03 PM in EST/EDT
        // 7:00 PM in UTC == 3:00 PM in EDT == 2:00 pm in EST
        LocalDateTime now_utc = ZonedDateTime.of(2024, 3, 16, 19, 0, 0, 0, systemZone).toLocalDateTime();

        LocalDateTime next_est5edt = dateService.dateToLocalDateTimeWithZone(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDateWithZone(x, now_utc, systemZone)), customZone);

        LocalDateTime expected_est5edt = ZonedDateTime.of(2024, 3, 17, 13, 2, 3, 0, customZone).toLocalDateTime();

        test(next_est5edt.equals(expected_est5edt),
          "testAfterScheduledDifferentTimezones - Expected: " + expected_est5edt + ", Received: " + next_est5edt);

        /* second test start */

        // Test when date changes in different timezones

        testTOD = new TimeOfDaySchedule.Builder(x)
          .setTimeZone("EST5EDT")
          .setTime(new TimeHMS.Builder(x)
            .setHour(22)
            .build())
          .build();

        // Set current time to 3:30 AM in UTC which is in EST/EDT after the next scheduled time, 10:00 PM in EST/EDT
        // 3:30 AM in UTC == 11:30 PM in EDT (-1 day) == 10:30 PM in EST (-1 day)
        now_utc = ZonedDateTime.of(2025, 1, 1, 3, 30, 0, 0, systemZone).toLocalDateTime();

        next_est5edt = dateService.dateToLocalDateTimeWithZone(x, testTOD.getNextScheduledTime(x, dateService.localDateTimeToDateWithZone(x, now_utc, systemZone)), customZone);

        expected_est5edt = ZonedDateTime.of(2025, 1, 1, 22, 0, 0, 0, customZone).toLocalDateTime();

        test(next_est5edt.equals(expected_est5edt),
          "testAfterScheduledDifferentTimezones (date changes in two time zones) - Expected: " + expected_est5edt + ", Received: " + next_est5edt);
      `
    }
  ]
});
