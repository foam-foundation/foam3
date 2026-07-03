/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Converts a string to a Glyph object when parsing.
// TODO: might be useful in other FObject properties as well.
package foam.lib.json;

import foam.lib.parse.*;

public class GlyphPropertyParser
  extends ProxyParser
{

  private static Parser instance__ = new GlyphPropertyParser();

  public static Parser instance() { return instance__ == null ? new ProxyParser() { public Parser getDelegate() { return instance__; } } : instance__; }

  private GlyphPropertyParser() {
    setDelegate(new Alt(
      StringParser.instance(),
      FObjectParser.instance()
    ));
  }

  public PStream parse(PStream ps, ParserContext x) {
    ps = super.parse(ps, x);

    if ( ps == null ) return null;

    if ( ps.value() == null ) return ps.setValue(null);

    if ( ps.value() instanceof String ) {
      foam.lang.Glyph g = new foam.lang.Glyph();
      g.setThemeName((String) ps.value());
      return ps.setValue(g);
    }

    return ps;
  }
}
