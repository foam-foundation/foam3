/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'NumberParserTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Tests for NumberParser covering standard, European, and plain number formats',

  requires: ['foam.parse.NumberParser'],

  methods: [
    function runTest(x) {
      this.testStandardFormat(x);
      this.testPlainFormat(x);
      this.testEuropeanFormat(x);
      this.testNegativeNumbers(x);
      this.testDecimalOnly(x);
      this.testEdgeCases(x);
      this.testLenientParsing(x);
      this.testInvalidInputs(x);
    },

    function testStandardFormat(x) {
      var parser = this.NumberParser.create();

      // Standard format: comma for thousands, period for decimal
      var testCases = [
        { input: '1,000.00', expected: 1000 },
        { input: '1,234.56', expected: 1234.56 },
        { input: '1,000,000.00', expected: 1000000 },
        { input: '1,234,567.89', expected: 1234567.89 },
        { input: '999,999,999.99', expected: 999999999.99 },
        { input: '1,000', expected: 1000 }  // No decimal
      ];

      testCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input);
        x.test(
          result === testCase.expected,
          'Standard Format Test' + (i + 1) + ': ' + testCase.input + ' = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });
    },

    function testPlainFormat(x) {
      var parser = this.NumberParser.create();

      // Plain format: no thousands separator, period decimal
      var testCases = [
        { input: '1000', expected: 1000 },
        { input: '1000.00', expected: 1000 },
        { input: '1234.56', expected: 1234.56 },
        { input: '1234567.89', expected: 1234567.89 },
        { input: '0.5', expected: 0.5 },
        { input: '0.123', expected: 0.123 }
      ];

      testCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input);
        x.test(
          result === testCase.expected,
          'Plain Format Test' + (i + 1) + ': ' + testCase.input + ' = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });
    },

    function testEuropeanFormat(x) {
      var parser = this.NumberParser.create();

      // European format: period for thousands, comma for decimal
      // Must use 'european' opt_format
      var testCases = [
        { input: '1.000,00', expected: 1000 },
        { input: '1.234,56', expected: 1234.56 },
        { input: '1.000.000,00', expected: 1000000 },
        { input: '1.234.567,89', expected: 1234567.89 },
        { input: '999.999.999,99', expected: 999999999.99 },
        { input: '1.000', expected: 1000 },   // No decimal
        { input: '1000,50', expected: 1000.5 } // Plain with comma decimal
      ];

      testCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input, 'european');
        x.test(
          result === testCase.expected,
          'European Format Test' + (i + 1) + ': ' + testCase.input + ' = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });
    },

    function testNegativeNumbers(x) {
      var parser = this.NumberParser.create();

      // Negative numbers - standard/plain
      var standardCases = [
        { input: '-1000', expected: -1000 },
        { input: '-1,000.00', expected: -1000 },
        { input: '-1234.56', expected: -1234.56 },
        { input: '-0.5', expected: -0.5 }
      ];

      standardCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input);
        x.test(
          result === testCase.expected,
          'Negative Standard Test' + (i + 1) + ': ' + testCase.input + ' = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });

      // Negative numbers - European
      var europeanCases = [
        { input: '-1.000,00', expected: -1000 },
        { input: '-1000,50', expected: -1000.5 }
      ];

      europeanCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input, 'european');
        x.test(
          result === testCase.expected,
          'Negative European Test' + (i + 1) + ': ' + testCase.input + ' = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });
    },

    function testDecimalOnly(x) {
      var parser = this.NumberParser.create();

      var testCases = [
        { input: '.5', expected: 0.5 },
        { input: '.123', expected: 0.123 },
        { input: '.999', expected: 0.999 }
      ];

      testCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input);
        x.test(
          result === testCase.expected,
          'Decimal Only Test' + (i + 1) + ': ' + testCase.input + ' = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });
    },

    function testEdgeCases(x) {
      var parser = this.NumberParser.create();

      var testCases = [
        { input: '0', expected: 0 },
        { input: '0.0', expected: 0 },
        { input: '  1000  ', expected: 1000 }, // Whitespace
        { input: '+1000', expected: 1000 },    // Positive sign
        { input: '100', expected: 100 },       // Small number
        { input: '10', expected: 10 },
        { input: '1', expected: 1 }
      ];

      testCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input);
        x.test(
          result === testCase.expected,
          'Edge Case Test' + (i + 1) + ': "' + testCase.input + '" = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });
    },

    function testLenientParsing(x) {
      var parser = this.NumberParser.create();

      // Lenient parsing: variable digit grouping and extended decimals
      var standardCases = [
        { input: '100,1000.1000', expected: 1001000.1 },
        { input: '1,0000.00', expected: 10000 },
        { input: '1,00,000', expected: 100000 },          // Indian style
        { input: '12,3456,789', expected: 123456789 },    // Variable grouping
        { input: '1000.123456', expected: 1000.123456 },  // Many decimal places
        { input: '0.123456789', expected: 0.123456789 }   // Many decimal places
      ];

      standardCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input);
        x.test(
          result === testCase.expected,
          'Lenient Standard Test' + (i + 1) + ': ' + testCase.input + ' = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });

      // Lenient European parsing
      var europeanCases = [
        { input: '100.1000,1000', expected: 1001000.1 },
        { input: '1.0000,00', expected: 10000 },
        { input: '1.00.000', expected: 100000 },          // Variable grouping
        { input: '1000,123456', expected: 1000.123456 }   // Many decimal places
      ];

      europeanCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input, 'european');
        x.test(
          result === testCase.expected,
          'Lenient European Test' + (i + 1) + ': ' + testCase.input + ' = ' + result + ' (expected ' + testCase.expected + ')'
        );
      });
    },

    function testInvalidInputs(x) {
      var parser = this.NumberParser.create();

      var testCases = [
        { input: '' },
        { input: null },
        { input: undefined },
        { input: 'abc' },
        { input: '12abc34' }
      ];

      testCases.forEach(function(testCase, i) {
        var result = parser.parseString(testCase.input);
        x.test(
          isNaN(result),
          'Invalid Input Test' + (i + 1) + ': "' + testCase.input + '" should be NaN, got ' + result
        );
      });
    }
  ]
});
