/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

/**
 * String deduplication through the JVM's own string table, with a cache in
 * front of it for the one place that interns in bulk: journal replay.
 *
 * String.intern() keeps one canonical instance per distinct value in a native
 * table (about 22 bytes an entry, off the Java heap, weakly held so a string
 * dies with its last reference) and shares the String shell as well as its
 * bytes. A Java-side weak map cannot get close: a WeakReference, a map node
 * and a table slot cost about 96 bytes an entry ON the heap, so a heap holding
 * 150M distinct values spends some 14 GiB on the index alone. What intern()
 * costs is the call: it crosses into the VM every time, several times slower
 * than a hash lookup.
 *
 * So the two are combined. A StringInterner is a small direct-mapped cache
 * created for one replay (F3FileJournal.replay puts it in the parser X and
 * JSONParser carries it into every entry's ParserContext) and dropped with it.
 * A hit returns the canonical without entering the VM; a miss calls intern()
 * and takes the slot. The cache is racy across the replay's assembly-line
 * threads on purpose: an array write is atomic and the equals check rejects a
 * foreign slot, so a race costs a shortcut, never a dedup -- every miss is
 * still canonicalized by intern(). Callers with no replay in progress
 * (DeDupDAO on a live put, a parser fed from HTTP) call String.intern()
 * directly.
 *
 * Per-length hit counters ride along and are logged when the replay
 * completes: a hit is a duplicate occurrence, so they show where dedup earns
 * its bytes. Never compare strings with ==; identity belongs to the table,
 * not to the value.
 */
public final class StringInterner {

  /** Key under which F3FileJournal publishes the replay's interner in X, and JSONParser in the ParserContext. */
  public static final String CTX_KEY = "stringInterner";

  /** Largest cache: log2 of the slots. 2^20 slots is 8 MB of references for the life of one replay. */
  public static final int MAX_BITS = Integer.getInteger("foam.util.stringInterner.bits", 20);
  /** Smallest cache: 2^10 slots, 8 KB, for a journal of a few hundred rows. */
  public static final int MIN_BITS = 10;

  // length-bucket upper bounds, exclusive; the last bucket is >= EDGES[last]
  static final int[] EDGES = { 8, 16, 32, 64, 128, 256 };

  private static final String[] RELEASED = new String[0];

  protected String[] slots_;
  protected final long[]   hit_      = new long[EDGES.length + 1];
  protected final long[]   miss_     = new long[EDGES.length + 1];
  protected final long[]   hitChars_ = new long[EDGES.length + 1];

  public StringInterner() { this(MAX_BITS); }

  /**
   * Slots for a journal of the given size: about one per 32 bytes of journal,
   * clamped to [MIN_BITS, MAX_BITS]. A 10 KB config journal gets 1024 slots; a
   * multi-GB journal gets the full cache. 0 (size unknown) gets the full cache.
   */
  public static int bitsFor(long journalBytes) {
    if ( journalBytes <= 0 ) return MAX_BITS;
    int bits = 64 - Long.numberOfLeadingZeros(journalBytes / 32);
    return Math.max(MIN_BITS, Math.min(MAX_BITS, bits));
  }

  public StringInterner(int bits) { slots_ = new String[1 << bits]; }

  /** The canonical instance of s: from the cache on a hit, else interned and cached. Null passes through. */
  public String intern(String s) {
    if ( s == null ) return null;
    String[] slots = slots_;
    if ( slots.length == 0 ) return s.intern();   // released: straight to the table
    int    h = s.hashCode();
    int    i = (h ^ (h >>> 16)) & (slots.length - 1);
    int    b = bucket(s.length());
    String e = slots[i];
    if ( e != null && e.hashCode() == h && e.equals(s) ) {
      hit_[b]++;
      hitChars_[b] += s.length();
      return e;
    }
    miss_[b]++;
    e = s.intern();
    slots[i] = e;
    return e;
  }

  /**
   * Drops the slot array. Each replay thread's JSONParser keeps the replay X,
   * and through it this interner, until that thread's next replay
   * (AbstractF3FileJournal.getParser), so the array and the strings it pins
   * would otherwise outlive the replay. Counters survive for summary().
   */
  public void release() { slots_ = RELEASED; }

  static int bucket(int len) {
    for ( int i = 0 ; i < EDGES.length ; i++ ) if ( len < EDGES[i] ) return i;
    return EDGES.length;
  }

  public long hits()  { long n = 0; for ( long v : hit_  ) n += v; return n; }
  public long calls() { long n = hits(); for ( long v : miss_ ) n += v; return n; }

  /**
   * One entry per length bucket that saw a call: calls, hit rate, and the
   * String+byte[] bytes those hits' deduplication saved (chars + 56 a hit).
   * Misses mix true uniques with evicted duplicates, so the saving is a floor.
   */
  public String summary() {
    StringBuilder sb = new StringBuilder();
    long th = 0, tm = 0;
    for ( int b = 0 ; b <= EDGES.length ; b++ ) {
      long h = hit_[b], m = miss_[b], n = h + m;
      th += h; tm += m;
      if ( n == 0 ) continue;
      String range = b == 0 ? "<8" : b == EDGES.length ? ">=" + EDGES[b - 1] : EDGES[b - 1] + "-" + (EDGES[b] - 1);
      sb.append(String.format("len %s calls %d hit %.1f%% savedMB %d; ",
        range, n, 100.0 * h / n, (hitChars_[b] + 56L * h) / 1_000_000));
    }
    long n = th + tm;
    sb.append(String.format("total calls %d hit %.1f%% slots %d", n, n == 0 ? 0.0 : 100.0 * th / n, slots_.length));
    return sb.toString();
  }
}
