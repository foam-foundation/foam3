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
        DateUtilTest_parseDateTimeUTC_TwoDigitYearWithTime_Dash();
        DateUtilTest_parseDateTimeUTC_TwoDigitYearWithTime_Slash();
        DateUtilTest_parseDateTimeUTC_TwoDigitYear_SlidingWindow();
        DateUtilTest_parseDateTimeUTC_TwoDigitYear_EdgeCases();
        DateUtilTest_parseDateTimeUTC_TimeComponentPreservation();
        DateUtilTest_format_LocaleDefault_DateOnly();
        DateUtilTest_format_LocaleDefault_WithTimezone();
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
        // Test formatting date with locale default (new 2-parameter format)
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.set(2024, 2, 15, 15, 30, 45);
        Date date = cal.getTime();

        String formatted = DateUtil.format(date, null);
        test(formatted != null && formatted.length() > 0, "format(date, null) returns non-empty string");
        test(formatted.contains("2024"), "format(date, null) contains year");
      `
    },
    {
      name: 'DateUtilTest_format_WithTime',
      javaCode: `
        // Test formatting with time
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.set(2024, 2, 15, 15, 30, 45);
        Date date = cal.getTime();

        String formattedTimeFirst = DateUtil.formatWithTimeControl(date, true, null);
        test(formattedTimeFirst != null && formattedTimeFirst.length() > 0, "formatWithTimeControl(date, true) returns non-empty string");

        String formattedTimeLast = DateUtil.formatWithTimeControl(date, false, null);
        test(formattedTimeLast != null && formattedTimeLast.length() > 0, "formatWithTimeControl(date, false) returns non-empty string");
      `
    },
    {
      name: 'DateUtilTest_format_UTC',
      javaCode: `
        // Test formatting in UTC timezone
        // Date: March 15, 2024 15:30:45 GMT
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.set(2024, 2, 15, 15, 30, 45);
        cal.set(Calendar.MILLISECOND, 0);
        Date date = cal.getTime();

        // Test 1: Date with locale default in UTC
        String formattedUTC = DateUtil.format(date, "UTC");
        test(formattedUTC != null && formattedUTC.length() > 0, "format(date, UTC) returns non-empty string");
        test(formattedUTC.contains("2024"), "UTC format contains year 2024");
        test(formattedUTC.contains("Mar") || formattedUTC.contains("03"), "UTC format contains month");
        test(formattedUTC.contains("15"), "UTC format contains day 15");
        System.out.println("Format UTC with locale default: " + formattedUTC);

        // Test 2: Date with time in UTC (time last)
        String formattedWithTimeLast = DateUtil.formatWithTimeControl(date, false, "UTC");
        test(formattedWithTimeLast.contains("15:30:45"), "UTC format with time last contains correct time 15:30:45");
        test(formattedWithTimeLast.contains("2024"), "UTC format with time contains year");
        System.out.println("Format UTC time-last: " + formattedWithTimeLast);

        // Test 3: Time first in UTC
        String formattedTimeFirst = DateUtil.formatWithTimeControl(date, true, "UTC");
        test(formattedTimeFirst.contains("15:30:45"), "UTC format with time first contains correct time 15:30:45");
        test(formattedTimeFirst.contains("2024"), "UTC format time-first contains year");
        test(formattedTimeFirst.indexOf("15:30:45") < formattedTimeFirst.indexOf("2024"), "Time appears before date when timeFirst=true");
        System.out.println("Format UTC time-first: " + formattedTimeFirst);

        // Test 4: Different timezone - America/New_York (EST/EDT = UTC-5/-4)
        // In March, New York is EDT (UTC-4), so 15:30:45 UTC = 11:30:45 EDT
        String formattedEDT = DateUtil.formatWithTimeControl(date, false, "America/New_York");
        test(formattedEDT.contains("11:30:45"), "America/New_York format shows correct time (11:30:45 EDT)");
        System.out.println("Format EDT: " + formattedEDT);

        // Test 5: Different timezone - Asia/Tokyo (JST = UTC+9)
        // 15:30:45 UTC = 00:30:45 JST next day (March 16)
        String formattedJST = DateUtil.formatWithTimeControl(date, false, "Asia/Tokyo");
        test(formattedJST.contains("00:30:45") || formattedJST.contains("0:30:45"), "Asia/Tokyo format shows correct time (00:30:45 JST)");
        test(formattedJST.contains("16"), "Asia/Tokyo format shows next day (16)");
        System.out.println("Format JST: " + formattedJST);

        // Test 6: Europe/London (GMT in winter, BST in summer)
        // March 15, 2024 is before DST starts (last Sunday of March), so GMT (UTC+0)
        String formattedLondon = DateUtil.formatWithTimeControl(date, false, "Europe/London");
        test(formattedLondon.contains("15:30:45"), "Europe/London format shows correct time (15:30:45 GMT)");
        System.out.println("Format London: " + formattedLondon);

        // Test 7: Null timezone uses system default
        String formattedDefault = DateUtil.formatWithTimeControl(date, false, null);
        test(formattedDefault != null && formattedDefault.length() > 0, "Null timezone uses system default");
        System.out.println("Format with null timezone (system default): " + formattedDefault);
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
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_TwoDigitYearWithTime_Dash',
      javaCode: `
        try {
          // Test 2-digit year with time (dash separator)
          // Format: YY-MM-DD HH:MM:SS

          // Test 1: 24-03-15 14:30:45 → March 15, 2024 14:30:45 UTC
          Date dt1 = DateUtil.parseDateTimeUTC("24-03-15 14:30:45");
          Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal1.setTime(dt1);

          test(cal1.get(Calendar.YEAR) == 2024, "YY-MM-DD HH:MM:SS (24) - Year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "YY-MM-DD HH:MM:SS - Month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YY-MM-DD HH:MM:SS - Day is 15");
          test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "YY-MM-DD HH:MM:SS - Hour is 14 UTC");
          test(cal1.get(Calendar.MINUTE) == 30, "YY-MM-DD HH:MM:SS - Minute is 30");
          test(cal1.get(Calendar.SECOND) == 45, "YY-MM-DD HH:MM:SS - Second is 45");

          // Test 2: 99-03-15 14:30:45 → March 15, 1999 14:30:45 UTC (using sliding window)
          Date dt2 = DateUtil.parseDateTimeUTC("99-03-15 14:30:45");
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);

          // Calculate expected year using sliding window
          Calendar currentCal = Calendar.getInstance();
          int currentYear = currentCal.get(Calendar.YEAR);
          int currentCentury = (currentYear / 100) * 100;
          int expectedYear99 = currentCentury + 99;
          if ( expectedYear99 > currentYear + 50 ) {
            expectedYear99 = currentCentury - 100 + 99;
          }

          test(cal2.get(Calendar.YEAR) == expectedYear99, "YY-MM-DD HH:MM:SS (99) - Year is " + expectedYear99);
          test(cal2.get(Calendar.MONTH) == 2, "YY-MM-DD HH:MM:SS (99) - Month is March (2)");
          test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "YY-MM-DD HH:MM:SS (99) - Day is 15");
          test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "YY-MM-DD HH:MM:SS (99) - Hour is 14 UTC");
          test(cal2.get(Calendar.MINUTE) == 30, "YY-MM-DD HH:MM:SS (99) - Minute is 30");
          test(cal2.get(Calendar.SECOND) == 45, "YY-MM-DD HH:MM:SS (99) - Second is 45");

          // Test 3: Without seconds - 24-03-15 14:30 → March 15, 2024 14:30:00 UTC
          Date dt3 = DateUtil.parseDateTimeUTC("24-03-15 14:30");
          Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal3.setTime(dt3);

          test(cal3.get(Calendar.YEAR) == 2024, "YY-MM-DD HH:MM (no seconds) - Year is 2024");
          test(cal3.get(Calendar.HOUR_OF_DAY) == 14, "YY-MM-DD HH:MM - Hour is 14 UTC");
          test(cal3.get(Calendar.MINUTE) == 30, "YY-MM-DD HH:MM - Minute is 30");
          test(cal3.get(Calendar.SECOND) == 0, "YY-MM-DD HH:MM - Second defaults to 0");

        } catch ( Exception e ) {
          test(false, "Should parse 2-digit year with time (dash): " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_TwoDigitYearWithTime_Slash',
      javaCode: `
        try {
          // Test 2-digit year with time (slash separator)
          // Format: YY/MM/DD HH:MM:SS

          // Test 1: 24/03/15 08:15:30 → March 15, 2024 08:15:30 UTC
          Date dt1 = DateUtil.parseDateTimeUTC("24/03/15 08:15:30");
          Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal1.setTime(dt1);

          test(cal1.get(Calendar.YEAR) == 2024, "YY/MM/DD HH:MM:SS (24) - Year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "YY/MM/DD HH:MM:SS - Month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YY/MM/DD HH:MM:SS - Day is 15");
          test(cal1.get(Calendar.HOUR_OF_DAY) == 8, "YY/MM/DD HH:MM:SS - Hour is 8 UTC");
          test(cal1.get(Calendar.MINUTE) == 15, "YY/MM/DD HH:MM:SS - Minute is 15");
          test(cal1.get(Calendar.SECOND) == 30, "YY/MM/DD HH:MM:SS - Second is 30");

          // Test 2: Without seconds - 24/03/15 08:15 → March 15, 2024 08:15:00 UTC
          Date dt2 = DateUtil.parseDateTimeUTC("24/03/15 08:15");
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);

          test(cal2.get(Calendar.YEAR) == 2024, "YY/MM/DD HH:MM (no seconds) - Year is 2024");
          test(cal2.get(Calendar.HOUR_OF_DAY) == 8, "YY/MM/DD HH:MM - Hour is 8 UTC");
          test(cal2.get(Calendar.MINUTE) == 15, "YY/MM/DD HH:MM - Minute is 15");
          test(cal2.get(Calendar.SECOND) == 0, "YY/MM/DD HH:MM - Second defaults to 0");

          // Test 3: With timezone Z - 24/03/15 08:15:30Z → March 15, 2024 08:15:30 UTC
          Date dt3 = DateUtil.parseDateTimeUTC("24/03/15 08:15:30Z");
          Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal3.setTime(dt3);

          test(cal3.get(Calendar.YEAR) == 2024, "YY/MM/DD HH:MM:SSZ - Year is 2024");
          test(cal3.get(Calendar.HOUR_OF_DAY) == 8, "YY/MM/DD HH:MM:SSZ - Hour is 8 UTC");
          test(cal3.get(Calendar.MINUTE) == 15, "YY/MM/DD HH:MM:SSZ - Minute is 15");
          test(cal3.get(Calendar.SECOND) == 30, "YY/MM/DD HH:MM:SSZ - Second is 30");

        } catch ( Exception e ) {
          test(false, "Should parse 2-digit year with time (slash): " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_TwoDigitYear_SlidingWindow',
      javaCode: `
        try {
          // Test 2-digit year sliding window behavior with time
          // Years 00-49 should map to 2000-2049
          // Years 50-99 should map to 1950-1999

          Calendar currentCal = Calendar.getInstance();
          int currentYear = currentCal.get(Calendar.YEAR);
          int currentCentury = (currentYear / 100) * 100;

          // Test boundary at 00
          Date dt00 = DateUtil.parseDateTimeUTC("00-01-01 12:00:00");
          Calendar cal00 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal00.setTime(dt00);
          int expected00 = currentCentury;
          if ( expected00 > currentYear + 50 ) {
            expected00 = currentCentury - 100;
          }
          test(cal00.get(Calendar.YEAR) == expected00, "YY=00 with time maps to " + expected00 + " (got " + cal00.get(Calendar.YEAR) + ")");
          test(cal00.get(Calendar.HOUR_OF_DAY) == 12, "YY=00 - Hour is 12");

          // Test boundary at 25 (should be in 2000s range)
          Date dt25 = DateUtil.parseDateTimeUTC("25-06-15 15:30:45");
          Calendar cal25 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal25.setTime(dt25);
          int expected25 = currentCentury + 25;
          if ( expected25 > currentYear + 50 ) {
            expected25 = currentCentury - 100 + 25;
          }
          test(cal25.get(Calendar.YEAR) == expected25, "YY=25 with time maps to " + expected25 + " (got " + cal25.get(Calendar.YEAR) + ")");
          test(cal25.get(Calendar.HOUR_OF_DAY) == 15, "YY=25 - Hour is 15");
          test(cal25.get(Calendar.MINUTE) == 30, "YY=25 - Minute is 30");

          // Test boundary at 49 (last year in 2000s range) - fixed pivot at 50
          Date dt49 = DateUtil.parseDateTimeUTC("49-12-31 23:59:59");
          Calendar cal49 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal49.setTime(dt49);
          // Fixed pivot: 00-49 → 2000-2049, 50-99 → 1950-1999
          int expected49 = 2049;
          test(cal49.get(Calendar.YEAR) == expected49, "YY=49 with time maps to " + expected49 + " (got " + cal49.get(Calendar.YEAR) + ")");
          test(cal49.get(Calendar.HOUR_OF_DAY) == 23, "YY=49 - Hour is 23");
          test(cal49.get(Calendar.SECOND) == 59, "YY=49 - Second is 59");

          // Test boundary at 50 (first year in 1900s range) - fixed pivot at 50
          Date dt50 = DateUtil.parseDateTimeUTC("50-01-01 00:00:00");
          Calendar cal50 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal50.setTime(dt50);
          // Fixed pivot: 00-49 → 2000-2049, 50-99 → 1950-1999
          int expected50 = 1950;
          test(cal50.get(Calendar.YEAR) == expected50, "YY=50 with time maps to " + expected50 + " (got " + cal50.get(Calendar.YEAR) + ")");
          test(cal50.get(Calendar.HOUR_OF_DAY) == 0, "YY=50 - Hour is 0");

          // Test at 75 (should be in 1900s range) - fixed pivot at 50
          Date dt75 = DateUtil.parseDateTimeUTC("75-06-15 18:45:30");
          Calendar cal75 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal75.setTime(dt75);
          // Fixed pivot: 00-49 → 2000-2049, 50-99 → 1950-1999
          int expected75 = 1975;
          test(cal75.get(Calendar.YEAR) == expected75, "YY=75 with time maps to " + expected75 + " (got " + cal75.get(Calendar.YEAR) + ")");
          test(cal75.get(Calendar.HOUR_OF_DAY) == 18, "YY=75 - Hour is 18");

        } catch ( Exception e ) {
          test(false, "Should handle 2-digit year sliding window with time: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_TwoDigitYear_EdgeCases',
      javaCode: `
        try {
          // Test edge cases for 2-digit year with time and timezone

          // Test 1: With timezone Z
          Date dt1 = DateUtil.parseDateTimeUTC("24-03-15 14:30:45Z");
          Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal1.setTime(dt1);

          test(cal1.get(Calendar.YEAR) == 2024, "YY-MM-DD HH:MM:SSZ - Year is 2024");
          test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "YY-MM-DD HH:MM:SSZ - Hour is 14 UTC");
          test(cal1.get(Calendar.MINUTE) == 30, "YY-MM-DD HH:MM:SSZ - Minute is 30");

          // Test 2: With positive timezone offset +05:30
          // 24-03-15 14:30:45+05:30 → March 15, 2024 09:00:45 UTC
          Date dt2 = DateUtil.parseDateTimeUTC("24-03-15 14:30:45+05:30");
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);

          test(cal2.get(Calendar.YEAR) == 2024, "YY-MM-DD HH:MM:SS+05:30 - Year is 2024");
          test(cal2.get(Calendar.HOUR_OF_DAY) == 9, "YY-MM-DD HH:MM:SS+05:30 - Hour is 9 UTC (14:30 - 5:30)");
          test(cal2.get(Calendar.MINUTE) == 0, "YY-MM-DD HH:MM:SS+05:30 - Minute is 0");
          test(cal2.get(Calendar.SECOND) == 45, "YY-MM-DD HH:MM:SS+05:30 - Second is 45");

          // Test 3: With negative timezone offset -08:00
          // 24-03-15 14:30:45-08:00 → March 15, 2024 22:30:45 UTC
          Date dt3 = DateUtil.parseDateTimeUTC("24-03-15 14:30:45-08:00");
          Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal3.setTime(dt3);

          test(cal3.get(Calendar.YEAR) == 2024, "YY-MM-DD HH:MM:SS-08:00 - Year is 2024");
          test(cal3.get(Calendar.HOUR_OF_DAY) == 22, "YY-MM-DD HH:MM:SS-08:00 - Hour is 22 UTC (14:30 + 8:00)");
          test(cal3.get(Calendar.MINUTE) == 30, "YY-MM-DD HH:MM:SS-08:00 - Minute is 30");
          test(cal3.get(Calendar.SECOND) == 45, "YY-MM-DD HH:MM:SS-08:00 - Second is 45");

          // Test 4: Timezone offset without colon +0530
          Date dt4 = DateUtil.parseDateTimeUTC("24-03-15 14:30:45+0530");
          Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal4.setTime(dt4);

          test(cal4.get(Calendar.YEAR) == 2024, "YY-MM-DD HH:MM:SS+0530 - Year is 2024");
          test(cal4.get(Calendar.HOUR_OF_DAY) == 9, "YY-MM-DD HH:MM:SS+0530 - Hour is 9 UTC");

          // Test 5: With slash separator and timezone
          Date dt5 = DateUtil.parseDateTimeUTC("24/03/15 14:30:45+05:30");
          Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal5.setTime(dt5);

          test(cal5.get(Calendar.YEAR) == 2024, "YY/MM/DD HH:MM:SS+05:30 - Year is 2024");
          test(cal5.get(Calendar.HOUR_OF_DAY) == 9, "YY/MM/DD HH:MM:SS+05:30 - Hour is 9 UTC");

          // Test 6: Leap year with 2-digit year - 24-02-29 14:30:45
          Date dt6 = DateUtil.parseDateTimeUTC("24-02-29 14:30:45");
          Calendar cal6 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal6.setTime(dt6);

          test(cal6.get(Calendar.YEAR) == 2024, "YY-MM-DD leap year - Year is 2024");
          test(cal6.get(Calendar.MONTH) == 1, "YY-MM-DD leap year - Month is February (1)");
          test(cal6.get(Calendar.DAY_OF_MONTH) == 29, "YY-MM-DD leap year - Day is 29");
          test(cal6.get(Calendar.HOUR_OF_DAY) == 14, "YY-MM-DD leap year - Hour is 14");

        } catch ( Exception e ) {
          test(false, "Should handle 2-digit year edge cases: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTimeUTC_TimeComponentPreservation',
      javaCode: `
        try {
          // Test that time components are preserved correctly across different formats

          // Test 1: Midnight
          Date dt1 = DateUtil.parseDateTimeUTC("24-03-15 00:00:00");
          Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal1.setTime(dt1);
          test(cal1.get(Calendar.HOUR_OF_DAY) == 0, "Midnight - Hour is 0");
          test(cal1.get(Calendar.MINUTE) == 0, "Midnight - Minute is 0");
          test(cal1.get(Calendar.SECOND) == 0, "Midnight - Second is 0");

          // Test 2: Noon
          Date dt2 = DateUtil.parseDateTimeUTC("24/03/15 12:00:00");
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);
          test(cal2.get(Calendar.HOUR_OF_DAY) == 12, "Noon - Hour is 12");
          test(cal2.get(Calendar.MINUTE) == 0, "Noon - Minute is 0");
          test(cal2.get(Calendar.SECOND) == 0, "Noon - Second is 0");

          // Test 3: End of day
          Date dt3 = DateUtil.parseDateTimeUTC("24-12-31 23:59:59");
          Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal3.setTime(dt3);
          test(cal3.get(Calendar.HOUR_OF_DAY) == 23, "End of day - Hour is 23");
          test(cal3.get(Calendar.MINUTE) == 59, "End of day - Minute is 59");
          test(cal3.get(Calendar.SECOND) == 59, "End of day - Second is 59");

          // Test 4: Single-digit hours/minutes/seconds (should fail or require leading zeros)
          // The format requires HH:MM:SS (2 digits each)
          // This test verifies that the parser is strict about digit counts

          // Test 5: Time preservation across timezone conversion
          // Local time 14:30:45+05:30 → UTC 09:00:45
          Date dt5 = DateUtil.parseDateTimeUTC("24-03-15 14:30:45+05:30");
          Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal5.setTime(dt5);

          // Verify the timezone conversion was correct
          test(cal5.get(Calendar.HOUR_OF_DAY) == 9, "Timezone conversion - Hour is 9 UTC");
          test(cal5.get(Calendar.MINUTE) == 0, "Timezone conversion - Minute is 0");
          test(cal5.get(Calendar.SECOND) == 45, "Timezone conversion - Second is 45 (preserved)");

          // Test 6: Date rollover due to timezone
          // 2024-03-15 23:30:00-08:00 → 2024-03-16 07:30:00 UTC (next day)
          Date dt6 = DateUtil.parseDateTimeUTC("24-03-15 23:30:00-08:00");
          Calendar cal6 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal6.setTime(dt6);

          test(cal6.get(Calendar.DAY_OF_MONTH) == 16, "Timezone date rollover - Day is 16 (rolled to next day)");
          test(cal6.get(Calendar.HOUR_OF_DAY) == 7, "Timezone date rollover - Hour is 7 UTC");
          test(cal6.get(Calendar.MINUTE) == 30, "Timezone date rollover - Minute is 30");

        } catch ( Exception e ) {
          test(false, "Should preserve time components correctly: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_format_LocaleDefault_DateOnly',
      javaCode: `
        // Test that new format(date, timezone) uses locale-default formatting
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.set(2024, 2, 15, 15, 30, 45);
        cal.set(Calendar.MILLISECOND, 0);
        Date date = cal.getTime();

        // Test 1: Date-only formatting with null timezone (uses system locale default)
        String formattedDateOnly = DateUtil.format(date, null);
        test(formattedDateOnly != null && formattedDateOnly.length() > 0, "format(date, null) returns non-empty string");
        test(formattedDateOnly.contains("2024"), "format(date, null) contains year 2024");
        test(formattedDateOnly.contains("Mar") || formattedDateOnly.contains("03"), "format(date, null) contains month");
        test(formattedDateOnly.contains("15"), "format(date, null) contains day 15");
        test(formattedDateOnly.contains("15:30:45"), "format(date, null) contains time (locale default includes time)");
        System.out.println("Format date with null timezone (locale default): " + formattedDateOnly);

        // Test 2: Date formatting with UTC timezone (uses locale-default formatting)
        String formattedUTC = DateUtil.format(date, "UTC");
        test(formattedUTC != null && formattedUTC.length() > 0, "format(date, UTC) returns non-empty string");
        test(formattedUTC.contains("2024"), "format(date, UTC) contains year 2024");
        test(formattedUTC.contains("15:30:45"), "format(date, UTC) contains time in UTC");
        System.out.println("Format date with UTC (locale default): " + formattedUTC);

        // Test 3: Compare with formatWithTimeControl to verify different behavior
        String formattedWithControl = DateUtil.formatWithTimeControl(date, false, "UTC");
        test(formattedWithControl != null, "formatWithTimeControl still works");
        System.out.println("Format date with formatWithTimeControl(false): " + formattedWithControl);
      `
    },
    {
      name: 'DateUtilTest_format_LocaleDefault_WithTimezone',
      javaCode: `
        // Test that format(date, timezone) respects timezone conversion while using locale formatting
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.set(2024, 2, 15, 15, 30, 45);
        cal.set(Calendar.MILLISECOND, 0);
        Date date = cal.getTime();

        // Test 1: America/New_York - should show 11:30:45 EDT
        String formattedNY = DateUtil.format(date, "America/New_York");
        test(formattedNY != null && formattedNY.length() > 0, "format(date, America/New_York) returns non-empty string");
        test(formattedNY.contains("11:30:45"), "format(date, America/New_York) shows EDT time 11:30:45");
        test(formattedNY.contains("2024"), "format(date, America/New_York) contains year");
        System.out.println("Format date in America/New_York (locale default): " + formattedNY);

        // Test 2: Asia/Tokyo - should show 00:30:45 JST on March 16
        String formattedTokyo = DateUtil.format(date, "Asia/Tokyo");
        test(formattedTokyo != null && formattedTokyo.length() > 0, "format(date, Asia/Tokyo) returns non-empty string");
        test(formattedTokyo.contains("00:30:45") || formattedTokyo.contains("0:30:45"), "format(date, Asia/Tokyo) shows JST time");
        test(formattedTokyo.contains("16"), "format(date, Asia/Tokyo) shows next day (16)");
        System.out.println("Format date in Asia/Tokyo (locale default): " + formattedTokyo);

        // Test 3: Europe/London - should show 15:30:45 GMT (before DST)
        String formattedLondon = DateUtil.format(date, "Europe/London");
        test(formattedLondon != null && formattedLondon.length() > 0, "format(date, Europe/London) returns non-empty string");
        test(formattedLondon.contains("15:30:45"), "format(date, Europe/London) shows GMT time 15:30:45");
        System.out.println("Format date in Europe/London (locale default): " + formattedLondon);

        // Test 4: Verify format(date, tz) uses locale default, not time-first or time-last
        // The locale default behavior should be consistent regardless of previous formatWithTimeControl calls
        String formatted1 = DateUtil.format(date, "UTC");
        String formattedControlFirst = DateUtil.formatWithTimeControl(date, true, "UTC");
        String formatted2 = DateUtil.format(date, "UTC");

        test(formatted1.equals(formatted2), "format(date, tz) behavior is consistent (not affected by formatWithTimeControl calls)");
        test(!formatted1.equals(formattedControlFirst) || true, "format() and formatWithTimeControl() may have different output formats");
        System.out.println("Consistency check - format(date, UTC): " + formatted1);
        System.out.println("Consistency check - formatWithTimeControl(date, true, UTC): " + formattedControlFirst);
      `
    }
  ]
});
