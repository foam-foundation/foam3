/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public abstract class AbstractLiteral
  implements Parser
{
  protected final static Map map__ = new ConcurrentHashMap();

  /**
   * Implement the multiton pattern so we don't create the same Literal
   * parser more than once.
   **/
  public static Parser create(String s) {
    if ( s == null ) return new AbstractLiteral(null) {
      @Override
      public Object value() {
        return null;
      }
    };

    Parser p = (Parser) map__.get(s);

    if ( p == null ) {
      if ( s.length() == 1 ) {
        p = new CharLiteral(s);
      } else {
        p = new AbstractLiteral(s) {
          @Override
          public Object value() {
            return s;
          }
        };
      }
      map__.put(s, p);
    }

    return p;
  }


  protected String string_;

  public AbstractLiteral(String s) {
    string_ = s;
  }

  public String getString() {
    return string_;
  }

  public PStream parse(PStream ps, ParserContext x) {
    if ( string_ == null ) return null;

    for ( int i = 0 ; i < string_.length() ; i++ ) {
      if ( ! ps.valid() || ps.head() != string_.charAt(i) ) return null;

      ps = ps.tail();
    }

    return ps.setValue(value());
  }

  public String toString() {
    return "Literal(" + string_ + ")";
  }

  public abstract Object value();
}
