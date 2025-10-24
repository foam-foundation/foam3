/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'DateTimeUTCTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Tests for DateTimeUTC property adapt behavior',

  requires: [
    'foam.lang.test.DateTimeTestModel'
  ],

  imports: [
    'dateTimeTestDAO?'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        this.testAdaptStringDates(x);
        this.testAdaptStringDateTimes(x);
        this.testAdaptNumbers(x);
        this.testAdaptDateObjects(x);
        this.testAdaptNullUndefined(x);
        this.testTimePreservation(x);
        this.testEdgeCases(x);
        this.testTimezoneZ(x);
        this.testTimezonePositiveOffset(x);
        this.testTimezoneNegativeOffset(x);
        this.testTimezoneVariousOffsets(x);
        this.testTimezoneDateBoundaries(x);
        await this.testDAOPutAndFind(x);
        await this.testDAOQuery(x);
      }
    },

    {
      name: 'testAdaptStringDates',
      code: function(x) {
        // Test DateTimeUTC property adapting string dates (date-only, no time)
        var model = this.DateTimeTestModel.create();

        var stringDates = [
          { input: "2024-03-15", year: 2024, month: 2, day: 15, desc: "YYYY-MM-DD" },
          { input: "2024/03/15", year: 2024, month: 2, day: 15, desc: "YYYY/MM/DD" },
          { input: "20240315", year: 2024, month: 2, day: 15, desc: "YYYYMMDD" },
          { input: "03-15-2024", year: 2024, month: 2, day: 15, desc: "MM-DD-YYYY" },
          { input: "03/15/2024", year: 2024, month: 2, day: 15, desc: "MM/DD/YYYY" },
          { input: "03152024", year: 2024, month: 2, day: 15, desc: "MMDDYYYY" }
        ];

        stringDates.forEach(function(testCase) {
          model.utcDateTime = testCase.input;
          x.test( model.utcDateTime != null, testCase.desc + ": Should adapt " + testCase.input );
          x.test( model.utcDateTime.getUTCFullYear() === testCase.year,
                  testCase.desc + ": Year should be " + testCase.year );
          x.test( model.utcDateTime.getUTCMonth() === testCase.month,
                  testCase.desc + ": Month should be " + testCase.month );
          x.test( model.utcDateTime.getUTCDate() === testCase.day,
                  testCase.desc + ": Day should be " + testCase.day );
          // Date-only strings should set time to midnight
          x.test( model.utcDateTime.getUTCHours() === 0,
                  testCase.desc + ": Hours should be 0 (midnight)" );
          x.test( model.utcDateTime.getUTCMinutes() === 0,
                  testCase.desc + ": Minutes should be 0" );
          x.test( model.utcDateTime.getUTCSeconds() === 0,
                  testCase.desc + ": Seconds should be 0" );
        });
      }
    },

    {
      name: 'testAdaptStringDateTimes',
      code: function(x) {
        // Test DateTimeUTC property adapting string datetimes (with time components)
        var model = this.DateTimeTestModel.create();

        var stringDateTimes = [
          { input: "2024-03-15T15:30:45", year: 2024, month: 2, day: 15, hour: 15, minute: 30, second: 45, desc: "ISO format" },
          { input: "2024-03-15 15:30:45", year: 2024, month: 2, day: 15, hour: 15, minute: 30, second: 45, desc: "Space separator" },
          { input: "03/15/2024 14:20:10", year: 2024, month: 2, day: 15, hour: 14, minute: 20, second: 10, desc: "MM/DD/YYYY HH:MM:SS" },
          { input: "2024-03-15T08:00:00", year: 2024, month: 2, day: 15, hour: 8, minute: 0, second: 0, desc: "Morning time" }
        ];

        stringDateTimes.forEach(function(testCase) {
          model.utcDateTime = testCase.input;
          x.test( model.utcDateTime != null, testCase.desc + ": Should adapt " + testCase.input );
          x.test( model.utcDateTime.getUTCFullYear() === testCase.year,
                  testCase.desc + ": Year should be " + testCase.year );
          x.test( model.utcDateTime.getUTCMonth() === testCase.month,
                  testCase.desc + ": Month should be " + testCase.month );
          x.test( model.utcDateTime.getUTCDate() === testCase.day,
                  testCase.desc + ": Day should be " + testCase.day );
          x.test( model.utcDateTime.getUTCHours() === testCase.hour,
                  testCase.desc + ": Hour should be " + testCase.hour );
          x.test( model.utcDateTime.getUTCMinutes() === testCase.minute,
                  testCase.desc + ": Minute should be " + testCase.minute );
          x.test( model.utcDateTime.getUTCSeconds() === testCase.second,
                  testCase.desc + ": Second should be " + testCase.second );
        });
      }
    },

    {
      name: 'testAdaptNumbers',
      code: function(x) {
        // Test DateTimeUTC property adapting number timestamps
        var model = this.DateTimeTestModel.create();

        var timestamps = [
          { input: 1710460800000, year: 2024, month: 2, day: 15, hour: 0, minute: 0, second: 0, desc: "Timestamp 2024-03-15 00:00:00 UTC" },
          { input: 1710483000000, year: 2024, month: 2, day: 15, hour: 6, minute: 10, second: 0, desc: "Timestamp 2024-03-15 06:10:00 UTC" },
          { input: 1710526245000, year: 2024, month: 2, day: 15, hour: 18, minute: 10, second: 45, desc: "Timestamp 2024-03-15 18:10:45 UTC" }
        ];

        timestamps.forEach(function(testCase) {
          model.utcDateTime = testCase.input;
          x.test( model.utcDateTime != null, testCase.desc + ": Should adapt timestamp" );
          x.test( model.utcDateTime.getTime() === testCase.input,
                  testCase.desc + ": Timestamp should be preserved exactly" );
          x.test( model.utcDateTime.getUTCFullYear() === testCase.year,
                  testCase.desc + ": Year should be " + testCase.year );
          x.test( model.utcDateTime.getUTCMonth() === testCase.month,
                  testCase.desc + ": Month should be " + testCase.month );
          x.test( model.utcDateTime.getUTCDate() === testCase.day,
                  testCase.desc + ": Day should be " + testCase.day );
          x.test( model.utcDateTime.getUTCHours() === testCase.hour,
                  testCase.desc + ": Hour should be " + testCase.hour );
          x.test( model.utcDateTime.getUTCMinutes() === testCase.minute,
                  testCase.desc + ": Minute should be " + testCase.minute );
          x.test( model.utcDateTime.getUTCSeconds() === testCase.second,
                  testCase.desc + ": Second should be " + testCase.second );
        });
      }
    },

    {
      name: 'testAdaptDateObjects',
      code: function(x) {
        // Test DateTimeUTC property adapting Date objects
        var model = this.DateTimeTestModel.create();

        var dateObjects = [
          { date: new Date(Date.UTC(2024, 2, 15, 0, 0, 0, 0)), year: 2024, month: 2, day: 15, hour: 0, minute: 0, second: 0, desc: "Midnight UTC" },
          { date: new Date(Date.UTC(2024, 2, 15, 14, 30, 45, 0)), year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45, desc: "Afternoon UTC" },
          { date: new Date(Date.UTC(2024, 2, 15, 23, 59, 59, 0)), year: 2024, month: 2, day: 15, hour: 23, minute: 59, second: 59, desc: "End of day UTC" }
        ];

        dateObjects.forEach(function(testCase) {
          var originalTimestamp = testCase.date.getTime();
          model.utcDateTime = testCase.date;

          x.test( model.utcDateTime != null, testCase.desc + ": Should adapt Date object" );
          x.test( model.utcDateTime.getTime() === originalTimestamp,
                  testCase.desc + ": Timestamp should be preserved exactly" );
          x.test( model.utcDateTime.getUTCFullYear() === testCase.year,
                  testCase.desc + ": Year should be " + testCase.year );
          x.test( model.utcDateTime.getUTCMonth() === testCase.month,
                  testCase.desc + ": Month should be " + testCase.month );
          x.test( model.utcDateTime.getUTCDate() === testCase.day,
                  testCase.desc + ": Day should be " + testCase.day );
          x.test( model.utcDateTime.getUTCHours() === testCase.hour,
                  testCase.desc + ": Hour should be " + testCase.hour );
          x.test( model.utcDateTime.getUTCMinutes() === testCase.minute,
                  testCase.desc + ": Minute should be " + testCase.minute );
          x.test( model.utcDateTime.getUTCSeconds() === testCase.second,
                  testCase.desc + ": Second should be " + testCase.second );
        });
      }
    },

    {
      name: 'testAdaptNullUndefined',
      code: function(x) {
        // Test DateTimeUTC property handling null/undefined
        var model = this.DateTimeTestModel.create();

        // Test null
        model.utcDateTime = null;
        x.test( model.utcDateTime == null, "Null input should result in null" );

        // Test undefined
        model.utcDateTime = undefined;
        x.test( model.utcDateTime == null, "Undefined input should result in null" );

        // Verify we can still set a valid value after null/undefined
        model.utcDateTime = "2024-03-15";
        x.test( model.utcDateTime != null, "Should be able to set value after null" );
        x.test( model.utcDateTime.getUTCFullYear() === 2024, "Value should be correct after null" );
      }
    },

    {
      name: 'testTimePreservation',
      code: function(x) {
        // Test that DateTimeUTC preserves time components (doesn't normalize to noon)
        var model = this.DateTimeTestModel.create();

        // Test various times throughout the day
        var times = [
          { input: "2024-03-15T00:00:00", hour: 0, minute: 0, second: 0, desc: "Midnight" },
          { input: "2024-03-15T06:30:15", hour: 6, minute: 30, second: 15, desc: "Morning" },
          { input: "2024-03-15T12:00:00", hour: 12, minute: 0, second: 0, desc: "Noon" },
          { input: "2024-03-15T18:45:30", hour: 18, minute: 45, second: 30, desc: "Evening" },
          { input: "2024-03-15T23:59:59", hour: 23, minute: 59, second: 59, desc: "End of day" }
        ];

        times.forEach(function(testCase) {
          model.utcDateTime = testCase.input;
          x.test( model.utcDateTime.getUTCHours() === testCase.hour,
                  testCase.desc + ": Hour should be preserved as " + testCase.hour );
          x.test( model.utcDateTime.getUTCMinutes() === testCase.minute,
                  testCase.desc + ": Minute should be preserved as " + testCase.minute );
          x.test( model.utcDateTime.getUTCSeconds() === testCase.second,
                  testCase.desc + ": Second should be preserved as " + testCase.second );
        });
      }
    },

    {
      name: 'testEdgeCases',
      code: function(x) {
        // Test edge cases and boundary conditions
        var model = this.DateTimeTestModel.create();

        // Leap year date
        model.utcDateTime = "2024-02-29";
        x.test( model.utcDateTime != null, "Should handle leap year date" );
        x.test( model.utcDateTime.getUTCMonth() === 1, "Leap year: Month should be February (1)" );
        x.test( model.utcDateTime.getUTCDate() === 29, "Leap year: Day should be 29" );

        // Year boundaries
        model.utcDateTime = "2024-01-01";
        x.test( model.utcDateTime != null, "Should handle year start" );
        x.test( model.utcDateTime.getUTCMonth() === 0, "Year start: Month should be 0" );
        x.test( model.utcDateTime.getUTCDate() === 1, "Year start: Day should be 1" );

        model.utcDateTime = "2024-12-31";
        x.test( model.utcDateTime != null, "Should handle year end" );
        x.test( model.utcDateTime.getUTCMonth() === 11, "Year end: Month should be 11" );
        x.test( model.utcDateTime.getUTCDate() === 31, "Year end: Day should be 31" );

        // Two-digit year pivot (< 50 = 2000s, >= 50 = 1900s)
        model.utcDateTime = "25/03/15";
        x.test( model.utcDateTime.getUTCFullYear() === 2025, "Year 25 should be 2025" );

        model.utcDateTime = "99/03/15";
        x.test( model.utcDateTime.getUTCFullYear() === 1999, "Year 99 should be 1999" );

        // Month boundaries
        model.utcDateTime = "2024-04-30"; // 30-day month
        x.test( model.utcDateTime.getUTCDate() === 30, "Should handle 30-day month" );

        model.utcDateTime = "2024-07-31"; // 31-day month
        x.test( model.utcDateTime.getUTCDate() === 31, "Should handle 31-day month" );

        // Time boundaries
        model.utcDateTime = "2024-03-15T00:00:00";
        x.test( model.utcDateTime.getUTCHours() === 0, "Should handle midnight hour" );

        model.utcDateTime = "2024-03-15T23:59:59";
        x.test( model.utcDateTime.getUTCHours() === 23, "Should handle last hour of day" );
        x.test( model.utcDateTime.getUTCMinutes() === 59, "Should handle last minute" );
        x.test( model.utcDateTime.getUTCSeconds() === 59, "Should handle last second" );
      }
    },

    {
      name: 'testTimezoneZ',
      code: function(x) {
        // Test "Z" timezone indicator (UTC/Zulu time)
        var model = this.DateTimeTestModel.create();

        var testCases = [
          { input: "2024-03-15T15:30:45Z", year: 2024, month: 2, day: 15, hour: 15, minute: 30, second: 45 },
          { input: "2024-03-15T00:00:00Z", year: 2024, month: 2, day: 15, hour: 0, minute: 0, second: 0 },
          { input: "2024-03-15T23:59:59Z", year: 2024, month: 2, day: 15, hour: 23, minute: 59, second: 59 },
          { input: "2024-01-01T12:00:00Z", year: 2024, month: 0, day: 1, hour: 12, minute: 0, second: 0 },
          { input: "2024-12-31T18:30:00Z", year: 2024, month: 11, day: 31, hour: 18, minute: 30, second: 0 }
        ];

        testCases.forEach(function(tc) {
          model.utcDateTime = tc.input;
          var year = model.utcDateTime.getUTCFullYear();
          var month = model.utcDateTime.getUTCMonth();
          var day = model.utcDateTime.getUTCDate();
          var hour = model.utcDateTime.getUTCHours();
          var minute = model.utcDateTime.getUTCMinutes();
          var second = model.utcDateTime.getUTCSeconds();

          x.test( year === tc.year, tc.input + ": Year should be " + tc.year + " (got " + year + ")" );
          x.test( month === tc.month, tc.input + ": Month should be " + tc.month + " (got " + month + ")" );
          x.test( day === tc.day, tc.input + ": Day should be " + tc.day + " (got " + day + ")" );
          x.test( hour === tc.hour, tc.input + ": Hour should be " + tc.hour + " (got " + hour + ")" );
          x.test( minute === tc.minute, tc.input + ": Minute should be " + tc.minute + " (got " + minute + ")" );
          x.test( second === tc.second, tc.input + ": Second should be " + tc.second + " (got " + second + ")" );
        });
      }
    },

    {
      name: 'testTimezonePositiveOffset',
      code: function(x) {
        // Test positive timezone offsets (e.g., +05:30, +08:00)
        var model = this.DateTimeTestModel.create();

        var testCases = [
          // 2024-03-15T15:30:45+05:30 -> 2024-03-15 10:00:45 UTC
          { input: "2024-03-15T15:30:45+05:30", year: 2024, month: 2, day: 15, hour: 10, minute: 0, second: 45 },
          // 2024-03-15T08:00:00+08:00 -> 2024-03-15 00:00:00 UTC
          { input: "2024-03-15T08:00:00+08:00", year: 2024, month: 2, day: 15, hour: 0, minute: 0, second: 0 },
          // 2024-03-15T14:30:00+01:00 -> 2024-03-15 13:30:00 UTC
          { input: "2024-03-15T14:30:00+01:00", year: 2024, month: 2, day: 15, hour: 13, minute: 30, second: 0 },
          // 2024-03-15T23:00:00+02:00 -> 2024-03-15 21:00:00 UTC
          { input: "2024-03-15T23:00:00+02:00", year: 2024, month: 2, day: 15, hour: 21, minute: 0, second: 0 }
        ];

        testCases.forEach(function(tc) {
          model.utcDateTime = tc.input;
          var year = model.utcDateTime.getUTCFullYear();
          var month = model.utcDateTime.getUTCMonth();
          var day = model.utcDateTime.getUTCDate();
          var hour = model.utcDateTime.getUTCHours();
          var minute = model.utcDateTime.getUTCMinutes();
          var second = model.utcDateTime.getUTCSeconds();

          x.test( year === tc.year, tc.input + ": Year should be " + tc.year + " (got " + year + ")" );
          x.test( month === tc.month, tc.input + ": Month should be " + tc.month + " (got " + month + ")" );
          x.test( day === tc.day, tc.input + ": Day should be " + tc.day + " (got " + day + ")" );
          x.test( hour === tc.hour, tc.input + ": Hour should be " + tc.hour + " (got " + hour + ")" );
          x.test( minute === tc.minute, tc.input + ": Minute should be " + tc.minute + " (got " + minute + ")" );
          x.test( second === tc.second, tc.input + ": Second should be " + tc.second + " (got " + second + ")" );
        });
      }
    },

    {
      name: 'testTimezoneNegativeOffset',
      code: function(x) {
        // Test negative timezone offsets (e.g., -08:00, -05:00)
        var model = this.DateTimeTestModel.create();

        var testCases = [
          // 2024-03-15T15:30:45-08:00 -> 2024-03-15 23:30:45 UTC
          { input: "2024-03-15T15:30:45-08:00", year: 2024, month: 2, day: 15, hour: 23, minute: 30, second: 45 },
          // 2024-03-15T10:00:00-05:00 -> 2024-03-15 15:00:00 UTC
          { input: "2024-03-15T10:00:00-05:00", year: 2024, month: 2, day: 15, hour: 15, minute: 0, second: 0 },
          // 2024-03-15T14:30:00-03:00 -> 2024-03-15 17:30:00 UTC
          { input: "2024-03-15T14:30:00-03:00", year: 2024, month: 2, day: 15, hour: 17, minute: 30, second: 0 },
          // 2024-03-15T08:00:00-07:00 -> 2024-03-15 15:00:00 UTC
          { input: "2024-03-15T08:00:00-07:00", year: 2024, month: 2, day: 15, hour: 15, minute: 0, second: 0 }
        ];

        testCases.forEach(function(tc) {
          model.utcDateTime = tc.input;
          var year = model.utcDateTime.getUTCFullYear();
          var month = model.utcDateTime.getUTCMonth();
          var day = model.utcDateTime.getUTCDate();
          var hour = model.utcDateTime.getUTCHours();
          var minute = model.utcDateTime.getUTCMinutes();
          var second = model.utcDateTime.getUTCSeconds();

          x.test( year === tc.year, tc.input + ": Year should be " + tc.year + " (got " + year + ")" );
          x.test( month === tc.month, tc.input + ": Month should be " + tc.month + " (got " + month + ")" );
          x.test( day === tc.day, tc.input + ": Day should be " + tc.day + " (got " + day + ")" );
          x.test( hour === tc.hour, tc.input + ": Hour should be " + tc.hour + " (got " + hour + ")" );
          x.test( minute === tc.minute, tc.input + ": Minute should be " + tc.minute + " (got " + minute + ")" );
          x.test( second === tc.second, tc.input + ": Second should be " + tc.second + " (got " + second + ")" );
        });
      }
    },

    {
      name: 'testTimezoneVariousOffsets',
      code: function(x) {
        // Test multiple timezone offsets including edge cases
        var model = this.DateTimeTestModel.create();

        var testCases = [
          // +00:00 (same as Z)
          { input: "2024-03-15T15:30:45+00:00", year: 2024, month: 2, day: 15, hour: 15, minute: 30, second: 45 },
          // +01:00 (CET)
          { input: "2024-03-15T15:30:45+01:00", year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
          // +12:00 (New Zealand)
          { input: "2024-03-15T15:30:45+12:00", year: 2024, month: 2, day: 15, hour: 3, minute: 30, second: 45 },
          // -05:00 (EST)
          { input: "2024-03-15T15:30:45-05:00", year: 2024, month: 2, day: 15, hour: 20, minute: 30, second: 45 },
          // -11:00 (Pacific/Samoa)
          { input: "2024-03-15T15:30:45-11:00", year: 2024, month: 2, day: 16, hour: 2, minute: 30, second: 45 },
          // +09:30 (Australia/Adelaide)
          { input: "2024-03-15T15:30:45+09:30", year: 2024, month: 2, day: 15, hour: 6, minute: 0, second: 45 },
          // -03:30 (Newfoundland)
          { input: "2024-03-15T15:30:45-03:30", year: 2024, month: 2, day: 15, hour: 19, minute: 0, second: 45 }
        ];

        testCases.forEach(function(tc) {
          model.utcDateTime = tc.input;
          var year = model.utcDateTime.getUTCFullYear();
          var month = model.utcDateTime.getUTCMonth();
          var day = model.utcDateTime.getUTCDate();
          var hour = model.utcDateTime.getUTCHours();
          var minute = model.utcDateTime.getUTCMinutes();
          var second = model.utcDateTime.getUTCSeconds();

          x.test( year === tc.year, tc.input + ": Year should be " + tc.year + " (got " + year + ")" );
          x.test( month === tc.month, tc.input + ": Month should be " + tc.month + " (got " + month + ")" );
          x.test( day === tc.day, tc.input + ": Day should be " + tc.day + " (got " + day + ")" );
          x.test( hour === tc.hour, tc.input + ": Hour should be " + tc.hour + " (got " + hour + ")" );
          x.test( minute === tc.minute, tc.input + ": Minute should be " + tc.minute + " (got " + minute + ")" );
          x.test( second === tc.second, tc.input + ": Second should be " + tc.second + " (got " + second + ")" );
        });
      }
    },

    {
      name: 'testTimezoneDateBoundaries',
      code: function(x) {
        // Test timezone offsets that cross date boundaries
        var model = this.DateTimeTestModel.create();

        var testCases = [
          // Early morning with negative offset - stays same day
          { input: "2024-03-15T01:30:45-08:00", year: 2024, month: 2, day: 15, hour: 9, minute: 30, second: 45 },
          // Late night with positive offset - goes to previous day
          { input: "2024-03-15T23:30:45+05:30", year: 2024, month: 2, day: 15, hour: 18, minute: 0, second: 45 },
          // Midnight with positive offset - goes to previous day
          { input: "2024-03-15T00:30:00+08:00", year: 2024, month: 2, day: 14, hour: 16, minute: 30, second: 0 },
          // Late evening with negative offset - goes to next day
          { input: "2024-03-15T22:00:00-03:00", year: 2024, month: 2, day: 16, hour: 1, minute: 0, second: 0 },
          // End of month boundary
          { input: "2024-03-31T23:30:00+05:00", year: 2024, month: 2, day: 31, hour: 18, minute: 30, second: 0 },
          // Month boundary crossing (March to April)
          { input: "2024-03-31T23:30:00-02:00", year: 2024, month: 3, day: 1, hour: 1, minute: 30, second: 0 },
          // Year boundary crossing (Dec 31 to Jan 1)
          { input: "2024-12-31T23:30:00-02:00", year: 2025, month: 0, day: 1, hour: 1, minute: 30, second: 0 },
          // Year boundary crossing (Jan 1 to Dec 31)
          { input: "2024-01-01T00:30:00+02:00", year: 2023, month: 11, day: 31, hour: 22, minute: 30, second: 0 }
        ];

        testCases.forEach(function(tc) {
          model.utcDateTime = tc.input;
          var year = model.utcDateTime.getUTCFullYear();
          var month = model.utcDateTime.getUTCMonth();
          var day = model.utcDateTime.getUTCDate();
          var hour = model.utcDateTime.getUTCHours();
          var minute = model.utcDateTime.getUTCMinutes();
          var second = model.utcDateTime.getUTCSeconds();

          x.test( year === tc.year, tc.input + ": Year should be " + tc.year + " (got " + year + ")" );
          x.test( month === tc.month, tc.input + ": Month should be " + tc.month + " (got " + month + ")" );
          x.test( day === tc.day, tc.input + ": Day should be " + tc.day + " (got " + day + ")" );
          x.test( hour === tc.hour, tc.input + ": Hour should be " + tc.hour + " (got " + hour + ")" );
          x.test( minute === tc.minute, tc.input + ": Minute should be " + tc.minute + " (got " + minute + ")" );
          x.test( second === tc.second, tc.input + ": Second should be " + tc.second + " (got " + second + ")" );
        });
      }
    },

    {
      name: 'testDAOPutAndFind',
      code: async function(x) {
        // Test DAO operations - putting and retrieving objects with DateTimeUTC properties
        if ( ! this.dateTimeTestDAO ) {
          console.log("Skipping DAO tests - dateTimeTestDAO not available");
          return;
        }

        // Clear DAO first to ensure clean state
        await this.dateTimeTestDAO.removeAll();

        var model = this.DateTimeTestModel.create({
          id: 1,
          eventName: "Test Event 1",
          utcDateTime: "2024-03-15T15:30:45Z",
          regularDateTime: "2024-03-15T15:30:45",
          regularDate: "2024-03-15"
        });

        // Put into DAO
        await this.dateTimeTestDAO.put(model);

        // Find from DAO
        var found = await this.dateTimeTestDAO.find(1);

        x.test( found != null, "DAO: Should find saved object" );
        x.test( found.eventName === "Test Event 1", "DAO: Event name should match" );

        // Test DateTimeUTC property
        x.test( found.utcDateTime != null, "DAO: UTC DateTime should not be null" );
        x.test( found.utcDateTime.getUTCFullYear() === 2024, "DAO: UTC Year should be 2024" );
        x.test( found.utcDateTime.getUTCMonth() === 2, "DAO: UTC Month should be 2 (March)" );
        x.test( found.utcDateTime.getUTCDate() === 15, "DAO: UTC Day should be 15" );
        x.test( found.utcDateTime.getUTCHours() === 15, "DAO: UTC Hour should be 15" );
        x.test( found.utcDateTime.getUTCMinutes() === 30, "DAO: UTC Minute should be 30" );
        x.test( found.utcDateTime.getUTCSeconds() === 45, "DAO: UTC Second should be 45" );

        // Test regular DateTime property
        x.test( found.regularDateTime != null, "DAO: Regular DateTime should not be null" );

        // Test regular Date property
        x.test( found.regularDate != null, "DAO: Regular Date should not be null" );
        x.test( found.regularDate.getUTCFullYear() === 2024, "DAO: Regular Date year should be 2024" );
        x.test( found.regularDate.getUTCMonth() === 2, "DAO: Regular Date month should be 2 (March)" );
        x.test( found.regularDate.getUTCDate() === 15, "DAO: Regular Date day should be 15" );

        // Test that timestamp is preserved exactly for DateTimeUTC
        x.test( found.utcDateTime.getTime() === model.utcDateTime.getTime(),
                "DAO: UTC DateTime timestamp should be preserved exactly after DAO round-trip" );
      }
    },

    {
      name: 'testDAOQuery',
      code: async function(x) {
        // Test querying DAO with DateTimeUTC properties
        if ( ! this.dateTimeTestDAO ) {
          console.log("Skipping DAO query tests - dateTimeTestDAO not available");
          return;
        }

        // Clear DAO first
        await this.dateTimeTestDAO.removeAll();

        // Add test data with various dates - populate all date fields
        var testData = [
          {
            id: 10,
            eventName: "Event A",
            utcDateTime: "2024-03-15T10:00:00Z",
            regularDateTime: "2024-03-15T10:00:00",
            regularDate: "2024-03-15"
          },
          {
            id: 11,
            eventName: "Event B",
            utcDateTime: "2024-03-15T15:30:45Z",
            regularDateTime: "2024-03-15T15:30:45",
            regularDate: "2024-03-15"
          },
          {
            id: 12,
            eventName: "Event C",
            utcDateTime: "2024-03-16T08:00:00Z",
            regularDateTime: "2024-03-16T08:00:00",
            regularDate: "2024-03-16"
          },
          {
            id: 13,
            eventName: "Event D",
            utcDateTime: "2024-03-14T12:00:00Z",
            regularDateTime: "2024-03-14T12:00:00",
            regularDate: "2024-03-14"
          }
        ];

        for ( var i = 0; i < testData.length; i++ ) {
          await this.dateTimeTestDAO.put(this.DateTimeTestModel.create(testData[i]));
        }

        // Query all
        var all = await this.dateTimeTestDAO.select();
        x.test( all.array.length === 4, "DAO Query: Should have 4 items" );

        // Query by date using timestamp comparison
        var targetDate = new Date("2024-03-15T15:30:45Z");
        var found = await this.dateTimeTestDAO.find(11);
        x.test( found != null, "DAO Query: Should find event by ID" );
        x.test( found.utcDateTime.getTime() === targetDate.getTime(),
                "DAO Query: DateTime should match target timestamp" );

        // Verify all items have valid date properties
        all.array.forEach(function(item) {
          x.test( item.utcDateTime != null, "DAO Query: All items should have utcDateTime" );
          x.test( item.utcDateTime instanceof Date, "DAO Query: utcDateTime should be Date instance" );
          x.test( item.regularDateTime != null, "DAO Query: All items should have regularDateTime" );
          x.test( item.regularDateTime instanceof Date, "DAO Query: regularDateTime should be Date instance" );
          x.test( item.regularDate != null, "DAO Query: All items should have regularDate" );
          x.test( item.regularDate instanceof Date, "DAO Query: regularDate should be Date instance" );
        });
      }
    }
  ]
});
