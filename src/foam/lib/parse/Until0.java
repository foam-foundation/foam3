/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Matches any characters until the terminating pattern without returning a
 * value. Consumes and discards the terminating pattern when found. Fails if
 * the terminator is never found.
 *
 * When the terminator is an AbstractLiteral, delegates to UntilLiteral0 which
 * uses String.indexOf() for O(n) native performance.
 */
public class Until0
  implements Parser
{
  protected Parser until_;
  protected Parser optimized_;

  public Until0(Parser until) {
    until_ = until;
    optimized_ = ( until instanceof AbstractLiteral )
      ? new UntilLiteral0(((AbstractLiteral) until).getString())
      : null;
  }

  public PStream parse(PStream ps, ParserContext x) {
    if ( optimized_ != null ) {
      return optimized_.parse(ps, x);
    }
    return parseGeneric(ps, x);
  }

  /**
   * Generic path: try terminator at each position, advance one char at a time.
   */
  private PStream parseGeneric(PStream ps, ParserContext x) {
    PStream res;

    while ( true ) {
      if ( (res = ps.apply(until_, x)) != null ) return res.setValue(null);
      if ( ! ps.valid() ) return null;
      ps = ps.tail();
    }
  }
}
