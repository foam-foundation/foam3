/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Optimized version of Until for literal string terminators. Uses
 * String.indexOf() for O(n) native performance instead of per-character
 * parser invocation.
 *
 * Returns an array of the characters before the terminator and consumes the
 * terminator — identical semantics to Until with a Literal parser.
 *
 * Used internally by Until when it detects an AbstractLiteral argument.
 */
public class UntilLiteral
  implements Parser
{
  protected String literal_;

  public UntilLiteral(String literal) {
    literal_ = literal;
  }

  public PStream parse(PStream ps, ParserContext x) {
    if ( ps instanceof StringPStream ) {
      return parseFast((StringPStream) ps);
    }
    return parseGeneric(ps, x);
  }

  /**
   * Fast path: use String.indexOf() to jump directly to the terminator.
   */
  private PStream parseFast(StringPStream ps) {
    String str = ps.str.get().toString();
    int    idx = str.indexOf(literal_, ps.pos());

    if ( idx < 0 ) return null;

    int      len   = idx - ps.pos();
    Object[] chars = new Object[len];
    for ( int i = 0 ; i < len ; i++ ) {
      chars[i] = str.charAt(ps.pos() + i);
    }

    return new StringPStream(ps.str, idx + literal_.length()).setValue(chars);
  }

  /**
   * Generic path for non-StringPStream: scan character-by-character.
   */
  private PStream parseGeneric(PStream ps, ParserContext x) {
    Parser literal = Literal.create(literal_);
    Parser delegate = new Seq1(0,
      new Repeat(new Not(literal, AnyChar.instance())),
      literal
    );
    return delegate.parse(ps, x);
  }
}
