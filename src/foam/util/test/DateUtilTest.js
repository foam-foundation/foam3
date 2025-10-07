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

  documentation: 'Test DateUtil utility functions',

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DateUtilTest_parseDateString_YYYYMMDD();
        DateUtilTest_parseDateString_YYYY_MM_DD();
        DateUtilTest_parseDateString_MMDDYYYY();
        DateUtilTest_parseDateString_MM_DD_YYYY();
        DateUtilTest_parseDateString_YYMMDD();
        DateUtilTest_parseDateString_YY_MM_DD();
        DateUtilTest_parseDateString_InvalidDate();
        DateUtilTest_parseDateString_UnsupportedFormat();
        DateUtilTest_parseDateString_LeapYear();
        DateUtilTest_parseDateString_NonLeapYear();
        DateUtilTest_parseDateString_TrailingText();
        DateUtilTest_parseDateString_MonthBoundaries();
        DateUtilTest_parseDateString_YearBoundaries();
        DateUtilTest_parseDateString_FormatAmbiguity();
        DateUtilTest_parseDateString_TwoDigitYearBoundary();
        DateUtilTest_parseDateString_InvalidFormats();
        DateUtilTest_parseDateString_EmptyAndWhitespace();
        DateUtilTest_adapt_Number();
        DateUtilTest_adapt_String();
        DateUtilTest_adapt_Date();
        DateUtilTest_adapt_Null();
        DateUtilTest_adapt_InvalidString();
        DateUtilTest_adapt_EmptyString();
        DateUtilTest_adapt_WhitespaceString();
        DateUtilTest_adapt_AllFormats();
        DateUtilTest_getTimeZoneId();
        DateUtilTest_localDateToDate_1Param();
        DateUtilTest_localDateToDate_2Params();
        DateUtilTest_localDateTimeToDate_1Param();
        DateUtilTest_localDateTimeToDate_2Params();
        DateUtilTest_dateToLocalDate_1Param();
        DateUtilTest_dateToLocalDate_2Params();
        DateUtilTest_dateToLocalDateTime_1Param();
        DateUtilTest_dateToLocalDateTime_2Params();
      `
    },
    {
      name: 'DateUtilTest_parseDateString_YYYYMMDD',
      javaCode: `
        try {
          Date date = DateUtil.parseDateString("20240315");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "YYYYMMDD format - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "YYYYMMDD format - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "YYYYMMDD format - day is 15");
        } catch ( Exception e ) {
          test(false, "YYYYMMDD format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_YYYY_MM_DD',
      javaCode: `
        try {
          // Test with slash separator
          Date date1 = DateUtil.parseDateString("2024/03/15");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "YYYY/MM/DD format - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "YYYY/MM/DD format - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYY/MM/DD format - day is 15");

          // Test with dash separator
          Date date2 = DateUtil.parseDateString("2024-03-15");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 2024, "YYYY-MM-DD format - year is 2024");
          test(cal2.get(Calendar.MONTH) == 2, "YYYY-MM-DD format - month is March (2)");
          test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "YYYY-MM-DD format - day is 15");
        } catch ( Exception e ) {
          test(false, "YYYY/MM/DD or YYYY-MM-DD format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_MMDDYYYY',
      javaCode: `
        try {
          Date date = DateUtil.parseDateString("03152024");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "MMDDYYYY format - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "MMDDYYYY format - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "MMDDYYYY format - day is 15");
        } catch ( Exception e ) {
          test(false, "MMDDYYYY format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_MM_DD_YYYY',
      javaCode: `
        try {
          // Test with slash separator
          Date date1 = DateUtil.parseDateString("03/15/2024");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "MM/DD/YYYY format - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "MM/DD/YYYY format - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "MM/DD/YYYY format - day is 15");

          // Test with dash separator
          Date date2 = DateUtil.parseDateString("03-15-2024");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 2024, "MM-DD-YYYY format - year is 2024");
          test(cal2.get(Calendar.MONTH) == 2, "MM-DD-YYYY format - month is March (2)");
          test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "MM-DD-YYYY format - day is 15");
        } catch ( Exception e ) {
          test(false, "MM/DD/YYYY or MM-DD-YYYY format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_YYMMDD',
      javaCode: `
        try {
          // Test 2-digit year < 50 (assumes 2000s)
          Date date1 = DateUtil.parseDateString("240315");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "YYMMDD format (YY=24) - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "YYMMDD format (YY=24) - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYMMDD format (YY=24) - day is 15");

          // Test 2-digit year >= 50 (assumes 1900s)
          Date date2 = DateUtil.parseDateString("850315");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 1985, "YYMMDD format (YY=85) - year is 1985");
          test(cal2.get(Calendar.MONTH) == 2, "YYMMDD format (YY=85) - month is March (2)");
          test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "YYMMDD format (YY=85) - day is 15");
        } catch ( Exception e ) {
          test(false, "YYMMDD format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_YY_MM_DD',
      javaCode: `
        try {
          // Test with slash separator
          Date date1 = DateUtil.parseDateString("24/03/15");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "YY/MM/DD format - year is 2024");

          // Test with dash separator
          Date date2 = DateUtil.parseDateString("85-03-15");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 1985, "YY-MM-DD format - year is 1985");
        } catch ( Exception e ) {
          test(false, "YY/MM/DD or YY-MM-DD format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_InvalidDate',
      javaCode: `
        try {
          // Test invalid date like February 30th
          Date date = DateUtil.parseDateString("2024-02-30");
          test(false, "Invalid date (Feb 30) should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid date"), "Invalid date throws correct error message");
        } catch ( Exception e ) {
          test(false, "Invalid date should throw RuntimeException, not " + e.getClass().getSimpleName());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_UnsupportedFormat',
      javaCode: `
        try {
          Date date = DateUtil.parseDateString("March 15, 2024");
          test(false, "Unsupported format should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported Date format"), "Unsupported format throws correct error message");
        } catch ( Exception e ) {
          test(false, "Unsupported format should throw RuntimeException, not " + e.getClass().getSimpleName());
        }
      `
    },
    {
      name: 'DateUtilTest_adapt_Number',
      javaCode: `
        long timestamp = 1710489600000L; // March 15, 2024 12:00:00 GMT
        Date date = DateUtil.adapt(timestamp);

        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(date);

        test(cal.get(Calendar.YEAR) == 2024, "adapt(Number) - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "adapt(Number) - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "adapt(Number) - day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 12, "adapt(Number) - hour is 12 (noon GMT)");
        test(cal.get(Calendar.MINUTE) == 0, "adapt(Number) - minute is 0");
        test(cal.get(Calendar.SECOND) == 0, "adapt(Number) - second is 0");
      `
    },
    {
      name: 'DateUtilTest_adapt_String',
      javaCode: `
        Date date = DateUtil.adapt("2024-03-15");

        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(date);

        test(cal.get(Calendar.YEAR) == 2024, "adapt(String) - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "adapt(String) - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "adapt(String) - day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 12, "adapt(String) - hour is 12 (noon GMT)");
      `
    },
    {
      name: 'DateUtilTest_adapt_Date',
      javaCode: `
        Calendar inputCal = Calendar.getInstance();
        inputCal.set(2024, 2, 15, 8, 30, 45); // March 15, 2024 08:30:45
        Date inputDate = inputCal.getTime();

        Date adaptedDate = DateUtil.adapt(inputDate);

        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(adaptedDate);

        test(cal.get(Calendar.YEAR) == 2024, "adapt(Date) - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "adapt(Date) - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "adapt(Date) - day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 12, "adapt(Date) - hour normalized to 12 (noon GMT)");
        test(cal.get(Calendar.MINUTE) == 0, "adapt(Date) - minute normalized to 0");
        test(cal.get(Calendar.SECOND) == 0, "adapt(Date) - second normalized to 0");
      `
    },
    {
      name: 'DateUtilTest_adapt_Null',
      javaCode: `
        Date date = DateUtil.adapt(null);
        test(date == null, "adapt(null) returns null");
      `
    },
    {
      name: 'DateUtilTest_adapt_InvalidString',
      javaCode: `
        Date date = DateUtil.adapt("invalid date string");
        test(date == DateUtil.MAX_DATE, "adapt(invalid string) returns MAX_DATE");
      `
    },
    {
      name: 'DateUtilTest_getTimeZoneId',
      javaCode: `
        // Test with null/empty string (should return system default)
        ZoneId zone1 = DateUtil.getTimeZoneId(getX(), null);
        test(zone1 != null, "getTimeZoneId(null) returns non-null zone");

        ZoneId zone2 = DateUtil.getTimeZoneId(getX(), "");
        test(zone2 != null, "getTimeZoneId(\\"\\") returns non-null zone");

        // Note: Testing with actual timezone requires timeZoneDAO to be set up in context
        // which is typically done in integration tests, not unit tests
      `
    },
    {
      name: 'DateUtilTest_localDateToDate_1Param',
      javaCode: `
        LocalDate localDate = LocalDate.of(2024, 3, 15);
        Date date = DateUtil.localDateToDate(localDate);

        Calendar cal = Calendar.getInstance();
        cal.setTime(date);

        test(cal.get(Calendar.YEAR) == 2024, "localDateToDate(LocalDate) - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "localDateToDate(LocalDate) - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "localDateToDate(LocalDate) - day is 15");
      `
    },
    {
      name: 'DateUtilTest_localDateToDate_2Params',
      javaCode: `
        LocalDate localDate = LocalDate.of(2024, 3, 15);
        ZoneId zone = ZoneId.of("America/New_York");
        Date date = DateUtil.localDateToDate(localDate, zone);

        test(date != null, "localDateToDate(LocalDate, ZoneId) returns non-null date");

        // Test with null zone (should delegate to 1-param version)
        Date date2 = DateUtil.localDateToDate(localDate, null);
        test(date2 != null, "localDateToDate(LocalDate, null) returns non-null date");
      `
    },
    {
      name: 'DateUtilTest_localDateTimeToDate_1Param',
      javaCode: `
        LocalDateTime localDateTime = LocalDateTime.of(2024, 3, 15, 14, 30, 0);
        Date date = DateUtil.localDateTimeToDate(localDateTime);

        Calendar cal = Calendar.getInstance();
        cal.setTime(date);

        test(cal.get(Calendar.YEAR) == 2024, "localDateTimeToDate(LocalDateTime) - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "localDateTimeToDate(LocalDateTime) - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "localDateTimeToDate(LocalDateTime) - day is 15");
      `
    },
    {
      name: 'DateUtilTest_localDateTimeToDate_2Params',
      javaCode: `
        LocalDateTime localDateTime = LocalDateTime.of(2024, 3, 15, 14, 30, 0);
        ZoneId zone = ZoneId.of("America/New_York");
        Date date = DateUtil.localDateTimeToDate(localDateTime, zone);

        test(date != null, "localDateTimeToDate(LocalDateTime, ZoneId) returns non-null date");

        // Test with null zone
        Date date2 = DateUtil.localDateTimeToDate(localDateTime, null);
        test(date2 != null, "localDateTimeToDate(LocalDateTime, null) returns non-null date");
      `
    },
    {
      name: 'DateUtilTest_dateToLocalDate_1Param',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.set(2024, 2, 15, 14, 30, 45); // March 15, 2024 14:30:45
        Date date = cal.getTime();

        LocalDate localDate = DateUtil.dateToLocalDate(date);

        test(localDate.getYear() == 2024, "dateToLocalDate(Date) - year is 2024");
        test(localDate.getMonthValue() == 3, "dateToLocalDate(Date) - month is 3 (March)");
        test(localDate.getDayOfMonth() == 15, "dateToLocalDate(Date) - day is 15");
      `
    },
    {
      name: 'DateUtilTest_dateToLocalDate_2Params',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.set(2024, 2, 15, 14, 30, 45);
        Date date = cal.getTime();

        ZoneId zone = ZoneId.of("America/New_York");
        LocalDate localDate = DateUtil.dateToLocalDate(date, zone);

        test(localDate != null, "dateToLocalDate(Date, ZoneId) returns non-null LocalDate");

        // Test with null zone
        LocalDate localDate2 = DateUtil.dateToLocalDate(date, null);
        test(localDate2 != null, "dateToLocalDate(Date, null) returns non-null LocalDate");
      `
    },
    {
      name: 'DateUtilTest_dateToLocalDateTime_1Param',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.set(2024, 2, 15, 14, 30, 45);
        Date date = cal.getTime();

        LocalDateTime localDateTime = DateUtil.dateToLocalDateTime(date);

        test(localDateTime.getYear() == 2024, "dateToLocalDateTime(Date) - year is 2024");
        test(localDateTime.getMonthValue() == 3, "dateToLocalDateTime(Date) - month is 3 (March)");
        test(localDateTime.getDayOfMonth() == 15, "dateToLocalDateTime(Date) - day is 15");
      `
    },
    {
      name: 'DateUtilTest_dateToLocalDateTime_2Params',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.set(2024, 2, 15, 14, 30, 45);
        Date date = cal.getTime();

        ZoneId zone = ZoneId.of("America/New_York");
        LocalDateTime localDateTime = DateUtil.dateToLocalDateTime(date, zone);

        test(localDateTime != null, "dateToLocalDateTime(Date, ZoneId) returns non-null LocalDateTime");

        // Test with null zone
        LocalDateTime localDateTime2 = DateUtil.dateToLocalDateTime(date, null);
        test(localDateTime2 != null, "dateToLocalDateTime(Date, null) returns non-null LocalDateTime");
      `
    },
    {
      name: 'DateUtilTest_parseDateString_LeapYear',
      javaCode: `
        try {
          // Test valid leap year date
          Date date = DateUtil.parseDateString("2024-02-29");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "Leap year - Feb 29, 2024 is valid");
          test(cal.get(Calendar.MONTH) == 1, "Leap year - month is February (1)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 29, "Leap year - day is 29");
        } catch ( Exception e ) {
          test(false, "Leap year Feb 29 should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_NonLeapYear',
      javaCode: `
        try {
          // Test invalid Feb 29 in non-leap year
          Date date = DateUtil.parseDateString("2023-02-29");
          test(false, "Non-leap year - Feb 29, 2023 should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid date"), "Non-leap year Feb 29 throws error");
        } catch ( Exception e ) {
          test(false, "Non-leap year should throw RuntimeException: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_TrailingText',
      javaCode: `
        try {
          // Test dates with trailing text (regex allows .* at end)
          Date date1 = DateUtil.parseDateString("2024-03-15 extra text here");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "Trailing text - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "Trailing text - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "Trailing text - day is 15");

          Date date2 = DateUtil.parseDateString("20240315T12:00:00");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 2024, "Trailing ISO time - year is 2024");
          test(cal2.get(Calendar.MONTH) == 2, "Trailing ISO time - month is March (2)");
          test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "Trailing ISO time - day is 15");
        } catch ( Exception e ) {
          test(false, "Trailing text should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_MonthBoundaries',
      javaCode: `
        try {
          // Test last day of various months
          Date jan31 = DateUtil.parseDateString("2024-01-31");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(jan31);
          test(cal1.get(Calendar.DAY_OF_MONTH) == 31, "Jan has 31 days");

          Date apr30 = DateUtil.parseDateString("2024-04-30");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(apr30);
          test(cal2.get(Calendar.DAY_OF_MONTH) == 30, "Apr has 30 days");
        } catch ( Exception e ) {
          test(false, "Valid month boundaries should not throw exception: " + e.getMessage());
        }

        // Test invalid dates
        try {
          DateUtil.parseDateString("2024-04-31");
          test(false, "Apr 31 should throw exception");
        } catch ( RuntimeException e ) {
          test(true, "Apr 31 is invalid");
        }

        try {
          DateUtil.parseDateString("2024-02-31");
          test(false, "Feb 31 should throw exception");
        } catch ( RuntimeException e ) {
          test(true, "Feb 31 is invalid");
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_YearBoundaries',
      javaCode: `
        try {
          // Test minimum 4-digit year (1000)
          Date date1 = DateUtil.parseDateString("1000-01-01");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 1000, "Year 1000 is valid");

          // Test maximum reasonable 4-digit year
          Date date2 = DateUtil.parseDateString("9999-12-31");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 9999, "Year 9999 is valid");

          // Test year starting with 0 doesn't match YYYYMMDD pattern
          Date date3 = DateUtil.parseDateString("01012024");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(date3);
          test(cal3.get(Calendar.YEAR) == 2024, "Year starting with 0 - parsed as MMDDYYYY");
          test(cal3.get(Calendar.MONTH) == 0, "Year starting with 0 - month is January (0)");
          test(cal3.get(Calendar.DAY_OF_MONTH) == 1, "Year starting with 0 - day is 1");
        } catch ( Exception e ) {
          test(false, "Year boundaries should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_FormatAmbiguity',
      javaCode: `
        try {
          // Test that format priority is correct for ambiguous 8-digit strings
          Date date1 = DateUtil.parseDateString("20240315");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "Ambiguous 8-digit - 20240315 is YYYYMMDD");
          test(cal1.get(Calendar.MONTH) == 2, "Ambiguous 8-digit - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "Ambiguous 8-digit - day is 15");

          Date date2 = DateUtil.parseDateString("03152024");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 2024, "Ambiguous 8-digit - 03152024 is MMDDYYYY");
          test(cal2.get(Calendar.MONTH) == 2, "Ambiguous 8-digit - month is March (2)");
          test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "Ambiguous 8-digit - day is 15");

          Date date3 = DateUtil.parseDateString("10012024");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(date3);
          test(cal3.get(Calendar.YEAR) == 2024, "Ambiguous 8-digit - 10012024 is MMDDYYYY");
          test(cal3.get(Calendar.MONTH) == 9, "Ambiguous 8-digit - month is October (9)");
          test(cal3.get(Calendar.DAY_OF_MONTH) == 1, "Ambiguous 8-digit - day is 1");

          Date date4 = DateUtil.parseDateString("01102024");
          Calendar cal4 = Calendar.getInstance();
          cal4.setTime(date4);
          test(cal4.get(Calendar.YEAR) == 2024, "Ambiguous 8-digit - 01102024 is MMDDYYYY");
          test(cal4.get(Calendar.MONTH) == 0, "Ambiguous 8-digit - month is January (0)");
          test(cal4.get(Calendar.DAY_OF_MONTH) == 10, "Ambiguous 8-digit - day is 10");
        } catch ( Exception e ) {
          test(false, "Format ambiguity tests should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_TwoDigitYearBoundary',
      javaCode: `
        try {
          // Test 2-digit year < 50 becomes 2000s
          Date date1 = DateUtil.parseDateString("49-12-31");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2049, "2-digit year 49 becomes 2049");

          Date date2 = DateUtil.parseDateString("00-01-01");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 2000, "2-digit year 00 becomes 2000");

          // Test 2-digit year >= 50 becomes 1900s
          Date date3 = DateUtil.parseDateString("50-01-01");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(date3);
          test(cal3.get(Calendar.YEAR) == 1950, "2-digit year 50 becomes 1950");

          Date date4 = DateUtil.parseDateString("99-12-31");
          Calendar cal4 = Calendar.getInstance();
          cal4.setTime(date4);
          test(cal4.get(Calendar.YEAR) == 1999, "2-digit year 99 becomes 1999");
        } catch ( Exception e ) {
          test(false, "2-digit year boundary tests should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_InvalidFormats',
      javaCode: `
        // Test various invalid formats (don't match any pattern)
        String[] unsupportedFormats = {
          "2024.03.15",      // dots instead of dashes/slashes
          "2024,03,15",      // commas
          "2024/3/15",       // single digit month
          "2024/03/5",       // single digit day
          "24-3-15",         // single digits in YY-MM-DD
          "2024-3",          // incomplete date
          "2024",            // year only
          "03/2024",         // month/year only
          "abc123",          // random text
          "12345678901"      // too many digits
        };

        for ( String format : unsupportedFormats ) {
          try {
            DateUtil.parseDateString(format);
            test(false, "Unsupported format \\"" + format + "\\" should throw exception");
          } catch ( RuntimeException e ) {
            test(e.getMessage().contains("Unsupported Date format"), "Format \\"" + format + "\\" throws \\"Unsupported Date format\\"");
          }
        }

        // Test formats that match a pattern but have invalid date values
        String[] invalidDates = {
          "15-03-2024",      // DD-MM-YYYY looks like MM-DD-YYYY with month=15 (invalid)
          "13-32-2024",      // month=13, day=32 (both invalid)
          "00-01-2024",      // month=00 (invalid)
          "01-00-2024"       // day=00 (invalid)
        };

        for ( String format : invalidDates ) {
          try {
            DateUtil.parseDateString(format);
            test(false, "Invalid date \\"" + format + "\\" should throw exception");
          } catch ( RuntimeException e ) {
            test(e.getMessage().contains("Cannot parse invalid date"), "Date \\"" + format + "\\" throws \\"Cannot parse invalid date\\"");
          }
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_EmptyAndWhitespace',
      javaCode: `
        try {
          DateUtil.parseDateString("");
          test(false, "Empty string should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported Date format"), "Empty string throws error");
        }

        try {
          DateUtil.parseDateString("   ");
          test(false, "Whitespace string should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported Date format"), "Whitespace throws error");
        }
      `
    },
    {
      name: 'DateUtilTest_adapt_EmptyString',
      javaCode: `
        Date date = DateUtil.adapt("");
        test(date == DateUtil.MAX_DATE, "adapt(empty string) returns MAX_DATE");
      `
    },
    {
      name: 'DateUtilTest_adapt_WhitespaceString',
      javaCode: `
        Date date = DateUtil.adapt("   ");
        test(date == DateUtil.MAX_DATE, "adapt(whitespace) returns MAX_DATE");
      `
    },
    {
      name: 'DateUtilTest_adapt_AllFormats',
      javaCode: `
        String[] formats = {
          "2024-03-15",
          "2024/03/15",
          "20240315",
          "03-15-2024",
          "03/15/2024",
          "03152024",
          "24-03-15",
          "24/03/15",
          "240315"
        };

        for ( String format : formats ) {
          Date date = DateUtil.adapt(format);
          Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "adapt(\\"" + format + "\\") - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "adapt(\\"" + format + "\\") - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "adapt(\\"" + format + "\\") - day is 15");
          test(cal.get(Calendar.HOUR_OF_DAY) == 12, "adapt(\\"" + format + "\\") - normalized to noon GMT");
        }
      `
    }
  ]
});
