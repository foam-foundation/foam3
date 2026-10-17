/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

import java.util.concurrent.ThreadLocalRandom;

/**
 * A bounded LRU of canonical strings, shared by every replay, in front of a
 * delegate interner.
 *
 * intern() stores a value StringInterner saw twice in one replay: a miss keeps
 * the instance as the canonical, a hit returns the stored one and, one time
 * in promoteOneIn, hands it to the delegate. find() answers another replay's
 * first sight of a stored value, so that replay never keeps its own copy.
 * Values seen once never enter it, and values that stop coming back age out.
 *
 * Split into STRIPES access-order maps so threads do not share one lock. Two
 * threads missing the same value at the same instant can each keep their own
 * copy; the value returned is always equal to the one passed in.
 */
public final class LruInterner implements Interner {

  static final int STRIPES = 16;   // power of two

  protected final LRULinkedHashMap<String, String>[] stripes_;
  protected final int                                promoteMask_;
  protected final Interner                           delegate_;

  /** capacity: entries across all stripes. promoteOneIn: rounded down to a power of two; 1 promotes every hit. */
  @SuppressWarnings("unchecked")
  public LruInterner(int capacity, int promoteOneIn, Interner delegate) {
    stripes_ = new LRULinkedHashMap[STRIPES];
    for ( int i = 0 ; i < STRIPES ; i++ ) stripes_[i] = new LRULinkedHashMap<>("LruInterner", Math.max(2, capacity / STRIPES));
    promoteMask_ = Integer.highestOneBit(Math.max(1, promoteOneIn)) - 1;
    delegate_    = delegate;
  }

  public String find(String s) {
    return s == null ? null : stripe(s).get(s);
  }

  public String intern(String s) {
    if ( s == null ) return null;
    LRULinkedHashMap<String, String> stripe = stripe(s);

    String c = stripe.get(s);
    if ( c == null ) {
      stripe.put(s, s);
      return s;
    }
    if ( ( ThreadLocalRandom.current().nextInt() & promoteMask_ ) != 0 ) return c;

    String d = delegate_.intern(c);
    // c came back after an eviction; the delegate still holds the old canonical
    if ( d != c ) stripe.put(d, d);
    return d;
  }

  /** Entries across all stripes; monitoring and tests. */
  public int size() {
    int n = 0;
    for ( LRULinkedHashMap<String, String> stripe : stripes_ ) synchronized ( stripe ) { n += stripe.size(); }
    return n;
  }

  // The TOP bits of a mixed hash: each stripe's own table indexes by the low
  // bits, which would otherwise be equal across the stripe.
  protected LRULinkedHashMap<String, String> stripe(String s) {
    return stripes_[( s.hashCode() * 0x9E3779B9 ) >>> 28];
  }
}
