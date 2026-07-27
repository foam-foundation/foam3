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

  // A long safely holds 18 decimal digits (10^18 < Long.MAX_VALUE). Numbers with
  // more integer or fractional digits than this overflow the arithmetic
  // accumulators, and any exponent goes through Math.pow which is not exact past
  // 10^22 — all three fall back to Double.valueOf for a correctly-rounded result.
  private static final int LONG_SAFE_DIGITS = 18;

  public PStream parse(PStream ps, ParserContext x) {
    if ( ! ps.valid() ) return null;

    PStream start    = ps;
    int     consumed = 0;
    boolean negative = false;
    char    c        = ps.head();

    if ( c == '-' ) {
      negative = true;
      ps = ps.tail();
      consumed++;
      if ( ! ps.valid() ) return null;
      c = ps.head();
    }

    if ( ! Character.isDigit(c) ) return null;

    // Integer part
    int  intDigits = 0;
    long intPart   = 0;
    while ( ps.valid() ) {
      c = ps.head();
      if ( Character.isDigit(c) ) {
        intPart = intPart * 10 + (c - '0');
        intDigits++;
        ps = ps.tail();
        consumed++;
      } else {
        break;
      }
    }

    // Decimal part
    int  fracDigits = 0;
    long fracPart   = 0;
    long fracScale  = 1;
    if ( ps.valid() && ps.head() == '.' ) {
      ps = ps.tail();
      consumed++;
      while ( ps.valid() ) {
        c = ps.head();
        if ( Character.isDigit(c) ) {
          fracPart = fracPart * 10 + (c - '0');
          fracScale *= 10;
          fracDigits++;
          ps = ps.tail();
          consumed++;
        } else {
          break;
        }
      }
    }

    // Exponent part. Only committed when at least one exponent digit follows —
    // "1e" / "2E+" backtrack to the plain number so the Double.valueOf fallback
    // never sees a malformed literal (it would throw NumberFormatException).
    boolean hasExp = false;
    if ( ps.valid() ) {
      c = ps.head();
      if ( c == 'e' || c == 'E' ) {
        PStream beforeExp   = ps;
        int     beforeCount = consumed;
        int     expDigits   = 0;
        ps = ps.tail();
        consumed++;
        if ( ps.valid() ) {
          c = ps.head();
          if ( c == '+' || c == '-' ) {
            ps = ps.tail();
            consumed++;
          }
        }
        while ( ps.valid() ) {
          c = ps.head();
          if ( Character.isDigit(c) ) {
            expDigits++;
            ps = ps.tail();
            consumed++;
          } else {
            break;
          }
        }
        if ( expDigits > 0 ) {
          hasExp = true;
        } else {
          ps       = beforeExp;
          consumed = beforeCount;
        }
      }
    }

    // Fall back to correctly-rounded parsing when the arithmetic path can't be
    // trusted: an exponent (Math.pow inexactness) or more digits than a long
    // holds (accumulator overflow). Rebuilds the consumed span only on this
    // path, so the common short-decimal case stays allocation-free.
    if ( hasExp || intDigits > LONG_SAFE_DIGITS || fracDigits > LONG_SAFE_DIGITS ) {
      StringBuilder sb = new StringBuilder(consumed);
      PStream       p  = start;
      for ( int i = 0 ; i < consumed ; i++ ) {
        sb.append(p.head());
        p = p.tail();
      }
      return ps.setValue(Double.valueOf(sb.toString()));
    }

    double val = (double) intPart + (double) fracPart / fracScale;
    if ( negative ) val = -val;

    return ps.setValue(val);
  }
}
