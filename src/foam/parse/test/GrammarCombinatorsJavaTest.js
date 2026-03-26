/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'GrammarCombinatorsJavaTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Java parity tests for all FOAM parser combinators in foam.lib.parse.*.
    Expected values match GrammarCombinatorsTest.js for cross-platform parity.
  `,

  javaImports: [
    'foam.lib.parse.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testLiteral();
        testLiteralIC();
        testEOF();
        testAlt();
        testSeq();
        testSeq1();
        testOptional();
        testAnyChar();
        testNotChars();
        testChars();
        testRange();
        testRepeat();
        testRepeat0();
        testNot();
        testUntil();
        testInfiniteLoopPrevention();
      `
    },

    // === Helpers ===
    {
      name: 'doParse',
      args: [
        { name: 'p', javaType: 'Parser' },
        { name: 'input', javaType: 'String' }
      ],
      javaType: 'PStream',
      javaCode: `
        StringPStream ps = new StringPStream(input);
        return ps.apply(p, new ParserContextImpl());
      `
    },
    {
      name: 'strValue',
      args: [ { name: 'ps', javaType: 'PStream' } ],
      javaType: 'String',
      javaCode: `
        if ( ps == null || ps.value() == null ) return null;
        Object val = ps.value();
        if ( val instanceof Object[] ) {
          StringBuilder sb = new StringBuilder();
          for ( Object o : (Object[]) val ) {
            if ( o != null ) sb.append(o.toString());
          }
          return sb.toString();
        }
        return val.toString();
      `
    },

    // === Literal ===
    {
      name: 'testLiteral',
      javaCode: `
        Parser p = Literal.create("hello");
        PStream result = doParse(p, "hello");
        test(result != null && "hello".equals(strValue(result)),
          "literal: should match exact string");
        test(doParse(p, "world") == null,
          "literal: should fail on non-matching input");
        test(doParse(p, "") == null,
          "literal: should fail on empty input");

        // EOF boundary
        Parser pEof = new Seq(Literal.create("abc"), EOF.instance());
        test(doParse(pEof, "abc") != null,
          "literal+eof: should match when input exactly consumed");
        test(doParse(pEof, "abcd") == null,
          "literal+eof: should fail when extra chars remain");
      `
    },

    // === LiteralIC ===
    {
      name: 'testLiteralIC',
      javaCode: `
        Parser p = new LiteralIC("hello");
        test(doParse(p, "HELLO") != null,
          "literalIC: should match case-insensitively (upper)");
        test(doParse(p, "Hello") != null,
          "literalIC: should match case-insensitively (mixed)");
        test(doParse(p, "hello") != null,
          "literalIC: should match case-insensitively (lower)");
        test(doParse(p, "") == null,
          "literalIC: should fail on empty input");
      `
    },

    // === EOF ===
    {
      name: 'testEOF',
      javaCode: `
        Parser p = EOF.instance();
        test(doParse(p, "") != null,
          "eof: should succeed on empty input");
        test(doParse(p, "a") == null,
          "eof: should fail on non-empty input");

        Parser pAfter = new Seq(Literal.create("ab"), EOF.instance());
        test(doParse(pAfter, "ab") != null,
          "eof: should succeed after consuming all input");
      `
    },

    // === Alt ===
    {
      name: 'testAlt',
      javaCode: `
        Parser p = new Alt(Literal.create("cat"), Literal.create("dog"));
        PStream r1 = doParse(p, "cat");
        test(r1 != null && "cat".equals(strValue(r1)),
          "alt: should match first alternative");
        PStream r2 = doParse(p, "dog");
        test(r2 != null && "dog".equals(strValue(r2)),
          "alt: should match second alternative");
        test(doParse(p, "bird") == null,
          "alt: should fail when no alternative matches");
        test(doParse(p, "") == null,
          "alt: should fail on empty input");
      `
    },

    // === Seq ===
    {
      name: 'testSeq',
      javaCode: `
        Parser p = new Seq(Literal.create("ab"), Literal.create("cd"));
        PStream result = doParse(p, "abcd");
        test(result != null, "seq: should match sequence");
        Object[] arr = result != null ? (Object[]) result.value() : null;
        test(arr != null && arr.length == 2 && "ab".equals(arr[0].toString()) && "cd".equals(arr[1].toString()),
          "seq: should return array of matched parts");
        test(doParse(p, "ab") == null,
          "seq: should fail when second part missing (EOF boundary)");
        test(doParse(p, "") == null,
          "seq: should fail on empty input");
      `
    },

    // === Seq1 ===
    {
      name: 'testSeq1',
      javaCode: `
        Parser p = new Seq1(1, Literal.create("ab"), Literal.create("cd"));
        PStream result = doParse(p, "abcd");
        test(result != null && "cd".equals(strValue(result)),
          "seq1: should return element at index n");
        test(doParse(p, "ab") == null,
          "seq1: should fail when sequence incomplete (EOF boundary)");
      `
    },

    // === Optional ===
    {
      name: 'testOptional',
      javaCode: `
        Parser p = new Seq(new Optional(Literal.create("ab")), Literal.create("cd"));
        test(doParse(p, "abcd") != null,
          "optional: should match with optional part present");
        test(doParse(p, "cd") != null,
          "optional: should match without optional part");
        test(doParse(p, "") == null,
          "optional: should fail if required part missing after optional");
      `
    },

    // === AnyChar ===
    {
      name: 'testAnyChar',
      javaCode: `
        Parser p = AnyChar.instance();
        PStream result = doParse(p, "x");
        test(result != null && result.value().equals('x'),
          "anyChar: should match any character");
        test(doParse(p, "") == null,
          "anyChar: should fail on empty input (EOF)");
      `
    },

    // === NotChars ===
    {
      name: 'testNotChars',
      javaCode: `
        Parser p = new NotChars("xyz");
        PStream result = doParse(p, "a");
        test(result != null && result.value().equals('a'),
          "notChars: should match char not in set");
        test(doParse(p, "x") == null,
          "notChars: should fail on char in excluded set");
        test(doParse(p, "") == null,
          "notChars: should fail on empty input (EOF)");
      `
    },

    // === Chars ===
    {
      name: 'testChars',
      javaCode: `
        Parser p = new Chars("abc");
        PStream result = doParse(p, "b");
        test(result != null && result.value().equals('b'),
          "chars: should match char in set");
        test(doParse(p, "x") == null,
          "chars: should fail on char not in set");
        test(doParse(p, "") == null,
          "chars: should fail on empty input (EOF)");
      `
    },

    // === Range ===
    {
      name: 'testRange',
      javaCode: `
        Parser p = Range.create('a', 'z');
        PStream result = doParse(p, "m");
        test(result != null && result.value().equals('m'),
          "range: should match char in range");
        test(doParse(p, "5") == null,
          "range: should fail on char outside range");
        test(doParse(p, "") == null,
          "range: should fail on empty input (EOF)");
      `
    },

    // === Repeat ===
    {
      name: 'testRepeat',
      javaCode: `
        Parser pAny = new Repeat(AnyChar.instance());
        PStream result = doParse(pAny, "hello");
        test(result != null && ((Object[]) result.value()).length == 5,
          "repeat: should consume all matching chars");

        Parser pDigit = new Repeat(Range.create('0', '9'));
        PStream r2 = doParse(pDigit, "123");
        test(r2 != null && ((Object[]) r2.value()).length == 3,
          "repeat: should match repeated range");

        // Empty input - repeat with default min -1 succeeds
        PStream rEmpty = doParse(pAny, "");
        test(rEmpty != null && ((Object[]) rEmpty.value()).length == 0,
          "repeat: should return empty array on empty input (min 0)");

        // Minimum not met
        Parser pMin = new Repeat(Range.create('a', 'z'), 2);
        test(doParse(pMin, "a") == null,
          "repeat: should fail when minimum not met");
        PStream rMin = doParse(pMin, "ab");
        test(rMin != null && ((Object[]) rMin.value()).length == 2,
          "repeat: should succeed when minimum met exactly");
      `
    },

    // === Repeat0 ===
    {
      name: 'testRepeat0',
      javaCode: `
        Parser p = new Repeat0(AnyChar.instance());
        test(doParse(p, "hello") != null,
          "repeat0: should consume input (value discarded)");
        test(doParse(p, "") != null,
          "repeat0: should succeed on empty input");
      `
    },

    // === Not ===
    {
      name: 'testNot',
      javaCode: `
        Parser p = new Not(Literal.create("bad"), AnyChar.instance());
        PStream result = doParse(p, "g");
        test(result != null && result.value().equals('g'),
          "not: should succeed when negated parser fails");
        test(doParse(p, "bad") == null,
          "not: should fail when negated parser succeeds");
        // Empty: literal fails, not passes, but anyChar fails at EOF
        test(doParse(p, "") == null,
          "not: should fail on empty when else parser (anyChar) fails at EOF");
      `
    },

    // === Until (THE CRITICAL TESTS) ===
    {
      name: 'testUntil',
      javaCode: `
        Parser nl = Literal.create("\\n");
        Parser untilNl = new Until(nl);
        Parser untilEof = new Until(EOF.instance());
        Parser untilNlOrEof = new Until(new Alt(nl, EOF.instance()));

        // Normal: until newline
        PStream r1 = doParse(untilNl, "hello\\n");
        test(r1 != null && strValue(r1).equals("hello"),
          "until(nl): should consume until newline");

        // EOF terminator
        PStream r2 = doParse(untilEof, "hello");
        test(r2 != null && strValue(r2).equals("hello"),
          "until(eof()): should consume all input to EOF");

        // Alt terminator: nl or eof
        PStream r3 = doParse(untilNlOrEof, "hello\\n");
        test(r3 != null && strValue(r3).equals("hello"),
          "until(alt(nl,eof)): should stop at newline");
        PStream r4 = doParse(untilNlOrEof, "hello");
        test(r4 != null && strValue(r4).equals("hello"),
          "until(alt(nl,eof)): should stop at EOF when no newline");

        // Empty input with eof terminator
        PStream r5 = doParse(untilEof, "");
        test(r5 != null && strValue(r5).equals(""),
          "until(eof()): should return empty string on empty input");

        // Empty input with nl terminator - should fail
        test(doParse(untilNl, "") == null,
          "until(nl): should fail on empty input (no newline found)");

        // No trailing newline - should fail
        test(doParse(untilNl, "hello") == null,
          "until(nl): should fail when no newline before EOF");

        // Multiple lines: only consume first
        PStream r6 = doParse(untilNl, "line1\\nline2");
        test(r6 != null && strValue(r6).equals("line1"),
          "until(nl): should only consume first line");
      `
    },

    // === Infinite Loop Prevention ===
    {
      name: 'testInfiniteLoopPrevention',
      javaCode: `
        // until(literal("NEVER")) on input without "NEVER" — must terminate
        Parser untilNever = new Until(Literal.create("NEVER"));
        test(doParse(untilNever, "no match here") == null,
          "until(impossible): should fail at EOF, not infinite loop");
        test(doParse(untilNever, "") == null,
          "until(impossible): should fail on empty input, not infinite loop");

        // until with a terminator that only matches specific content not in input
        Parser untilMarker = new Until(Literal.create("END_MARKER"));
        test(doParse(untilMarker, "some random text without the marker") == null,
          "until(missing marker): should fail at EOF, not infinite loop");

        // Single character input, terminator never found
        test(doParse(untilNever, "x") == null,
          "until(impossible): should fail on single char input");
      `
    }
  ]
});
