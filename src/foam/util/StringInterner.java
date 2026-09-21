/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

import java.util.concurrent.atomic.AtomicReferenceArray;

/**
 * String deduplication through the JVM's own string table, interning a value
 * only once it has been seen twice.
 *
 * String.intern() keeps one canonical instance per distinct value in a native
 * table (about 22 bytes an entry, off the Java heap, weakly held so a string
 * dies with its last reference) and shares the String shell as well as its
 * bytes. A Java-side weak map cannot get close: a WeakReference, a map node
 * and a table slot cost about 96 bytes an entry ON the heap, so a heap holding
 * 150M distinct values spends some 14 GiB on the index alone.
 *
 * The table has a ceiling of its own. It stops growing at 2^24 buckets, and
 * once the live entries pass about twice that, every GC notification makes
 * the service thread rescan the whole table for dead entries and a lookup of
 * a value already in it climbs from ~1 us to 30-100 us (measured at 151M
 * entries, average chain 9). So what must not happen is interning values that
 * never repeat -- ids, references, timestamps -- because they are most of the
 * distinct values and they buy nothing.
 *
 * A StringInterner is a small set-associative cache that does exactly that
 * filtering. A value hashes to a bucket of WAYS slots; first sight parks the
 * raw string in a free slot (or over the bucket's oldest) and returns it.
 * Second sight interns it, keeps the canonical in the slot and returns it;
 * the first record's instance was the one interned, so it is canonical too.
 * A value evicted before its second sight is a missed dedup for the records
 * that saw it, never a wrong value. A journal replay creates one, sized from
 * the journal, publishes it under CTX_KEY in the replay X so JSONParser can
 * hand each parsed entry an Entry view of it through the ParserContext, and
 * releases it when the replay completes. Everything else -- DeDupDAO on a
 * live put, a parser fed from HTTP -- goes through shared().
 *
 * Thread safety: a slot holds one immutable Slot (string, canonical flag,
 * entry, age) and is replaced with compareAndSet, so two threads racing on
 * one slot cannot leave a raw string flagged canonical or lose a second
 * sight: the loser re-reads, finds the winner's slot, and either shares the
 * winner's copy of the same value or evicts a foreign one as it would have
 * anyway. The hit counters are plain longs; they are analytics, not
 * accounting.
 *
 * Per-length hit counters are logged when a replay completes: a hit is a
 * duplicate occurrence, so they show where dedup earns its bytes. Never
 * compare strings with ==; identity belongs to the table, not to the value.
 */
public final class StringInterner {

  /** Key under which F3FileJournal publishes the replay's interner in X, and JSONParser in the ParserContext. */
  public static final String CTX_KEY = "stringInterner";

  /**
   * Largest cache: log2 of the slots. 2^22 slots is 32 MB of references plus
   * a 32-byte Slot per filled slot, at most 160 MB, for the life of one
   * replay. Every eviction between two sightings of a value leaves one record
   * holding a raw copy, so slots buy dedup up to a point: on a 1M-entry replay
   * 2^22 slots retained 499 MB and 2^24 retained 497 MB (plain intern of
   * everything: 490 MB), at the same wall time.
   */
  public static final int MAX_BITS = Integer.getInteger("foam.util.stringInterner.bits", 22);
  /** Smallest cache: 2^10 slots, 8 KB, for a journal of a few hundred rows. */
  public static final int MIN_BITS = 10;

  // length-bucket upper bounds, exclusive; the last bucket is >= EDGES[last]
  static final int[] EDGES = { 8, 16, 32, 64, 128, 256 };

  /** Slots per bucket. Two values that hash to one bucket share it instead of evicting each other. */
  public static final int WAYS = 4;

  private static final AtomicReferenceArray<Slot> RELEASED = new AtomicReferenceArray<>(0);

  /** One slot's contents; immutable so a compareAndSet replaces all of it at once. */
  static final class Slot {
    final String  s;
    final boolean canon;   // s is the JVM canonical (true) or a first-sight raw string (false)
    final int     entry;   // the entry that first-sighted s; a hit from the same entry is not a second sight
    final int     age;     // first-sight tick, the bucket's oldest slot is the one evicted
    Slot(String s, boolean canon, int entry, int age) { this.s = s; this.canon = canon; this.entry = entry; this.age = age; }
  }

  /** The interner for everything outside a replay: live puts through DeDupDAO, parsing with no replay context. */
  private static final StringInterner SHARED = new StringInterner(MAX_BITS);

  public static StringInterner shared() { return SHARED; }

  protected AtomicReferenceArray<Slot> slots_;   // WAYS consecutive slots form a bucket
  protected int                        tick_;     // first-sight counter for Slot.age; racy, an approximate order is enough
  protected long                       interned_; // values sent to the JVM table

  private static final java.util.concurrent.atomic.AtomicInteger ENTRY_SEQ = new java.util.concurrent.atomic.AtomicInteger();

  /**
   * The interner as seen from one parsed entry. Parsers backtrack -- an Alt
   * tries one branch, fails later, and re-parses the same text -- so one
   * occurrence of a value can be sighted twice within an entry. JSONParser
   * puts an Entry in each entry's ParserContext; a hit on a slot this same
   * entry first-sighted stays raw, so only a sighting from another entry
   * makes a value repeat.
   */
  public static final class Entry {
    protected final StringInterner interner_;
    protected final int            id_;
    Entry(StringInterner interner) { interner_ = interner; id_ = ENTRY_SEQ.incrementAndGet(); }
    public String intern(String s) { return interner_.intern(s, id_); }
  }

  public Entry entry() { return new Entry(this); }
  protected final long[]   hit_      = new long[EDGES.length + 1];
  protected final long[]   miss_     = new long[EDGES.length + 1];
  protected final long[]   hitChars_ = new long[EDGES.length + 1];

  public StringInterner() { this(MAX_BITS); }

  /**
   * Slots for a journal of the given size: about one per 32 bytes of journal,
   * clamped to [MIN_BITS, MAX_BITS]. A 10 KB config journal gets 1024 slots; a
   * journal above 128 MB gets the full cache. 0 (size unknown) gets the full cache.
   */
  public static int bitsFor(long journalBytes) {
    if ( journalBytes <= 0 ) return MAX_BITS;
    int bits = 64 - Long.numberOfLeadingZeros(journalBytes / 32);
    return Math.max(MIN_BITS, Math.min(MAX_BITS, bits));
  }

  public StringInterner(int bits) { slots_ = new AtomicReferenceArray<>(1 << bits); }

  /**
   * s itself on first sight; the JVM canonical from the second sight on.
   * Null passes through. After release() every call returns s.
   */
  public String intern(String s) { return intern(s, 0); }

  /** As intern(s), but a hit on a slot first-sighted by the same entry (entry != 0) is not a second sight. */
  public String intern(String s, int entry) {
    if ( s == null ) return null;
    AtomicReferenceArray<Slot> slots = slots_;
    if ( slots.length() == 0 ) return s;
    int h    = s.hashCode();
    int base = ((h ^ (h >>> 16)) & (slots.length() / WAYS - 1)) * WAYS;
    int b    = bucket(s.length());
    for ( ; ; ) {
      int  victim = -1;
      Slot old    = null;
      for ( int i = base ; i < base + WAYS ; i++ ) {
        Slot cur = slots.get(i);
        if ( cur == null ) {
          if ( old != null || victim < 0 ) { victim = i; old = null; }   // a free slot beats evicting one
          continue;
        }
        if ( cur.s.hashCode() == h && cur.s.equals(s) ) {
          hit_[b]++;
          hitChars_[b] += s.length();
          if ( cur.canon ) return cur.s;
          if ( entry != 0 && cur.entry == entry ) return cur.s;   // the same entry re-parsing its own text
          // second sight: this value repeats, so it earns a table entry
          String c = cur.s.intern();
          if ( slots.compareAndSet(i, cur, new Slot(c, true, cur.entry, cur.age)) ) interned_++;
          return c;
        }
        if ( victim < 0 || ( old != null && cur.age < old.age ) ) { victim = i; old = cur; }   // else the bucket's oldest
      }
      miss_[b]++;
      if ( slots.compareAndSet(victim, old, new Slot(s, false, entry, tick_++)) ) return s;
      // another thread changed that slot first; it may now hold this very value
    }
  }

  /** Values this interner has sent to the JVM table. */
  public long interned() { return interned_; }

  /**
   * Drops the slots. Each replay thread's JSONParser keeps the replay X,
   * and through it this interner, until that thread's next replay
   * (AbstractF3FileJournal.getParser), so the slots and the strings they pin
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
    sb.append(String.format("total calls %d hit %.1f%% interned %d slots %d",
      n, n == 0 ? 0.0 : 100.0 * th / n, interned_, slots_.length()));
    return sb.toString();
  }
}
