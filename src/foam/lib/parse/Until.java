/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Matches any characters until the terminating pattern, returning an array of
 * the characters before the terminator. Consumes the terminator. Fails if the
 * terminator is never found.
 *
 * When the terminator is an AbstractLiteral, delegates to UntilLiteral which
 * uses String.indexOf() for O(n) native performance.
 */
public class Until
  implements Parser
{
  protected Parser delegate_;

  public Until(Parser until) {
    if ( until instanceof AbstractLiteral ) {
      delegate_ = new UntilLiteral(((AbstractLiteral) until).getString());
    } else {
      delegate_ = new Seq1(0,
        new Repeat(new Not(until, AnyChar.instance())),
        until
      );
    }
  }

  public PStream parse(PStream ps, ParserContext x) {
    return delegate_.parse(ps, x);
  }
}
