/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lib.parse.*;

public class DoubleParser
  implements Parser
{
  private static Parser instance__ = new DoubleParser();

  public static Parser instance() { return instance__; }


  public PStream parse(PStream ps, ParserContext x) {
    if ( ! ps.valid() ) return null;

    boolean negative = false;
    char c = ps.head();

    if ( c == '-' ) {
      negative = true;
      ps = ps.tail();
      if ( ! ps.valid() ) return null;
      c = ps.head();
    }

    if ( ! Character.isDigit(c) ) return null;

    // Integer part
    long intPart = c - '0';
    ps = ps.tail();
    while ( ps.valid() ) {
      c = ps.head();
      if ( Character.isDigit(c) ) {
        intPart = intPart * 10 + (c - '0');
        ps = ps.tail();
      } else {
        break;
      }
    }

    // Decimal part
    long fracPart  = 0;
    long fracScale = 1;
    if ( ps.valid() && ps.head() == '.' ) {
      ps = ps.tail();
      while ( ps.valid() ) {
        c = ps.head();
        if ( Character.isDigit(c) ) {
          fracPart = fracPart * 10 + (c - '0');
          fracScale *= 10;
          ps = ps.tail();
        } else {
          break;
        }
      }
    }

    // Exponent part
    int     expSign = 1;
    long    expPart = 0;
    boolean hasExp  = false;
    if ( ps.valid() ) {
      c = ps.head();
      if ( c == 'e' || c == 'E' ) {
        hasExp = true;
        ps = ps.tail();
        if ( ps.valid() ) {
          c = ps.head();
          if ( c == '+' || c == '-' ) {
            if ( c == '-' ) expSign = -1;
            ps = ps.tail();
          }
        }
        while ( ps.valid() ) {
          c = ps.head();
          if ( Character.isDigit(c) ) {
            expPart = expPart * 10 + (c - '0');
            ps = ps.tail();
          } else {
            break;
          }
        }
      }
    }

    double val = (double) intPart + (double) fracPart / fracScale;
    if ( hasExp ) val *= Math.pow(10.0, expSign * expPart);
    if ( negative ) val = -val;

    return ps.setValue(val);
  }
}
