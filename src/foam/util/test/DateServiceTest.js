/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'DateServiceTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.util.DateService',
    'java.time.LocalDate',
    'java.time.LocalDateTime',
    'java.time.ZoneId',
    'java.util.Calendar',
    'java.util.Date',
    'java.util.TimeZone'
  ],

  imports: [
    'dateService'
  ],

  documentation: 'Test DateService functionality',

  properties: [
    {
      class: 'Proxy',
      of: 'foam.util.DateService',
      name: 'dateService',
      topics: [],
      factory: function() {
        return this.__context__.dateService;
      },
      javaFactory: 'return (foam.util.DateService) getX().get("dateService");'
    }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DateServiceTest_parseDateString_YYYYMMDD();
        DateServiceTest_parseDateString_YYYY_MM_DD();
        DateServiceTest_parseDateString_MMDDYYYY();
        DateServiceTest_parseDateString_MM_DD_YYYY();
        DateServiceTest_parseDateString_YYMMDD();
        DateServiceTest_parseDateString_YY_MM_DD();
        DateServiceTest_parseDateString_InvalidDate();
        DateServiceTest_parseDateString_UnsupportedFormat();
        DateServiceTest_parseDateString_LeapYear();
        DateServiceTest_parseDateString_NonLeapYear();
        DateServiceTest_parseDateString_TrailingText();
        DateServiceTest_parseDateString_MonthBoundaries();
        DateServiceTest_parseDateString_YearBoundaries();
        DateServiceTest_parseDateString_FormatAmbiguity();
        DateServiceTest_parseDateString_TwoDigitYearBoundary();
        DateServiceTest_parseDateString_InvalidFormats();
        DateServiceTest_parseDateString_EmptyAndWhitespace();
        DateServiceTest_adapt_Number();
        DateServiceTest_adapt_String();
        DateServiceTest_adapt_Date();
        DateServiceTest_adapt_Null();
        DateServiceTest_adapt_InvalidString();
        DateServiceTest_adapt_EmptyString();
        DateServiceTest_adapt_WhitespaceString();
        DateServiceTest_adapt_AllFormats();
        DateServiceTest_getTimeZoneId();
        DateServiceTest_localDateToDate_1Param();
        DateServiceTest_localDateToDate_2Params();
        DateServiceTest_localDateTimeToDate_1Param();
        DateServiceTest_localDateTimeToDate_2Params();
        DateServiceTest_dateToLocalDate_1Param();
        DateServiceTest_dateToLocalDate_2Params();
        DateServiceTest_dateToLocalDateTime_1Param();
        DateServiceTest_dateToLocalDateTime_2Params();
        DateServiceTest_parseDateTimeString_ISO8601_Full();
        DateServiceTest_parseDateTimeString_ISO8601_Short();
        DateServiceTest_parseDateTimeString_ISO8601_Milliseconds();
        DateServiceTest_parseDateTimeString_US_Format_Full();
        DateServiceTest_parseDateTimeString_US_Format_Short();
        DateServiceTest_parseDateTimeString_Compact_Format();
        DateServiceTest_parseDateTimeString_Invalid_Time();
        DateServiceTest_parseDateTimeString_Time_Boundaries();
        DateServiceTest_parseDateTimeString_UnsupportedFormat();
        DateServiceTest_parseDateTimeString_Empty();
      `
    },
    {
      name: 'DateServiceTest_parseDateString_YYYYMMDD',
      javaCode: `
        try {
          Date date = getDateService().parseDateString(getX(), "20240315");
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
      name: 'DateServiceTest_parseDateString_YYYY_MM_DD',
      javaCode: `
        try {
          // Test with slash separator
          Date date1 = getDateService().parseDateString(getX(), "2024/03/15");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "YYYY/MM/DD format - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "YYYY/MM/DD format - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYY/MM/DD format - day is 15");

          // Test with dash separator
          Date date2 = getDateService().parseDateString(getX(), "2024-03-15");
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
      name: 'DateServiceTest_parseDateString_MMDDYYYY',
      javaCode: `
        try {
          Date date = getDateService().parseDateString(getX(), "03152024");
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
      name: 'DateServiceTest_parseDateString_MM_DD_YYYY',
      javaCode: `
        try {
          // Test with slash separator
          Date date1 = getDateService().parseDateString(getX(), "03/15/2024");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "MM/DD/YYYY format - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "MM/DD/YYYY format - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "MM/DD/YYYY format - day is 15");

          // Test with dash separator
          Date date2 = getDateService().parseDateString(getX(), "03-15-2024");
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
      name: 'DateServiceTest_parseDateString_YYMMDD',
      javaCode: `
        try {
          // Test 2-digit year < 50 (assumes 2000s)
          Date date1 = getDateService().parseDateString(getX(), "240315");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "YYMMDD format (YY=24) - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "YYMMDD format (YY=24) - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYMMDD format (YY=24) - day is 15");

          // Test 2-digit year >= 50 (assumes 1900s)
          Date date2 = getDateService().parseDateString(getX(), "850315");
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
      name: 'DateServiceTest_parseDateString_YY_MM_DD',
      javaCode: `
        try {
          // Test with slash separator
          Date date1 = getDateService().parseDateString(getX(), "24/03/15");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "YY/MM/DD format - year is 2024");

          // Test with dash separator
          Date date2 = getDateService().parseDateString(getX(), "85-03-15");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 1985, "YY-MM-DD format - year is 1985");
        } catch ( Exception e ) {
          test(false, "YY/MM/DD or YY-MM-DD format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateString_InvalidDate',
      javaCode: `
        try {
          // Test invalid date like February 30th
          Date date = getDateService().parseDateString(getX(), "2024-02-30");
          test(false, "Invalid date (Feb 30) should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid date"), "Invalid date throws correct error message");
        } catch ( Exception e ) {
          test(false, "Invalid date should throw RuntimeException, not " + e.getClass().getSimpleName());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateString_UnsupportedFormat',
      javaCode: `
        try {
          Date date = getDateService().parseDateString(getX(), "March 15, 2024");
          test(false, "Unsupported format should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported Date format"), "Unsupported format throws correct error message");
        } catch ( Exception e ) {
          test(false, "Unsupported format should throw RuntimeException, not " + e.getClass().getSimpleName());
        }
      `
    },
    {
      name: 'DateServiceTest_adapt_Number',
      javaCode: `
        long timestamp = 1710489600000L; // March 15, 2024 12:00:00 GMT
        Date date = getDateService().adapt(getX(), timestamp);

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
      name: 'DateServiceTest_adapt_String',
      javaCode: `
        Date date = getDateService().adapt(getX(), "2024-03-15");

        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.setTime(date);

        test(cal.get(Calendar.YEAR) == 2024, "adapt(String) - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "adapt(String) - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "adapt(String) - day is 15");
        test(cal.get(Calendar.HOUR_OF_DAY) == 12, "adapt(String) - hour is 12 (noon GMT)");
      `
    },
    {
      name: 'DateServiceTest_adapt_Date',
      javaCode: `
        Calendar inputCal = Calendar.getInstance();
        inputCal.set(2024, 2, 15, 8, 30, 45); // March 15, 2024 08:30:45
        Date inputDate = inputCal.getTime();

        Date adaptedDate = getDateService().adapt(getX(), inputDate);

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
      name: 'DateServiceTest_adapt_Null',
      javaCode: `
        Date date = getDateService().adapt(getX(), null);
        test(date == null, "adapt(null) returns null");
      `
    },
    {
      name: 'DateServiceTest_adapt_InvalidString',
      javaCode: `
        Date date = getDateService().adapt(getX(), "invalid date string");
        test(date == getDateService().getMaxDate(getX()), "adapt(invalid string) returns MAX_DATE");
      `
    },
    {
      name: 'DateServiceTest_getTimeZoneId',
      javaCode: `
        // Test with null/empty string (should return system default)
        ZoneId zone1 = getDateService().getTimeZoneId(getX(), null);
        test(zone1 != null, "getTimeZoneId(null) returns non-null zone");

        ZoneId zone2 = getDateService().getTimeZoneId(getX(), "");
        test(zone2 != null, "getTimeZoneId(\\"\\") returns non-null zone");

        // Note: Testing with actual timezone requires timeZoneDAO to be set up in context
        // which is typically done in integration tests, not unit tests
      `
    },
    {
      name: 'DateServiceTest_localDateToDate_1Param',
      javaCode: `
        LocalDate localDate = LocalDate.of(2024, 3, 15);
        Date date = getDateService().localDateToDate(getX(), localDate);

        Calendar cal = Calendar.getInstance();
        cal.setTime(date);

        test(cal.get(Calendar.YEAR) == 2024, "localDateToDate(LocalDate) - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "localDateToDate(LocalDate) - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "localDateToDate(LocalDate) - day is 15");
      `
    },
    {
      name: 'DateServiceTest_localDateToDate_2Params',
      javaCode: `
        LocalDate localDate = LocalDate.of(2024, 3, 15);
        ZoneId zone = ZoneId.of("America/New_York");
        Date date = getDateService().localDateToDateWithZone(getX(), localDate, zone);

        test(date != null, "localDateToDate(LocalDate, ZoneId) returns non-null date");
      `
    },
    {
      name: 'DateServiceTest_localDateTimeToDate_1Param',
      javaCode: `
        LocalDateTime localDateTime = LocalDateTime.of(2024, 3, 15, 14, 30, 0);
        Date date = getDateService().localDateTimeToDate(getX(), localDateTime);

        Calendar cal = Calendar.getInstance();
        cal.setTime(date);

        test(cal.get(Calendar.YEAR) == 2024, "localDateTimeToDate(LocalDateTime) - year is 2024");
        test(cal.get(Calendar.MONTH) == 2, "localDateTimeToDate(LocalDateTime) - month is March (2)");
        test(cal.get(Calendar.DAY_OF_MONTH) == 15, "localDateTimeToDate(LocalDateTime) - day is 15");
      `
    },
    {
      name: 'DateServiceTest_localDateTimeToDate_2Params',
      javaCode: `
        LocalDateTime localDateTime = LocalDateTime.of(2024, 3, 15, 14, 30, 0);
        ZoneId zone = ZoneId.of("America/New_York");
        Date date = getDateService().localDateTimeToDateWithZone(getX(), localDateTime, zone);

        test(date != null, "localDateTimeToDate(LocalDateTime, ZoneId) returns non-null date");
      `
    },
    {
      name: 'DateServiceTest_dateToLocalDate_1Param',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.set(2024, 2, 15, 14, 30, 45); // March 15, 2024 14:30:45
        Date date = cal.getTime();

        LocalDate localDate = getDateService().dateToLocalDate(getX(), date);

        test(localDate.getYear() == 2024, "dateToLocalDate(Date) - year is 2024");
        test(localDate.getMonthValue() == 3, "dateToLocalDate(Date) - month is 3 (March)");
        test(localDate.getDayOfMonth() == 15, "dateToLocalDate(Date) - day is 15");
      `
    },
    {
      name: 'DateServiceTest_dateToLocalDate_2Params',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.set(2024, 2, 15, 14, 30, 45);
        Date date = cal.getTime();

        ZoneId zone = ZoneId.of("America/New_York");
        LocalDate localDate = getDateService().dateToLocalDateWithZone(getX(), date, zone);

        test(localDate != null, "dateToLocalDate(Date, ZoneId) returns non-null LocalDate");
      `
    },
    {
      name: 'DateServiceTest_dateToLocalDateTime_1Param',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.set(2024, 2, 15, 14, 30, 45);
        Date date = cal.getTime();

        LocalDateTime localDateTime = getDateService().dateToLocalDateTime(getX(), date);

        test(localDateTime.getYear() == 2024, "dateToLocalDateTime(Date) - year is 2024");
        test(localDateTime.getMonthValue() == 3, "dateToLocalDateTime(Date) - month is 3 (March)");
        test(localDateTime.getDayOfMonth() == 15, "dateToLocalDateTime(Date) - day is 15");
      `
    },
    {
      name: 'DateServiceTest_dateToLocalDateTime_2Params',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.set(2024, 2, 15, 14, 30, 45);
        Date date = cal.getTime();

        ZoneId zone = ZoneId.of("America/New_York");
        LocalDateTime localDateTime = getDateService().dateToLocalDateTimeWithZone(getX(), date, zone);

        test(localDateTime != null, "dateToLocalDateTime(Date, ZoneId) returns non-null LocalDateTime");
      `
    },
    {
      name: 'DateServiceTest_parseDateString_LeapYear',
      javaCode: `
        try {
          // Test valid leap year date
          Date date = getDateService().parseDateString(getX(), "2024-02-29");
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
      name: 'DateServiceTest_parseDateString_NonLeapYear',
      javaCode: `
        try {
          // Test invalid Feb 29 in non-leap year
          Date date = getDateService().parseDateString(getX(), "2023-02-29");
          test(false, "Non-leap year - Feb 29, 2023 should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid date"), "Non-leap year Feb 29 throws error");
        } catch ( Exception e ) {
          test(false, "Non-leap year should throw RuntimeException: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateString_TrailingText',
      javaCode: `
        try {
          // Test dates with trailing text (regex allows .* at end)
          Date date1 = getDateService().parseDateString(getX(), "2024-03-15 extra text here");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "Trailing text - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "Trailing text - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "Trailing text - day is 15");

          Date date2 = getDateService().parseDateString(getX(), "20240315T12:00:00");
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
      name: 'DateServiceTest_parseDateString_MonthBoundaries',
      javaCode: `
        try {
          // Test last day of various months
          Date jan31 = getDateService().parseDateString(getX(), "2024-01-31");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(jan31);
          test(cal1.get(Calendar.DAY_OF_MONTH) == 31, "Jan has 31 days");

          Date apr30 = getDateService().parseDateString(getX(), "2024-04-30");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(apr30);
          test(cal2.get(Calendar.DAY_OF_MONTH) == 30, "Apr has 30 days");
        } catch ( Exception e ) {
          test(false, "Valid month boundaries should not throw exception: " + e.getMessage());
        }

        // Test invalid dates
        try {
          getDateService().parseDateString(getX(), "2024-04-31");
          test(false, "Apr 31 should throw exception");
        } catch ( RuntimeException e ) {
          test(true, "Apr 31 is invalid");
        }

        try {
          getDateService().parseDateString(getX(), "2024-02-31");
          test(false, "Feb 31 should throw exception");
        } catch ( RuntimeException e ) {
          test(true, "Feb 31 is invalid");
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateString_YearBoundaries',
      javaCode: `
        try {
          // Test minimum 4-digit year (1000)
          Date date1 = getDateService().parseDateString(getX(), "1000-01-01");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 1000, "Year 1000 is valid");

          // Test maximum reasonable 4-digit year
          Date date2 = getDateService().parseDateString(getX(), "9999-12-31");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 9999, "Year 9999 is valid");

          // Test year starting with 0 doesn't match YYYYMMDD pattern
          Date date3 = getDateService().parseDateString(getX(), "01012024");
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
      name: 'DateServiceTest_parseDateString_FormatAmbiguity',
      javaCode: `
        try {
          // Test that format priority is correct for ambiguous 8-digit strings
          Date date1 = getDateService().parseDateString(getX(), "20240315");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "Ambiguous 8-digit - 20240315 is YYYYMMDD");
          test(cal1.get(Calendar.MONTH) == 2, "Ambiguous 8-digit - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "Ambiguous 8-digit - day is 15");

          Date date2 = getDateService().parseDateString(getX(), "03152024");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 2024, "Ambiguous 8-digit - 03152024 is MMDDYYYY");
          test(cal2.get(Calendar.MONTH) == 2, "Ambiguous 8-digit - month is March (2)");
          test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "Ambiguous 8-digit - day is 15");

          Date date3 = getDateService().parseDateString(getX(), "10012024");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(date3);
          test(cal3.get(Calendar.YEAR) == 2024, "Ambiguous 8-digit - 10012024 is MMDDYYYY");
          test(cal3.get(Calendar.MONTH) == 9, "Ambiguous 8-digit - month is October (9)");
          test(cal3.get(Calendar.DAY_OF_MONTH) == 1, "Ambiguous 8-digit - day is 1");

          Date date4 = getDateService().parseDateString(getX(), "01102024");
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
      name: 'DateServiceTest_parseDateString_TwoDigitYearBoundary',
      javaCode: `
        try {
          // Test 2-digit year < 50 becomes 2000s
          Date date1 = getDateService().parseDateString(getX(), "49-12-31");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2049, "2-digit year 49 becomes 2049");

          Date date2 = getDateService().parseDateString(getX(), "00-01-01");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 2000, "2-digit year 00 becomes 2000");

          // Test 2-digit year >= 50 becomes 1900s
          Date date3 = getDateService().parseDateString(getX(), "50-01-01");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(date3);
          test(cal3.get(Calendar.YEAR) == 1950, "2-digit year 50 becomes 1950");

          Date date4 = getDateService().parseDateString(getX(), "99-12-31");
          Calendar cal4 = Calendar.getInstance();
          cal4.setTime(date4);
          test(cal4.get(Calendar.YEAR) == 1999, "2-digit year 99 becomes 1999");
        } catch ( Exception e ) {
          test(false, "2-digit year boundary tests should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateString_InvalidFormats',
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
            getDateService().parseDateString(getX(), format);
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
            getDateService().parseDateString(getX(), format);
            test(false, "Invalid date \\"" + format + "\\" should throw exception");
          } catch ( RuntimeException e ) {
            test(e.getMessage().contains("Cannot parse invalid date"), "Date \\"" + format + "\\" throws \\"Cannot parse invalid date\\"");
          }
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateString_EmptyAndWhitespace',
      javaCode: `
        try {
          getDateService().parseDateString(getX(), "");
          test(false, "Empty string should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported Date format"), "Empty string throws error");
        }

        try {
          getDateService().parseDateString(getX(), "   ");
          test(false, "Whitespace string should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported Date format"), "Whitespace throws error");
        }
      `
    },
    {
      name: 'DateServiceTest_adapt_EmptyString',
      javaCode: `
        Date date = getDateService().adapt(getX(), "");
        test(date == getDateService().getMaxDate(getX()), "adapt(empty string) returns MAX_DATE");
      `
    },
    {
      name: 'DateServiceTest_adapt_WhitespaceString',
      javaCode: `
        Date date = getDateService().adapt(getX(), "   ");
        test(date == getDateService().getMaxDate(getX()), "adapt(whitespace) returns MAX_DATE");
      `
    },
    {
      name: 'DateServiceTest_adapt_AllFormats',
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
          Date date = getDateService().adapt(getX(), format);
          Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "adapt(\\"" + format + "\\") - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "adapt(\\"" + format + "\\") - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "adapt(\\"" + format + "\\") - day is 15");
          test(cal.get(Calendar.HOUR_OF_DAY) == 12, "adapt(\\"" + format + "\\") - normalized to noon GMT");
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_ISO8601_Full',
      javaCode: `
        try {
          // Test YYYY-MM-DDTHH:MM:SS
          Date date1 = getDateService().parseDateTimeString(getX(), "2024-03-15T14:30:45");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "ISO8601 full - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "ISO8601 full - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "ISO8601 full - day is 15");
          test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "ISO8601 full - hour is 14");
          test(cal1.get(Calendar.MINUTE) == 30, "ISO8601 full - minute is 30");
          test(cal1.get(Calendar.SECOND) == 45, "ISO8601 full - second is 45");

          // Test YYYY-MM-DD HH:MM:SS (space separator)
          Date date2 = getDateService().parseDateTimeString(getX(), "2024-03-15 14:30:45");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.YEAR) == 2024, "ISO8601 space - year is 2024");
          test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "ISO8601 space - hour is 14");
          test(cal2.get(Calendar.MINUTE) == 30, "ISO8601 space - minute is 30");
          test(cal2.get(Calendar.SECOND) == 45, "ISO8601 space - second is 45");
        } catch ( Exception e ) {
          test(false, "ISO8601 full format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_ISO8601_Short',
      javaCode: `
        try {
          // Test YYYY-MM-DDTHH:MM
          Date date1 = getDateService().parseDateTimeString(getX(), "2024-03-15T14:30");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(date1);
          test(cal1.get(Calendar.YEAR) == 2024, "ISO8601 short - year is 2024");
          test(cal1.get(Calendar.MONTH) == 2, "ISO8601 short - month is March (2)");
          test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "ISO8601 short - day is 15");
          test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "ISO8601 short - hour is 14");
          test(cal1.get(Calendar.MINUTE) == 30, "ISO8601 short - minute is 30");
          test(cal1.get(Calendar.SECOND) == 0, "ISO8601 short - second defaults to 0");

          // Test YYYY-MM-DD HH:MM (space separator)
          Date date2 = getDateService().parseDateTimeString(getX(), "2024-03-15 14:30");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(date2);
          test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "ISO8601 short space - hour is 14");
          test(cal2.get(Calendar.MINUTE) == 30, "ISO8601 short space - minute is 30");
          test(cal2.get(Calendar.SECOND) == 0, "ISO8601 short space - second defaults to 0");
        } catch ( Exception e ) {
          test(false, "ISO8601 short format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_ISO8601_Milliseconds',
      javaCode: `
        try {
          // Test YYYY-MM-DDTHH:MM:SS.sss
          Date date = getDateService().parseDateTimeString(getX(), "2024-03-15T14:30:45.123");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "ISO8601 with ms - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "ISO8601 with ms - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "ISO8601 with ms - day is 15");
          test(cal.get(Calendar.HOUR_OF_DAY) == 14, "ISO8601 with ms - hour is 14");
          test(cal.get(Calendar.MINUTE) == 30, "ISO8601 with ms - minute is 30");
          test(cal.get(Calendar.SECOND) == 45, "ISO8601 with ms - second is 45");
          test(cal.get(Calendar.MILLISECOND) == 123, "ISO8601 with ms - millisecond is 123");
        } catch ( Exception e ) {
          test(false, "ISO8601 with milliseconds should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_US_Format_Full',
      javaCode: `
        try {
          // Test MM/DD/YYYY HH:MM:SS
          Date date = getDateService().parseDateTimeString(getX(), "03/15/2024 14:30:45");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "US format full - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "US format full - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "US format full - day is 15");
          test(cal.get(Calendar.HOUR_OF_DAY) == 14, "US format full - hour is 14");
          test(cal.get(Calendar.MINUTE) == 30, "US format full - minute is 30");
          test(cal.get(Calendar.SECOND) == 45, "US format full - second is 45");
        } catch ( Exception e ) {
          test(false, "US format full should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_US_Format_Short',
      javaCode: `
        try {
          // Test MM/DD/YYYY HH:MM
          Date date = getDateService().parseDateTimeString(getX(), "03/15/2024 14:30");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "US format short - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "US format short - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "US format short - day is 15");
          test(cal.get(Calendar.HOUR_OF_DAY) == 14, "US format short - hour is 14");
          test(cal.get(Calendar.MINUTE) == 30, "US format short - minute is 30");
          test(cal.get(Calendar.SECOND) == 0, "US format short - second defaults to 0");
        } catch ( Exception e ) {
          test(false, "US format short should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_Compact_Format',
      javaCode: `
        try {
          // Test YYYYMMDDHHMMSS
          Date date = getDateService().parseDateTimeString(getX(), "20240315143045");
          Calendar cal = Calendar.getInstance();
          cal.setTime(date);
          test(cal.get(Calendar.YEAR) == 2024, "Compact format - year is 2024");
          test(cal.get(Calendar.MONTH) == 2, "Compact format - month is March (2)");
          test(cal.get(Calendar.DAY_OF_MONTH) == 15, "Compact format - day is 15");
          test(cal.get(Calendar.HOUR_OF_DAY) == 14, "Compact format - hour is 14");
          test(cal.get(Calendar.MINUTE) == 30, "Compact format - minute is 30");
          test(cal.get(Calendar.SECOND) == 45, "Compact format - second is 45");
        } catch ( Exception e ) {
          test(false, "Compact format should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_Invalid_Time',
      javaCode: `
        try {
          getDateService().parseDateTimeString(getX(), "2024-03-15T25:00:00");
          test(false, "Invalid hour (25) should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid datetime"), "Invalid hour throws correct error");
        }

        try {
          getDateService().parseDateTimeString(getX(), "2024-03-15T14:60:00");
          test(false, "Invalid minute (60) should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid datetime"), "Invalid minute throws correct error");
        }

        try {
          getDateService().parseDateTimeString(getX(), "2024-03-15T14:30:60");
          test(false, "Invalid second (60) should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Cannot parse invalid datetime"), "Invalid second throws correct error");
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_Time_Boundaries',
      javaCode: `
        try {
          // Test midnight
          Date midnight = getDateService().parseDateTimeString(getX(), "2024-03-15T00:00:00");
          Calendar cal1 = Calendar.getInstance();
          cal1.setTime(midnight);
          test(cal1.get(Calendar.HOUR_OF_DAY) == 0, "Midnight - hour is 0");
          test(cal1.get(Calendar.MINUTE) == 0, "Midnight - minute is 0");
          test(cal1.get(Calendar.SECOND) == 0, "Midnight - second is 0");

          // Test end of day
          Date endOfDay = getDateService().parseDateTimeString(getX(), "2024-03-15T23:59:59");
          Calendar cal2 = Calendar.getInstance();
          cal2.setTime(endOfDay);
          test(cal2.get(Calendar.HOUR_OF_DAY) == 23, "End of day - hour is 23");
          test(cal2.get(Calendar.MINUTE) == 59, "End of day - minute is 59");
          test(cal2.get(Calendar.SECOND) == 59, "End of day - second is 59");

          // Test noon
          Date noon = getDateService().parseDateTimeString(getX(), "2024-03-15T12:00:00");
          Calendar cal3 = Calendar.getInstance();
          cal3.setTime(noon);
          test(cal3.get(Calendar.HOUR_OF_DAY) == 12, "Noon - hour is 12");
        } catch ( Exception e ) {
          test(false, "Time boundaries should not throw exception: " + e.getMessage());
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_UnsupportedFormat',
      javaCode: `
        try {
          getDateService().parseDateTimeString(getX(), "March 15, 2024 2:30 PM");
          test(false, "Unsupported datetime format should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported DateTime format"), "Unsupported format throws correct error");
        }
      `
    },
    {
      name: 'DateServiceTest_parseDateTimeString_Empty',
      javaCode: `
        try {
          getDateService().parseDateTimeString(getX(), "");
          test(false, "Empty string should throw exception");
        } catch ( RuntimeException e ) {
          test(e.getMessage().contains("Unsupported DateTime format"), "Empty string throws error");
        }
      `
    }
  ]
});
