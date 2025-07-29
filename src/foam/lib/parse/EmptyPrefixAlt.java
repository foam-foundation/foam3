/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

import java.util.ArrayList;
import java.util.List;

public class EmptyPrefixAlt
  implements PrefixAlt
{
  private static PrefixAlt x_ = new EmptyPrefixAlt();

  private EmptyPrefixAlt() {}

  public static PrefixAlt instance() { return x_; }

  public PrefixAlt add(String prefix, Parser p) {
    return new TT(prefix.charAt(0)).add(prefix, p);
  }

  public PStream parse(PStream ps, ParserContext x) {
    return null;
  }

  public void select(List l) { };

  public PrefixAlt rebalance() { return this; }

  public String toString() { return ""; }

}


/* Ternary Tree with three children: left, tail, and right */
class TT
  implements PrefixAlt
{
  protected char      c_;
  protected PrefixAlt l_ = EmptyPrefixAlt.instance();
  protected PrefixAlt t_ = EmptyPrefixAlt.instance();
  protected PrefixAlt r_ = EmptyPrefixAlt.instance();
  protected Parser    parser_;


  public TT(char c) {
    c_ = c;
  }

  public PrefixAlt add(String prefix, Parser p) {
    int c = Character.compare(c_, prefix.charAt(0));

    if ( c == 0 ) {
      if ( prefix.length() == 1 ) {
        parser_ = p;
      } else {
        t_ = t_.add(prefix.substring(1), p);
      }
    } else if ( c > 0 ) {
      l_ = l_.add(prefix, p);
    } else {
      r_ = r_.add(prefix, p);
    }

    return this;
  }

  public PStream parse(PStream ps, ParserContext x) {
    if ( ! ps.valid() ) return null;

    int c = Character.compare(c_, ps.head());

    if ( c == 0 ) {
      ps = ps.tail();

      // Depth-first / Greedy parsing
      PStream ret = t_.parse(ps, x);
      return ( ret != null || parser_ == null ) ? ret : parser_.parse(ps, x);
    }

    return ( c > 0 ) ? l_.parse(ps, x) : r_.parse(ps, x);
  }

  public void select(List l) {
    l_.select(l);
    l.add(this);
    r_.select(l);
  }

  public PrefixAlt balance(List l, int start, int end) {
    if ( end < start ) return EmptyPrefixAlt.instance();

    int i   = (start + end) / 2;

    TT root = (TT) l.get(i);

    root.t_ = root.t_.rebalance();

    root.l_ = balance(l, start, i-1);
    root.r_ = balance(l, i+1, end);

    return root;
  }

  public PrefixAlt rebalance() {
    ArrayList l = new ArrayList();

    select(l);

    return balance(l, 0, l.size() - 1);
  }

  public String toString() {
    return "[" + c_ + "," + l_ + ',' + /* t_ + "," + */ r_ + "]";
  }
}
