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
        DateUtilTest_parseDateTimeUTC_ISO8601();
        DateUtilTest_parseDateTimeUTC_ISO8601WithSpace();
        DateUtilTest_parseDateTimeUTC_WithMilliseconds();
        DateUtilTest_parseDateTimeUTC_USFormat();
        DateUtilTest_parseDateTimeUTC_Compact();
        DateUtilTest_parseDateTime_LocalTime_ISO8601();
        DateUtilTest_parseDateTime_LocalTime_USFormat();
        DateUtilTest_parseDateTime_LocalTime_Compact();
        DateUtilTest_parseDateTime_InvalidFormats();
        DateUtilTest_format_DateOnly();
        DateUtilTest_format_WithTime();
        DateUtilTest_format_UTC();
        DateUtilTest_parseDateTimeUTC_WithTimezoneZ();
        DateUtilTest_parseDateTimeUTC_WithPositiveOffset();
        DateUtilTest_parseDateTimeUTC_WithNegativeOffset();
        DateUtilTest_parseDateTimeUTC_TimezoneFormats();
        DateUtilTest_parseDateTime_WithTimezone();
      `
    },
    {
      name: 'DateUtilTest_parseDateString_YYYYMMDD',
      javaCode: `
        try {
          Date date = DateUtil.parseDateString("20240315");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          int actualYear = cal.get(Calendar.YEAR);
          test(actualYear == 2024, "YYYYMMDD format - year is 2024 (expected 2024, got " + actualYear + ")");
          int actualMonth = cal.get(Calendar.MONTH);
          test(actualMonth == 2, "YYYYMMDD format - month is March (2) (expected 2, got " + actualMonth + ")");
          int actualDay = cal.get(Calendar.DAY_OF_MONTH);
          test(actualDay == 15, "YYYYMMDD format - day is 15 (expected 15, got " + actualDay + ")");
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
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 2024, "YYYY/MM/DD format - year is 2024 (expected 2024, got " + actualYear1 + ")");
          int actualMonth1 = cal1.get(Calendar.MONTH);
          test(actualMonth1 == 2, "YYYY/MM/DD format - month is March (2) (expected 2, got " + actualMonth1 + ")");
          int actualDay1 = cal1.get(Calendar.DAY_OF_MONTH);
          test(actualDay1 == 15, "YYYY/MM/DD format - day is 15 (expected 15, got " + actualDay1 + ")");

          // Test with dash separator
          Date date2 = DateUtil.parseDateString("2024-03-15");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          int actualYear2 = cal2.get(Calendar.YEAR);
          test(actualYear2 == 2024, "YYYY-MM-DD format - year is 2024 (expected 2024, got " + actualYear2 + ")");
          int actualMonth2 = cal2.get(Calendar.MONTH);
          test(actualMonth2 == 2, "YYYY-MM-DD format - month is March (2) (expected 2, got " + actualMonth2 + ")");
          int actualDay2 = cal2.get(Calendar.DAY_OF_MONTH);
          test(actualDay2 == 15, "YYYY-MM-DD format - day is 15 (expected 15, got " + actualDay2 + ")");
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
          int actualYear = cal.get(Calendar.YEAR);
          test(actualYear == 2024, "MMDDYYYY format - year is 2024 (expected 2024, got " + actualYear + ")");
          int actualMonth = cal.get(Calendar.MONTH);
          test(actualMonth == 2, "MMDDYYYY format - month is March (2) (expected 2, got " + actualMonth + ")");
          int actualDay = cal.get(Calendar.DAY_OF_MONTH);
          test(actualDay == 15, "MMDDYYYY format - day is 15 (expected 15, got " + actualDay + ")");
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
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 2024, "MM/DD/YYYY format - year is 2024 (expected 2024, got " + actualYear1 + ")");
          int actualMonth1 = cal1.get(Calendar.MONTH);
          test(actualMonth1 == 2, "MM/DD/YYYY format - month is March (2) (expected 2, got " + actualMonth1 + ")");
          int actualDay1 = cal1.get(Calendar.DAY_OF_MONTH);
          test(actualDay1 == 15, "MM/DD/YYYY format - day is 15 (expected 15, got " + actualDay1 + ")");

          // Test with dash separator
          Date date2 = DateUtil.parseDateString("03-15-2024");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          int actualYear2 = cal2.get(Calendar.YEAR);
          test(actualYear2 == 2024, "MM-DD-YYYY format - year is 2024 (expected 2024, got " + actualYear2 + ")");
          int actualMonth2 = cal2.get(Calendar.MONTH);
          test(actualMonth2 == 2, "MM-DD-YYYY format - month is March (2) (expected 2, got " + actualMonth2 + ")");
          int actualDay2 = cal2.get(Calendar.DAY_OF_MONTH);
          test(actualDay2 == 15, "MM-DD-YYYY format - day is 15 (expected 15, got " + actualDay2 + ")");
        } catch ( Exception e ) {
          test(false, "MM/DD/YYYY or MM-DD-YYYY format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_YYMMDD',
      javaCode: `
        try {
          // Test 2-digit year using sliding window (50 years back, 50 years forward from current year)
          Calendar currentCal = Calendar.getInstance();
          int currentYear = currentCal.get(Calendar.YEAR);

          // Test with year 24 (should be 2024 if current year is between 1974-2074)
          Date date1 = DateUtil.parseDateString("240315");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 2024, "YYMMDD format (YY=24) - year is 2024 (expected 2024, got " + actualYear1 + ")");
          int actualMonth1 = cal1.get(Calendar.MONTH);
          test(actualMonth1 == 2, "YYMMDD format (YY=24) - month is March (2) (expected 2, got " + actualMonth1 + ")");
          int actualDay1 = cal1.get(Calendar.DAY_OF_MONTH);
          test(actualDay1 == 15, "YYMMDD format (YY=24) - day is 15 (expected 15, got " + actualDay1 + ")");

          // Test with year 85 - sliding window interpretation
          Date date2 = DateUtil.parseDateString("850315");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          int actualYear2 = cal2.get(Calendar.YEAR);

          // Calculate expected year for 85 using sliding window
          int currentCentury = (currentYear / 100) * 100;
          int expectedYear85 = currentCentury + 85;
          if ( expectedYear85 > currentYear + 50 ) {
            expectedYear85 = currentCentury - 100 + 85;
          }

          test(actualYear2 == expectedYear85, "YYMMDD format (YY=85) - year is " + expectedYear85 + " (expected " + expectedYear85 + ", got " + actualYear2 + ")");
          int actualMonth2 = cal2.get(Calendar.MONTH);
          test(actualMonth2 == 2, "YYMMDD format (YY=85) - month is March (2) (expected 2, got " + actualMonth2 + ")");
          int actualDay2 = cal2.get(Calendar.DAY_OF_MONTH);
          test(actualDay2 == 15, "YYMMDD format (YY=85) - day is 15 (expected 15, got " + actualDay2 + ")");
        } catch ( Exception e ) {
          test(false, "YYMMDD format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_YY_MM_DD',
      javaCode: `
        try {
          Calendar currentCal = Calendar.getInstance();
          int currentYear = currentCal.get(Calendar.YEAR);

          // Test with slash separator
          Date date1 = DateUtil.parseDateString("24/03/15");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 2024, "YY/MM/DD format - year is 2024 (expected 2024, got " + actualYear1 + ")");

          // Test with dash separator - sliding window interpretation
          Date date2 = DateUtil.parseDateString("85-03-15");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          int actualYear2 = cal2.get(Calendar.YEAR);

          int currentCentury = (currentYear / 100) * 100;
          int expectedYear85 = currentCentury + 85;
          if ( expectedYear85 > currentYear + 50 ) {
            expectedYear85 = currentCentury - 100 + 85;
          }

          test(actualYear2 == expectedYear85, "YY-MM-DD format - year is " + expectedYear85 + " (expected " + expectedYear85 + ", got " + actualYear2 + ")");
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
        long timestamp = 1710504000000L; // March 15, 2024 12:00:00 GMT
        Date date = DateUtil.adapt(timestamp);

        Calendar cal = Calendar.getInstance();
        cal.setTimeZone(TimeZone.getTimeZone("GMT"));
        cal.setTime(date);

        int actualYear = cal.get(Calendar.YEAR);
        test(actualYear == 2024, "adapt(Number) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = cal.get(Calendar.MONTH);
        test(actualMonth == 2, "adapt(Number) - month is March (2) (expected 2, got " + actualMonth + ")");
        int actualDay = cal.get(Calendar.DAY_OF_MONTH);
        test(actualDay == 15, "adapt(Number) - day is 15 (expected 15, got " + actualDay + ")");
        int actualHour = cal.get(Calendar.HOUR_OF_DAY);
        test(actualHour == 12, "adapt(Number) - hour is 12 (noon GMT) (expected 12, got " + actualHour + ")");
        int actualMinute = cal.get(Calendar.MINUTE);
        test(actualMinute == 0, "adapt(Number) - minute is 0 (expected 0, got " + actualMinute + ")");
        int actualSecond = cal.get(Calendar.SECOND);
        test(actualSecond == 0, "adapt(Number) - second is 0 (expected 0, got " + actualSecond + ")");
      `
    },
    {
      name: 'DateUtilTest_adapt_String',
      javaCode: `
        Date date = DateUtil.adapt("2024-03-15");

        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(date);

        int actualYear = cal.get(Calendar.YEAR);
        test(actualYear == 2024, "adapt(String) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = cal.get(Calendar.MONTH);
        test(actualMonth == 2, "adapt(String) - month is March (2) (expected 2, got " + actualMonth + ")");
        int actualDay = cal.get(Calendar.DAY_OF_MONTH);
        test(actualDay == 15, "adapt(String) - day is 15 (expected 15, got " + actualDay + ")");
        int actualHour = cal.get(Calendar.HOUR_OF_DAY);
        test(actualHour == 12, "adapt(String) - hour is 12 (noon GMT) (expected 12, got " + actualHour + ")");
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

        int actualYear = cal.get(Calendar.YEAR);
        test(actualYear == 2024, "adapt(Date) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = cal.get(Calendar.MONTH);
        test(actualMonth == 2, "adapt(Date) - month is March (2) (expected 2, got " + actualMonth + ")");
        int actualDay = cal.get(Calendar.DAY_OF_MONTH);
        test(actualDay == 15, "adapt(Date) - day is 15 (expected 15, got " + actualDay + ")");
        int actualHour = cal.get(Calendar.HOUR_OF_DAY);
        test(actualHour == 12, "adapt(Date) - hour normalized to 12 (noon GMT) (expected 12, got " + actualHour + ")");
        int actualMinute = cal.get(Calendar.MINUTE);
        test(actualMinute == 0, "adapt(Date) - minute normalized to 0 (expected 0, got " + actualMinute + ")");
        int actualSecond = cal.get(Calendar.SECOND);
        test(actualSecond == 0, "adapt(Date) - second normalized to 0 (expected 0, got " + actualSecond + ")");
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

        int actualYear = cal.get(Calendar.YEAR);
        test(actualYear == 2024, "localDateToDate(LocalDate) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = cal.get(Calendar.MONTH);
        test(actualMonth == 2, "localDateToDate(LocalDate) - month is March (2) (expected 2, got " + actualMonth + ")");
        int actualDay = cal.get(Calendar.DAY_OF_MONTH);
        test(actualDay == 15, "localDateToDate(LocalDate) - day is 15 (expected 15, got " + actualDay + ")");
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

        int actualYear = cal.get(Calendar.YEAR);
        test(actualYear == 2024, "localDateTimeToDate(LocalDateTime) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = cal.get(Calendar.MONTH);
        test(actualMonth == 2, "localDateTimeToDate(LocalDateTime) - month is March (2) (expected 2, got " + actualMonth + ")");
        int actualDay = cal.get(Calendar.DAY_OF_MONTH);
        test(actualDay == 15, "localDateTimeToDate(LocalDateTime) - day is 15 (expected 15, got " + actualDay + ")");
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

        int actualYear = localDate.getYear();
        test(actualYear == 2024, "dateToLocalDate(Date) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = localDate.getMonthValue();
        test(actualMonth == 3, "dateToLocalDate(Date) - month is 3 (March) (expected 3, got " + actualMonth + ")");
        int actualDay = localDate.getDayOfMonth();
        test(actualDay == 15, "dateToLocalDate(Date) - day is 15 (expected 15, got " + actualDay + ")");
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

        int actualYear = localDateTime.getYear();
        test(actualYear == 2024, "dateToLocalDateTime(Date) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = localDateTime.getMonthValue();
        test(actualMonth == 3, "dateToLocalDateTime(Date) - month is 3 (March) (expected 3, got " + actualMonth + ")");
        int actualDay = localDateTime.getDayOfMonth();
        test(actualDay == 15, "dateToLocalDateTime(Date) - day is 15 (expected 15, got " + actualDay + ")");
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
          int actualYear = cal.get(Calendar.YEAR);
          test(actualYear == 2024, "Leap year - Feb 29, 2024 is valid (expected 2024, got " + actualYear + ")");
          int actualMonth = cal.get(Calendar.MONTH);
          test(actualMonth == 1, "Leap year - month is February (1) (expected 1, got " + actualMonth + ")");
          int actualDay = cal.get(Calendar.DAY_OF_MONTH);
          test(actualDay == 29, "Leap year - day is 29 (expected 29, got " + actualDay + ")");
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
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 2024, "Trailing text - year is 2024 (expected 2024, got " + actualYear1 + ")");
          int actualMonth1 = cal1.get(Calendar.MONTH);
          test(actualMonth1 == 2, "Trailing text - month is March (2) (expected 2, got " + actualMonth1 + ")");
          int actualDay1 = cal1.get(Calendar.DAY_OF_MONTH);
          test(actualDay1 == 15, "Trailing text - day is 15 (expected 15, got " + actualDay1 + ")");

          Date date2 = DateUtil.parseDateString("20240315T12:00:00");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          int actualYear2 = cal2.get(Calendar.YEAR);
          test(actualYear2 == 2024, "Trailing ISO time - year is 2024 (expected 2024, got " + actualYear2 + ")");
          int actualMonth2 = cal2.get(Calendar.MONTH);
          test(actualMonth2 == 2, "Trailing ISO time - month is March (2) (expected 2, got " + actualMonth2 + ")");
          int actualDay2 = cal2.get(Calendar.DAY_OF_MONTH);
          test(actualDay2 == 15, "Trailing ISO time - day is 15 (expected 15, got " + actualDay2 + ")");
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
          int actualDay1 = cal1.get(Calendar.DAY_OF_MONTH);
          test(actualDay1 == 31, "Jan has 31 days (expected 31, got " + actualDay1 + ")");

          Date apr30 = DateUtil.parseDateString("2024-04-30");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(apr30);
          int actualDay2 = cal2.get(Calendar.DAY_OF_MONTH);
          test(actualDay2 == 30, "Apr has 30 days (expected 30, got " + actualDay2 + ")");
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
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 1000, "Year 1000 is valid (expected 1000, got " + actualYear1 + ")");

          // Test maximum reasonable 4-digit year
          Date date2 = DateUtil.parseDateString("9999-12-31");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          int actualYear2 = cal2.get(Calendar.YEAR);
          test(actualYear2 == 9999, "Year 9999 is valid (expected 9999, got " + actualYear2 + ")");

          // Test year starting with 0 doesn't match YYYYMMDD pattern
          Date date3 = DateUtil.parseDateString("01012024");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(date3);
          int actualYear3 = cal3.get(Calendar.YEAR);
          test(actualYear3 == 2024, "Year starting with 0 - parsed as MMDDYYYY (expected 2024, got " + actualYear3 + ")");
          int actualMonth3 = cal3.get(Calendar.MONTH);
          test(actualMonth3 == 0, "Year starting with 0 - month is January (0) (expected 0, got " + actualMonth3 + ")");
          int actualDay3 = cal3.get(Calendar.DAY_OF_MONTH);
          test(actualDay3 == 1, "Year starting with 0 - day is 1 (expected 1, got " + actualDay3 + ")");
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
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 2024, "Ambiguous 8-digit - 20240315 is YYYYMMDD (expected 2024, got " + actualYear1 + ")");
          int actualMonth1 = cal1.get(Calendar.MONTH);
          test(actualMonth1 == 2, "Ambiguous 8-digit - month is March (2) (expected 2, got " + actualMonth1 + ")");
          int actualDay1 = cal1.get(Calendar.DAY_OF_MONTH);
          test(actualDay1 == 15, "Ambiguous 8-digit - day is 15 (expected 15, got " + actualDay1 + ")");

          Date date2 = DateUtil.parseDateString("03152024");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          int actualYear2 = cal2.get(Calendar.YEAR);
          test(actualYear2 == 2024, "Ambiguous 8-digit - 03152024 is MMDDYYYY (expected 2024, got " + actualYear2 + ")");
          int actualMonth2 = cal2.get(Calendar.MONTH);
          test(actualMonth2 == 2, "Ambiguous 8-digit - month is March (2) (expected 2, got " + actualMonth2 + ")");
          int actualDay2 = cal2.get(Calendar.DAY_OF_MONTH);
          test(actualDay2 == 15, "Ambiguous 8-digit - day is 15 (expected 15, got " + actualDay2 + ")");

          Date date3 = DateUtil.parseDateString("10012024");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(date3);
          int actualYear3 = cal3.get(Calendar.YEAR);
          test(actualYear3 == 2024, "Ambiguous 8-digit - 10012024 is MMDDYYYY (expected 2024, got " + actualYear3 + ")");
          int actualMonth3 = cal3.get(Calendar.MONTH);
          test(actualMonth3 == 9, "Ambiguous 8-digit - month is October (9) (expected 9, got " + actualMonth3 + ")");
          int actualDay3 = cal3.get(Calendar.DAY_OF_MONTH);
          test(actualDay3 == 1, "Ambiguous 8-digit - day is 1 (expected 1, got " + actualDay3 + ")");

          Date date4 = DateUtil.parseDateString("01102024");
          Calendar cal4 = Calendar.getInstance();
          cal4.setTime(date4);
          int actualYear4 = cal4.get(Calendar.YEAR);
          test(actualYear4 == 2024, "Ambiguous 8-digit - 01102024 is MMDDYYYY (expected 2024, got " + actualYear4 + ")");
          int actualMonth4 = cal4.get(Calendar.MONTH);
          test(actualMonth4 == 0, "Ambiguous 8-digit - month is January (0) (expected 0, got " + actualMonth4 + ")");
          int actualDay4 = cal4.get(Calendar.DAY_OF_MONTH);
          test(actualDay4 == 10, "Ambiguous 8-digit - day is 10 (expected 10, got " + actualDay4 + ")");
        } catch ( Exception e ) {
          test(false, "Format ambiguity tests should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateString_TwoDigitYearBoundary',
      javaCode: `
        try {
          // Test 2-digit year using sliding window (50 years back, 50 years forward)
          Calendar currentCal = Calendar.getInstance();
          int currentYear = currentCal.get(Calendar.YEAR);
          int currentCentury = (currentYear / 100) * 100;

          // Test year 49
          Date date1 = DateUtil.parseDateString("49-12-31");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          int actualYear1 = cal1.get(Calendar.YEAR);
          int expected1 = currentCentury + 49;
          if ( expected1 > currentYear + 50 ) {
            expected1 = currentCentury - 100 + 49;
          }
          test(actualYear1 == expected1, "2-digit year 49 becomes " + expected1 + " (expected " + expected1 + ", got " + actualYear1 + ")");

          // Test year 00
          Date date2 = DateUtil.parseDateString("00-01-01");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          int actualYear2 = cal2.get(Calendar.YEAR);
          int expected2 = currentCentury + 0;
          if ( expected2 > currentYear + 50 ) {
            expected2 = currentCentury - 100 + 0;
          }
          test(actualYear2 == expected2, "2-digit year 00 becomes " + expected2 + " (expected " + expected2 + ", got " + actualYear2 + ")");

          // Test year 50
          Date date3 = DateUtil.parseDateString("50-01-01");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(date3);
          int actualYear3 = cal3.get(Calendar.YEAR);
          int expected3 = currentCentury + 50;
          if ( expected3 > currentYear + 50 ) {
            expected3 = currentCentury - 100 + 50;
          }
          test(actualYear3 == expected3, "2-digit year 50 becomes " + expected3 + " (expected " + expected3 + ", got " + actualYear3 + ")");

          // Test year 99
          Date date4 = DateUtil.parseDateString("99-12-31");
          Calendar cal4 = Calendar.getInstance();
          cal4.setTime(date4);
          int actualYear4 = cal4.get(Calendar.YEAR);
          int expected4 = currentCentury + 99;
          if ( expected4 > currentYear + 50 ) {
            expected4 = currentCentury - 100 + 99;
          }
          test(actualYear4 == expected4, "2-digit year 99 becomes " + expected4 + " (expected " + expected4 + ", got " + actualYear4 + ")");
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
          int actualYear = cal.get(Calendar.YEAR);
          test(actualYear == 2024, "adapt(\\"" + format + "\\") - year is 2024 (expected 2024, got " + actualYear + ")");
          int actualMonth = cal.get(Calendar.MONTH);
          test(actualMonth == 2, "adapt(\\"" + format + "\\") - month is March (2) (expected 2, got " + actualMonth + ")");
          int actualDay = cal.get(Calendar.DAY_OF_MONTH);
          test(actualDay == 15, "adapt(\\"" + format + "\\") - day is 15 (expected 15, got " + actualDay + ")");
          int actualHour = cal.get(Calendar.HOUR_OF_DAY);
          test(actualHour == 12, "adapt(\\"" + format + "\\") - normalized to noon GMT (expected 12, got " + actualHour + ")");
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_ISO8601',
      javaCode: `
        Date dt = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);
        test(cal.get(Calendar.YEAR) == 2024, "Year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "Month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "Day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 15, "Hour is 15 UTC");
        test(cal.get(Calendar.MINUTE) == 30, "Minute is 30");
        test(cal.get(Calendar.SECOND) == 45, "Second is 45");
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_ISO8601WithSpace',
      javaCode: `
        Date dt = DateUtil.parseDateTimeUTC("2024-03-15 15:30:45");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);
        test(cal.get(Calendar.YEAR) == 2024, "Year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "Month is March (2)");
        test(cal.get(Calendar.HOUR_OF_DAY) == 15, "Hour is 15 UTC");
        test(cal.get(Calendar.MINUTE) == 30, "Minute is 30");
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_WithMilliseconds',
      javaCode: `
        Date dt = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45.123");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);
        test(cal.get(Calendar.YEAR) == 2024, "Year is 2024");
        test(cal.get(Calendar.HOUR_OF_DAY) == 15, "Hour is 15 UTC");
        test(cal.get(Calendar.MILLISECOND) == 123, "Millisecond is 123");
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_USFormat',
      javaCode: `
        Date dt = DateUtil.parseDateTimeUTC("03/15/2024 15:30:45");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);
        test(cal.get(Calendar.YEAR) == 2024, "Year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "Month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "Day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 15, "Hour is 15 UTC");
        test(cal.get(Calendar.MINUTE) == 30, "Minute is 30");
        test(cal.get(Calendar.SECOND) == 45, "Second is 45");
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_Compact',
      javaCode: `
        Date dt = DateUtil.parseDateTimeUTC("20240315153045");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);
        test(cal.get(Calendar.YEAR) == 2024, "Year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "Month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "Day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 15, "Hour is 15 UTC");
        test(cal.get(Calendar.MINUTE) == 30, "Minute is 30");
        test(cal.get(Calendar.SECOND) == 45, "Second is 45");
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_LocalTime_ISO8601',
      javaCode: `
        Date dt = DateUtil.parseDateTime("2024-03-15T15:30:45");
        Calendar cal = Calendar.getInstance();
        cal.setTime(dt);
        test(cal.get(Calendar.YEAR) == 2024, "Year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "Month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "Day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 15, "Hour is 15 local time");
        test(cal.get(Calendar.MINUTE) == 30, "Minute is 30");
        test(cal.get(Calendar.SECOND) == 45, "Second is 45");
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_LocalTime_USFormat',
      javaCode: `
        Date dt = DateUtil.parseDateTime("03/15/2024 15:30:45");
        Calendar cal = Calendar.getInstance();
        cal.setTime(dt);
        test(cal.get(Calendar.YEAR) == 2024, "Year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "Month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "Day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 15, "Hour is 15 local time");
        test(cal.get(Calendar.MINUTE) == 30, "Minute is 30");
        test(cal.get(Calendar.SECOND) == 45, "Second is 45");
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_LocalTime_Compact',
      javaCode: `
        Date dt = DateUtil.parseDateTime("20240315153045");
        Calendar cal = Calendar.getInstance();
        cal.setTime(dt);
        test(cal.get(Calendar.YEAR) == 2024, "Year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "Month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "Day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 15, "Hour is 15 local time");
        test(cal.get(Calendar.MINUTE) == 30, "Minute is 30");
        test(cal.get(Calendar.SECOND) == 45, "Second is 45");
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_InvalidFormats',
      javaCode: `
        // Test invalid datetime
        try {
          DateUtil.parseDateTime("2024-02-30 15:30:45");
          test(false, "Invalid datetime (Feb 30) should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid datetime"), "Invalid datetime throws error");
        }

        // Test invalid hour
        try {
          DateUtil.parseDateTime("2024-03-15 25:30:45");
          test(false, "Invalid hour (25) should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid datetime"), "Invalid hour throws error");
        }

        // Test unsupported format
        try {
          DateUtil.parseDateTime("March 15, 2024 3:30 PM");
          test(false, "Unsupported format should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported DateTime format"), "Unsupported format throws error");
        }
      `
    },
    {
      name: 'DateUtilTest_format_DateOnly',
      javaCode: `
        // Test formatting date only (no time)
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.set(2024, 2, 15, 15, 30, 45);
        Date date = cal.getTime();

        String formatted = DateUtil.format(date, null, null);
        test(formatted != null && formatted.length() > 0, "format(date) returns non-empty string");
        test(formatted.contains("2024"), "format(date) contains year");
      `
    },
    {
      name: 'DateUtilTest_format_WithTime',
      javaCode: `
        // Test formatting with time
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.set(2024, 2, 15, 15, 30, 45);
        Date date = cal.getTime();

        String formattedTimeFirst = DateUtil.format(date, true, null);
        test(formattedTimeFirst != null && formattedTimeFirst.length() > 0, "format(date, true) returns non-empty string");

        String formattedTimeLast = DateUtil.format(date, false, null);
        test(formattedTimeLast != null && formattedTimeLast.length() > 0, "format(date, false) returns non-empty string");
      `
    },
    {
      name: 'DateUtilTest_format_UTC',
      javaCode: `
        // Test formatting in UTC timezone
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.set(2024, 2, 15, 15, 30, 45);
        Date date = cal.getTime();

        String formattedUTC = DateUtil.format(date, null, "UTC");
        test(formattedUTC != null && formattedUTC.length() > 0, "format(date, null, UTC) returns non-empty string");
        test(formattedUTC.contains("2024"), "UTC format contains year");

        String formattedWithTime = DateUtil.format(date, false, "UTC");
        test(formattedWithTime.contains("15:30:45"), "UTC format with time contains correct time");
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_WithTimezoneZ',
      javaCode: `
        try {
          Date dt = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45Z");
          Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.setTime(dt);

          int year = cal.get(Calendar.YEAR);
          test(year == 2024, "Year is 2024 (got " + year + ")");

          int month = cal.get(Calendar.MONTH);
          test(month == 2, "Month is March (2) (got " + month + ")");

          int day = cal.get(Calendar.DAY_OF_MONTH);
          test(day == 15, "Day is 15 (got " + day + ")");

          int hour = cal.get(Calendar.HOUR_OF_DAY);
          test(hour == 15, "Hour is 15 UTC (got " + hour + ")");

          int minute = cal.get(Calendar.MINUTE);
          test(minute == 30, "Minute is 30 (got " + minute + ")");

          int second = cal.get(Calendar.SECOND);
          test(second == 45, "Second is 45 (got " + second + ")");
        } catch ( Exception e ) {
          test(false, "Should parse Z timezone: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_WithPositiveOffset',
      javaCode: `
        try {
          // Test: "2024-03-15T15:30:45+05:30"
          // Expected UTC: 10:00:45 (15:30:45 - 5:30)
          Date dt = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45+05:30");
          Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.setTime(dt);

          int year = cal.get(Calendar.YEAR);
          test(year == 2024, "Year is 2024 (got " + year + ")");

          int month = cal.get(Calendar.MONTH);
          test(month == 2, "Month is March (2) (got " + month + ")");

          int day = cal.get(Calendar.DAY_OF_MONTH);
          test(day == 15, "Day is 15 (got " + day + ")");

          int hour = cal.get(Calendar.HOUR_OF_DAY);
          test(hour == 10, "Hour is 10 UTC (15:30 - 5:30) (got " + hour + ")");

          int minute = cal.get(Calendar.MINUTE);
          test(minute == 0, "Minute is 0 (got " + minute + ")");

          int second = cal.get(Calendar.SECOND);
          test(second == 45, "Second is 45 (got " + second + ")");
        } catch ( Exception e ) {
          test(false, "Should parse positive offset: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_WithNegativeOffset',
      javaCode: `
        try {
          // Test: "2024-03-15T15:30:45-08:00"
          // Expected UTC: 23:30:45 (15:30:45 + 8:00)
          Date dt = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45-08:00");
          Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.setTime(dt);

          int year = cal.get(Calendar.YEAR);
          test(year == 2024, "Year is 2024 (got " + year + ")");

          int month = cal.get(Calendar.MONTH);
          test(month == 2, "Month is March (2) (got " + month + ")");

          int day = cal.get(Calendar.DAY_OF_MONTH);
          test(day == 15, "Day is 15 (got " + day + ")");

          int hour = cal.get(Calendar.HOUR_OF_DAY);
          test(hour == 23, "Hour is 23 UTC (15:30 + 8:00) (got " + hour + ")");

          int minute = cal.get(Calendar.MINUTE);
          test(minute == 30, "Minute is 30 (got " + minute + ")");

          int second = cal.get(Calendar.SECOND);
          test(second == 45, "Second is 45 (got " + second + ")");
        } catch ( Exception e ) {
          test(false, "Should parse negative offset: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_TimezoneFormats',
      javaCode: `
        try {
          // Test various timezone offset formats

          // Format: +HHMM (no colon)
          Date dt1 = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45+0530");
          Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal1.setTime(dt1);
          int hour1 = cal1.get(Calendar.HOUR_OF_DAY);
          test(hour1 == 10, "Format +HHMM: Hour is 10 UTC (got " + hour1 + ")");

          // Format: +HH:MM (with colon) - already tested above, but verify again
          Date dt2 = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45+05:30");
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);
          int hour2 = cal2.get(Calendar.HOUR_OF_DAY);
          test(hour2 == 10, "Format +HH:MM: Hour is 10 UTC (got " + hour2 + ")");

          // Format: -HHMM (no colon)
          Date dt3 = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45-0800");
          Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal3.setTime(dt3);
          int hour3 = cal3.get(Calendar.HOUR_OF_DAY);
          test(hour3 == 23, "Format -HHMM: Hour is 23 UTC (got " + hour3 + ")");

          // Format: -HH:MM (with colon)
          Date dt4 = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45-08:00");
          Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal4.setTime(dt4);
          int hour4 = cal4.get(Calendar.HOUR_OF_DAY);
          test(hour4 == 23, "Format -HH:MM: Hour is 23 UTC (got " + hour4 + ")");

          // Format: Z (UTC)
          Date dt5 = DateUtil.parseDateTimeUTC("2024-03-15T15:30:45Z");
          Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal5.setTime(dt5);
          int hour5 = cal5.get(Calendar.HOUR_OF_DAY);
          test(hour5 == 15, "Format Z: Hour is 15 UTC (got " + hour5 + ")");

        } catch ( Exception e ) {
          test(false, "Should parse all timezone formats: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_WithTimezone',
      javaCode: `
        try {
          // Test that parseDateTime also handles timezones by converting to UTC
          // parseDateTime should interpret the timezone and convert to UTC

          Date dt1 = DateUtil.parseDateTime("2024-03-15T15:30:45Z");
          Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal1.setTime(dt1);
          int hour1 = cal1.get(Calendar.HOUR_OF_DAY);
          test(hour1 == 15, "parseDateTime with Z: Hour is 15 UTC (got " + hour1 + ")");

          // With positive offset: local time 15:30 +05:30 = 10:00 UTC
          Date dt2 = DateUtil.parseDateTime("2024-03-15T15:30:45+05:30");
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);
          int hour2 = cal2.get(Calendar.HOUR_OF_DAY);
          test(hour2 == 10, "parseDateTime with +05:30: Hour is 10 UTC (got " + hour2 + ")");

          // With negative offset: local time 15:30 -08:00 = 23:30 UTC
          Date dt3 = DateUtil.parseDateTime("2024-03-15T15:30:45-08:00");
          Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal3.setTime(dt3);
          int hour3 = cal3.get(Calendar.HOUR_OF_DAY);
          test(hour3 == 23, "parseDateTime with -08:00: Hour is 23 UTC (got " + hour3 + ")");

        } catch ( Exception e ) {
          test(false, "parseDateTime should handle timezones: " + e.getMessage());
        }
      `
    }
  ]
});
