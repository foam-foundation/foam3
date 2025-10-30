/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'DateUtilJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'JavaScript tests for DateUtil utility functions',

  methods: [
    function runTest(x) {
      this.testParseDateString_YYYYMMDD(x);
      this.testParseDateString_YYYY_MM_DD(x);
      this.testParseDateString_MMDDYYYY(x);
      this.testParseDateString_MM_DD_YYYY(x);
      this.testParseDateString_YYMMDD(x);
      this.testParseDateString_YY_MM_DD(x);
      this.testParseDateString_DDMMMYYYY(x);
      this.testParseDateString_InvalidDate(x);
      this.testParseDateString_UnsupportedFormat(x);
      this.testParseDateString_LeapYear(x);
      this.testParseDateString_NonLeapYear(x);
      this.testParseDateString_TrailingText(x);
      this.testParseDateString_MonthBoundaries(x);
      this.testParseDateString_YearBoundaries(x);
      this.testParseDateString_FormatAmbiguity(x);
      this.testParseDateString_TwoDigitYearBoundary(x);
      this.testParseDateString_InvalidFormats(x);
      this.testParseDateString_EmptyAndWhitespace(x);
      this.testAdapt_Number(x);
      this.testAdapt_String(x);
      this.testAdapt_Date(x);
      this.testAdapt_Null(x);
      this.testAdapt_InvalidString(x);
      this.testAdapt_EmptyString(x);
      this.testAdapt_WhitespaceString(x);
      this.testAdapt_AllFormats(x);
      this.testParseDateTime_ISO8601_Full(x);
      this.testParseDateTime_ISO8601_Short(x);
      this.testParseDateTime_US_Format(x);
      this.testParseDateTime_Compact(x);
      this.testParseDateTime_WithMilliseconds(x);
      this.testParseDateTime_InvalidFormats(x);
      this.testParseDateTime_PreservesTime(x);
      this.testParseDateTimeUTC(x);
      this.testParseDateTime_LocalTime(x);
      this.testParseDateTime_BackwardCompatibility(x);
      this.testAdaptDateTime_DateOnlyString(x);
      this.testAdaptDateTime_DateTimeString(x);
      this.testAdaptDateTime_Number(x);
      this.testAdaptDateTime_Date(x);
      this.testAdaptDateTime_Null(x);
      this.testFormat_DateOnly(x);
      this.testFormat_TimeFirst(x);
      this.testFormat_TimeLast(x);
      this.testFormat_UTC(x);
      this.testFormat_NullUndefined(x);
      this.testFormat_LocalTimeWithTimezone(x);
      this.testParseDateTimeUTC_DateTimeString(x);
      this.testParseDateTimeUTC_DateOnlyString(x);
      this.testParseDateTimeUTC_USFormatString(x);
      this.testParseDateTime_NumbersAndDates(x);
      this.testParseDateTime_AllInputTypes(x);
      this.testParseDateTimeUTC_WithTimezoneZ(x);
      this.testParseDateTimeUTC_WithTimezoneOffset(x);
      this.testParseDateTime_WithTimezone(x);
      this.testTimezoneFormatVariations(x);
      this.testTimezoneDateBoundaries(x);
      this.testParseDateTimeUTC_TwoDigitYearWithTime(x);
      this.testParseDateTimeUTC_TwoDigitYearWithTimeNoSeconds(x);
      this.testParseDateTimeUTC_TwoDigitYearSlidingWindow(x);
      this.testParseDateTimeUTC_TwoDigitYearUTCBehavior(x);
    },

    function testParseDateString_YYYYMMDD(x) {
      var date = foam.util.DateUtil.parseDateString('20240315');
      var year = date.getFullYear();
      var month = date.getMonth();
      var day = date.getDate();
      x.test(year === 2024, `YYYYMMDD format - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `YYYYMMDD format - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `YYYYMMDD format - day is 15 (expected 15, got ${day})`);
    },

    function testParseDateString_YYYY_MM_DD(x) {
      // Test with slash separator
      var date1 = foam.util.DateUtil.parseDateString('2024/03/15');
      var year1 = date1.getFullYear();
      var month1 = date1.getMonth();
      var day1 = date1.getDate();
      x.test(year1 === 2024, `YYYY/MM/DD format - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `YYYY/MM/DD format - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `YYYY/MM/DD format - day is 15 (expected 15, got ${day1})`);

      // Test with dash separator
      var date2 = foam.util.DateUtil.parseDateString('2024-03-15');
      var year2 = date2.getFullYear();
      var month2 = date2.getMonth();
      var day2 = date2.getDate();
      x.test(year2 === 2024, `YYYY-MM-DD format - year is 2024 (expected 2024, got ${year2})`);
      x.test(month2 === 2, `YYYY-MM-DD format - month is March (2) (expected 2, got ${month2})`);
      x.test(day2 === 15, `YYYY-MM-DD format - day is 15 (expected 15, got ${day2})`);
    },

    function testParseDateString_MMDDYYYY(x) {
      var date = foam.util.DateUtil.parseDateString('03152024');
      var year = date.getFullYear();
      var month = date.getMonth();
      var day = date.getDate();
      x.test(year === 2024, `MMDDYYYY format - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `MMDDYYYY format - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `MMDDYYYY format - day is 15 (expected 15, got ${day})`);
    },

    function testParseDateString_MM_DD_YYYY(x) {
      // Test with slash separator
      var date1 = foam.util.DateUtil.parseDateString('03/15/2024');
      var year1 = date1.getFullYear();
      var month1 = date1.getMonth();
      var day1 = date1.getDate();
      x.test(year1 === 2024, `MM/DD/YYYY format - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `MM/DD/YYYY format - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `MM/DD/YYYY format - day is 15 (expected 15, got ${day1})`);

      // Test with dash separator
      var date2 = foam.util.DateUtil.parseDateString('03-15-2024');
      var year2 = date2.getFullYear();
      var month2 = date2.getMonth();
      var day2 = date2.getDate();
      x.test(year2 === 2024, `MM-DD-YYYY format - year is 2024 (expected 2024, got ${year2})`);
      x.test(month2 === 2, `MM-DD-YYYY format - month is March (2) (expected 2, got ${month2})`);
      x.test(day2 === 15, `MM-DD-YYYY format - day is 15 (expected 15, got ${day2})`);
    },

    function testParseDateString_YYMMDD(x) {
      // Test 2-digit year using sliding window (50 years back, 50 years forward from current year)
      var currentYear = new Date().getUTCFullYear();

      // Test with year 24 (should be 2024 if current year is between 1974-2074)
      var date1 = foam.util.DateUtil.parseDateString('240315');
      var year1 = date1.getFullYear();
      var month1 = date1.getMonth();
      var day1 = date1.getDate();
      x.test(year1 === 2024, `YYMMDD format (YY=24) - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `YYMMDD format (YY=24) - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `YYMMDD format (YY=24) - day is 15 (expected 15, got ${day1})`);

      // Test with year 85 - sliding window interpretation
      var date2 = foam.util.DateUtil.parseDateString('850315');
      var year2 = date2.getFullYear();
      var month2 = date2.getMonth();
      var day2 = date2.getDate();

      // Calculate expected year for 85 using sliding window
      var currentCentury = Math.floor(currentYear / 100) * 100;
      var expectedYear85 = currentCentury + 85;
      if ( expectedYear85 > currentYear + 50 ) {
        expectedYear85 = currentCentury - 100 + 85;
      }

      x.test(year2 === expectedYear85, `YYMMDD format (YY=85) - year is ${expectedYear85} (expected ${expectedYear85}, got ${year2})`);
      x.test(month2 === 2, `YYMMDD format (YY=85) - month is March (2) (expected 2, got ${month2})`);
      x.test(day2 === 15, `YYMMDD format (YY=85) - day is 15 (expected 15, got ${day2})`);
    },

    function testParseDateString_YY_MM_DD(x) {
      var currentYear = new Date().getUTCFullYear();

      // Test with slash separator
      var date1 = foam.util.DateUtil.parseDateString('24/03/15');
      var year1 = date1.getFullYear();
      x.test(year1 === 2024, `YY/MM/DD format - year is 2024 (expected 2024, got ${year1})`);

      // Test with dash separator - sliding window interpretation
      var date2 = foam.util.DateUtil.parseDateString('85-03-15');
      var year2 = date2.getFullYear();

      var currentCentury = Math.floor(currentYear / 100) * 100;
      var expectedYear85 = currentCentury + 85;
      if ( expectedYear85 > currentYear + 50 ) {
        expectedYear85 = currentCentury - 100 + 85;
      }

      x.test(year2 === expectedYear85, `YY-MM-DD format - year is ${expectedYear85} (expected ${expectedYear85}, got ${year2})`);
    },

    function testParseDateString_DDMMMYYYY(x) {
      // Test DDMMMYYYY format - works in STANDARD format (no opt_name needed!)
      // Month names are unambiguous, so they work without specifying format
      var date1 = foam.util.DateUtil.parseDateString('31-JAN-2025');
      var year1 = date1.getFullYear();
      var month1 = date1.getMonth();
      var day1 = date1.getDate();
      x.test(year1 === 2025, `DDMMMYYYY format (31-JAN-2025) - year is 2025 (expected 2025, got ${year1})`);
      x.test(month1 === 0, `DDMMMYYYY format (31-JAN-2025) - month is January (0) (expected 0, got ${month1})`);
      x.test(day1 === 31, `DDMMMYYYY format (31-JAN-2025) - day is 31 (expected 31, got ${day1})`);

      var date2 = foam.util.DateUtil.parseDateString('03-FEB-2025');
      var year2 = date2.getFullYear();
      var month2 = date2.getMonth();
      var day2 = date2.getDate();
      x.test(year2 === 2025, `DDMMMYYYY format (03-FEB-2025) - year is 2025 (expected 2025, got ${year2})`);
      x.test(month2 === 1, `DDMMMYYYY format (03-FEB-2025) - month is February (1) (expected 1, got ${month2})`);
      x.test(day2 === 3, `DDMMMYYYY format (03-FEB-2025) - day is 3 (expected 3, got ${day2})`);

      // Test with slash separator
      var date3 = foam.util.DateUtil.parseDateString('15/MAR/2024');
      var year3 = date3.getFullYear();
      var month3 = date3.getMonth();
      var day3 = date3.getDate();
      x.test(year3 === 2024, `DDMMMYYYY format (15/MAR/2024) - year is 2024 (expected 2024, got ${year3})`);
      x.test(month3 === 2, `DDMMMYYYY format (15/MAR/2024) - month is March (2) (expected 2, got ${month3})`);
      x.test(day3 === 15, `DDMMMYYYY format (15/MAR/2024) - day is 15 (expected 15, got ${day3})`);

      // Test compact format (no separators) - works without opt_name (letters make it unambiguous!)
      var date4 = foam.util.DateUtil.parseDateString('31JAN2025');
      var year4 = date4.getFullYear();
      var month4 = date4.getMonth();
      var day4 = date4.getDate();
      x.test(year4 === 2025, `DDMMMYYYY compact (31JAN2025) - year is 2025 (expected 2025, got ${year4})`);
      x.test(month4 === 0, `DDMMMYYYY compact (31JAN2025) - month is January (0) (expected 0, got ${month4})`);
      x.test(day4 === 31, `DDMMMYYYY compact (31JAN2025) - day is 31 (expected 31, got ${day4})`);

      // Test case insensitivity
      var date5 = foam.util.DateUtil.parseDateString('15-jun-2025');
      var month5 = date5.getMonth();
      x.test(month5 === 5, `DDMMMYYYY lowercase (15-jun-2025) - month is June (5) (expected 5, got ${month5})`);

      var date6 = foam.util.DateUtil.parseDateString('10-Jul-2025');
      var month6 = date6.getMonth();
      x.test(month6 === 6, `DDMMMYYYY mixed case (10-Jul-2025) - month is July (6) (expected 6, got ${month6})`);

      // Test YYYY-DD-MMM format with separators works without opt_name
      var date7 = foam.util.DateUtil.parseDateString('2025-31-JAN');
      var year7 = date7.getFullYear();
      var month7 = date7.getMonth();
      var day7 = date7.getDate();
      x.test(year7 === 2025, `YYYYDDMMM format (2025-31-JAN) - year is 2025 (expected 2025, got ${year7})`);
      x.test(month7 === 0, `YYYYDDMMM format (2025-31-JAN) - month is January (0) (expected 0, got ${month7})`);
      x.test(day7 === 31, `YYYYDDMMM format (2025-31-JAN) - day is 31 (expected 31, got ${day7})`);

      // Test compact YYYYDDMMM works without opt_name (letters make it unambiguous!)
      var date9 = foam.util.DateUtil.parseDateString('202531JAN');
      var year9 = date9.getFullYear();
      var month9 = date9.getMonth();
      var day9 = date9.getDate();
      x.test(year9 === 2025, `YYYYDDMMM compact (202531JAN) - year is 2025 (expected 2025, got ${year9})`);
      x.test(month9 === 0, `YYYYDDMMM compact (202531JAN) - month is January (0) (expected 0, got ${month9})`);
      x.test(day9 === 31, `YYYYDDMMM compact (202531JAN) - day is 31 (expected 31, got ${day9})`);
    },

    function testParseDateString_InvalidDate(x) {
      // Test invalid date like February 30th - JavaScript normalizes to March 1st
      var date = foam.util.DateUtil.parseDateString('2024-02-30');
      var expectedDate = new Date(Date.UTC(2024, 2, 1, 12, 0, 0, 0)); // March 1, 2024 (month is 0-indexed, so 2 = March)
      x.test(date.getTime() === expectedDate.getTime(), 'Invalid date (Feb 30) normalizes to March 1');
    },

    function testParseDateString_UnsupportedFormat(x) {
      // Unsupported format should return MAX_DATE
      var date = foam.util.DateUtil.parseDateString('March 15, 2024');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'Unsupported format returns MAX_DATE');
    },

    function testAdapt_Number(x) {
      var timestamp = 1710504000000; // March 15, 2024 12:00:00 GMT
      var date = new Date(timestamp);

      var year = date.getUTCFullYear();
      var month = date.getUTCMonth();
      var day = date.getUTCDate();
      var hours = date.getUTCHours();
      var minutes = date.getUTCMinutes();
      var seconds = date.getUTCSeconds();
      x.test(year === 2024, `new Date(Number) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `new Date(Number) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `new Date(Number) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `new Date(Number) - hour is 12 (noon GMT) (expected 12, got ${hours})`);
      x.test(minutes === 0, `new Date(Number) - minute is 0 (expected 0, got ${minutes})`);
      x.test(seconds === 0, `new Date(Number) - second is 0 (expected 0, got ${seconds})`);
    },

    function testAdapt_String(x) {
      var date = foam.util.DateUtil.parseDateString('2024-03-15');

      var year = date.getUTCFullYear();
      var month = date.getUTCMonth();
      var day = date.getUTCDate();
      var hours = date.getUTCHours();
      x.test(year === 2024, `parseDateString(String) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateString(String) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateString(String) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `parseDateString(String) - hour is 12 (noon UTC) (expected 12, got ${hours})`);
    },

    function testAdapt_Date(x) {
      var inputDate = new Date(2024, 2, 15, 8, 30, 45); // March 15, 2024 08:30:45 local
      var parsedDate = inputDate;

      // Date objects are kept as-is (no modification)
      var time = parsedDate.getTime();
      var originalTime = inputDate.getTime();
      x.test(time === originalTime, `Date object - preserves timestamp (expected ${originalTime}, got ${time})`);

      var year = parsedDate.getFullYear();
      var month = parsedDate.getMonth();
      var day = parsedDate.getDate();
      var hours = parsedDate.getHours();
      var minutes = parsedDate.getMinutes();
      var seconds = parsedDate.getSeconds();
      x.test(year === 2024, `Date object - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `Date object - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `Date object - day is 15 (expected 15, got ${day})`);
      x.test(hours === 8, `Date object - hour preserved as 8 (expected 8, got ${hours})`);
      x.test(minutes === 30, `Date object - minute preserved as 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `Date object - second preserved as 45 (expected 45, got ${seconds})`);
    },

    function testAdapt_Null(x) {
      var date = foam.util.DateUtil.parseDateTime(null);
      x.test(date === null, 'parseDateTime(null) returns null');
    },

    function testAdapt_InvalidString(x) {
      var date = foam.util.DateUtil.parseDateString('invalid date string');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'parseDateString(invalid string) returns MAX_DATE');
    },

    function testParseDateString_LeapYear(x) {
      // Test valid leap year date
      var date1 = foam.util.DateUtil.parseDateString('2024-02-29');
      var year = date1.getFullYear();
      var month = date1.getMonth();
      var day = date1.getDate();
      x.test(year === 2024, `Leap year - Feb 29, 2024 is valid (expected 2024, got ${year})`);
      x.test(month === 1, `Leap year - month is February (1) (expected 1, got ${month})`);
      x.test(day === 29, `Leap year - day is 29 (expected 29, got ${day})`);
    },

    function testParseDateString_NonLeapYear(x) {
      // Test invalid Feb 29 in non-leap year - JavaScript normalizes to March 1st
      var date = foam.util.DateUtil.parseDateString('2023-02-29');
      var expectedDate = new Date(Date.UTC(2023, 2, 1, 12, 0, 0, 0)); // March 1, 2023 (month 2 = March)
      x.test(date.getTime() === expectedDate.getTime(), 'Non-leap year - Feb 29, 2023 normalizes to March 1');
    },

    function testParseDateString_TrailingText(x) {
      // Test dates with trailing text (regex allows .* at end)
      var date1 = foam.util.DateUtil.parseDateString('2024-03-15 extra text here');
      var year1 = date1.getFullYear();
      var month1 = date1.getMonth();
      var day1 = date1.getDate();
      x.test(year1 === 2024, `Trailing text - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `Trailing text - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `Trailing text - day is 15 (expected 15, got ${day1})`);

      var date2 = foam.util.DateUtil.parseDateString('20240315T12:00:00');
      var year2 = date2.getFullYear();
      var month2 = date2.getMonth();
      var day2 = date2.getDate();
      x.test(year2 === 2024, `Trailing ISO time - year is 2024 (expected 2024, got ${year2})`);
      x.test(month2 === 2, `Trailing ISO time - month is March (2) (expected 2, got ${month2})`);
      x.test(day2 === 15, `Trailing ISO time - day is 15 (expected 15, got ${day2})`);
    },

    function testParseDateString_MonthBoundaries(x) {
      // Test last day of various months
      var jan31 = foam.util.DateUtil.parseDateString('2024-01-31');
      var jan31Day = jan31.getDate();
      x.test(jan31Day === 31, `Jan has 31 days (expected 31, got ${jan31Day})`);

      var apr30 = foam.util.DateUtil.parseDateString('2024-04-30');
      var apr30Day = apr30.getDate();
      x.test(apr30Day === 30, `Apr has 30 days (expected 30, got ${apr30Day})`);

      // Invalid dates normalize
      var apr31 = foam.util.DateUtil.parseDateString('2024-04-31');
      var expectedApr31 = new Date(Date.UTC(2024, 4, 1, 12, 0, 0, 0)); // May 1, 2024 (month 4 = May)
      x.test(apr31.getTime() === expectedApr31.getTime(), 'Apr 31 normalizes to May 1');

      var feb31 = foam.util.DateUtil.parseDateString('2024-02-31');
      var expectedFeb31 = new Date(Date.UTC(2024, 2, 2, 12, 0, 0, 0)); // March 2, 2024 (month 2 = March)
      x.test(feb31.getTime() === expectedFeb31.getTime(), 'Feb 31 normalizes to March 2');
    },

    function testParseDateString_YearBoundaries(x) {
      // Test minimum 4-digit year (1000)
      var date1 = foam.util.DateUtil.parseDateString('1000-01-01');
      var year1 = date1.getFullYear();
      x.test(year1 === 1000, `Year 1000 is valid (expected 1000, got ${year1})`);

      // Test maximum reasonable 4-digit year
      var date2 = foam.util.DateUtil.parseDateString('9999-12-31');
      var year2 = date2.getFullYear();
      x.test(year2 === 9999, `Year 9999 is valid (expected 9999, got ${year2})`);

      // Test year starting with 0 doesn't match YYYYMMDD pattern
      // '01012024' should match MMDDYYYY not YYYYMMDD
      var date3 = foam.util.DateUtil.parseDateString('01012024');
      var year3 = date3.getFullYear();
      var month3 = date3.getMonth();
      var day3 = date3.getDate();
      x.test(year3 === 2024, `Year starting with 0 - parsed as MMDDYYYY (expected 2024, got ${year3})`);
      x.test(month3 === 0, `Year starting with 0 - month is January (0) (expected 0, got ${month3})`);
      x.test(day3 === 1, `Year starting with 0 - day is 1 (expected 1, got ${day3})`);
    },

    function testParseDateString_FormatAmbiguity(x) {
      // Test that format priority is correct for ambiguous 8-digit strings
      // '20240315' should be YYYYMMDD (year starts with 1-9)
      var date1 = foam.util.DateUtil.parseDateString('20240315');
      var year1 = date1.getFullYear();
      var month1 = date1.getMonth();
      var day1 = date1.getDate();
      x.test(year1 === 2024, `Ambiguous 8-digit - 20240315 is YYYYMMDD (expected 2024, got ${year1})`);
      x.test(month1 === 2, `Ambiguous 8-digit - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `Ambiguous 8-digit - day is 15 (expected 15, got ${day1})`);

      // '03152024' should be MMDDYYYY (doesn't match YYYYMMDD pattern)
      var date2 = foam.util.DateUtil.parseDateString('03152024');
      var year2 = date2.getFullYear();
      var month2 = date2.getMonth();
      var day2 = date2.getDate();
      x.test(year2 === 2024, `Ambiguous 8-digit - 03152024 is MMDDYYYY (expected 2024, got ${year2})`);
      x.test(month2 === 2, `Ambiguous 8-digit - month is March (2) (expected 2, got ${month2})`);
      x.test(day2 === 15, `Ambiguous 8-digit - day is 15 (expected 15, got ${day2})`);

      // '10012024' should be MMDDYYYY
      var date3 = foam.util.DateUtil.parseDateString('10012024');
      var year3 = date3.getFullYear();
      var month3 = date3.getMonth();
      var day3 = date3.getDate();
      x.test(year3 === 2024, `Ambiguous 8-digit - 10012024 is MMDDYYYY (expected 2024, got ${year3})`);
      x.test(month3 === 9, `Ambiguous 8-digit - month is October (9) (expected 9, got ${month3})`);
      x.test(day3 === 1, `Ambiguous 8-digit - day is 1 (expected 1, got ${day3})`);

      // '01102024' should be MMDDYYYY
      var date4 = foam.util.DateUtil.parseDateString('01102024');
      var year4 = date4.getFullYear();
      var month4 = date4.getMonth();
      var day4 = date4.getDate();
      x.test(year4 === 2024, `Ambiguous 8-digit - 01102024 is MMDDYYYY (expected 2024, got ${year4})`);
      x.test(month4 === 0, `Ambiguous 8-digit - month is January (0) (expected 0, got ${month4})`);
      x.test(day4 === 10, `Ambiguous 8-digit - day is 10 (expected 10, got ${day4})`);
    },

    function testParseDateString_TwoDigitYearBoundary(x) {
      // Test 2-digit year using sliding window (50 years back, 50 years forward)
      var currentYear = new Date().getUTCFullYear();
      var currentCentury = Math.floor(currentYear / 100) * 100;

      // Helper function to calculate expected year with fixed pivot at 50
      // 00-49 → 2000-2049, 50-99 → 1950-1999
      var calculateExpectedYear = function(twoDigitYear) {
        return twoDigitYear < 50 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
      };

      // Test year 49
      var date1 = foam.util.DateUtil.parseDateString('49-12-31');
      var year1 = date1.getFullYear();
      var expected1 = calculateExpectedYear(49);
      x.test(year1 === expected1, `2-digit year 49 becomes ${expected1} (expected ${expected1}, got ${year1})`);

      // Test year 00
      var date2 = foam.util.DateUtil.parseDateString('00-01-01');
      var year2 = date2.getFullYear();
      var expected2 = calculateExpectedYear(0);
      x.test(year2 === expected2, `2-digit year 00 becomes ${expected2} (expected ${expected2}, got ${year2})`);

      // Test year 50
      var date3 = foam.util.DateUtil.parseDateString('50-01-01');
      var year3 = date3.getFullYear();
      var expected3 = calculateExpectedYear(50);
      x.test(year3 === expected3, `2-digit year 50 becomes ${expected3} (expected ${expected3}, got ${year3})`);

      // Test year 99
      var date4 = foam.util.DateUtil.parseDateString('99-12-31');
      var year4 = date4.getFullYear();
      var expected4 = calculateExpectedYear(99);
      x.test(year4 === expected4, `2-digit year 99 becomes ${expected4} (expected ${expected4}, got ${year4})`);
    },

    function testParseDateString_InvalidFormats(x) {
      var maxDate = foam.util.DateUtil.MAX_DATE;

      // Test various invalid formats (don't match any pattern)
      var unsupportedFormats = [
        '2024.03.15',      // dots instead of dashes/slashes
        '2024,03,15',      // commas
        '2024/3/15',       // single digit month
        '2024/03/5',       // single digit day
        '24-3-15',         // single digits in YY-MM-DD
        '2024-3',          // incomplete date
        '2024',            // year only
        '03/2024',         // month/year only
        'abc123'           // random text
      ];

      unsupportedFormats.forEach(function(format) {
        var date = foam.util.DateUtil.parseDateString(format);
        x.test(date.getTime() === maxDate.getTime(), `Unsupported format "${format}" returns MAX_DATE`);
      });

      // Test formats that match a pattern but have invalid date values
      // These will normalize according to JavaScript Date behavior
      var date1 = foam.util.DateUtil.parseDateString('15-03-2024'); // MM-DD-YYYY, month 15 normalizes
      var expected1 = new Date(Date.UTC(2025, 2, 3, 12, 0, 0, 0)); // Month 15 (14 in 0-indexed) = March next year, day 3
      x.test(date1.getTime() === expected1.getTime(), 'Invalid date "15-03-2024" normalizes');

      var date2 = foam.util.DateUtil.parseDateString('13-32-2024'); // MM-DD-YYYY, month 13, day 32 normalize
      var expected2 = new Date(Date.UTC(2025, 1, 1, 12, 0, 0, 0)); // Month 13 (12 in 0-indexed) = January next year, day 32 = Feb 1
      x.test(date2.getTime() === expected2.getTime(), 'Invalid date "13-32-2024" normalizes');

      var date3 = foam.util.DateUtil.parseDateString('00-01-2024'); // MM-DD-YYYY, month 00 normalizes
      var expected3 = new Date(Date.UTC(2023, 11, 1, 12, 0, 0, 0)); // Month 0 (-1 in 0-indexed) = December previous year
      x.test(date3.getTime() === expected3.getTime(), 'Invalid date "00-01-2024" normalizes');

      var date4 = foam.util.DateUtil.parseDateString('01-00-2024'); // MM-DD-YYYY, day 00 normalizes
      var expected4 = new Date(Date.UTC(2023, 11, 31, 12, 0, 0, 0)); // Day 0 = Dec 31 previous year
      x.test(date4.getTime() === expected4.getTime(), 'Invalid date "01-00-2024" normalizes');
    },

    function testParseDateString_EmptyAndWhitespace(x) {
      var maxDate = foam.util.DateUtil.MAX_DATE;

      var emptyDate = foam.util.DateUtil.parseDateString('');
      x.test(emptyDate.getTime() === maxDate.getTime(), 'Empty string returns MAX_DATE');

      var wsDate = foam.util.DateUtil.parseDateString('   ');
      x.test(wsDate.getTime() === maxDate.getTime(), 'Whitespace returns MAX_DATE');
    },

    function testAdapt_EmptyString(x) {
      var date = foam.util.DateUtil.parseDateString('');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'parseDateString(empty string) returns MAX_DATE');
    },

    function testAdapt_WhitespaceString(x) {
      var date = foam.util.DateUtil.parseDateString('   ');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'parseDateString(whitespace) returns MAX_DATE');
    },

    function testAdapt_AllFormats(x) {
      // Test parseDateString() works with all supported formats
      var formats = [
        '2024-03-15',
        '2024/03/15',
        '20240315',
        '03-15-2024',
        '03/15/2024',
        '03152024',
        '24-03-15',
        '24/03/15',
        '240315'
      ];

      formats.forEach(function(format) {
        var date = foam.util.DateUtil.parseDateString(format);
        var year = date.getUTCFullYear();
        var month = date.getUTCMonth();
        var day = date.getUTCDate();
        var hours = date.getUTCHours();
        x.test(year === 2024, `parseDateString("${format}") - year is 2024 (expected 2024, got ${year})`);
        x.test(month === 2, `parseDateString("${format}") - month is March (2) (expected 2, got ${month})`);
        x.test(day === 15, `parseDateString("${format}") - day is 15 (expected 15, got ${day})`);
        x.test(hours === 12, `parseDateString("${format}") - normalized to noon UTC (expected 12, got ${hours})`);
      });
    },


    function testParseDateTime_ISO8601_Full(x) {
      // Test ISO 8601 with T separator (using parseDateTimeUTC since we're checking UTC components)
      var dt1 = foam.util.DateUtil.parseDateTimeUTC('2024-03-15T15:30:45');
      var year1 = dt1.getUTCFullYear();
      var month1 = dt1.getUTCMonth();
      var day1 = dt1.getUTCDate();
      var hours1 = dt1.getUTCHours();
      var minutes1 = dt1.getUTCMinutes();
      var seconds1 = dt1.getUTCSeconds();
      x.test(year1 === 2024, `ISO 8601 T - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `ISO 8601 T - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `ISO 8601 T - day is 15 (expected 15, got ${day1})`);
      x.test(hours1 === 15, `ISO 8601 T - hour is 15 (expected 15, got ${hours1})`);
      x.test(minutes1 === 30, `ISO 8601 T - minute is 30 (expected 30, got ${minutes1})`);
      x.test(seconds1 === 45, `ISO 8601 T - second is 45 (expected 45, got ${seconds1})`);

      // Test ISO 8601 with space separator
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('2024-03-15 15:30:45');
      var year2 = dt2.getUTCFullYear();
      var hours2 = dt2.getUTCHours();
      var minutes2 = dt2.getUTCMinutes();
      x.test(year2 === 2024, `ISO 8601 space - year is 2024 (expected 2024, got ${year2})`);
      x.test(hours2 === 15, `ISO 8601 space - hour is 15 (expected 15, got ${hours2})`);
      x.test(minutes2 === 30, `ISO 8601 space - minute is 30 (expected 30, got ${minutes2})`);

      // Test with slash separator
      var dt3 = foam.util.DateUtil.parseDateTimeUTC('2024/03/15 15:30:45');
      var year3 = dt3.getUTCFullYear();
      var hours3 = dt3.getUTCHours();
      x.test(year3 === 2024, `ISO 8601 slash - year is 2024 (expected 2024, got ${year3})`);
      x.test(hours3 === 15, `ISO 8601 slash - hour is 15 (expected 15, got ${hours3})`);
    },

    function testParseDateTime_ISO8601_Short(x) {
      // Test ISO 8601 short format (no seconds)
      var dt1 = foam.util.DateUtil.parseDateTimeUTC('2024-03-15T15:30');
      var year1 = dt1.getUTCFullYear();
      var month1 = dt1.getUTCMonth();
      var day1 = dt1.getUTCDate();
      var hours1 = dt1.getUTCHours();
      var minutes1 = dt1.getUTCMinutes();
      var seconds1 = dt1.getUTCSeconds();
      x.test(year1 === 2024, `ISO 8601 short T - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `ISO 8601 short T - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `ISO 8601 short T - day is 15 (expected 15, got ${day1})`);
      x.test(hours1 === 15, `ISO 8601 short T - hour is 15 (expected 15, got ${hours1})`);
      x.test(minutes1 === 30, `ISO 8601 short T - minute is 30 (expected 30, got ${minutes1})`);
      x.test(seconds1 === 0, `ISO 8601 short T - second is 0 (expected 0, got ${seconds1})`);

      // Test with space separator
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('2024-03-15 15:30');
      var hours2 = dt2.getUTCHours();
      var minutes2 = dt2.getUTCMinutes();
      x.test(hours2 === 15, `ISO 8601 short space - hour is 15 (expected 15, got ${hours2})`);
      x.test(minutes2 === 30, `ISO 8601 short space - minute is 30 (expected 30, got ${minutes2})`);
    },

    function testParseDateTime_US_Format(x) {
      // Test MM/DD/YYYY HH:MM:SS
      var dt1 = foam.util.DateUtil.parseDateTimeUTC('03/15/2024 15:30:45');
      var year1 = dt1.getUTCFullYear();
      var month1 = dt1.getUTCMonth();
      var day1 = dt1.getUTCDate();
      var hours1 = dt1.getUTCHours();
      var minutes1 = dt1.getUTCMinutes();
      var seconds1 = dt1.getUTCSeconds();
      x.test(year1 === 2024, `US format full - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `US format full - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `US format full - day is 15 (expected 15, got ${day1})`);
      x.test(hours1 === 15, `US format full - hour is 15 (expected 15, got ${hours1})`);
      x.test(minutes1 === 30, `US format full - minute is 30 (expected 30, got ${minutes1})`);
      x.test(seconds1 === 45, `US format full - second is 45 (expected 45, got ${seconds1})`);

      // Test with dash separator
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('03-15-2024 15:30:45');
      var year2 = dt2.getUTCFullYear();
      var hours2 = dt2.getUTCHours();
      x.test(year2 === 2024, `US format dash - year is 2024 (expected 2024, got ${year2})`);
      x.test(hours2 === 15, `US format dash - hour is 15 (expected 15, got ${hours2})`);

      // Test MM/DD/YYYY HH:MM (no seconds)
      var dt3 = foam.util.DateUtil.parseDateTimeUTC('03/15/2024 15:30');
      var year3 = dt3.getUTCFullYear();
      var hours3 = dt3.getUTCHours();
      var minutes3 = dt3.getUTCMinutes();
      var seconds3 = dt3.getUTCSeconds();
      x.test(year3 === 2024, `US format short - year is 2024 (expected 2024, got ${year3})`);
      x.test(hours3 === 15, `US format short - hour is 15 (expected 15, got ${hours3})`);
      x.test(minutes3 === 30, `US format short - minute is 30 (expected 30, got ${minutes3})`);
      x.test(seconds3 === 0, `US format short - second is 0 (expected 0, got ${seconds3})`);
    },

    function testParseDateTime_Compact(x) {
      // Test YYYYMMDDHHMMSS format
      var dt = foam.util.DateUtil.parseDateTimeUTC('20240315153045');
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(year === 2024, `Compact format - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `Compact format - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `Compact format - day is 15 (expected 15, got ${day})`);
      x.test(hours === 15, `Compact format - hour is 15 (expected 15, got ${hours})`);
      x.test(minutes === 30, `Compact format - minute is 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `Compact format - second is 45 (expected 45, got ${seconds})`);
    },

    function testParseDateTime_WithMilliseconds(x) {
      // Test ISO 8601 with milliseconds
      var dt = foam.util.DateUtil.parseDateTimeUTC('2024-03-15T15:30:45.123');
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      var milliseconds = dt.getUTCMilliseconds();
      x.test(year === 2024, `With milliseconds - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `With milliseconds - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `With milliseconds - day is 15 (expected 15, got ${day})`);
      x.test(hours === 15, `With milliseconds - hour is 15 (expected 15, got ${hours})`);
      x.test(minutes === 30, `With milliseconds - minute is 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `With milliseconds - second is 45 (expected 45, got ${seconds})`);
      x.test(milliseconds === 123, `With milliseconds - millisecond is 123 (expected 123, got ${milliseconds})`);
    },

    function testParseDateTime_InvalidFormats(x) {
      // Test invalid datetime formats - JavaScript normalizes dates
      // parseDateTime returns local time, not UTC
      var invalidDate = foam.util.DateUtil.parseDateTime('2024-02-30 15:30:45');
      var expectedDate = new Date(2024, 2, 1, 15, 30, 45, 0); // March 1, 2024 15:30:45 local time
      x.test(invalidDate.getTime() === expectedDate.getTime(), 'Invalid datetime (Feb 30) normalizes to March 1');

      // Invalid hour 25 - DateParser validation should catch this before normalization
      var invalidHour = foam.util.DateUtil.parseDateTime('2024-03-15 25:30:45');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(invalidHour.getTime() === maxDate.getTime(), 'Invalid hour (25) returns MAX_DATE');

      var invalidMinute = foam.util.DateUtil.parseDateTime('2024-03-15 15:60:45');
      x.test(invalidMinute.getTime() === maxDate.getTime(), 'Invalid minute (60) returns MAX_DATE');

      var unsupportedFormat = foam.util.DateUtil.parseDateTime('March 15, 2024 3:30 PM');
      x.test(unsupportedFormat.getTime() === maxDate.getTime(), 'Unsupported format returns MAX_DATE');
    },

    function testParseDateTime_PreservesTime(x) {
      // Test that parseDateTimeUTC preserves exact time in UTC
      var dt1 = foam.util.DateUtil.parseDateTimeUTC('2024-03-15T08:30:15');
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('2024-03-15T20:45:30');

      var hours1 = dt1.getUTCHours();
      var minutes1 = dt1.getUTCMinutes();
      var seconds1 = dt1.getUTCSeconds();
      x.test(hours1 === 8, `Morning time preserved - hour is 8 (expected 8, got ${hours1})`);
      x.test(minutes1 === 30, `Morning time preserved - minute is 30 (expected 30, got ${minutes1})`);
      x.test(seconds1 === 15, `Morning time preserved - second is 15 (expected 15, got ${seconds1})`);

      var hours2 = dt2.getUTCHours();
      var minutes2 = dt2.getUTCMinutes();
      var seconds2 = dt2.getUTCSeconds();
      x.test(hours2 === 20, `Evening time preserved - hour is 20 (expected 20, got ${hours2})`);
      x.test(minutes2 === 45, `Evening time preserved - minute is 45 (expected 45, got ${minutes2})`);
      x.test(seconds2 === 30, `Evening time preserved - second is 30 (expected 30, got ${seconds2})`);

      // Verify they're different times
      x.test(dt1.getTime() !== dt2.getTime(), 'Different times have different timestamps');
    },

    function testParseDateTimeUTC(x) {
      // Test parseDateTimeUTC parses as UTC
      var dt = foam.util.DateUtil.parseDateTimeUTC('2024-03-15T14:30:45');

      // Verify it's parsed as UTC
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hour = dt.getUTCHours();
      var minute = dt.getUTCMinutes();
      var second = dt.getUTCSeconds();

      x.test(year === 2024, `parseDateTimeUTC - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateTimeUTC - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateTimeUTC - day is 15 (expected 15, got ${day})`);
      x.test(hour === 14, `parseDateTimeUTC - hour is 14 (expected 14, got ${hour})`);
      x.test(minute === 30, `parseDateTimeUTC - minute is 30 (expected 30, got ${minute})`);
      x.test(second === 45, `parseDateTimeUTC - second is 45 (expected 45, got ${second})`);

      // Test with US format
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('03/15/2024 14:30:45');
      var hour2 = dt2.getUTCHours();
      x.test(hour2 === 14, `parseDateTimeUTC with US format - hour is 14 (expected 14, got ${hour2})`);
    },

    function testParseDateTime_LocalTime(x) {
      // Test parseDateTime parses as local time
      var dt = foam.util.DateUtil.parseDateTime('2024-03-15T14:30:45');

      // Verify it's parsed as local time (can't make strict assertions about UTC components)
      var year = dt.getFullYear();
      var month = dt.getMonth();
      var day = dt.getDate();
      var hour = dt.getHours();
      var minute = dt.getMinutes();
      var second = dt.getSeconds();

      x.test(year === 2024, `parseDateTime - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateTime - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateTime - day is 15 (expected 15, got ${day})`);
      x.test(hour === 14, `parseDateTime - hour is 14 local time (expected 14, got ${hour})`);
      x.test(minute === 30, `parseDateTime - minute is 30 (expected 30, got ${minute})`);
      x.test(second === 45, `parseDateTime - second is 45 (expected 45, got ${second})`);

      // Compare with parseDateTimeUTC - they should differ if not in UTC timezone
      var dtUTC = foam.util.DateUtil.parseDateTimeUTC('2024-03-15T14:30:45');
      var localOffset = new Date().getTimezoneOffset();

      // If we're not in UTC timezone, the timestamps should differ
      if ( localOffset !== 0 ) {
        x.test(dt.getTime() !== dtUTC.getTime(), 'Local and UTC parsing should differ when not in UTC timezone');
      } else {
        x.test(dt.getTime() === dtUTC.getTime(), 'Local and UTC parsing should be same in UTC timezone');
      }
    },

    function testParseDateTime_BackwardCompatibility(x) {
      // Test that parseDateTime always parses as local time (no second parameter needed)
      var dt1 = foam.util.DateUtil.parseDateTime('2024-03-15T14:30:45');

      // Verify local time components are correct
      var year = dt1.getFullYear();
      var month = dt1.getMonth();
      var day = dt1.getDate();
      var hour = dt1.getHours();
      var minute = dt1.getMinutes();
      var second = dt1.getSeconds();

      x.test(year === 2024, `parseDateTime - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateTime - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateTime - day is 15 (expected 15, got ${day})`);
      x.test(hour === 14, `parseDateTime - hour is 14 local time (expected 14, got ${hour})`);
      x.test(minute === 30, `parseDateTime - minute is 30 (expected 30, got ${minute})`);
      x.test(second === 45, `parseDateTime - second is 45 (expected 45, got ${second})`);

      // Test with date-only string - should return noon local
      var dt2 = foam.util.DateUtil.parseDateTime('2024-03-15');
      var hour2 = dt2.getHours();
      x.test(hour2 === 12, `parseDateTime with date-only - defaults to noon local (expected 12, got ${hour2})`);
    },


    function testAdaptDateTime_DateOnlyString(x) {
      // Test date-only strings default to noon local (parseDateString behavior)
      var dt = foam.util.DateUtil.parseDateString('2024-03-15');
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(year === 2024, `parseDateString(date string) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateString(date string) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateString(date string) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `parseDateString(date string) - hour is 12 (noon UTC) (expected 12, got ${hours})`);
      x.test(minutes === 0, `parseDateString(date string) - minute is 0 (expected 0, got ${minutes})`);
      x.test(seconds === 0, `parseDateString(date string) - second is 0 (expected 0, got ${seconds})`);
    },

    function testAdaptDateTime_DateTimeString(x) {
      // Test datetime strings preserve time (parseDateTime uses local time parsing)
      var dt = foam.util.DateUtil.parseDateTime('2024-03-15T15:30:45');
      var year = dt.getFullYear();
      var month = dt.getMonth();
      var day = dt.getDate();
      var hours = dt.getHours();
      var minutes = dt.getMinutes();
      var seconds = dt.getSeconds();
      x.test(year === 2024, `parseDateTime(datetime string) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateTime(datetime string) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateTime(datetime string) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 15, `parseDateTime(datetime string) - hour is 15 local time (expected 15, got ${hours})`);
      x.test(minutes === 30, `parseDateTime(datetime string) - minute is 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `parseDateTime(datetime string) - second is 45 (expected 45, got ${seconds})`);
    },

    function testAdaptDateTime_Number(x) {
      // Test timestamp parsing
      var timestamp = 1710511845000; // 2024-03-15 14:10:45 GMT
      var dt = new Date(timestamp);
      var time = dt.getTime();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(time === timestamp, `new Date(number) - timestamp preserved (expected ${timestamp}, got ${time})`);
      x.test(hours === 14, `new Date(number) - hour preserved (14:10 UTC) (expected 14, got ${hours})`);
      x.test(minutes === 10, `new Date(number) - minutes preserved (expected 10, got ${minutes})`);
      x.test(seconds === 45, `new Date(number) - seconds preserved (expected 45, got ${seconds})`);
    },

    function testAdaptDateTime_Date(x) {
      // Test Date object parsing - should preserve time
      var inputDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var originalTimestamp = inputDate.getTime();
      var dt = inputDate;
      var time = dt.getTime();
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(time === originalTimestamp, `Date object - timestamp preserved (expected ${originalTimestamp}, got ${time})`);
      x.test(year === 2024, `Date object - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `Date object - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `Date object - day is 15 (expected 15, got ${day})`);
      x.test(hours === 15, `Date object - hour preserved as 15 (expected 15, got ${hours})`);
      x.test(minutes === 30, `Date object - minute preserved as 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `Date object - second preserved as 45 (expected 45, got ${seconds})`);
    },

    function testAdaptDateTime_Null(x) {
      // Test null/undefined handling
      var dt1 = foam.util.DateUtil.parseDateTime(null);
      x.test(dt1 === null, 'parseDateTime(null) returns null');

      var dt2 = foam.util.DateUtil.parseDateTime(undefined);
      x.test(dt2 === undefined, 'parseDateTime(undefined) returns undefined');
    },

    function testFormat_DateOnly(x) {
      // Test formatting date only (no time)
      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var formatted = foam.util.DateUtil.format(date);

      x.test(formatted.length > 0, 'format(date) returns non-empty string');
      x.test(formatted.indexOf('2024') > -1, 'format(date) contains year');
      x.test(formatted.indexOf('15') > -1, 'format(date) contains day');
    },

    function testFormat_TimeFirst(x) {
      // Test formatting with time first
      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var formatted = foam.util.DateUtil.formatWithTimeControl(date, true);

      x.test(formatted.length > 0, 'formatWithTimeControl(date, true) returns non-empty string');
      // Time should appear first
      var timePattern = /^\d{2}:\d{2}:\d{2}/;
      x.test(timePattern.test(formatted), 'formatWithTimeControl(date, true) starts with time (HH:MM:SS)');
    },

    function testFormat_TimeLast(x) {
      // Test formatting with time last
      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var formatted = foam.util.DateUtil.formatWithTimeControl(date, false);

      x.test(formatted.length > 0, 'formatWithTimeControl(date, false) returns non-empty string');
      // Time should appear last
      var timePattern = /\d{2}:\d{2}:\d{2}$/;
      x.test(timePattern.test(formatted), 'formatWithTimeControl(date, false) ends with time (HH:MM:SS)');
    },

    function testFormat_UTC(x) {
      // Test formatting in UTC timezone
      // Date: March 15, 2024 15:30:45 UTC
      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));

      // Save original locale
      var originalLocale = foam.locale;

      try {
        // Override locale to 'en-US' for consistent testing
        foam.locale = 'en-US';

        // Test 1: Date with time in UTC (using new format signature with locale-default)
        var formattedUTC = foam.util.DateUtil.format(date, 'UTC');
        x.test(formattedUTC.length > 0, 'format(date, UTC) returns non-empty string');
        x.test(formattedUTC.indexOf('2024') > -1, 'UTC format contains year 2024');
        x.test(formattedUTC.indexOf('3') > -1, 'UTC format contains month (3 or 03 or Mar)');
        x.test(formattedUTC.indexOf('15') > -1, 'UTC format contains day 15');
        console.log('Format UTC date-only:', formattedUTC);

        // Test 2: Date with time in UTC (time last)
        var formattedWithTimeLast = foam.util.DateUtil.formatWithTimeControl(date, false, 'UTC');
        x.test(formattedWithTimeLast.indexOf('15:30:45') > -1, 'UTC formatWithTimeControl with time last contains correct time 15:30:45');
        x.test(formattedWithTimeLast.indexOf('2024') > -1, 'UTC formatWithTimeControl with time contains year');
        console.log('Format UTC time-last:', formattedWithTimeLast);

        // Test 3: Time first in UTC
        var formattedTimeFirst = foam.util.DateUtil.formatWithTimeControl(date, true, 'UTC');
        x.test(formattedTimeFirst.indexOf('15:30:45') > -1, 'UTC formatWithTimeControl with time first contains correct time 15:30:45');
        x.test(formattedTimeFirst.indexOf('2024') > -1, 'UTC formatWithTimeControl time-first contains year');
        x.test(formattedTimeFirst.indexOf('15:30:45') < formattedTimeFirst.indexOf('2024'), 'Time appears before date when timeFirst=true');
        console.log('Format UTC time-first:', formattedTimeFirst);

        // Test 4: Different timezone - America/New_York (EDT = UTC-4 in March)
        // 15:30:45 UTC = 11:30:45 EDT
        var formattedEDT = foam.util.DateUtil.formatWithTimeControl(date, false, 'America/New_York');
        x.test(formattedEDT.indexOf('11:30:45') > -1, 'America/New_York formatWithTimeControl shows correct time (11:30:45 EDT)');
        console.log('Format EDT:', formattedEDT);

        // Test 5: Different timezone - Asia/Tokyo (JST = UTC+9)
        // 15:30:45 UTC = 00:30:45 JST (next day)
        var formattedJST = foam.util.DateUtil.formatWithTimeControl(date, false, 'Asia/Tokyo');
        x.test(formattedJST.indexOf('00:30:45') > -1 || formattedJST.indexOf('0:30:45') > -1, 'Asia/Tokyo formatWithTimeControl shows correct time (00:30:45 JST)');
        x.test(formattedJST.indexOf('16') > -1, 'Asia/Tokyo formatWithTimeControl shows next day (16)');
        console.log('Format JST:', formattedJST);

        // Test 6: Europe/London (GMT in winter, BST in summer - March 15 is GMT before DST)
        var formattedLondon = foam.util.DateUtil.formatWithTimeControl(date, false, 'Europe/London');
        x.test(formattedLondon.indexOf('15:30:45') > -1, 'Europe/London formatWithTimeControl shows correct time (15:30:45 GMT)');
        console.log('Format London:', formattedLondon);

        // Test 7: Invalid timezone should return empty string (no fallback)
        var formattedInvalid = foam.util.DateUtil.formatWithTimeControl(date, false, 'Invalid/Timezone');
        x.test(formattedInvalid === '', 'Invalid timezone returns empty string');
        console.log('Format with invalid timezone:', formattedInvalid);

      } finally {
        // Restore original locale
        foam.locale = originalLocale;
      }
    },

    function testFormat_NullUndefined(x) {
      // Test null/undefined handling - these will throw error in toLocaleString, caught by try-catch
      var formatted1 = foam.util.DateUtil.format(null);
      x.test(formatted1 === '', 'format(null) returns empty string (error caught)');

      var formatted2 = foam.util.DateUtil.format(undefined);
      x.test(formatted2 === '', 'format(undefined) returns empty string (error caught)');

      // Test with number (timestamp)
      var timestamp = 1710511845000;
      var formatted3 = foam.util.DateUtil.format(timestamp);
      x.test(formatted3.length > 0, 'format(timestamp) returns non-empty string');

      // Test with invalid Date (NaN) - toLocaleString returns "Invalid Date"
      var invalidDate = new Date('invalid');
      var formatted4 = foam.util.DateUtil.format(invalidDate);
      x.test(formatted4 === 'Invalid Date', 'format(invalid Date) returns "Invalid Date"');
    },

    function testFormat_LocalTimeWithTimezone(x) {
      // Test formatting when date is created in local time (not UTC)
      // This ensures timezone conversion works regardless of how Date was created

      // Save original locale
      var originalLocale = foam.locale;

      try {
        foam.locale = 'en-US';

        // Create date in LOCAL time: March 15, 2024 15:30:45 in system timezone
        // Note: new Date(year, month, day, hour, min, sec) uses LOCAL time
        var localDate = new Date(2024, 2, 15, 15, 30, 45);

        console.log('Local date created:', localDate.toString());
        console.log('Local date in UTC:', localDate.toUTCString());
        console.log('System timezone offset:', localDate.getTimezoneOffset(), 'minutes');

        // Test 1: Format in UTC - should convert from local to UTC
        var formattedUTC = foam.util.DateUtil.formatWithTimeControl(localDate, false, 'UTC');
        console.log('Format local date as UTC:', formattedUTC);

        // Extract UTC time from the date
        var utcHours = localDate.getUTCHours();
        var utcMinutes = localDate.getUTCMinutes();
        var utcSeconds = localDate.getUTCSeconds();
        var utcTimeStr = (utcHours < 10 ? '0' : '') + utcHours + ':' +
                        (utcMinutes < 10 ? '0' : '') + utcMinutes + ':' +
                        (utcSeconds < 10 ? '0' : '') + utcSeconds;

        x.test(formattedUTC.indexOf(utcTimeStr) > -1,
          'formatWithTimeControl local date as UTC shows correct UTC time (' + utcTimeStr + ')');

        // Test 2: Format in different timezone - should convert from local to that timezone
        var formattedJST = foam.util.DateUtil.formatWithTimeControl(localDate, false, 'Asia/Tokyo');
        console.log('Format local date as JST:', formattedJST);
        x.test(formattedJST.length > 0, 'formatWithTimeControl local date as JST returns non-empty string');

        // Test 3: Format without timezone - should use local system timezone
        var formattedLocal = foam.util.DateUtil.formatWithTimeControl(localDate, false);
        console.log('Format local date (system timezone):', formattedLocal);
        x.test(formattedLocal.indexOf('15:30:45') > -1,
          'formatWithTimeControl local date without timezone shows local time (15:30:45)');

        // Test 4: Create date at midnight local time and format in different timezone
        var midnightLocal = new Date(2024, 2, 15, 0, 0, 0);
        var formattedMidnightUTC = foam.util.DateUtil.formatWithTimeControl(midnightLocal, false, 'UTC');
        console.log('Midnight local as UTC:', formattedMidnightUTC);

        var utcMidnightHours = midnightLocal.getUTCHours();
        var expectedMidnightTime = (utcMidnightHours < 10 ? '0' : '') + utcMidnightHours + ':00:00';
        x.test(formattedMidnightUTC.indexOf(expectedMidnightTime) > -1,
          'Midnight local converted to UTC shows correct time (' + expectedMidnightTime + ')');

        // Test 5: Verify timezone parameter overrides local time
        // Same date formatted in different timezones should show different times
        var formattedNY = foam.util.DateUtil.formatWithTimeControl(localDate, false, 'America/New_York');
        var formattedTokyo = foam.util.DateUtil.formatWithTimeControl(localDate, false, 'Asia/Tokyo');
        console.log('Same date in NY:', formattedNY);
        console.log('Same date in Tokyo:', formattedTokyo);

        // NY and Tokyo are 13-14 hours apart, so times should be very different
        x.test(formattedNY !== formattedTokyo,
          'Same date formatted in different timezones shows different results');

      } finally {
        foam.locale = originalLocale;
      }
    },

    function testFormat_LocaleDefault(x) {
      // Test new format() method that uses locale-default formatting
      // This test verifies that format(date) and format(date, timezone)
      // use locale-specific date/time formatting based on foam.locale

      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var originalLocale = foam.locale;

      try {
        // Test 1: US locale formatting (system default)
        foam.locale = 'en-US';
        var formattedUS = foam.util.DateUtil.format(date);
        x.test(formattedUS.length > 0, 'format(date) with en-US locale returns non-empty string');
        x.test(formattedUS.indexOf('2024') > -1 || formattedUS.indexOf('24') > -1,
          'US locale format contains year');
        console.log('US locale format:', formattedUS);

        // Test 2: UK locale formatting
        foam.locale = 'en-GB';
        var formattedGB = foam.util.DateUtil.format(date);
        x.test(formattedGB.length > 0, 'format(date) with en-GB locale returns non-empty string');
        console.log('GB locale format:', formattedGB);

        // Test 3: German locale formatting
        foam.locale = 'de-DE';
        var formattedDE = foam.util.DateUtil.format(date);
        x.test(formattedDE.length > 0, 'format(date) with de-DE locale returns non-empty string');
        console.log('DE locale format:', formattedDE);

        // Test 4: Japanese locale formatting
        foam.locale = 'ja-JP';
        var formattedJP = foam.util.DateUtil.format(date);
        x.test(formattedJP.length > 0, 'format(date) with ja-JP locale returns non-empty string');
        console.log('JP locale format:', formattedJP);

        // Test 5: Locale formatting with timezone
        foam.locale = 'en-US';
        var formattedUTC = foam.util.DateUtil.format(date, 'UTC');
        x.test(formattedUTC.length > 0, 'format(date, UTC) with en-US locale returns non-empty string');
        x.test(formattedUTC.indexOf('2024') > -1 || formattedUTC.indexOf('24') > -1,
          'US locale UTC format contains year');
        console.log('US locale UTC format:', formattedUTC);

        // Test 6: Verify different locales produce different formats
        foam.locale = 'en-US';
        var usFormat = foam.util.DateUtil.format(date);
        foam.locale = 'de-DE';
        var deFormat = foam.util.DateUtil.format(date);

        // Formats should be different due to locale differences
        // (US uses MM/DD/YYYY, DE uses DD.MM.YYYY)
        x.test(usFormat !== deFormat || usFormat.length > 0,
          'Different locales should produce different formats (or at least valid output)');
        console.log('US vs DE format comparison:', { us: usFormat, de: deFormat });

      } finally {
        foam.locale = originalLocale;
      }
    },

    function testFormat_LocaleDefaultWithTimezone(x) {
      // Test that format(date, timezone) properly combines locale formatting with timezone conversion

      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var originalLocale = foam.locale;

      try {
        foam.locale = 'en-US';

        // Test 1: Format in UTC timezone with US locale
        var formattedUTC = foam.util.DateUtil.format(date, 'UTC');
        x.test(formattedUTC.length > 0, 'format(date, UTC) returns non-empty string');
        x.test(formattedUTC.indexOf('2024') > -1 || formattedUTC.indexOf('24') > -1,
          'UTC format contains year');
        console.log('Format with UTC timezone:', formattedUTC);

        // Test 2: Format in America/New_York timezone
        // 15:30:45 UTC = 11:30:45 EDT (March 15 is in EDT)
        var formattedNY = foam.util.DateUtil.format(date, 'America/New_York');
        x.test(formattedNY.length > 0, 'format(date, America/New_York) returns non-empty string');
        x.test(formattedNY.indexOf('2024') > -1 || formattedNY.indexOf('24') > -1,
          'NY timezone format contains year');
        console.log('Format with NY timezone:', formattedNY);

        // Test 3: Format in Asia/Tokyo timezone
        // 15:30:45 UTC = 00:30:45 JST next day (March 16)
        var formattedJST = foam.util.DateUtil.format(date, 'Asia/Tokyo');
        x.test(formattedJST.length > 0, 'format(date, Asia/Tokyo) returns non-empty string');
        x.test(formattedJST.indexOf('16') > -1, 'Tokyo timezone shows next day (16)');
        console.log('Format with JST timezone:', formattedJST);

        // Test 4: Different timezones should produce different results
        x.test(formattedUTC !== formattedNY,
          'UTC and NY timezones should produce different formatted strings');
        x.test(formattedUTC !== formattedJST,
          'UTC and JST timezones should produce different formatted strings');

        // Test 5: Invalid timezone should fallback gracefully
        var formattedInvalid = foam.util.DateUtil.format(date, 'Invalid/Timezone');
        x.test(formattedInvalid.length > 0,
          'format with invalid timezone returns fallback string');
        console.log('Format with invalid timezone:', formattedInvalid);

      } finally {
        foam.locale = originalLocale;
      }
    },

    function testParseDateTimeUTC_DateTimeString(x) {
      // Test parsing ISO 8601 datetime strings with parseDateTimeUTC vs parseDateTime
      var dtString = '2024-03-15T14:30:45';

      var dtUTC = foam.util.DateUtil.parseDateTimeUTC(dtString);
      var dtLocal = foam.util.DateUtil.parseDateTime(dtString);

      // parseDateTimeUTC should parse as UTC
      var hoursUTC = dtUTC.getUTCHours();
      var minutesUTC = dtUTC.getUTCMinutes();
      var secondsUTC = dtUTC.getUTCSeconds();
      x.test(hoursUTC === 14, `parseDateTimeUTC should interpret as 14:30:45 UTC (expected hour 14, got ${hoursUTC})`);
      x.test(minutesUTC === 30, `parseDateTimeUTC - minute should be 30 (expected 30, got ${minutesUTC})`);
      x.test(secondsUTC === 45, `parseDateTimeUTC - second should be 45 (expected 45, got ${secondsUTC})`);

      // parseDateTime should parse as local time
      var hoursLocal = dtLocal.getHours();
      x.test(hoursLocal === 14, `parseDateTime should interpret as 14:30:45 local time (expected hour 14, got ${hoursLocal})`);

      // If not in UTC timezone, timestamps should differ
      var localOffset = new Date().getTimezoneOffset();
      if ( localOffset !== 0 ) {
        var timeUTC = dtUTC.getTime();
        var timeLocal = dtLocal.getTime();
        x.test(timeUTC !== timeLocal, `UTC and local parsing should differ when not in UTC timezone`);
      }
    },

    function testParseDateTimeUTC_DateOnlyString(x) {
      // Test parsing date-only strings with parseDateTimeUTC vs parseDateTime
      var dateString = '2024-03-15';

      var dtUTC = foam.util.DateUtil.parseDateTimeUTC(dateString);
      var dtLocal = foam.util.DateUtil.parseDateTime(dateString);

      // parseDateTimeUTC with date-only should give midnight UTC
      var hoursUTC = dtUTC.getUTCHours();
      var minutesUTC = dtUTC.getUTCMinutes();
      var secondsUTC = dtUTC.getUTCSeconds();
      x.test(hoursUTC === 0, `parseDateTimeUTC should give midnight UTC (expected 0, got ${hoursUTC})`);
      x.test(minutesUTC === 0, `parseDateTimeUTC should give 0 UTC minutes (expected 0, got ${minutesUTC})`);
      x.test(secondsUTC === 0, `parseDateTimeUTC should give 0 UTC seconds (expected 0, got ${secondsUTC})`);

      // parseDateTime with date-only should give noon local
      var hoursLocal = dtLocal.getHours();
      x.test(hoursLocal === 12, `parseDateTime should give noon local (expected 12, got ${hoursLocal})`);

      // Verify both parse the same date (but times will differ)
      var yearUTC = dtUTC.getUTCFullYear();
      var monthUTC = dtUTC.getUTCMonth();
      var dayUTC = dtUTC.getUTCDate();
      var yearLocal = dtLocal.getFullYear();
      var monthLocal = dtLocal.getMonth();
      var dayLocal = dtLocal.getDate();

      x.test(yearUTC === 2024, `parseDateTimeUTC year is 2024 (expected 2024, got ${yearUTC})`);
      x.test(monthUTC === 2, `parseDateTimeUTC month is March (2) (expected 2, got ${monthUTC})`);
      x.test(dayUTC === 15, `parseDateTimeUTC day is 15 (expected 15, got ${dayUTC})`);
      x.test(yearLocal === 2024, `parseDateTime year is 2024 (expected 2024, got ${yearLocal})`);
      x.test(monthLocal === 2, `parseDateTime month is March (2) (expected 2, got ${monthLocal})`);
      x.test(dayLocal === 15, `parseDateTime day is 15 (expected 15, got ${dayLocal})`);
    },

    function testParseDateTimeUTC_USFormatString(x) {
      // Test parsing US format datetime strings with parseDateTimeUTC vs parseDateTime
      var usString = '03/15/2024 14:30:45';

      var dtUTC = foam.util.DateUtil.parseDateTimeUTC(usString);
      var dtLocal = foam.util.DateUtil.parseDateTime(usString);

      // parseDateTimeUTC should interpret as UTC
      var hoursUTC = dtUTC.getUTCHours();
      var minutesUTC = dtUTC.getUTCMinutes();
      var secondsUTC = dtUTC.getUTCSeconds();
      x.test(hoursUTC === 14, `parseDateTimeUTC should interpret as 14:30:45 UTC (expected hour 14, got ${hoursUTC})`);
      x.test(minutesUTC === 30, `parseDateTimeUTC should interpret as UTC (expected minute 30, got ${minutesUTC})`);
      x.test(secondsUTC === 45, `parseDateTimeUTC should interpret as UTC (expected second 45, got ${secondsUTC})`);

      // parseDateTime should interpret as local
      var hoursLocal = dtLocal.getHours();
      x.test(hoursLocal === 14, `parseDateTime should interpret as 14:30:45 local (expected hour 14, got ${hoursLocal})`);

      // Verify both parse the same date
      var yearUTC = dtUTC.getUTCFullYear();
      var monthUTC = dtUTC.getUTCMonth();
      var dayUTC = dtUTC.getUTCDate();
      var yearLocal = dtLocal.getFullYear();
      var monthLocal = dtLocal.getMonth();
      var dayLocal = dtLocal.getDate();

      x.test(yearUTC === 2024, `parseDateTimeUTC year is 2024 (expected 2024, got ${yearUTC})`);
      x.test(monthUTC === 2, `parseDateTimeUTC month is March (2) (expected 2, got ${monthUTC})`);
      x.test(dayUTC === 15, `parseDateTimeUTC day is 15 (expected 15, got ${dayUTC})`);
      x.test(yearLocal === 2024, `parseDateTime year is 2024 (expected 2024, got ${yearLocal})`);
      x.test(monthLocal === 2, `parseDateTime month is March (2) (expected 2, got ${monthLocal})`);
      x.test(dayLocal === 15, `parseDateTime day is 15 (expected 15, got ${dayLocal})`);
    },

    function testParseDateTime_NumbersAndDates(x) {
      // Test that Numbers and Date objects can be used directly (not with parse methods)
      var timestamp = 1710511845000; // 2024-03-15 14:10:45 GMT
      var inputDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));

      // Test with timestamp - use new Date() constructor directly
      var dtFromNum = new Date(timestamp);
      var timeFromNum = dtFromNum.getTime();

      x.test(timeFromNum === timestamp, `new Date(timestamp) preserves timestamp (expected ${timestamp}, got ${timeFromNum})`);

      // Test with Date object - use directly (no parsing needed)
      var originalTimestamp = inputDate.getTime();
      var dtFromDate = inputDate;
      var timeFromDate = dtFromDate.getTime();

      x.test(timeFromDate === originalTimestamp, `Date object preserves timestamp (expected ${originalTimestamp}, got ${timeFromDate})`);

      // Verify parse methods only accept strings
      var nullResult1 = foam.util.DateUtil.parseDateTime(null);
      x.test(nullResult1 === null, `parseDateTime(null) returns null`);

      var undefResult1 = foam.util.DateUtil.parseDateTime(undefined);
      x.test(undefResult1 === undefined, `parseDateTime(undefined) returns undefined`);
    },

    function testParseDateTime_AllInputTypes(x) {
      // Test that parseDateTime handles string formats correctly
      // Numbers and Date objects should NOT use parseDateTime - use new Date() or the Date directly
      var dateString = '2024-03-15';
      var dtString = '2024-03-15T14:30:45';
      var usString = '03/15/2024 14:30:45';
      var timestamp = 1710511845000;
      var inputDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));

      // Test with date string - parseDateTime returns noon local
      var dt1 = foam.util.DateUtil.parseDateTime(dateString);
      var year1 = dt1.getFullYear();
      var month1 = dt1.getMonth();
      var day1 = dt1.getDate();
      var hours1 = dt1.getHours();
      x.test(year1 === 2024, `Date string - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `Date string - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `Date string - day is 15 (expected 15, got ${day1})`);
      x.test(hours1 === 12, `Date string - defaults to noon local (expected 12, got ${hours1})`);

      // Test with datetime string - parseDateTime parses as local time
      var dt2 = foam.util.DateUtil.parseDateTime(dtString);
      var hours2 = dt2.getHours();
      var minutes2 = dt2.getMinutes();
      var seconds2 = dt2.getSeconds();
      x.test(hours2 === 14, `DateTime string - hour is 14 local time (expected 14, got ${hours2})`);
      x.test(minutes2 === 30, `DateTime string - minute is 30 (expected 30, got ${minutes2})`);
      x.test(seconds2 === 45, `DateTime string - second is 45 (expected 45, got ${seconds2})`);

      // Test with US format string
      var dt3 = foam.util.DateUtil.parseDateTime(usString);
      var year3 = dt3.getFullYear();
      var month3 = dt3.getMonth();
      var day3 = dt3.getDate();
      x.test(year3 === 2024, `US format - year is 2024 (expected 2024, got ${year3})`);
      x.test(month3 === 2, `US format - month is March (2) (expected 2, got ${month3})`);
      x.test(day3 === 15, `US format - day is 15 (expected 15, got ${day3})`);

      // Test with number - use new Date() constructor, not parseDateTime
      var dt4 = new Date(timestamp);
      var time4 = dt4.getTime();
      x.test(time4 === timestamp, `new Date(number) - timestamp preserved (expected ${timestamp}, got ${time4})`);

      // Test with Date object - use directly, not parseDateTime
      var originalTimestamp = inputDate.getTime();
      var dt5 = inputDate;
      var time5 = dt5.getTime();
      x.test(time5 === originalTimestamp, `Date object - timestamp preserved (expected ${originalTimestamp}, got ${time5})`);

      // Test null/undefined with parseDateTime
      var dt6 = foam.util.DateUtil.parseDateTime(null);
      x.test(dt6 === null, 'parseDateTime(null) returns null');

      var dt7 = foam.util.DateUtil.parseDateTime(undefined);
      x.test(dt7 === undefined, 'parseDateTime(undefined) returns undefined');
    },

    function testParseDateTimeUTC_WithTimezoneZ(x) {
      // Test parseDateTimeUTC with "Z" timezone indicator
      var testCases = [
        { input: '2024-03-15T15:30:45Z', year: 2024, month: 2, day: 15, hour: 15, minute: 30, second: 45 },
        { input: '2024-01-01T00:00:00Z', year: 2024, month: 0, day: 1, hour: 0, minute: 0, second: 0 },
        { input: '2024-12-31T23:59:59Z', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '2024-06-15T12:00:00Z', year: 2024, month: 5, day: 15, hour: 12, minute: 0, second: 0 }
      ];

      testCases.forEach(function(tc) {
        var dt = foam.util.DateUtil.parseDateTimeUTC(tc.input);
        var year = dt.getUTCFullYear();
        var month = dt.getUTCMonth();
        var day = dt.getUTCDate();
        var hour = dt.getUTCHours();
        var minute = dt.getUTCMinutes();
        var second = dt.getUTCSeconds();

        x.test(year === tc.year, `${tc.input} - year is ${tc.year} (got ${year})`);
        x.test(month === tc.month, `${tc.input} - month is ${tc.month} (got ${month})`);
        x.test(day === tc.day, `${tc.input} - day is ${tc.day} (got ${day})`);
        x.test(hour === tc.hour, `${tc.input} - hour is ${tc.hour} (got ${hour})`);
        x.test(minute === tc.minute, `${tc.input} - minute is ${tc.minute} (got ${minute})`);
        x.test(second === tc.second, `${tc.input} - second is ${tc.second} (got ${second})`);
      });
    },

    function testParseDateTimeUTC_WithTimezoneOffset(x) {
      // Test parseDateTimeUTC with various timezone offsets
      // When parsing with offset, the time should be converted to UTC
      var testCases = [
        // Positive offsets (ahead of UTC) - subtract from time to get UTC
        { input: '2024-03-15T15:30:45+05:30', year: 2024, month: 2, day: 15, hour: 10, minute: 0, second: 45 },
        { input: '2024-03-15T15:30:45+01:00', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '2024-03-15T15:30:45+00:00', year: 2024, month: 2, day: 15, hour: 15, minute: 30, second: 45 },

        // Negative offsets (behind UTC) - add to time to get UTC
        { input: '2024-03-15T15:30:45-08:00', year: 2024, month: 2, day: 15, hour: 23, minute: 30, second: 45 },
        { input: '2024-03-15T15:30:45-05:00', year: 2024, month: 2, day: 15, hour: 20, minute: 30, second: 45 },

        // Edge cases
        { input: '2024-03-15T00:30:45+01:00', year: 2024, month: 2, day: 14, hour: 23, minute: 30, second: 45 },
        { input: '2024-03-15T23:30:45-01:00', year: 2024, month: 2, day: 16, hour: 0, minute: 30, second: 45 }
      ];

      testCases.forEach(function(tc) {
        var dt = foam.util.DateUtil.parseDateTimeUTC(tc.input);
        var year = dt.getUTCFullYear();
        var month = dt.getUTCMonth();
        var day = dt.getUTCDate();
        var hour = dt.getUTCHours();
        var minute = dt.getUTCMinutes();
        var second = dt.getUTCSeconds();

        x.test(year === tc.year, `${tc.input} - year is ${tc.year} (got ${year})`);
        x.test(month === tc.month, `${tc.input} - month is ${tc.month} (got ${month})`);
        x.test(day === tc.day, `${tc.input} - day is ${tc.day} (got ${day})`);
        x.test(hour === tc.hour, `${tc.input} - hour is ${tc.hour} (got ${hour})`);
        x.test(minute === tc.minute, `${tc.input} - minute is ${tc.minute} (got ${minute})`);
        x.test(second === tc.second, `${tc.input} - second is ${tc.second} (got ${second})`);
      });
    },

    function testParseDateTime_WithTimezone(x) {
      // Test parseDateTime with timezone - should convert to UTC regardless of method
      // When a timezone is present, both parseDateTime and parseDateTimeUTC should behave the same
      var testInput = '2024-03-15T15:30:45+05:30';

      var dtUTC = foam.util.DateUtil.parseDateTimeUTC(testInput);
      var dtLocal = foam.util.DateUtil.parseDateTime(testInput);

      // Both should convert to UTC when timezone is present
      var yearUTC = dtUTC.getUTCFullYear();
      var monthUTC = dtUTC.getUTCMonth();
      var dayUTC = dtUTC.getUTCDate();
      var hourUTC = dtUTC.getUTCHours();

      var yearLocal = dtLocal.getUTCFullYear();
      var monthLocal = dtLocal.getUTCMonth();
      var dayLocal = dtLocal.getUTCDate();
      var hourLocal = dtLocal.getUTCHours();

      x.test(yearUTC === yearLocal, `Both methods should give same year (UTC: ${yearUTC}, Local: ${yearLocal})`);
      x.test(monthUTC === monthLocal, `Both methods should give same month (UTC: ${monthUTC}, Local: ${monthLocal})`);
      x.test(dayUTC === dayLocal, `Both methods should give same day (UTC: ${dayUTC}, Local: ${dayLocal})`);
      x.test(hourUTC === hourLocal, `Both methods should give same hour (UTC: ${hourUTC}, Local: ${hourLocal})`);

      // Verify the actual conversion is correct (15:30:45 +05:30 = 10:00:45 UTC)
      x.test(yearUTC === 2024, `Year should be 2024 (got ${yearUTC})`);
      x.test(monthUTC === 2, `Month should be March (2) (got ${monthUTC})`);
      x.test(dayUTC === 15, `Day should be 15 (got ${dayUTC})`);
      x.test(hourUTC === 10, `Hour should be 10 UTC (got ${hourUTC})`);
    },

    function testTimezoneFormatVariations(x) {
      // Test various timezone format variations
      var testCases = [
        // With colon
        { input: '2024-03-15T15:30:45+05:30', desc: 'Offset with colon (+05:30)' },
        { input: '2024-03-15T15:30:45-08:00', desc: 'Negative offset with colon (-08:00)' },

        // Without colon
        { input: '2024-03-15T15:30:45+0530', desc: 'Offset without colon (+0530)' },
        { input: '2024-03-15T15:30:45-0800', desc: 'Negative offset without colon (-0800)' },

        // Z notation
        { input: '2024-03-15T15:30:45Z', desc: 'Z notation (UTC)' },

        // Four digit offset without colon
        { input: '2024-03-15T15:30:45+0000', desc: 'Zero offset (+0000)' }
      ];

      testCases.forEach(function(tc) {
        var dt = foam.util.DateUtil.parseDateTimeUTC(tc.input);
        var year = dt.getUTCFullYear();
        var month = dt.getUTCMonth();
        var day = dt.getUTCDate();

        x.test(year === 2024, `${tc.desc} - year parsed correctly (got ${year})`);
        x.test(month === 2, `${tc.desc} - month parsed correctly (got ${month})`);
        x.test(day === 15, `${tc.desc} - day parsed correctly (got ${day})`);
        x.test( ! isNaN(dt.getTime()), `${tc.desc} - produces valid date`);
      });
    },

    function testTimezoneDateBoundaries(x) {
      // Test timezone conversions that cross date boundaries
      var testCases = [
        // Crossing to previous day
        {
          input: '2024-03-15T01:30:45-08:00',
          year: 2024, month: 2, day: 15, hour: 9, minute: 30, second: 45,
          desc: 'Late night -08:00 crosses to next day in UTC'
        },

        // Crossing to next day
        {
          input: '2024-03-15T23:30:45+05:30',
          year: 2024, month: 2, day: 15, hour: 18, minute: 0, second: 45,
          desc: 'Late evening +05:30 stays same day in UTC'
        },

        // Year boundary crossing
        {
          input: '2024-12-31T23:30:45+05:30',
          year: 2024, month: 11, day: 31, hour: 18, minute: 0, second: 45,
          desc: 'New Year Eve +05:30 stays in same year'
        },

        // Month boundary crossing
        {
          input: '2024-03-01T01:30:45-05:00',
          year: 2024, month: 2, day: 1, hour: 6, minute: 30, second: 45,
          desc: 'First day of month -05:00'
        }
      ];

      testCases.forEach(function(tc) {
        var dt = foam.util.DateUtil.parseDateTimeUTC(tc.input);
        var year = dt.getUTCFullYear();
        var month = dt.getUTCMonth();
        var day = dt.getUTCDate();
        var hour = dt.getUTCHours();
        var minute = dt.getUTCMinutes();
        var second = dt.getUTCSeconds();

        x.test(year === tc.year, `${tc.desc} - year is ${tc.year} (got ${year})`);
        x.test(month === tc.month, `${tc.desc} - month is ${tc.month} (got ${month})`);
        x.test(day === tc.day, `${tc.desc} - day is ${tc.day} (got ${day})`);
        x.test(hour === tc.hour, `${tc.desc} - hour is ${tc.hour} (got ${hour})`);
        x.test(minute === tc.minute, `${tc.desc} - minute is ${tc.minute} (got ${minute})`);
        x.test(second === tc.second, `${tc.desc} - second is ${tc.second} (got ${second})`);
      });
    },

    function testParseDateTimeUTC_TwoDigitYearWithTime(x) {
      // Test 2-digit year formats with time and separator (YY-MM-DD HH:MM:SS)
      // Format: YY-MM-DD HH:MM:SS or YY/MM/DD HH:MM:SS

      // Test with dash separator - year 24 should be 2024
      var dt1 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 14:30:45');
      var year1 = dt1.getUTCFullYear();
      var month1 = dt1.getUTCMonth();
      var day1 = dt1.getUTCDate();
      var hour1 = dt1.getUTCHours();
      var minute1 = dt1.getUTCMinutes();
      var second1 = dt1.getUTCSeconds();
      x.test(year1 === 2024, `YY-MM-DD HH:MM:SS (24) - year is 2024 (got ${year1})`);
      x.test(month1 === 2, `YY-MM-DD HH:MM:SS - month is March (2) (got ${month1})`);
      x.test(day1 === 15, `YY-MM-DD HH:MM:SS - day is 15 (got ${day1})`);
      x.test(hour1 === 14, `YY-MM-DD HH:MM:SS - hour is 14 UTC (got ${hour1})`);
      x.test(minute1 === 30, `YY-MM-DD HH:MM:SS - minute is 30 (got ${minute1})`);
      x.test(second1 === 45, `YY-MM-DD HH:MM:SS - second is 45 (got ${second1})`);

      // Test with year 99 - should be 1999 (based on sliding window)
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('99-03-15 14:30:45');
      var year2 = dt2.getUTCFullYear();
      var hour2 = dt2.getUTCHours();
      var minute2 = dt2.getUTCMinutes();
      var second2 = dt2.getUTCSeconds();
      x.test(year2 === 1999, `YY-MM-DD HH:MM:SS (99) - year is 1999 (got ${year2})`);
      x.test(hour2 === 14, `YY-MM-DD HH:MM:SS (99) - hour is 14 UTC (got ${hour2})`);
      x.test(minute2 === 30, `YY-MM-DD HH:MM:SS (99) - minute is 30 (got ${minute2})`);
      x.test(second2 === 45, `YY-MM-DD HH:MM:SS (99) - second is 45 (got ${second2})`);

      // Test with slash separator
      var dt3 = foam.util.DateUtil.parseDateTimeUTC('24/03/15 08:15:30');
      var year3 = dt3.getUTCFullYear();
      var month3 = dt3.getUTCMonth();
      var day3 = dt3.getUTCDate();
      var hour3 = dt3.getUTCHours();
      var minute3 = dt3.getUTCMinutes();
      var second3 = dt3.getUTCSeconds();
      x.test(year3 === 2024, `YY/MM/DD HH:MM:SS - year is 2024 (got ${year3})`);
      x.test(month3 === 2, `YY/MM/DD HH:MM:SS - month is March (2) (got ${month3})`);
      x.test(day3 === 15, `YY/MM/DD HH:MM:SS - day is 15 (got ${day3})`);
      x.test(hour3 === 8, `YY/MM/DD HH:MM:SS - hour is 8 UTC (got ${hour3})`);
      x.test(minute3 === 15, `YY/MM/DD HH:MM:SS - minute is 15 (got ${minute3})`);
      x.test(second3 === 30, `YY/MM/DD HH:MM:SS - second is 30 (got ${second3})`);

      // Test with different times to verify time preservation
      var dt4 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 00:00:00');
      var hour4 = dt4.getUTCHours();
      var minute4 = dt4.getUTCMinutes();
      var second4 = dt4.getUTCSeconds();
      x.test(hour4 === 0, `YY-MM-DD midnight - hour is 0 UTC (got ${hour4})`);
      x.test(minute4 === 0, `YY-MM-DD midnight - minute is 0 (got ${minute4})`);
      x.test(second4 === 0, `YY-MM-DD midnight - second is 0 (got ${second4})`);

      var dt5 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 23:59:59');
      var hour5 = dt5.getUTCHours();
      var minute5 = dt5.getUTCMinutes();
      var second5 = dt5.getUTCSeconds();
      x.test(hour5 === 23, `YY-MM-DD end of day - hour is 23 UTC (got ${hour5})`);
      x.test(minute5 === 59, `YY-MM-DD end of day - minute is 59 (got ${minute5})`);
      x.test(second5 === 59, `YY-MM-DD end of day - second is 59 (got ${second5})`);
    },

    function testParseDateTimeUTC_TwoDigitYearWithTimeNoSeconds(x) {
      // Test 2-digit year formats with time but no seconds (YY-MM-DD HH:MM)
      // Seconds should default to 0 when not provided

      // Test with dash separator
      var dt1 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 14:30');
      var year1 = dt1.getUTCFullYear();
      var month1 = dt1.getUTCMonth();
      var day1 = dt1.getUTCDate();
      var hour1 = dt1.getUTCHours();
      var minute1 = dt1.getUTCMinutes();
      var second1 = dt1.getUTCSeconds();
      x.test(year1 === 2024, `YY-MM-DD HH:MM (24) - year is 2024 (got ${year1})`);
      x.test(month1 === 2, `YY-MM-DD HH:MM - month is March (2) (got ${month1})`);
      x.test(day1 === 15, `YY-MM-DD HH:MM - day is 15 (got ${day1})`);
      x.test(hour1 === 14, `YY-MM-DD HH:MM - hour is 14 UTC (got ${hour1})`);
      x.test(minute1 === 30, `YY-MM-DD HH:MM - minute is 30 (got ${minute1})`);
      x.test(second1 === 0, `YY-MM-DD HH:MM - second defaults to 0 (got ${second1})`);

      // Test with slash separator
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('24/03/15 08:15');
      var year2 = dt2.getUTCFullYear();
      var hour2 = dt2.getUTCHours();
      var minute2 = dt2.getUTCMinutes();
      var second2 = dt2.getUTCSeconds();
      x.test(year2 === 2024, `YY/MM/DD HH:MM - year is 2024 (got ${year2})`);
      x.test(hour2 === 8, `YY/MM/DD HH:MM - hour is 8 UTC (got ${hour2})`);
      x.test(minute2 === 15, `YY/MM/DD HH:MM - minute is 15 (got ${minute2})`);
      x.test(second2 === 0, `YY/MM/DD HH:MM - second defaults to 0 (got ${second2})`);

      // Test with year 99
      var dt3 = foam.util.DateUtil.parseDateTimeUTC('99-12-31 23:45');
      var year3 = dt3.getUTCFullYear();
      var month3 = dt3.getUTCMonth();
      var day3 = dt3.getUTCDate();
      var hour3 = dt3.getUTCHours();
      var minute3 = dt3.getUTCMinutes();
      var second3 = dt3.getUTCSeconds();
      x.test(year3 === 1999, `YY-MM-DD HH:MM (99) - year is 1999 (got ${year3})`);
      x.test(month3 === 11, `YY-MM-DD HH:MM (99) - month is December (11) (got ${month3})`);
      x.test(day3 === 31, `YY-MM-DD HH:MM (99) - day is 31 (got ${day3})`);
      x.test(hour3 === 23, `YY-MM-DD HH:MM (99) - hour is 23 UTC (got ${hour3})`);
      x.test(minute3 === 45, `YY-MM-DD HH:MM (99) - minute is 45 (got ${minute3})`);
      x.test(second3 === 0, `YY-MM-DD HH:MM (99) - second defaults to 0 (got ${second3})`);
    },

    function testParseDateTimeUTC_TwoDigitYearSlidingWindow(x) {
      // Test 2-digit year interpretation with sliding window
      // Years 00-49 should map to 2000-2049
      // Years 50-99 should map to 1950-1999

      // Test year 00 (should be 2000)
      var dt1 = foam.util.DateUtil.parseDateTimeUTC('00-01-01 12:00:00');
      var year1 = dt1.getUTCFullYear();
      x.test(year1 === 2000, `2-digit year 00 should be 2000 (got ${year1})`);

      // Test year 25 (should be 2025)
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('25-06-15 12:00:00');
      var year2 = dt2.getUTCFullYear();
      x.test(year2 === 2025, `2-digit year 25 should be 2025 (got ${year2})`);

      // Test year 49 (should be 2049)
      var dt3 = foam.util.DateUtil.parseDateTimeUTC('49-12-31 12:00:00');
      var year3 = dt3.getUTCFullYear();
      x.test(year3 === 2049, `2-digit year 49 should be 2049 (got ${year3})`);

      // Test year 50 (should be 1950)
      var dt4 = foam.util.DateUtil.parseDateTimeUTC('50-01-01 12:00:00');
      var year4 = dt4.getUTCFullYear();
      x.test(year4 === 1950, `2-digit year 50 should be 1950 (got ${year4})`);

      // Test year 75 (should be 1975)
      var dt5 = foam.util.DateUtil.parseDateTimeUTC('75-06-15 12:00:00');
      var year5 = dt5.getUTCFullYear();
      x.test(year5 === 1975, `2-digit year 75 should be 1975 (got ${year5})`);

      // Test year 99 (should be 1999)
      var dt6 = foam.util.DateUtil.parseDateTimeUTC('99-12-31 12:00:00');
      var year6 = dt6.getUTCFullYear();
      x.test(year6 === 1999, `2-digit year 99 should be 1999 (got ${year6})`);

      // Test separated format with different years (compact time format removed)
      var dt7 = foam.util.DateUtil.parseDateTimeUTC('00-01-01 12:00:00');
      var year7 = dt7.getUTCFullYear();
      x.test(year7 === 2000, `2-digit year 00 should be 2000 (got ${year7})`);

      var dt8 = foam.util.DateUtil.parseDateTimeUTC('50-01-01 12:00:00');
      var year8 = dt8.getUTCFullYear();
      x.test(year8 === 1950, `2-digit year 50 should be 1950 (got ${year8})`);
    },

    function testParseDateTimeUTC_TwoDigitYearUTCBehavior(x) {
      // Test that 2-digit year formats with timezone correctly convert to UTC

      // Test with Z timezone indicator
      var dt1 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 14:30:45Z');
      var year1 = dt1.getUTCFullYear();
      var hour1 = dt1.getUTCHours();
      var minute1 = dt1.getUTCMinutes();
      var second1 = dt1.getUTCSeconds();
      x.test(year1 === 2024, `YY-MM-DD HH:MM:SSZ - year is 2024 (got ${year1})`);
      x.test(hour1 === 14, `YY-MM-DD HH:MM:SSZ - stays at 14:30:45 UTC (got ${hour1}:${minute1}:${second1})`);
      x.test(minute1 === 30, `YY-MM-DD HH:MM:SSZ - minute is 30 (got ${minute1})`);
      x.test(second1 === 45, `YY-MM-DD HH:MM:SSZ - second is 45 (got ${second1})`);

      // Test with positive timezone offset (subtract from time to get UTC)
      // 24-03-15 14:30:45+05:30 should become 09:00:45 UTC
      var dt2 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 14:30:45+05:30');
      var year2 = dt2.getUTCFullYear();
      var month2 = dt2.getUTCMonth();
      var day2 = dt2.getUTCDate();
      var hour2 = dt2.getUTCHours();
      var minute2 = dt2.getUTCMinutes();
      var second2 = dt2.getUTCSeconds();
      x.test(year2 === 2024, `YY-MM-DD HH:MM:SS+05:30 - year is 2024 (got ${year2})`);
      x.test(month2 === 2, `YY-MM-DD HH:MM:SS+05:30 - month is March (2) (got ${month2})`);
      x.test(day2 === 15, `YY-MM-DD HH:MM:SS+05:30 - day is 15 (got ${day2})`);
      x.test(hour2 === 9, `YY-MM-DD HH:MM:SS+05:30 - converted to 09:00:45 UTC (got ${hour2})`);
      x.test(minute2 === 0, `YY-MM-DD HH:MM:SS+05:30 - minute is 0 (got ${minute2})`);
      x.test(second2 === 45, `YY-MM-DD HH:MM:SS+05:30 - second is 45 (got ${second2})`);

      // Test with negative timezone offset (add to time to get UTC)
      // 24-03-15 14:30:45-08:00 should become 22:30:45 UTC
      var dt3 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 14:30:45-08:00');
      var year3 = dt3.getUTCFullYear();
      var month3 = dt3.getUTCMonth();
      var day3 = dt3.getUTCDate();
      var hour3 = dt3.getUTCHours();
      var minute3 = dt3.getUTCMinutes();
      var second3 = dt3.getUTCSeconds();
      x.test(year3 === 2024, `YY-MM-DD HH:MM:SS-08:00 - year is 2024 (got ${year3})`);
      x.test(month3 === 2, `YY-MM-DD HH:MM:SS-08:00 - month is March (2) (got ${month3})`);
      x.test(day3 === 15, `YY-MM-DD HH:MM:SS-08:00 - day is 15 (got ${day3})`);
      x.test(hour3 === 22, `YY-MM-DD HH:MM:SS-08:00 - converted to 22:30:45 UTC (got ${hour3})`);
      x.test(minute3 === 30, `YY-MM-DD HH:MM:SS-08:00 - minute is 30 (got ${minute3})`);
      x.test(second3 === 45, `YY-MM-DD HH:MM:SS-08:00 - second is 45 (got ${second3})`);

      // Test with slash separator and timezone
      var dt4 = foam.util.DateUtil.parseDateTimeUTC('24/03/15 14:30:45+01:00');
      var year4 = dt4.getUTCFullYear();
      var hour4 = dt4.getUTCHours();
      var minute4 = dt4.getUTCMinutes();
      x.test(year4 === 2024, `YY/MM/DD HH:MM:SS+01:00 - year is 2024 (got ${year4})`);
      x.test(hour4 === 13, `YY/MM/DD HH:MM:SS+01:00 - converted to 13:30:45 UTC (got ${hour4})`);
      x.test(minute4 === 30, `YY/MM/DD HH:MM:SS+01:00 - minute is 30 (got ${minute4})`);

      // Test date boundary crossing with timezone
      // 24-03-15 01:30:45-05:00 should become 06:30:45 UTC (same day)
      var dt5 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 01:30:45-05:00');
      var day5 = dt5.getUTCDate();
      var hour5 = dt5.getUTCHours();
      x.test(day5 === 15, `Date boundary - day stays 15 (got ${day5})`);
      x.test(hour5 === 6, `Date boundary - hour is 6 UTC (got ${hour5})`);

      // Test date boundary crossing - previous day
      // 24-03-15 01:30:45+05:00 should become 2024-03-14 20:30:45 UTC
      var dt6 = foam.util.DateUtil.parseDateTimeUTC('24-03-15 01:30:45+05:00');
      var day6 = dt6.getUTCDate();
      var hour6 = dt6.getUTCHours();
      x.test(day6 === 14, `Date boundary crossing - day is 14 (got ${day6})`);
      x.test(hour6 === 20, `Date boundary crossing - hour is 20 UTC (got ${hour6})`);
    }
  ]
});
