/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron.test',
  name: 'IntervalScheduleTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.cron.*',
    'java.time.LocalDateTime',
    'java.time.ZoneId',
    'static java.time.temporal.ChronoUnit.DAYS',
    'static java.time.temporal.ChronoUnit.SECONDS',
    'java.util.Calendar',
    'java.util.Date'
  ],

  methods: [
    {
      name: 'runTest',

      javaCode: `
      Calendar now  = Calendar.getInstance();
      now.set(Calendar.MILLISECOND, 0);

      Calendar next = Calendar.getInstance();
      Calendar future = Calendar.getInstance();
      future.add(Calendar.MINUTE, 1);
      IntervalSchedule testInterval = new IntervalSchedule.Builder(x)
        .setStart(future.getTime())
        .setDuration(new TimeHMS.Builder(x)
          .setHour(0)
          .setMinute(0)
          .setSecond(3)
          .build())
        .build();

      // TEST: start time should be the first scheduled time
      next.setTime(testInterval.getNextScheduledTime(x, now.getTime()));
      test(future.getTime().equals(next.getTime()),
        "First scheduled time for IntervalSchedule is start time"
      );

      // TEST: next time should be 3 seconds later
      // clear start time - interval schedule smallest unit is seconds
      // and this test can run in the same millisecond
      testInterval.setStart(null);
      Date date = testInterval.getNextScheduledTime(x, next.getTime());
      long seconds = SECONDS.between(next.getTime().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),date.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime());
      test( seconds == 3, "Next interval is duration seconds later. next: " + next.getTime().getTime()+", date: "+date.getTime()+", seconds: "+seconds);

      // Duration 0, 0, 0 - will roll day
      testInterval = new IntervalSchedule.Builder(x)
        .setDuration(new TimeHMS.Builder(x)
          .setHour(0)
          .setMinute(0)
          .setSecond(0)
          .build())
        .build();
      Date first = testInterval.getNextScheduledTime(x, now.getTime());
      Date second = testInterval.getNextScheduledTime(x, first);
      long days = DAYS.between(first.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),second.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime());
      test(days == 1, "Zero duration rolls date. first: " + first.toString()+", second: "+second.toString()+", days: "+days);
      `
    }
  ]
});
