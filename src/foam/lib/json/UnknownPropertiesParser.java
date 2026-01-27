/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lib.parse.*;
import foam.util.SafetyUtil;

public class UnknownPropertiesParser
  extends ProxyParser
{
  public UnknownPropertiesParser() {
    super(new Parser() {
      Parser delegate = new Repeat(
        new Seq1(1,
          new Optional(CommentParser.create()),
          new Alt(new UnknownKeyValueParser0(), Whitespace.instance())
        ), ",");

      public PStream parse(PStream ps, ParserContext x) {
        ps = ps.apply(delegate, x);
        if ( ps == null ) return null;

        Object[] objs = (Object[]) ps.value();
        StringBuilder res = new StringBuilder();
        for ( int i = 0 ; i < objs.length ; i++ ) {
          if ( objs[i] instanceof String str ) {
            // Do not include empty string and invalid key-value pair
            if ( SafetyUtil.isEmpty(str) || str.indexOf(":") == -1 ) continue;

            res.append(str);
            if ( i < objs.length - 1) {
              res.append(',');
            }
          }
        }
        return ps.setValue(res.toString());
      }
    });
  }
}
