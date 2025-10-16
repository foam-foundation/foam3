/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'DateServiceJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'JavaScript tests for DateService service',

  imports: [
    'dateService'
  ],

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
    },

    async function testParseDateString_YYYYMMDD(x) {
      var date = await this.dateService.parseDateString(x, '20240315');
      x.test(date.getFullYear() === 2024, 'YYYYMMDD format - year is 2024');
      x.test(date.getMonth() === 2, 'YYYYMMDD format - month is March (2)');
      x.test(date.getDate() === 15, 'YYYYMMDD format - day is 15');
    },

    async function testParseDateString_YYYY_MM_DD(x) {
      // Test with slash separator
      var date1 = await this.dateService.parseDateString(x, '2024/03/15');
      x.test(date1.getFullYear() === 2024, 'YYYY/MM/DD format - year is 2024');
      x.test(date1.getMonth() === 2, 'YYYY/MM/DD format - month is March (2)');
      x.test(date1.getDate() === 15, 'YYYY/MM/DD format - day is 15');

      // Test with dash separator
      var date2 = await this.dateService.parseDateString(x, '2024-03-15');
      x.test(date2.getFullYear() === 2024, 'YYYY-MM-DD format - year is 2024');
      x.test(date2.getMonth() === 2, 'YYYY-MM-DD format - month is March (2)');
      x.test(date2.getDate() === 15, 'YYYY-MM-DD format - day is 15');
    },

    async function testParseDateString_MMDDYYYY(x) {
      var date = await this.dateService.parseDateString(x, '03152024');
      x.test(date.getFullYear() === 2024, 'MMDDYYYY format - year is 2024');
      x.test(date.getMonth() === 2, 'MMDDYYYY format - month is March (2)');
      x.test(date.getDate() === 15, 'MMDDYYYY format - day is 15');
    },

    async function testParseDateString_MM_DD_YYYY(x) {
      // Test with slash separator
      var date1 = await this.dateService.parseDateString(x, '03/15/2024');
      x.test(date1.getFullYear() === 2024, 'MM/DD/YYYY format - year is 2024');
      x.test(date1.getMonth() === 2, 'MM/DD/YYYY format - month is March (2)');
      x.test(date1.getDate() === 15, 'MM/DD/YYYY format - day is 15');

      // Test with dash separator
      var date2 = await this.dateService.parseDateString(x, '03-15-2024');
      x.test(date2.getFullYear() === 2024, 'MM-DD-YYYY format - year is 2024');
      x.test(date2.getMonth() === 2, 'MM-DD-YYYY format - month is March (2)');
      x.test(date2.getDate() === 15, 'MM-DD-YYYY format - day is 15');
    },

    async function testParseDateString_YYMMDD(x) {
      // Test 2-digit year < 50 (assumes 2000s)
      var date1 = await this.dateService.parseDateString(x, '240315');
      x.test(date1.getFullYear() === 2024, 'YYMMDD format (YY=24) - year is 2024');
      x.test(date1.getMonth() === 2, 'YYMMDD format (YY=24) - month is March (2)');
      x.test(date1.getDate() === 15, 'YYMMDD format (YY=24) - day is 15');

      // Test 2-digit year >= 50 (assumes 1900s)
      var date2 = await this.dateService.parseDateString(x, '850315');
      x.test(date2.getFullYear() === 1985, 'YYMMDD format (YY=85) - year is 1985');
      x.test(date2.getMonth() === 2, 'YYMMDD format (YY=85) - month is March (2)');
      x.test(date2.getDate() === 15, 'YYMMDD format (YY=85) - day is 15');
    },

    async function testParseDateString_YY_MM_DD(x) {
      // Test with slash separator
      var date1 = await this.dateService.parseDateString(x, '24/03/15');
      x.test(date1.getFullYear() === 2024, 'YY/MM/DD format - year is 2024');

      // Test with dash separator
      var date2 = await this.dateService.parseDateString(x, '85-03-15');
      x.test(date2.getFullYear() === 1985, 'YY-MM-DD format - year is 1985');
    },

    async function testParseDateString_InvalidDate(x) {
      try {
        // Test invalid date like February 30th
        await this.dateService.parseDateString(x, '2024-02-30');
        x.test(false, 'Invalid date (Feb 30) should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Cannot parse invalid date'), 'Invalid date throws correct error message');
      }
    },

    async function testParseDateString_UnsupportedFormat(x) {
      try {
        await this.dateService.parseDateString(x, 'March 15, 2024');
        x.test(false, 'Unsupported format should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Unsupported Date format'), 'Unsupported format throws correct error message');
      }
    },

    async function testAdapt_Number(x) {
      var timestamp = 1710489600000; // March 15, 2024 12:00:00 GMT
      var date = await this.dateService.adapt(x, timestamp);

      x.test(date.getUTCFullYear() === 2024, 'adapt(Number) - year is 2024');
      x.test(date.getUTCMonth() === 2, 'adapt(Number) - month is March (2)');
      x.test(date.getUTCDate() === 15, 'adapt(Number) - day is 15');
      x.test(date.getUTCHours() === 12, 'adapt(Number) - hour is 12 (noon GMT)');
      x.test(date.getUTCMinutes() === 0, 'adapt(Number) - minute is 0');
      x.test(date.getUTCSeconds() === 0, 'adapt(Number) - second is 0');
    },

    async function testAdapt_String(x) {
      var date = await this.dateService.adapt(x, '2024-03-15');

      x.test(date.getUTCFullYear() === 2024, 'adapt(String) - year is 2024');
      x.test(date.getUTCMonth() === 2, 'adapt(String) - month is March (2)');
      x.test(date.getUTCDate() === 15, 'adapt(String) - day is 15');
      x.test(date.getUTCHours() === 12, 'adapt(String) - hour is 12 (noon GMT)');
    },

    async function testAdapt_Date(x) {
      var inputDate = new Date(2024, 2, 15, 8, 30, 45); // March 15, 2024 08:30:45 local
      var adaptedDate = await this.dateService.adapt(x, inputDate);

      x.test(adaptedDate.getUTCFullYear() === 2024, 'adapt(Date) - year is 2024');
      x.test(adaptedDate.getUTCMonth() === 2, 'adapt(Date) - month is March (2)');
      x.test(adaptedDate.getUTCDate() === 15, 'adapt(Date) - day is 15');
      x.test(adaptedDate.getUTCHours() === 12, 'adapt(Date) - hour normalized to 12 (noon GMT)');
      x.test(adaptedDate.getUTCMinutes() === 0, 'adapt(Date) - minute normalized to 0');
      x.test(adaptedDate.getUTCSeconds() === 0, 'adapt(Date) - second normalized to 0');
    },

    async function testAdapt_Null(x) {
      var date = await this.dateService.adapt(x, null);
      x.test(date === null, 'adapt(null) returns null');
    },

    async function testAdapt_InvalidString(x) {
      var date = await this.dateService.adapt(x, 'invalid date string');
      x.test(date === await this.dateService.getMaxDate(x), 'adapt(invalid string) returns MAX_DATE');
    },

    async function testParseDateString_LeapYear(x) {
      // Test valid leap year date
      var date1 = await this.dateService.parseDateString(x, '2024-02-29');
      x.test(date1.getFullYear() === 2024, 'Leap year - Feb 29, 2024 is valid');
      x.test(date1.getMonth() === 1, 'Leap year - month is February (1)');
      x.test(date1.getDate() === 29, 'Leap year - day is 29');
    },

    async function testParseDateString_NonLeapYear(x) {
      try {
        // Test invalid Feb 29 in non-leap year
        await this.dateService.parseDateString(x, '2023-02-29');
        x.test(false, 'Non-leap year - Feb 29, 2023 should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Cannot parse invalid date'), 'Non-leap year Feb 29 throws error');
      }
    },

    async function testParseDateString_TrailingText(x) {
      // Test dates with trailing text (regex allows .* at end)
      var date1 = await this.dateService.parseDateString(x, '2024-03-15 extra text here');
      x.test(date1.getFullYear() === 2024, 'Trailing text - year is 2024');
      x.test(date1.getMonth() === 2, 'Trailing text - month is March (2)');
      x.test(date1.getDate() === 15, 'Trailing text - day is 15');

      var date2 = await this.dateService.parseDateString(x, '20240315T12:00:00');
      x.test(date2.getFullYear() === 2024, 'Trailing ISO time - year is 2024');
      x.test(date2.getMonth() === 2, 'Trailing ISO time - month is March (2)');
      x.test(date2.getDate() === 15, 'Trailing ISO time - day is 15');
    },

    async function testParseDateString_MonthBoundaries(x) {
      // Test last day of various months
      var jan31 = await this.dateService.parseDateString(x, '2024-01-31');
      x.test(jan31.getDate() === 31, 'Jan has 31 days');

      var apr30 = await this.dateService.parseDateString(x, '2024-04-30');
      x.test(apr30.getDate() === 30, 'Apr has 30 days');

      try {
        await this.dateService.parseDateString(x, '2024-04-31');
        x.test(false, 'Apr 31 should throw exception');
      } catch ( e ) {
        x.test(true, 'Apr 31 is invalid');
      }

      try {
        await this.dateService.parseDateString(x, '2024-02-31');
        x.test(false, 'Feb 31 should throw exception');
      } catch ( e ) {
        x.test(true, 'Feb 31 is invalid');
      }
    },

    async function testParseDateString_YearBoundaries(x) {
      // Test minimum 4-digit year (1000)
      var date1 = await this.dateService.parseDateString(x, '1000-01-01');
      x.test(date1.getFullYear() === 1000, 'Year 1000 is valid');

      // Test maximum reasonable 4-digit year
      var date2 = await this.dateService.parseDateString(x, '9999-12-31');
      x.test(date2.getFullYear() === 9999, 'Year 9999 is valid');

      // Test year starting with 0 doesn't match YYYYMMDD pattern
      // '01012024' should match MMDDYYYY not YYYYMMDD
      var date3 = await this.dateService.parseDateString(x, '01012024');
      x.test(date3.getFullYear() === 2024, 'Year starting with 0 - parsed as MMDDYYYY');
      x.test(date3.getMonth() === 0, 'Year starting with 0 - month is January (0)');
      x.test(date3.getDate() === 1, 'Year starting with 0 - day is 1');
    },

    async function testParseDateString_FormatAmbiguity(x) {
      // Test that format priority is correct for ambiguous 8-digit strings
      // '20240315' should be YYYYMMDD (year starts with 1-9)
      var date1 = await this.dateService.parseDateString(x, '20240315');
      x.test(date1.getFullYear() === 2024, 'Ambiguous 8-digit - 20240315 is YYYYMMDD');
      x.test(date1.getMonth() === 2, 'Ambiguous 8-digit - month is March (2)');
      x.test(date1.getDate() === 15, 'Ambiguous 8-digit - day is 15');

      // '03152024' should be MMDDYYYY (doesn't match YYYYMMDD pattern)
      var date2 = await this.dateService.parseDateString(x, '03152024');
      x.test(date2.getFullYear() === 2024, 'Ambiguous 8-digit - 03152024 is MMDDYYYY');
      x.test(date2.getMonth() === 2, 'Ambiguous 8-digit - month is March (2)');
      x.test(date2.getDate() === 15, 'Ambiguous 8-digit - day is 15');

      // '10012024' should be MMDDYYYY
      var date3 = await this.dateService.parseDateString(x, '10012024');
      x.test(date3.getFullYear() === 2024, 'Ambiguous 8-digit - 10012024 is MMDDYYYY');
      x.test(date3.getMonth() === 9, 'Ambiguous 8-digit - month is October (9)');
      x.test(date3.getDate() === 1, 'Ambiguous 8-digit - day is 1');

      // '01102024' should be MMDDYYYY
      var date4 = await this.dateService.parseDateString(x, '01102024');
      x.test(date4.getFullYear() === 2024, 'Ambiguous 8-digit - 01102024 is MMDDYYYY');
      x.test(date4.getMonth() === 0, 'Ambiguous 8-digit - month is January (0)');
      x.test(date4.getDate() === 10, 'Ambiguous 8-digit - day is 10');
    },

    async function testParseDateString_TwoDigitYearBoundary(x) {
      // Test 2-digit year < 50 becomes 2000s
      var date1 = await this.dateService.parseDateString(x, '49-12-31');
      x.test(date1.getFullYear() === 2049, '2-digit year 49 becomes 2049');

      var date2 = await this.dateService.parseDateString(x, '00-01-01');
      x.test(date2.getFullYear() === 2000, '2-digit year 00 becomes 2000');

      // Test 2-digit year >= 50 becomes 1900s
      var date3 = await this.dateService.parseDateString(x, '50-01-01');
      x.test(date3.getFullYear() === 1950, '2-digit year 50 becomes 1950');

      var date4 = await this.dateService.parseDateString(x, '99-12-31');
      x.test(date4.getFullYear() === 1999, '2-digit year 99 becomes 1999');
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

      for ( var i = 0; i < unsupportedFormats.length; i++ ) {
        var format = unsupportedFormats[i];
        try {
          await this.dateService.parseDateString(x, format);
          x.test(false, `Unsupported format "${format}" should throw exception`);
        } catch ( e ) {
          x.test(e.message.includes('Unsupported Date format'), `Format "${format}" throws "Unsupported Date format"`);
        }
      }

      // Test formats that match a pattern but have invalid date values
      var invalidDates = [
        '15-03-2024',      // DD-MM-YYYY looks like MM-DD-YYYY with month=15 (invalid)
        '13-32-2024',      // month=13, day=32 (both invalid)
        '00-01-2024',      // month=00 (invalid)
        '01-00-2024'       // day=00 (invalid)
      ];

      for ( var i = 0; i < invalidDates.length; i++ ) {
        var format = invalidDates[i];
        try {
          await this.dateService.parseDateString(x, format);
          x.test(false, `Invalid date "${format}" should throw exception`);
        } catch ( e ) {
          x.test(e.message.includes('Cannot parse invalid date'), `Date "${format}" throws "Cannot parse invalid date"`);
        }
      }
    },

    async function testParseDateString_EmptyAndWhitespace(x) {
      try {
        await this.dateService.parseDateString(x, '');
        x.test(false, 'Empty string should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Unsupported Date format'), 'Empty string throws error');
      }

      try {
        await this.dateService.parseDateString(x, '   ');
        x.test(false, 'Whitespace string should throw exception');
      } catch ( e ) {
        x.test(e.message.includes('Unsupported Date format'), 'Whitespace throws error');
      }
    },

    async function testAdapt_EmptyString(x) {
      var date = await this.dateService.adapt(x, '');
      x.test(date === await this.dateService.getMaxDate(x), 'adapt(empty string) returns MAX_DATE');
    },

    async function testAdapt_WhitespaceString(x) {
      var date = await this.dateService.adapt(x, '   ');
      x.test(date === await this.dateService.getMaxDate(x), 'adapt(whitespace) returns MAX_DATE');
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

      for ( var i = 0; i < formats.length; i++ ) {
        var format = formats[i];
        var date = await this.dateService.adapt(x, format);
        x.test(date.getUTCFullYear() === 2024, `adapt("${format}") - year is 2024`);
        x.test(date.getUTCMonth() === 2, `adapt("${format}") - month is March (2)`);
        x.test(date.getUTCDate() === 15, `adapt("${format}") - day is 15`);
        x.test(date.getUTCHours() === 12, `adapt("${format}") - normalized to noon GMT`);
      }
    },

    async function testFORMATS_ORDER(x) {
      var formats = this.dateService.FORMATS_ORDER;
      x.test(Array.isArray(formats), 'FORMATS_ORDER is an array');
      x.test(formats.length === 6, 'FORMATS_ORDER has 6 format patterns');

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
    }
  ]
});
