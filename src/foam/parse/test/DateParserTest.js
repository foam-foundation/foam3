/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'DateParserTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Comprehensive tests for DateParser covering all formats from DateUtil.js',

  requires: ['foam.parse.DateParser'],

  methods: [

    function runTest(x) {
      this.testYYYYMMDDFormats(x);
      this.testMMDDYYYYFormats(x);
      this.testMMDDYYFormats(x);
      this.testDDMMYYYYFormats(x);
      this.testYYYYDDMMFormats(x);
      this.testDDMMMYYYYFormats(x);
      this.testUnixDateToStringFormat(x);
      this.testDateTimeFormats(x);
      this.testFractionalSeconds(x);
      this.testParseDateString(x);
      this.testParseDateTime(x);
      this.testParseDateTimeUTC(x);
      this.testEdgeCases(x);
      this.testValidation(x);
      this.testTimezoneZ(x);
      this.testTimezonePositiveOffset(x);
      this.testTimezoneNegativeOffset(x);
      this.testTimezoneFormatVariations(x);
      this.testTimezoneDateBoundaries(x);
      this.testMMDDYYSepTimeFormat(x);
      this.testWithAndWithoutZ(x);
      this.testInvalidLeapYearDates(x);
      this.testAllParseMethodsExample(x);
      this.testTimestampStrings(x);
      this.testStrictValidationMode(x);
      this.testLenientValidationMode(x);
      this.testInvalidMonthNameValidation(x);
      this.testJulianDateFormats(x);
    },

    function testYYYYMMDDFormats(x) {
      let parser = this.DateParser.create();

      // YYYYMMDD formats (with separators)
      let yyyymmddSep = [
        { input: '2025-01-15', year: 2025, month: 0, day: 15 },
        { input: '2025/01/15', year: 2025, month: 0, day: 15 },
        { input: '2024-12-31', year: 2024, month: 11, day: 31 },
        { input: '2000-02-29', year: 2000, month: 1, day: 29 }, // Leap year
        { input: '1999-01-01', year: 1999, month: 0, day: 1 },
        // Single-digit month and day support
        { input: '2025-1-5', year: 2025, month: 0, day: 5 },
        { input: '2025/1/5', year: 2025, month: 0, day: 5 },
        { input: '2025-7-2', year: 2025, month: 6, day: 2 },
        { input: '2025/7/2', year: 2025, month: 6, day: 2 },
        { input: '2025-1-15', year: 2025, month: 0, day: 15 },
        { input: '2025-12-5', year: 2025, month: 11, day: 5 }
      ];

      // Test YYYYMMDD with separators
      yyyymmddSep.forEach((testCase, i) => {
        x.test(
          this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
          `YYYYMMDD-Sep Test${i + 1}: ${testCase.input}`
        );
      });

      // YYYYMMDD compact (8 digits)
      let yyyymmddCompact = [
        { input: '20250115', year: 2025, month: 0, day: 15 },
        { input: '20241231', year: 2024, month: 11, day: 31 },
        { input: '19990101', year: 1999, month: 0, day: 1 },
        { input: '20000229', year: 2000, month: 1, day: 29 }
      ];

      // Test YYYYMMDD compact
      yyyymmddCompact.forEach((testCase, i) => {
        x.test(
          this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
          `YYYYMMDD-Compact Test${i + 1}: ${testCase.input}`
        );
      });

      // Test YYYYMMDD compact with space-separated time
      let yyyymmddCompactTime = [
        { input: '20250115 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '20250115 09:15', year: 2025, month: 0, day: 15, hour: 9, minute: 15, second: 0 },
        { input: '20241231T23:59:59', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '19990101T00:00:00', year: 1999, month: 0, day: 1, hour: 0, minute: 0, second: 0 }
      ];

      yyyymmddCompactTime.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0);
        let testName = `YYYYMMDD-Compact-Time Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test YYYYMMDD compact with space-separated compact time (HHMMSS - no colons)
      let yyyymmddCompactTimeNoColons = [
        { input: '20251030 153000', year: 2025, month: 9, day: 30, hour: 15, minute: 30, second: 0 },
        { input: '20250115 143045', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '20241231 235959', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '19990101 000000', year: 1999, month: 0, day: 1, hour: 0, minute: 0, second: 0 },
        { input: '20000229 120000', year: 2000, month: 1, day: 29, hour: 12, minute: 0, second: 0 }
      ];

      yyyymmddCompactTimeNoColons.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0);
        let testName = `YYYYMMDD-Compact-Time-NoColons Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test YYYYMMDD compact with T separator and timezone - use parseDateTimeUTC for UTC results
      let yyyymmddCompactTimeUTC = [
        { input: '20250118T09:15:30+05:00', year: 2025, month: 0, day: 18, hour: 4, minute: 15, second: 30 },
        { input: '20250119T22:45:15-05:00', year: 2025, month: 0, day: 20, hour: 3, minute: 45, second: 15 },
        { input: '20250315T14:30:00Z', year: 2025, month: 2, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      yyyymmddCompactTimeUTC.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second);
        let testName = `YYYYMMDD-Compact-Time-TZ Test${i + 1}: ${testCase.input} (UTC)`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test YYYYMMDD with fractional seconds (milliseconds and microseconds)
      let yyyymmddFractional = [
        { input: '2025-03-27 10:34:14.467', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '2025-03-27T10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '2025-01-15 14:30:45.1', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 100 },
        { input: '2025-01-15T14:30:45.12', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 120 },
        { input: '2025-01-15 14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123 },
        { input: '2025/01/15T14:30:45.999999', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 999 },
        // Single-digit month and day with time
        { input: '2025-1-5 14:30:45.123', year: 2025, month: 0, day: 5, hour: 14, minute: 30, second: 45, millisecond: 123 },
        { input: '2025/7/2T10:15:30.500', year: 2025, month: 6, day: 2, hour: 10, minute: 15, second: 30, millisecond: 500 }
      ];

      yyyymmddFractional.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, testCase.millisecond);
        let testName = `YYYYMMDD-Fractional Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });
    },

    function testMMDDYYYYFormats(x) {
      let parser = this.DateParser.create();

      // MMDDYYYY formats (with separators)
      let mmddyyyySep = [
        { input: '01/15/2025', year: 2025, month: 0, day: 15 },
        { input: '1/5/2025', year: 2025, month: 0, day: 5 },
        { input: '12-12-2025', year: 2025, month: 11, day: 12 },
        { input: '2/28/2025', year: 2025, month: 1, day: 28 },
        { input: '01-15-2025', year: 2025, month: 0, day: 15 },
        { input: '12/31/2024', year: 2024, month: 11, day: 31 },
        { input: '02/29/2000', year: 2000, month: 1, day: 29 },
        // More single-digit month and day support
        { input: '7/2/2025', year: 2025, month: 6, day: 2 },
        { input: '7-2-2025', year: 2025, month: 6, day: 2 },
        { input: '1-5-2025', year: 2025, month: 0, day: 5 },
        { input: '9/9/2025', year: 2025, month: 8, day: 9 }
      ];

      // Test MMDDYYYY with separators
      mmddyyyySep.forEach((testCase, i) => {
        x.test(
          this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
          `MMDDYYYY-Sep Test${i + 1}: ${testCase.input}`
        );
      });

      // MMDDYYYY compact (8 digits)
      let mmddyyyyCompact = [
        { input: '01152025', year: 2025, month: 0, day: 15 },
        { input: '12312024', year: 2024, month: 11, day: 31 },
        { input: '02292000', year: 2000, month: 1, day: 29 }
      ];

      // Test MMDDYYYY compact
      mmddyyyyCompact.forEach((testCase, i) => {
        x.test(
          this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
          `MMDDYYYY-Compact Test${i + 1}: ${testCase.input}`
        );
      });

      // Test MMDDYYYY compact with space-separated time
      let mmddyyyyCompactTime = [
        { input: '01152025 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '01152025 09:15', year: 2025, month: 0, day: 15, hour: 9, minute: 15, second: 0 },
        { input: '12312024T23:59:59', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '02292000T00:00:00', year: 2000, month: 1, day: 29, hour: 0, minute: 0, second: 0 }
      ];

      mmddyyyyCompactTime.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0);
        let testName = `MMDDYYYY-Compact-Time Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test MMDDYYYY compact with space-separated compact time (HHMMSS - no colons)
      let mmddyyyyCompactTimeNoColons = [
        { input: '10302025 153000', year: 2025, month: 9, day: 30, hour: 15, minute: 30, second: 0 },
        { input: '01152025 143045', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '12312024 235959', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '01012000 000000', year: 2000, month: 0, day: 1, hour: 0, minute: 0, second: 0 },
        { input: '02292000 120000', year: 2000, month: 1, day: 29, hour: 12, minute: 0, second: 0 }
      ];

      mmddyyyyCompactTimeNoColons.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0);
        let testName = `MMDDYYYY-Compact-Time-NoColons Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test MMDDYYYY compact with T separator and timezone - use parseDateTimeUTC for UTC results
      let mmddyyyyCompactTimeUTC = [
        { input: '01182025T09:15:30+05:00', year: 2025, month: 0, day: 18, hour: 4, minute: 15, second: 30 },
        { input: '01192025T22:45:15-05:00', year: 2025, month: 0, day: 20, hour: 3, minute: 45, second: 15 },
        { input: '03152025T14:30:00Z', year: 2025, month: 2, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      mmddyyyyCompactTimeUTC.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second);
        let testName = `MMDDYYYY-Compact-Time-TZ Test${i + 1}: ${testCase.input} (UTC)`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test MMDDYYYY with fractional seconds (milliseconds and microseconds)
      let mmddyyyyFractional = [
        { input: '03-27-2025 10:34:14.467', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '03-27-2025T10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '01-15-2025 14:30:45.1', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 100 },
        { input: '1/15/2025 14:30:45.1', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 100 },
        { input: '1/5/2025 14:30:45.1', year: 2025, month: 0, day: 5, hour: 14, minute: 30, second: 45, millisecond: 100 },
        { input: '01/15/2025T14:30:45.12', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 120 },
        { input: '01-15-2025 14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123 },
        { input: '01/15/2025T14:30:45.999999', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 999 },
        // More single-digit month and day with time
        { input: '7/2/2025 10:15:30.500', year: 2025, month: 6, day: 2, hour: 10, minute: 15, second: 30, millisecond: 500 },
        { input: '7-2-2025T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123 }
      ];

      mmddyyyyFractional.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, testCase.millisecond);
        let testName = `MMDDYYYY-Fractional Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });
    },

    function testMMDDYYFormats(x) {
      let parser = this.DateParser.create();

      // MMDDYY formats (with separators)
      let mmddyySep = [
        { input: '01/15/25', year: 2025, month: 0, day: 15 },
        { input: '01-15-25', year: 2025, month: 0, day: 15 },
        { input: '02/29/00', year: 2000, month: 1, day: 29 },
        // Single-digit month and day support
        { input: '1/5/25', year: 2025, month: 0, day: 5 },
        { input: '7-2-25', year: 2025, month: 6, day: 2 },
        { input: '9/9/25', year: 2025, month: 8, day: 9 },
        { input: '1-15-25', year: 2025, month: 0, day: 15 },
        { input: '12/5/25', year: 2025, month: 11, day: 5 }
      ];

      // Test MMDDYY with separators
      mmddyySep.forEach((testCase, i) => {
        x.test(
          this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
          `MMDDYY-Sep Test${i + 1}: ${testCase.input}`
        );
      });

      // MMDDYY compact (6 digits)
      let mmddyyCompact = [
        { input: '011525', year: 2025, month: 0, day: 15 },
        { input: '022900', year: 2000, month: 1, day: 29 }
      ];

      // Test MMDDYY compact
      mmddyyCompact.forEach((testCase, i) => {
        x.test(
          this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
          `MMDDYY-Compact Test${i + 1}: ${testCase.input}`
        );
      });

      // Test MMDDYY with fractional seconds (milliseconds and microseconds)
      let mmddyyFractional = [
        { input: '03-27-25 10:34:14.467', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '03-27-25T10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '01-15-25 14:30:45.1', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 100 },
        { input: '01/15/25T14:30:45.12', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 120 },
        { input: '01-15-25 14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123 },
        // Single-digit month and day with time
        { input: '7/2/25 10:15:30.500', year: 2025, month: 6, day: 2, hour: 10, minute: 15, second: 30, millisecond: 500 },
        { input: '1-5-25T14:30:45.123', year: 2025, month: 0, day: 5, hour: 14, minute: 30, second: 45, millisecond: 123 }
      ];

      mmddyyFractional.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, testCase.millisecond);
        let testName = `MMDDYY-Fractional Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });
    },

    function testDDMMYYYYFormats(x) {
      let parser = this.DateParser.create();

      // Test DDMMYYYY with separators - requires opt_name='ddmmyyyy'
      let ddmmyyyySep = [
        { input: '15/01/2025', year: 2025, month: 0, day: 15 },
        { input: '15-01-2025', year: 2025, month: 0, day: 15 },
        { input: '31/12/2024', year: 2024, month: 11, day: 31 },
        { input: '29/02/2000', year: 2000, month: 1, day: 29 },
        // Single-digit day and month support
        { input: '5/1/2025', year: 2025, month: 0, day: 5 },
        { input: '2-7-2025', year: 2025, month: 6, day: 2 },
        { input: '9/9/2025', year: 2025, month: 8, day: 9 },
        { input: '15/1/2025', year: 2025, month: 0, day: 15 },
        { input: '5-12-2025', year: 2025, month: 11, day: 5 }
      ];

      ddmmyyyySep.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input, 'ddmmyyyy');
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `DDMMYYYY-Sep Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy')`);
        } catch (e) {
          x.test(false, `DDMMYYYY-Sep Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test DDMMYYYY compact - requires opt_name='ddmmyyyy'
      let ddmmyyyyCompact = [
        { input: '15012025', year: 2025, month: 0, day: 15 },
        { input: '31122024', year: 2024, month: 11, day: 31 },
        { input: '29022000', year: 2000, month: 1, day: 29 }
      ];

      ddmmyyyyCompact.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input, 'ddmmyyyy');
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `DDMMYYYY-Compact Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy')`);
        } catch (e) {
          x.test(false, `DDMMYYYY-Compact Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test DDMMYYYY compact with space-separated time - requires opt_name='ddmmyyyy'
      let ddmmyyyyCompactTime = [
        { input: '17012025 14:30:45', year: 2025, month: 0, day: 17, hour: 14, minute: 30, second: 45 },
        { input: '17012025 09:15', year: 2025, month: 0, day: 17, hour: 9, minute: 15, second: 0 },
        { input: '31122024T23:59:59', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '29022000T00:00:00', year: 2000, month: 1, day: 29, hour: 0, minute: 0, second: 0 }
      ];

      ddmmyyyyCompactTime.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0, 'ddmmyyyy');
        let testName = `DDMMYYYY-Compact-Time Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy')`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test DDMMYYYY compact with space-separated compact time (HHMMSS - no colons)
      let ddmmyyyyCompactTimeNoColons = [
        { input: '30102025 153000', year: 2025, month: 9, day: 30, hour: 15, minute: 30, second: 0 },
        { input: '15012025 143045', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '31122024 235959', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '01012000 000000', year: 2000, month: 0, day: 1, hour: 0, minute: 0, second: 0 },
        { input: '29022000 120000', year: 2000, month: 1, day: 29, hour: 12, minute: 0, second: 0 }
      ];

      ddmmyyyyCompactTimeNoColons.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0, 'ddmmyyyy');
        let testName = `DDMMYYYY-Compact-Time-NoColons Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy')`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test DDMMYYYY compact with T separator and timezone - use parseDateTimeUTC for UTC results
      let ddmmyyyyCompactTimeUTC = [
        { input: '18012025T09:15:30+05:00', year: 2025, month: 0, day: 18, hour: 4, minute: 15, second: 30 },
        { input: '19012025T22:45:15-05:00', year: 2025, month: 0, day: 20, hour: 3, minute: 45, second: 15 },
        { input: '15032025T14:30:00Z', year: 2025, month: 2, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      ddmmyyyyCompactTimeUTC.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 'ddmmyyyy');
        let testName = `DDMMYYYY-Compact-Time-TZ Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy', UTC)`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test DDMMYYYY with time - requires opt_name='ddmmyyyy'
      let ddmmyyyyTime = [
        { input: '15/01/2025 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '15-01-2025 09:15', year: 2025, month: 0, day: 15, hour: 9, minute: 15, second: 0 },
        { input: '31-12-1999T23:59:59', year: 1999, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '01/01/2000T00:00:00', year: 2000, month: 0, day: 1, hour: 0, minute: 0, second: 0 }
      ];

      ddmmyyyyTime.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0, 'ddmmyyyy');
        let testName = `DDMMYYYY-Time Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy')`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test DDMMYYYY with T separator and timezone - use parseDateTimeUTC for UTC results
      let ddmmyyyyTimeUTC = [
        { input: '18/01/2025T09:15:30+05:00', year: 2025, month: 0, day: 18, hour: 4, minute: 15, second: 30 },
        { input: '19-01-2025T22:45:15-05:00', year: 2025, month: 0, day: 20, hour: 3, minute: 45, second: 15 },
        { input: '15/03/2025T14:30:00Z', year: 2025, month: 2, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      ddmmyyyyTimeUTC.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 'ddmmyyyy');
        let testName = `DDMMYYYY-Time-TZ Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy', UTC)`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test DDMMYY (2-digit year) with separators - requires opt_name='ddmmyyyy'
      let ddmmyySep = [
        { input: '15/01/25', year: 2025, month: 0, day: 15 },
        { input: '31/12/24', year: 2024, month: 11, day: 31 },
        { input: '29/02/00', year: 2000, month: 1, day: 29 },
        // Single-digit day and month support
        { input: '5/1/25', year: 2025, month: 0, day: 5 },
        { input: '2-7-25', year: 2025, month: 6, day: 2 },
        { input: '9/9/25', year: 2025, month: 8, day: 9 }
      ];

      ddmmyySep.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input, 'ddmmyyyy');
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `DDMMYY-Sep Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy')`);
        } catch (e) {
          x.test(false, `DDMMYY-Sep Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test DDMMYY with time - requires opt_name='ddmmyyyy'
      let ddmmyyTime = [
        { input: '24/09/25 10:34:26', year: 2025, month: 8, day: 24, hour: 10, minute: 34, second: 26 },
        { input: '15-01-25 14:30', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      ddmmyyTime.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0, 'ddmmyyyy');
        let testName = `DDMMYY-Time Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy')`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test DDMMYYYY with fractional seconds (milliseconds and microseconds)
      let ddmmyyyyFractional = [
        { input: '27-03-2025 10:34:14.467', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'ddmmyyyy' },
        { input: '27-03-2025T10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'ddmmyyyy' },
        { input: '15-01-2025 14:30:45.1', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 100, opt_name: 'ddmmyyyy' },
        { input: '15/01/2025T14:30:45.12', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 120, opt_name: 'ddmmyyyy' },
        { input: '15-01-2025 14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'ddmmyyyy' },
        // Test DDMMYY format with fractional seconds too
        { input: '27-03-25 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'ddmmyyyy' },
        { input: '15-01-25T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'ddmmyyyy' },
        // Single-digit day and month with time
        { input: '5/1/2025 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500, opt_name: 'ddmmyyyy' },
        { input: '2-7-2025T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'ddmmyyyy' },
        // Single-digit DDMMYY with time
        { input: '5/1/25 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500, opt_name: 'ddmmyyyy' },
        { input: '2-7-25T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'ddmmyyyy' }
      ];

      ddmmyyyyFractional.forEach((testCase, i) => {
        let result = parser.parseDateTime(testCase.input, testCase.opt_name);
        let pass = result &&
                   result.getFullYear() === testCase.year &&
                   result.getMonth() === testCase.month &&
                   result.getDate() === testCase.day &&
                   result.getHours() === testCase.hour &&
                   result.getMinutes() === testCase.minute &&
                   result.getSeconds() === testCase.second &&
                   result.getMilliseconds() === testCase.millisecond;

        let testName = `DDMMYYYY-Fractional Test${i + 1}: ${testCase.input}`;
        if ( ! pass && result ) {
          testName += ` - Expected ms:${testCase.millisecond}, Got ms:${result.getMilliseconds()}`;
        }
        x.test(pass, testName);
      });
    },

    function testYYYYDDMMFormats(x) {
      let parser = this.DateParser.create();

      // Test YYYYDDMM with separators - requires opt_name='yyyyddmm'
      let yyyyddmmSep = [
        { input: '2025/15/01', year: 2025, month: 0, day: 15 },
        { input: '2025-15-01', year: 2025, month: 0, day: 15 },
        { input: '2024/31/12', year: 2024, month: 11, day: 31 },
        { input: '2000/29/02', year: 2000, month: 1, day: 29 },
        // Single-digit day and month support
        { input: '2025/5/1', year: 2025, month: 0, day: 5 },
        { input: '2025-2-7', year: 2025, month: 6, day: 2 },
        { input: '2025/9/9', year: 2025, month: 8, day: 9 },
        { input: '2025-15/1', year: 2025, month: 0, day: 15 },
        { input: '2025/5-12', year: 2025, month: 11, day: 5 }
      ];

      yyyyddmmSep.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input, 'yyyyddmm');
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `YYYYDDMM-Sep Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm')`);
        } catch (e) {
          x.test(false, `YYYYDDMM-Sep Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test YYYYDDMM compact - requires opt_name='yyyyddmm'
      let yyyyddmmCompact = [
        { input: '20251501', year: 2025, month: 0, day: 15 },
        { input: '20243112', year: 2024, month: 11, day: 31 },
        { input: '20002902', year: 2000, month: 1, day: 29 }
      ];

      yyyyddmmCompact.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input, 'yyyyddmm');
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `YYYYDDMM-Compact Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm')`);
        } catch (e) {
          x.test(false, `YYYYDDMM-Compact Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test YYYYDDMM compact with space-separated time - requires opt_name='yyyyddmm'
      let yyyyddmmCompactTime = [
        { input: '20251701 14:30:45', year: 2025, month: 0, day: 17, hour: 14, minute: 30, second: 45 },
        { input: '20251701 09:15', year: 2025, month: 0, day: 17, hour: 9, minute: 15, second: 0 },
        { input: '20243112T23:59:59', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '20000102T00:00:00', year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 }
      ];

      yyyyddmmCompactTime.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0, 'yyyyddmm');
        let testName = `YYYYDDMM-Compact-Time Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm')`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test YYYYDDMM compact with space-separated compact time (HHMMSS - no colons)
      let yyyyddmmCompactTimeNoColons = [
        { input: '20253010 153000', year: 2025, month: 9, day: 30, hour: 15, minute: 30, second: 0 },
        { input: '20251501 143045', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '20243112 235959', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '20000101 000000', year: 2000, month: 0, day: 1, hour: 0, minute: 0, second: 0 },
        { input: '20002902 120000', year: 2000, month: 1, day: 29, hour: 12, minute: 0, second: 0 }
      ];

      yyyyddmmCompactTimeNoColons.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0, 'yyyyddmm');
        let testName = `YYYYDDMM-Compact-Time-NoColons Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm')`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test YYYYDDMM compact with T separator and timezone - use parseDateTimeUTC for UTC results
      let yyyyddmmCompactTimeUTC = [
        { input: '20251803T09:15:30+05:00', year: 2025, month: 2, day: 18, hour: 4, minute: 15, second: 30 },
        { input: '20251903T22:45:15-05:00', year: 2025, month: 2, day: 20, hour: 3, minute: 45, second: 15 },
        { input: '20251503T14:30:00Z', year: 2025, month: 2, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      yyyyddmmCompactTimeUTC.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 'yyyyddmm');
        let testName = `YYYYDDMM-Compact-Time-TZ Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm', UTC)`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test YYYYDDMM with time - requires opt_name='yyyyddmm'
      let yyyyddmmTime = [
        { input: '2025/15/01 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '2025-15-01 09:15', year: 2025, month: 0, day: 15, hour: 9, minute: 15, second: 0 },
        { input: '2025/31/12T23:59:59', year: 2025, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '1999-31-12T23:59:59', year: 1999, month: 11, day: 31, hour: 23, minute: 59, second: 59 },
        { input: '2000-01-01T00:00:00', year: 2000, month: 0, day: 1, hour: 0, minute: 0, second: 0 }
      ];

      yyyyddmmTime.forEach((testCase, i) => {
        let result = this.testParseDTWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 0, 'yyyyddmm');
        let testName = `YYYYDDMM-Time Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm')`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test YYYYDDMM with T separator and timezone - use parseDateTimeUTC for UTC results
      let yyyyddmmTimeUTC = [
        { input: '2025/15/03T14:30:00Z', year: 2025, month: 2, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      yyyyddmmTimeUTC.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second, 'yyyyddmm');
        let testName = `YYYYDDMM-Time-TZ Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm', UTC)`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test YYDDMM (2-digit year) with separators - requires opt_name='yyyyddmm'
      let yyddmmSep = [
        { input: '25/15/01', year: 2025, month: 0, day: 15 },
        { input: '24-31-12', year: 2024, month: 11, day: 31 },
        { input: '00/29/02', year: 2000, month: 1, day: 29 },
        { input: '99/15/01', year: 1999, month: 0, day: 15 },
        // Single-digit day and month support
        { input: '25/5/1', year: 2025, month: 0, day: 5 },
        { input: '25-2-7', year: 2025, month: 6, day: 2 },
        { input: '25/9/9', year: 2025, month: 8, day: 9 }
      ];

      yyddmmSep.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input, 'yyyyddmm');
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `YYDDMM-Sep Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm')`);
        } catch (e) {
          x.test(false, `YYDDMM-Sep Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test YYDDMM compact (6 digits) - requires opt_name='yyyyddmm'
      let yyddmmCompact = [
        { input: '251501', year: 2025, month: 0, day: 15 },
        { input: '243112', year: 2024, month: 11, day: 31 },
        { input: '002902', year: 2000, month: 1, day: 29 },
        { input: '991501', year: 1999, month: 0, day: 15 }
      ];

      yyddmmCompact.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input, 'yyyyddmm');
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `YYDDMM-Compact Test${i + 1}: ${testCase.input} (opt_name='yyyyddmm')`);
        } catch (e) {
          x.test(false, `YYDDMM-Compact Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test YYYYDDMM with fractional seconds (milliseconds and microseconds)
      let yyyyddmmFractional = [
        { input: '2025-27-03 10:34:14.467', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'yyyyddmm' },
        { input: '2025-27-03T10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'yyyyddmm' },
        { input: '2025-15-01 14:30:45.1', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 100, opt_name: 'yyyyddmm' },
        { input: '2025/15/01T14:30:45.12', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 120, opt_name: 'yyyyddmm' },
        { input: '2025-15-01 14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'yyyyddmm' },
        // Test YYDDMM format with fractional seconds too
        { input: '25-27-03 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'yyddmm' },
        { input: '25-15-01T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'yyddmm' },
        // Single-digit day and month with time
        { input: '2025/5/1 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500, opt_name: 'yyyyddmm' },
        { input: '2025-2-7T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'yyyyddmm' },
        // Single-digit YYDDMM with time
        { input: '25/5/1 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500, opt_name: 'yyddmm' },
        { input: '25-2-7T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'yyddmm' }
      ];

      yyyyddmmFractional.forEach((testCase, i) => {
        let result = parser.parseDateTime(testCase.input, testCase.opt_name);
        let pass = result &&
                   result.getFullYear() === testCase.year &&
                   result.getMonth() === testCase.month &&
                   result.getDate() === testCase.day &&
                   result.getHours() === testCase.hour &&
                   result.getMinutes() === testCase.minute &&
                   result.getSeconds() === testCase.second &&
                   result.getMilliseconds() === testCase.millisecond;

        let testName = `YYYYDDMM-Fractional Test${i + 1}: ${testCase.input}`;
        if ( ! pass && result ) {
          testName += ` - Expected ms:${testCase.millisecond}, Got ms:${result.getMilliseconds()}`;
        }
        x.test(pass, testName);
      });
    },

    function testDDMMMYYYYFormats(x) {
      let parser = this.DateParser.create();

      // Test DDMMMYYYY with separators - now works in STANDARD format (no opt_name needed!)
      // Also works with ddmmyyyy format for backwards compatibility
      let ddmmmyyyySep = [
        { input: '31-JAN-2025', year: 2025, month: 0, day: 31 },
        { input: '03-FEB-2025', year: 2025, month: 1, day: 3 },
        { input: '15/MAR/2024', year: 2024, month: 2, day: 15 },
        { input: '25-DEC-2025', year: 2025, month: 11, day: 25 },
        { input: '01-JAN-2000', year: 2000, month: 0, day: 1 },
        { input: '29-FEB-2024', year: 2024, month: 1, day: 29 }, // Leap year
        { input: '15/jun/2025', year: 2025, month: 5, day: 15 }, // Lowercase
        { input: '10-Jul-2025', year: 2025, month: 6, day: 10 }, // Mixed case
        // Single-digit day support
        { input: '5-JAN-2025', year: 2025, month: 0, day: 5 },
        { input: '2/FEB/2025', year: 2025, month: 1, day: 2 },
        { input: '9-MAR-2025', year: 2025, month: 2, day: 9 }
      ];

      // Test with STANDARD format (no opt_name) - month names are unambiguous!
      ddmmmyyyySep.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);  // No opt_name!
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `DDMMMYYYY-Sep Test${i + 1}: ${testCase.input} (STANDARD format)`);
        } catch (e) {
          x.test(false, `DDMMMYYYY-Sep Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test DDMMMYYYY compact (no separators) - works in STANDARD (has letters, unambiguous!)
      let ddmmmyyyyCompact = [
        { input: '31JAN2025', year: 2025, month: 0, day: 31 },
        { input: '03FEB2025', year: 2025, month: 1, day: 3 },
        { input: '15MAR2024', year: 2024, month: 2, day: 15 },
        { input: '25DEC2025', year: 2025, month: 11, day: 25 },
        { input: '29FEB2024', year: 2024, month: 1, day: 29 }, // Leap year
        { input: '15jun2025', year: 2025, month: 5, day: 15 }, // Lowercase
        { input: '10Jul2025', year: 2025, month: 6, day: 10 }  // Mixed case
      ];

      // Test with STANDARD format (no opt_name) - letters make it unambiguous!
      ddmmmyyyyCompact.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);  // No opt_name!
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `DDMMMYYYY-Compact Test${i + 1}: ${testCase.input} (STANDARD format)`);
        } catch (e) {
          x.test(false, `DDMMMYYYY-Compact Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test all months
      let allMonths = [
        { input: '15-JAN-2025', month: 0 },
        { input: '15-FEB-2025', month: 1 },
        { input: '15-MAR-2025', month: 2 },
        { input: '15-APR-2025', month: 3 },
        { input: '15-MAY-2025', month: 4 },
        { input: '15-JUN-2025', month: 5 },
        { input: '15-JUL-2025', month: 6 },
        { input: '15-AUG-2025', month: 7 },
        { input: '15-SEP-2025', month: 8 },
        { input: '15-OCT-2025', month: 9 },
        { input: '15-NOV-2025', month: 10 },
        { input: '15-DEC-2025', month: 11 }
      ];

      // Test all months with STANDARD format
      allMonths.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);  // No opt_name!
          let pass = result &&
                     result.getUTCFullYear() === 2025 &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === 15;
          x.test(pass, `DDMMMYYYY All Months Test${i + 1}: ${testCase.input} should parse to month ${testCase.month} (STANDARD format)`);
        } catch (e) {
          x.test(false, `DDMMMYYYY All Months Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test YYYY-DD-MMM formats - all work in STANDARD (letters make it unambiguous!)
      let yyyyddmmmTests = [
        { input: '2025-31-JAN', year: 2025, month: 0, day: 31 },
        { input: '2024/15/MAR', year: 2024, month: 2, day: 15 },
        { input: '202531JAN', year: 2025, month: 0, day: 31 }, // Compact works too!
        // Single-digit day support
        { input: '2025-5-JAN', year: 2025, month: 0, day: 5 },
        { input: '2025/2/FEB', year: 2025, month: 1, day: 2 },
        { input: '2025-9-MAR', year: 2025, month: 2, day: 9 }
      ];

      yyyyddmmmTests.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);  // No opt_name!
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day;
          x.test(pass, `YYYYDDMMM Test${i + 1}: ${testCase.input} (STANDARD format)`);
        } catch (e) {
          x.test(false, `YYYYDDMMM Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test MMM dd yyyy format with spaces (e.g., "Jan 02 2025")
      let mmmddyyyySpace = [
        { input: 'JAN 31 2025', year: 2025, month: 0, day: 31 },
        { input: 'FEB 03 2025', year: 2025, month: 1, day: 3 },
        { input: 'MAR 15 2024', year: 2024, month: 2, day: 15 },
        { input: 'DEC 25 2025', year: 2025, month: 11, day: 25 },
        { input: 'JAN 01 2000', year: 2000, month: 0, day: 1 },
        { input: 'FEB 29 2024', year: 2024, month: 1, day: 29 }, // Leap year
        { input: 'jun 15 2025', year: 2025, month: 5, day: 15 }, // Lowercase
        { input: 'Jul 10 2025', year: 2025, month: 6, day: 10 }, // Mixed case
        // Single-digit day support
        { input: 'JAN 5 2025', year: 2025, month: 0, day: 5 },
        { input: 'FEB 2 2025', year: 2025, month: 1, day: 2 },
        { input: 'MAR 9 2025', year: 2025, month: 2, day: 9 }
      ];

      mmmddyyyySpace.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);  // No opt_name!
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `MMM dd yyyy Space Test${i + 1}: ${testCase.input} (STANDARD format)`);
        } catch (e) {
          x.test(false, `MMM dd yyyy Space Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test all months with MMM dd yyyy format
      let mmmDdYyyyAllMonths = [
        { input: 'JAN 15 2025', month: 0 },
        { input: 'FEB 15 2025', month: 1 },
        { input: 'MAR 15 2025', month: 2 },
        { input: 'APR 15 2025', month: 3 },
        { input: 'MAY 15 2025', month: 4 },
        { input: 'JUN 15 2025', month: 5 },
        { input: 'JUL 15 2025', month: 6 },
        { input: 'AUG 15 2025', month: 7 },
        { input: 'SEP 15 2025', month: 8 },
        { input: 'OCT 15 2025', month: 9 },
        { input: 'NOV 15 2025', month: 10 },
        { input: 'DEC 15 2025', month: 11 }
      ];

      mmmDdYyyyAllMonths.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);  // No opt_name!
          let pass = result &&
                     result.getUTCFullYear() === 2025 &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === 15;
          x.test(pass, `MMM dd yyyy All Months Test${i + 1}: ${testCase.input} should parse to month ${testCase.month} (STANDARD format)`);
        } catch (e) {
          x.test(false, `MMM dd yyyy All Months Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test DD MMM YYYY format with spaces (e.g., "15 JAN 2025")
      let ddmmmyyyySpace = [
        { input: '31 JAN 2025', year: 2025, month: 0, day: 31 },
        { input: '03 FEB 2025', year: 2025, month: 1, day: 3 },
        { input: '15 MAR 2024', year: 2024, month: 2, day: 15 },
        { input: '25 DEC 2025', year: 2025, month: 11, day: 25 },
        { input: '01 JAN 2000', year: 2000, month: 0, day: 1 },
        { input: '29 FEB 2024', year: 2024, month: 1, day: 29 }, // Leap year
        { input: '15 jun 2025', year: 2025, month: 5, day: 15 }, // Lowercase
        { input: '10 Jul 2025', year: 2025, month: 6, day: 10 }, // Mixed case
        // Single-digit day support
        { input: '5 JAN 2025', year: 2025, month: 0, day: 5 },
        { input: '2 FEB 2025', year: 2025, month: 1, day: 2 },
        { input: '9 MAR 2025', year: 2025, month: 2, day: 9 }
      ];

      ddmmmyyyySpace.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);  // No opt_name!
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `DD MMM YYYY Space Test${i + 1}: ${testCase.input} (STANDARD format)`);
        } catch (e) {
          x.test(false, `DD MMM YYYY Space Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test all months with DD MMM YYYY format
      let ddMmmYyyyAllMonths = [
        { input: '15 JAN 2025', month: 0 },
        { input: '15 FEB 2025', month: 1 },
        { input: '15 MAR 2025', month: 2 },
        { input: '15 APR 2025', month: 3 },
        { input: '15 MAY 2025', month: 4 },
        { input: '15 JUN 2025', month: 5 },
        { input: '15 JUL 2025', month: 6 },
        { input: '15 AUG 2025', month: 7 },
        { input: '15 SEP 2025', month: 8 },
        { input: '15 OCT 2025', month: 9 },
        { input: '15 NOV 2025', month: 10 },
        { input: '15 DEC 2025', month: 11 }
      ];

      ddMmmYyyyAllMonths.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);  // No opt_name!
          let pass = result &&
                     result.getUTCFullYear() === 2025 &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === 15;
          x.test(pass, `DD MMM YYYY All Months Test${i + 1}: ${testCase.input} should parse to month ${testCase.month} (STANDARD format)`);
        } catch (e) {
          x.test(false, `DD MMM YYYY All Months Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });
    },

    function testDateTimeFormats(x) {
      let parser = this.DateParser.create();

      // DateTime formats with time components
      let dateTime = [
        { input: '2025-01-15T14:30:45.123', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123 },
        { input: '2025-01-15T14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '2025-01-15T14:30', year: 2025, month: 0, day: 15, hour: 14, minute: 30 },
        { input: '2025-01-15 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '2025/01/15T14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '01/15/2025 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '01-15-2025 14:30', year: 2025, month: 0, day: 15, hour: 14, minute: 30 },
        { input: '20250115143045', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 }
      ];

      dateTime.forEach((testCase, i) => {
        x.test(
          this.testParseDT(
            parser, testCase.input,
            testCase.year, testCase.month, testCase.day,
            testCase.hour, testCase.minute, testCase.second, testCase.millisecond
          ),
          `DateTime Test${i + 1}: ${testCase.input}`
        );
      });
    },

    function testFractionalSeconds(x) {
      let parser = this.DateParser.create();

      // Test fractional seconds with 1-6 digits (milliseconds and microseconds)
      // All formats should normalize to milliseconds (first 3 digits)
      let fractionalTests = [
        // YYYY-MM-DD format with microseconds
        { input: '2025-03-27 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '2025-03-27T10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '2025-01-15T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123 },
        { input: '2025-01-15 14:30:45.1', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 100 },
        { input: '2025-01-15 14:30:45.12', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 120 },
        { input: '2025-01-15 14:30:45.999999', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 999 },
        // Single-digit YYYY-MM-DD with fractional seconds
        { input: '2025-1-5 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500 },
        { input: '2025/7/2T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123 },

        // MM-DD-YYYY format with fractional seconds
        { input: '03-27-2025 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '01-15-2025T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123 },
        // Single-digit MM-DD-YYYY with fractional seconds
        { input: '7/2/2025 10:15:30.500', year: 2025, month: 6, day: 2, hour: 10, minute: 15, second: 30, millisecond: 500 },
        { input: '1-5-2025T14:30:45.123', year: 2025, month: 0, day: 5, hour: 14, minute: 30, second: 45, millisecond: 123 },

        // MM-DD-YY format with fractional seconds
        { input: '03-27-25 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467 },
        { input: '01-15-25T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123 },
        // Single-digit MM-DD-YY with fractional seconds
        { input: '7/2/25 10:15:30.500', year: 2025, month: 6, day: 2, hour: 10, minute: 15, second: 30, millisecond: 500 },
        { input: '1-5-25T14:30:45.123', year: 2025, month: 0, day: 5, hour: 14, minute: 30, second: 45, millisecond: 123 },

        // DD-MM-YYYY format with fractional seconds
        { input: '27-03-2025 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'ddmmyyyy' },
        { input: '15-01-2025T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'ddmmyyyy' },
        // Single-digit DD-MM-YYYY with fractional seconds
        { input: '5/1/2025 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500, opt_name: 'ddmmyyyy' },
        { input: '2-7-2025T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'ddmmyyyy' },

        // DD-MM-YY format with fractional seconds
        { input: '27-03-25 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'ddmmyyyy' },
        { input: '15-01-25T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'ddmmyyyy' },
        // Single-digit DD-MM-YY with fractional seconds
        { input: '5/1/25 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500, opt_name: 'ddmmyyyy' },
        { input: '2-7-25T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'ddmmyyyy' },

        // YYYY-DD-MM format with fractional seconds
        { input: '2025-27-03 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'yyyyddmm' },
        { input: '2025-15-01T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'yyyyddmm' },
        // Single-digit YYYY-DD-MM with fractional seconds
        { input: '2025/5/1 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500, opt_name: 'yyyyddmm' },
        { input: '2025-2-7T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'yyyyddmm' },

        // YY-DD-MM format with fractional seconds
        { input: '25-27-03 10:34:14.467000', year: 2025, month: 2, day: 27, hour: 10, minute: 34, second: 14, millisecond: 467, opt_name: 'yyddmm' },
        { input: '25-15-01T14:30:45.123456', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'yyddmm' },
        // Single-digit YY-DD-MM with fractional seconds
        { input: '25/5/1 10:15:30.500', year: 2025, month: 0, day: 5, hour: 10, minute: 15, second: 30, millisecond: 500, opt_name: 'yyddmm' },
        { input: '25-2-7T14:30:45.123', year: 2025, month: 6, day: 2, hour: 14, minute: 30, second: 45, millisecond: 123, opt_name: 'yyddmm' }
      ];

      fractionalTests.forEach((testCase, i) => {
        try {
          let result = parser.parseDateTime(testCase.input, testCase.opt_name);
          let pass = result &&
                     result.getFullYear() === testCase.year &&
                     result.getMonth() === testCase.month &&
                     result.getDate() === testCase.day &&
                     result.getHours() === testCase.hour &&
                     result.getMinutes() === testCase.minute &&
                     result.getSeconds() === testCase.second &&
                     result.getMilliseconds() === testCase.millisecond;

          let testName = `Fractional Seconds Test${i + 1}: ${testCase.input}`;
          if ( ! pass ) {
            testName += ` - Expected ms:${testCase.millisecond}, Got ms:${result ? result.getMilliseconds() : 'N/A'}`;
          }
          x.test(pass, testName);
        } catch (e) {
          x.test(false, `Fractional Seconds Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });
    },

    function testParseDateString(x) {
      let parser = this.DateParser.create();

      // parseDateString should ignore time and return date at noon UTC time
      let testCases = [
        { input: '2025-01-15', year: 2025, month: 0, day: 15 },
        { input: '2025-01-15T14:30:45', year: 2025, month: 0, day: 15 }, // Should ignore time
        { input: '01/15/2025 14:30:45', year: 2025, month: 0, day: 15 }, // Should ignore time
        { input: '20250115143045', year: 2025, month: 0, day: 15 } // Should ignore time
      ];

      testCases.forEach((testCase, i) => {
        try {
          let result = parser.parseDateString(testCase.input);
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12 && // Should be noon UTC time
                     result.getUTCMinutes() === 0 &&
                     result.getUTCSeconds() === 0;
          x.test(pass, `parseDateString Test${i + 1}: ${testCase.input} (ignores time, returns noon UTC)`);
        } catch (e) {
          x.test(false, `parseDateString Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });
    },

    function testParseDateTime(x) {
      let parser = this.DateParser.create();

      // parseDateTime should use local time, defaults to noon if no time present
      let testCases = [
        { input: '2025-01-15T14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '2025-01-15', year: 2025, month: 0, day: 15, hour: 12, minute: 0, second: 0 }, // Defaults to noon
        { input: '01/15/2025 14:30', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      testCases.forEach((testCase, i) => {
        try {
          let result = parser.parseDateTime(testCase.input);
          let pass = result &&
                     result.getFullYear() === testCase.year &&
                     result.getMonth() === testCase.month &&
                     result.getDate() === testCase.day &&
                     result.getHours() === testCase.hour &&
                     result.getMinutes() === testCase.minute &&
                     result.getSeconds() === testCase.second;
          x.test(pass, `parseDateTime (local) Test${i + 1}: ${testCase.input}`);
        } catch (e) {
          x.test(false, `parseDateTime (local) Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });
    },

    function testParseDateTimeUTC(x) {
      let parser = this.DateParser.create();

      // parseDateTimeUTC should use UTC
      let testCases = [
        { input: '2025-01-15T14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '2025-01-15', year: 2025, month: 0, day: 15, hour: 0, minute: 0, second: 0 },
        { input: '01/15/2025 14:30', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 0 }
      ];

      testCases.forEach((testCase, i) => {
        try {
          let result = parser.parseDateTimeUTC(testCase.input);
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === testCase.hour &&
                     result.getUTCMinutes() === testCase.minute &&
                     result.getUTCSeconds() === testCase.second;
          x.test(pass, `parseDateTimeUTC Test${i + 1}: ${testCase.input}`);
        } catch (e) {
          x.test(false, `parseDateTimeUTC Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });
    },

    function testEdgeCases(x) {
      let parser = this.DateParser.create();

      // Edge cases
      let edgeCases = [
        { input: '2024-02-29', year: 2024, month: 1, day: 29, desc: 'Leap year' },
        { input: '2025-02-28', year: 2025, month: 1, day: 28, desc: 'Non-leap Feb' },
        { input: '2025-04-30', year: 2025, month: 3, day: 30, desc: '30-day month' },
        { input: '2025-07-31', year: 2025, month: 6, day: 31, desc: '31-day month' },
        { input: '1900-01-01', year: 1900, month: 0, day: 1, desc: 'Min year' },
        { input: '2999-12-31', year: 2999, month: 11, day: 31, desc: 'Max year' },
        { input: '2025-01-15T00:00:00', year: 2025, month: 0, day: 15, hour: 0, minute: 0, second: 0, desc: 'Midnight' },
        { input: '2025-01-15T23:59:59', year: 2025, month: 0, day: 15, hour: 23, minute: 59, second: 59, desc: 'End of day' }
      ];

      edgeCases.forEach((testCase, i) => {
        if ( testCase.hour !== undefined ) {
          // DateTime edge case
          x.test(
            this.testParseDT(
              parser, testCase.input,
              testCase.year, testCase.month, testCase.day,
              testCase.hour, testCase.minute, testCase.second
            ),
            `EdgeCase Test${i + 1}: ${testCase.desc || testCase.input}`
          );
        } else {
          // Date-only edge case
          x.test(
            this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
            `EdgeCase Test${i + 1}: ${testCase.desc || testCase.input}`
          );
        }
      });
    },

    function testValidation(x) {
      let parser = this.DateParser.create();

      // In non-strict mode (default), unparseable inputs return MAX_DATE
      let invalidInputs = [
        'invalid-date',
        '99/99/99',
        '',
        'notadate'
      ];

      invalidInputs.forEach((input, i) => {
        let result = parser.parseString(input);
        x.test(result.getTime() === foam.Date.MAX_DATE.getTime(), `Validation Test${i + 1}: "${input}" returns MAX_DATE in lenient mode`);
      });

      // Test date normalization - JavaScript Date normalizes out-of-range values
      // These should parse successfully and be normalized by JavaScript's Date constructor
      let normalizedDates = [
        { input: '2025-13-01', year: 2026, month: 0, day: 1, desc: 'Month 13 → January next year' },
        { input: '2025-02-30', year: 2025, month: 2, day: 2, desc: 'Feb 30 → March 2' },
        { input: '2024-02-30', year: 2024, month: 2, day: 1, desc: 'Feb 30 (leap year) → March 1' },
        { input: '2025-04-31', year: 2025, month: 4, day: 1, desc: 'April 31 → May 1' },
        { input: '2025-00-15', year: 2024, month: 11, day: 15, desc: 'Month 0 → December prev year' }
      ];

      normalizedDates.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `Normalized Date Test${i + 1}: ${testCase.input} - ${testCase.desc}`);
        } catch (e) {
          x.test(false, `Normalized Date Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });
    },

    function testTimezoneZ(x) {
      let parser = this.DateParser.create();

      // Test Z (Zulu/UTC) timezone indicator
      let testCases = [
        { input: '2025-01-15T14:30:45Z', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '2025-01-15T00:00:00Z', year: 2025, month: 0, day: 15, hour: 0, minute: 0, second: 0 },
        { input: '2025-01-15T23:59:59Z', year: 2025, month: 0, day: 15, hour: 23, minute: 59, second: 59 },
        { input: '2024-12-31T12:00:00Z', year: 2024, month: 11, day: 31, hour: 12, minute: 0, second: 0 },
        { input: '2025-07-04T18:30:15Z', year: 2025, month: 6, day: 4, hour: 18, minute: 30, second: 15 }
      ];

      testCases.forEach((tc, i) => {
        x.test(
          this.testDateTime(parser.parseDateTime(tc.input), tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `Timezone Z Test${i + 1}: ${tc.input}`
        );
      });
    },

    function testTimezonePositiveOffset(x) {
      let parser = this.DateParser.create();

      // Test positive timezone offsets (ahead of UTC)
      let testCases = [
        { input: '2025-01-15T14:30:45+05:30', year: 2025, month: 0, day: 15, hour: 9, minute: 0, second: 45 },  // India
        { input: '2025-01-15T14:30:45+01:00', year: 2025, month: 0, day: 15, hour: 13, minute: 30, second: 45 }, // Central Europe
        { input: '2025-01-15T14:30:45+09:00', year: 2025, month: 0, day: 15, hour: 5, minute: 30, second: 45 },  // Japan
        { input: '2025-01-15T14:30:45+10:00', year: 2025, month: 0, day: 15, hour: 4, minute: 30, second: 45 },  // Australia East
        { input: '2025-01-15T14:30:45+08:00', year: 2025, month: 0, day: 15, hour: 6, minute: 30, second: 45 },  // China
        { input: '2025-01-15T14:30:45+12:00', year: 2025, month: 0, day: 15, hour: 2, minute: 30, second: 45 }   // New Zealand
      ];

      testCases.forEach((tc, i) => {
        x.test(
          this.testDateTime(parser.parseDateTime(tc.input), tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `Timezone Positive Offset Test${i + 1}: ${tc.input}`
        );
      });
    },

    function testTimezoneNegativeOffset(x) {
      let parser = this.DateParser.create();

      // Test negative timezone offsets (behind UTC)
      let testCases = [
        { input: '2025-01-15T14:30:45-08:00', year: 2025, month: 0, day: 15, hour: 22, minute: 30, second: 45 }, // Pacific
        { input: '2025-01-15T14:30:45-05:00', year: 2025, month: 0, day: 15, hour: 19, minute: 30, second: 45 }, // Eastern
        { input: '2025-01-15T14:30:45-07:00', year: 2025, month: 0, day: 15, hour: 21, minute: 30, second: 45 }, // Mountain
        { input: '2025-01-15T14:30:45-06:00', year: 2025, month: 0, day: 15, hour: 20, minute: 30, second: 45 }, // Central
        { input: '2025-01-15T14:30:45-03:00', year: 2025, month: 0, day: 15, hour: 17, minute: 30, second: 45 }, // Brazil
        { input: '2025-01-15T14:30:45-04:00', year: 2025, month: 0, day: 15, hour: 18, minute: 30, second: 45 }  // Atlantic
      ];

      testCases.forEach((tc, i) => {
        x.test(
          this.testDateTime(parser.parseDateTime(tc.input), tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `Timezone Negative Offset Test${i + 1}: ${tc.input}`
        );
      });
    },

    function testTimezoneFormatVariations(x) {
      let parser = this.DateParser.create();

      // Test different timezone format variations (+HHMM vs +HH:MM)
      let testCases = [
        { input: '2025-01-15T14:30:45+0530', year: 2025, month: 0, day: 15, hour: 9, minute: 0, second: 45 },   // Compact +HHMM
        { input: '2025-01-15T14:30:45+05:30', year: 2025, month: 0, day: 15, hour: 9, minute: 0, second: 45 },  // Colon +HH:MM
        { input: '2025-01-15T14:30:45-0800', year: 2025, month: 0, day: 15, hour: 22, minute: 30, second: 45 }, // Compact -HHMM
        { input: '2025-01-15T14:30:45-08:00', year: 2025, month: 0, day: 15, hour: 22, minute: 30, second: 45 },// Colon -HH:MM
        { input: '2025-01-15T14:30:45+0000', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 }, // +0000 (UTC)
        { input: '2025-01-15T14:30:45+00:00', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 } // +00:00 (UTC)
      ];

      testCases.forEach((tc, i) => {
        x.test(
          this.testDateTime(parser.parseDateTime(tc.input), tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `Timezone Format Variation Test${i + 1}: ${tc.input}`
        );
      });
    },

    function testTimezoneDateBoundaries(x) {
      let parser = this.DateParser.create();

      // Test timezone conversions that cross date boundaries
      let testCases = [
        { input: '2025-01-15T23:30:00-05:00', year: 2025, month: 0, day: 16, hour: 4, minute: 30, second: 0 },  // Next day
        { input: '2025-01-15T01:30:00+05:00', year: 2025, month: 0, day: 14, hour: 20, minute: 30, second: 0 }, // Previous day
        { input: '2025-12-31T23:30:00-01:00', year: 2026, month: 0, day: 1, hour: 0, minute: 30, second: 0 },   // Year boundary
        { input: '2025-01-01T00:30:00+01:00', year: 2024, month: 11, day: 31, hour: 23, minute: 30, second: 0 },// Year boundary back
        { input: '2025-03-01T01:00:00+05:00', year: 2025, month: 1, day: 28, hour: 20, minute: 0, second: 0 },  // Month boundary
        { input: '2024-02-29T23:00:00-02:00', year: 2024, month: 2, day: 1, hour: 1, minute: 0, second: 0 }     // Leap year boundary
      ];

      testCases.forEach((tc, i) => {
        x.test(
          this.testDateTime(parser.parseDateTime(tc.input), tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `Timezone Date Boundary Test${i + 1}: ${tc.input}`
        );
      });
    },

    function testMMDDYYSepTimeFormat(x) {
      let parser = this.DateParser.create();

      // Test MMDDYY with separators and time (MM-DD-YY HH:MM:SS)
      let testCases = [
        // Basic formats with dash separator
        { input: '03-15-24 14:30:45', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '01-15-25 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },

        // Slash separator
        { input: '03/15/24 14:30:45', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '01/15/25 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },

        // Year >= 50 should be 1900s
        { input: '03-15-99 14:30:45', year: 1999, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '06-30-50 12:00:00', year: 1950, month: 5, day: 30, hour: 12, minute: 0, second: 0 },
        { input: '12-25-75 23:59:59', year: 1975, month: 11, day: 25, hour: 23, minute: 59, second: 59 },

        // Year < 50 should be 2000s
        { input: '03-15-49 14:30:45', year: 2049, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '01-01-00 00:00:00', year: 2000, month: 0, day: 1, hour: 0, minute: 0, second: 0 },
        { input: '12-31-25 23:59:59', year: 2025, month: 11, day: 31, hour: 23, minute: 59, second: 59 },

        // Without seconds (HH:MM only)
        { input: '03-15-24 14:30', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 0 },
        { input: '01/15/25 09:45', year: 2025, month: 0, day: 15, hour: 9, minute: 45, second: 0 },

        // Edge cases
        { input: '02-29-24 12:00:00', year: 2024, month: 1, day: 29, hour: 12, minute: 0, second: 0 }, // Leap year
        { input: '02-28-25 12:00:00', year: 2025, month: 1, day: 28, hour: 12, minute: 0, second: 0 }, // Non-leap Feb
        { input: '01-01-24 00:00:00', year: 2024, month: 0, day: 1, hour: 0, minute: 0, second: 0 },   // Midnight
        { input: '12-31-24 23:59:59', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 } // End of day
      ];

      testCases.forEach((tc, i) => {
        x.test(
          this.testParseDT(parser, tc.input, tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `MMDDYY-Sep-Time Test${i + 1}: ${tc.input}`
        );
      });

      // Test with timezone indicators
      let timezoneCases = [
        { input: '03-15-24 14:30:45Z', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '01-15-25 14:30:45Z', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '03/15/24 14:30:45Z', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },

        // Positive timezone offsets
        { input: '03-15-24 14:30:45+05:30', year: 2024, month: 2, day: 15, hour: 9, minute: 0, second: 45 },
        { input: '01-15-25 14:30:45+01:00', year: 2025, month: 0, day: 15, hour: 13, minute: 30, second: 45 },
        { input: '03/15/24 14:30:45+09:00', year: 2024, month: 2, day: 15, hour: 5, minute: 30, second: 45 },

        // Negative timezone offsets
        { input: '03-15-24 14:30:45-08:00', year: 2024, month: 2, day: 15, hour: 22, minute: 30, second: 45 },
        { input: '01-15-25 14:30:45-05:00', year: 2025, month: 0, day: 15, hour: 19, minute: 30, second: 45 },
        { input: '03/15/24 14:30:45-07:00', year: 2024, month: 2, day: 15, hour: 21, minute: 30, second: 45 },

        // With minutes only + timezone
        { input: '03-15-24 14:30+05:30', year: 2024, month: 2, day: 15, hour: 9, minute: 0, second: 0 },
        { input: '01-15-25 14:30-08:00', year: 2025, month: 0, day: 15, hour: 22, minute: 30, second: 0 },
        { input: '03/15/24 14:30Z', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 0 },

        // Compact timezone format (+HHMM)
        { input: '03-15-24 14:30:45+0530', year: 2024, month: 2, day: 15, hour: 9, minute: 0, second: 45 },
        { input: '01-15-25 14:30:45-0800', year: 2025, month: 0, day: 15, hour: 22, minute: 30, second: 45 }
      ];

      timezoneCases.forEach((tc, i) => {
        x.test(
          this.testDateTime(parser.parseDateTime(tc.input), tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `MMDDYY-Sep-Timezone Test${i + 1}: ${tc.input}`
        );
      });
    },

    function testWithAndWithoutZ(x) {
      let parser = this.DateParser.create();

      // Test parseDateTime with and without Z suffix
      // Without Z: should parse as local time
      // With Z: should parse as UTC and convert to local time
      let dateTimeCases = [
        {
          withoutZ: '2025-01-15T14:30:00',
          withZ: '2025-01-15T14:30:00Z',
          desc: 'Basic ISO format'
        },
        {
          withoutZ: '2025-02-20T09:15:45',
          withZ: '2025-02-20T09:15:45Z',
          desc: 'Morning time'
        },
        {
          withoutZ: '2025-03-25T23:59:59',
          withZ: '2025-03-25T23:59:59Z',
          desc: 'End of day'
        },
        {
          withoutZ: '2025-04-01T00:00:00',
          withZ: '2025-04-01T00:00:00Z',
          desc: 'Midnight'
        },
        {
          withoutZ: '2025-05-10T12:00:00',
          withZ: '2025-05-10T12:00:00Z',
          desc: 'Noon'
        }
      ];

      dateTimeCases.forEach((tc, i) => {
        try {
          // Parse without Z - should be local time
          let resultNoZ = parser.parseDateTime(tc.withoutZ);

          // Parse with Z - should be UTC, converted to local
          let resultWithZ = parser.parseDateTime(tc.withZ);

          // Without Z: the time should be interpreted as local time
          // Example: 2025-01-15T14:30:00 means 14:30 in local timezone
          let expectedYear = parseInt(tc.withoutZ.substring(0, 4));
          let expectedMonth = parseInt(tc.withoutZ.substring(5, 7)) - 1;
          let expectedDay = parseInt(tc.withoutZ.substring(8, 10));
          let expectedHour = parseInt(tc.withoutZ.substring(11, 13));
          let expectedMinute = parseInt(tc.withoutZ.substring(14, 16));
          let expectedSecond = parseInt(tc.withoutZ.substring(17, 19));

          let passNoZ = resultNoZ &&
                        resultNoZ.getFullYear() === expectedYear &&
                        resultNoZ.getMonth() === expectedMonth &&
                        resultNoZ.getDate() === expectedDay &&
                        resultNoZ.getHours() === expectedHour &&
                        resultNoZ.getMinutes() === expectedMinute &&
                        resultNoZ.getSeconds() === expectedSecond;

          // With Z: the time is in UTC, so when converted to local it will differ
          // Example: 2025-01-15T14:30:00Z means 14:30 UTC, which is different in local time
          let passWithZ = resultWithZ &&
                          resultWithZ.getFullYear() === expectedYear;

          x.test(passNoZ, `DateTime without Z Test${i + 1}: ${tc.withoutZ} - ${tc.desc} (local time)`);
          x.test(passWithZ, `DateTime with Z Test${i + 1}: ${tc.withZ} - ${tc.desc} (UTC converted to local)`);

        } catch (e) {
          x.test(false, `DateTime Z comparison Test${i + 1}: ${tc.desc} - ${e.message}`);
        }
      });

      // Test parseDateTimeUTC with and without Z suffix
      // Without Z: should parse as UTC time (no conversion)
      // With Z: should parse as UTC time (no conversion)
      let dateTimeUTCCases = [
        {
          withoutZ: '2025-01-15T14:30:00',
          withZ: '2025-01-15T14:30:00Z',
          expectedHour: 14,
          expectedMinute: 30,
          expectedSecond: 0,
          desc: 'Basic ISO format'
        },
        {
          withoutZ: '2025-02-20T09:15:45',
          withZ: '2025-02-20T09:15:45Z',
          expectedHour: 9,
          expectedMinute: 15,
          expectedSecond: 45,
          desc: 'Morning time'
        },
        {
          withoutZ: '2025-12-31T23:59:59',
          withZ: '2025-12-31T23:59:59Z',
          expectedHour: 23,
          expectedMinute: 59,
          expectedSecond: 59,
          desc: 'Year end'
        }
      ];

      dateTimeUTCCases.forEach((tc, i) => {
        try {
          // Parse without Z - should be UTC time (no Z means treat as UTC)
          let resultNoZ = parser.parseDateTimeUTC(tc.withoutZ);

          // Parse with Z - should be UTC time
          let resultWithZ = parser.parseDateTimeUTC(tc.withZ);

          // Both should produce the same UTC time
          let passNoZ = resultNoZ &&
                        resultNoZ.getUTCHours() === tc.expectedHour &&
                        resultNoZ.getUTCMinutes() === tc.expectedMinute &&
                        resultNoZ.getUTCSeconds() === tc.expectedSecond;

          let passWithZ = resultWithZ &&
                          resultWithZ.getUTCHours() === tc.expectedHour &&
                          resultWithZ.getUTCMinutes() === tc.expectedMinute &&
                          resultWithZ.getUTCSeconds() === tc.expectedSecond;

          x.test(passNoZ, `DateTimeUTC without Z Test${i + 1}: ${tc.withoutZ} - ${tc.desc} (UTC)`);
          x.test(passWithZ, `DateTimeUTC with Z Test${i + 1}: ${tc.withZ} - ${tc.desc} (UTC)`);

          // Both should produce identical results
          let identical = resultNoZ.getTime() === resultWithZ.getTime();
          x.test(identical, `DateTimeUTC Z comparison Test${i + 1}: ${tc.desc} - both should be identical`);

        } catch (e) {
          x.test(false, `DateTimeUTC Z comparison Test${i + 1}: ${tc.desc} - ${e.message}`);
        }
      });
    },

    function testInvalidLeapYearDates(x) {
      let parser = this.DateParser.create();

      // Test invalid leap year dates - should return MAX_DATE or normalized date
      let testCases = [
        { input: '29/02/2025 12:00', format: 'ddmmyyyy', desc: 'Feb 29 in non-leap year 2025 (DD/MM/YYYY)' },
        { input: '2025/29/02 12:00', format: 'yyyyddmm', desc: 'Feb 29 in non-leap year 2025 (YYYY/DD/MM)' }
      ];

      testCases.forEach((tc, i) => {
        try {
          let result = parser.parseDateTime(tc.input, tc.format);

          // Should either be MAX_DATE (invalid) or normalized to March 1, 2025
          let isMaxDate = result && result.getTime() === foam.Date.MAX_DATE.getTime();
          let isNormalized = result &&
                             result.getFullYear() === 2025 &&
                             result.getMonth() === 2 && // March
                             result.getDate() === 1;

          let pass = isMaxDate || isNormalized;
          x.test(pass, `Invalid Leap Year Test${i + 1}: ${tc.input} - ${tc.desc}`);
        } catch (e) {
          x.test(false, `Invalid Leap Year Test${i + 1}: ${tc.input} - ${e.message}`);
        }
      });
    },

    function testAllParseMethodsExample(x) {
      let parser = this.DateParser.create();

      // Example: Test date with timezone - all three methods should handle it
      let testCases = [
        {
          input: '18/01/2025T09:15:30+05:00',
          format: 'ddmmyyyy',
          expected: {
            dateOnly: { year: 2025, month: 0, day: 18 },  // parseString ignores time
            local: { year: 2025, month: 0, day: 18, hour: 0, minute: 15, second: 30 },  // Local time after TZ conversion
            utc: { year: 2025, month: 0, day: 18, hour: 4, minute: 15, second: 30 }  // UTC time
          }
        },
        {
          input: '2025-01-15',
          format: null,
          expected: {
            dateOnly: { year: 2025, month: 0, day: 15 },
            local: { year: 2025, month: 0, day: 15, hour: 12, minute: 0, second: 0 },  // Defaults to noon
            utc: { year: 2025, month: 0, day: 15, hour: 0, minute: 0, second: 0 }  // Midnight UTC
          }
        }
      ];

      testCases.forEach((tc, i) => {
        let results = this.testAllParseMethods(parser, tc.input, tc.expected, tc.format);

        // Test each method's result
        results.forEach((result) => {
          let testName = `All-Methods Test${i + 1}: ${tc.input} [${result.method}]`;
          if ( ! result.pass && result.message ) {
            testName += ` - ${result.message}`;
          }
          x.test(result.pass, testName);
        });
      });
    },

    // Helper functions
    function testParseDate(parser, dateStr, expectedYear, expectedMonth, expectedDay) {
      try {
        let result = parser.parseString(dateStr);
        if ( ! result ) {
          console.error(`Parse failed for ${dateStr}: returned null`);
          return false;
        }

        let pass = result.getUTCFullYear() === expectedYear &&
                   result.getUTCMonth() === expectedMonth &&
                   result.getUTCDate() === expectedDay &&
                   result.getUTCHours() === 12;

        if ( ! pass ) {
          console.error(`Parse mismatch for ${dateStr}:\n  Expected: ${expectedYear}-${expectedMonth + 1}-${expectedDay} 12:00 UTC\n  Got: ${result.getUTCFullYear()}-${result.getUTCMonth() + 1}-${result.getUTCDate()} ${result.getUTCHours()}:${result.getUTCMinutes()} UTC`);
        }

        return pass;
      } catch (e) {
        console.error(`Parse error for ${dateStr}:`, e);
        return false;
      }
    },

    function testParseDT(parser, dateStr, expectedYear, expectedMonth, expectedDay,
                         expectedHour, expectedMinute, expectedSecond, expectedMs) {
      try {
        let result = parser.parseString(dateStr);
        if ( ! result ) {
          console.error(`Parse failed for ${dateStr}: returned null`);
          return false;
        }

        expectedHour = expectedHour || 0;
        expectedMinute = expectedMinute || 0;
        expectedSecond = expectedSecond || 0;
        expectedMs = expectedMs || 0;

        let pass = result.getFullYear() === expectedYear &&
                   result.getMonth() === expectedMonth &&
                   result.getDate() === expectedDay &&
                   result.getHours() === expectedHour &&
                   result.getMinutes() === expectedMinute &&
                   result.getSeconds() === expectedSecond &&
                   result.getMilliseconds() === expectedMs;

        if ( ! pass ) {
          console.error(`Parse mismatch for ${dateStr}:\n  Expected: ${expectedYear}-${expectedMonth + 1}-${expectedDay} ${expectedHour}:${expectedMinute}:${expectedSecond}.${expectedMs}\n  Got: ${result.getFullYear()}-${result.getMonth() + 1}-${result.getDate()} ${result.getHours()}:${result.getMinutes()}:${result.getSeconds()}.${result.getMilliseconds()}`);
        }

        return pass;
      } catch (e) {
        console.error(`Parse datetime error for ${dateStr}:`, e);
        return false;
      }
    },

    function testParseDTWithDetails(parser, dateStr, expectedYear, expectedMonth, expectedDay,
                         expectedHour, expectedMinute, expectedSecond, expectedMs, opt_name) {
      try {
        expectedMs = expectedMs || 0;

        let result = parser.parseDateTime(dateStr, opt_name);
        if ( ! result ) {
          let msg = `Parse failed: returned null`;
          console.error(`${msg} for ${dateStr}`);
          return { pass: false, message: msg };
        }

        // Check if result is MAX_DATE (invalid date)
        let isMaxDate = result.getTime() === foam.Date.MAX_DATE.getTime();
        if ( isMaxDate ) {
          let msg = `Parse returned MAX_DATE (invalid) - format didn't match or was partially parsed`;
          console.error(`${msg} for ${dateStr} with opt_name=${actualOptName}`);
          return { pass: false, message: msg };
        }

        expectedHour = expectedHour || 0;
        expectedMinute = expectedMinute || 0;
        expectedSecond = expectedSecond || 0;

        let pass = result.getFullYear() === expectedYear &&
                   result.getMonth() === expectedMonth &&
                   result.getDate() === expectedDay &&
                   result.getHours() === expectedHour &&
                   result.getMinutes() === expectedMinute &&
                   result.getSeconds() === expectedSecond &&
                   result.getMilliseconds() === expectedMs;

        if ( ! pass ) {
          let expected = `${expectedYear}-${String(expectedMonth + 1).padStart(2, '0')}-${String(expectedDay).padStart(2, '0')} ${String(expectedHour).padStart(2, '0')}:${String(expectedMinute).padStart(2, '0')}:${String(expectedSecond).padStart(2, '0')}.${String(expectedMs).padStart(3, '0')}`;
          let got = `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')} ${String(result.getHours()).padStart(2, '0')}:${String(result.getMinutes()).padStart(2, '0')}:${String(result.getSeconds()).padStart(2, '0')}.${String(result.getMilliseconds()).padStart(3, '0')}`;
          let msg = `Expected: ${expected}, Got: ${got}`;
          console.error(`Parse mismatch for ${dateStr} (opt_name=${actualOptName}): ${msg}`);
          return { pass: false, message: msg };
        }

        return { pass: true, message: null };
      } catch (e) {
        let msg = `Exception: ${e.message}`;
        console.error(`Parse datetime error for ${dateStr}: ${msg}`, e);
        return { pass: false, message: msg };
      }
    },

    function testParseDTUTCWithDetails(parser, dateStr, expectedYear, expectedMonth, expectedDay,
                         expectedHour, expectedMinute, expectedSecond, opt_name) {
      try {
        let result = parser.parseDateTimeUTC(dateStr, opt_name);
        if ( ! result ) {
          let msg = `Parse failed: returned null`;
          console.error(`${msg} for ${dateStr}`);
          return { pass: false, message: msg };
        }

        // Check if result is MAX_DATE (invalid date)
        let isMaxDate = result.getTime() === foam.Date.MAX_DATE.getTime();
        if ( isMaxDate ) {
          let msg = `Parse returned MAX_DATE (invalid) - format didn't match or was partially parsed`;
          console.error(`${msg} for ${dateStr} with opt_name=${opt_name}`);
          return { pass: false, message: msg };
        }

        expectedHour = expectedHour || 0;
        expectedMinute = expectedMinute || 0;
        expectedSecond = expectedSecond || 0;

        let pass = result.getUTCFullYear() === expectedYear &&
                   result.getUTCMonth() === expectedMonth &&
                   result.getUTCDate() === expectedDay &&
                   result.getUTCHours() === expectedHour &&
                   result.getUTCMinutes() === expectedMinute &&
                   result.getUTCSeconds() === expectedSecond;

        if ( ! pass ) {
          let expected = `${expectedYear}-${String(expectedMonth + 1).padStart(2, '0')}-${String(expectedDay).padStart(2, '0')} ${String(expectedHour).padStart(2, '0')}:${String(expectedMinute).padStart(2, '0')}:${String(expectedSecond).padStart(2, '0')} UTC`;
          let got = `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')} ${String(result.getUTCHours()).padStart(2, '0')}:${String(result.getUTCMinutes()).padStart(2, '0')}:${String(result.getUTCSeconds()).padStart(2, '0')} UTC`;
          let msg = `Expected: ${expected}, Got: ${got}`;
          console.error(`Parse mismatch for ${dateStr} (opt_name=${opt_name}): ${msg}`);
          return { pass: false, message: msg };
        }

        return { pass: true, message: null };
      } catch (e) {
        let msg = `Exception: ${e.message}`;
        console.error(`Parse datetime error for ${dateStr}: ${msg}`, e);
        return { pass: false, message: msg };
      }
    },

    /**
     * Tests all three parse methods: parseDateString (date), parseDateTime (local), parseDateTimeUTC (UTC)
     * Returns array of 3 results: [dateResult, dateTimeResult, dateTimeUTCResult]
     * Each result is { pass: boolean, message: string, method: string }
     */
    function testAllParseMethods(parser, dateStr, expected, opt_name) {
      let results = [];

      // Test 1: parseDateString (date-only, ignores time, returns noon UTC)
      try {
        let result = parser.parseDateString(dateStr, opt_name);
        if ( ! result ) {
          results.push({
            pass: false,
            message: `parseDateString returned null`,
            method: 'parseDateString'
          });
        } else {
          let isMaxDate = result.getTime() === foam.Date.MAX_DATE.getTime();
          if ( isMaxDate ) {
            results.push({
              pass: false,
              message: `parseDateString returned MAX_DATE (invalid)`,
              method: 'parseDateString'
            });
          } else if ( expected.dateOnly ) {
            let pass = result.getUTCFullYear() === expected.dateOnly.year &&
                       result.getUTCMonth() === expected.dateOnly.month &&
                       result.getUTCDate() === expected.dateOnly.day &&
                       result.getUTCHours() === 12;
            if ( pass ) {
              results.push({ pass: true, message: null, method: 'parseDateString' });
            } else {
              let exp = `${expected.dateOnly.year}-${String(expected.dateOnly.month + 1).padStart(2, '0')}-${String(expected.dateOnly.day).padStart(2, '0')} 12:00 UTC`;
              let got = `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')} ${String(result.getUTCHours()).padStart(2, '0')}:${String(result.getUTCMinutes()).padStart(2, '0')} UTC`;
              results.push({
                pass: false,
                message: `parseDateString expected ${exp}, got ${got}`,
                method: 'parseDateString'
              });
            }
          } else {
            results.push({ pass: true, message: 'parseDateString succeeded (no dateOnly expectations)', method: 'parseDateString' });
          }
        }
      } catch (e) {
        results.push({ pass: false, message: `parseDateString exception: ${e.message}`, method: 'parseDateString' });
      }

      // Test 2: parseDateTime (local time)
      try {
        let result = parser.parseDateTime(dateStr, opt_name);
        if ( ! result ) {
          results.push({
            pass: false,
            message: `parseDateTime returned null`,
            method: 'parseDateTime'
          });
        } else {
          let isMaxDate = result.getTime() === foam.Date.MAX_DATE.getTime();
          if ( isMaxDate ) {
            results.push({
              pass: false,
              message: `parseDateTime returned MAX_DATE (invalid)`,
              method: 'parseDateTime'
            });
          } else if ( expected.local ) {
            let pass = result.getFullYear() === expected.local.year &&
                       result.getMonth() === expected.local.month &&
                       result.getDate() === expected.local.day &&
                       result.getHours() === (expected.local.hour || 0) &&
                       result.getMinutes() === (expected.local.minute || 0) &&
                       result.getSeconds() === (expected.local.second || 0);
            if ( pass ) {
              results.push({ pass: true, message: null, method: 'parseDateTime' });
            } else {
              let exp = `${expected.local.year}-${String(expected.local.month + 1).padStart(2, '0')}-${String(expected.local.day).padStart(2, '0')} ${String(expected.local.hour || 0).padStart(2, '0')}:${String(expected.local.minute || 0).padStart(2, '0')}:${String(expected.local.second || 0).padStart(2, '0')}`;
              let got = `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')} ${String(result.getHours()).padStart(2, '0')}:${String(result.getMinutes()).padStart(2, '0')}:${String(result.getSeconds()).padStart(2, '0')}`;
              results.push({
                pass: false,
                message: `parseDateTime expected ${exp}, got ${got}`,
                method: 'parseDateTime'
              });
            }
          } else {
            results.push({ pass: true, message: 'parseDateTime succeeded (no local expectations)', method: 'parseDateTime' });
          }
        }
      } catch (e) {
        results.push({ pass: false, message: `parseDateTime exception: ${e.message}`, method: 'parseDateTime' });
      }

      // Test 3: parseDateTimeUTC (UTC time)
      try {
        let result = parser.parseDateTimeUTC(dateStr, opt_name);
        if ( ! result ) {
          results.push({
            pass: false,
            message: `parseDateTimeUTC returned null`,
            method: 'parseDateTimeUTC'
          });
        } else {
          let isMaxDate = result.getTime() === foam.Date.MAX_DATE.getTime();
          if ( isMaxDate ) {
            results.push({
              pass: false,
              message: `parseDateTimeUTC returned MAX_DATE (invalid)`,
              method: 'parseDateTimeUTC'
            });
          } else if ( expected.utc ) {
            let pass = result.getUTCFullYear() === expected.utc.year &&
                       result.getUTCMonth() === expected.utc.month &&
                       result.getUTCDate() === expected.utc.day &&
                       result.getUTCHours() === (expected.utc.hour || 0) &&
                       result.getUTCMinutes() === (expected.utc.minute || 0) &&
                       result.getUTCSeconds() === (expected.utc.second || 0);
            if ( pass ) {
              results.push({ pass: true, message: null, method: 'parseDateTimeUTC' });
            } else {
              let exp = `${expected.utc.year}-${String(expected.utc.month + 1).padStart(2, '0')}-${String(expected.utc.day).padStart(2, '0')} ${String(expected.utc.hour || 0).padStart(2, '0')}:${String(expected.utc.minute || 0).padStart(2, '0')}:${String(expected.utc.second || 0).padStart(2, '0')} UTC`;
              let got = `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')} ${String(result.getUTCHours()).padStart(2, '0')}:${String(result.getUTCMinutes()).padStart(2, '0')}:${String(result.getUTCSeconds()).padStart(2, '0')} UTC`;
              results.push({
                pass: false,
                message: `parseDateTimeUTC expected ${exp}, got ${got}`,
                method: 'parseDateTimeUTC'
              });
            }
          } else {
            results.push({ pass: true, message: 'parseDateTimeUTC succeeded (no UTC expectations)', method: 'parseDateTimeUTC' });
          }
        }
      } catch (e) {
        results.push({ pass: false, message: `parseDateTimeUTC exception: ${e.message}`, method: 'parseDateTimeUTC' });
      }

      return results;
    },

    function testParseYear(parser, dateStr, expectedYear) {
      try {
        let result = parser.parseString(dateStr);
        if ( ! result ) return false;

        return result.getUTCFullYear() === expectedYear;
      } catch (e) {
        console.error(`Parse year error for ${dateStr}:`, e);
        return false;
      }
    },

    function testDateTime(result, expectedYear, expectedMonth, expectedDay,
                         expectedHour, expectedMinute, expectedSecond) {
      try {
        if ( ! result ) return false;

        expectedHour = expectedHour || 0;
        expectedMinute = expectedMinute || 0;
        expectedSecond = expectedSecond || 0;

        return result.getUTCFullYear() === expectedYear &&
               result.getUTCMonth() === expectedMonth &&
               result.getUTCDate() === expectedDay &&
               result.getUTCHours() === expectedHour &&
               result.getUTCMinutes() === expectedMinute &&
               result.getUTCSeconds() === expectedSecond;
      } catch (e) {
        console.error(`Test datetime error:`, e);
        return false;
      }
    },

    /**
     * Test that timestamp strings don't conflict with date parsing.
     * Tests foam.lang.Date and foam.lang.DateTime adapt functions handle:
     * - 13-digit JavaScript millisecond timestamps (always treated as timestamps)
     * - 10-digit Unix timestamps starting with '1' (treated as seconds since epoch)
     * - 10-digit strings starting with '2' should still parse as dates (YYYYMMDDHH)
     */
    function testTimestampStrings(x) {
      // Test 13-digit millisecond timestamps (should be treated as timestamps)
      let msTimestamps = [
        { input: '1754308800000', expectedDate: new Date(1754308800000), desc: '13-digit ms timestamp (2025-08-04)' },
        { input: '1000000000000', expectedDate: new Date(1000000000000), desc: '13-digit ms timestamp (2001-09-09)' },
        { input: '1609459200000', expectedDate: new Date(1609459200000), desc: '13-digit ms timestamp (2021-01-01)' }
      ];

      // Test 10-digit Unix second timestamps starting with '1' (should be treated as timestamps)
      let secTimestamps = [
        { input: '1754308800', expectedDate: new Date(1754308800 * 1000), desc: '10-digit sec timestamp starting with 1' },
        { input: '1000000000', expectedDate: new Date(1000000000 * 1000), desc: '10-digit sec timestamp (2001-09-09)' },
        { input: '1609459200', expectedDate: new Date(1609459200 * 1000), desc: '10-digit sec timestamp (2021-01-01)' }
      ];

      // Test 10-digit strings starting with '2' should NOT be treated as timestamps
      // They should be parsed as YYYYMMDDHH format
      let dateStrings = [
        { input: '2025011512', desc: '10-digit starting with 2 (YYYYMMDDHH format)', expectedYear: 2025, expectedMonth: 0, expectedDay: 15 },
        { input: '2024123123', desc: '10-digit date format', expectedYear: 2024, expectedMonth: 11, expectedDay: 31 }
      ];

      // Test 13-digit timestamps via foam.lang.Date adapt
      msTimestamps.forEach((testCase, i) => {
        try {
          let dateProp = foam.lang.Date.create();
          let result = dateProp.adapt.call({}, null, testCase.input);
          // Compare timestamps (allow 1 day tolerance for Date noon UTC normalization)
          let timeDiff = Math.abs(result.getTime() - testCase.expectedDate.getTime());
          let pass = timeDiff < 86400000; // Within 24 hours
          x.test(pass, `Timestamp-13digit Test${i + 1}: ${testCase.desc} - expected ~${testCase.expectedDate.toISOString()}, got ${result.toISOString()}`);
        } catch (e) {
          x.test(false, `Timestamp-13digit Test${i + 1}: ${testCase.desc} - Error: ${e.message}`);
        }
      });

      // Test 10-digit timestamps starting with '1' via foam.lang.Date adapt
      secTimestamps.forEach((testCase, i) => {
        try {
          let dateProp = foam.lang.Date.create();
          let result = dateProp.adapt.call({}, null, testCase.input);
          // Compare timestamps (allow 1 day tolerance for Date noon UTC normalization)
          let timeDiff = Math.abs(result.getTime() - testCase.expectedDate.getTime());
          let pass = timeDiff < 86400000; // Within 24 hours
          x.test(pass, `Timestamp-10digit Test${i + 1}: ${testCase.desc} - expected ~${testCase.expectedDate.toISOString()}, got ${result.toISOString()}`);
        } catch (e) {
          x.test(false, `Timestamp-10digit Test${i + 1}: ${testCase.desc} - Error: ${e.message}`);
        }
      });

      // Test that 10-digit strings starting with '2' are still parsed as dates (not timestamps)
      dateStrings.forEach((testCase, i) => {
        try {
          let dateProp = foam.lang.Date.create();
          let result = dateProp.adapt.call({}, null, testCase.input);
          // Should be parsed as a date, not a timestamp from 1970
          let isReasonableYear = result.getFullYear() >= 2000 && result.getFullYear() <= 2100;
          x.test(isReasonableYear, `DateString-10digit Test${i + 1}: ${testCase.desc} - year should be 2000-2100, got ${result.getFullYear()}`);
          if ( testCase.expectedYear ) {
            let yearMatch = result.getUTCFullYear() === testCase.expectedYear;
            x.test(yearMatch, `DateString-10digit Test${i + 1}: ${testCase.desc} - expected year ${testCase.expectedYear}, got ${result.getUTCFullYear()}`);
          }
        } catch (e) {
          x.test(false, `DateString-10digit Test${i + 1}: ${testCase.desc} - Error: ${e.message}`);
        }
      });

      // Test foam.lang.DateTime adapt with 13-digit timestamps
      msTimestamps.forEach((testCase, i) => {
        try {
          let dateTimeProp = foam.lang.DateTime.create();
          let result = dateTimeProp.adapt.call({}, null, testCase.input);
          let pass = result.getTime() === testCase.expectedDate.getTime();
          x.test(pass, `DateTime-Timestamp Test${i + 1}: ${testCase.desc} - expected ${testCase.expectedDate.toISOString()}, got ${result.toISOString()}`);
        } catch (e) {
          x.test(false, `DateTime-Timestamp Test${i + 1}: ${testCase.desc} - Error: ${e.message}`);
        }
      });
    },

    function testStrictValidationMode(x) {
      // Test strict validation mode - should throw errors for invalid dates
      let parser = this.DateParser.create();

      // Enable strict validation for this test
      parser.strictValidation = true;

      try {
        // Test 1: Invalid format should throw
        let invalidInputs = [
          { input: 'invalid-date', desc: 'completely invalid string' },
          { input: 'notadate', desc: 'non-date text' },
          { input: '', desc: 'empty string' }
        ];

        invalidInputs.forEach((testCase, i) => {
          try {
            parser.parseString(testCase.input);
            x.test(false, `StrictMode parseString Test${i + 1}: "${testCase.input}" should throw (${testCase.desc})`);
          } catch (e) {
            x.test(true, `StrictMode parseString Test${i + 1}: "${testCase.input}" throws error as expected (${testCase.desc})`);
          }
        });

        // Test 2: parseDateTime with invalid input should throw
        try {
          parser.parseDateTime('not-a-date');
          x.test(false, 'StrictMode parseDateTime: should throw for invalid input');
        } catch (e) {
          x.test(true, 'StrictMode parseDateTime: throws error for invalid input');
        }

        // Test 3: parseDateTimeUTC with invalid input should throw
        try {
          parser.parseDateTimeUTC('garbage');
          x.test(false, 'StrictMode parseDateTimeUTC: should throw for invalid input');
        } catch (e) {
          x.test(true, 'StrictMode parseDateTimeUTC: throws error for invalid input');
        }

        // Test 4: Valid dates should still work in strict mode
        try {
          let result = parser.parseString('2025-01-15');
          x.test(result.getUTCFullYear() === 2025, 'StrictMode: valid date parses correctly');
        } catch (e) {
          x.test(false, 'StrictMode: valid date should not throw - ' + e.message);
        }

        // Test 5: Valid datetime should work in strict mode
        try {
          let result = parser.parseDateTime('2025-01-15T14:30:45');
          x.test(result.getFullYear() === 2025, 'StrictMode: valid datetime parses correctly');
        } catch (e) {
          x.test(false, 'StrictMode: valid datetime should not throw - ' + e.message);
        }
      } finally {
        // Reset to default
        parser.strictValidation = false;
      }
    },

    function testLenientValidationMode(x) {
      // Test lenient validation mode (default) - should return MAX_DATE for invalid dates
      let parser = this.DateParser.create();

      // Ensure lenient mode (default)
      parser.strictValidation = false;

      // Test 1: Invalid format returns MAX_DATE in lenient mode
      let invalidInputs = [
        { input: 'invalid-date', desc: 'completely invalid string' },
        { input: 'notadate', desc: 'non-date text' }
      ];

      invalidInputs.forEach((testCase, i) => {
        let result = parser.parseString(testCase.input);
        x.test(result.getTime() === foam.Date.MAX_DATE.getTime(), `LenientMode parseString Test${i + 1}: "${testCase.input}" returns MAX_DATE (${testCase.desc})`);
      });

      // Test 2: Empty string returns MAX_DATE in lenient mode
      let emptyResult = parser.parseString('');
      x.test(emptyResult.getTime() === foam.Date.MAX_DATE.getTime(), 'LenientMode: empty string returns MAX_DATE');

      // Test 3: Valid dates should work in lenient mode
      try {
        let result = parser.parseString('2025-01-15');
        x.test(result.getUTCFullYear() === 2025, 'LenientMode: valid date parses correctly');
      } catch (e) {
        x.test(false, 'LenientMode: valid date should not throw - ' + e.message);
      }

      // Test 4: Default parser should be lenient
      x.test(parser.strictValidation === false, 'Default parser has strictValidation=false');
    },

    /**
     * Test Unix/Java Date.toString() format: DDD MMM DD HH:MM:SS TZ YYYY
     * e.g., "Tue Apr 01 05:17:59 GMT 2025"
     */
    function testUnixDateToStringFormat(x) {
      let parser = this.DateParser.create();

      // Basic test cases - different days of week
      let basicCases = [
        { input: 'Tue Apr 01 05:17:59 GMT 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 },
        { input: 'Mon Jan 15 12:30:45 GMT 2025', year: 2025, month: 0, day: 15, hour: 12, minute: 30, second: 45 },
        { input: 'Wed Feb 28 23:59:59 GMT 2024', year: 2024, month: 1, day: 28, hour: 23, minute: 59, second: 59 },
        { input: 'Thu Mar 01 00:00:00 GMT 2024', year: 2024, month: 2, day: 1, hour: 0, minute: 0, second: 0 },
        { input: 'Fri Dec 31 18:45:30 GMT 2025', year: 2025, month: 11, day: 31, hour: 18, minute: 45, second: 30 },
        { input: 'Sat Jul 04 09:15:00 GMT 2025', year: 2025, month: 6, day: 4, hour: 9, minute: 15, second: 0 },
        { input: 'Sun Nov 11 11:11:11 GMT 2025', year: 2025, month: 10, day: 11, hour: 11, minute: 11, second: 11 }
      ];

      // Test with UTC results (since GMT timezone should normalize to UTC)
      basicCases.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second);
        let testName = `UnixDate-Basic Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test case-insensitive parsing
      let caseInsensitiveCases = [
        { input: 'TUE APR 01 05:17:59 GMT 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 },
        { input: 'tue apr 01 05:17:59 gmt 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 },
        { input: 'Tue Apr 01 05:17:59 gmt 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 },
        { input: 'tue APR 01 05:17:59 GMT 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 }
      ];

      caseInsensitiveCases.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second);
        let testName = `UnixDate-CaseInsensitive Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test with UTC timezone
      let utcCases = [
        { input: 'Tue Apr 01 05:17:59 UTC 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 },
        { input: 'Mon Jan 15 12:30:45 utc 2025', year: 2025, month: 0, day: 15, hour: 12, minute: 30, second: 45 }
      ];

      utcCases.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second);
        let testName = `UnixDate-UTC Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test with timezone offsets - these should convert to UTC correctly
      let offsetCases = [
        // +05:00 means 5 hours ahead of UTC, so UTC time is 5 hours earlier
        { input: 'Tue Apr 01 10:17:59 +0500 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 },
        // -05:00 means 5 hours behind UTC, so UTC time is 5 hours later
        { input: 'Tue Apr 01 00:17:59 -0500 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 },
        // +00:00 is same as GMT/UTC
        { input: 'Tue Apr 01 05:17:59 +0000 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 }
      ];

      offsetCases.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second);
        let testName = `UnixDate-Offset Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test all months
      let monthCases = [
        { input: 'Wed Jan 01 12:00:00 GMT 2025', year: 2025, month: 0, day: 1 },
        { input: 'Sat Feb 01 12:00:00 GMT 2025', year: 2025, month: 1, day: 1 },
        { input: 'Sat Mar 01 12:00:00 GMT 2025', year: 2025, month: 2, day: 1 },
        { input: 'Tue Apr 01 12:00:00 GMT 2025', year: 2025, month: 3, day: 1 },
        { input: 'Thu May 01 12:00:00 GMT 2025', year: 2025, month: 4, day: 1 },
        { input: 'Sun Jun 01 12:00:00 GMT 2025', year: 2025, month: 5, day: 1 },
        { input: 'Tue Jul 01 12:00:00 GMT 2025', year: 2025, month: 6, day: 1 },
        { input: 'Fri Aug 01 12:00:00 GMT 2025', year: 2025, month: 7, day: 1 },
        { input: 'Mon Sep 01 12:00:00 GMT 2025', year: 2025, month: 8, day: 1 },
        { input: 'Wed Oct 01 12:00:00 GMT 2025', year: 2025, month: 9, day: 1 },
        { input: 'Sat Nov 01 12:00:00 GMT 2025', year: 2025, month: 10, day: 1 },
        { input: 'Mon Dec 01 12:00:00 GMT 2025', year: 2025, month: 11, day: 1 }
      ];

      monthCases.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, 12, 0, 0);
        let testName = `UnixDate-Month Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test single digit day (should work with dayFlexible)
      let singleDigitDayCases = [
        { input: 'Tue Apr 1 05:17:59 GMT 2025', year: 2025, month: 3, day: 1, hour: 5, minute: 17, second: 59 },
        { input: 'Wed Jan 5 10:30:00 GMT 2025', year: 2025, month: 0, day: 5, hour: 10, minute: 30, second: 0 }
      ];

      singleDigitDayCases.forEach((testCase, i) => {
        let result = this.testParseDTUTCWithDetails(parser, testCase.input, testCase.year, testCase.month, testCase.day, testCase.hour, testCase.minute, testCase.second);
        let testName = `UnixDate-SingleDigitDay Test${i + 1}: ${testCase.input}`;
        if ( ! result.pass && result.message ) {
          testName += ` - ${result.message}`;
        }
        x.test(result.pass, testName);
      });

      // Test parseString (returns Date at noon UTC for date-only, or with time for datetime)
      let parseStringCases = [
        { input: 'Tue Apr 01 05:17:59 GMT 2025', year: 2025, month: 3, day: 1 }
      ];

      parseStringCases.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input);
          // parseString with time should keep time in local time
          let pass = result &&
                     result.getFullYear() === testCase.year &&
                     result.getMonth() === testCase.month &&
                     result.getDate() === testCase.day;
          x.test(pass, `UnixDate-parseString Test${i + 1}: ${testCase.input}`);
        } catch (e) {
          x.test(false, `UnixDate-parseString Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });

      // Test parseDateString (returns date only at noon UTC)
      parseStringCases.forEach((testCase, i) => {
        try {
          let result = parser.parseDateString(testCase.input);
          let pass = result &&
                     result.getUTCFullYear() === testCase.year &&
                     result.getUTCMonth() === testCase.month &&
                     result.getUTCDate() === testCase.day &&
                     result.getUTCHours() === 12;
          x.test(pass, `UnixDate-parseDateString Test${i + 1}: ${testCase.input}`);
        } catch (e) {
          x.test(false, `UnixDate-parseDateString Test${i + 1}: ${testCase.input} - ${e.message}`);
        }
      });
    },

    function testInvalidMonthNameValidation(x) {
      // Test invalid month name handling in both modes
      // Note: "XYZ" doesn't match the grammar's month pattern, so it fails at grammar level
      // and returns MAX_DATE (lenient) or throws (strict)
      let parser = this.DateParser.create();

      // Strict mode test
      parser.strictValidation = true;
      try {
        parser.parseString('15-XYZ-2025');
        x.test(false, 'StrictMode: invalid month name "XYZ" should throw');
      } catch (e) {
        // Grammar validation happens before parseMonthName, so we may get "Unsupported Date format"
        let validError = e.message.includes('Invalid month name') || e.message.includes('Unsupported Date format');
        x.test(validError, 'StrictMode: invalid month name throws error');
      }

      // Lenient mode test - returns MAX_DATE for unparseable input
      parser.strictValidation = false;
      let result = parser.parseString('15-XYZ-2025');
      x.test(result.getTime() === foam.Date.MAX_DATE.getTime(), 'LenientMode: unparseable returns MAX_DATE');
    },

    function testJulianDateFormats(x) {
      let parser = this.DateParser.create();

      // ============================================================
      // YYDDD format tests (5-digit: 2-digit year + 3-digit day of year)
      // ============================================================
      let yydddTestCases = [
        { input: '25216', year: 2025, month: 7, day: 4, desc: 'day 216 of 2025 = Aug 4, 2025' },
        { input: '24341', year: 2024, month: 11, day: 6, desc: 'day 341 of 2024 = Dec 6, 2024' },
        { input: '25001', year: 2025, month: 0, day: 1, desc: 'day 1 of 2025 = Jan 1, 2025' },
        { input: '25365', year: 2025, month: 11, day: 31, desc: 'day 365 of 2025 = Dec 31, 2025' },
        // 2-digit year pivot tests: 00-49 -> 2000-2049, 50-99 -> 1950-1999
        { input: '49365', year: 2049, month: 11, day: 31, desc: 'day 365 of 2049 (year pivot: 49 -> 2049)' },
        { input: '50001', year: 1950, month: 0, day: 1, desc: 'day 1 of 1950 (year pivot: 50 -> 1950)' }
      ];

      yydddTestCases.forEach((testCase, i) => {
        try {
          let result = parser.parseDateString(testCase.input, 'yyddd');
          if ( ! result || isNaN(result.getTime()) ) {
            x.test(false, `YYDDD Test${i + 1}: ${testCase.input} - ${testCase.desc}. Got: null/invalid`);
            return;
          }
          let actualYear = result.getUTCFullYear();
          let actualMonth = result.getUTCMonth();
          let actualDay = result.getUTCDate();
          let pass = actualYear === testCase.year &&
                     actualMonth === testCase.month &&
                     actualDay === testCase.day;
          if ( pass ) {
            x.test(true, `YYDDD Test${i + 1}: ${testCase.input} - ${testCase.desc}`);
          } else {
            x.test(false, `YYDDD Test${i + 1}: ${testCase.input} - Expected: ${testCase.year}-${testCase.month + 1}-${testCase.day}, Got: ${actualYear}-${actualMonth + 1}-${actualDay}`);
          }
        } catch (e) {
          x.test(false, `YYDDD Test${i + 1}: ${testCase.input} - Error: ${e.message}`);
        }
      });

      // ============================================================
      // YDDD format tests (4-digit: 1-digit year + 3-digit day of year)
      // Uses sliding window logic based on current year:
      //   decade = floor(currentYear / 10) * 10
      //   year = decade + oneDigitYear
      //   if year > currentYear + 5 then year = year - 10
      // ============================================================

      // Calculate expected years using sliding window
      let currentYear = new Date().getUTCFullYear();
      let decade = Math.floor(currentYear / 10) * 10;

      // Helper to calculate expected year for a single digit
      function calcExpectedYear(digit) {
        let yr = decade + digit;
        if ( yr > currentYear + 5 ) yr -= 10;
        return yr;
      }

      let expectedYear0 = calcExpectedYear(0);
      let expectedYear5 = calcExpectedYear(5);
      let expectedYear9 = calcExpectedYear(9);

      let ydddTestCases = [
        { input: '5216', year: expectedYear5, month: 7, day: 4, desc: `day 216 of ${expectedYear5} = Aug 4, ${expectedYear5} (year 5 = ${expectedYear5})` },
        { input: '0001', year: expectedYear0, month: 0, day: 1, desc: `day 1 of ${expectedYear0} = Jan 1, ${expectedYear0} (year 0 = ${expectedYear0})` },
        { input: '9365', year: expectedYear9, month: 11, day: 31, desc: `day 365 of ${expectedYear9} = Dec 31, ${expectedYear9} (year 9 = ${expectedYear9})` }
      ];

      ydddTestCases.forEach((testCase, i) => {
        try {
          let result = parser.parseDateString(testCase.input, 'yddd');
          if ( ! result || isNaN(result.getTime()) ) {
            x.test(false, `YDDD Test${i + 1}: ${testCase.input} - ${testCase.desc}. Got: null/invalid`);
            return;
          }
          let actualYear = result.getUTCFullYear();
          let actualMonth = result.getUTCMonth();
          let actualDay = result.getUTCDate();
          let pass = actualYear === testCase.year &&
                     actualMonth === testCase.month &&
                     actualDay === testCase.day;
          if ( pass ) {
            x.test(true, `YDDD Test${i + 1}: ${testCase.input} - ${testCase.desc}`);
          } else {
            x.test(false, `YDDD Test${i + 1}: ${testCase.input} - Expected: ${testCase.year}-${testCase.month + 1}-${testCase.day}, Got: ${actualYear}-${actualMonth + 1}-${actualDay}`);
          }
        } catch (e) {
          x.test(false, `YDDD Test${i + 1}: ${testCase.input} - Error: ${e.message}`);
        }
      });

      // ============================================================
      // Combined juliandate format tests (auto-detects 4 or 5 digit)
      // 5-digit: Uses fixed 2-digit year pivot (00-49 -> 2000-2049, 50-99 -> 1950-1999)
      // 4-digit: Uses sliding window based on current year
      // ============================================================
      let juliandateTestCases = [
        // 5-digit format (YYDDD) - uses fixed pivot
        { input: '25216', year: 2025, month: 7, day: 4, desc: '5-digit: day 216 of 2025 = Aug 4, 2025' },
        { input: '24341', year: 2024, month: 11, day: 6, desc: '5-digit: day 341 of 2024 = Dec 6, 2024' },
        { input: '25001', year: 2025, month: 0, day: 1, desc: '5-digit: day 1 of 2025 = Jan 1, 2025' },
        { input: '25365', year: 2025, month: 11, day: 31, desc: '5-digit: day 365 of 2025 = Dec 31, 2025' },
        // 4-digit format (YDDD) - uses sliding window (expectedYear vars calculated above)
        { input: '5216', year: expectedYear5, month: 7, day: 4, desc: `4-digit: day 216 of ${expectedYear5} = Aug 4, ${expectedYear5}` },
        { input: '0001', year: expectedYear0, month: 0, day: 1, desc: `4-digit: day 1 of ${expectedYear0} = Jan 1, ${expectedYear0}` },
        { input: '9365', year: expectedYear9, month: 11, day: 31, desc: `4-digit: day 365 of ${expectedYear9} = Dec 31, ${expectedYear9}` }
      ];

      juliandateTestCases.forEach((testCase, i) => {
        try {
          let result = parser.parseDateString(testCase.input, 'juliandate');
          if ( ! result || isNaN(result.getTime()) ) {
            x.test(false, `JulianDate Test${i + 1}: ${testCase.input} - ${testCase.desc}. Got: null/invalid`);
            return;
          }
          let actualYear = result.getUTCFullYear();
          let actualMonth = result.getUTCMonth();
          let actualDay = result.getUTCDate();
          let pass = actualYear === testCase.year &&
                     actualMonth === testCase.month &&
                     actualDay === testCase.day;
          if ( pass ) {
            x.test(true, `JulianDate Test${i + 1}: ${testCase.input} - ${testCase.desc}`);
          } else {
            x.test(false, `JulianDate Test${i + 1}: ${testCase.input} - Expected: ${testCase.year}-${testCase.month + 1}-${testCase.day}, Got: ${actualYear}-${actualMonth + 1}-${actualDay}`);
          }
        } catch (e) {
          x.test(false, `JulianDate Test${i + 1}: ${testCase.input} - Error: ${e.message}`);
        }
      });
    }
  ]
});
