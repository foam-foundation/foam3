/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron.test',
  name: 'CronScheduleTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.cron.*',
    'java.util.*',
    'java.time.*',
    'java.time.temporal.ChronoUnit'
  ],

  methods: [
    {
      name: 'runTest',

      javaCode: `
      // default cron should run every minute at the second the first
      // schedule is created
      CronSchedule sched = new CronSchedule();
      var startOfDayTime = LocalDate.ofInstant(new Date().toInstant(), ZoneOffset.UTC).atStartOfDay();
      Date startOfDayDate = Date.from(startOfDayTime.atZone(ZoneOffset.UTC).toInstant());

      Date last = sched.getNextScheduledTime(x, null);
      LocalDateTime lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      Date next = sched.getNextScheduledTime(x, last);
      LocalDateTime nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      long diff = ChronoUnit.MINUTES.between(lastTime, nextTime);
      test ( diff == 1, "Default - next minute. diff: +"+diff+" last: "+ lastTime.toString() +" next: "+nextTime.toString() );
      next = sched.getNextScheduledTime(x, next);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.MINUTES.between(lastTime, nextTime);
      test ( diff == 2, "Default - next next minute. diff: +"+diff+" last: "+ lastTime.toString() +" next: "+nextTime.toString() );


      // previous hour - should shedule next day with hours empty
      sched = new CronSchedule();
      LocalDateTime time = LocalDateTime.now();
      time = time.minusHours(1);
      sched.setHours(String.valueOf(time.getHour()));
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.DAYS.between(lastTime, nextTime);
      test ( diff == 1, "Previous hour - next day.  diff: +"+diff+" last: "+ lastTime.toString() +" next: "+nextTime.toString() );

      // hours
      sched = new CronSchedule();
      sched.setHours("23,1");
      last = sched.getNextScheduledTime(x, startOfDayDate);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.HOURS.between(startOfDayTime, lastTime);
      test ( diff == 1, "Hour {23, 1} same day. diff: "+diff+" last: "+startOfDayTime.toString()+ " next: "+lastTime.toString() );
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.HOURS.between(lastTime, nextTime);
      test ( diff == 22, "Hour {23, 1} next same day. diff: "+diff+" last: "+lastTime.toString()+ " next: "+nextTime.toString() );

      next = sched.getNextScheduledTime(x, next);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.HOURS.between(lastTime, nextTime);
      test ( diff == 24, "Hour {23, 1} next day. diff: "+diff+" last: "+lastTime.toString()+ " next: "+nextTime.toString() );

      sched = new CronSchedule();
      sched.setHour(-1);
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.HOURS.between(lastTime, nextTime);
      test ( diff == 1, "Hour (-1) - next hour. last: "+lastTime.toString() +" next: "+nextTime.toString() );
      next = sched.getNextScheduledTime(x, next);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.HOURS.between(lastTime, nextTime);
      test ( diff == 2, "Hour (-1) again - next next hour. last: "+ lastTime.toString() +" next: "+nextTime.toString() );

      // minutes
      sched = new CronSchedule();
      sched.setMinute(5);
      last = sched.getNextScheduledTime(x, null);
      CronSchedule.SECOND.clear(sched);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.HOURS.between(lastTime, nextTime);
      test ( diff == 1, "Minute - next hour. diff: "+diff+" last: "+lastTime.toString()+ " next: "+nextTime.toString() );

      sched = new CronSchedule();
      sched.setMinute(-1);
      // sched.setSecond(0);
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.MINUTES.between(lastTime, nextTime);
      test ( diff == 1, "Minute (-1) - next minute. diff: +"+diff+" last: "+ lastTime.toString() +" next: "+nextTime.toString() );
      next = sched.getNextScheduledTime(x, next);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.MINUTES.between(lastTime, nextTime);
      test ( diff == 2, "Minute (-1) again - next next minute. diff: +"+diff+" last: "+ lastTime.toString() +" next: "+nextTime.toString() );

      // seconds
      sched = new CronSchedule();
      sched.setSecond(30);
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.MINUTES.between(lastTime, nextTime);
      test ( diff == 1, "Second - next minute. last: "+ lastTime.toString() +" next: "+nextTime.toString() );

      // next called twice with same last, should give same results
      sched = new CronSchedule();
      sched.setMinute(5);
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      Date next2 = sched.getNextScheduledTime(x, last);
      LocalDateTime nextTime2 = LocalDateTime.ofInstant(next2.toInstant(), ZoneOffset.UTC);
      test ( ChronoUnit.MINUTES.between(nextTime, nextTime2) == 0, "Call twice - same result" );

      // days of month
      sched = new CronSchedule();
      sched.setDaysOfMonth(new Integer[] {15});
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      // If nextTime month changes DST/EST, then month delta will be zero as it's an hour short of a full month.
      // long diff = ChronoUnit.MONTHS.between(lastTime, nextTime);
      diff = Math.abs(nextTime.getMonthValue() - lastTime.getMonthValue());
      test ( diff == 1 || diff == 11, "DaysOfMonth - next month "+diff );

      // migration test of dayOfMonth
      sched = new CronSchedule();
      sched.setDayOfMonth(15);
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      // If nextTime month changes DST/EST, then month delta will be zero as it's an hour short of a full month.
      // long diff = ChronoUnit.MONTHS.between(lastTime, nextTime);
      diff = Math.abs(nextTime.getMonthValue() - lastTime.getMonthValue());
      test ( diff == 1 || diff == 11, "DayOfMonth (legacy) - next month "+diff );

      // days of week
      sched = new CronSchedule();
      sched.setDaysOfWeek(new foam.time.DayOfWeek[] { foam.time.DayOfWeek.values()[LocalDateTime.now().getDayOfWeek().getValue() - 1] }); // day of test run.
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.DAYS.between(lastTime, nextTime);
      test ( diff == 7, "DaysOfWeek - next week "+diff );

      // migration dayOfWeek -1 - all
      sched = new CronSchedule();
      sched.setDayOfWeek(-1);
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.DAYS.between(lastTime, nextTime);
      test ( diff == 1, "DayOfWeek (legacy -1) - next day "+diff );
      next = sched.getNextScheduledTime(x, next);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.DAYS.between(lastTime, nextTime);
      test ( diff == 2, "DayOfWeek (legacy -1) - next next day "+diff );

      // migration dayOfWeek
      sched = new CronSchedule();
      sched.setDayOfWeek(LocalDateTime.now().getDayOfWeek().getValue()); // day of test run.
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.DAYS.between(lastTime, nextTime);
      test ( diff == 7, "DayOfWeek (legacy) - next week "+diff );

      // months of year
      // legacy - monthOfYear
      sched = new CronSchedule();
      sched.setMonth(LocalDate.now().getMonth().getValue());
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.MONTHS.between(lastTime, nextTime);
      test ( diff == 12, "Month (legacy) - next month "+diff );

      // legacy - monthOfYear -1
      sched = new CronSchedule();
      sched.setMonth(-1);
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      long diffMonths = ChronoUnit.MONTHS.between(lastTime, nextTime);
      LocalDateTime nextMonth = lastTime.plusMonths(1);
      test ( nextTime.getMonthValue() == nextMonth.getMonthValue(), "Month (legacy -1) - next month 1");
      nextMonth = nextTime.plusMonths(1);
      next = sched.getNextScheduledTime(x, next);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      test ( nextTime.getMonthValue() == nextMonth.getMonthValue(), "Month (legacy -1) - next next month 2");

      sched = new CronSchedule();
      sched.setMonthsOfYear(new foam.time.MonthOfYear[] { foam.time.MonthOfYear.forOrdinal(LocalDate.now().getMonth().getValue()) });
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), ZoneOffset.UTC);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), ZoneOffset.UTC);
      diff = ChronoUnit.MONTHS.between(lastTime, nextTime);
      test ( diff == 12, "MonthsOfYear - next month "+diff+" "+lastTime+" "+nextTime );

      // TimeZone
      // Use hour 10 instead of 2 to avoid DST spring-forward gap
      // (2:00 AM doesn't exist on DST transition day in America/Toronto)
      sched = new CronSchedule();
      sched.setHours("10");
      sched.setMinute(25);
      sched.setTimeZone("America/Toronto"); // EST/EDT
      ZoneId zoneId = ZoneId.of("America/Toronto");
      last = sched.getNextScheduledTime(x, null);
      lastTime = LocalDateTime.ofInstant(last.toInstant(), zoneId);
      next = sched.getNextScheduledTime(x, last);
      nextTime = LocalDateTime.ofInstant(next.toInstant(), zoneId);
      test ( ChronoUnit.DAYS.between(lastTime, nextTime) == 1, "EST Hour/Minute - next day" );
      Calendar cal = Calendar.getInstance();
      if ( ! cal.getTimeZone().getID().equals(zoneId.getId()) ) {
        cal.setTimeZone(TimeZone.getTimeZone(zoneId));
      }
      cal.setTime(next);
      test ( cal.get(Calendar.HOUR_OF_DAY) == 10, "EST Hour 10" );
      test ( cal.get(Calendar.MINUTE) == 25, "EST Minute 25" );
      `
    }
  ]
});
