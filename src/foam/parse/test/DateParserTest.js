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
      this.testYYMMDDFormats(x);
      this.testDDMMYYYYFormats(x);
      this.testDateTimeFormats(x);
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
      this.testYYMMDDSepTimeFormat(x);
    },

    function testYYYYMMDDFormats(x) {
      let parser = this.DateParser.create();

      // YYYYMMDD formats (with separators)
      let yyyymmddSep = [
        { input: '2025-01-15', year: 2025, month: 0, day: 15 },
        { input: '2025/01/15', year: 2025, month: 0, day: 15 },
        { input: '2024-12-31', year: 2024, month: 11, day: 31 },
        { input: '2000-02-29', year: 2000, month: 1, day: 29 }, // Leap year
        { input: '1999-01-01', year: 1999, month: 0, day: 1 }
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
    },

    function testMMDDYYYYFormats(x) {
      let parser = this.DateParser.create();

      // MMDDYYYY formats (with separators)
      let mmddyyyySep = [
        { input: '01/15/2025', year: 2025, month: 0, day: 15 },
        { input: '01-15-2025', year: 2025, month: 0, day: 15 },
        { input: '12/31/2024', year: 2024, month: 11, day: 31 },
        { input: '02/29/2000', year: 2000, month: 1, day: 29 }
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
    },

    function testYYMMDDFormats(x) {
      let parser = this.DateParser.create();

      // YYMMDD formats (with separators)
      let yymmddSep = [
        { input: '25/01/15', year: 2025, month: 0, day: 15 },
        { input: '25-01-15', year: 2025, month: 0, day: 15 },
        { input: '00/02/29', year: 2000, month: 1, day: 29 }
      ];

      // Test YYMMDD with separators
      yymmddSep.forEach((testCase, i) => {
        x.test(
          this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
          `YYMMDD-Sep Test${i + 1}: ${testCase.input}`
        );
      });

      // YYMMDD compact (6 digits)
      let yymmddCompact = [
        { input: '250115', year: 2025, month: 0, day: 15 },
        { input: '000229', year: 2000, month: 1, day: 29 }
      ];

      // Test YYMMDD compact
      yymmddCompact.forEach((testCase, i) => {
        x.test(
          this.testParseDate(parser, testCase.input, testCase.year, testCase.month, testCase.day),
          `YYMMDD-Compact Test${i + 1}: ${testCase.input}`
        );
      });
    },

    function testDDMMYYYYFormats(x) {
      let parser = this.DateParser.create();

      // Test DDMMYYYY with separators - requires opt_name='ddmmyyyy'
      let ddmmyyyySep = [
        { input: '15/01/2025', year: 2025, month: 0, day: 15 },
        { input: '15-01-2025', year: 2025, month: 0, day: 15 },
        { input: '31/12/2024', year: 2024, month: 11, day: 31 },
        { input: '29/02/2000', year: 2000, month: 1, day: 29 }
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

      // Test DDMMYYYY with time - requires opt_name='ddmmyyyy'
      let ddmmyyyyTime = [
        { input: '15/01/2025 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '15-01-2025 09:15', year: 2025, month: 0, day: 15, hour: 9, minute: 15, second: 0 }
      ];

      ddmmyyyyTime.forEach((testCase, i) => {
        try {
          let result = parser.parseString(testCase.input, 'ddmmyyyy');
          let pass = result &&
                     result.getFullYear() === testCase.year &&
                     result.getMonth() === testCase.month &&
                     result.getDate() === testCase.day &&
                     result.getHours() === testCase.hour &&
                     result.getMinutes() === testCase.minute &&
                     result.getSeconds() === testCase.second;
          x.test(pass, `DDMMYYYY-Time Test${i + 1}: ${testCase.input} (opt_name='ddmmyyyy')`);
        } catch (e) {
          x.test(false, `DDMMYYYY-Time Test${i + 1}: ${testCase.input} - ${e.message}`);
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

    function testParseDateString(x) {
      let parser = this.DateParser.create();

      // parseDateString should ignore time and return date at noon local time
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
                     result.getFullYear() === testCase.year &&
                     result.getMonth() === testCase.month &&
                     result.getDate() === testCase.day &&
                     result.getHours() === 12 && // Should be noon local time
                     result.getMinutes() === 0 &&
                     result.getSeconds() === 0;
          x.test(pass, `parseDateString Test${i + 1}: ${testCase.input} (ignores time, returns noon local)`);
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

      // Test that parser returns MAX_DATE for truly unparseable inputs
      let invalidInputs = [
        'invalid-date',
        '99/99/99',
        '',
        'notadate'
      ];

      invalidInputs.forEach((input, i) => {
        try {
          let result = parser.parseString(input);
          let isMaxDate = result && result.getTime() === foam.Date.MAX_DATE.getTime();
          x.test(isMaxDate, `Validation Test${i + 1}: "${input}" should return MAX_DATE (invalid)`);
        } catch (e) {
          x.test(false, `Validation Test${i + 1}: "${input}" - ${e.message}`);
        }
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

    function testYYMMDDSepTimeFormat(x) {
      let parser = this.DateParser.create();

      // Test YYMMDD with separators and time (YY-MM-DD HH:MM:SS)
      let testCases = [
        // Basic formats with dash separator
        { input: '24-03-15 14:30:45', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '25-01-15 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },

        // Slash separator
        { input: '24/03/15 14:30:45', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '25/01/15 14:30:45', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },

        // Year >= 50 should be 1900s
        { input: '99-03-15 14:30:45', year: 1999, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '50-06-30 12:00:00', year: 1950, month: 5, day: 30, hour: 12, minute: 0, second: 0 },
        { input: '75-12-25 23:59:59', year: 1975, month: 11, day: 25, hour: 23, minute: 59, second: 59 },

        // Year < 50 should be 2000s
        { input: '49-03-15 14:30:45', year: 2049, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '00-01-01 00:00:00', year: 2000, month: 0, day: 1, hour: 0, minute: 0, second: 0 },
        { input: '25-12-31 23:59:59', year: 2025, month: 11, day: 31, hour: 23, minute: 59, second: 59 },

        // Without seconds (HH:MM only)
        { input: '24-03-15 14:30', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 0 },
        { input: '25/01/15 09:45', year: 2025, month: 0, day: 15, hour: 9, minute: 45, second: 0 },

        // Edge cases
        { input: '24-02-29 12:00:00', year: 2024, month: 1, day: 29, hour: 12, minute: 0, second: 0 }, // Leap year
        { input: '25-02-28 12:00:00', year: 2025, month: 1, day: 28, hour: 12, minute: 0, second: 0 }, // Non-leap Feb
        { input: '24-01-01 00:00:00', year: 2024, month: 0, day: 1, hour: 0, minute: 0, second: 0 },   // Midnight
        { input: '24-12-31 23:59:59', year: 2024, month: 11, day: 31, hour: 23, minute: 59, second: 59 } // End of day
      ];

      testCases.forEach((tc, i) => {
        x.test(
          this.testParseDT(parser, tc.input, tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `YYMMDD-Sep-Time Test${i + 1}: ${tc.input}`
        );
      });

      // Test with timezone indicators
      let timezoneCases = [
        { input: '24-03-15 14:30:45Z', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '25-01-15 14:30:45Z', year: 2025, month: 0, day: 15, hour: 14, minute: 30, second: 45 },
        { input: '24/03/15 14:30:45Z', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },

        // Positive timezone offsets
        { input: '24-03-15 14:30:45+05:30', year: 2024, month: 2, day: 15, hour: 9, minute: 0, second: 45 },
        { input: '25-01-15 14:30:45+01:00', year: 2025, month: 0, day: 15, hour: 13, minute: 30, second: 45 },
        { input: '24/03/15 14:30:45+09:00', year: 2024, month: 2, day: 15, hour: 5, minute: 30, second: 45 },

        // Negative timezone offsets
        { input: '24-03-15 14:30:45-08:00', year: 2024, month: 2, day: 15, hour: 22, minute: 30, second: 45 },
        { input: '25-01-15 14:30:45-05:00', year: 2025, month: 0, day: 15, hour: 19, minute: 30, second: 45 },
        { input: '24/03/15 14:30:45-07:00', year: 2024, month: 2, day: 15, hour: 21, minute: 30, second: 45 },

        // With minutes only + timezone
        { input: '24-03-15 14:30+05:30', year: 2024, month: 2, day: 15, hour: 9, minute: 0, second: 0 },
        { input: '25-01-15 14:30-08:00', year: 2025, month: 0, day: 15, hour: 22, minute: 30, second: 0 },
        { input: '24/03/15 14:30Z', year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 0 },

        // Compact timezone format (+HHMM)
        { input: '24-03-15 14:30:45+0530', year: 2024, month: 2, day: 15, hour: 9, minute: 0, second: 45 },
        { input: '25-01-15 14:30:45-0800', year: 2025, month: 0, day: 15, hour: 22, minute: 30, second: 45 }
      ];

      timezoneCases.forEach((tc, i) => {
        x.test(
          this.testDateTime(parser.parseDateTime(tc.input), tc.year, tc.month, tc.day, tc.hour, tc.minute, tc.second),
          `YYMMDD-Sep-Timezone Test${i + 1}: ${tc.input}`
        );
      });
    },

    // Helper functions
    function testParseDate(parser, dateStr, expectedYear, expectedMonth, expectedDay) {
      try {
        let result = parser.parseString(dateStr);
        if ( ! result ) return false;

        return result.getUTCFullYear() === expectedYear &&
               result.getUTCMonth() === expectedMonth &&
               result.getUTCDate() === expectedDay &&
               result.getUTCHours() === 12; // Date-only formats should be noon GMT
      } catch (e) {
        console.error(`Parse error for ${dateStr}:`, e);
        return false;
      }
    },

    function testParseDT(parser, dateStr, expectedYear, expectedMonth, expectedDay,
                         expectedHour, expectedMinute, expectedSecond, expectedMs) {
      try {
        let result = parser.parseString(dateStr);
        if ( ! result ) return false;

        expectedHour = expectedHour || 0;
        expectedMinute = expectedMinute || 0;
        expectedSecond = expectedSecond || 0;
        expectedMs = expectedMs || 0;

        return result.getFullYear() === expectedYear &&
               result.getMonth() === expectedMonth &&
               result.getDate() === expectedDay &&
               result.getHours() === expectedHour &&
               result.getMinutes() === expectedMinute &&
               result.getSeconds() === expectedSecond &&
               result.getMilliseconds() === expectedMs;
      } catch (e) {
        console.error(`Parse datetime error for ${dateStr}:`, e);
        return false;
      }
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
    }
  ]
});
