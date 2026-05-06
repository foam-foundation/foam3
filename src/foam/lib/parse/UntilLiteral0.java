/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Optimized version of Until0 for literal string terminators. Uses
 * String.indexOf() for O(n) native performance instead of per-character
 * parser invocation.
 *
 * Discards matched content (value is null) and consumes the terminator —
 * identical semantics to Until0 with a Literal parser.
 *
 * Used internally by Until0 when it detects an AbstractLiteral argument.
 */
public class UntilLiteral0
  implements Parser
{
  protected String literal_;

  public UntilLiteral0(String literal) {
    literal_ = literal;
  }

  public PStream parse(PStream ps, ParserContext x) {
    if ( ps instanceof StringPStream ) {
      return parseFast((StringPStream) ps);
    }
    return parseGeneric(ps, x);
  }

  /**
   * Fast path: use String.indexOf() to jump directly past the terminator.
   */
  private PStream parseFast(StringPStream ps) {
    String str = ps.str.get().toString();
    int    idx = str.indexOf(literal_, ps.pos());

    if ( idx < 0 ) return null;

    return new StringPStream(ps.str, idx + literal_.length()).setValue(null);
  }

  /**
   * Generic path for non-StringPStream: scan character-by-character.
   */
  private PStream parseGeneric(PStream ps, ParserContext x) {
    Parser literal = Literal.create(literal_);
    PStream res;

    while ( true ) {
      if ( (res = ps.apply(literal, x)) != null ) return res.setValue(null);
      if ( ! ps.valid() ) return null;
      ps = ps.tail();
    }
  }
}
