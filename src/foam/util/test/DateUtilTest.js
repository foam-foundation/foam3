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
        DateUtilTest_parseDateTime_ISO8601();
        DateUtilTest_parseDateTime_US_Format();
        DateUtilTest_parseDateTime_Compact();
        DateUtilTest_parseDateTime_InvalidFormats();
        DateUtilTest_parseDateTime_ForceUTC_True();
        DateUtilTest_parseDateTime_ForceUTC_False();
        DateUtilTest_parseDateTime_ForceUTC_BackwardCompatibility();
        DateUtilTest_adaptDateTime_DateOnlyString();
        DateUtilTest_adaptDateTime_DateTimeString();
        DateUtilTest_adaptDateTime_Number();
        DateUtilTest_adaptDateTime_Date();
        DateUtilTest_adaptDateTime_Null();
        DateUtilTest_format_DateOnly();
        DateUtilTest_format_WithTime();
        DateUtilTest_format_UTC();
        DateUtilTest_UTCTimePreservation();
        DateUtilTest_TimezoneFormatting();
        DateUtilTest_adaptDateTime_UTC_Flag_DateTimeString();
        DateUtilTest_adaptDateTime_UTC_Flag_DateOnlyString();
        DateUtilTest_adaptDateTime_UTC_Flag_USFormatString();
        DateUtilTest_adaptDateTime_UTC_Flag_NumbersAndDates();
        DateUtilTest_adaptDateTime_BackwardCompatibility();
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
        long timestamp = 1710489600000L; // March 15, 2024 12:00:00 GMT
        Date date = DateUtil.adapt(timestamp);

        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
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
      name: 'DateUtilTest_parseDateTime_ISO8601',
      javaCode: `
        try {
          // Test ISO 8601 with T separator
          Date dt1 = DateUtil.parseDateTime("2024-03-15T15:30:45");
          Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal1.setTime(dt1);
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 2024, "ISO 8601 T - year is 2024 (expected 2024, got " + actualYear1 + ")");
          int actualMonth1 = cal1.get(Calendar.MONTH);
          test(actualMonth1 == 2, "ISO 8601 T - month is March (2) (expected 2, got " + actualMonth1 + ")");
          int actualDay1 = cal1.get(Calendar.DAY_OF_MONTH);
          test(actualDay1 == 15, "ISO 8601 T - day is 15 (expected 15, got " + actualDay1 + ")");
          int actualHour1 = cal1.get(Calendar.HOUR_OF_DAY);
          test(actualHour1 == 15, "ISO 8601 T - hour is 15 (expected 15, got " + actualHour1 + ")");
          int actualMinute1 = cal1.get(Calendar.MINUTE);
          test(actualMinute1 == 30, "ISO 8601 T - minute is 30 (expected 30, got " + actualMinute1 + ")");
          int actualSecond1 = cal1.get(Calendar.SECOND);
          test(actualSecond1 == 45, "ISO 8601 T - second is 45 (expected 45, got " + actualSecond1 + ")");

          // Test ISO 8601 with space separator
          Date dt2 = DateUtil.parseDateTime("2024-03-15 15:30:45");
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);
          int actualHour2 = cal2.get(Calendar.HOUR_OF_DAY);
          test(actualHour2 == 15, "ISO 8601 space - hour is 15 (expected 15, got " + actualHour2 + ")");
          int actualMinute2 = cal2.get(Calendar.MINUTE);
          test(actualMinute2 == 30, "ISO 8601 space - minute is 30 (expected 30, got " + actualMinute2 + ")");

          // Test with milliseconds
          Date dt3 = DateUtil.parseDateTime("2024-03-15T15:30:45.123");
          Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal3.setTime(dt3);
          int actualHour3 = cal3.get(Calendar.HOUR_OF_DAY);
          test(actualHour3 == 15, "With milliseconds - hour is 15 (expected 15, got " + actualHour3 + ")");
          int actualMillis3 = cal3.get(Calendar.MILLISECOND);
          test(actualMillis3 == 123, "With milliseconds - millisecond is 123 (expected 123, got " + actualMillis3 + ")");
        } catch ( Exception e ) {
          test(false, "ISO 8601 format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_US_Format',
      javaCode: `
        try {
          // Test MM/DD/YYYY HH:MM:SS
          Date dt1 = DateUtil.parseDateTime("03/15/2024 15:30:45");
          Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal1.setTime(dt1);
          int actualYear1 = cal1.get(Calendar.YEAR);
          test(actualYear1 == 2024, "US format full - year is 2024 (expected 2024, got " + actualYear1 + ")");
          int actualMonth1 = cal1.get(Calendar.MONTH);
          test(actualMonth1 == 2, "US format full - month is March (2) (expected 2, got " + actualMonth1 + ")");
          int actualDay1 = cal1.get(Calendar.DAY_OF_MONTH);
          test(actualDay1 == 15, "US format full - day is 15 (expected 15, got " + actualDay1 + ")");
          int actualHour1 = cal1.get(Calendar.HOUR_OF_DAY);
          test(actualHour1 == 15, "US format full - hour is 15 (expected 15, got " + actualHour1 + ")");
          int actualMinute1 = cal1.get(Calendar.MINUTE);
          test(actualMinute1 == 30, "US format full - minute is 30 (expected 30, got " + actualMinute1 + ")");
          int actualSecond1 = cal1.get(Calendar.SECOND);
          test(actualSecond1 == 45, "US format full - second is 45 (expected 45, got " + actualSecond1 + ")");

          // Test MM/DD/YYYY HH:MM (no seconds)
          Date dt2 = DateUtil.parseDateTime("03/15/2024 15:30");
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);
          int actualHour2 = cal2.get(Calendar.HOUR_OF_DAY);
          test(actualHour2 == 15, "US format short - hour is 15 (expected 15, got " + actualHour2 + ")");
          int actualMinute2 = cal2.get(Calendar.MINUTE);
          test(actualMinute2 == 30, "US format short - minute is 30 (expected 30, got " + actualMinute2 + ")");
          int actualSecond2 = cal2.get(Calendar.SECOND);
          test(actualSecond2 == 0, "US format short - second is 0 (expected 0, got " + actualSecond2 + ")");
        } catch ( Exception e ) {
          test(false, "US format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_Compact',
      javaCode: `
        try {
          // Test YYYYMMDDHHMMSS format
          Date dt = DateUtil.parseDateTime("20240315153045");
          Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.setTime(dt);
          int actualYear = cal.get(Calendar.YEAR);
          test(actualYear == 2024, "Compact format - year is 2024 (expected 2024, got " + actualYear + ")");
          int actualMonth = cal.get(Calendar.MONTH);
          test(actualMonth == 2, "Compact format - month is March (2) (expected 2, got " + actualMonth + ")");
          int actualDay = cal.get(Calendar.DAY_OF_MONTH);
          test(actualDay == 15, "Compact format - day is 15 (expected 15, got " + actualDay + ")");
          int actualHour = cal.get(Calendar.HOUR_OF_DAY);
          test(actualHour == 15, "Compact format - hour is 15 (expected 15, got " + actualHour + ")");
          int actualMinute = cal.get(Calendar.MINUTE);
          test(actualMinute == 30, "Compact format - minute is 30 (expected 30, got " + actualMinute + ")");
          int actualSecond = cal.get(Calendar.SECOND);
          test(actualSecond == 45, "Compact format - second is 45 (expected 45, got " + actualSecond + ")");
        } catch ( Exception e ) {
          test(false, "Compact format should not throw exception: " + e.getMessage());
        }
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
      name: 'DateUtilTest_parseDateTime_ForceUTC_True',
      javaCode: `
        try {
          // Test parseDateTime with forceUTC=true parses as UTC
          Date dt = DateUtil.parseDateTime("2024-03-15T14:30:45", true);

          // Verify it's parsed as UTC
          Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.setTime(dt);
          int year = cal.get(Calendar.YEAR);
          test(year == 2024, "forceUTC=true - year is 2024 (expected 2024, got " + year + ")");
          int month = cal.get(Calendar.MONTH);
          test(month == 2, "forceUTC=true - month is March (2) (expected 2, got " + month + ")");
          int day = cal.get(Calendar.DAY_OF_MONTH);
          test(day == 15, "forceUTC=true - day is 15 (expected 15, got " + day + ")");
          int hour = cal.get(Calendar.HOUR_OF_DAY);
          test(hour == 14, "forceUTC=true - hour is 14 (expected 14, got " + hour + ")");
          int minute = cal.get(Calendar.MINUTE);
          test(minute == 30, "forceUTC=true - minute is 30 (expected 30, got " + minute + ")");
          int second = cal.get(Calendar.SECOND);
          test(second == 45, "forceUTC=true - second is 45 (expected 45, got " + second + ")");

          // Test with US format
          Date dt2 = DateUtil.parseDateTime("03/15/2024 14:30:45", true);
          Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal2.setTime(dt2);
          int hour2 = cal2.get(Calendar.HOUR_OF_DAY);
          test(hour2 == 14, "forceUTC=true with US format - hour is 14 (expected 14, got " + hour2 + ")");
        } catch ( Exception e ) {
          test(false, "forceUTC=true tests should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_ForceUTC_False',
      javaCode: `
        try {
          // Test parseDateTime with forceUTC=false parses as local time
          Date dt = DateUtil.parseDateTime("2024-03-15T14:30:45", false);

          // Verify it's parsed as local time
          Calendar cal = Calendar.getInstance();
          cal.setTime(dt);
          int year = cal.get(Calendar.YEAR);
          test(year == 2024, "forceUTC=false - year is 2024 (expected 2024, got " + year + ")");
          int month = cal.get(Calendar.MONTH);
          test(month == 2, "forceUTC=false - month is March (2) (expected 2, got " + month + ")");
          int day = cal.get(Calendar.DAY_OF_MONTH);
          test(day == 15, "forceUTC=false - day is 15 (expected 15, got " + day + ")");
          int hour = cal.get(Calendar.HOUR_OF_DAY);
          test(hour == 14, "forceUTC=false - hour is 14 local time (expected 14, got " + hour + ")");
          int minute = cal.get(Calendar.MINUTE);
          test(minute == 30, "forceUTC=false - minute is 30 (expected 30, got " + minute + ")");
          int second = cal.get(Calendar.SECOND);
          test(second == 45, "forceUTC=false - second is 45 (expected 45, got " + second + ")");

          // Compare with forceUTC=true - they should differ if not in UTC timezone
          Date dtUTC = DateUtil.parseDateTime("2024-03-15T14:30:45", true);
          TimeZone localTz = TimeZone.getDefault();
          int offsetMs = localTz.getOffset(dt.getTime());

          // If we're not in UTC timezone, the timestamps should differ
          if ( offsetMs != 0 ) {
            test(dt.getTime() != dtUTC.getTime(), "Local and UTC parsing should differ when not in UTC timezone (local: " + dt.getTime() + ", UTC: " + dtUTC.getTime() + ")");
          } else {
            test(dt.getTime() == dtUTC.getTime(), "Local and UTC parsing should be same in UTC timezone");
          }
        } catch ( Exception e ) {
          test(false, "forceUTC=false tests should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_parseDateTime_ForceUTC_BackwardCompatibility',
      javaCode: `
        try {
          // Test that calling parseDateTime without second parameter defaults to forceUTC=false (local time)
          Date dt1 = DateUtil.parseDateTime("2024-03-15T14:30:45");
          Date dt2 = DateUtil.parseDateTime("2024-03-15T14:30:45", false);

          // Both should parse as local time and produce same timestamp
          long time1 = dt1.getTime();
          long time2 = dt2.getTime();
          test(time1 == time2, "No parameter should default to forceUTC=false (expected " + time1 + ", got " + time2 + ")");

          // Verify local time components are correct
          Calendar cal = Calendar.getInstance();
          cal.setTime(dt1);
          int hour = cal.get(Calendar.HOUR_OF_DAY);
          test(hour == 14, "Backward compatibility - hour is 14 local time (expected 14, got " + hour + ")");
        } catch ( Exception e ) {
          test(false, "Backward compatibility tests should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_DateOnlyString',
      javaCode: `
        // Test date-only strings default to noon GMT (backward compatibility with Date.adapt)
        Date dt = DateUtil.adaptDateTime("2024-03-15");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);

        int actualYear = cal.get(Calendar.YEAR);
        test(actualYear == 2024, "adaptDateTime(date string) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = cal.get(Calendar.MONTH);
        test(actualMonth == 2, "adaptDateTime(date string) - month is March (2) (expected 2, got " + actualMonth + ")");
        int actualDay = cal.get(Calendar.DAY_OF_MONTH);
        test(actualDay == 15, "adaptDateTime(date string) - day is 15 (expected 15, got " + actualDay + ")");
        int actualHour = cal.get(Calendar.HOUR_OF_DAY);
        test(actualHour == 12, "adaptDateTime(date string) - hour is 12 (noon GMT default) (expected 12, got " + actualHour + ")");
        int actualMinute = cal.get(Calendar.MINUTE);
        test(actualMinute == 0, "adaptDateTime(date string) - minute is 0 (expected 0, got " + actualMinute + ")");
        int actualSecond = cal.get(Calendar.SECOND);
        test(actualSecond == 0, "adaptDateTime(date string) - second is 0 (expected 0, got " + actualSecond + ")");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_DateTimeString',
      javaCode: `
        // Test datetime strings preserve time
        Date dt = DateUtil.adaptDateTime("2024-03-15T15:30:45");
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);

        int actualYear = cal.get(Calendar.YEAR);
        test(actualYear == 2024, "adaptDateTime(datetime string) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = cal.get(Calendar.MONTH);
        test(actualMonth == 2, "adaptDateTime(datetime string) - month is March (2) (expected 2, got " + actualMonth + ")");
        int actualDay = cal.get(Calendar.DAY_OF_MONTH);
        test(actualDay == 15, "adaptDateTime(datetime string) - day is 15 (expected 15, got " + actualDay + ")");
        int actualHour = cal.get(Calendar.HOUR_OF_DAY);
        test(actualHour == 15, "adaptDateTime(datetime string) - hour is 15 (expected 15, got " + actualHour + ")");
        int actualMinute = cal.get(Calendar.MINUTE);
        test(actualMinute == 30, "adaptDateTime(datetime string) - minute is 30 (expected 30, got " + actualMinute + ")");
        int actualSecond = cal.get(Calendar.SECOND);
        test(actualSecond == 45, "adaptDateTime(datetime string) - second is 45 (expected 45, got " + actualSecond + ")");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_Number',
      javaCode: `
        // Test timestamp adaptation
        long timestamp = 1710511845000L; // 2024-03-15 14:10:45 GMT
        Date dt = DateUtil.adaptDateTime(timestamp);
        long actualTimestamp = dt.getTime();
        test(actualTimestamp == timestamp, "adaptDateTime(number) - timestamp preserved (expected " + timestamp + ", got " + actualTimestamp + ")");

        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);
        int actualHour = cal.get(Calendar.HOUR_OF_DAY);
        test(actualHour == 14, "adaptDateTime(number) - hour preserved (expected 14, got " + actualHour + ")");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_Date',
      javaCode: `
        // Test Date object adaptation - should preserve time
        Calendar inputCal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        inputCal.set(2024, 2, 15, 15, 30, 45);
        inputCal.set(Calendar.MILLISECOND, 0);
        Date inputDate = inputCal.getTime();

        Date dt = DateUtil.adaptDateTime(inputDate);
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(dt);

        int actualYear = cal.get(Calendar.YEAR);
        test(actualYear == 2024, "adaptDateTime(Date) - year is 2024 (expected 2024, got " + actualYear + ")");
        int actualMonth = cal.get(Calendar.MONTH);
        test(actualMonth == 2, "adaptDateTime(Date) - month is March (2) (expected 2, got " + actualMonth + ")");
        int actualDay = cal.get(Calendar.DAY_OF_MONTH);
        test(actualDay == 15, "adaptDateTime(Date) - day is 15 (expected 15, got " + actualDay + ")");
        int actualHour = cal.get(Calendar.HOUR_OF_DAY);
        test(actualHour == 15, "adaptDateTime(Date) - hour preserved as 15 (expected 15, got " + actualHour + ")");
        int actualMinute = cal.get(Calendar.MINUTE);
        test(actualMinute == 30, "adaptDateTime(Date) - minute preserved as 30 (expected 30, got " + actualMinute + ")");
        int actualSecond = cal.get(Calendar.SECOND);
        test(actualSecond == 45, "adaptDateTime(Date) - second preserved as 45 (expected 45, got " + actualSecond + ")");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_Null',
      javaCode: `
        // Test null handling
        Date dt = DateUtil.adaptDateTime(null);
        test(dt == null, "adaptDateTime(null) returns null");
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
      name: 'DateUtilTest_UTCTimePreservation',
      javaCode: `
        // Test that UTC times are preserved without conversion

        // Create a specific UTC time: 2024-03-15 14:30:00 GMT
        Calendar utcCal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        utcCal.set(2024, 2, 15, 14, 30, 0);
        utcCal.set(Calendar.MILLISECOND, 0);
        Date utcTime = utcCal.getTime();
        long originalTimestamp = utcTime.getTime();

        // Adapt using adaptDateTime (used by DateTimeUTC)
        Date adapted = DateUtil.adaptDateTime(utcTime);

        // Verify timestamp is preserved exactly
        long adaptedTimestamp = adapted.getTime();
        test(adaptedTimestamp == originalTimestamp,
             "adaptDateTime should preserve UTC timestamp exactly (expected " + originalTimestamp + ", got " + adaptedTimestamp + ")");

        // Verify all time components are preserved
        Calendar adaptedCal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        adaptedCal.setTime(adapted);
        int year = adaptedCal.get(Calendar.YEAR);
        int month = adaptedCal.get(Calendar.MONTH);
        int day = adaptedCal.get(Calendar.DAY_OF_MONTH);
        int hour = adaptedCal.get(Calendar.HOUR_OF_DAY);
        int minute = adaptedCal.get(Calendar.MINUTE);
        int second = adaptedCal.get(Calendar.SECOND);
        test(year == 2024, "Year preserved (expected 2024, got " + year + ")");
        test(month == 2, "Month preserved (expected 2, got " + month + ")");
        test(day == 15, "Date preserved (expected 15, got " + day + ")");
        test(hour == 14, "Hour preserved (expected 14, got " + hour + ")");
        test(minute == 30, "Minutes preserved (expected 30, got " + minute + ")");
        test(second == 0, "Seconds preserved (expected 0, got " + second + ")");

        // Test with a timestamp number
        long timestamp = 1710511800000L; // 2024-03-15 14:10:00 UTC
        Date fromTimestamp = DateUtil.adaptDateTime(timestamp);
        long actualTimestamp = fromTimestamp.getTime();
        test(actualTimestamp == timestamp, "Timestamp number should be preserved (expected " + timestamp + ", got " + actualTimestamp + ")");

        Calendar fromTimestampCal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        fromTimestampCal.setTime(fromTimestamp);
        int actualHour = fromTimestampCal.get(Calendar.HOUR_OF_DAY);
        test(actualHour == 14, "Hour from timestamp preserved (expected 14, got " + actualHour + ")");
      `
    },
    {
      name: 'DateUtilTest_TimezoneFormatting',
      javaCode: `
        // Test that format method correctly handles different timezones

        // Create a UTC time: 2024-03-15 20:00:00 GMT
        Calendar utcCal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        utcCal.set(2024, 2, 15, 20, 0, 0);
        utcCal.set(Calendar.MILLISECOND, 0);
        Date utcTime = utcCal.getTime();

        // Format in UTC (should show 20:00:00)
        String utcFormatted = DateUtil.format(utcTime, true, "UTC");
        test(utcFormatted.contains("20:00:00"), "UTC format should show 20:00:00, got: " + utcFormatted);

        // Format in different timezone (America/New_York is UTC-4 in March due to DST, so 20:00 UTC = 16:00 EDT)
        String nyFormatted = DateUtil.format(utcTime, true, "America/New_York");
        test(nyFormatted != null && nyFormatted.length() > 0,
             "Should format in America/New_York timezone");
        test(nyFormatted.contains("16:00:00"),
             "America/New_York should show 16:00:00 (UTC-4 due to DST), got: " + nyFormatted);

        // Format in another timezone (Asia/Tokyo is UTC+9, so 20:00 UTC = 05:00 JST next day)
        String tokyoFormatted = DateUtil.format(utcTime, true, "Asia/Tokyo");
        test(tokyoFormatted != null && tokyoFormatted.length() > 0,
             "Should format in Asia/Tokyo timezone");
        test(tokyoFormatted.contains("05:00:00"),
             "Asia/Tokyo should show 05:00:00 (UTC+9), got: " + tokyoFormatted);

        // Verify that the same timestamp formats differently in different timezones
        test(!utcFormatted.equals(nyFormatted),
             "UTC and New York formats should differ");
        test(!utcFormatted.equals(tokyoFormatted),
             "UTC and Tokyo formats should differ");

        // Test date-only format is consistent across timezones
        String utcDateOnly = DateUtil.format(utcTime, null, "UTC");
        test(utcDateOnly.contains("2024"), "Date-only format should contain year");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_UTC_Flag_DateTimeString',
      javaCode: `
        // Test parsing ISO 8601 datetime strings with forceUTC=true and false

        // Test with forceUTC=true
        Date dtUTC = DateUtil.adaptDateTime("2024-03-15T14:30:45", true);
        Calendar calUTC = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calUTC.setTime(dtUTC);
        int hourUTC = calUTC.get(Calendar.HOUR_OF_DAY);
        test(hourUTC == 14, "UTC flag=true with ISO datetime, hour should be 14 (expected 14, got " + hourUTC + ")");
        int minuteUTC = calUTC.get(Calendar.MINUTE);
        test(minuteUTC == 30, "UTC flag=true with ISO datetime, minute should be 30 (expected 30, got " + minuteUTC + ")");
        int secondUTC = calUTC.get(Calendar.SECOND);
        test(secondUTC == 45, "UTC flag=true with ISO datetime, second should be 45 (expected 45, got " + secondUTC + ")");

        // Test with forceUTC=false
        Date dtDefault = DateUtil.adaptDateTime("2024-03-15T14:30:45", false);
        Calendar calDefault = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calDefault.setTime(dtDefault);
        int hourDefault = calDefault.get(Calendar.HOUR_OF_DAY);
        test(hourDefault == 14, "UTC flag=false with ISO datetime, hour should be 14 (expected 14, got " + hourDefault + ")");
        int minuteDefault = calDefault.get(Calendar.MINUTE);
        test(minuteDefault == 30, "UTC flag=false with ISO datetime, minute should be 30 (expected 30, got " + minuteDefault + ")");
        int secondDefault = calDefault.get(Calendar.SECOND);
        test(secondDefault == 45, "UTC flag=false with ISO datetime, second should be 45 (expected 45, got " + secondDefault + ")");

        // Verify timestamps are equal (ISO format should always parse as GMT regardless of flag)
        long timeUTC = dtUTC.getTime();
        long timeDefault = dtDefault.getTime();
        test(timeUTC == timeDefault, "ISO format should parse same regardless of flag (expected " + timeUTC + ", got " + timeDefault + ")");

        // Test with space separator
        Date dtSpace = DateUtil.adaptDateTime("2024-03-15 14:30:45", true);
        Calendar calSpace = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calSpace.setTime(dtSpace);
        int hourSpace = calSpace.get(Calendar.HOUR_OF_DAY);
        test(hourSpace == 14, "UTC flag=true with space separator, hour should be 14 (expected 14, got " + hourSpace + ")");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_UTC_Flag_DateOnlyString',
      javaCode: `
        // Test parsing date-only strings with forceUTC=true and false

        // Test with forceUTC=true → should set to midnight UTC
        Date dtUTC = DateUtil.adaptDateTime("2024-03-15", true);
        Calendar calUTC = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calUTC.setTime(dtUTC);
        int yearUTC = calUTC.get(Calendar.YEAR);
        test(yearUTC == 2024, "UTC flag=true with date-only, year should be 2024 (expected 2024, got " + yearUTC + ")");
        int monthUTC = calUTC.get(Calendar.MONTH);
        test(monthUTC == 2, "UTC flag=true with date-only, month should be March/2 (expected 2, got " + monthUTC + ")");
        int dayUTC = calUTC.get(Calendar.DAY_OF_MONTH);
        test(dayUTC == 15, "UTC flag=true with date-only, day should be 15 (expected 15, got " + dayUTC + ")");
        int hourUTC = calUTC.get(Calendar.HOUR_OF_DAY);
        test(hourUTC == 0, "UTC flag=true with date-only, hour should be 0 (midnight UTC) (expected 0, got " + hourUTC + ")");
        int minuteUTC = calUTC.get(Calendar.MINUTE);
        test(minuteUTC == 0, "UTC flag=true with date-only, minute should be 0 (expected 0, got " + minuteUTC + ")");
        int secondUTC = calUTC.get(Calendar.SECOND);
        test(secondUTC == 0, "UTC flag=true with date-only, second should be 0 (expected 0, got " + secondUTC + ")");

        // Test with forceUTC=false → should use noon local time behavior
        Date dtDefault = DateUtil.adaptDateTime("2024-03-15", false);
        Calendar calDefault = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calDefault.setTime(dtDefault);
        int yearDefault = calDefault.get(Calendar.YEAR);
        test(yearDefault == 2024, "UTC flag=false with date-only, year should be 2024 (expected 2024, got " + yearDefault + ")");
        int monthDefault = calDefault.get(Calendar.MONTH);
        test(monthDefault == 2, "UTC flag=false with date-only, month should be March/2 (expected 2, got " + monthDefault + ")");
        int dayDefault = calDefault.get(Calendar.DAY_OF_MONTH);
        test(dayDefault == 15, "UTC flag=false with date-only, day should be 15 (expected 15, got " + dayDefault + ")");
        int hourDefault = calDefault.get(Calendar.HOUR_OF_DAY);
        test(hourDefault == 12, "UTC flag=false with date-only, hour should be 12 (noon GMT default) (expected 12, got " + hourDefault + ")");

        // Verify timestamps differ (midnight UTC vs noon GMT)
        long timeUTC = dtUTC.getTime();
        long timeDefault = dtDefault.getTime();
        long diff = timeDefault - timeUTC;
        long expectedDiff = 12 * 60 * 60 * 1000L; // 12 hours in milliseconds
        test(diff == expectedDiff, "Timestamps should differ by 12 hours (expected " + expectedDiff + ", got " + diff + ")");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_UTC_Flag_USFormatString',
      javaCode: `
        // Test parsing US format strings with forceUTC=true and false

        // Test US format with time: MM/DD/YYYY HH:MM:SS
        Date dtUTC1 = DateUtil.adaptDateTime("03/15/2024 14:30:45", true);
        Calendar calUTC1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calUTC1.setTime(dtUTC1);
        int hourUTC1 = calUTC1.get(Calendar.HOUR_OF_DAY);
        test(hourUTC1 == 14, "UTC flag=true with US datetime, hour should be 14 (expected 14, got " + hourUTC1 + ")");
        int minuteUTC1 = calUTC1.get(Calendar.MINUTE);
        test(minuteUTC1 == 30, "UTC flag=true with US datetime, minute should be 30 (expected 30, got " + minuteUTC1 + ")");

        Date dtDefault1 = DateUtil.adaptDateTime("03/15/2024 14:30:45", false);
        Calendar calDefault1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calDefault1.setTime(dtDefault1);
        int hourDefault1 = calDefault1.get(Calendar.HOUR_OF_DAY);
        test(hourDefault1 == 14, "UTC flag=false with US datetime, hour should be 14 (expected 14, got " + hourDefault1 + ")");

        // Verify timestamps are equal (should both parse as GMT)
        long timeUTC1 = dtUTC1.getTime();
        long timeDefault1 = dtDefault1.getTime();
        test(timeUTC1 == timeDefault1, "US datetime format should parse same regardless of flag (expected " + timeUTC1 + ", got " + timeDefault1 + ")");

        // Test US format with date only: MM/DD/YYYY
        Date dtUTC2 = DateUtil.adaptDateTime("03/15/2024", true);
        Calendar calUTC2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calUTC2.setTime(dtUTC2);
        int hourUTC2 = calUTC2.get(Calendar.HOUR_OF_DAY);
        test(hourUTC2 == 0, "UTC flag=true with US date-only, hour should be 0 (midnight UTC) (expected 0, got " + hourUTC2 + ")");

        Date dtDefault2 = DateUtil.adaptDateTime("03/15/2024", false);
        Calendar calDefault2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calDefault2.setTime(dtDefault2);
        int hourDefault2 = calDefault2.get(Calendar.HOUR_OF_DAY);
        test(hourDefault2 == 12, "UTC flag=false with US date-only, hour should be 12 (noon GMT) (expected 12, got " + hourDefault2 + ")");

        // Verify date-only formats differ by 12 hours
        long timeUTC2 = dtUTC2.getTime();
        long timeDefault2 = dtDefault2.getTime();
        long diff2 = timeDefault2 - timeUTC2;
        long expectedDiff2 = 12 * 60 * 60 * 1000L;
        test(diff2 == expectedDiff2, "US date-only should differ by 12 hours (expected " + expectedDiff2 + ", got " + diff2 + ")");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_UTC_Flag_NumbersAndDates',
      javaCode: `
        // Test that UTC flag does NOT affect numbers and Date objects (always preserved exactly)

        // Test with timestamp number
        long timestamp = 1710511845000L; // 2024-03-15 14:10:45 GMT

        Date dtUTCNum = DateUtil.adaptDateTime(timestamp, true);
        long actualUTCNum = dtUTCNum.getTime();
        test(actualUTCNum == timestamp, "UTC flag=true with number, timestamp should be preserved exactly (expected " + timestamp + ", got " + actualUTCNum + ")");

        Date dtDefaultNum = DateUtil.adaptDateTime(timestamp, false);
        long actualDefaultNum = dtDefaultNum.getTime();
        test(actualDefaultNum == timestamp, "UTC flag=false with number, timestamp should be preserved exactly (expected " + timestamp + ", got " + actualDefaultNum + ")");

        // Verify both are equal
        test(actualUTCNum == actualDefaultNum, "Timestamp numbers should be identical regardless of flag (expected " + actualUTCNum + ", got " + actualDefaultNum + ")");

        // Test with Date object
        Calendar inputCal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        inputCal.set(2024, 2, 15, 15, 30, 45);
        inputCal.set(Calendar.MILLISECOND, 0);
        Date inputDate = inputCal.getTime();
        long inputTimestamp = inputDate.getTime();

        Date dtUTCDate = DateUtil.adaptDateTime(inputDate, true);
        long actualUTCDate = dtUTCDate.getTime();
        test(actualUTCDate == inputTimestamp, "UTC flag=true with Date object, timestamp should be preserved exactly (expected " + inputTimestamp + ", got " + actualUTCDate + ")");

        Date dtDefaultDate = DateUtil.adaptDateTime(inputDate, false);
        long actualDefaultDate = dtDefaultDate.getTime();
        test(actualDefaultDate == inputTimestamp, "UTC flag=false with Date object, timestamp should be preserved exactly (expected " + inputTimestamp + ", got " + actualDefaultDate + ")");

        // Verify both are equal
        test(actualUTCDate == actualDefaultDate, "Date objects should be identical regardless of flag (expected " + actualUTCDate + ", got " + actualDefaultDate + ")");

        // Verify hour component is preserved in Date objects
        Calendar calUTCDate = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calUTCDate.setTime(dtUTCDate);
        int hourUTCDate = calUTCDate.get(Calendar.HOUR_OF_DAY);
        test(hourUTCDate == 15, "Date object with UTC flag, hour should be preserved as 15 (expected 15, got " + hourUTCDate + ")");
      `
    },
    {
      name: 'DateUtilTest_adaptDateTime_BackwardCompatibility',
      javaCode: `
        // Test that calling adaptDateTime without second parameter works (backward compatibility)

        // Test with date-only string (should use default behavior: noon GMT)
        Date dt1 = DateUtil.adaptDateTime("2024-03-15");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(dt1);
        int year1 = cal1.get(Calendar.YEAR);
        test(year1 == 2024, "adaptDateTime(string) without flag, year should be 2024 (expected 2024, got " + year1 + ")");
        int hour1 = cal1.get(Calendar.HOUR_OF_DAY);
        test(hour1 == 12, "adaptDateTime(string) without flag, hour should be 12 (noon GMT default) (expected 12, got " + hour1 + ")");

        // Test with datetime string (should preserve time)
        Date dt2 = DateUtil.adaptDateTime("2024-03-15T14:30:45");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(dt2);
        int hour2 = cal2.get(Calendar.HOUR_OF_DAY);
        test(hour2 == 14, "adaptDateTime(datetime string) without flag, hour should be 14 (expected 14, got " + hour2 + ")");
        int minute2 = cal2.get(Calendar.MINUTE);
        test(minute2 == 30, "adaptDateTime(datetime string) without flag, minute should be 30 (expected 30, got " + minute2 + ")");

        // Test with timestamp number (should preserve exactly)
        long timestamp = 1710511845000L;
        Date dt3 = DateUtil.adaptDateTime(timestamp);
        long actual3 = dt3.getTime();
        test(actual3 == timestamp, "adaptDateTime(number) without flag, timestamp should be preserved (expected " + timestamp + ", got " + actual3 + ")");

        // Test with Date object (should preserve exactly)
        Calendar inputCal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        inputCal.set(2024, 2, 15, 15, 30, 45);
        inputCal.set(Calendar.MILLISECOND, 0);
        Date inputDate = inputCal.getTime();
        Date dt4 = DateUtil.adaptDateTime(inputDate);
        long actual4 = dt4.getTime();
        long expected4 = inputDate.getTime();
        test(actual4 == expected4, "adaptDateTime(Date) without flag, timestamp should be preserved (expected " + expected4 + ", got " + actual4 + ")");

        // Test with null
        Date dt5 = DateUtil.adaptDateTime(null);
        test(dt5 == null, "adaptDateTime(null) without flag should return null");

        // Verify backward compatibility: 1-param call should behave identically to 2-param call with false
        Date dt6a = DateUtil.adaptDateTime("2024-03-15");
        Date dt6b = DateUtil.adaptDateTime("2024-03-15", false);
        long time6a = dt6a.getTime();
        long time6b = dt6b.getTime();
        test(time6a == time6b, "adaptDateTime(string) should equal adaptDateTime(string, false) (expected " + time6a + ", got " + time6b + ")");
      `
    }
  ]
});
