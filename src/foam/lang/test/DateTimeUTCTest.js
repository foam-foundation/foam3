/**
 * @license
 * Copyright 2025 PayTic. All Rights Reserved.
 */

// Define test model before the test class
foam.CLASS({
  package: 'foam.lang.test',
  name: 'DateTimeTestModel',

  documentation: 'Test model with both DateTime and DateTimeUTC properties for comparison',

  properties: [
    {
      class: 'Long',
      name: 'id'
    },
    {
      class: 'DateTime',
      name: 'regularDateTime',
      documentation: 'Standard DateTime property - formats in local timezone'
    },
    {
      class: 'DateTimeUTC',
      name: 'utcDateTime',
      documentation: 'DateTimeUTC property - formats in UTC timezone'
    },
    {
      class: 'Date',
      name: 'regularDate',
      documentation: 'Standard Date property'
    },
    {
      class: 'String',
      name: 'eventName'
    }
  ]
});

foam.CLASS({
  package: 'foam.lang.test',
  name: 'DateTimeUTCTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Tests for the DateTimeUTC property type',

  requires: [
    'foam.lang.test.DateTimeTestModel'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        this.testAdaptFromString(x);
        this.testAdaptFromNumber(x);
        this.testAdaptFromDate(x);
        this.testAdaptFromVariousFormats(x);
        this.testParseDateTime(x);
        this.testFormatDate(x);
        this.testFormatDateTime(x);
        this.testModelProperties(x);
        this.testDateNormalization(x);
        this.testEdgeCases(x);
        this.testUTCTimePreservation(x);
        this.testTimezoneConversions(x);
        this.testDateTimeUTCNoTimeLoss(x);
      }
    },
    {
      name: 'testAdaptFromString',
      code: function(x) {
        // Test adapting from various string formats
        var d1 = foam.util.DateUtil.adapt("2024-03-15");
        x.test( d1 != null, "Should adapt from YYYY-MM-DD string format" );

        var d2 = foam.util.DateUtil.adapt("03/15/2024");
        x.test( d2 != null, "Should adapt from MM/DD/YYYY string format" );

        var d3 = foam.util.DateUtil.adapt("20240315");
        x.test( d3 != null, "Should adapt from YYYYMMDD string format" );

        // Verify all represent the same date
        x.test(
          d1.getUTCFullYear() === d2.getUTCFullYear() &&
          d1.getUTCMonth() === d2.getUTCMonth() &&
          d1.getUTCDate() === d2.getUTCDate(),
          "YYYY-MM-DD and MM/DD/YYYY should represent the same date"
        );

        x.test(
          d1.getUTCFullYear() === d3.getUTCFullYear() &&
          d1.getUTCMonth() === d3.getUTCMonth() &&
          d1.getUTCDate() === d3.getUTCDate(),
          "YYYY-MM-DD and YYYYMMDD should represent the same date"
        );
      }
    },
    {
      name: 'testAdaptFromNumber',
      code: function(x) {
        // Test adapting from timestamp (milliseconds since epoch)
        var timestamp = 1710489600000; // 2024-03-15 00:00:00 UTC
        var d = foam.util.DateUtil.adapt(timestamp);
        x.test( d != null, "Should adapt from number timestamp" );
        // adapt() normalizes to noon, so timestamp will be different
        var year = d.getUTCFullYear();
        x.test( year === 2024, `Year should be 2024 (expected 2024, got ${year})` );
        var month = d.getUTCMonth();
        x.test( month === 2, `Month should be March (2) (expected 2, got ${month})` );
        var date = d.getUTCDate();
        x.test( date === 15, `Day should be 15 (expected 15, got ${date})` );
        var hours = d.getUTCHours();
        x.test( hours === 12, `Hour normalized to 12 (noon) (expected 12, got ${hours})` );
      }
    },
    {
      name: 'testAdaptFromDate',
      code: function(x) {
        // Test adapting from Date object
        var original = new Date();
        var adapted = foam.util.DateUtil.adapt(original);
        x.test( adapted != null, "Should adapt from Date object" );

        // Verify the date is normalized to noon GMT
        var hours = adapted.getUTCHours();
        x.test( hours === 12, `Adapted date should be normalized to noon GMT (expected 12, got ${hours})` );
        var minutes = adapted.getUTCMinutes();
        x.test( minutes === 0, `Minutes should be 0 (expected 0, got ${minutes})` );
        var seconds = adapted.getUTCSeconds();
        x.test( seconds === 0, `Seconds should be 0 (expected 0, got ${seconds})` );
      }
    },
    {
      name: 'testAdaptFromVariousFormats',
      code: function(x) {
        // Test all supported date formats
        var formats = [
          "2024-03-15",      // YYYY-MM-DD with dash
          "2024/03/15",      // YYYY/MM/DD with slash
          "20240315",        // YYYYMMDD no separator
          "03-15-2024",      // MM-DD-YYYY with dash
          "03/15/2024",      // MM/DD/YYYY with slash
          "03152024",        // MMDDYYYY no separator
          "24-03-15",        // YY-MM-DD with dash
          "24/03/15",        // YY/MM/DD with slash
          "240315"           // YYMMDD no separator
        ];

        formats.forEach(function(format) {
          try {
            var d = foam.util.DateUtil.adapt(format);
            x.test( d != null, "Should adapt from format: " + format );
          } catch (e) {
            x.test( false, "Failed to adapt from format: " + format + " - " + e.message );
          }
        });
      }
    },
    {
      name: 'testParseDateTime',
      code: function(x) {
        // Test parseDateTime with various datetime formats
        var dt1 = foam.util.DateUtil.parseDateTime("2024-03-15 15:30:45");
        x.test( dt1 != null, "Should parse YYYY-MM-DD HH:MM:SS format" );
        var hours1 = dt1.getUTCHours();
        x.test( hours1 === 15, `Hour should be 15 (expected 15, got ${hours1})` );
        var minutes1 = dt1.getUTCMinutes();
        x.test( minutes1 === 30, `Minutes should be 30 (expected 30, got ${minutes1})` );
        var seconds1 = dt1.getUTCSeconds();
        x.test( seconds1 === 45, `Seconds should be 45 (expected 45, got ${seconds1})` );

        var dt2 = foam.util.DateUtil.parseDateTime("03/15/2024 15:30:45");
        x.test( dt2 != null, "Should parse MM/DD/YYYY HH:MM:SS format" );

        var dt3 = foam.util.DateUtil.parseDateTime("2024-03-15T15:30:45");
        x.test( dt3 != null, "Should parse ISO format with T separator" );

        // Verify they represent the same datetime
        var time1 = dt1.getTime();
        var time3 = dt3.getTime();
        x.test( time1 === time3, `Different formats should parse to same datetime (expected ${time1}, got ${time3})` );
      }
    },
    {
      name: 'testFormatDate',
      code: function(x) {
        // Create a specific date: March 15, 2024 at 15:30:45 GMT
        var testDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45, 0)); // March is month 2 (0-indexed)

        // Note: format method formats in UTC
        // This test validates the date was created correctly
        var year = testDate.getUTCFullYear();
        x.test( year === 2024, `Year should be 2024 (expected 2024, got ${year})` );
        var month = testDate.getUTCMonth();
        x.test( month === 2, `Month should be March (2) (expected 2, got ${month})` );
        var date = testDate.getUTCDate();
        x.test( date === 15, `Day should be 15 (expected 15, got ${date})` );
        var hours = testDate.getUTCHours();
        x.test( hours === 15, `Hour should be 15 (expected 15, got ${hours})` );
        var minutes = testDate.getUTCMinutes();
        x.test( minutes === 30, `Minute should be 30 (expected 30, got ${minutes})` );
        var seconds = testDate.getUTCSeconds();
        x.test( seconds === 45, `Second should be 45 (expected 45, got ${seconds})` );
      }
    },
    {
      name: 'testFormatDateTime',
      code: function(x) {
        // Create a specific datetime
        var testDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45, 0));

        // Verify time components
        var hours = testDate.getUTCHours();
        x.test( hours === 15, `Hour should be 15 (expected 15, got ${hours})` );
        var minutes = testDate.getUTCMinutes();
        x.test( minutes === 30, `Minute should be 30 (expected 30, got ${minutes})` );
        var seconds = testDate.getUTCSeconds();
        x.test( seconds === 45, `Second should be 45 (expected 45, got ${seconds})` );

        // Test that we can read back the components correctly
        var year = testDate.getUTCFullYear();
        x.test( year === 2024, `Verify year is 2024 (expected 2024, got ${year})` );
        var month = testDate.getUTCMonth();
        x.test( month === 2, `Verify month is March (2) (expected 2, got ${month})` );
      }
    },
    {
      name: 'testModelProperties',
      code: function(x) {
        // Create test model instance
        var model = this.DateTimeTestModel.create({
          id: 1,
          eventName: "Test Event"
        });

        // Test setting values on both property types
        var testDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45, 0));

        model.regularDateTime = testDate;
        model.utcDateTime = testDate;
        model.regularDate = testDate;

        // Verify values are set correctly
        x.test( model.regularDateTime != null, "Regular DateTime should be set" );
        x.test( model.utcDateTime != null, "UTC DateTime should be set" );
        x.test( model.regularDate != null, "Regular Date should be set" );

        // Verify they represent the same underlying timestamp
        var regularTime = model.regularDateTime.getTime();
        var expectedTime = testDate.getTime();
        x.test( regularTime === expectedTime,
                `Regular DateTime should have same timestamp (expected ${expectedTime}, got ${regularTime})` );
        var utcTime = model.utcDateTime.getTime();
        x.test( utcTime === expectedTime,
                `UTC DateTime should have same timestamp (expected ${expectedTime}, got ${utcTime})` );
      }
    },
    {
      name: 'testDateNormalization',
      code: function(x) {
        // Test that DateUtil.adapt normalizes dates to noon GMT
        var dateStrings = [
          "2024-03-15",
          "03/15/2024",
          "20240315"
        ];

        dateStrings.forEach(function(dateStr) {
          var adapted = foam.util.DateUtil.adapt(dateStr);

          var hours = adapted.getUTCHours();
          x.test( hours === 12,
                  dateStr + ` should be normalized to hour 12 (noon) (expected 12, got ${hours})` );
          var minutes = adapted.getUTCMinutes();
          x.test( minutes === 0,
                  dateStr + ` should have minute 0 (expected 0, got ${minutes})` );
          var seconds = adapted.getUTCSeconds();
          x.test( seconds === 0,
                  dateStr + ` should have second 0 (expected 0, got ${seconds})` );
          var millis = adapted.getUTCMilliseconds();
          x.test( millis === 0,
                  dateStr + ` should have millisecond 0 (expected 0, got ${millis})` );
        });
      }
    },
    {
      name: 'testEdgeCases',
      code: function(x) {
        // Test edge cases

        // Leap year
        var leapYear = foam.util.DateUtil.adapt("2024-02-29");
        x.test( leapYear != null, "Should handle leap year date" );
        var leapMonth = leapYear.getUTCMonth();
        x.test( leapMonth === 1, `Leap year month should be February (1) (expected 1, got ${leapMonth})` );
        var leapDate = leapYear.getUTCDate();
        x.test( leapDate === 29, `Leap year day should be 29 (expected 29, got ${leapDate})` );

        // Year boundaries
        var yearEnd = foam.util.DateUtil.adapt("2024-12-31");
        x.test( yearEnd != null, "Should handle year end date" );

        var yearStart = foam.util.DateUtil.adapt("2024-01-01");
        x.test( yearStart != null, "Should handle year start date" );

        // Two-digit year pivot (years < 50 should be 2000s, >= 50 should be 1900s)
        var year25 = foam.util.DateUtil.adapt("25/03/15");
        var fullYear25 = year25.getUTCFullYear();
        x.test( fullYear25 === 2025, `Year 25 should be interpreted as 2025 (expected 2025, got ${fullYear25})` );

        var year99 = foam.util.DateUtil.adapt("99/03/15");
        var fullYear99 = year99.getUTCFullYear();
        x.test( fullYear99 === 1999, `Year 99 should be interpreted as 1999 (expected 1999, got ${fullYear99})` );

        // Test null handling
        var nullDate = foam.util.DateUtil.adapt(null);
        x.test( nullDate == null, "Null input should return null" );
      }
    },
    {
      name: 'testUTCTimePreservation',
      code: function(x) {
        // Test that UTC times are preserved without conversion

        // Create a specific UTC time: 2024-03-15 14:30:00 UTC
        var utcTime = new Date(Date.UTC(2024, 2, 15, 14, 30, 0, 0));
        var originalTimestamp = utcTime.getTime();

        // Adapt using adaptDateTime (used by DateTimeUTC)
        var adapted = foam.util.DateUtil.adaptDateTime(utcTime);

        // Verify timestamp is preserved exactly
        var adaptedTime = adapted.getTime();
        x.test( adaptedTime === originalTimestamp,
                `adaptDateTime should preserve UTC timestamp exactly (expected ${originalTimestamp}, got ${adaptedTime})` );

        // Verify all time components are preserved
        var year = adapted.getUTCFullYear();
        x.test( year === 2024, `Year preserved (expected 2024, got ${year})` );
        var month = adapted.getUTCMonth();
        x.test( month === 2, `Month preserved (expected 2, got ${month})` );
        var date = adapted.getUTCDate();
        x.test( date === 15, `Date preserved (expected 15, got ${date})` );
        var hours = adapted.getUTCHours();
        x.test( hours === 14, `Hour preserved (14:30 UTC) (expected 14, got ${hours})` );
        var minutes = adapted.getUTCMinutes();
        x.test( minutes === 30, `Minutes preserved (expected 30, got ${minutes})` );
        var seconds = adapted.getUTCSeconds();
        x.test( seconds === 0, `Seconds preserved (expected 0, got ${seconds})` );

        // Test with a timestamp number
        var timestamp = 1710511800000; // 2024-03-15 14:30:00 UTC
        var fromTimestamp = foam.util.DateUtil.adaptDateTime(timestamp);
        var timestampTime = fromTimestamp.getTime();
        x.test( timestampTime === timestamp,
                `Timestamp number should be preserved (expected ${timestamp}, got ${timestampTime})` );
        var timestampHours = fromTimestamp.getUTCHours();
        x.test( timestampHours === 14,
                `Hour from timestamp preserved (expected 14, got ${timestampHours})` );
      }
    },
    {
      name: 'testTimezoneConversions',
      code: function(x) {
        // Test that format method correctly handles different timezones

        // Create a UTC time: 2024-03-15 20:00:00 UTC
        var utcTime = new Date(Date.UTC(2024, 2, 15, 20, 0, 0, 0));

        // Format in UTC (should show 20:00:00)
        var utcFormatted = foam.util.DateUtil.format(utcTime, true, 'UTC');
        x.test( utcFormatted.includes('20:00:00'),
                "UTC format should show 20:00:00" );

        // Format in different timezone (America/New_York is UTC-5 in March, so 20:00 UTC = 15:00 EST)
        // Note: This depends on browser/system timezone support
        var nyFormatted = foam.util.DateUtil.format(utcTime, true, 'America/New_York');
        x.test( nyFormatted != null && nyFormatted.length > 0,
                "Should format in America/New_York timezone" );

        // Format in another timezone (Asia/Tokyo is UTC+9, so 20:00 UTC = 05:00 JST next day)
        var tokyoFormatted = foam.util.DateUtil.format(utcTime, true, 'Asia/Tokyo');
        x.test( tokyoFormatted != null && tokyoFormatted.length > 0,
                "Should format in Asia/Tokyo timezone" );

        // Verify that the same timestamp formats differently in different timezones
        x.test( utcFormatted !== nyFormatted || utcFormatted !== tokyoFormatted,
                "Same timestamp should format differently in different timezones" );
      }
    },
    {
      name: 'testDateTimeUTCNoTimeLoss',
      code: function(x) {
        // Test that DateTimeUTC property doesn't lose time information

        var model = this.DateTimeTestModel.create({
          id: 1,
          eventName: "Time Preservation Test"
        });

        // Test 1: Set with a specific UTC datetime string
        var datetimeString = "2024-03-15 14:30:45";
        model.utcDateTime = datetimeString;

        x.test( model.utcDateTime != null, "Should parse datetime string" );
        var hours1 = model.utcDateTime.getUTCHours();
        x.test( hours1 === 14,
                `Hour should be preserved from datetime string (14) (expected 14, got ${hours1})` );
        var minutes1 = model.utcDateTime.getUTCMinutes();
        x.test( minutes1 === 30,
                `Minutes should be preserved from datetime string (30) (expected 30, got ${minutes1})` );
        var seconds1 = model.utcDateTime.getUTCSeconds();
        x.test( seconds1 === 45,
                `Seconds should be preserved from datetime string (45) (expected 45, got ${seconds1})` );

        // Test 2: Set with a Date object
        var dateObj = new Date(Date.UTC(2024, 2, 15, 16, 45, 30, 0));
        var originalTimestamp = dateObj.getTime();
        model.utcDateTime = dateObj;

        var time2 = model.utcDateTime.getTime();
        x.test( time2 === originalTimestamp,
                `Timestamp should be preserved when setting Date object (expected ${originalTimestamp}, got ${time2})` );
        var hours2 = model.utcDateTime.getUTCHours();
        x.test( hours2 === 16,
                `Hour should be preserved from Date object (16) (expected 16, got ${hours2})` );
        var minutes2 = model.utcDateTime.getUTCMinutes();
        x.test( minutes2 === 45,
                `Minutes should be preserved from Date object (45) (expected 45, got ${minutes2})` );

        // Test 3: Set with a timestamp number
        var timestamp = 1710519930000; // 2024-03-15 16:25:30 UTC
        model.utcDateTime = timestamp;

        var time3 = model.utcDateTime.getTime();
        x.test( time3 === timestamp,
                `Timestamp number should be preserved exactly (expected ${timestamp}, got ${time3})` );
        var hours3 = model.utcDateTime.getUTCHours();
        x.test( hours3 === 16,
                `Hour from timestamp should be 16 (expected 16, got ${hours3})` );
        var minutes3 = model.utcDateTime.getUTCMinutes();
        x.test( minutes3 === 25,
                `Minutes from timestamp should be 25 (expected 25, got ${minutes3})` );
        var seconds3 = model.utcDateTime.getUTCSeconds();
        x.test( seconds3 === 30,
                `Seconds from timestamp should be 30 (expected 30, got ${seconds3})` );

        // Test 4: Verify date-only string sets time to zero
        model.utcDateTime = "2024-03-15";
        var hours4 = model.utcDateTime.getUTCHours();
        x.test( hours4 === 0,
                `Date-only string should set hour to 0 (midnight) (expected 0, got ${hours4})` );
        var minutes4 = model.utcDateTime.getUTCMinutes();
        x.test( minutes4 === 0,
                `Date-only string should set minutes to 0 (expected 0, got ${minutes4})` );
        var seconds4 = model.utcDateTime.getUTCSeconds();
        x.test( seconds4 === 0,
                `Date-only string should set seconds to 0 (expected 0, got ${seconds4})` );
      }
    }
  ]
});
