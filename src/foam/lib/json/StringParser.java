/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lib.parse.PStream;
import foam.lib.parse.Parser;
import foam.lib.parse.ParserContext;
import foam.lib.parse.Alt;
import foam.lib.parse.Literal;
import foam.lib.parse.AnyChar;
import foam.lib.parse.Seq1;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class StringParser
  implements Parser
{
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

  public PStream parse(PStream ps, ParserContext x) {
    ps = ps.apply(delimiterParser, x);
    if ( ps == null ) return null;

    Parser        delimiter = (Parser) ps.value();
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

    // inter()'ed objects are GC'ed, so safe to do here
    return ps.setValue(sb.toString().intern());
  }
}
