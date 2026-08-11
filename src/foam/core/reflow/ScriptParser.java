/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.reflow;

import foam.lib.json.RawMapValueParser;
import foam.lib.json.StringParser;
import foam.lib.parse.PStream;
import foam.lib.parse.Parser;
import foam.lib.parse.ParserContext;
import foam.lib.parse.ParserContextImpl;
import foam.lib.parse.StringPStream;

/**
 * Parses Flow.script from either of its serialized shapes and always yields
 * the script TEXT:
 *  - a JSON string (legacy journals: escaped single-line or triple-quoted)
 *  - a plain JSON structure (current form), which is re-stringified
 *
 * The structure is parsed as plain data (RawMapValueParser: maps and lists,
 * never FObjects) so unknown block classes survive and key order is kept.
 */
public class ScriptParser
  implements Parser
{
  private final static Parser instance__ = new ScriptParser();

  public static Parser instance() { return instance__; }

  public PStream parse(PStream ps, ParserContext x) {
    // Legacy shape first: a quoted or triple-quoted string is the script text.
    PStream res = ps.apply(StringParser.instance(), x);
    if ( res != null ) return res;

    res = ps.apply(RawMapValueParser.instance(), x);
    if ( res == null ) return null;

    return res.setValue(stringify(res.value()));
  }

  /**
   * Parse script text into plain data (Map/List/String/Long/Double/Boolean),
   * or null when the text isn't a complete JSON document.
   */
  public static Object parseData(String s) {
    if ( foam.util.SafetyUtil.isEmpty(s) ) return null;

    StringPStream ps = new StringPStream();
    ps.setString(s);
    ParserContext x = new ParserContextImpl();

    PStream res = ps.apply(RawMapValueParser.instance(), x);
    if ( res == null ) return null;

    // Whole-document parses only: trailing content means it wasn't plain JSON.
    for ( PStream rest = res ; rest.valid() ; rest = rest.tail() ) {
      char c = rest.head();
      if ( c != ' ' && c != '\t' && c != '\n' && c != '\r' ) return null;
    }

    return res.value();
  }

  /** Stringify plain data back to compact JSON text. */
  public static String stringify(Object v) {
    StringBuilder sb = new StringBuilder();
    append(sb, v);
    return sb.toString();
  }

  private static void append(StringBuilder sb, Object v) {
    if ( v == null ) {
      sb.append("null");
    } else if ( v instanceof String ) {
      sb.append('"');
      foam.lib.json.Util.escape((String) v, sb);
      sb.append('"');
    } else if ( v instanceof java.util.Map ) {
      sb.append('{');
      var i = ((java.util.Map<?, ?>) v).entrySet().iterator();
      while ( i.hasNext() ) {
        var e = i.next();
        append(sb, e.getKey() == null ? "" : e.getKey().toString());
        sb.append(':');
        append(sb, e.getValue());
        if ( i.hasNext() ) sb.append(',');
      }
      sb.append('}');
    } else if ( v instanceof java.util.List ) {
      sb.append('[');
      var i = ((java.util.List<?>) v).iterator();
      while ( i.hasNext() ) {
        append(sb, i.next());
        if ( i.hasNext() ) sb.append(',');
      }
      sb.append(']');
    } else if ( v instanceof Object[] ) {
      // ArrayParser yields Object[]
      Object[] a = (Object[]) v;
      sb.append('[');
      for ( int i = 0 ; i < a.length ; i++ ) {
        if ( i > 0 ) sb.append(',');
        append(sb, a[i]);
      }
      sb.append(']');
    } else {
      // Long, Double, Boolean
      sb.append(v);
    }
  }
}
