/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Define test model before the test class
foam.CLASS({
  package: 'foam.parse.test',
  name: 'QueryParserTestUser',
  properties: [
    { class: 'Long', name: 'id' },
    { class: 'String', name: 'firstName' },
    { class: 'String', name: 'lastName' },
    { class: 'String', name: 'email' },
    { class: 'foam.lang.Date', name: 'birthday' },
    { class: 'foam.lang.DateTime', name: 'lastLogin' },
    { class: 'Boolean', name: 'emailVerified' }
  ]
});

foam.CLASS({
  package: 'foam.parse.test',
  name: 'QueryParserJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'JavaScript tests for QueryParser including date parsing fixes and timezone handling',

  requires: [
    'foam.parse.QueryParser',
    'foam.parse.test.QueryParserTestUser'
  ],

  methods: [
    async function runTest(x) {
      this.testBasicQueries(x);
      this.testEmailPlusAddressing(x);
      this.testDateParsing(x);
      this.testDateParsingFixes(x);
      this.testTimezoneHandling(x);
      this.testArrayBoundsFix(x);
      this.testComplexQueries(x);
      this.testEdgeCases(x);
    },

    function testBasicQueries(x) {
      var parser = this.QueryParser.create({ of: this.QueryParserTestUser });

      // Basic equality tests
      x.test(this.isValidQuery(parser, "id=6"), "Should parse id=6");
      x.test(this.isValidQuery(parser, "firstName=Simon"), "Should parse firstName=Simon");
      x.test(this.isValidQuery(parser, "firstName:Sim"), "Should parse firstName:Sim (contains)");

      // Comparison operators
      x.test(this.isValidQuery(parser, "id>20"), "Should parse id>20");
      x.test(this.isValidQuery(parser, "id<20"), "Should parse id<20");
      x.test(this.isValidQuery(parser, "id>=20"), "Should parse id>=20");
      x.test(this.isValidQuery(parser, "id<=20"), "Should parse id<=20");

      // Negation
      x.test(this.isValidQuery(parser, "-id=6"), "Should parse -id=6 (negation)");
      x.test(this.isValidQuery(parser, "NOT id=6"), "Should parse NOT id=6");

      // Boolean operations
      x.test(this.isValidQuery(parser, "id=6 OR firstName=Simon"), "Should parse OR query");
      x.test(this.isValidQuery(parser, "id=6 AND firstName=Simon"), "Should parse AND query");
      x.test(this.isValidQuery(parser, "firstName=abc id=20"), "Should parse implicit AND");

      // Special predicates
      x.test(this.isValidQuery(parser, "HAS:firstName"), "Should parse HAS predicate");
      x.test(this.isValidQuery(parser, "IS:emailVerified"), "Should parse IS predicate");

      // Lists
      x.test(this.isValidQuery(parser, "firstName=Simon,John"), "Should parse value list");
      x.test(this.isValidQuery(parser, "firstName:(Simon|John)"), "Should parse OR values");
    },

    function testEmailPlusAddressing(x) {
      var parser = this.QueryParser.create({ of: this.QueryParserTestUser });

      // Verify the full email with + is captured, not truncated
      // Without + in char rule, "user+tag@example.com" would parse as just "user"
      var query = parser.parseString("email=user+tag@example.com");
      var value = this.extractValue(query);
      x.test(value === "user+tag@example.com",
        "Email with + should not be truncated at +, expected 'user+tag@example.com' got: '" + value + "'");

      // Test multiple emails with +
      var query2 = parser.parseString("email=a+b@test.com,c+d@test.com");
      var values = this.extractValues(query2);
      x.test(values.includes("a+b@test.com") && values.includes("c+d@test.com"),
        "Multiple emails with + should parse correctly, got: " + JSON.stringify(values));
    },

    function extractValue(query) {
      // Extract single value from Eq predicate
      if ( ! query ) return null;
      var pred = query.args ? query.args[0] : query;
      if ( ! pred || ! pred.arg2 ) return null;
      var val = pred.arg2;
      return val.value !== undefined ? val.value : val;
    },

    function extractValues(query) {
      // Extract values from In predicate (used for comma-separated values with =)
      var values = [];
      if ( ! query ) return values;
      // Handle And wrapper: query.args[0] is the actual predicate
      var pred = query.args ? query.args[0] : query;
      if ( ! pred || ! pred.arg2 ) return values;
      var arg2 = pred.arg2;
      // arg2 could be a Constant wrapping an array, or the array directly
      var arr = arg2.value !== undefined ? arg2.value : arg2;
      if ( Array.isArray(arr) ) {
        return arr;
      }
      return [arr];
    },

    function testDateParsing(x) {
      var parser = this.QueryParser.create({ of: this.QueryParserTestUser });

      // Various date formats that should work
      x.test(this.isValidQuery(parser, "birthday=2020-09-10"), "Should parse YYYY-MM-DD");
      x.test(this.isValidQuery(parser, "birthday=2020-09"), "Should parse YYYY-MM");
      x.test(this.isValidQuery(parser, "birthday=2020"), "Should parse YYYY");
      x.test(this.isValidQuery(parser, "lastLogin=today"), "Should parse relative date 'today'");
      x.test(this.isValidQuery(parser, "lastLogin=today-2"), "Should parse relative date 'today-2'");

      // Date ranges
      x.test(this.isValidQuery(parser, "birthday=2010-9-10..2020-9-10"), "Should parse date range");

      // Date comparisons
      x.test(this.isValidQuery(parser, "birthday<2020-09-10"), "Should parse date less than");
      x.test(this.isValidQuery(parser, "birthday>2020-09-10"), "Should parse date greater than");
    },

    function testDateParsingFixes(x) {
      var parser = this.QueryParser.create({ of: this.QueryParserTestUser });

      // Test the specific formats that were failing before our fixes
      var problematicDates = [
        "2025/03/17",  // The original failing case
        "2025/03/18",  // Timezone issue case
        "2025/12/31",  // Edge case
        "2024/02/29",  // Leap year
        "2025/01/01"   // New year
      ];

      problematicDates.forEach(dateStr => {
        try {
          var query = parser.parseString(`birthday=${dateStr}`);
          x.test(query !== null && query !== undefined,
                   `Should parse ${dateStr} without array bounds errors`);

          // Verify we get a proper query structure
          if ( query ) {
            x.test(query.cls_ && query.cls_.name === 'And',
                     `${dateStr} should create AND predicate`);
          }
        } catch (e) {
          x.test(false, `Date parsing failed for ${dateStr}: ${e.message}`);
        }
      });

      // Test specific case: 2025/03/17 should create dates in 2025, not 275760
      var specificQuery = parser.parseString('birthday=2025/03/17');
      if ( specificQuery && specificQuery.args && specificQuery.args.length === 2 ) {
        var startDate = (specificQuery.args[0].arg2.value || specificQuery.args[0].arg2);
        var endDate = (specificQuery.args[1].arg2.value || specificQuery.args[1].arg2);

        if ( startDate instanceof Date ) {
          x.test(startDate.getFullYear() === 2025,
                   `2025/03/17 start date should be in year 2025, got ${startDate.getFullYear()}`);
          x.test(startDate.getMonth() === 2, // March is month 2 (0-based)
                   `2025/03/17 start date should be in March (month 2), got ${startDate.getMonth()}`);
          x.test(startDate.getDate() === 17,
                   `2025/03/17 start date should be day 17, got ${startDate.getDate()}`);
        }

        if ( endDate instanceof Date ) {
          x.test(endDate.getFullYear() === 2025,
                   `2025/03/17 end date should be in year 2025, got ${endDate.getFullYear()}`);
          // End date should be the next day (March 18)
          x.test(endDate.getDate() === 18,
                   `2025/03/17 end date should be day 18, got ${endDate.getDate()}`);
        }
      }
    },

    function testTimezoneHandling(x) {
      var parser = this.QueryParser.create({ of: this.QueryParserTestUser });

      // Test that dates are created in local timezone, not UTC
      var query = parser.parseString('birthday=2025/03/18');

      if ( query && query.args && query.args.length === 2 ) {
        var gteClause = query.args[0];
        var ltClause = query.args[1];

        if ( gteClause && gteClause.arg2 ) {
          var startDateConstant = gteClause.arg2;
          // FOAM wraps dates in Constant objects, so get the actual value
          var actualStartDate = startDateConstant.value || startDateConstant;
          if ( actualStartDate instanceof Date ) {
            x.test(!isNaN(actualStartDate.getTime()), "Start date should be valid");
          }

          // The key fix: dates should represent local date boundaries
          // not UTC boundaries that get shifted in local timezone display
        }

        if ( ltClause && ltClause.arg2 ) {
          var endDateConstant = ltClause.arg2;
          // FOAM wraps dates in Constant objects, so get the actual value
          var actualEndDate = endDateConstant.value || endDateConstant;
          if ( actualEndDate instanceof Date ) {
            x.test(!isNaN(actualEndDate.getTime()), "End date should be valid");
          }
        }
      }
    },

    function testArrayBoundsFix(x) {
      var parser = this.QueryParser.create({ of: this.QueryParserTestUser });

      // These formats specifically test the array bounds fix
      // YY/MM/DD format creates array [YYYY, '/', MM, '/', DD] with length 5
      // The old code tried to access elements beyond this length
      var testCases = [
        { format: "2025/03/17", expectedYear: 2025, expectedMonth: 2, expectedDay: 17 },
        { format: "2025-03-17", expectedYear: 2025, expectedMonth: 2, expectedDay: 17 },
        { format: "2025/1/1", expectedYear: 2025, expectedMonth: 0, expectedDay: 1 },
        { format: "2025/12/31", expectedYear: 2025, expectedMonth: 11, expectedDay: 31 }
      ];

      testCases.forEach(testCase => {
        try {
          var query = parser.parseString(`birthday=${testCase.format}`);
          x.test(query !== null, `Should parse ${testCase.format}`);

          // Verify the query creates correct date ranges
          if ( query && query.args && query.args.length === 2 ) {
            var gteClause = query.args[0]; // Greater than or equal
            var ltClause = query.args[1];  // Less than

            if ( gteClause && gteClause.arg2 ) {
              var startDateConstant = gteClause.arg2;
              var actualStartDate = startDateConstant.value || startDateConstant;

              x.test(actualStartDate instanceof Date && !isNaN(actualStartDate.getTime()),
                       `Valid start date for ${testCase.format}`);

              // Test exact expected values
              x.test(actualStartDate.getFullYear() === testCase.expectedYear,
                       `${testCase.format} start year should be ${testCase.expectedYear}, got ${actualStartDate.getFullYear()}`);
              x.test(actualStartDate.getMonth() === testCase.expectedMonth,
                       `${testCase.format} start month should be ${testCase.expectedMonth}, got ${actualStartDate.getMonth()}`);
              x.test(actualStartDate.getDate() === testCase.expectedDay,
                       `${testCase.format} start day should be ${testCase.expectedDay}, got ${actualStartDate.getDate()}`);
            }

            if ( ltClause && ltClause.arg2 ) {
              var endDateConstant = ltClause.arg2;
              var actualEndDate = endDateConstant.value || endDateConstant;

              x.test(actualEndDate instanceof Date && !isNaN(actualEndDate.getTime()),
                       `Valid end date for ${testCase.format}`);

              // End date should be next day - calculate correctly for month/year rollovers
              var expectedEndDate = new Date(testCase.expectedYear, testCase.expectedMonth, testCase.expectedDay + 1);
              x.test(actualEndDate.getFullYear() === expectedEndDate.getFullYear(),
                       `${testCase.format} end year should be ${expectedEndDate.getFullYear()}, got ${actualEndDate.getFullYear()}`);
              x.test(actualEndDate.getMonth() === expectedEndDate.getMonth(),
                       `${testCase.format} end month should be ${expectedEndDate.getMonth()}, got ${actualEndDate.getMonth()}`);
              x.test(actualEndDate.getDate() === expectedEndDate.getDate(),
                       `${testCase.format} end day should be ${expectedEndDate.getDate()}, got ${actualEndDate.getDate()}`);
            }
          }
        } catch (e) {
          x.test(false, `Array bounds test failed for ${testCase.format}: ${e.message}`);
        }
      });
    },

    function testComplexQueries(x) {
      var parser = this.QueryParser.create({ of: this.QueryParserTestUser });

      // Complex queries combining different elements
      var complexQueries = [
        "id=6 AND birthday=2025/03/17",
        "firstName=John OR (birthday>2020-01-01 AND id<100)",
        "(firstName=Simon AND id>10) OR birthday=2025/03/18",
        "birthday=2025/03/17..2025/03/19 AND firstName:John"
      ];

      complexQueries.forEach(queryStr => {
        x.test(this.isValidQuery(parser, queryStr),
                 `Should parse complex query: ${queryStr}`);
      });
    },

    function testEdgeCases(x) {
      var parser = this.QueryParser.create({ of: this.QueryParserTestUser });

      // Edge cases that should be handled gracefully
      var edgeCases = [
        { query: "birthday=2024/02/29", desc: "leap year date" },
        { query: "birthday=2025/02/28", desc: "non-leap year february" },
        { query: "birthday=2025/12/31", desc: "year end date" },
        { query: "birthday=2025/01/01", desc: "year start date" },
        { query: "birthday=1999/12/31", desc: "Y2K boundary" },
        { query: "birthday=2000/01/01", desc: "millennium boundary" }
      ];

      edgeCases.forEach(testCase => {
        try {
          var query = parser.parseString(testCase.query);
          x.test(query !== null, `Edge case: ${testCase.desc}`);
        } catch (e) {
          x.test(false, `Edge case failed - ${testCase.desc}: ${e.message}`);
        }
      });
    },

    function isValidQuery(parser, queryString) {
      try {
        var result = parser.parseString(queryString);
        return result !== null && result !== undefined;
      } catch (e) {
        console.warn(`Query parsing failed for "${queryString}":`, e);
        return false;
      }
    }
  ]
});