/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplayJournalGenerator',
  flags: ['java'],

  documentation: `
    Builds journal entry bodies (the text between "c(" and ")") for ANY
    ClassInfo by walking its PropertyInfo axioms and emitting a value per
    property type. The syntax matches exactly what
    foam.lib.json.ModelParserFactory / FObjectParser accept: unquoted
    property keys (shortName when set, else name — see
    foam.lib.formatter.JSONFObjectFormatter.getPropertyName), double-quoted
    escaped strings, bare numbers, bare epoch millis for Date/DateTime (both
    use AbstractDatePropertyInfo and foam.lib.json.DateParser, which accepts
    a bare long), bare ordinal ints for Enum (AbstractEnumPropertyInfo's
    parser__ is Alt(IntParser, StringParser)), bare longs for Reference
    (ReferenceJavaRefinement delegates javaInfoType to the referenced id
    property, so a Long-keyed reference behaves exactly like a Long
    property), true/false for Boolean, ["a","b"] for StringArray
    (AbstractArrayPropertyInfo + StringArrayParser), and
    {class:"pkg.Class",...} for nested FObjectProperty
    (AbstractFObjectPropertyInfo + FObjectParser, which is null-tolerant).

    Knobs (see Options): string length (SHORT 8 chars / LONG 256 chars),
    string cardinality (REPEATED from a fixed 100-value pool / UNIQUE fresh
    per call), escapes (NONE / SOME — ~10% of strings contain a literal
    quote and newline), and nulls (NONE / SOME — ~20% of non-id properties
    written as the JSON literal null). Every combination is safe to parse:
    for property types whose own jsonParser() is null-aware (only
    FObjectProperty, via foam.lib.json.ObjectNullParser) "null" sets the
    field to null; for every other type (String/Long/Double/.../StringArray)
    the matching PropertyInfo's value parser fails on "null" and
    foam.lib.json.ModelParserFactory's per-property Alt falls back to
    foam.lib.json.UnknownPropertyParser, which silently drops the
    unrecognized "key:null" pair rather than throwing. Either way the
    surrounding object still parses to a non-null FObject.
  `,

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.PropertyInfo',
    'foam.lang.AbstractFObjectPropertyInfo',
    'foam.lang.AbstractEnumPropertyInfo',
    'foam.lang.AbstractArrayPropertyInfo',
    'foam.lang.AbstractDatePropertyInfo',
    'foam.lang.AbstractLongPropertyInfo',
    'foam.lang.AbstractDoublePropertyInfo',
    'foam.lang.AbstractIntPropertyInfo',
    'foam.lang.AbstractBooleanPropertyInfo',
    'foam.lang.AbstractStringPropertyInfo',
    'foam.util.SafetyUtil',
    'java.util.List',
    'java.util.Random'
  ],

  javaCode: `
    /** Generation knobs for generateBody(). Plain field bag, no builder. */
    public static final class Options {
      public boolean longStrings;
      public boolean uniqueStrings;
      public boolean someEscapes;
      public boolean someNulls;
    }

    private static final int STR_LEN_SHORT = 8;
    private static final int STR_LEN_LONG  = 256;
    private static final int STR_POOL_SIZE = 100;

    private static final String ALPHA =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    // Fixed pools for REPEATED string cardinality: built once, deterministically
    // seeded, so every benchmark run generates byte-identical bodies.
    private static final String[] SHORT_POOL     = buildPool(STR_LEN_SHORT, false, 1L);
    private static final String[] LONG_POOL      = buildPool(STR_LEN_LONG,  false, 2L);
    // ~10% of entries (every 10th) carry an embedded quote + newline, so
    // sampling uniformly from this pool yields ~10% escaped values.
    private static final String[] SHORT_POOL_ESC = buildPool(STR_LEN_SHORT, true,  3L);

    private static String[] buildPool(int len, boolean withEscapes, long seed) {
      Random r = new Random(seed);
      String[] pool = new String[STR_POOL_SIZE];
      for ( int i = 0 ; i < pool.length ; i++ ) {
        pool[i] = randomString(r, len, withEscapes && i % 10 == 0);
      }
      return pool;
    }

    /** Plain alphanumeric string; if withEscape, embeds a literal quote and newline. */
    private static String randomString(Random r, int len, boolean withEscape) {
      StringBuilder sb = new StringBuilder(len + 2);
      for ( int i = 0 ; i < len ; i++ ) {
        sb.append(ALPHA.charAt(r.nextInt(ALPHA.length())));
      }
      if ( withEscape ) {
        int mid = len / 2;
        sb.insert(mid, '"');
        sb.insert(mid, (char) 10);
      }
      return sb.toString();
    }

    /** Appends s as a double-quoted, escaped JSON string literal. */
    private static void appendEscapedString(StringBuilder sb, String s) {
      char backslash = (char) 92;
      sb.append('"');
      int len = s.length();
      for ( int i = 0 ; i < len ; i++ ) {
        char c = s.charAt(i);
        if ( c == '"' ) {
          sb.append(backslash).append('"');
        } else if ( c == (char) 10 ) {
          sb.append(backslash).append('n');
        } else {
          sb.append(c);
        }
      }
      sb.append('"');
    }
  `,

  methods: [
    {
      name: 'generateBody',
      type: 'String',
      documentation: `
        Builds one entry body {...} for ci. seq is written verbatim as the
        "seq" property's value and doubles as the deterministic per-entry
        Random seed, so the same (ci, seq, opts) always produces the same
        body. includeClass controls whether a leading class:"..." key is
        emitted — false for the top-level body (JSONParser.parseString(body,
        cls) already knows the target class), true for a nested
        FObjectProperty value (FObjectParser resolves the class from the
        body itself).
      `,
      args: 'ClassInfo ci, long seq, boolean includeClass, Options opts',
      javaCode: `
        Random rnd = new Random(seq);
        List props = ci.getAxiomsByClass(PropertyInfo.class);
        int size = props.size();
        StringBuilder sb = new StringBuilder(size * 24 + 32);
        sb.append('{');
        boolean firstField = true;

        if ( includeClass ) {
          sb.append("class:").append('"').append(ci.getId()).append('"');
          firstField = false;
        }

        for ( int i = 0 ; i < size ; i++ ) {
          PropertyInfo pi = (PropertyInfo) props.get(i);
          String key = SafetyUtil.isEmpty(pi.getShortName()) ? pi.getName() : pi.getShortName();

          if ( ! firstField ) sb.append(',');
          firstField = false;
          sb.append(key).append(':');

          if ( pi.getName().equals("seq") ) {
            sb.append(seq);
            continue;
          }

          if ( opts.someNulls && rnd.nextInt(5) == 0 ) {
            sb.append("null");
            continue;
          }

          appendValue(sb, pi, rnd, opts);
        }

        sb.append('}');
        return sb.toString();
      `
    },
    {
      name: 'appendValue',
      args: 'StringBuilder sb, PropertyInfo pi, Random rnd, Options opts',
      javaCode: `
        if ( pi instanceof AbstractFObjectPropertyInfo ) {
          ClassInfo nested = ((AbstractFObjectPropertyInfo) pi).of();
          sb.append(generateBody(nested, rnd.nextLong(), true, opts));
          return;
        }
        if ( pi instanceof AbstractEnumPropertyInfo ) {
          sb.append(rnd.nextInt(4));
          return;
        }
        if ( pi instanceof AbstractArrayPropertyInfo ) {
          sb.append('[');
          int n = 1 + rnd.nextInt(3);
          for ( int i = 0 ; i < n ; i++ ) {
            if ( i > 0 ) sb.append(',');
            appendEscapedString(sb, nextString(rnd, opts));
          }
          sb.append(']');
          return;
        }
        if ( pi instanceof AbstractDatePropertyInfo ) {
          sb.append(1700000000000L + rnd.nextInt(1000000000));
          return;
        }
        if ( pi instanceof AbstractLongPropertyInfo ) {
          sb.append(rnd.nextInt(1000000));
          return;
        }
        if ( pi instanceof AbstractDoublePropertyInfo ) {
          sb.append(rnd.nextInt(1000000) / 100.0);
          return;
        }
        if ( pi instanceof AbstractIntPropertyInfo ) {
          sb.append(rnd.nextInt(10000));
          return;
        }
        if ( pi instanceof AbstractBooleanPropertyInfo ) {
          sb.append(rnd.nextBoolean());
          return;
        }
        if ( pi instanceof AbstractStringPropertyInfo ) {
          appendEscapedString(sb, nextString(rnd, opts));
          return;
        }
        // Unknown/unsupported property type for this generator: write null
        // rather than guessing at syntax. ModelParserFactory's per-property
        // Alt falls back to UnknownPropertyParser for it either way.
        sb.append("null");
      `
    },
    {
      name: 'nextString',
      type: 'String',
      args: 'Random rnd, Options opts',
      javaCode: `
        if ( opts.uniqueStrings ) {
          boolean withEscape = opts.someEscapes && rnd.nextInt(10) == 0;
          return randomString(rnd, opts.longStrings ? STR_LEN_LONG : STR_LEN_SHORT, withEscape);
        }
        String[] pool = opts.longStrings ? LONG_POOL : (opts.someEscapes ? SHORT_POOL_ESC : SHORT_POOL);
        return pool[rnd.nextInt(pool.length)];
      `
    }
  ]
});
