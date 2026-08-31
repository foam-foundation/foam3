/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lib.parse.PStream;
import foam.lib.parse.Parser;
import foam.lib.parse.ParserContext;
import foam.lib.parse.StringPStream;
import foam.lib.parse.Alt;
import foam.lib.parse.Literal;
import foam.lib.parse.AnyChar;
import foam.lib.parse.Seq1;
import java.util.Map;
import foam.util.StringInterner;

// Benchmark knob (this branch only): 0 = no dedup, 1 = legacy String.intern,
// 2 = foam.util.StringInterner (the production behaviour, default).

public class StringParser
  implements Parser
{

  public static volatile int DEDUP = Integer.getInteger("foam.json.dedup", 2);

  public static String dedup(String v) {
    switch ( DEDUP ) {
      case 1:  return v.intern();
      case 2:  return StringInterner.intern(v);
      default: return v;
    }
  }

  private final static Parser instance__ = new StringParser();

  public static Parser instance() { return instance__; }

  protected static ThreadLocal<StringBuilder> builder__ = new ThreadLocal<StringBuilder>() {
    @Override
    protected StringBuilder initialValue() {
      return new StringBuilder();
    }
    @Override
    public StringBuilder get() {
      StringBuilder sb = super.get();
      sb.setLength(0);
      return sb;
    }
  };

  final static Parser delimiterParser = new Alt(
    new Literal("\"\"\"", Literal.create("\"\"\"")),
    new Literal("\"",     Literal.create("\"")),
    new Literal("'",      Literal.create("'")),
    new Literal("`",      Literal.create("`"))
  );

  final static char ESCAPE = '\\';

  // An escape is either a Unicode code like \u001a, an ASCII escape like \n or
  // just a literal escape next character.

  final static Parser escapeParser = new Alt(
    new UnicodeParser(),
    new ASCIIEscapeParser(),
    new Seq1(1, Literal.create(Character.toString(ESCAPE)), AnyChar.instance())
  );

  public StringParser() {
  }

  /**
   * Fast path for single-char delimited strings with no escape sequences.
   * Uses String.indexOf() to find the closing delimiter in one call instead
   * of per-character ps.apply(delimiter, x) checks.
   * Returns null if escapes are present (falls back to slow path).
   */
  private PStream parseFast(StringPStream sps, char delim) {
    String str = sps.getString().toString();
    int    pos = sps.pos();
    int closeIdx = str.indexOf(delim, pos);
    if ( closeIdx < 0 ) return null;

    // If there's an escape before the closing delimiter, fall back to the slow
    // path. Bounded to the string's own span: the unbounded form scanned to the
    // END of the input on every escape-free value, re-reading the entry once per
    // string property. Short spans use a plain loop — the ranged indexOf's
    // per-call overhead costs more than it saves under ~32 chars; longer spans
    // get its vectorized scan.
    if ( closeIdx - pos <= 32 ) {
      for ( int i = pos ; i < closeIdx ; i++ ) {
        if ( str.charAt(i) == ESCAPE ) return null;
      }
    } else if ( str.indexOf(ESCAPE, pos, closeIdx) >= 0 ) {
      return null;
    }

    // No escapes — bulk extract the string
    String value = dedup(str.substring(pos, closeIdx));
    return sps.createAt(closeIdx + 1).setValue(value);
  }

  public PStream parse(PStream ps, ParserContext x) {
    ps = ps.apply(delimiterParser, x);
    if ( ps == null ) return null;

    Parser delimiter = (Parser) ps.value();

    // Fast path: single-char delimiter on StringPStream with no escapes.
    // Uses indexOf() to find closing delimiter in one call — same pattern as
    // UntilLiteral but with backslash pre-check for escape handling.
    if ( ps instanceof StringPStream && delimiter instanceof foam.lib.parse.AbstractLiteral ) {
      String ds = ((foam.lib.parse.AbstractLiteral) delimiter).getString();
      if ( ds != null && ds.length() == 1 ) {
        PStream fast = parseFast((StringPStream) ps, ds.charAt(0));
        if ( fast != null ) return fast;
      }
      // Fall through to character-by-character for escaped strings,
      // triple-quotes, or when indexOf can't find the delimiter
    }

    StringBuilder sb        = builder__.get();
    PStream       result;
    boolean       escaping  = false;

    while ( ps.valid() ) {
      char c;

      if ( escaping ) {
        ps = ps.apply(escapeParser, x);
        if ( ps == null ) return null;

        sb.append((Character) ps.value());
        escaping = false;

        continue;
      }

      result = ps.apply(delimiter, x);
      if ( result != null ) {
        ps = result;
        break;
      }

      c = ps.head();

      if ( c == ESCAPE ) {
        escaping = true;
        continue;
      }

      sb.append(c);
      ps = ps.tail();
    }

    return ps.setValue(dedup(sb.toString()));
  }
}
