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
    async function runTest(x) {
      await this.testParseDateString_YYYYMMDD(x);
      await this.testParseDateString_YYYY_MM_DD(x);
      await this.testParseDateString_MMDDYYYY(x);
      await this.testParseDateString_MM_DD_YYYY(x);
      await this.testParseDateString_YYMMDD(x);
      await this.testParseDateString_YY_MM_DD(x);
      await this.testParseDateString_InvalidDate(x);
      await this.testParseDateString_UnsupportedFormat(x);
      await this.testParseDateString_LeapYear(x);
      await this.testParseDateString_NonLeapYear(x);
      await this.testParseDateString_TrailingText(x);
      await this.testParseDateString_MonthBoundaries(x);
      await this.testParseDateString_YearBoundaries(x);
      await this.testParseDateString_FormatAmbiguity(x);
      await this.testParseDateString_TwoDigitYearBoundary(x);
      await this.testParseDateString_InvalidFormats(x);
      await this.testParseDateString_EmptyAndWhitespace(x);
      await this.testAdapt_Number(x);
      await this.testAdapt_String(x);
      await this.testAdapt_Date(x);
      await this.testAdapt_Null(x);
      await this.testAdapt_InvalidString(x);
      await this.testAdapt_EmptyString(x);
      await this.testAdapt_WhitespaceString(x);
      await this.testAdapt_AllFormats(x);
      await this.testFORMATS_ORDER(x);
      await this.testParseDateTime_ISO8601_Full(x);
      await this.testParseDateTime_ISO8601_Short(x);
      await this.testParseDateTime_US_Format(x);
      await this.testParseDateTime_Compact(x);
      await this.testParseDateTime_WithMilliseconds(x);
      await this.testParseDateTime_InvalidFormats(x);
      await this.testParseDateTime_PreservesTime(x);
      await this.testParseDateTimeUTC(x);
      await this.testParseDateTime_LocalTime(x);
      await this.testParseDateTime_BackwardCompatibility(x);
      await this.testDATETIME_FORMATS_ORDER(x);
      await this.testAdaptDateTime_DateOnlyString(x);
      await this.testAdaptDateTime_DateTimeString(x);
      await this.testAdaptDateTime_Number(x);
      await this.testAdaptDateTime_Date(x);
      await this.testAdaptDateTime_Null(x);
      await this.testFormat_DateOnly(x);
      await this.testFormat_TimeFirst(x);
      await this.testFormat_TimeLast(x);
      await this.testFormat_UTC(x);
      await this.testFormat_NullUndefined(x);
      await this.testParseDateTimeUTC_DateTimeString(x);
      await this.testParseDateTimeUTC_DateOnlyString(x);
      await this.testParseDateTimeUTC_USFormatString(x);
      await this.testParseDateTime_NumbersAndDates(x);
      await this.testParseDateTime_AllInputTypes(x);
      await this.testParseDateTimeUTC_WithTimezoneZ(x);
      await this.testParseDateTimeUTC_WithTimezoneOffset(x);
      await this.testParseDateTime_WithTimezone(x);
      await this.testTimezoneFormatVariations(x);
      await this.testTimezoneDateBoundaries(x);
    },

    async function testParseDateString_YYYYMMDD(x) {
      var date = foam.util.DateUtil.parseDateString('20240315');
      var year = date.getFullYear();
      var month = date.getMonth();
      var day = date.getDate();
      x.test(year === 2024, `YYYYMMDD format - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `YYYYMMDD format - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `YYYYMMDD format - day is 15 (expected 15, got ${day})`);
    },

    async function testParseDateString_YYYY_MM_DD(x) {
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

    async function testParseDateString_MMDDYYYY(x) {
      var date = foam.util.DateUtil.parseDateString('03152024');
      var year = date.getFullYear();
      var month = date.getMonth();
      var day = date.getDate();
      x.test(year === 2024, `MMDDYYYY format - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `MMDDYYYY format - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `MMDDYYYY format - day is 15 (expected 15, got ${day})`);
    },

    async function testParseDateString_MM_DD_YYYY(x) {
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

    async function testParseDateString_YYMMDD(x) {
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

    async function testParseDateString_YY_MM_DD(x) {
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

    async function testParseDateString_InvalidDate(x) {
      // Test invalid date like February 30th - should return MAX_DATE
      var date = foam.util.DateUtil.parseDateString('2024-02-30');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'Invalid date (Feb 30) returns MAX_DATE');
    },

    async function testParseDateString_UnsupportedFormat(x) {
      // Unsupported format should return MAX_DATE
      var date = foam.util.DateUtil.parseDateString('March 15, 2024');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'Unsupported format returns MAX_DATE');
    },

    async function testAdapt_Number(x) {
      var timestamp = 1710489600000; // March 15, 2024 12:00:00 GMT
      var date = foam.util.DateUtil.parseDateTime(timestamp);

      var year = date.getUTCFullYear();
      var month = date.getUTCMonth();
      var day = date.getUTCDate();
      var hours = date.getUTCHours();
      var minutes = date.getUTCMinutes();
      var seconds = date.getUTCSeconds();
      x.test(year === 2024, `parseDateTime(Number) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateTime(Number) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateTime(Number) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `parseDateTime(Number) - hour is 12 (noon GMT) (expected 12, got ${hours})`);
      x.test(minutes === 0, `parseDateTime(Number) - minute is 0 (expected 0, got ${minutes})`);
      x.test(seconds === 0, `parseDateTime(Number) - second is 0 (expected 0, got ${seconds})`);
    },

    async function testAdapt_String(x) {
      var date = foam.util.DateUtil.parseDateString('2024-03-15');

      var year = date.getFullYear();
      var month = date.getMonth();
      var day = date.getDate();
      var hours = date.getHours();
      x.test(year === 2024, `parseDateString(String) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateString(String) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateString(String) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `parseDateString(String) - hour is 12 (noon local) (expected 12, got ${hours})`);
    },

    async function testAdapt_Date(x) {
      var inputDate = new Date(2024, 2, 15, 8, 30, 45); // March 15, 2024 08:30:45 local
      var parsedDate = foam.util.DateUtil.parseDateTime(inputDate);

      // parseDateTime on Date objects returns the date as-is (no modification)
      var time = parsedDate.getTime();
      var originalTime = inputDate.getTime();
      x.test(time === originalTime, `parseDateTime(Date) - preserves timestamp (expected ${originalTime}, got ${time})`);

      var year = parsedDate.getFullYear();
      var month = parsedDate.getMonth();
      var day = parsedDate.getDate();
      var hours = parsedDate.getHours();
      var minutes = parsedDate.getMinutes();
      var seconds = parsedDate.getSeconds();
      x.test(year === 2024, `parseDateTime(Date) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateTime(Date) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateTime(Date) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 8, `parseDateTime(Date) - hour preserved as 8 (expected 8, got ${hours})`);
      x.test(minutes === 30, `parseDateTime(Date) - minute preserved as 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `parseDateTime(Date) - second preserved as 45 (expected 45, got ${seconds})`);
    },

    async function testAdapt_Null(x) {
      var date = foam.util.DateUtil.parseDateTime(null);
      x.test(date === null, 'parseDateTime(null) returns null');
    },

    async function testAdapt_InvalidString(x) {
      var date = foam.util.DateUtil.parseDateString('invalid date string');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'parseDateString(invalid string) returns MAX_DATE');
    },

    async function testParseDateString_LeapYear(x) {
      // Test valid leap year date
      var date1 = foam.util.DateUtil.parseDateString('2024-02-29');
      var year = date1.getFullYear();
      var month = date1.getMonth();
      var day = date1.getDate();
      x.test(year === 2024, `Leap year - Feb 29, 2024 is valid (expected 2024, got ${year})`);
      x.test(month === 1, `Leap year - month is February (1) (expected 1, got ${month})`);
      x.test(day === 29, `Leap year - day is 29 (expected 29, got ${day})`);
    },

    async function testParseDateString_NonLeapYear(x) {
      // Test invalid Feb 29 in non-leap year - should return MAX_DATE
      var date = foam.util.DateUtil.parseDateString('2023-02-29');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'Non-leap year - Feb 29, 2023 returns MAX_DATE');
    },

    async function testParseDateString_TrailingText(x) {
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

    async function testParseDateString_MonthBoundaries(x) {
      // Test last day of various months
      var jan31 = foam.util.DateUtil.parseDateString('2024-01-31');
      var jan31Day = jan31.getDate();
      x.test(jan31Day === 31, `Jan has 31 days (expected 31, got ${jan31Day})`);

      var apr30 = foam.util.DateUtil.parseDateString('2024-04-30');
      var apr30Day = apr30.getDate();
      x.test(apr30Day === 30, `Apr has 30 days (expected 30, got ${apr30Day})`);

      // Invalid dates should return MAX_DATE
      var apr31 = foam.util.DateUtil.parseDateString('2024-04-31');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(apr31.getTime() === maxDate.getTime(), 'Apr 31 returns MAX_DATE');

      var feb31 = foam.util.DateUtil.parseDateString('2024-02-31');
      x.test(feb31.getTime() === maxDate.getTime(), 'Feb 31 returns MAX_DATE');
    },

    async function testParseDateString_YearBoundaries(x) {
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

    async function testParseDateString_FormatAmbiguity(x) {
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

    async function testParseDateString_TwoDigitYearBoundary(x) {
      // Test 2-digit year using sliding window (50 years back, 50 years forward)
      var currentYear = new Date().getUTCFullYear();
      var currentCentury = Math.floor(currentYear / 100) * 100;

      // Helper function to calculate expected year
      var calculateExpectedYear = function(twoDigitYear) {
        var expectedYear = currentCentury + twoDigitYear;
        if ( expectedYear > currentYear + 50 ) {
          expectedYear = currentCentury - 100 + twoDigitYear;
        }
        return expectedYear;
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

    async function testParseDateString_InvalidFormats(x) {
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
        'abc123',          // random text
        '12345678901'      // too many digits
      ];

      unsupportedFormats.forEach(function(format) {
        var date = foam.util.DateUtil.parseDateString(format);
        x.test(date.getTime() === maxDate.getTime(), `Unsupported format "${format}" returns MAX_DATE`);
      });

      // Test formats that match a pattern but have invalid date values
      var invalidDates = [
        '15-03-2024',      // DD-MM-YYYY looks like MM-DD-YYYY with month=15 (invalid)
        '13-32-2024',      // month=13, day=32 (both invalid)
        '00-01-2024',      // month=00 (invalid)
        '01-00-2024'       // day=00 (invalid)
      ];

      invalidDates.forEach(function(format) {
        var date = foam.util.DateUtil.parseDateString(format);
        x.test(date.getTime() === maxDate.getTime(), `Invalid date "${format}" returns MAX_DATE`);
      });
    },

    async function testParseDateString_EmptyAndWhitespace(x) {
      var maxDate = foam.util.DateUtil.MAX_DATE;

      var emptyDate = foam.util.DateUtil.parseDateString('');
      x.test(emptyDate.getTime() === maxDate.getTime(), 'Empty string returns MAX_DATE');

      var wsDate = foam.util.DateUtil.parseDateString('   ');
      x.test(wsDate.getTime() === maxDate.getTime(), 'Whitespace returns MAX_DATE');
    },

    async function testAdapt_EmptyString(x) {
      var date = foam.util.DateUtil.parseDateString('');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'parseDateString(empty string) returns MAX_DATE');
    },

    async function testAdapt_WhitespaceString(x) {
      var date = foam.util.DateUtil.parseDateString('   ');
      var maxDate = foam.util.DateUtil.MAX_DATE;
      x.test(date.getTime() === maxDate.getTime(), 'parseDateString(whitespace) returns MAX_DATE');
    },

    async function testAdapt_AllFormats(x) {
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
        var year = date.getFullYear();
        var month = date.getMonth();
        var day = date.getDate();
        var hours = date.getHours();
        x.test(year === 2024, `parseDateString("${format}") - year is 2024 (expected 2024, got ${year})`);
        x.test(month === 2, `parseDateString("${format}") - month is March (2) (expected 2, got ${month})`);
        x.test(day === 15, `parseDateString("${format}") - day is 15 (expected 15, got ${day})`);
        x.test(hours === 12, `parseDateString("${format}") - normalized to noon local (expected 12, got ${hours})`);
      });
    },

    async function testFORMATS_ORDER(x) {
      var formats = foam.util.DateUtil.FORMATS_ORDER;
      x.test(Array.isArray(formats), 'FORMATS_ORDER is an array');
      var length = formats.length;
      x.test(length === 6, `FORMATS_ORDER has 6 format patterns (expected 6, got ${length})`);

      // Verify each format has regex and groups
      formats.forEach(function(format, index) {
        x.test(format.regex instanceof RegExp, `Format ${index} has regex property`);
        x.test(Array.isArray(format.groups), `Format ${index} has groups array`);
      });

      // Test that all formats have year, month, day groups (or year2 for 2-digit years)
      formats.forEach(function(format, index) {
        var hasYear = format.groups.includes('year') || format.groups.includes('year2');
        x.test(hasYear, `Format ${index} has year or year2 group`);
        x.test(format.groups.includes('month'), `Format ${index} has month group`);
        x.test(format.groups.includes('day'), `Format ${index} has day group`);
      });
    },

    async function testParseDateTime_ISO8601_Full(x) {
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

    async function testParseDateTime_ISO8601_Short(x) {
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

    async function testParseDateTime_US_Format(x) {
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

    async function testParseDateTime_Compact(x) {
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

    async function testParseDateTime_WithMilliseconds(x) {
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

    async function testParseDateTime_InvalidFormats(x) {
      var maxDate = foam.util.DateUtil.MAX_DATE;

      // Test invalid datetime formats - should return MAX_DATE
      var invalidDate = foam.util.DateUtil.parseDateTime('2024-02-30 15:30:45');
      x.test(invalidDate.getTime() === maxDate.getTime(), 'Invalid datetime (Feb 30) returns MAX_DATE');

      var invalidHour = foam.util.DateUtil.parseDateTime('2024-03-15 25:30:45');
      x.test(invalidHour.getTime() === maxDate.getTime(), 'Invalid hour (25) returns MAX_DATE');

      var invalidMinute = foam.util.DateUtil.parseDateTime('2024-03-15 15:60:45');
      x.test(invalidMinute.getTime() === maxDate.getTime(), 'Invalid minute (60) returns MAX_DATE');

      var unsupportedFormat = foam.util.DateUtil.parseDateTime('March 15, 2024 3:30 PM');
      x.test(unsupportedFormat.getTime() === maxDate.getTime(), 'Unsupported format returns MAX_DATE');
    },

    async function testParseDateTime_PreservesTime(x) {
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

    async function testParseDateTimeUTC(x) {
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

    async function testParseDateTime_LocalTime(x) {
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

    async function testParseDateTime_BackwardCompatibility(x) {
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

    async function testDATETIME_FORMATS_ORDER(x) {
      var formats = foam.util.DateUtil.DATETIME_FORMATS_ORDER;
      x.test(Array.isArray(formats), 'DATETIME_FORMATS_ORDER is an array');
      var length = formats.length;
      x.test(length === 5, `DATETIME_FORMATS_ORDER has 5 format patterns (expected 5, got ${length})`);

      // Verify each format has regex and groups
      formats.forEach(function(format, index) {
        x.test(format.regex instanceof RegExp, `DateTime format ${index} has regex property`);
        x.test(Array.isArray(format.groups), `DateTime format ${index} has groups array`);
      });

      // Test that all formats have year, month, day, and time components
      formats.forEach(function(format, index) {
        var hasYear = format.groups.includes('year') || format.groups.includes('year2');
        x.test(hasYear, `DateTime format ${index} has year or year2 group`);
        x.test(format.groups.includes('month'), `DateTime format ${index} has month group`);
        x.test(format.groups.includes('day'), `DateTime format ${index} has day group`);
        x.test(format.groups.includes('hour'), `DateTime format ${index} has hour group`);
        x.test(format.groups.includes('minute'), `DateTime format ${index} has minute group`);
      });
    },

    async function testAdaptDateTime_DateOnlyString(x) {
      // Test date-only strings default to noon local (parseDateString behavior)
      var dt = foam.util.DateUtil.parseDateString('2024-03-15');
      var year = dt.getFullYear();
      var month = dt.getMonth();
      var day = dt.getDate();
      var hours = dt.getHours();
      var minutes = dt.getMinutes();
      var seconds = dt.getSeconds();
      x.test(year === 2024, `parseDateString(date string) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateString(date string) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateString(date string) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `parseDateString(date string) - hour is 12 (noon local default) (expected 12, got ${hours})`);
      x.test(minutes === 0, `parseDateString(date string) - minute is 0 (expected 0, got ${minutes})`);
      x.test(seconds === 0, `parseDateString(date string) - second is 0 (expected 0, got ${seconds})`);
    },

    async function testAdaptDateTime_DateTimeString(x) {
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

    async function testAdaptDateTime_Number(x) {
      // Test timestamp parsing
      var timestamp = 1710511845000; // 2024-03-15 14:10:45 GMT
      var dt = foam.util.DateUtil.parseDateTime(timestamp);
      var time = dt.getTime();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(time === timestamp, `parseDateTime(number) - timestamp preserved (expected ${timestamp}, got ${time})`);
      x.test(hours === 14, `parseDateTime(number) - hour preserved (14:10 UTC) (expected 14, got ${hours})`);
      x.test(minutes === 10, `parseDateTime(number) - minutes preserved (expected 10, got ${minutes})`);
      x.test(seconds === 45, `parseDateTime(number) - seconds preserved (expected 45, got ${seconds})`);
    },

    async function testAdaptDateTime_Date(x) {
      // Test Date object parsing - should preserve time
      var inputDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var originalTimestamp = inputDate.getTime();
      var dt = foam.util.DateUtil.parseDateTime(inputDate);
      var time = dt.getTime();
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(time === originalTimestamp, `parseDateTime(Date) - timestamp preserved (expected ${originalTimestamp}, got ${time})`);
      x.test(year === 2024, `parseDateTime(Date) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `parseDateTime(Date) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `parseDateTime(Date) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 15, `parseDateTime(Date) - hour preserved as 15 (expected 15, got ${hours})`);
      x.test(minutes === 30, `parseDateTime(Date) - minute preserved as 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `parseDateTime(Date) - second preserved as 45 (expected 45, got ${seconds})`);
    },

    async function testAdaptDateTime_Null(x) {
      // Test null/undefined handling
      var dt1 = foam.util.DateUtil.parseDateTime(null);
      x.test(dt1 === null, 'parseDateTime(null) returns null');

      var dt2 = foam.util.DateUtil.parseDateTime(undefined);
      x.test(dt2 === undefined, 'parseDateTime(undefined) returns undefined');
    },

    async function testFormat_DateOnly(x) {
      // Test formatting date only (no time)
      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var formatted = foam.util.DateUtil.format(date);

      x.test(formatted.length > 0, 'format(date) returns non-empty string');
      x.test(formatted.indexOf('2024') > -1, 'format(date) contains year');
      x.test(formatted.indexOf('15') > -1, 'format(date) contains day');
    },

    async function testFormat_TimeFirst(x) {
      // Test formatting with time first
      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var formatted = foam.util.DateUtil.format(date, true);

      x.test(formatted.length > 0, 'format(date, true) returns non-empty string');
      // Time should appear first
      var timePattern = /^\d{2}:\d{2}:\d{2}/;
      x.test(timePattern.test(formatted), 'format(date, true) starts with time (HH:MM:SS)');
    },

    async function testFormat_TimeLast(x) {
      // Test formatting with time last
      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var formatted = foam.util.DateUtil.format(date, false);

      x.test(formatted.length > 0, 'format(date, false) returns non-empty string');
      // Time should appear last
      var timePattern = /\d{2}:\d{2}:\d{2}$/;
      x.test(timePattern.test(formatted), 'format(date, false) ends with time (HH:MM:SS)');
    },

    async function testFormat_UTC(x) {
      // Test formatting in UTC timezone
      var date = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var formattedUTC = foam.util.DateUtil.format(date, null, 'UTC');

      x.test(formattedUTC.length > 0, 'format(date, null, UTC) returns non-empty string');
      x.test(formattedUTC.indexOf('2024') > -1, 'UTC format contains year');

      // Test with time in UTC
      var formattedWithTime = foam.util.DateUtil.format(date, false, 'UTC');
      x.test(formattedWithTime.indexOf('15:30:45') > -1, 'UTC format with time contains correct time');
    },

    async function testFormat_NullUndefined(x) {
      // Test null/undefined handling
      var formatted1 = foam.util.DateUtil.format(null);
      x.test(formatted1 === '', 'format(null) returns empty string');

      var formatted2 = foam.util.DateUtil.format(undefined);
      x.test(formatted2 === '', 'format(undefined) returns empty string');

      // Test with number (timestamp)
      var timestamp = 1710511845000;
      var formatted3 = foam.util.DateUtil.format(timestamp);
      x.test(formatted3.length > 0, 'format(timestamp) returns non-empty string');
    },

    async function testParseDateTimeUTC_DateTimeString(x) {
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

    async function testParseDateTimeUTC_DateOnlyString(x) {
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

    async function testParseDateTimeUTC_USFormatString(x) {
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

    async function testParseDateTime_NumbersAndDates(x) {
      // Test that parseDateTime and parseDateTimeUTC handle numbers and Date objects the same way
      var timestamp = 1710511845000; // 2024-03-15 14:10:45 GMT
      var inputDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));

      // Test with timestamp - should be preserved regardless of method
      var dtFromNumUTC = foam.util.DateUtil.parseDateTimeUTC(timestamp);
      var dtFromNumLocal = foam.util.DateUtil.parseDateTime(timestamp);
      var timeFromNumUTC = dtFromNumUTC.getTime();
      var timeFromNumLocal = dtFromNumLocal.getTime();

      x.test(timeFromNumUTC === timestamp, `parseDateTimeUTC preserves timestamp (expected ${timestamp}, got ${timeFromNumUTC})`);
      x.test(timeFromNumLocal === timestamp, `parseDateTime preserves timestamp (expected ${timestamp}, got ${timeFromNumLocal})`);
      x.test(timeFromNumUTC === timeFromNumLocal, `Both methods give same timestamp (expected ${timeFromNumUTC}, got ${timeFromNumLocal})`);

      // Test with Date object - should be preserved regardless of method
      var originalTimestamp = inputDate.getTime();
      var dtFromDateUTC = foam.util.DateUtil.parseDateTimeUTC(inputDate);
      var dtFromDateLocal = foam.util.DateUtil.parseDateTime(inputDate);
      var timeFromDateUTC = dtFromDateUTC.getTime();
      var timeFromDateLocal = dtFromDateLocal.getTime();

      x.test(timeFromDateUTC === originalTimestamp, `parseDateTimeUTC preserves Date timestamp (expected ${originalTimestamp}, got ${timeFromDateUTC})`);
      x.test(timeFromDateLocal === originalTimestamp, `parseDateTime preserves Date timestamp (expected ${originalTimestamp}, got ${timeFromDateLocal})`);
      x.test(timeFromDateUTC === timeFromDateLocal, `Both methods give same Date timestamp (expected ${timeFromDateUTC}, got ${timeFromDateLocal})`);
    },

    async function testParseDateTime_AllInputTypes(x) {
      // Test that parseDateTime handles all input types correctly
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

      // Test with number
      var dt4 = foam.util.DateUtil.parseDateTime(timestamp);
      var time4 = dt4.getTime();
      x.test(time4 === timestamp, `Number - timestamp preserved (expected ${timestamp}, got ${time4})`);

      // Test with Date object
      var originalTimestamp = inputDate.getTime();
      var dt5 = foam.util.DateUtil.parseDateTime(inputDate);
      var time5 = dt5.getTime();
      x.test(time5 === originalTimestamp, `Date object - timestamp preserved (expected ${originalTimestamp}, got ${time5})`);

      // Test null/undefined
      var dt6 = foam.util.DateUtil.parseDateTime(null);
      x.test(dt6 === null, 'Null returns null');

      var dt7 = foam.util.DateUtil.parseDateTime(undefined);
      x.test(dt7 === undefined, 'Undefined returns undefined');
    },

    async function testParseDateTimeUTC_WithTimezoneZ(x) {
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

    async function testParseDateTimeUTC_WithTimezoneOffset(x) {
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

    async function testParseDateTime_WithTimezone(x) {
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

    async function testTimezoneFormatVariations(x) {
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

    async function testTimezoneDateBoundaries(x) {
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
    }
  ]
});
