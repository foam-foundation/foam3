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
        testPropertyKeyMatching(x);
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

        // Exact: within the long-safe digit range the arithmetic path is
        // bit-for-bit equal to Double.valueOf (single correctly-rounded
        // division), verified by a 2M-value random sweep.
        Double oneTenth = (Double) parseDouble(x, "0.1");
        test(oneTenth != null
          && Double.doubleToRawLongBits(oneTenth) == Double.doubleToRawLongBits(0.1),
          "DoubleParser: 0.1 is bit-exact");

        // Negative numbers through the full path.
        test(parseDouble(x, "-1234.5678") != null && (double) parseDouble(x, "-1234.5678") == -1234.5678,
          "DoubleParser: negative decimal");

        // ---- Overflow / precision regressions: these values overflow the
        // long accumulators (>18 digits) or need a correctly-rounded exponent,
        // so they must go through the Double.valueOf fallback. Each one
        // produced a silently wrong value on the arithmetic-only path
        // (e.g. 12345678901234567890 came back NEGATIVE, ~-6.1e18).
        assertExact(x, "12345678901234567890",
          "DoubleParser: 20 int digits (long overflow) falls back correctly");
        assertExact(x, "-98765432109876543210.5",
          "DoubleParser: negative 20-digit with fraction falls back correctly");
        assertExact(x, "0.1234567890123456789012345",
          "DoubleParser: 25 frac digits (fracScale overflow) falls back correctly");
        assertExact(x, "184467440737095516160.0",
          "DoubleParser: 2^64*10 (parsed as 0.0 unfixed) falls back correctly");
        assertExact(x, "4.9e-324",
          "DoubleParser: min denormal (collapsed to 0.0 via Math.pow unfixed)");
        assertExact(x, "-6.02e23",
          "DoubleParser: -6.02e23 (1 ULP off via Math.pow unfixed) is bit-exact");
        assertExact(x, "1e22",
          "DoubleParser: 1e22 exponent boundary is bit-exact");
        assertExact(x, "3.14159e-100",
          "DoubleParser: small exponent value is bit-exact");

        // Malformed exponent must backtrack, not crash: the Double.valueOf
        // fallback would throw NumberFormatException on "1e" if the bare
        // marker were consumed.
        Object bareExp = parseDouble(x, "1e");
        test(bareExp != null && (double) (Double) bareExp == 1.0,
          "DoubleParser: '1e' (no exponent digits) parses as 1.0");
        Object signExp = parseDouble(x, "2E+");
        test(signExp != null && (double) (Double) signExp == 2.0,
          "DoubleParser: '2E+' (sign, no digits) parses as 2.0");
      `
    },
    {
      name: 'assertExact',
      args: 'foam.lang.X x, String input, String message',
      javaCode: `
        double expect = Double.valueOf(input);
        Object got    = parseDouble(x, input);
        test(got != null
          && Double.doubleToRawLongBits((Double) got) == Double.doubleToRawLongBits(expect),
          message + " (got=" + got + ", expect=" + expect + ")");
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
      name: 'testPropertyKeyMatching',
      args: 'foam.lang.X x',
      javaCode: `
        // Property names resolve via a hashed exact-span match; these lock in
        // the cases a prefix tree handled implicitly.
        JSONParser p = new JSONParser();
        p.setX(x);

        // one property name is a prefix of another: both resolve, either order
        foam.core.auth.User u = (foam.core.auth.User) p.parseString(
          "{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":7,\\"email\\":\\"a@b.c\\",\\"emailVerified\\":true}");
        test(u != null && "a@b.c".equals(u.getEmail()) && u.getEmailVerified(),
          "KeyMatch: prefix-pair properties email/emailVerified both resolve");
        u = (foam.core.auth.User) p.parseString(
          "{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":7,\\"emailVerified\\":true,\\"email\\":\\"a@b.c\\"}");
        test(u != null && "a@b.c".equals(u.getEmail()) && u.getEmailVerified(),
          "KeyMatch: prefix-pair properties resolve in the other order too");

        // unquoted keys, and whitespace between the key and the colon
        u = (foam.core.auth.User) p.parseString(
          "{class:\\"foam.core.auth.User\\", id:7, email : \\"a@b.c\\"}");
        test(u != null && "a@b.c".equals(u.getEmail()),
          "KeyMatch: unquoted key with whitespace before the colon");

        // unknown property is skipped, later known ones still land
        u = (foam.core.auth.User) p.parseString(
          "{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":7,\\"notAProperty\\":\\"zz\\",\\"email\\":\\"a@b.c\\"}");
        test(u != null && "a@b.c".equals(u.getEmail()),
          "KeyMatch: unknown property skipped, following properties parse");

        // a key that extends a real name past its span is unknown, not a prefix hit
        u = (foam.core.auth.User) p.parseString(
          "{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":7,\\"emailX\\":\\"zz\\",\\"email\\":\\"a@b.c\\"}");
        test(u != null && "a@b.c".equals(u.getEmail()),
          "KeyMatch: a longer unknown key does not match its known prefix");
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

        // Inline // comments inside the object body — the pre-optimization
        // SKIP (Repeat0(Alt(Seq0(Literal("//"), Until(NL)), WS))) tolerated
        // these; the inlined whitespace-only loops regressed them. Comments
        // before a property and between the ':' and its value.
        FObject c1 = p.parseString("{class:\\""+klass+"\\",\\n// before property\\nid:\\"cm\\"}");
        test(c1 != null && "cm".equals(((foam.core.test.Test) c1).getId()),
          "JSON roundtrip: // comment before a body property");

        FObject c2 = p.parseString("{class:\\""+klass+"\\",id: // after colon\\n\\"cn\\",source:\\"S2\\"}");
        test(c2 != null && "cn".equals(((foam.core.test.Test) c2).getId()) && "S2".equals(((foam.core.test.Test) c2).getSource()),
          "JSON roundtrip: // comment between ':' and the value");
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
