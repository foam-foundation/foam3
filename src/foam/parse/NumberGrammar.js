/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'NumberGrammar',
  extends: 'foam.parse.Grammar',

  documentation: `
    Grammar definitions for parsing number strings in various formats.
    Lenient parser that accepts:
    - Standard format (US/UK): comma for thousands, period for decimal (1,000.00)
    - European format (DE/FR): period for thousands, comma for decimal (1.000,00)
    - Plain numbers without separators (1000.00)
    - Negative numbers with leading minus sign
    - Variable digit grouping (1,00,000 or 1,0000.00 accepted)

    Entry points:
    - START: Auto-detect standard or plain format (no European - ambiguous with standard)
    - european: Parse European format only (1.000,00)

    Usage:
      Extend this class and add actions for number conversion,
      or use foam.parse.NumberParser which provides the actions.
  `,

  methods: [
    function grammar(alt, anyChar, chars, literal, optional, range, repeat, seq, str, sym, not) {
      return {
        // Main entry point - standard and plain formats (no European due to ambiguity)
        START: sym('standardOrPlain'),

        // Main entry point for standard/plain formats with optional sign and whitespace
        standardOrPlain: seq(
          optional(sym('whitespace')),
          optional(sym('sign')),
          sym('unsignedStandardOrPlain'),
          optional(sym('whitespace'))
        ),

        // European entry point - accessible via opt_name='european'
        european: seq(
          optional(sym('whitespace')),
          optional(sym('sign')),
          sym('unsignedEuropean'),
          optional(sym('whitespace'))
        ),

        // Sign: + or -
        sign: chars('+-'),

        // Whitespace
        whitespace: repeat(chars(' \t'), null, 1),

        // Unsigned number - standard and plain formats only
        unsignedStandardOrPlain: alt(
          sym('standardNumber'),   // 1,000.00 (comma thousands, period decimal)
          sym('plainNumber')       // 1000.00 or 1000 (no thousands separator)
        ),

        // European unsigned number
        unsignedEuropean: alt(
          sym('europeanNumber'),     // 1.000,00 (period thousands, comma decimal)
          sym('plainNumberEuropean') // 1000,00 (no thousands, comma decimal)
        ),

        // Standard format: comma for thousands, period for decimal
        // Examples: 1,000.00, 1,000,000.50, 1,000, 1,0000.00 (lenient)
        standardNumber: seq(
          sym('standardInteger'),
          optional(seq('.', sym('decimalDigits')))
        ),

        // Standard integer part with comma thousands separators (lenient - any digit count)
        standardInteger: seq(
          sym('plainDigits'),                                // First group: any digits
          repeat(seq(',', sym('plainDigits')), null, 1)      // Followed by ,XXX groups (at least one)
        ),

        // European format: period for thousands, comma for decimal
        // Examples: 1.000,00, 1.000.000,50, 1.000, 1.0000,00 (lenient)
        europeanNumber: seq(
          sym('europeanInteger'),
          optional(seq(',', sym('decimalDigits')))
        ),

        // European integer part with period thousands separators (lenient - any digit count)
        europeanInteger: seq(
          sym('plainDigits'),                                // First group: any digits
          repeat(seq('.', sym('plainDigits')), null, 1)      // Followed by .XXX groups (at least one)
        ),

        // Plain number for standard entry: period for decimal
        // Examples: 1000.00, 1000, 0.5, .5
        plainNumber: alt(
          seq(sym('plainDigits'), '.', sym('decimalDigits')),  // 1000.00
          seq('.', sym('decimalDigits')),                       // .5
          sym('plainDigits')                                    // 1000
        ),

        // Plain number for European entry: comma for decimal
        // Examples: 1000,00, 1000, 0,5
        plainNumberEuropean: alt(
          seq(sym('plainDigits'), ',', sym('decimalDigits')),  // 1000,00
          sym('plainDigits')                                    // 1000
        ),

        // Plain digits (no separators) - 1 or more digits
        plainDigits: str(repeat(range('0', '9'), null, 1)),

        // Decimal digits after decimal point - 1 or more digits
        decimalDigits: str(repeat(range('0', '9'), null, 1))
      };
    }
  ]
});
