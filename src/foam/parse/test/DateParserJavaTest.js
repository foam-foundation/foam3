/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'DateParserJavaTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.parse.DateParser',
    'java.util.Calendar',
    'java.util.Date',
    'java.util.TimeZone'
  ],

  documentation: 'Comprehensive Java tests for DateParser covering all formats',

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // YYYYMMDD Format Tests
        DateParserTest_YYYYMMDD_Separated();
        DateParserTest_YYYYMMDD_Compact();
        DateParserTest_YYYYMMDD_WithTime();
        DateParserTest_YYYYMMDD_WithTimezone();

        // MMDDYYYY Format Tests
        DateParserTest_MMDDYYYY_Separated();
        DateParserTest_MMDDYYYY_Compact();
        DateParserTest_MMDDYYYY_WithTime();

        // YYMMDD Format Tests
        DateParserTest_YYMMDD_Separated();
        DateParserTest_YYMMDD_Compact();
        DateParserTest_YYMMDD_TwoDigitYearPivot();

        // DDMMYYYY Format Tests (via opt_name)
        DateParserTest_DDMMYYYY_Separated();
        DateParserTest_DDMMYYYY_Compact();
        DateParserTest_DDMMYYYY_WithTime();

        // YYYYDDMM Format Tests (via opt_name)
        DateParserTest_YYYYDDMM_Separated();
        DateParserTest_YYYYDDMM_Compact();

        // Month Name Format Tests
        DateParserTest_DDMMMYYYY_Separated();
        DateParserTest_DDMMMYYYY_Compact();
        DateParserTest_YYYYDDMMM_Separated();
        DateParserTest_YYYYDDMMM_Compact();

        // Parsing Method Tests
        DateParserTest_parseDateString();
        DateParserTest_parseDateTime();
        DateParserTest_parseDateTimeUTC();

        // Timezone Tests
        DateParserTest_Timezone_Z();
        DateParserTest_Timezone_Positive();
        DateParserTest_Timezone_Negative();
        DateParserTest_Timezone_Formats();

        // Edge Cases and Validation
        DateParserTest_LeapYear();
        DateParserTest_InvalidDates();
        DateParserTest_PartialParse();

        // Strict Validation Mode Tests
        DateParserTest_StrictValidation_ThrowsForInvalid();
        DateParserTest_StrictValidation_ValidDatesWork();
        DateParserTest_LenientValidation_ReturnsMaxDate();
        DateParserTest_LenientValidation_ValidDatesWork();

        // New Format Tests (parity with JavaScript)
        DateParserTest_Timestamps();
        DateParserTest_SingleDigitMonthDay();
        DateParserTest_SpaceSeparatedMonthNames();
        DateParserTest_MMDDYY_Format();
        DateParserTest_FractionalSeconds();

        // Unix/Java Date.toString() format tests
        DateParserTest_UnixDateToString();

        // JavaScript Date.toString() format tests
        DateParserTest_JSDateToString();

        // Julian Date Format Tests
        DateParserTest_JulianDate();

        // 2-Digit Year Compact Time Tests
        DateParserTest_DDMMYY_CompactTime();
        DateParserTest_MMDDYY_CompactTime();
        DateParserTest_YYMMDD_CompactTime();
        DateParserTest_YYDDMM_CompactTime();
      `
    },

    // ========== YYYYMMDD Format Tests ==========

    {
      name: 'DateParserTest_YYYYMMDD_Separated',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 2025-01-15
        Date date1 = parser.parseString("2025-01-15");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYYMMDD-Sep: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYYMMDD-Sep: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYYMMDD-Sep: day 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 12, "YYYYMMDD-Sep: hour 12 (noon)");

        // Test 2025/01/15
        Date date2 = parser.parseString("2025/01/15");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "YYYYMMDD-Sep (slash): year 2025");
        test(cal2.get(Calendar.MONTH) == 0, "YYYYMMDD-Sep (slash): month 0");

        // Test 2024-12-31
        Date date3 = parser.parseString("2024-12-31");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2024, "YYYYMMDD-Sep: year 2024");
        test(cal3.get(Calendar.MONTH) == 11, "YYYYMMDD-Sep: month 11 (Dec)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 31, "YYYYMMDD-Sep: day 31");
      `
    },

    {
      name: 'DateParserTest_YYYYMMDD_Compact',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 20250115
        Date date1 = parser.parseString("20250115");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYYMMDD-Compact: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYYMMDD-Compact: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYYMMDD-Compact: day 15");

        // Test 20241231
        Date date2 = parser.parseString("20241231");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2024, "YYYYMMDD-Compact: year 2024");
        test(cal2.get(Calendar.MONTH) == 11, "YYYYMMDD-Compact: month 11 (Dec)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 31, "YYYYMMDD-Compact: day 31");

        // Test 19990101
        Date date3 = parser.parseString("19990101");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 1999, "YYYYMMDD-Compact: year 1999");
        test(cal3.get(Calendar.MONTH) == 0, "YYYYMMDD-Compact: month 0 (Jan)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 1, "YYYYMMDD-Compact: day 1");
      `
    },

    {
      name: 'DateParserTest_YYYYMMDD_WithTime',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 2025-01-15T14:30:45
        Date date1 = parser.parseDateTime("2025-01-15T14:30:45");
        Calendar cal1 = Calendar.getInstance();
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYYMMDD with time: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYYMMDD with time: month 0");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYYMMDD with time: day 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "YYYYMMDD with time: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "YYYYMMDD with time: minute 30");
        test(cal1.get(Calendar.SECOND) == 45, "YYYYMMDD with time: second 45");

        // Test 2025-01-15 09:15 (space separator)
        Date date2 = parser.parseDateTime("2025-01-15 09:15");
        Calendar cal2 = Calendar.getInstance();
        cal2.setTime(date2);
        test(cal2.get(Calendar.HOUR_OF_DAY) == 9, "YYYYMMDD with time (space): hour 9");
        test(cal2.get(Calendar.MINUTE) == 15, "YYYYMMDD with time (space): minute 15");
      `
    },

    {
      name: 'DateParserTest_YYYYMMDD_WithTimezone',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 2025-01-15T14:30:45Z
        Date date1 = parser.parseDateTimeUTC("2025-01-15T14:30:45Z");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYYMMDD with Z: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYYMMDD with Z: month 0");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYYMMDD with Z: day 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "YYYYMMDD with Z: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "YYYYMMDD with Z: minute 30");
        test(cal1.get(Calendar.SECOND) == 45, "YYYYMMDD with Z: second 45");
      `
    },

    // ========== MMDDYYYY Format Tests ==========

    {
      name: 'DateParserTest_MMDDYYYY_Separated',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 01/15/2025
        Date date1 = parser.parseString("01/15/2025");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "MMDDYYYY-Sep: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "MMDDYYYY-Sep: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "MMDDYYYY-Sep: day 15");

        // Test 12/31/2024
        Date date2 = parser.parseString("12/31/2024");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2024, "MMDDYYYY-Sep: year 2024");
        test(cal2.get(Calendar.MONTH) == 11, "MMDDYYYY-Sep: month 11 (Dec)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 31, "MMDDYYYY-Sep: day 31");
      `
    },

    {
      name: 'DateParserTest_MMDDYYYY_Compact',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 01152025
        Date date1 = parser.parseString("01152025");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "MMDDYYYY-Compact: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "MMDDYYYY-Compact: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "MMDDYYYY-Compact: day 15");

        // Test 12312024
        Date date2 = parser.parseString("12312024");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2024, "MMDDYYYY-Compact: year 2024");
        test(cal2.get(Calendar.MONTH) == 11, "MMDDYYYY-Compact: month 11 (Dec)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 31, "MMDDYYYY-Compact: day 31");
      `
    },

    {
      name: 'DateParserTest_MMDDYYYY_WithTime',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 01/15/2025 14:30:45
        Date date1 = parser.parseDateTime("01/15/2025 14:30:45");
        Calendar cal1 = Calendar.getInstance();
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "MMDDYYYY with time: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "MMDDYYYY with time: month 0");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "MMDDYYYY with time: day 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "MMDDYYYY with time: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "MMDDYYYY with time: minute 30");
        test(cal1.get(Calendar.SECOND) == 45, "MMDDYYYY with time: second 45");
      `
    },

    // ========== YYMMDD Format Tests ==========

    {
      name: 'DateParserTest_YYMMDD_Separated',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 25/01/15 - YYMMDD requires opt_name because it's ambiguous with MMDDYY
        Date date1 = parser.parseString("25/01/15", "yymmdd");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYMMDD-Sep: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYMMDD-Sep: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYMMDD-Sep: day 15");

        // Test 00/02/29 (leap year 2000)
        Date date2 = parser.parseString("00/02/29", "yymmdd");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2000, "YYMMDD-Sep: year 2000");
        test(cal2.get(Calendar.MONTH) == 1, "YYMMDD-Sep: month 1 (Feb)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 29, "YYMMDD-Sep: day 29");
      `
    },

    {
      name: 'DateParserTest_YYMMDD_Compact',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 250115 - YYMMDD requires opt_name because it's ambiguous with MMDDYY
        Date date1 = parser.parseString("250115", "yymmdd");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYMMDD-Compact: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYMMDD-Compact: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYMMDD-Compact: day 15");

        // Test 000229 (leap year 2000)
        Date date2 = parser.parseString("000229", "yymmdd");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2000, "YYMMDD-Compact: year 2000");
        test(cal2.get(Calendar.MONTH) == 1, "YYMMDD-Compact: month 1 (Feb)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 29, "YYMMDD-Compact: day 29");
      `
    },

    {
      name: 'DateParserTest_YYMMDD_TwoDigitYearPivot',
      javaCode: `
        DateParser parser = new DateParser();

        // Test pivot at 50: 00-49 => 2000-2049, 50-99 => 1950-1999
        // YYMMDD requires opt_name because it's ambiguous with MMDDYY

        // Test 49/12/31 (should be 2049)
        Date date1 = parser.parseString("49/12/31", "yymmdd");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2049, "YYMMDD pivot: 49 => 2049");

        // Test 50/01/01 (should be 1950)
        Date date2 = parser.parseString("50/01/01", "yymmdd");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 1950, "YYMMDD pivot: 50 => 1950");

        // Test 99/12/31 (should be 1999)
        Date date3 = parser.parseString("99/12/31", "yymmdd");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 1999, "YYMMDD pivot: 99 => 1999");
      `
    },

    // ========== DDMMYYYY Format Tests ==========

    {
      name: 'DateParserTest_DDMMYYYY_Separated',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 15/01/2025 (with opt_name='ddmmyyyy')
        Date date1 = parser.parseString("15/01/2025", "ddmmyyyy");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "DDMMYYYY-Sep: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "DDMMYYYY-Sep: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "DDMMYYYY-Sep: day 15");

        // Test 31/12/2024
        Date date2 = parser.parseString("31/12/2024", "ddmmyyyy");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2024, "DDMMYYYY-Sep: year 2024");
        test(cal2.get(Calendar.MONTH) == 11, "DDMMYYYY-Sep: month 11 (Dec)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 31, "DDMMYYYY-Sep: day 31");
      `
    },

    {
      name: 'DateParserTest_DDMMYYYY_Compact',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 15012025 (with opt_name='ddmmyyyy')
        Date date1 = parser.parseString("15012025", "ddmmyyyy");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "DDMMYYYY-Compact: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "DDMMYYYY-Compact: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "DDMMYYYY-Compact: day 15");

        // Test 31122024
        Date date2 = parser.parseString("31122024", "ddmmyyyy");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2024, "DDMMYYYY-Compact: year 2024");
        test(cal2.get(Calendar.MONTH) == 11, "DDMMYYYY-Compact: month 11 (Dec)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 31, "DDMMYYYY-Compact: day 31");
      `
    },

    {
      name: 'DateParserTest_DDMMYYYY_WithTime',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 15/01/2025 14:30:45 (with opt_name='ddmmyyyy')
        Date date1 = parser.parseDateTime("15/01/2025 14:30:45", "ddmmyyyy");
        Calendar cal1 = Calendar.getInstance();
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "DDMMYYYY with time: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "DDMMYYYY with time: month 0");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "DDMMYYYY with time: day 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "DDMMYYYY with time: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "DDMMYYYY with time: minute 30");
        test(cal1.get(Calendar.SECOND) == 45, "DDMMYYYY with time: second 45");
      `
    },

    // ========== YYYYDDMM Format Tests ==========

    {
      name: 'DateParserTest_YYYYDDMM_Separated',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 2025/15/01 (with opt_name='yyyyddmm')
        Date date1 = parser.parseString("2025/15/01", "yyyyddmm");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYYDDMM-Sep: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYYDDMM-Sep: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYYDDMM-Sep: day 15");
      `
    },

    {
      name: 'DateParserTest_YYYYDDMM_Compact',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 20251501 (with opt_name='yyyyddmm')
        Date date1 = parser.parseString("20251501", "yyyyddmm");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYYDDMM-Compact: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYYDDMM-Compact: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYYDDMM-Compact: day 15");
      `
    },

    // ========== Month Name Format Tests ==========

    {
      name: 'DateParserTest_DDMMMYYYY_Separated',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 15-JAN-2025
        Date date1 = parser.parseString("15-JAN-2025");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "DDMMMYYYY-Sep: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "DDMMMYYYY-Sep: month 0 (JAN)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "DDMMMYYYY-Sep: day 15");

        // Test 31/DEC/2024
        Date date2 = parser.parseString("31/DEC/2024");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2024, "DDMMMYYYY-Sep: year 2024");
        test(cal2.get(Calendar.MONTH) == 11, "DDMMMYYYY-Sep: month 11 (DEC)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 31, "DDMMMYYYY-Sep: day 31");
      `
    },

    {
      name: 'DateParserTest_DDMMMYYYY_Compact',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 15JAN2025
        Date date1 = parser.parseString("15JAN2025");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "DDMMMYYYY-Compact: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "DDMMMYYYY-Compact: month 0 (JAN)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "DDMMMYYYY-Compact: day 15");
      `
    },

    {
      name: 'DateParserTest_YYYYDDMMM_Separated',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 2025-15-JAN
        Date date1 = parser.parseString("2025-15-JAN");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYYDDMMM-Sep: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYYDDMMM-Sep: month 0 (JAN)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYYDDMMM-Sep: day 15");
      `
    },

    {
      name: 'DateParserTest_YYYYDDMMM_Compact',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 202515JAN
        Date date1 = parser.parseString("202515JAN");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYYDDMMM-Compact: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYYDDMMM-Compact: month 0 (JAN)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "YYYYDDMMM-Compact: day 15");
      `
    },

    // ========== Parsing Method Tests ==========

    {
      name: 'DateParserTest_parseDateString',
      javaCode: `
        DateParser parser = new DateParser();

        // parseDateString should return date at noon GMT
        Date date1 = parser.parseDateString("2025-01-15");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "parseDateString: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "parseDateString: month 0");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "parseDateString: day 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 12, "parseDateString: hour 12 (noon)");
        test(cal1.get(Calendar.MINUTE) == 0, "parseDateString: minute 0");
        test(cal1.get(Calendar.SECOND) == 0, "parseDateString: second 0");

        // Even if time is present, parseDateString ignores it
        Date date2 = parser.parseDateString("2025-01-15T14:30:45");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.HOUR_OF_DAY) == 12, "parseDateString with time: hour 12 (ignores time)");
      `
    },

    {
      name: 'DateParserTest_parseDateTime',
      javaCode: `
        DateParser parser = new DateParser();

        // parseDateTime should use local time
        Date date1 = parser.parseDateTime("2025-01-15T14:30:45");
        Calendar cal1 = Calendar.getInstance();
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "parseDateTime: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "parseDateTime: month 0");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "parseDateTime: day 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "parseDateTime: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "parseDateTime: minute 30");
        test(cal1.get(Calendar.SECOND) == 45, "parseDateTime: second 45");
      `
    },

    {
      name: 'DateParserTest_parseDateTimeUTC',
      javaCode: `
        DateParser parser = new DateParser();

        // parseDateTimeUTC should use UTC
        Date date1 = parser.parseDateTimeUTC("2025-01-15T14:30:45");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "parseDateTimeUTC: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "parseDateTimeUTC: month 0");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "parseDateTimeUTC: day 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "parseDateTimeUTC: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "parseDateTimeUTC: minute 30");
        test(cal1.get(Calendar.SECOND) == 45, "parseDateTimeUTC: second 45");
      `
    },

    // ========== Timezone Tests ==========

    {
      name: 'DateParserTest_Timezone_Z',
      javaCode: `
        DateParser parser = new DateParser();

        // Test with Z timezone (UTC)
        Date date1 = parser.parseDateTimeUTC("2025-01-15T14:30:45Z");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "Timezone Z: year 2025");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "Timezone Z: hour 14 (no offset)");
        test(cal1.get(Calendar.MINUTE) == 30, "Timezone Z: minute 30");
      `
    },

    {
      name: 'DateParserTest_Timezone_Positive',
      javaCode: `
        DateParser parser = new DateParser();

        // Test with +05:30 timezone
        Date date1 = parser.parseDateTimeUTC("2025-01-15T14:30:45+05:30");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.HOUR_OF_DAY) == 9, "Timezone +05:30: hour 9 (14:30 - 5:30 = 9:00)");
        test(cal1.get(Calendar.MINUTE) == 0, "Timezone +05:30: minute 0");
      `
    },

    {
      name: 'DateParserTest_Timezone_Negative',
      javaCode: `
        DateParser parser = new DateParser();

        // Test with -05:00 timezone
        Date date1 = parser.parseDateTimeUTC("2025-01-15T14:30:45-05:00");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.HOUR_OF_DAY) == 19, "Timezone -05:00: hour 19 (14:30 + 5:00 = 19:30)");
        test(cal1.get(Calendar.MINUTE) == 30, "Timezone -05:00: minute 30");
      `
    },

    {
      name: 'DateParserTest_Timezone_Formats',
      javaCode: `
        DateParser parser = new DateParser();

        // Test +HHMM format (no colon)
        Date date1 = parser.parseDateTimeUTC("2025-01-15T14:30:45+0530");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.HOUR_OF_DAY) == 9, "Timezone +0530 (no colon): hour 9");

        // Test +HH format (hours only)
        Date date2 = parser.parseDateTimeUTC("2025-01-15T14:30:45+05");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.HOUR_OF_DAY) == 9, "Timezone +05 (hours only): hour 9");
        test(cal2.get(Calendar.MINUTE) == 30, "Timezone +05 (hours only): minute 30");
      `
    },

    // ========== Edge Cases ==========

    {
      name: 'DateParserTest_LeapYear',
      javaCode: `
        DateParser parser = new DateParser();

        // Test leap year 2000-02-29
        Date date1 = parser.parseString("2000-02-29");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2000, "Leap year: year 2000");
        test(cal1.get(Calendar.MONTH) == 1, "Leap year: month 1 (Feb)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 29, "Leap year: day 29");

        // Test leap year 2024-02-29
        Date date2 = parser.parseString("2024-02-29");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2024, "Leap year: year 2024");
        test(cal2.get(Calendar.MONTH) == 1, "Leap year: month 1 (Feb)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 29, "Leap year: day 29");
      `
    },

    {
      name: 'DateParserTest_InvalidDates',
      javaCode: `
        DateParser parser = new DateParser();
        // Default is non-strict mode - invalid formats return MAX_DATE instead of throwing

        // Test invalid format - returns MAX_DATE in lenient mode
        Date date1 = parser.parseString("not-a-date");
        test(date1.equals(DateParser.MAX_DATE), "Invalid format returns MAX_DATE in lenient mode");

        // Test empty string - returns MAX_DATE in lenient mode
        Date date2 = parser.parseString("");
        test(date2.equals(DateParser.MAX_DATE), "Empty string returns MAX_DATE in lenient mode");

        // Test null - returns MAX_DATE in lenient mode
        Date date3 = parser.parseString(null);
        test(date3.equals(DateParser.MAX_DATE), "Null returns MAX_DATE in lenient mode");
      `
    },

    {
      name: 'DateParserTest_PartialParse',
      javaCode: `
        DateParser parser = new DateParser();

        // Trailing text is allowed - parser should extract date and ignore trailing text
        // Test with trailing text
        Date date1 = parser.parseDateTimeUTC("2025-01-15T14:30:45Z extra text");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "Trailing text allowed: year is 2025");
        test(cal1.get(Calendar.MONTH) == 0, "Trailing text allowed: month is January (0)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "Trailing text allowed: day is 15");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "Trailing text allowed: hour is 14 UTC");
        test(cal1.get(Calendar.MINUTE) == 30, "Trailing text allowed: minute is 30");
        test(cal1.get(Calendar.SECOND) == 45, "Trailing text allowed: second is 45");
      `
    },

    // ========== Strict Validation Mode Tests ==========

    {
      name: 'DateParserTest_StrictValidation_ThrowsForInvalid',
      javaCode: `
        DateParser parser = new DateParser();
        parser.setStrictValidation(true);

        // Test 1: Invalid format should throw
        try {
          parser.parseString("not-a-date");
          test(false, "StrictMode: invalid format should throw");
        } catch (RuntimeException e) {
          test(e.getMessage().contains("Unsupported Date format"), "StrictMode: invalid format throws correct exception");
        }

        // Test 2: Empty string should throw
        try {
          parser.parseString("");
          test(false, "StrictMode: empty string should throw");
        } catch (RuntimeException e) {
          test(e.getMessage().contains("empty or null"), "StrictMode: empty string throws correct exception");
        }

        // Test 3: Null should throw
        try {
          parser.parseString(null);
          test(false, "StrictMode: null should throw");
        } catch (RuntimeException e) {
          test(e.getMessage().contains("empty or null"), "StrictMode: null throws correct exception");
        }

        // Test 4: parseDateTime with invalid input should throw
        try {
          parser.parseDateTime("garbage");
          test(false, "StrictMode parseDateTime: should throw for invalid input");
        } catch (RuntimeException e) {
          test(true, "StrictMode parseDateTime: throws for invalid input");
        }

        // Test 5: parseDateTimeUTC with invalid input should throw
        try {
          parser.parseDateTimeUTC("invalid");
          test(false, "StrictMode parseDateTimeUTC: should throw for invalid input");
        } catch (RuntimeException e) {
          test(true, "StrictMode parseDateTimeUTC: throws for invalid input");
        }
      `
    },

    {
      name: 'DateParserTest_StrictValidation_ValidDatesWork',
      javaCode: `
        DateParser parser = new DateParser();
        parser.setStrictValidation(true);

        // Test that valid dates still work in strict mode
        Date date1 = parser.parseString("2025-01-15");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "StrictMode: valid date parses - year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "StrictMode: valid date parses - month Jan");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "StrictMode: valid date parses - day 15");

        // Test parseDateTime
        Date date2 = parser.parseDateTime("2025-01-15T14:30:45");
        Calendar cal2 = Calendar.getInstance();
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "StrictMode: valid datetime parses - year 2025");
        test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "StrictMode: valid datetime parses - hour 14");

        // Test parseDateTimeUTC
        Date date3 = parser.parseDateTimeUTC("2025-01-15T14:30:45Z");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2025, "StrictMode: valid UTC datetime parses - year 2025");
        test(cal3.get(Calendar.HOUR_OF_DAY) == 14, "StrictMode: valid UTC datetime parses - hour 14");
      `
    },

    {
      name: 'DateParserTest_LenientValidation_ReturnsMaxDate',
      javaCode: `
        DateParser parser = new DateParser();
        parser.setStrictValidation(false);

        // Test 1: Default should be lenient (strictValidation = false)
        test(parser.getStrictValidation() == false, "Default parser has strictValidation=false");

        // Test 2: Invalid format should return MAX_DATE, not throw
        Date result1 = parser.parseString("not-a-date");
        test(result1.equals(DateParser.MAX_DATE), "LenientMode: invalid format returns MAX_DATE");

        // Test 3: Empty string should return MAX_DATE
        Date result2 = parser.parseString("");
        test(result2.equals(DateParser.MAX_DATE), "LenientMode: empty string returns MAX_DATE");

        // Test 4: Null should return MAX_DATE
        Date result3 = parser.parseString(null);
        test(result3.equals(DateParser.MAX_DATE), "LenientMode: null returns MAX_DATE");

        // Test 5: parseDateTime with invalid returns MAX_DATE
        Date result4 = parser.parseDateTime("garbage");
        test(result4.equals(DateParser.MAX_DATE), "LenientMode parseDateTime: invalid returns MAX_DATE");

        // Test 6: parseDateTimeUTC with invalid returns MAX_DATE
        Date result5 = parser.parseDateTimeUTC("invalid");
        test(result5.equals(DateParser.MAX_DATE), "LenientMode parseDateTimeUTC: invalid returns MAX_DATE");
      `
    },

    {
      name: 'DateParserTest_LenientValidation_ValidDatesWork',
      javaCode: `
        DateParser parser = new DateParser();
        parser.setStrictValidation(false);

        // Test that valid dates work in lenient mode
        Date date1 = parser.parseString("2025-01-15");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "LenientMode: valid date parses - year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "LenientMode: valid date parses - month Jan");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "LenientMode: valid date parses - day 15");
      `
    },

    // ========== New Format Tests (parity with JavaScript) ==========

    {
      name: 'DateParserTest_Timestamps',
      javaCode: `
        DateParser parser = new DateParser();

        // Test 13-digit JavaScript timestamp (milliseconds since epoch)
        // 1737028800000 = 2025-01-16T12:00:00.000Z
        Date date1 = parser.parseString("1737028800000");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "Timestamp13: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "Timestamp13: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 16, "Timestamp13: day 16");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 12, "Timestamp13: hour 12");

        // Test 10-digit Unix timestamp (seconds since epoch)
        // 1737028800 = 2025-01-16T12:00:00Z
        Date date2 = parser.parseString("1737028800");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "Timestamp10: year 2025");
        test(cal2.get(Calendar.MONTH) == 0, "Timestamp10: month 0 (Jan)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 16, "Timestamp10: day 16");
        test(cal2.get(Calendar.HOUR_OF_DAY) == 12, "Timestamp10: hour 12");

        // Test another timestamp: 0 = Unix epoch (1970-01-01 00:00:00 UTC)
        Date date3 = parser.parseString("0000000000");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 1970, "Timestamp10 epoch: year 1970");
        test(cal3.get(Calendar.MONTH) == 0, "Timestamp10 epoch: month 0 (Jan)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 1, "Timestamp10 epoch: day 1");
      `
    },

    {
      name: 'DateParserTest_SingleDigitMonthDay',
      javaCode: `
        DateParser parser = new DateParser();

        // Test YYYY-M-D (single digit month and day)
        Date date1 = parser.parseString("2025-1-5");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYYY-M-D: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "YYYY-M-D: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 5, "YYYY-M-D: day 5");

        // Test YYYY/MM/D (single digit day)
        Date date2 = parser.parseString("2025/03/5");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "YYYY/MM/D: year 2025");
        test(cal2.get(Calendar.MONTH) == 2, "YYYY/MM/D: month 2 (Mar)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 5, "YYYY/MM/D: day 5");

        // Test YYYY-M-DD (single digit month)
        Date date3 = parser.parseString("2025-3-15");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2025, "YYYY-M-DD: year 2025");
        test(cal3.get(Calendar.MONTH) == 2, "YYYY-M-DD: month 2 (Mar)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 15, "YYYY-M-DD: day 15");

        // Test M/D/YYYY (US format with single digits)
        Date date4 = parser.parseString("1/5/2025");
        Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal4.setTime(date4);
        test(cal4.get(Calendar.YEAR) == 2025, "M/D/YYYY: year 2025");
        test(cal4.get(Calendar.MONTH) == 0, "M/D/YYYY: month 0 (Jan)");
        test(cal4.get(Calendar.DAY_OF_MONTH) == 5, "M/D/YYYY: day 5");

        // Test with time: YYYY-M-D HH:MM:SS
        Date date5 = parser.parseDateTime("2025-1-5 14:30:45");
        Calendar cal5 = Calendar.getInstance();
        cal5.setTime(date5);
        test(cal5.get(Calendar.YEAR) == 2025, "YYYY-M-D with time: year 2025");
        test(cal5.get(Calendar.MONTH) == 0, "YYYY-M-D with time: month 0 (Jan)");
        test(cal5.get(Calendar.DAY_OF_MONTH) == 5, "YYYY-M-D with time: day 5");
        test(cal5.get(Calendar.HOUR_OF_DAY) == 14, "YYYY-M-D with time: hour 14");
      `
    },

    {
      name: 'DateParserTest_SpaceSeparatedMonthNames',
      javaCode: `
        DateParser parser = new DateParser();

        // Test "Jan 02 2025" (MMM dd yyyy)
        Date date1 = parser.parseString("Jan 02 2025");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "MMM dd yyyy: year 2025");
        test(cal1.get(Calendar.MONTH) == 0, "MMM dd yyyy: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 2, "MMM dd yyyy: day 2");

        // Test "Jan 2 2025" (single digit day)
        Date date2 = parser.parseString("Jan 2 2025");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "MMM d yyyy: year 2025");
        test(cal2.get(Calendar.MONTH) == 0, "MMM d yyyy: month 0 (Jan)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 2, "MMM d yyyy: day 2");

        // Test "15 JAN 2025" (DD MMM YYYY)
        Date date3 = parser.parseString("15 JAN 2025");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2025, "DD MMM YYYY: year 2025");
        test(cal3.get(Calendar.MONTH) == 0, "DD MMM YYYY: month 0 (Jan)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 15, "DD MMM YYYY: day 15");

        // Test "5 JAN 2025" (single digit day)
        Date date4 = parser.parseString("5 JAN 2025");
        Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal4.setTime(date4);
        test(cal4.get(Calendar.YEAR) == 2025, "D MMM YYYY: year 2025");
        test(cal4.get(Calendar.MONTH) == 0, "D MMM YYYY: month 0 (Jan)");
        test(cal4.get(Calendar.DAY_OF_MONTH) == 5, "D MMM YYYY: day 5");

        // Test case insensitivity: "dec 25 2025"
        Date date5 = parser.parseString("dec 25 2025");
        Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal5.setTime(date5);
        test(cal5.get(Calendar.YEAR) == 2025, "mmm dd yyyy (lowercase): year 2025");
        test(cal5.get(Calendar.MONTH) == 11, "mmm dd yyyy (lowercase): month 11 (Dec)");
        test(cal5.get(Calendar.DAY_OF_MONTH) == 25, "mmm dd yyyy (lowercase): day 25");
      `
    },

    {
      name: 'DateParserTest_MMDDYY_Format',
      javaCode: `
        DateParser parser = new DateParser();

        // Test MM/DD/YY with 2-digit year (21st century)
        Date date1 = parser.parseString("01/15/25");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "MM/DD/YY: year 2025 (25 -> 2025)");
        test(cal1.get(Calendar.MONTH) == 0, "MM/DD/YY: month 0 (Jan)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 15, "MM/DD/YY: day 15");

        // Test MM-DD-YY with 2-digit year (20th century - pivot at 50)
        Date date2 = parser.parseString("06-15-99");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 1999, "MM-DD-YY: year 1999 (99 -> 1999)");
        test(cal2.get(Calendar.MONTH) == 5, "MM-DD-YY: month 5 (Jun)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "MM-DD-YY: day 15");

        // Test pivot boundary: 49 -> 2049
        Date date3 = parser.parseString("12/31/49");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2049, "MM/DD/YY: year 2049 (49 -> 2049)");

        // Test pivot boundary: 50 -> 1950
        Date date4 = parser.parseString("01/01/50");
        Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal4.setTime(date4);
        test(cal4.get(Calendar.YEAR) == 1950, "MM/DD/YY: year 1950 (50 -> 1950)");

        // Test MMDDYY compact: 011525
        Date date5 = parser.parseString("011525");
        Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal5.setTime(date5);
        test(cal5.get(Calendar.YEAR) == 2025, "MMDDYY compact: year 2025");
        test(cal5.get(Calendar.MONTH) == 0, "MMDDYY compact: month 0 (Jan)");
        test(cal5.get(Calendar.DAY_OF_MONTH) == 15, "MMDDYY compact: day 15");

        // Test single-digit month/day: M/D/YY
        Date date6 = parser.parseString("1/5/25");
        Calendar cal6 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal6.setTime(date6);
        test(cal6.get(Calendar.YEAR) == 2025, "M/D/YY: year 2025");
        test(cal6.get(Calendar.MONTH) == 0, "M/D/YY: month 0 (Jan)");
        test(cal6.get(Calendar.DAY_OF_MONTH) == 5, "M/D/YY: day 5");
      `
    },

    {
      name: 'DateParserTest_FractionalSeconds',
      javaCode: `
        DateParser parser = new DateParser();

        // Test with milliseconds (3 digits)
        Date date1 = parser.parseDateTimeUTC("2025-01-15T14:30:45.123Z");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "Fractional 3 digits: year 2025");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "Fractional 3 digits: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "Fractional 3 digits: minute 30");
        test(cal1.get(Calendar.SECOND) == 45, "Fractional 3 digits: second 45");
        test(cal1.get(Calendar.MILLISECOND) == 123, "Fractional 3 digits: ms 123");

        // Test with microseconds (6 digits) - truncated to milliseconds
        Date date2 = parser.parseDateTimeUTC("2025-01-15T14:30:45.123456Z");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "Fractional 6 digits: year 2025");
        test(cal2.get(Calendar.MILLISECOND) == 123, "Fractional 6 digits: ms 123 (truncated)");

        // Test with 1 digit - padded to 3 digits (100)
        Date date3 = parser.parseDateTimeUTC("2025-01-15T14:30:45.1Z");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.MILLISECOND) == 100, "Fractional 1 digit: ms 100 (padded)");

        // Test with 2 digits - padded to 3 digits (120)
        Date date4 = parser.parseDateTimeUTC("2025-01-15T14:30:45.12Z");
        Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal4.setTime(date4);
        test(cal4.get(Calendar.MILLISECOND) == 120, "Fractional 2 digits: ms 120 (padded)");

        // Test with timezone offset
        Date date5 = parser.parseDateTimeUTC("2025-01-15T14:30:45.500+05:30");
        Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal5.setTime(date5);
        test(cal5.get(Calendar.HOUR_OF_DAY) == 9, "Fractional with tz: hour 9 UTC (14:30 - 5:30)");
        test(cal5.get(Calendar.MILLISECOND) == 500, "Fractional with tz: ms 500");
      `
    },

    // ========== Unix/Java Date.toString() Format Tests ==========

    {
      name: 'DateParserTest_UnixDateToString',
      javaCode: `
        DateParser parser = new DateParser();

        // Test "Tue Apr 01 05:17:59 GMT 2025"
        Date date1 = parser.parseDateTimeUTC("Tue Apr 01 05:17:59 GMT 2025");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "Unix Date.toString(): year 2025");
        test(cal1.get(Calendar.MONTH) == 3, "Unix Date.toString(): month 3 (Apr)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 1, "Unix Date.toString(): day 1");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 5, "Unix Date.toString(): hour 5");
        test(cal1.get(Calendar.MINUTE) == 17, "Unix Date.toString(): minute 17");
        test(cal1.get(Calendar.SECOND) == 59, "Unix Date.toString(): second 59");

        // Test "Mon Jan 15 14:30:45 GMT 2025"
        Date date2 = parser.parseDateTimeUTC("Mon Jan 15 14:30:45 GMT 2025");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "Unix Date.toString() Mon: year 2025");
        test(cal2.get(Calendar.MONTH) == 0, "Unix Date.toString() Mon: month 0 (Jan)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 15, "Unix Date.toString() Mon: day 15");
        test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "Unix Date.toString() Mon: hour 14");
        test(cal2.get(Calendar.MINUTE) == 30, "Unix Date.toString() Mon: minute 30");
        test(cal2.get(Calendar.SECOND) == 45, "Unix Date.toString() Mon: second 45");

        // Test "Wed Dec 31 23:59:59 GMT 2024"
        Date date3 = parser.parseDateTimeUTC("Wed Dec 31 23:59:59 GMT 2024");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2024, "Unix Date.toString() Wed: year 2024");
        test(cal3.get(Calendar.MONTH) == 11, "Unix Date.toString() Wed: month 11 (Dec)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 31, "Unix Date.toString() Wed: day 31");
        test(cal3.get(Calendar.HOUR_OF_DAY) == 23, "Unix Date.toString() Wed: hour 23");
        test(cal3.get(Calendar.MINUTE) == 59, "Unix Date.toString() Wed: minute 59");
        test(cal3.get(Calendar.SECOND) == 59, "Unix Date.toString() Wed: second 59");

        // Test "Thu Feb 29 00:00:00 GMT 2024" (leap year)
        Date date4 = parser.parseDateTimeUTC("Thu Feb 29 00:00:00 GMT 2024");
        Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal4.setTime(date4);
        test(cal4.get(Calendar.YEAR) == 2024, "Unix Date.toString() leap year: year 2024");
        test(cal4.get(Calendar.MONTH) == 1, "Unix Date.toString() leap year: month 1 (Feb)");
        test(cal4.get(Calendar.DAY_OF_MONTH) == 29, "Unix Date.toString() leap year: day 29");

        // Test with UTC timezone
        Date date5 = parser.parseDateTimeUTC("Fri Jun 15 12:00:00 UTC 2025");
        Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal5.setTime(date5);
        test(cal5.get(Calendar.YEAR) == 2025, "Unix Date.toString() UTC: year 2025");
        test(cal5.get(Calendar.MONTH) == 5, "Unix Date.toString() UTC: month 5 (Jun)");
        test(cal5.get(Calendar.DAY_OF_MONTH) == 15, "Unix Date.toString() UTC: day 15");
        test(cal5.get(Calendar.HOUR_OF_DAY) == 12, "Unix Date.toString() UTC: hour 12");

        // Test case insensitivity - lowercase
        Date date6 = parser.parseDateTimeUTC("tue apr 01 05:17:59 gmt 2025");
        Calendar cal6 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal6.setTime(date6);
        test(cal6.get(Calendar.YEAR) == 2025, "Unix Date.toString() lowercase: year 2025");
        test(cal6.get(Calendar.MONTH) == 3, "Unix Date.toString() lowercase: month 3 (Apr)");
        test(cal6.get(Calendar.DAY_OF_MONTH) == 1, "Unix Date.toString() lowercase: day 1");

        // Test case insensitivity - mixed case
        Date date7 = parser.parseDateTimeUTC("Sat Jul 04 09:30:00 Gmt 2025");
        Calendar cal7 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal7.setTime(date7);
        test(cal7.get(Calendar.YEAR) == 2025, "Unix Date.toString() mixed case: year 2025");
        test(cal7.get(Calendar.MONTH) == 6, "Unix Date.toString() mixed case: month 6 (Jul)");
        test(cal7.get(Calendar.DAY_OF_MONTH) == 4, "Unix Date.toString() mixed case: day 4");

        // Test with single digit day (should work since dayFlexible is used)
        Date date8 = parser.parseDateTimeUTC("Sun Mar 5 08:15:30 GMT 2025");
        Calendar cal8 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal8.setTime(date8);
        test(cal8.get(Calendar.YEAR) == 2025, "Unix Date.toString() single digit day: year 2025");
        test(cal8.get(Calendar.MONTH) == 2, "Unix Date.toString() single digit day: month 2 (Mar)");
        test(cal8.get(Calendar.DAY_OF_MONTH) == 5, "Unix Date.toString() single digit day: day 5");

        // Test all days of week are recognized
        Date dateMon = parser.parseDateTimeUTC("Mon Jan 01 00:00:00 GMT 2024");
        test(dateMon != null && !dateMon.equals(DateParser.MAX_DATE), "Unix Date.toString(): Mon recognized");

        Date dateTue = parser.parseDateTimeUTC("Tue Jan 02 00:00:00 GMT 2024");
        test(dateTue != null && !dateTue.equals(DateParser.MAX_DATE), "Unix Date.toString(): Tue recognized");

        Date dateWed = parser.parseDateTimeUTC("Wed Jan 03 00:00:00 GMT 2024");
        test(dateWed != null && !dateWed.equals(DateParser.MAX_DATE), "Unix Date.toString(): Wed recognized");

        Date dateThu = parser.parseDateTimeUTC("Thu Jan 04 00:00:00 GMT 2024");
        test(dateThu != null && !dateThu.equals(DateParser.MAX_DATE), "Unix Date.toString(): Thu recognized");

        Date dateFri = parser.parseDateTimeUTC("Fri Jan 05 00:00:00 GMT 2024");
        test(dateFri != null && !dateFri.equals(DateParser.MAX_DATE), "Unix Date.toString(): Fri recognized");

        Date dateSat = parser.parseDateTimeUTC("Sat Jan 06 00:00:00 GMT 2024");
        test(dateSat != null && !dateSat.equals(DateParser.MAX_DATE), "Unix Date.toString(): Sat recognized");

        Date dateSun = parser.parseDateTimeUTC("Sun Jan 07 00:00:00 GMT 2024");
        test(dateSun != null && !dateSun.equals(DateParser.MAX_DATE), "Unix Date.toString(): Sun recognized");

        // Test all months are recognized
        String[] months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        for ( int i = 0 ; i < months.length ; i++ ) {
          String dayPadded = String.format("%02d", (i % 28) + 1);
          String dateStr = "Mon " + months[i] + " " + dayPadded + " 12:00:00 GMT 2025";
          Date dateMonth = parser.parseDateTimeUTC(dateStr);
          Calendar calMonth = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          calMonth.setTime(dateMonth);
          test(calMonth.get(Calendar.MONTH) == i, "Unix Date.toString(): " + months[i] + " recognized as month " + i);
        }

        // Test with numeric timezone offset +HHMM
        // "Tue Apr 01 10:17:59 +0500 2025" - 10:17:59 +05:00 = 05:17:59 UTC
        Date dateOffset1 = parser.parseDateTimeUTC("Tue Apr 01 10:17:59 +0500 2025");
        Calendar calOffset1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calOffset1.setTime(dateOffset1);
        test(calOffset1.get(Calendar.YEAR) == 2025, "Unix Date.toString() +0500: year 2025");
        test(calOffset1.get(Calendar.MONTH) == 3, "Unix Date.toString() +0500: month 3 (Apr)");
        test(calOffset1.get(Calendar.DAY_OF_MONTH) == 1, "Unix Date.toString() +0500: day 1");
        test(calOffset1.get(Calendar.HOUR_OF_DAY) == 5, "Unix Date.toString() +0500: hour 5 UTC (10 - 5)");
        test(calOffset1.get(Calendar.MINUTE) == 17, "Unix Date.toString() +0500: minute 17");

        // Test with negative timezone offset
        // "Tue Apr 01 00:17:59 -0500 2025" - 00:17:59 -05:00 = 05:17:59 UTC
        Date dateOffset2 = parser.parseDateTimeUTC("Tue Apr 01 00:17:59 -0500 2025");
        Calendar calOffset2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calOffset2.setTime(dateOffset2);
        test(calOffset2.get(Calendar.YEAR) == 2025, "Unix Date.toString() -0500: year 2025");
        test(calOffset2.get(Calendar.HOUR_OF_DAY) == 5, "Unix Date.toString() -0500: hour 5 UTC (0 + 5)");
        test(calOffset2.get(Calendar.MINUTE) == 17, "Unix Date.toString() -0500: minute 17");

        // Test with +0000 (same as GMT)
        Date dateOffset3 = parser.parseDateTimeUTC("Tue Apr 01 05:17:59 +0000 2025");
        Calendar calOffset3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calOffset3.setTime(dateOffset3);
        test(calOffset3.get(Calendar.HOUR_OF_DAY) == 5, "Unix Date.toString() +0000: hour 5 UTC (same as GMT)");

        // Test with +HH:MM format (colon separator)
        Date dateOffset4 = parser.parseDateTimeUTC("Tue Apr 01 10:17:59 +05:00 2025");
        Calendar calOffset4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        calOffset4.setTime(dateOffset4);
        test(calOffset4.get(Calendar.HOUR_OF_DAY) == 5, "Unix Date.toString() +05:00: hour 5 UTC (10 - 5)");
      `
    },

    // ========== JavaScript Date.toString() Format Tests ==========

    {
      name: 'DateParserTest_JSDateToString',
      javaCode: `
        DateParser parser = new DateParser();

        // Test "Thu Feb 19 2026 16:20:23 GMT-0400 (Atlantic Standard Time)"
        // -04:00 → UTC is 4 hours later: 16+4 = 20
        Date date1 = parser.parseDateTimeUTC("Thu Feb 19 2026 16:20:23 GMT-0400 (Atlantic Standard Time)");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2026, "JS Date.toString(): year 2026");
        test(cal1.get(Calendar.MONTH) == 1, "JS Date.toString(): month 1 (Feb)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 19, "JS Date.toString(): day 19");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 20, "JS Date.toString(): hour 20 UTC (16 + 4)");
        test(cal1.get(Calendar.MINUTE) == 20, "JS Date.toString(): minute 20");
        test(cal1.get(Calendar.SECOND) == 23, "JS Date.toString(): second 23");

        // Test with +0530 (India Standard Time) - UTC = 10:17:59 - 5:30 = 04:47:59
        Date date2 = parser.parseDateTimeUTC("Tue Apr 01 2025 10:17:59 GMT+0530 (India Standard Time)");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "JS Date.toString() +0530: year 2025");
        test(cal2.get(Calendar.MONTH) == 3, "JS Date.toString() +0530: month 3 (Apr)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 1, "JS Date.toString() +0530: day 1");
        test(cal2.get(Calendar.HOUR_OF_DAY) == 4, "JS Date.toString() +0530: hour 4 UTC (10 - 5.5 ≈ 4)");
        test(cal2.get(Calendar.MINUTE) == 47, "JS Date.toString() +0530: minute 47 UTC (17 - 30 + 60)");

        // Test with GMT bare (no offset, no parens)
        Date date3 = parser.parseDateTimeUTC("Mon Jan 15 2025 12:30:45 GMT");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2025, "JS Date.toString() GMT bare: year 2025");
        test(cal3.get(Calendar.MONTH) == 0, "JS Date.toString() GMT bare: month 0 (Jan)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 15, "JS Date.toString() GMT bare: day 15");
        test(cal3.get(Calendar.HOUR_OF_DAY) == 12, "JS Date.toString() GMT bare: hour 12");
        test(cal3.get(Calendar.MINUTE) == 30, "JS Date.toString() GMT bare: minute 30");
        test(cal3.get(Calendar.SECOND) == 45, "JS Date.toString() GMT bare: second 45");

        // Test with GMT+0000 (explicit zero offset)
        Date date4 = parser.parseDateTimeUTC("Tue Apr 01 2025 05:17:59 GMT+0000 (Coordinated Universal Time)");
        Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal4.setTime(date4);
        test(cal4.get(Calendar.HOUR_OF_DAY) == 5, "JS Date.toString() +0000: hour 5 UTC");
        test(cal4.get(Calendar.MINUTE) == 17, "JS Date.toString() +0000: minute 17");

        // Test with negative offset -0500 (Eastern)
        Date date5 = parser.parseDateTimeUTC("Wed Dec 31 2025 23:59:59 GMT-0500 (Eastern Standard Time)");
        Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal5.setTime(date5);
        test(cal5.get(Calendar.YEAR) == 2026, "JS Date.toString() -0500: year rolls to 2026");
        test(cal5.get(Calendar.MONTH) == 0, "JS Date.toString() -0500: month 0 (Jan)");
        test(cal5.get(Calendar.DAY_OF_MONTH) == 1, "JS Date.toString() -0500: day 1 (rolled)");
        test(cal5.get(Calendar.HOUR_OF_DAY) == 4, "JS Date.toString() -0500: hour 4 UTC (23 + 5)");
        test(cal5.get(Calendar.MINUTE) == 59, "JS Date.toString() -0500: minute 59");

        // Test case insensitive
        Date date6 = parser.parseDateTimeUTC("thu feb 19 2026 16:20:23 gmt-0400 (Atlantic Standard Time)");
        Calendar cal6 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal6.setTime(date6);
        test(cal6.get(Calendar.YEAR) == 2026, "JS Date.toString() lowercase: year 2026");
        test(cal6.get(Calendar.HOUR_OF_DAY) == 20, "JS Date.toString() lowercase: hour 20 UTC");

        // Test single digit day
        Date date7 = parser.parseDateTimeUTC("Tue Apr 1 2025 05:17:59 GMT+0000");
        Calendar cal7 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal7.setTime(date7);
        test(cal7.get(Calendar.DAY_OF_MONTH) == 1, "JS Date.toString() single digit day: day 1");
        test(cal7.get(Calendar.HOUR_OF_DAY) == 5, "JS Date.toString() single digit day: hour 5");

        // Test all day names are recognized
        test(parser.parseDateTimeUTC("Mon Jan 06 2025 12:00:00 GMT+0000") != null, "JS Date.toString(): Mon recognized");
        test(parser.parseDateTimeUTC("Tue Jan 07 2025 12:00:00 GMT+0000") != null, "JS Date.toString(): Tue recognized");
        test(parser.parseDateTimeUTC("Wed Jan 08 2025 12:00:00 GMT+0000") != null, "JS Date.toString(): Wed recognized");
        test(parser.parseDateTimeUTC("Thu Jan 09 2025 12:00:00 GMT+0000") != null, "JS Date.toString(): Thu recognized");
        test(parser.parseDateTimeUTC("Fri Jan 10 2025 12:00:00 GMT+0000") != null, "JS Date.toString(): Fri recognized");
        test(parser.parseDateTimeUTC("Sat Jan 11 2025 12:00:00 GMT+0000") != null, "JS Date.toString(): Sat recognized");
        test(parser.parseDateTimeUTC("Sun Jan 12 2025 12:00:00 GMT+0000") != null, "JS Date.toString(): Sun recognized");

        // Test all months
        String[] months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        for ( int i = 0 ; i < months.length ; i++ ) {
          Date dateMonth = parser.parseDateTimeUTC("Mon " + months[i] + " 01 2025 12:00:00 GMT+0000");
          Calendar calMonth = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          calMonth.setTime(dateMonth);
          test(calMonth.get(Calendar.MONTH) == i, "JS Date.toString(): " + months[i] + " recognized as month " + i);
        }
      `
    },

    // ========== Julian Date Format Tests ==========

    {
      name: 'DateParserTest_JulianDate',
      javaCode: `
        DateParser parser = new DateParser();

        // ========== YYDDD Format Tests (5-digit: 2-digit year + 3-digit day of year) ==========
        // Uses fixed pivot: 00-49 -> 2000-2049, 50-99 -> 1950-1999

        // Test "25216" = August 4, 2025 (day 216 of 2025)
        Date date1 = parser.parseDateString("25216", "yyddd");
        Calendar cal1 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYDDD 25216: year 2025");
        test(cal1.get(Calendar.MONTH) == 7, "YYDDD 25216: month 7 (Aug)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 4, "YYDDD 25216: day 4");

        // Test "24341" = December 6, 2024 (day 341 of 2024)
        Date date2 = parser.parseDateString("24341", "yyddd");
        Calendar cal2 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2024, "YYDDD 24341: year 2024");
        test(cal2.get(Calendar.MONTH) == 11, "YYDDD 24341: month 11 (Dec)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 6, "YYDDD 24341: day 6");

        // Test "25001" = January 1, 2025 (day 1)
        Date date3 = parser.parseDateString("25001", "yyddd");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2025, "YYDDD 25001: year 2025");
        test(cal3.get(Calendar.MONTH) == 0, "YYDDD 25001: month 0 (Jan)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 1, "YYDDD 25001: day 1");

        // Test "25365" = December 31, 2025 (day 365, non-leap year)
        Date date4 = parser.parseDateString("25365", "yyddd");
        Calendar cal4 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal4.setTime(date4);
        test(cal4.get(Calendar.YEAR) == 2025, "YYDDD 25365: year 2025");
        test(cal4.get(Calendar.MONTH) == 11, "YYDDD 25365: month 11 (Dec)");
        test(cal4.get(Calendar.DAY_OF_MONTH) == 31, "YYDDD 25365: day 31");

        // Test "24366" = December 31, 2024 (day 366, leap year)
        Date date5 = parser.parseDateString("24366", "yyddd");
        Calendar cal5 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal5.setTime(date5);
        test(cal5.get(Calendar.YEAR) == 2024, "YYDDD 24366 leap year: year 2024");
        test(cal5.get(Calendar.MONTH) == 11, "YYDDD 24366 leap year: month 11 (Dec)");
        test(cal5.get(Calendar.DAY_OF_MONTH) == 31, "YYDDD 24366 leap year: day 31");

        // Test 2-digit year pivot: 49 → 2049
        Date date6 = parser.parseDateString("49001", "yyddd");
        Calendar cal6 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal6.setTime(date6);
        test(cal6.get(Calendar.YEAR) == 2049, "YYDDD year pivot: 49 → 2049");

        // Test 2-digit year pivot: 50 → 1950
        Date date7 = parser.parseDateString("50001", "yyddd");
        Calendar cal7 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal7.setTime(date7);
        test(cal7.get(Calendar.YEAR) == 1950, "YYDDD year pivot: 50 → 1950");

        // ========== YDDD Format Tests (4-digit: 1-digit year + 3-digit day of year) ==========
        // Uses sliding window logic based on current year:
        //   decade = floor(currentYear / 10) * 10
        //   year = decade + oneDigitYear
        //   if year > currentYear + 5 then year = year - 10

        int currentYear = Calendar.getInstance(TimeZone.getTimeZone("GMT")).get(Calendar.YEAR);
        int decade = (currentYear / 10) * 10;

        // Calculate expected years using sliding window
        int expectedYear0 = decade + 0;
        if ( expectedYear0 > currentYear + 5 ) expectedYear0 -= 10;
        int expectedYear5 = decade + 5;
        if ( expectedYear5 > currentYear + 5 ) expectedYear5 -= 10;
        int expectedYear9 = decade + 9;
        if ( expectedYear9 > currentYear + 5 ) expectedYear9 -= 10;

        // Test "5216" = August 4 (year 5 with sliding window, day 216)
        Date date8 = parser.parseDateString("5216", "yddd");
        Calendar cal8 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal8.setTime(date8);
        test(cal8.get(Calendar.YEAR) == expectedYear5, "YDDD 5216: year " + expectedYear5);
        test(cal8.get(Calendar.MONTH) == 7, "YDDD 5216: month 7 (Aug)");
        test(cal8.get(Calendar.DAY_OF_MONTH) == 4, "YDDD 5216: day 4");

        // Test "0001" = January 1 (year 0 with sliding window)
        Date date9 = parser.parseDateString("0001", "yddd");
        Calendar cal9 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal9.setTime(date9);
        test(cal9.get(Calendar.YEAR) == expectedYear0, "YDDD 0001: year " + expectedYear0 + " (0 → " + expectedYear0 + ")");
        test(cal9.get(Calendar.MONTH) == 0, "YDDD 0001: month 0 (Jan)");
        test(cal9.get(Calendar.DAY_OF_MONTH) == 1, "YDDD 0001: day 1");

        // Test "9365" = December 31 (year 9 with sliding window)
        Date date10 = parser.parseDateString("9365", "yddd");
        Calendar cal10 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal10.setTime(date10);
        test(cal10.get(Calendar.YEAR) == expectedYear9, "YDDD 9365: year " + expectedYear9 + " (9 → " + expectedYear9 + ")");
        test(cal10.get(Calendar.MONTH) == 11, "YDDD 9365: month 11 (Dec)");
        test(cal10.get(Calendar.DAY_OF_MONTH) == 31, "YDDD 9365: day 31");

        // ========== Combined juliandate Format Tests ==========
        // Auto-detects YYDDD (5 digits) or YDDD (4 digits)
        // 5-digit: Uses fixed 2-digit year pivot
        // 4-digit: Uses sliding window based on current year

        // Test 5-digit with juliandate opt_name (uses fixed pivot)
        Date date11 = parser.parseDateString("25216", "juliandate");
        Calendar cal11 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal11.setTime(date11);
        test(cal11.get(Calendar.YEAR) == 2025, "juliandate 25216 (5-digit): year 2025");
        test(cal11.get(Calendar.MONTH) == 7, "juliandate 25216 (5-digit): month 7 (Aug)");
        test(cal11.get(Calendar.DAY_OF_MONTH) == 4, "juliandate 25216 (5-digit): day 4");

        // Test 4-digit with juliandate opt_name (uses sliding window)
        Date date12 = parser.parseDateString("5216", "juliandate");
        Calendar cal12 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal12.setTime(date12);
        test(cal12.get(Calendar.YEAR) == expectedYear5, "juliandate 5216 (4-digit): year " + expectedYear5);
        test(cal12.get(Calendar.MONTH) == 7, "juliandate 5216 (4-digit): month 7 (Aug)");
        test(cal12.get(Calendar.DAY_OF_MONTH) == 4, "juliandate 5216 (4-digit): day 4");
      `
    },

    // ========== 2-Digit Year Compact Time Tests ==========

    {
      name: 'DateParserTest_DDMMYY_CompactTime',
      javaCode: `
        DateParser parser = new DateParser();

        // Test compact time: 010925 143025 (DD=01, MM=09, YY=25, HH=14, MM=30, SS=25)
        Date date1 = parser.parseDateTime("010925 143025", "ddmmyyyy");
        Calendar cal1 = Calendar.getInstance();
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "DDMMYY compact time: year 2025");
        test(cal1.get(Calendar.MONTH) == 8, "DDMMYY compact time: month 8 (Sep)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 1, "DDMMYY compact time: day 1");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "DDMMYY compact time: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "DDMMYY compact time: minute 30");
        test(cal1.get(Calendar.SECOND) == 25, "DDMMYY compact time: second 25");

        // Test colon-separated time: 010925 14:30:25
        Date date2 = parser.parseDateTime("010925 14:30:25", "ddmmyyyy");
        Calendar cal2 = Calendar.getInstance();
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "DDMMYY colon time: year 2025");
        test(cal2.get(Calendar.MONTH) == 8, "DDMMYY colon time: month 8 (Sep)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 1, "DDMMYY colon time: day 1");
        test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "DDMMYY colon time: hour 14");
        test(cal2.get(Calendar.MINUTE) == 30, "DDMMYY colon time: minute 30");
        test(cal2.get(Calendar.SECOND) == 25, "DDMMYY colon time: second 25");

        // Test date-only backward compat: 010925
        Date date3 = parser.parseString("010925", "ddmmyyyy");
        Calendar cal3 = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal3.setTime(date3);
        test(cal3.get(Calendar.YEAR) == 2025, "DDMMYY date-only: year 2025");
        test(cal3.get(Calendar.MONTH) == 8, "DDMMYY date-only: month 8 (Sep)");
        test(cal3.get(Calendar.DAY_OF_MONTH) == 1, "DDMMYY date-only: day 1");
      `
    },

    {
      name: 'DateParserTest_MMDDYY_CompactTime',
      javaCode: `
        DateParser parser = new DateParser();

        // Test compact time: 090125 143025 (MM=09, DD=01, YY=25, HH=14, MM=30, SS=25)
        Date date1 = parser.parseDateTime("090125 143025", "mmddyyyy");
        Calendar cal1 = Calendar.getInstance();
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "MMDDYY compact time: year 2025");
        test(cal1.get(Calendar.MONTH) == 8, "MMDDYY compact time: month 8 (Sep)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 1, "MMDDYY compact time: day 1");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "MMDDYY compact time: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "MMDDYY compact time: minute 30");
        test(cal1.get(Calendar.SECOND) == 25, "MMDDYY compact time: second 25");

        // Test colon-separated time: 090125 14:30:25
        Date date2 = parser.parseDateTime("090125 14:30:25", "mmddyyyy");
        Calendar cal2 = Calendar.getInstance();
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "MMDDYY colon time: year 2025");
        test(cal2.get(Calendar.MONTH) == 8, "MMDDYY colon time: month 8 (Sep)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 1, "MMDDYY colon time: day 1");
        test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "MMDDYY colon time: hour 14");
        test(cal2.get(Calendar.MINUTE) == 30, "MMDDYY colon time: minute 30");
        test(cal2.get(Calendar.SECOND) == 25, "MMDDYY colon time: second 25");
      `
    },

    {
      name: 'DateParserTest_YYMMDD_CompactTime',
      javaCode: `
        DateParser parser = new DateParser();

        // Test compact time: 250901 143025 (YY=25, MM=09, DD=01, HH=14, MM=30, SS=25)
        Date date1 = parser.parseDateTime("250901 143025", "yymmdd");
        Calendar cal1 = Calendar.getInstance();
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYMMDD compact time: year 2025");
        test(cal1.get(Calendar.MONTH) == 8, "YYMMDD compact time: month 8 (Sep)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 1, "YYMMDD compact time: day 1");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "YYMMDD compact time: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "YYMMDD compact time: minute 30");
        test(cal1.get(Calendar.SECOND) == 25, "YYMMDD compact time: second 25");

        // Test colon-separated time: 250901 14:30:25
        Date date2 = parser.parseDateTime("250901 14:30:25", "yymmdd");
        Calendar cal2 = Calendar.getInstance();
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "YYMMDD colon time: year 2025");
        test(cal2.get(Calendar.MONTH) == 8, "YYMMDD colon time: month 8 (Sep)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 1, "YYMMDD colon time: day 1");
        test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "YYMMDD colon time: hour 14");
        test(cal2.get(Calendar.MINUTE) == 30, "YYMMDD colon time: minute 30");
        test(cal2.get(Calendar.SECOND) == 25, "YYMMDD colon time: second 25");
      `
    },

    {
      name: 'DateParserTest_YYDDMM_CompactTime',
      javaCode: `
        DateParser parser = new DateParser();

        // Test compact time: 250109 143025 (YY=25, DD=01, MM=09, HH=14, MM=30, SS=25)
        Date date1 = parser.parseDateTime("250109 143025", "yyyyddmm");
        Calendar cal1 = Calendar.getInstance();
        cal1.setTime(date1);
        test(cal1.get(Calendar.YEAR) == 2025, "YYDDMM compact time: year 2025");
        test(cal1.get(Calendar.MONTH) == 8, "YYDDMM compact time: month 8 (Sep)");
        test(cal1.get(Calendar.DAY_OF_MONTH) == 1, "YYDDMM compact time: day 1");
        test(cal1.get(Calendar.HOUR_OF_DAY) == 14, "YYDDMM compact time: hour 14");
        test(cal1.get(Calendar.MINUTE) == 30, "YYDDMM compact time: minute 30");
        test(cal1.get(Calendar.SECOND) == 25, "YYDDMM compact time: second 25");

        // Test colon-separated time: 250109 14:30:25
        Date date2 = parser.parseDateTime("250109 14:30:25", "yyyyddmm");
        Calendar cal2 = Calendar.getInstance();
        cal2.setTime(date2);
        test(cal2.get(Calendar.YEAR) == 2025, "YYDDMM colon time: year 2025");
        test(cal2.get(Calendar.MONTH) == 8, "YYDDMM colon time: month 8 (Sep)");
        test(cal2.get(Calendar.DAY_OF_MONTH) == 1, "YYDDMM colon time: day 1");
        test(cal2.get(Calendar.HOUR_OF_DAY) == 14, "YYDDMM colon time: hour 14");
        test(cal2.get(Calendar.MINUTE) == 30, "YYDDMM colon time: minute 30");
        test(cal2.get(Calendar.SECOND) == 25, "YYDDMM colon time: second 25");
      `
    }
  ]
});
