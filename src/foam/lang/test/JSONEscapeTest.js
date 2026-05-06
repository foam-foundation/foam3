/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'JSONEscapeTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Test escape function in foam.json.Outputter',

  methods: [
    {
      name: 'runTest',
      code: function(x) {
        var outputter = foam.json.Outputter.create({});
        var escape = outputter.escape.bind(outputter);

        this.testPlainString(x, escape);
        this.testDoubleQuoteEscaping(x, escape);
        this.testBackslashEscaping(x, escape);
        this.testPreserveExistingEscapeSequences(x, escape);
        this.testForceEscapeExistingSequences(x, escape);
        this.testControlCharacters(x, escape);
        this.testMixedContent(x, escape);
        this.testIdempotency(x, escape);
        this.testEmptyString(x, escape);
        this.testUnicodeEscapePreservation(x, escape);
        this.testForceOnControlChars(x, escape);
      }
    },

    {
      name: 'testPlainString',
      code: function(x, escape) {
        x.test(escape('hello') === 'hello',             'Plain string should not be modified');
        x.test(escape('hello world') === 'hello world', 'Plain string with space should not be modified');
        x.test(escape('abc123') === 'abc123',           'Alphanumeric string should not be modified');
      }
    },

    {
      name: 'testDoubleQuoteEscaping',
      code: function(x, escape) {
        x.test(escape('Say "hi"') === 'Say \\"hi\\"', 'Double quotes should be escaped');
        x.test(escape('""') === '\\"\\"',             'Consecutive double quotes should be escaped');
        x.test(escape('a"b"c') === 'a\\"b\\"c',       'Double quotes in middle should be escaped');
      }
    },

    {
      name: 'testBackslashEscaping',
      code: function(x, escape) {
        x.test(escape('a\\b') === 'a\\\\b',         'Single backslash should be escaped');
        x.test(escape('\\') === '\\\\',             'Lone backslash should be escaped');
        x.test(escape('a\\b\\c') === 'a\\\\b\\\\c', 'Multiple backslashes should be escaped');
      }
    },

    {
      name: 'testPreserveExistingEscapeSequences',
      code: function(x, escape) {
        // Already escaped double quote should not be double-escaped
        x.test(escape('Say \\"hi\\"') === 'Say \\"hi\\"', 'Existing \\" should be preserved (idempotent)');
        // Already escaped backslash should not be double-escaped
        x.test(escape('a\\\\b') === 'a\\\\b',             'Existing \\\\ should be preserved (idempotent)');
        // Already escaped unicode should not be modified
        x.test(escape('\\u0041') === '\\u0041',           'Existing \\u00XX should be preserved');
      }
    },

    {
      name: 'testForceEscapeExistingSequences',
      code: function(x, escape) {
        // Force should escape the backslash in already-escaped sequences
        x.test(escape('Say \\"hi\\"', true), 'Say \\\\\\"hi\\\\\\"', 'Force should escape existing \\"');
        x.test(escape('a\\\\b', true) === 'a\\\\\\\\b',                 'Force should escape existing \\\\');
      }
    },

    {
      name: 'testControlCharacters',
      code: function(x, escape) {
        x.test(escape('\x00') === '\\u0000',  'Null character should be escaped as \\\\u0000');
        x.test(escape('\x01') === '\\u0001',  'SOH character should be escaped as \\\\u0001');
        x.test(escape('\n') === '\\u000a',    'Newline should be escaped as \\\\u000a');
        x.test(escape('\r') === '\\u000d',    'Carriage return should be escaped as \\\\u000d');
        x.test(escape('\t') === '\\u0009',    'Tab should be escaped as \\\\u0009');
        x.test(escape('\x1f') === '\\u001f',  'Unit separator should be escaped as \\\\u001f');
      }
    },

    {
      name: 'testMixedContent',
      code: function(x, escape) {
        x.test(escape('a"b\\c\n') === 'a\\"b\\\\c\\u000a',                          'Mixed content with quote, backslash, and newline');
        x.test(escape('Line1\nLine2\tTabbed') === 'Line1\\u000aLine2\\u0009Tabbed', 'String with newline and tab');
        x.test(escape('{"key": "value"}') === '{\\"key\\": \\"value\\"}',           'JSON-like string should have quotes escaped');
      }
    },

    {
      name: 'testIdempotency',
      code: function(x, escape) {
        var testStr = 'a"b\\c\n';
        var once = escape(testStr);
        var twice = escape(once);
        x.test(once === twice, 'Escape should be idempotent (no force)');

        var testStr2 = 'Say "hello"';
        var escaped = escape(testStr2);
        var escapedAgain = escape(escaped);
        x.test(escaped === escapedAgain, 'Idempotency with double quotes');
      }
    },

    {
      name: 'testEmptyString',
      code: function(x, escape) {
        x.test(escape('') === '', 'Empty string should return empty string');
      }
    },

    {
      name: 'testUnicodeEscapePreservation',
      code: function(x, escape) {
        x.test(escape('\\u0041\\u0042') === '\\u0041\\u0042', 'Multiple unicode escapes should be preserved');
        x.test(escape('\\u0000') === '\\u0000',               'Unicode null escape should be preserved');
        // Force should escape the backslash in unicode escape
        x.test(escape('\\u0041', true) === '\\\\u0041',       'Force should escape backslash in unicode escape');
      }
    },

    {
      name: 'testForceOnControlChars',
      code: function(x, escape) {
        // Control chars should be escaped the same way with or without force
        x.test(escape('\n') === escape('\n', true),     'Control chars escaped same with or without force');
        x.test(escape('\t') === escape('\t', true),     'Tab escaped same with or without force');
        x.test(escape('\x00') === escape('\x00', true), 'Null char escaped same with or without force');
      }
    }
  ]
});
