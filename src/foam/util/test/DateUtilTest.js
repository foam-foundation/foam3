/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'DateUtilTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.util.DateUtil',
    'java.time.LocalDate',
    'java.time.LocalDateTime',
    'java.time.ZoneId',
    'java.util.Calendar',
    'java.util.Date',
    'java.util.TimeZone'
  ],

  documentation: 'Tests for DateUtil backward compatibility wrapper',

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DateUtilTest_parseDateString();
        DateUtilTest_adapt();
        DateUtilTest_maxDate();
        DateUtilTest_localDateConversion();
      `
    },
    {
      name: 'DateUtilTest_parseDateString',
      javaCode: `
        try {
          // Test that DateUtil.parseDateString delegates to DateService
          Date date = DateUtil.parseDateString("2024-03-15");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "DateUtil.parseDateString - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "DateUtil.parseDateString - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "DateUtil.parseDateString - day is 15");
        } catch ( Exception e ) {
          test(false, "DateUtil.parseDateString should not throw: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_adapt',
      javaCode: `
        // Test that DateUtil.adapt delegates to DateService
        Date date = DateUtil.adapt("2024-03-15");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(date);

        test(cal.get(Calendar.YEAR) == 2024, "DateUtil.adapt - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "DateUtil.adapt - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "DateUtil.adapt - day is 15");

        // Test adapt with number
        long timestamp = 1710489600000L;
        Date dateFromNum = DateUtil.adapt(timestamp);
        test(dateFromNum != null, "DateUtil.adapt(number) returns date");
      `
    },
    {
      name: 'DateUtilTest_maxDate',
      javaCode: `
        // Test MAX_DATE constant is available
        Date maxDate = DateUtil.MAX_DATE;
        test(maxDate != null, "DateUtil.MAX_DATE is available");
      `
    },
    {
      name: 'DateUtilTest_localDateConversion',
      javaCode: `
        // Test LocalDate conversions delegate properly
        LocalDate localDate = LocalDate.of(2024, 3, 15);
        Date date = DateUtil.localDateToDate(localDate);
        test(date != null, "DateUtil.localDateToDate works");

        // Test with ZoneId
        ZoneId zone = ZoneId.of("America/New_York");
        Date dateWithZone = DateUtil.localDateToDate(localDate, zone);
        test(dateWithZone != null, "DateUtil.localDateToDate with zone works");

        // Test reverse conversion
        LocalDate convertedBack = DateUtil.dateToLocalDate(date);
        test(convertedBack != null, "DateUtil.dateToLocalDate works");
        test(convertedBack.getYear() == 2024, "DateUtil.dateToLocalDate - year matches");
      `
    }
  ]
});
