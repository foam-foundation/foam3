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

  /**
   * 2-way variant: each value hashes to a pair of adjacent slots. A new value
   * takes the primary slot and demotes the previous occupant to the secondary,
   * so a hot value survives one collision instead of none.
   */
  public static String intern2(String s) {
    if ( s == null || s.length() > MAX_LENGTH ) return s;

    String[] table = TABLE.get();
    int      base  = (s.hashCode() & MASK) & ~1;

    String c0 = table[base];
    if ( s.equals(c0) ) return c0;
    String c1 = table[base + 1];
    if ( s.equals(c1) ) return c1;

    table[base + 1] = c0;
    table[base]     = s;
    return s;
  }

  /**
   * Shared-table variant: one table for every thread, plain reads and racy
   * writes. Strings are immutable and safely publishable, so a lost update
   * only means a value gets stored again; no CAS, no volatile. Higher length
   * gate: with a cheap miss path, deduplicating a repeated long string saves
   * more than it costs.
   */
  protected static final int      SHARED_SIZE = 1 << 17;
  protected static final int      SHARED_MASK = SHARED_SIZE - 1;
  protected static final String[] SHARED      = new String[SHARED_SIZE];

  public static String internShared(String s) {
    if ( s == null || s.length() > 128 ) return s;

    int base = (s.hashCode() & SHARED_MASK) & ~1;

    String c0 = SHARED[base];
    if ( s.equals(c0) ) return c0;
    String c1 = SHARED[base + 1];
    if ( s.equals(c1) ) return c1;

    SHARED[base + 1] = c0;
    SHARED[base]     = s;
    return s;
  }
}
