/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Optimized Literal for single-character strings ({, }, :, ,).
 * Avoids the loop and String.charAt() overhead in AbstractLiteral.parse().
 */
public class CharLiteral
  extends AbstractLiteral
{
  private final char char_;

  public CharLiteral(String s) {
    super(s);
    char_ = s.charAt(0);
  }

  @Override
  public Object value() {
    return string_;
  }

  @Override
  public PStream parse(PStream ps, ParserContext x) {
    if ( ps.valid() && ps.head() == char_ ) {
      return ps.tail().setValue(value());
    }
    return null;
  }
}
