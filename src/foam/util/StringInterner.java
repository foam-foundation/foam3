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

  /**
   * Weak interner (Guava Interners.newWeakInterner): full deduplication —
   * every equal string maps to one canonical instance — and the entry dies
   * with the last reference, so strings belonging to an unloaded DAO are
   * released instead of pinned.
   */
  protected static com.google.common.collect.Interner<String> WEAK =
    com.google.common.collect.Interners.newWeakInterner();

  /** Benchmark hook: drop dedup state so variants measure independently. */
  public static void reset() {
    WEAK = com.google.common.collect.Interners.newWeakInterner();
    java.util.Arrays.fill(SHARED, null);
    java.util.Arrays.fill(BLOOM, 0);
  }

  public static String internWeak(String s) {
    return s == null ? null : WEAK.intern(s);
  }

  /**
   * Weak interner behind a seen-once filter: the first occurrence of a value
   * only marks a fixed 512 KB bloom filter and passes through — no map entry,
   * no allocation. Only values seen at least twice are interned, so the weak
   * map holds the repeat vocabulary (thousands) instead of every distinct
   * string (millions).
   */
  protected static final int[] BLOOM = new int[1 << 21]; // 64M bits (8 MB), racy on purpose

  protected static boolean seenBefore(String s) {
    int h  = s.hashCode();
    int h2 = h * 0x9E3779B9;
    int b1 = h  & ((1 << 26) - 1);
    int b2 = (h2 >>> 5) & ((1 << 26) - 1);
    int w1 = BLOOM[b1 >>> 5], m1 = 1 << (b1 & 31);
    int w2 = BLOOM[b2 >>> 5], m2 = 1 << (b2 & 31);
    boolean seen = ( w1 & m1 ) != 0 && ( w2 & m2 ) != 0;
    if ( ! seen ) {
      BLOOM[b1 >>> 5] = w1 | m1;
      BLOOM[b2 >>> 5] = w2 | m2;
    }
    return seen;
  }

  public static String internSecondSight(String s) {
    if ( s == null || s.length() > 128 ) return s;
    if ( ! seenBefore(s) ) return s;
    return WEAK.intern(s);
  }
}
