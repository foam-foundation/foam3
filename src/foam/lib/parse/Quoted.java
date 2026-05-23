/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Wraps an inner parser so it accepts both the bare form and the
 * double-quoted form of the same content.
 *
 * Useful for tokens whose canonical JSON wire form is a quoted string but
 * whose underlying grammar is delimiter-free (e.g. RFC 8259 has no native
 * date type, so dates are transmitted as quoted strings). Greedy: tries the
 * quoted form first; if an opening quote is consumed, a matching closing
 * quote is required.
 */
public class Quoted
  implements Parser
{
  protected Parser inner_;

  public Quoted(Parser inner) {
    inner_ = inner;
  }

  public PStream parse(PStream ps, ParserContext x) {
    PStream open = ps.apply(Literal.create("\""), x);
    if ( open != null ) {
      PStream val = open.apply(inner_, x);
      if ( val == null ) return null;
      PStream close = val.apply(Literal.create("\""), x);
      if ( close == null ) return null;
      return close.setValue(val.value());
    }
    return ps.apply(inner_, x);
  }
}
