/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json.test',
  name: 'JSONDateParserTest',
  extends: 'foam.core.test.Test',

  documentation: `
    foam.lib.json.DateParser — the parser journal replay and JSON input run
    dates through. Covers each Alt branch (quoted ISO instant, space-separated
    datetime, quoted date-only, bare epoch millis, null) and the
    fraction-of-a-second rule: ISO 8601 allows 1-9 digits, scaled to
    milliseconds, truncated past the third (java.util.Date has no
    sub-millisecond precision).
  `,

  javaImports: [
    'foam.lib.json.DateParser',
    'foam.lib.parse.PStream',
    'foam.lib.parse.ParserContext',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.StringPStream'
  ],

  methods: [
    {
      name: 'parseDate',
      type: 'java.util.Date',
      args: 'foam.lang.X x, String input',
      javaCode: `
        StringPStream ps = new StringPStream(input);
        ParserContext ctx = new ParserContextImpl();
        ctx.set("X", x);
        PStream out = DateParser.instance().parse(ps, ctx);
        return out == null ? null : (java.util.Date) out.value();
      `
    },
    {
      name: 'runTest',
      javaCode: `
        // ---- branch coverage ----
        long base = java.time.Instant.parse("1982-07-07T23:12:00Z").toEpochMilli();

        java.util.Date d = parseDate(x, "395536320000");
        test(d != null && d.getTime() == 395536320000L, "bare epoch millis parse");

        d = parseDate(x, "\\"1982-07-07\\"");
        test(d != null && d.getTime() == java.time.Instant.parse("1982-07-07T00:00:00Z").toEpochMilli(), "quoted date-only parses to midnight UTC");

        d = parseDate(x, "1982/07/07 23:12:00");
        test(d != null && d.getTime() == base, "space-separated datetime with slash separators");

        StringPStream nps = new StringPStream("null");
        ParserContext nctx = new ParserContextImpl();
        PStream nout = DateParser.instance().parse(nps, nctx);
        test(nout != null && nout.value() == null, "null literal parses to a null value");

        // ---- fraction of a second ----
        // ISO 8601 allows any number of fraction-of-a-second digits and journals
        // in the wild carry one ("...T23:12:00.0Z"). DateParser accepts 1-9
        // digits scaled to milliseconds, truncating past the third
        // (java.util.Date has no sub-millisecond precision). Exactly three
        // digits parse bit-for-bit as before.
        d = parseDate(x, "\\"1982-07-07T23:12:00.0Z\\"");
        test(d != null && d.getTime() == base, "DateParser: '.0' is zero milliseconds");
        d = parseDate(x, "\\"1982-07-07T23:12:00.5Z\\"");
        test(d != null && d.getTime() == base + 500, "DateParser: '.5' is 500 ms, not 5");
        d = parseDate(x, "\\"1982-07-07T23:12:00.05Z\\"");
        test(d != null && d.getTime() == base + 50, "DateParser: '.05' is 50 ms");
        d = parseDate(x, "\\"1982-07-07T23:12:00.123Z\\"");
        test(d != null && d.getTime() == base + 123, "DateParser: '.123' is 123 ms as before");
        d = parseDate(x, "\\"1982-07-07T23:12:00.012Z\\"");
        test(d != null && d.getTime() == base + 12, "DateParser: '.012' is 12 ms as before");
        d = parseDate(x, "\\"1982-07-07T23:12:00.123456Z\\"");
        test(d != null && d.getTime() == base + 123, "DateParser: '.123456' truncates to 123 ms");
        d = parseDate(x, "\\"1982-07-07T23:12:00.999999999Z\\"");
        test(d != null && d.getTime() == base + 999, "DateParser: nine digits truncate to 999 ms");
        d = parseDate(x, "\\"1982-07-07T23:12:00Z\\"");
        test(d != null && d.getTime() == base, "DateParser: no fraction still parses");

        test(parseDate(x, "\\"1982-07-07T23:12:00.Z\\"") == null, "DateParser: a bare '.' with no digits does not parse");
        test(parseDate(x, "\\"1982-07-07T23:12:00.0123456789Z\\"") == null, "DateParser: ten fraction digits do not parse");

        long base2 = java.time.Instant.parse("2024-01-01T10:00:00Z").toEpochMilli();
        d = parseDate(x, "2024-01-01 10:00:00.5");
        test(d != null && d.getTime() == base2 + 500, "DateParser: space-separated datetime '.5' is 500 ms");
      `
    }
  ]
});
