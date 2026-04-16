/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json.test',
  name: 'ParserOptimizationTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Regression guard for the parser-primitive micro-optimizations:
    arithmetic DoubleParser, String.intern()-free StringParser, inlined
    whitespace skip, inline property+comma in ModelParserFactory, CharLiteral
    specialization, and the StringParser indexOf fast path. Each test
    captures a behavior that the optimizations must preserve exactly.
    All tests pass against the unmodified parsers, so failures post-cherry-pick
    pinpoint the regressing optimization.
  `,

  javaImports: [
    'foam.lang.FObject',
    'foam.lib.json.DoubleParser',
    'foam.lib.json.JSONParser',
    'foam.lib.json.StringParser',
    'foam.lib.parse.PStream',
    'foam.lib.parse.Parser',
    'foam.lib.parse.ParserContext',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.StringPStream'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testDoubleParser(x);
        testStringParser(x);
        testJsonRoundtrip(x);
      `
    },
    {
      name: 'testDoubleParser',
      args: 'foam.lang.X x',
      javaCode: `
        // The arithmetic DoubleParser optimization replaces
        // StringBuilder + Double.valueOf with direct long arithmetic.
        // These tests lock in the semantics the new code must reproduce.

        test(parseDouble(x, "1e10")     != null && (double) parseDouble(x, "1e10")     == 1e10,  "DoubleParser: positive scientific exponent 1e10");
        test(parseDouble(x, "2.5E-3")   != null && (double) parseDouble(x, "2.5E-3")   == 2.5e-3,"DoubleParser: negative scientific exponent 2.5E-3");
        test(parseDouble(x, "123.456e2")!= null && (double) parseDouble(x, "123.456e2")== 12345.6,"DoubleParser: fraction + exponent 123.456e2");

        test(parseDouble(x, "007.5")    != null && (double) parseDouble(x, "007.5")    == 7.5,   "DoubleParser: leading zeros 007.5");
        test(parseDouble(x, "0")        != null && (double) parseDouble(x, "0")        == 0.0,   "DoubleParser: zero");

        Double negZero = (Double) parseDouble(x, "-0.0");
        test(negZero != null
          && Double.doubleToRawLongBits(negZero) == Double.doubleToRawLongBits(-0.0),
          "DoubleParser: -0.0 preserves IEEE-754 sign bit");

        Double maxVal = (Double) parseDouble(x, "1.7976931348623157E308");
        test(maxVal != null && maxVal == Double.MAX_VALUE,
          "DoubleParser: Double.MAX_VALUE round-trips");

        // ULP bound for an irrational decimal. Current (Double.valueOf) is
        // exactly the closest double; the arithmetic path may be off by a few
        // ULPs. 1e-15 is well within a useful tolerance.
        Double oneTenth = (Double) parseDouble(x, "0.1");
        test(oneTenth != null && Math.abs(oneTenth - 0.1) < 1e-15,
          "DoubleParser: 0.1 is within 1e-15 of the true value");

        // Negative numbers through the full path.
        test(parseDouble(x, "-1234.5678") != null && (double) parseDouble(x, "-1234.5678") == -1234.5678,
          "DoubleParser: negative decimal");
      `
    },
    {
      name: 'testStringParser',
      args: 'foam.lang.X x',
      javaCode: `
        // The intern() removal must not change observable string values.
        // The indexOf() fast path (later cherry-pick) must match the slow
        // path's output character-for-character including escape handling.

        test("hello".equals(parseString(x, "\\"hello\\"")),
          "StringParser: plain ASCII");

        test("".equals(parseString(x, "\\"\\"")),
          "StringParser: empty string");

        // Escape sequences — force the slow path through the escape parser.
        String escapes = (String) parseString(x, "\\"line\\\\nrow\\\\ttab\\\\\\"quote\\\\\\\\back\\"");
        test(escapes != null && escapes.equals("line\\nrow\\ttab\\"quote\\\\back"),
          "StringParser: escape sequences (\\n \\t \\\" \\\\)");

        // Unicode escape.
        String uni = (String) parseString(x, "\\"caf\\\\u00e9\\"");
        test("caf\\u00e9".equals(uni),
          "StringParser: unicode escape \\\\u00e9");

        // Raw non-ASCII (no escape).
        test("caf\\u00e9".equals(parseString(x, "\\"caf\\u00e9\\"")),
          "StringParser: raw non-ASCII char");

        // Single-quote delimiter.
        test("sq".equals(parseString(x, "'sq'")),
          "StringParser: single-quote delimiter");

        // Backtick delimiter.
        test("bt".equals(parseString(x, "\`bt\`")),
          "StringParser: backtick delimiter");
      `
    },
    {
      name: 'testJsonRoundtrip',
      args: 'foam.lang.X x',
      javaCode: `
        // Full JSON through FObjectParser exercises ModelParserFactory:
        // inline whitespace skip, inline property+comma, CharLiteral-dispatched
        // { : , } literals, and the property-alt tree.

        JSONParser p = new JSONParser();
        p.setX(x);
        String klass = FObjectParserJavaTestClass.class.getName();

        // Zero whitespace.
        FObject o1 = p.parseString("{class:\\""+klass+"\\",id:\\"x\\"}");
        test(o1 != null && "x".equals(((foam.core.test.Test) o1).getId()),
          "JSON roundtrip: zero whitespace");

        // Leading + trailing whitespace around the outer object. Current
        // FObjectParser wraps the body in Whitespace.instance() so outer ws
        // is always skipped. Inter-token ws between the class prefix and the
        // first comma is NOT tested — the class prefix uses Optional(",")
        // with no leading whitespace, which is a known quirk of the current
        // grammar.
        FObject o2 = p.parseString("   {class:\\""+klass+"\\",id:\\"y\\"}   ");
        test(o2 != null && "y".equals(((foam.core.test.Test) o2).getId()),
          "JSON roundtrip: leading/trailing outer whitespace");

        // Mixed ws inside a property value and around structure — LF/CR/tab
        // between the body properties (a position where the parser's SKIP
        // parser runs). Not between class and its comma.
        FObject o3 = p.parseString("{class:\\""+klass+"\\",\\n\\tid:\\"z\\"\\r\\n}");
        test(o3 != null && "z".equals(((foam.core.test.Test) o3).getId()),
          "JSON roundtrip: LF/CR/tab between body properties");

        // Single property (no trailing comma).
        FObject o4 = p.parseString("{class:\\""+klass+"\\"}");
        test(o4 != null,
          "JSON roundtrip: single-property model, no trailing comma");

        // Multi-property, exercises inline property+comma in sequence.
        FObject o5 = p.parseString("{class:\\""+klass+"\\",id:\\"a\\",source:\\"S\\"}");
        test(o5 != null && "a".equals(((foam.core.test.Test) o5).getId()) && "S".equals(((foam.core.test.Test) o5).getSource()),
          "JSON roundtrip: multi-property");

        // Malformed: adjacent commas — must fail or produce partial. Accept
        // null (parse fail) OR an FObject where the second property wasn't
        // matched. Either is safer than silently accepting garbage.
        FObject bad1 = p.parseString("{class:\\""+klass+"\\",,id:\\"bad\\"}");
        test(bad1 == null || ! "bad".equals(((foam.core.test.Test) bad1).getId()),
          "JSON roundtrip: adjacent commas rejected or partial");

        // Malformed: missing comma BETWEEN body properties. The class
        // prefix uses Optional(",") so a missing comma after "class:\\"X\\""
        // is intentionally tolerated — we can't assert on that position. This
        // checks the body property loop specifically (after class+comma).
        FObject bad2 = p.parseString("{class:\\""+klass+"\\",id:\\"a\\" source:\\"bad\\"}");
        test(bad2 == null || ! "bad".equals(((foam.core.test.Test) bad2).getSource()),
          "JSON roundtrip: missing comma between body properties rejected or partial");
      `
    },
    {
      name: 'parseDouble',
      args: 'foam.lang.X x, String input',
      type: 'Object',
      javaCode: `
        StringPStream ps = new StringPStream(input);
        ParserContext ctx = new ParserContextImpl();
        ctx.set("X", x);
        PStream out = DoubleParser.instance().parse(ps, ctx);
        return out == null ? null : out.value();
      `
    },
    {
      name: 'parseString',
      args: 'foam.lang.X x, String input',
      type: 'Object',
      javaCode: `
        StringPStream ps = new StringPStream(input);
        ParserContext ctx = new ParserContextImpl();
        ctx.set("X", x);
        PStream out = StringParser.instance().parse(ps, ctx);
        return out == null ? null : out.value();
      `
    }
  ]
});
