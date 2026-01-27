/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'NumberParser',
  extends: 'foam.parse.NumberGrammar',

  documentation: `
    Number parser that handles standard and European number formats.
    Extends NumberGrammar and adds actions for converting parsed results to numbers.

    Supported formats:
    - Standard (US/UK): 1,000.00 (comma thousands, period decimal)
    - European (DE/FR): 1.000,00 (period thousands, comma decimal)
    - Plain: 1000.00 (no thousands separator)

    Usage:
      var parser = foam.parse.NumberParser.create();
      var num = parser.parseString('1,234.56');              // 1234.56 (standard)
      var num = parser.parseString('1.234,56', 'european');  // 1234.56 (european)
  `,

  // Singleton pattern - reuse the same parser instance
  axioms: [
    foam.pattern.Singleton.create()
  ],

  methods: [
    // Main action for standard/plain entry point (START)
    // v = [whitespace?, sign?, unsignedStandardOrPlain, whitespace?]
    function standardOrPlainAction(v) {
      var sign = v[1] === '-' ? -1 : 1;
      var num = v[2];
      return sign * num;
    },

    // European entry point action
    // v = [whitespace?, sign?, unsignedEuropean, whitespace?]
    function europeanAction(v) {
      var sign = v[1] === '-' ? -1 : 1;
      var num = v[2];
      return sign * num;
    },

    // Standard number action
    // v = [standardInteger, ['.', decimalDigits]?]
    function standardNumberAction(v) {
      var intPart = v[0];
      var decPart = v[1] ? v[1][1] : '0';
      return parseFloat(intPart + '.' + decPart);
    },

    // Standard integer action - remove commas
    // v = [digits1to3, [[',', digits3], ...]]
    function standardIntegerAction(v) {
      var result = v[0];
      if ( v[1] ) {
        for ( var i = 0; i < v[1].length; i++ ) {
          result += v[1][i][1]; // Skip comma, add digits
        }
      }
      return result;
    },

    // European number action
    // v = [europeanInteger, [',', decimalDigits]?]
    function europeanNumberAction(v) {
      var intPart = v[0];
      var decPart = v[1] ? v[1][1] : '0';
      return parseFloat(intPart + '.' + decPart);
    },

    // European integer action - remove periods
    // v = [digits1to3, [['.', digits3], ...]]
    function europeanIntegerAction(v) {
      var result = v[0];
      if ( v[1] ) {
        for ( var i = 0; i < v[1].length; i++ ) {
          result += v[1][i][1]; // Skip period, add digits
        }
      }
      return result;
    },

    // Plain number action (standard decimal)
    // v = [digits, '.', decimalDigits] or ['.', decimalDigits] or digits
    function plainNumberAction(v) {
      if ( typeof v === 'string' ) {
        // Just digits, no decimal
        return parseFloat(v);
      }
      if ( v[0] === '.' ) {
        // Starts with decimal: .5
        return parseFloat('0.' + v[1]);
      }
      // Full format: 1000.00
      return parseFloat(v[0] + '.' + v[2]);
    },

    // Plain number European action (comma decimal)
    // v = [digits, ',', decimalDigits] or digits
    function plainNumberEuropeanAction(v) {
      if ( typeof v === 'string' ) {
        // Just digits, no decimal
        return parseFloat(v);
      }
      // Full format: 1000,00
      return parseFloat(v[0] + '.' + v[2]);
    },

    function parseString(str, opt_format) {
      /**
       * Parse a number string and return the numeric value.
       * @param {string} str - The number string to parse
       * @param {string} opt_format - Optional format: 'european' for European format, otherwise standard
       * @returns {number} The parsed number, or NaN if invalid
       */
      if ( ! str || typeof str !== 'string' ) return NaN;

      str = str.trim();
      if ( str === '' ) return NaN;

      var parseResult = this.parse(this.StringPStream.create({ str: str }), this, opt_format);

      if ( ! parseResult ) {
        return NaN;
      }

      // Check if entire string was consumed
      if ( parseResult.pos < str.length ) {
        console.warn('NumberParser: Partial parse. Input:', str, 'Remaining:', str.substring(parseResult.pos));
        return NaN;
      }

      return parseResult.value;
    }
  ]
});
