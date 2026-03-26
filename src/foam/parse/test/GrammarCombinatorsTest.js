/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'GrammarCombinatorsTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    Comprehensive tests for all FOAM parser combinators in foam.parse.parse.js.
    Tests normal operation, failure cases, empty input, and EOF boundary behavior.
    Expected values are shared with GrammarCombinatorsJavaTest for cross-platform parity.
  `,

  requires: [
    'foam.parse.Parsers',
    'foam.parse.StringPStream'
  ],

  methods: [
    function runTest(x) {
      var ps = this.Parsers.create();

      this.testLiteral(x, ps);
      this.testLiteralIC(x, ps);
      this.testEOF(x, ps);
      this.testAlt(x, ps);
      this.testSeq(x, ps);
      this.testSeq1(x, ps);
      this.testOptional(x, ps);
      this.testAnyChar(x, ps);
      this.testNotChars(x, ps);
      this.testChars(x, ps);
      this.testRange(x, ps);
      this.testRepeat(x, ps);
      this.testRepeat0(x, ps);
      this.testNot(x, ps);
      this.testPeek(x, ps);
      this.testStr(x, ps);
      this.testUntil(x, ps);
      this.testUntil0(x, ps);
      this.testInfiniteLoopPrevention(x, ps);
    },

    function doParse(ps, parser, input) {
      var pstream = this.StringPStream.create();
      pstream.setString(input);
      return parser.parse(pstream, ps);
    },

    function val(ps, parser, input) {
      var r = this.doParse(ps, parser, input);
      return r ? r.value : undefined;
    },

    // ==================== Literal ====================
    function testLiteral(x, ps) {
      var p = ps.literal('hello');
      x.test(this.val(ps, p, 'hello') === 'hello',
        'literal: should match exact string');
      x.test(this.doParse(ps, p, 'world') == null,
        'literal: should fail on non-matching input');
      x.test(this.doParse(ps, p, '') == null,
        'literal: should fail on empty input');

      var pEof = ps.seq(ps.literal('abc'), ps.eof());
      x.test(this.doParse(ps, pEof, 'abc') != null,
        'literal+eof: should match when input exactly consumed');
      x.test(this.doParse(ps, pEof, 'abcd') == null,
        'literal+eof: should fail when extra chars remain');
    },

    // ==================== LiteralIC ====================
    function testLiteralIC(x, ps) {
      var p = ps.literalIC('hello');
      x.test(this.doParse(ps, p, 'HELLO') != null,
        'literalIC: should match case-insensitively (upper)');
      x.test(this.doParse(ps, p, 'Hello') != null,
        'literalIC: should match case-insensitively (mixed)');
      x.test(this.doParse(ps, p, 'hello') != null,
        'literalIC: should match case-insensitively (lower)');
      x.test(this.doParse(ps, p, '') == null,
        'literalIC: should fail on empty input');
    },

    // ==================== EOF ====================
    function testEOF(x, ps) {
      var p = ps.eof();
      x.test(this.doParse(ps, p, '') != null,
        'eof: should succeed on empty input');
      x.test(this.doParse(ps, p, 'a') == null,
        'eof: should fail on non-empty input');

      var pAfter = ps.seq(ps.literal('ab'), ps.eof());
      x.test(this.doParse(ps, pAfter, 'ab') != null,
        'eof: should succeed after consuming all input');
    },

    // ==================== Alt ====================
    function testAlt(x, ps) {
      var p = ps.alt(ps.literal('cat'), ps.literal('dog'));
      x.test(this.val(ps, p, 'cat') === 'cat',
        'alt: should match first alternative');
      x.test(this.val(ps, p, 'dog') === 'dog',
        'alt: should match second alternative');
      x.test(this.doParse(ps, p, 'bird') == null,
        'alt: should fail when no alternative matches');
      x.test(this.doParse(ps, p, '') == null,
        'alt: should fail on empty input');
    },

    // ==================== Seq ====================
    function testSeq(x, ps) {
      var p = ps.seq(ps.literal('ab'), ps.literal('cd'));
      var result = this.val(ps, p, 'abcd');
      x.test(Array.isArray(result) && result[0] === 'ab' && result[1] === 'cd',
        'seq: should match sequence and return array');
      x.test(this.doParse(ps, p, 'ab') == null,
        'seq: should fail when second part missing (EOF boundary)');
      x.test(this.doParse(ps, p, '') == null,
        'seq: should fail on empty input');
    },

    // ==================== Seq1 ====================
    function testSeq1(x, ps) {
      var p = ps.seq1(1, ps.literal('ab'), ps.literal('cd'));
      x.test(this.val(ps, p, 'abcd') === 'cd',
        'seq1: should return element at index n');
      x.test(this.doParse(ps, p, 'ab') == null,
        'seq1: should fail when sequence incomplete (EOF boundary)');
    },

    // ==================== Optional ====================
    function testOptional(x, ps) {
      var p = ps.seq(ps.optional(ps.literal('ab')), ps.literal('cd'));
      x.test(this.doParse(ps, p, 'abcd') != null,
        'optional: should match with optional part present');
      x.test(this.doParse(ps, p, 'cd') != null,
        'optional: should match without optional part');
      x.test(this.doParse(ps, p, '') == null,
        'optional: should fail if required part missing after optional');
    },

    // ==================== AnyChar ====================
    function testAnyChar(x, ps) {
      var p = ps.anyChar();
      x.test(this.val(ps, p, 'x') === 'x',
        'anyChar: should match any character');
      x.test(this.val(ps, p, '\n') === '\n',
        'anyChar: should match newline');
      x.test(this.doParse(ps, p, '') == null,
        'anyChar: should fail on empty input (EOF)');
    },

    // ==================== NotChars ====================
    function testNotChars(x, ps) {
      var p = ps.notChars('xyz');
      x.test(this.val(ps, p, 'a') === 'a',
        'notChars: should match char not in set');
      x.test(this.doParse(ps, p, 'x') == null,
        'notChars: should fail on char in excluded set');
      x.test(this.doParse(ps, p, '') == null,
        'notChars: should fail on empty input (EOF)');
    },

    // ==================== Chars ====================
    function testChars(x, ps) {
      var p = ps.chars('abc');
      x.test(this.val(ps, p, 'b') === 'b',
        'chars: should match char in set');
      x.test(this.doParse(ps, p, 'x') == null,
        'chars: should fail on char not in set');
      x.test(this.doParse(ps, p, '') == null,
        'chars: should fail on empty input (EOF)');
    },

    // ==================== Range ====================
    function testRange(x, ps) {
      var p = ps.range('a', 'z');
      x.test(this.val(ps, p, 'm') === 'm',
        'range: should match char in range');
      x.test(this.doParse(ps, p, '5') == null,
        'range: should fail on char outside range');
      x.test(this.doParse(ps, p, '') == null,
        'range: should fail on empty input (EOF)');
    },

    // ==================== Repeat ====================
    function testRepeat(x, ps) {
      var pAny = ps.str(ps.repeat(ps.anyChar()));
      x.test(this.val(ps, pAny, 'hello') === 'hello',
        'repeat: should consume all matching chars');

      var pRange = ps.str(ps.repeat(ps.range('0', '9')));
      x.test(this.val(ps, pRange, '123') === '123',
        'repeat: should match repeated range');

      x.test(this.val(ps, pAny, '') === '',
        'repeat: should return empty string on empty input (min 0)');

      var pMin = ps.str(ps.repeat(ps.range('a', 'z'), null, 2));
      x.test(this.doParse(ps, pMin, 'a') == null,
        'repeat: should fail when minimum not met');
      x.test(this.val(ps, pMin, 'ab') === 'ab',
        'repeat: should succeed when minimum met exactly');
      x.test(this.val(ps, pAny, 'abc') === 'abc',
        'repeat: should stop at EOF and return accumulated');
    },

    // ==================== Repeat0 ====================
    function testRepeat0(x, ps) {
      var p = ps.repeat0(ps.anyChar());
      x.test(this.doParse(ps, p, 'hello') != null,
        'repeat0: should consume input (value discarded)');
      x.test(this.doParse(ps, p, '') != null,
        'repeat0: should succeed on empty input');
    },

    // ==================== Not ====================
    function testNot(x, ps) {
      var p = ps.not(ps.literal('bad'), ps.anyChar());
      x.test(this.val(ps, p, 'g') === 'g',
        'not: should succeed when negated parser fails');
      x.test(this.doParse(ps, p, 'bad') == null,
        'not: should fail when negated parser succeeds');
      x.test(this.doParse(ps, p, '') == null,
        'not: should fail on empty when else parser (anyChar) fails at EOF');
    },

    // ==================== Peek ====================
    function testPeek(x, ps) {
      var p = ps.seq(ps.peek(ps.literal('ab')), ps.literal('ab'));
      x.test(this.doParse(ps, p, 'ab') != null,
        'peek: should match without consuming input');
      x.test(this.doParse(ps, p, 'cd') == null,
        'peek: should fail when peeked parser fails');
      x.test(this.doParse(ps, p, '') == null,
        'peek: should fail on empty input');
    },

    // ==================== Str ====================
    function testStr(x, ps) {
      var p = ps.str(ps.repeat(ps.range('a', 'z')));
      x.test(this.val(ps, p, 'abc') === 'abc',
        'str: should join repeat result into string');
      x.test(this.val(ps, p, '') === '',
        'str: should return empty string for empty repeat');
    },

    // ==================== Until (THE CRITICAL TESTS) ====================
    function testUntil(x, ps) {
      var nl = ps.literal('\n');
      var untilNl      = ps.str(ps.until(nl));
      var untilEof     = ps.str(ps.until(ps.eof()));
      var untilNlOrEof = ps.str(ps.until(ps.alt(nl, ps.eof())));

      // Normal: until newline
      x.test(this.val(ps, untilNl, 'hello\n') === 'hello',
        'until(nl): should consume until newline');

      // EOF terminator: until(eof())
      x.test(this.val(ps, untilEof, 'hello') === 'hello',
        'until(eof()): should consume all input to EOF');

      // Alt terminator: until(alt(nl, eof))
      x.test(this.val(ps, untilNlOrEof, 'hello\n') === 'hello',
        'until(alt(nl,eof)): should stop at newline');
      x.test(this.val(ps, untilNlOrEof, 'hello') === 'hello',
        'until(alt(nl,eof)): should stop at EOF when no newline');

      // Empty input with eof terminator
      x.test(this.val(ps, untilEof, '') === '',
        'until(eof()): should return empty string on empty input');

      // Empty input with nl terminator - should fail
      x.test(this.doParse(ps, untilNl, '') == null,
        'until(nl): should fail on empty input (no newline found)');

      // EOF boundary: no trailing newline with nl-only terminator should fail
      x.test(this.doParse(ps, untilNl, 'hello') == null,
        'until(nl): should fail when no newline before EOF');

      // Multiple lines: only consumes first line
      x.test(this.val(ps, untilNl, 'line1\nline2') === 'line1',
        'until(nl): should only consume first line');
    },

    // ==================== Until0 (THE CRITICAL TESTS) ====================
    function testUntil0(x, ps) {
      var nl = ps.literal('\n');
      var until0Nl      = ps.until0(nl);
      var until0Eof     = ps.until0(ps.eof());
      var until0NlOrEof = ps.until0(ps.alt(nl, ps.eof()));

      // Normal: until0 newline
      x.test(this.doParse(ps, until0Nl, 'hello\n') != null,
        'until0(nl): should consume until newline (discard value)');

      // EOF terminator
      x.test(this.doParse(ps, until0Eof, 'hello') != null,
        'until0(eof()): should consume all input to EOF');

      // Alt terminator
      x.test(this.doParse(ps, until0NlOrEof, 'hello\n') != null,
        'until0(alt(nl,eof)): should stop at newline');
      x.test(this.doParse(ps, until0NlOrEof, 'hello') != null,
        'until0(alt(nl,eof)): should stop at EOF when no newline');

      // Empty input with eof terminator
      x.test(this.doParse(ps, until0Eof, '') != null,
        'until0(eof()): should succeed on empty input');

      // Empty input with nl terminator - should fail
      x.test(this.doParse(ps, until0Nl, '') == null,
        'until0(nl): should fail on empty input (no newline found)');

      // No trailing newline - should fail
      x.test(this.doParse(ps, until0Nl, 'hello') == null,
        'until0(nl): should fail when no newline before EOF');
    },

    // ==================== Infinite Loop Prevention ====================
    // These test the original bug from PR #4855: until/until0 with a
    // terminator that can never match must fail at EOF, not loop forever.
    function testInfiniteLoopPrevention(x, ps) {
      // until(literal('NEVER')) on input without 'NEVER' — must terminate
      var untilNever = ps.str(ps.until(ps.literal('NEVER')));
      x.test(this.doParse(ps, untilNever, 'no match here') == null,
        'until(impossible): should fail at EOF, not infinite loop');
      x.test(this.doParse(ps, untilNever, '') == null,
        'until(impossible): should fail on empty input, not infinite loop');

      // until0(literal('NEVER')) — same but discards value
      var until0Never = ps.until0(ps.literal('NEVER'));
      x.test(this.doParse(ps, until0Never, 'no match here') == null,
        'until0(impossible): should fail at EOF, not infinite loop');
      x.test(this.doParse(ps, until0Never, '') == null,
        'until0(impossible): should fail on empty input, not infinite loop');

      // until with a terminator that only matches specific content not in input
      var untilMarker = ps.str(ps.until(ps.literal('END_MARKER')));
      x.test(this.doParse(ps, untilMarker, 'some random text without the marker') == null,
        'until(missing marker): should fail at EOF, not infinite loop');

      // Single character input, terminator never found
      x.test(this.doParse(ps, untilNever, 'x') == null,
        'until(impossible): should fail on single char input');
    }
  ]
});
