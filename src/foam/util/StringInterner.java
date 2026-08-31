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
 * one shared table; a hand-rolled deduplicator is several times faster
 * (https://shipilev.net/jvm/anatomy-quarks/10-string-intern/). This one is
 * shaped for parser workloads:
 *
 * - Per-thread direct-mapped table (65,536 slots, ~512 KB of references per
 *   thread): a hit is an index and a short equals — no native call, no
 *   volatile, no contention. A value parsed on two threads may keep one
 *   canonical instance per thread, which is bounded by the thread count.
 * - Replace-on-collision: no chains, no growth, no cleanup.
 * - Length gate: strings longer than MAX_LENGTH pass through untouched.
 *   Repeated values in data (codes, statuses, identifiers) are short; long
 *   strings are almost always unique, and deduplicating a unique string
 *   costs the most and saves nothing.
 *
 * Unlike intern(), equal strings are NOT guaranteed to be the same instance —
 * never compare deduplicated strings with ==. For lock identity
 * (synchronized on a canonical instance), keep String.intern().
 */
public final class StringInterner {

  protected static final int TABLE_SIZE = 1 << 16;
  protected static final int MASK       = TABLE_SIZE - 1;
  protected static final int MAX_LENGTH = 32;

  protected static final ThreadLocal<String[]> TABLE =
    ThreadLocal.withInitial(() -> new String[TABLE_SIZE]);

  private StringInterner() {}

  public static String intern(String s) {
    if ( s == null || s.length() > MAX_LENGTH ) return s;

    String[] table  = TABLE.get();
    int      slot   = s.hashCode() & MASK;
    String   cached = table[slot];

    if ( s.equals(cached) ) return cached;

    table[slot] = s;
    return s;
  }
}
