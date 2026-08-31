/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

/**
 * String deduplication without String.intern().
 *
 * intern() crosses into the VM on every call and funnels every thread through
 * one shared native table; a hand-rolled deduplicator is several times faster
 * (https://shipilev.net/jvm/anatomy-quarks/10-string-intern/). This one is
 * shaped for parser workloads:
 *
 * - One shared 2-way table (131,072 slots, ~1 MB of references) with plain
 *   reads and racy writes. Strings are immutable and safely publishable, so
 *   the races are benign: a lost update or stale read only means a value is
 *   stored or created again. No native call, no CAS, no volatile.
 * - Each value hashes to a pair of adjacent slots; a new value takes the
 *   primary and demotes the previous occupant, so a hot value survives one
 *   collision instead of none.
 * - Length gate at 128 chars: with a miss this cheap, deduplicating a
 *   repeated long value saves more than the O(length) hash costs; only
 *   very long strings pass through untouched.
 *
 * Unlike intern(), equal strings are NOT guaranteed to be the same instance —
 * never compare deduplicated strings with ==. For lock identity
 * (synchronized on a canonical instance), keep String.intern().
 */
public final class StringInterner {

  protected static final int      TABLE_SIZE = 1 << 17;
  protected static final int      MASK       = TABLE_SIZE - 1;
  protected static final int      MAX_LENGTH = 128;

  protected static final String[] TABLE      = new String[TABLE_SIZE];

  private StringInterner() {}

  public static String intern(String s) {
    if ( s == null || s.length() > MAX_LENGTH ) return s;

    int base = (s.hashCode() & MASK) & ~1;

    String c0 = TABLE[base];
    if ( s.equals(c0) ) return c0;
    String c1 = TABLE[base + 1];
    if ( s.equals(c1) ) return c1;

    TABLE[base + 1] = c0;
    TABLE[base]     = s;
    return s;
  }
}
