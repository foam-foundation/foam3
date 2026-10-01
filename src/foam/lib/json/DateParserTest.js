/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json',
  name: 'DateParserTest',
  extends: 'foam.core.test.Test',

  documentation: `Covers every wire form foam.lib.json.DateParser accepts.
    Each instant form is exercised in both the bare and double-quoted variants
    so the canonical JSON date shape ("YYYY-MM-DD") doesn't regress.`,

  javaImports: [
    'foam.lib.json.DateParser',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.PStream',
    'foam.lib.parse.StringPStream',
    'java.util.Calendar',
    'java.util.Date',
    'java.util.TimeZone'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DateParserTest_QuotedDateOnly(x);
        DateParserTest_BareDateOnly(x);
        DateParserTest_AlternateDateOnlySeparator(x);
        DateParserTest_QuotedFullIso(x);
        DateParserTest_BareFullIso(x);
        DateParserTest_FullIsoWithMillis(x);
        DateParserTest_SpaceSeparatedDateTime(x);
        DateParserTest_EpochMillis(x);
        DateParserTest_Null(x);
        DateParserTest_RejectsUnterminatedQuote(x);
        DateParserTest_RejectsGarbage(x);
      `
    },

    {
      name: 'parse_',
      type: 'Object',
      args: 'String input',
      javaCode: `
        StringPStream ps = new StringPStream();
        ps.setString(input);
        PStream out = DateParser.instance().parse(ps, new ParserContextImpl());
        return out == null ? null : out.value();
      `
    },

    {
      name: 'assertYmd_',
      args: 'Context x, Object parsed, int year, int month, int day, String label',
      javaCode: `
        test(parsed instanceof Date, label + ": parsed value is a Date (was: " + (parsed == null ? "null" : parsed.getClass().getName()) + ")");
        if ( ! ( parsed instanceof Date ) ) return;
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.setTime((Date) parsed);
        test(c.get(Calendar.YEAR) == year,           label + ": year " + year);
        test(c.get(Calendar.MONTH) == month - 1,     label + ": month " + month);
        test(c.get(Calendar.DAY_OF_MONTH) == day,    label + ": day " + day);
      `
    },

    {
      name: 'assertYmdHms_',
      args: 'Context x, Object parsed, int year, int month, int day, int hr, int min, int sec, String label',
      javaCode: `
        test(parsed instanceof Date, label + ": parsed value is a Date (was: " + (parsed == null ? "null" : parsed.getClass().getName()) + ")");
        if ( ! ( parsed instanceof Date ) ) return;
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.setTime((Date) parsed);
        test(c.get(Calendar.YEAR) == year,           label + ": year " + year);
        test(c.get(Calendar.MONTH) == month - 1,     label + ": month " + month);
        test(c.get(Calendar.DAY_OF_MONTH) == day,    label + ": day " + day);
        test(c.get(Calendar.HOUR_OF_DAY) == hr,      label + ": hour " + hr);
        test(c.get(Calendar.MINUTE) == min,          label + ": minute " + min);
        test(c.get(Calendar.SECOND) == sec,          label + ": second " + sec);
      `
    },

    {
      name: 'DateParserTest_QuotedDateOnly',
      args: 'Context x',
      documentation: 'Canonical JSON date shape per RFC 8259: a quoted YYYY-MM-DD string.',
      javaCode: `
        assertYmd_(x, parse_("\\"2025-07-10\\""), 2025, 7, 10, "QuotedDateOnly mid-year");
        assertYmd_(x, parse_("\\"2024-02-29\\""), 2024, 2, 29, "QuotedDateOnly leap day");
        assertYmd_(x, parse_("\\"2024-12-31\\""), 2024, 12, 31, "QuotedDateOnly year end");
        assertYmd_(x, parse_("\\"1999-01-01\\""), 1999, 1, 1, "QuotedDateOnly year start");
      `
    },

    {
      name: 'DateParserTest_BareDateOnly',
      args: 'Context x',
      documentation: 'Bare YYYY-MM-DD form (CSV / query string contexts).',
      javaCode: `
        assertYmd_(x, parse_("2025-07-10"), 2025, 7, 10, "BareDateOnly mid-year");
        assertYmd_(x, parse_("2024-02-29"), 2024, 2, 29, "BareDateOnly leap day");
      `
    },

    {
      name: 'DateParserTest_AlternateDateOnlySeparator',
      args: 'Context x',
      documentation: 'Date-only with / separator, bare and quoted.',
      javaCode: `
        assertYmd_(x, parse_("2025/07/10"),     2025, 7, 10, "Bare slash separator");
        assertYmd_(x, parse_("\\"2025/07/10\\""), 2025, 7, 10, "Quoted slash separator");
      `
    },

    {
      name: 'DateParserTest_QuotedFullIso',
      args: 'Context x',
      documentation: 'Quoted full ISO with Z (the JSON canonical instant form).',
      javaCode: `
        assertYmdHms_(x, parse_("\\"2025-07-10T14:30:45Z\\""), 2025, 7, 10, 14, 30, 45, "QuotedFullIso");
        assertYmdHms_(x, parse_("\\"2025-01-15T00:00:00Z\\""), 2025, 1, 15,  0,  0,  0, "QuotedFullIso midnight");
      `
    },

    {
      name: 'DateParserTest_BareFullIso',
      args: 'Context x',
      documentation: 'Bare full ISO with Z (newly accepted after refactor).',
      javaCode: `
        assertYmdHms_(x, parse_("2025-07-10T14:30:45Z"), 2025, 7, 10, 14, 30, 45, "BareFullIso");
      `
    },

    {
      name: 'DateParserTest_FullIsoWithMillis',
      args: 'Context x',
      documentation: 'Full ISO with fractional millis, bare and quoted.',
      javaCode: `
        Date d1 = (Date) parse_("\\"2025-07-10T14:30:45.123Z\\"");
        Date d2 = (Date) parse_("2025-07-10T14:30:45.123Z");
        test(d1 != null, "FullIsoWithMillis quoted parsed");
        test(d2 != null, "FullIsoWithMillis bare parsed");
        if ( d1 != null ) test((d1.getTime() % 1000) == 123, "FullIsoWithMillis quoted carries .123");
        if ( d2 != null ) test((d2.getTime() % 1000) == 123, "FullIsoWithMillis bare carries .123");
      `
    },

    {
      name: 'DateParserTest_SpaceSeparatedDateTime',
      args: 'Context x',
      documentation: 'YYYY-MM-DD HH:MM:SS[.fff] used by CSV and query payloads.',
      javaCode: `
        assertYmdHms_(x, parse_("2025-07-10 14:30:45"),     2025, 7, 10, 14, 30, 45, "SpaceSeparated");
        Date d = (Date) parse_("2025-07-10 14:30:45.123");
        test(d != null && (d.getTime() % 1000) == 123, "SpaceSeparated with millis carries .123");
      `
    },

    {
      name: 'DateParserTest_EpochMillis',
      args: 'Context x',
      documentation: 'Bare integer treated as epoch milliseconds.',
      javaCode: `
        Object parsed = parse_("1737028800000");
        test(parsed instanceof Date, "EpochMillis returns a Date");
        if ( parsed instanceof Date ) {
          test(((Date) parsed).getTime() == 1737028800000L, "EpochMillis preserves value");
        }
      `
    },

    {
      name: 'DateParserTest_Null',
      args: 'Context x',
      documentation: 'Literal null input maps to null.',
      javaCode: `
        StringPStream ps = new StringPStream();
        ps.setString("null");
        PStream out = DateParser.instance().parse(ps, new ParserContextImpl());
        test(out != null, "Null literal: parser advances");
        if ( out != null ) test(out.value() == null, "Null literal: value is null");
      `
    },

    {
      name: 'DateParserTest_RejectsUnterminatedQuote',
      args: 'Context x',
      documentation: 'Opening quote without a matching closing quote must fail (symmetric quoting).',
      javaCode: `
        StringPStream ps = new StringPStream();
        ps.setString("\\"2025-07-10");
        PStream out = DateParser.instance().parse(ps, new ParserContextImpl());
        test(out == null, "Unterminated quote: parser refuses input");
      `
    },

    {
      name: 'DateParserTest_RejectsGarbage',
      args: 'Context x',
      documentation: 'Non-date input must not parse.',
      javaCode: `
        StringPStream ps = new StringPStream();
        ps.setString("not-a-date");
        PStream out = DateParser.instance().parse(ps, new ParserContextImpl());
        test(out == null, "Garbage: parser refuses input");
      `
    }
  ]
});
