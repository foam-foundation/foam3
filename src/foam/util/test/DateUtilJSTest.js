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
      await this.testAdaptDateTime_UTC_Flag_DateTimeString(x);
      await this.testAdaptDateTime_UTC_Flag_DateOnlyString(x);
      await this.testAdaptDateTime_UTC_Flag_USFormatString(x);
      await this.testAdaptDateTime_UTC_Flag_NumbersAndDates(x);
      await this.testAdaptDateTime_BackwardCompatibility(x);
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
      // Test 2-digit year < 50 (assumes 2000s)
      var date1 = foam.util.DateUtil.parseDateString('240315');
      var year1 = date1.getFullYear();
      var month1 = date1.getMonth();
      var day1 = date1.getDate();
      x.test(year1 === 2024, `YYMMDD format (YY=24) - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `YYMMDD format (YY=24) - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `YYMMDD format (YY=24) - day is 15 (expected 15, got ${day1})`);

      // Test 2-digit year >= 50 (assumes 1900s)
      var date2 = foam.util.DateUtil.parseDateString('850315');
      var year2 = date2.getFullYear();
      var month2 = date2.getMonth();
      var day2 = date2.getDate();
      x.test(year2 === 1985, `YYMMDD format (YY=85) - year is 1985 (expected 1985, got ${year2})`);
      x.test(month2 === 2, `YYMMDD format (YY=85) - month is March (2) (expected 2, got ${month2})`);
      x.test(day2 === 15, `YYMMDD format (YY=85) - day is 15 (expected 15, got ${day2})`);
    },

    async function testParseDateString_YY_MM_DD(x) {
      // Test with slash separator
      var date1 = foam.util.DateUtil.parseDateString('24/03/15');
      var year1 = date1.getFullYear();
      x.test(year1 === 2024, `YY/MM/DD format - year is 2024 (expected 2024, got ${year1})`);

      // Test with dash separator
      var date2 = foam.util.DateUtil.parseDateString('85-03-15');
      var year2 = date2.getFullYear();
      x.test(year2 === 1985, `YY-MM-DD format - year is 1985 (expected 1985, got ${year2})`);
    },

    async function testParseDateString_InvalidDate(x) {
      try {
        // Test invalid date like February 30th
        foam.util.DateUtil.parseDateString('2024-02-30');
        x.test(false, 'Invalid date (Feb 30) should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Cannot parse invalid date'), 'Invalid date throws correct error message');
      }
    },

    async function testParseDateString_UnsupportedFormat(x) {
      try {
        foam.util.DateUtil.parseDateString('March 15, 2024');
        x.test(false, 'Unsupported format should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Unsupported Date format'), 'Unsupported format throws correct error message');
      }
    },

    async function testAdapt_Number(x) {
      var timestamp = 1710489600000; // March 15, 2024 12:00:00 GMT
      var date = foam.util.DateUtil.adapt(timestamp);

      var year = date.getUTCFullYear();
      var month = date.getUTCMonth();
      var day = date.getUTCDate();
      var hours = date.getUTCHours();
      var minutes = date.getUTCMinutes();
      var seconds = date.getUTCSeconds();
      x.test(year === 2024, `adapt(Number) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `adapt(Number) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `adapt(Number) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `adapt(Number) - hour is 12 (noon GMT) (expected 12, got ${hours})`);
      x.test(minutes === 0, `adapt(Number) - minute is 0 (expected 0, got ${minutes})`);
      x.test(seconds === 0, `adapt(Number) - second is 0 (expected 0, got ${seconds})`);
    },

    async function testAdapt_String(x) {
      var date = foam.util.DateUtil.adapt('2024-03-15');

      var year = date.getUTCFullYear();
      var month = date.getUTCMonth();
      var day = date.getUTCDate();
      var hours = date.getUTCHours();
      x.test(year === 2024, `adapt(String) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `adapt(String) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `adapt(String) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `adapt(String) - hour is 12 (noon GMT) (expected 12, got ${hours})`);
    },

    async function testAdapt_Date(x) {
      var inputDate = new Date(2024, 2, 15, 8, 30, 45); // March 15, 2024 08:30:45 local
      var adaptedDate = foam.util.DateUtil.adapt(inputDate);

      var year = adaptedDate.getUTCFullYear();
      var month = adaptedDate.getUTCMonth();
      var day = adaptedDate.getUTCDate();
      var hours = adaptedDate.getUTCHours();
      var minutes = adaptedDate.getUTCMinutes();
      var seconds = adaptedDate.getUTCSeconds();
      x.test(year === 2024, `adapt(Date) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `adapt(Date) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `adapt(Date) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `adapt(Date) - hour normalized to 12 (noon GMT) (expected 12, got ${hours})`);
      x.test(minutes === 0, `adapt(Date) - minute normalized to 0 (expected 0, got ${minutes})`);
      x.test(seconds === 0, `adapt(Date) - second normalized to 0 (expected 0, got ${seconds})`);
    },

    async function testAdapt_Null(x) {
      var date = foam.util.DateUtil.adapt(null);
      x.test(date === null, 'adapt(null) returns null');
    },

    async function testAdapt_InvalidString(x) {
      var date = foam.util.DateUtil.adapt('invalid date string');
      x.test(date === foam.util.DateUtil.MAX_DATE, 'adapt(invalid string) returns MAX_DATE');
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
      try {
        // Test invalid Feb 29 in non-leap year
        foam.util.DateUtil.parseDateString('2023-02-29');
        x.test(false, 'Non-leap year - Feb 29, 2023 should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Cannot parse invalid date'), 'Non-leap year Feb 29 throws error');
      }
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

      try {
        foam.util.DateUtil.parseDateString('2024-04-31');
        x.test(false, 'Apr 31 should throw exception');
      } catch ( e ) {
        x.test(true, 'Apr 31 is invalid');
      }

      try {
        foam.util.DateUtil.parseDateString('2024-02-31');
        x.test(false, 'Feb 31 should throw exception');
      } catch ( e ) {
        x.test(true, 'Feb 31 is invalid');
      }
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
      // Test 2-digit year < 50 becomes 2000s
      var date1 = foam.util.DateUtil.parseDateString('49-12-31');
      var year1 = date1.getFullYear();
      x.test(year1 === 2049, `2-digit year 49 becomes 2049 (expected 2049, got ${year1})`);

      var date2 = foam.util.DateUtil.parseDateString('00-01-01');
      var year2 = date2.getFullYear();
      x.test(year2 === 2000, `2-digit year 00 becomes 2000 (expected 2000, got ${year2})`);

      // Test 2-digit year >= 50 becomes 1900s
      var date3 = foam.util.DateUtil.parseDateString('50-01-01');
      var year3 = date3.getFullYear();
      x.test(year3 === 1950, `2-digit year 50 becomes 1950 (expected 1950, got ${year3})`);

      var date4 = foam.util.DateUtil.parseDateString('99-12-31');
      var year4 = date4.getFullYear();
      x.test(year4 === 1999, `2-digit year 99 becomes 1999 (expected 1999, got ${year4})`);
    },

    async function testParseDateString_InvalidFormats(x) {
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
        try {
          foam.util.DateUtil.parseDateString(format);
          x.test(false, `Unsupported format "${format}" should throw exception`);
        } catch ( e ) {
          x.test(e.message.includes('Unsupported Date format'), `Format "${format}" throws "Unsupported Date format"`);
        }
      });

      // Test formats that match a pattern but have invalid date values
      var invalidDates = [
        '15-03-2024',      // DD-MM-YYYY looks like MM-DD-YYYY with month=15 (invalid)
        '13-32-2024',      // month=13, day=32 (both invalid)
        '00-01-2024',      // month=00 (invalid)
        '01-00-2024'       // day=00 (invalid)
      ];

      invalidDates.forEach(function(format) {
        try {
          foam.util.DateUtil.parseDateString(format);
          x.test(false, `Invalid date "${format}" should throw exception`);
        } catch ( e ) {
          x.test(e.message.includes('Cannot parse invalid date'), `Date "${format}" throws "Cannot parse invalid date"`);
        }
      });
    },

    async function testParseDateString_EmptyAndWhitespace(x) {
      try {
        foam.util.DateUtil.parseDateString('');
        x.test(false, 'Empty string should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Unsupported Date format'), 'Empty string throws error');
      }

      try {
        foam.util.DateUtil.parseDateString('   ');
        x.test(false, 'Whitespace string should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Unsupported Date format'), 'Whitespace throws error');
      }
    },

    async function testAdapt_EmptyString(x) {
      var date = foam.util.DateUtil.adapt('');
      x.test(date === foam.util.DateUtil.MAX_DATE, 'adapt(empty string) returns MAX_DATE');
    },

    async function testAdapt_WhitespaceString(x) {
      var date = foam.util.DateUtil.adapt('   ');
      x.test(date === foam.util.DateUtil.MAX_DATE, 'adapt(whitespace) returns MAX_DATE');
    },

    async function testAdapt_AllFormats(x) {
      // Test adapt() works with all supported formats
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
        var date = foam.util.DateUtil.adapt(format);
        var year = date.getUTCFullYear();
        var month = date.getUTCMonth();
        var day = date.getUTCDate();
        var hours = date.getUTCHours();
        x.test(year === 2024, `adapt("${format}") - year is 2024 (expected 2024, got ${year})`);
        x.test(month === 2, `adapt("${format}") - month is March (2) (expected 2, got ${month})`);
        x.test(day === 15, `adapt("${format}") - day is 15 (expected 15, got ${day})`);
        x.test(hours === 12, `adapt("${format}") - normalized to noon GMT (expected 12, got ${hours})`);
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
      // Test ISO 8601 with T separator
      var dt1 = foam.util.DateUtil.parseDateTime('2024-03-15T15:30:45');
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
      var dt2 = foam.util.DateUtil.parseDateTime('2024-03-15 15:30:45');
      var year2 = dt2.getUTCFullYear();
      var hours2 = dt2.getUTCHours();
      var minutes2 = dt2.getUTCMinutes();
      x.test(year2 === 2024, `ISO 8601 space - year is 2024 (expected 2024, got ${year2})`);
      x.test(hours2 === 15, `ISO 8601 space - hour is 15 (expected 15, got ${hours2})`);
      x.test(minutes2 === 30, `ISO 8601 space - minute is 30 (expected 30, got ${minutes2})`);

      // Test with slash separator
      var dt3 = foam.util.DateUtil.parseDateTime('2024/03/15 15:30:45');
      var year3 = dt3.getUTCFullYear();
      var hours3 = dt3.getUTCHours();
      x.test(year3 === 2024, `ISO 8601 slash - year is 2024 (expected 2024, got ${year3})`);
      x.test(hours3 === 15, `ISO 8601 slash - hour is 15 (expected 15, got ${hours3})`);
    },

    async function testParseDateTime_ISO8601_Short(x) {
      // Test ISO 8601 short format (no seconds)
      var dt1 = foam.util.DateUtil.parseDateTime('2024-03-15T15:30');
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
      var dt2 = foam.util.DateUtil.parseDateTime('2024-03-15 15:30');
      var hours2 = dt2.getUTCHours();
      var minutes2 = dt2.getUTCMinutes();
      x.test(hours2 === 15, `ISO 8601 short space - hour is 15 (expected 15, got ${hours2})`);
      x.test(minutes2 === 30, `ISO 8601 short space - minute is 30 (expected 30, got ${minutes2})`);
    },

    async function testParseDateTime_US_Format(x) {
      // Test MM/DD/YYYY HH:MM:SS
      var dt1 = foam.util.DateUtil.parseDateTime('03/15/2024 15:30:45');
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
      var dt2 = foam.util.DateUtil.parseDateTime('03-15-2024 15:30:45');
      var year2 = dt2.getUTCFullYear();
      var hours2 = dt2.getUTCHours();
      x.test(year2 === 2024, `US format dash - year is 2024 (expected 2024, got ${year2})`);
      x.test(hours2 === 15, `US format dash - hour is 15 (expected 15, got ${hours2})`);

      // Test MM/DD/YYYY HH:MM (no seconds)
      var dt3 = foam.util.DateUtil.parseDateTime('03/15/2024 15:30');
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
      var dt = foam.util.DateUtil.parseDateTime('20240315153045');
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
      var dt = foam.util.DateUtil.parseDateTime('2024-03-15T15:30:45.123');
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
      // Test invalid datetime formats
      try {
        foam.util.DateUtil.parseDateTime('2024-02-30 15:30:45');
        x.test(false, 'Invalid datetime (Feb 30) should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Cannot parse invalid datetime'), 'Invalid datetime throws error');
      }

      try {
        foam.util.DateUtil.parseDateTime('2024-03-15 25:30:45');
        x.test(false, 'Invalid hour (25) should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Cannot parse invalid datetime'), 'Invalid hour throws error');
      }

      try {
        foam.util.DateUtil.parseDateTime('2024-03-15 15:60:45');
        x.test(false, 'Invalid minute (60) should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Cannot parse invalid datetime'), 'Invalid minute throws error');
      }

      try {
        foam.util.DateUtil.parseDateTime('March 15, 2024 3:30 PM');
        x.test(false, 'Unsupported format should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Unsupported DateTime format'), 'Unsupported format throws error');
      }
    },

    async function testParseDateTime_PreservesTime(x) {
      // Test that parseDateTime preserves exact time in UTC
      var dt1 = foam.util.DateUtil.parseDateTime('2024-03-15T08:30:15');
      var dt2 = foam.util.DateUtil.parseDateTime('2024-03-15T20:45:30');

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
      // Test date-only strings default to noon GMT (backward compatibility with Date.adapt)
      var dt = foam.util.DateUtil.adaptDateTime('2024-03-15');
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(year === 2024, `adaptDateTime(date string) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `adaptDateTime(date string) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `adaptDateTime(date string) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 12, `adaptDateTime(date string) - hour is 12 (noon GMT default) (expected 12, got ${hours})`);
      x.test(minutes === 0, `adaptDateTime(date string) - minute is 0 (expected 0, got ${minutes})`);
      x.test(seconds === 0, `adaptDateTime(date string) - second is 0 (expected 0, got ${seconds})`);
    },

    async function testAdaptDateTime_DateTimeString(x) {
      // Test datetime strings preserve time
      var dt = foam.util.DateUtil.adaptDateTime('2024-03-15T15:30:45');
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(year === 2024, `adaptDateTime(datetime string) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `adaptDateTime(datetime string) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `adaptDateTime(datetime string) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 15, `adaptDateTime(datetime string) - hour is 15 (expected 15, got ${hours})`);
      x.test(minutes === 30, `adaptDateTime(datetime string) - minute is 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `adaptDateTime(datetime string) - second is 45 (expected 45, got ${seconds})`);
    },

    async function testAdaptDateTime_Number(x) {
      // Test timestamp adaptation
      var timestamp = 1710511845000; // 2024-03-15 14:10:45 GMT
      var dt = foam.util.DateUtil.adaptDateTime(timestamp);
      var time = dt.getTime();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(time === timestamp, `adaptDateTime(number) - timestamp preserved (expected ${timestamp}, got ${time})`);
      x.test(hours === 14, `adaptDateTime(number) - hour preserved (14:10 UTC) (expected 14, got ${hours})`);
      x.test(minutes === 10, `adaptDateTime(number) - minutes preserved (expected 10, got ${minutes})`);
      x.test(seconds === 45, `adaptDateTime(number) - seconds preserved (expected 45, got ${seconds})`);
    },

    async function testAdaptDateTime_Date(x) {
      // Test Date object adaptation - should preserve time
      var inputDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));
      var originalTimestamp = inputDate.getTime();
      var dt = foam.util.DateUtil.adaptDateTime(inputDate);
      var time = dt.getTime();
      var year = dt.getUTCFullYear();
      var month = dt.getUTCMonth();
      var day = dt.getUTCDate();
      var hours = dt.getUTCHours();
      var minutes = dt.getUTCMinutes();
      var seconds = dt.getUTCSeconds();
      x.test(time === originalTimestamp, `adaptDateTime(Date) - timestamp preserved (expected ${originalTimestamp}, got ${time})`);
      x.test(year === 2024, `adaptDateTime(Date) - year is 2024 (expected 2024, got ${year})`);
      x.test(month === 2, `adaptDateTime(Date) - month is March (2) (expected 2, got ${month})`);
      x.test(day === 15, `adaptDateTime(Date) - day is 15 (expected 15, got ${day})`);
      x.test(hours === 15, `adaptDateTime(Date) - hour preserved as 15 (expected 15, got ${hours})`);
      x.test(minutes === 30, `adaptDateTime(Date) - minute preserved as 30 (expected 30, got ${minutes})`);
      x.test(seconds === 45, `adaptDateTime(Date) - second preserved as 45 (expected 45, got ${seconds})`);
    },

    async function testAdaptDateTime_Null(x) {
      // Test null/undefined handling
      var dt1 = foam.util.DateUtil.adaptDateTime(null);
      x.test(dt1 === null, 'adaptDateTime(null) returns null');

      var dt2 = foam.util.DateUtil.adaptDateTime(undefined);
      x.test(dt2 === undefined, 'adaptDateTime(undefined) returns undefined');
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

    async function testAdaptDateTime_UTC_Flag_DateTimeString(x) {
      // Test parsing ISO 8601 datetime strings with forceUTC flag
      var dtString = '2024-03-15T14:30:45';

      var dtUTC = foam.util.DateUtil.adaptDateTime(dtString, true);
      var dtDefault = foam.util.DateUtil.adaptDateTime(dtString, false);
      var dtNoFlag = foam.util.DateUtil.adaptDateTime(dtString);

      var timeUTC = dtUTC.getTime();
      var timeDefault = dtDefault.getTime();
      var timeNoFlag = dtNoFlag.getTime();

      // ISO format should always parse as UTC regardless of flag
      x.test(timeUTC === timeDefault, `ISO format should parse as UTC regardless of flag (expected ${timeUTC}, got ${timeDefault})`);
      x.test(timeDefault === timeNoFlag, `Default should match no flag (expected ${timeDefault}, got ${timeNoFlag})`);

      var hoursUTC = dtUTC.getUTCHours();
      var minutesUTC = dtUTC.getUTCMinutes();
      var secondsUTC = dtUTC.getUTCSeconds();
      x.test(hoursUTC === 14, `UTC hour should be 14 (expected 14, got ${hoursUTC})`);
      x.test(minutesUTC === 30, `UTC minute should be 30 (expected 30, got ${minutesUTC})`);
      x.test(secondsUTC === 45, `UTC second should be 45 (expected 45, got ${secondsUTC})`);
    },

    async function testAdaptDateTime_UTC_Flag_DateOnlyString(x) {
      // Test parsing date-only strings with forceUTC flag
      var dateString = '2024-03-15';

      var dtUTC = foam.util.DateUtil.adaptDateTime(dateString, true);
      var dtDefault = foam.util.DateUtil.adaptDateTime(dateString, false);

      // With forceUTC=true, should be midnight UTC
      var hoursUTC = dtUTC.getUTCHours();
      var minutesUTC = dtUTC.getUTCMinutes();
      var secondsUTC = dtUTC.getUTCSeconds();
      x.test(hoursUTC === 0, `forceUTC=true should give 0 UTC hours (expected 0, got ${hoursUTC})`);
      x.test(minutesUTC === 0, `forceUTC=true should give 0 UTC minutes (expected 0, got ${minutesUTC})`);
      x.test(secondsUTC === 0, `forceUTC=true should give 0 UTC seconds (expected 0, got ${secondsUTC})`);

      // With forceUTC=false, behavior depends on browser timezone
      // We can't make strict assertions about the local time, but we can verify
      // that both produce valid dates for the same day
      var yearUTC = dtUTC.getUTCFullYear();
      var monthUTC = dtUTC.getUTCMonth();
      var dayUTC = dtUTC.getUTCDate();
      var yearDefault = dtDefault.getUTCFullYear();
      var monthDefault = dtDefault.getUTCMonth();
      var dayDefault = dtDefault.getUTCDate();

      x.test(yearUTC === 2024, `forceUTC year is 2024 (expected 2024, got ${yearUTC})`);
      x.test(monthUTC === 2, `forceUTC month is March (2) (expected 2, got ${monthUTC})`);
      x.test(dayUTC === 15, `forceUTC day is 15 (expected 15, got ${dayUTC})`);
      x.test(yearDefault === 2024, `default year is 2024 (expected 2024, got ${yearDefault})`);
      x.test(monthDefault === 2, `default month is March (2) (expected 2, got ${monthDefault})`);
      x.test(dayDefault === 15, `default day is 15 (expected 15, got ${dayDefault})`);
    },

    async function testAdaptDateTime_UTC_Flag_USFormatString(x) {
      // Test parsing US format datetime strings with forceUTC flag
      var usString = '03/15/2024 14:30:45';

      var dtUTC = foam.util.DateUtil.adaptDateTime(usString, true);
      var dtDefault = foam.util.DateUtil.adaptDateTime(usString, false);

      // With forceUTC=true, should interpret as UTC
      var hoursUTC = dtUTC.getUTCHours();
      var minutesUTC = dtUTC.getUTCMinutes();
      var secondsUTC = dtUTC.getUTCSeconds();
      x.test(hoursUTC === 14, `forceUTC should interpret as 14:30:45 UTC (expected hour 14, got ${hoursUTC})`);
      x.test(minutesUTC === 30, `forceUTC should interpret as UTC (expected minute 30, got ${minutesUTC})`);
      x.test(secondsUTC === 45, `forceUTC should interpret as UTC (expected second 45, got ${secondsUTC})`);

      // Verify both parse the same date
      var yearUTC = dtUTC.getUTCFullYear();
      var monthUTC = dtUTC.getUTCMonth();
      var dayUTC = dtUTC.getUTCDate();
      var yearDefault = dtDefault.getUTCFullYear();
      var monthDefault = dtDefault.getUTCMonth();
      var dayDefault = dtDefault.getUTCDate();

      x.test(yearUTC === 2024, `forceUTC year is 2024 (expected 2024, got ${yearUTC})`);
      x.test(monthUTC === 2, `forceUTC month is March (2) (expected 2, got ${monthUTC})`);
      x.test(dayUTC === 15, `forceUTC day is 15 (expected 15, got ${dayUTC})`);
      x.test(yearDefault === 2024, `default year is 2024 (expected 2024, got ${yearDefault})`);
      x.test(monthDefault === 2, `default month is March (2) (expected 2, got ${monthDefault})`);
      x.test(dayDefault === 15, `default day is 15 (expected 15, got ${dayDefault})`);
    },

    async function testAdaptDateTime_UTC_Flag_NumbersAndDates(x) {
      // Test that forceUTC flag does NOT affect numbers (timestamps) or Date objects
      var timestamp = 1710511845000; // 2024-03-15 14:10:45 GMT
      var inputDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));

      // Test with timestamp
      var dtFromNumUTC = foam.util.DateUtil.adaptDateTime(timestamp, true);
      var dtFromNumDefault = foam.util.DateUtil.adaptDateTime(timestamp, false);
      var timeFromNumUTC = dtFromNumUTC.getTime();
      var timeFromNumDefault = dtFromNumDefault.getTime();

      x.test(timeFromNumUTC === timestamp, `forceUTC=true preserves timestamp (expected ${timestamp}, got ${timeFromNumUTC})`);
      x.test(timeFromNumDefault === timestamp, `forceUTC=false preserves timestamp (expected ${timestamp}, got ${timeFromNumDefault})`);
      x.test(timeFromNumUTC === timeFromNumDefault, `Both flags give same timestamp (expected ${timeFromNumUTC}, got ${timeFromNumDefault})`);

      // Test with Date object
      var originalTimestamp = inputDate.getTime();
      var dtFromDateUTC = foam.util.DateUtil.adaptDateTime(inputDate, true);
      var dtFromDateDefault = foam.util.DateUtil.adaptDateTime(inputDate, false);
      var timeFromDateUTC = dtFromDateUTC.getTime();
      var timeFromDateDefault = dtFromDateDefault.getTime();

      x.test(timeFromDateUTC === originalTimestamp, `forceUTC=true preserves Date timestamp (expected ${originalTimestamp}, got ${timeFromDateUTC})`);
      x.test(timeFromDateDefault === originalTimestamp, `forceUTC=false preserves Date timestamp (expected ${originalTimestamp}, got ${timeFromDateDefault})`);
      x.test(timeFromDateUTC === timeFromDateDefault, `Both flags give same Date timestamp (expected ${timeFromDateUTC}, got ${timeFromDateDefault})`);
    },

    async function testAdaptDateTime_BackwardCompatibility(x) {
      // Test that calling adaptDateTime without second parameter works (backward compatibility)
      var dateString = '2024-03-15';
      var dtString = '2024-03-15T14:30:45';
      var usString = '03/15/2024 14:30:45';
      var timestamp = 1710511845000;
      var inputDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45));

      // Test with date string (no second parameter = forceUTC=false default)
      var dt1 = foam.util.DateUtil.adaptDateTime(dateString);
      var year1 = dt1.getUTCFullYear();
      var month1 = dt1.getUTCMonth();
      var day1 = dt1.getUTCDate();
      x.test(year1 === 2024, `Date string without flag - year is 2024 (expected 2024, got ${year1})`);
      x.test(month1 === 2, `Date string without flag - month is March (2) (expected 2, got ${month1})`);
      x.test(day1 === 15, `Date string without flag - day is 15 (expected 15, got ${day1})`);

      // Test with datetime string
      var dt2 = foam.util.DateUtil.adaptDateTime(dtString);
      var hours2 = dt2.getUTCHours();
      var minutes2 = dt2.getUTCMinutes();
      var seconds2 = dt2.getUTCSeconds();
      x.test(hours2 === 14, `DateTime string without flag - hour is 14 (expected 14, got ${hours2})`);
      x.test(minutes2 === 30, `DateTime string without flag - minute is 30 (expected 30, got ${minutes2})`);
      x.test(seconds2 === 45, `DateTime string without flag - second is 45 (expected 45, got ${seconds2})`);

      // Test with US format string
      var dt3 = foam.util.DateUtil.adaptDateTime(usString);
      var year3 = dt3.getUTCFullYear();
      var month3 = dt3.getUTCMonth();
      var day3 = dt3.getUTCDate();
      x.test(year3 === 2024, `US format without flag - year is 2024 (expected 2024, got ${year3})`);
      x.test(month3 === 2, `US format without flag - month is March (2) (expected 2, got ${month3})`);
      x.test(day3 === 15, `US format without flag - day is 15 (expected 15, got ${day3})`);

      // Test with number
      var dt4 = foam.util.DateUtil.adaptDateTime(timestamp);
      var time4 = dt4.getTime();
      x.test(time4 === timestamp, `Number without flag - timestamp preserved (expected ${timestamp}, got ${time4})`);

      // Test with Date object
      var originalTimestamp = inputDate.getTime();
      var dt5 = foam.util.DateUtil.adaptDateTime(inputDate);
      var time5 = dt5.getTime();
      x.test(time5 === originalTimestamp, `Date object without flag - timestamp preserved (expected ${originalTimestamp}, got ${time5})`);

      // Test null/undefined
      var dt6 = foam.util.DateUtil.adaptDateTime(null);
      x.test(dt6 === null, 'Null without flag returns null');

      var dt7 = foam.util.DateUtil.adaptDateTime(undefined);
      x.test(dt7 === undefined, 'Undefined without flag returns undefined');
    }
  ]
});
