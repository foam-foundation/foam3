/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;

/**
 * Hands a parsed string to the JVM's string table, String.intern(), only on
 * its second sight, so values that appear once -- ids, references,
 * timestamps -- never enter the table.
 *
 * The table costs about 22 bytes an entry off the heap, but it stops growing
 * at 2^24 buckets; past that every GC makes the service thread rescan it and a
 * lookup of a value already in it climbs from ~1 us to 30-100 us (measured at
 * 151M entries). Most distinct values in a large store are one-offs, so they
 * are what must stay out.
 *
 * Two maps: seenOnce holds the first instance of each value seen once,
 * seenMany the canonical of each value seen twice. Second sight interns the
 * FIRST instance: String.intern() keeps the instance it is given, so the
 * record that brought the value in already holds the canonical and no second
 * copy is left behind.
 *
 * One interner per journal replay. F3FileJournal creates it, publishes it
 * under CTX_KEY so JSONParser hands it to StringParser, and releases it when
 * the replay completes. Until then both maps hold every distinct value of the
 * replay, about 42 bytes each; release() gives that back. Parsing outside a
 * replay is not interned.
 *
 * Thread safe: the replay's parse threads share one interner through two
 * ConcurrentHashMaps. Two threads sighting a value at the same instant can
 * each keep their own copy, or leave a stale entry in seenOnce until release;
 * the value returned is always equal to the one passed in. Never compare
 * strings with ==; identity belongs to the table, not to the value.
 */
public final class StringInterner {

  /** Key under which F3FileJournal publishes the replay's interner in X, and JSONParser in the ParserContext. */
  public static final String CTX_KEY = "stringInterner";

  // length-bucket upper bounds, exclusive; the last bucket is >= EDGES[last]
  static final int[] EDGES = { 8, 16, 32, 64, 128, 256 };

  protected volatile ConcurrentHashMap<String, String> seenOnce_ = new ConcurrentHashMap<>();
  protected volatile ConcurrentHashMap<String, String> seenMany_ = new ConcurrentHashMap<>();

  protected final LongAdder[] hit_      = adders();   // sightings that got the canonical
  protected final LongAdder[] miss_     = adders();   // first sightings, parked
  protected final LongAdder[] hitChars_ = adders();
  protected final LongAdder[] interned_ = adders();   // values sent to the JVM table

  /**
   * s itself on first sight; the JVM canonical from the second sight on.
   * Null passes through. After release() every call returns s.
   */
  public String intern(String s) {
    ConcurrentHashMap<String, String> once = seenOnce_, many = seenMany_;
    if ( s == null || once == null ) return s;
    int b = bucket(s.length());

    String c = many.get(s);
    if ( c != null ) { hit(b, s); return c; }

    // second sight: intern the FIRST instance, the one already parked
    String first = once.remove(s);
    if ( first != null ) {
      c = first.intern();
      many.put(c, c);
      interned_[b].increment();
      hit(b, s);
      return c;
    }

    // first sight: park it, hand it back raw
    once.put(s, s);
    miss_[b].increment();
    return s;
  }

  /**
   * Drops both maps. Each replay thread's JSONParser keeps the replay X, and
   * through it this interner, until that thread's next replay
   * (AbstractF3FileJournal.getParser), so the maps and the strings they pin
   * would otherwise outlive the replay. Counters survive for summary().
   */
  public void release() { seenOnce_ = null; seenMany_ = null; }

  public long calls()    { return sum(hit_) + sum(miss_); }
  public long hits()     { return sum(hit_); }
  public long interned() { return sum(interned_); }

  /**
   * One entry per length bucket that saw a call: calls, hit rate, values
   * interned, and the String+byte[] bytes the hits' deduplication saved
   * (chars + 56 a hit).
   */
  public String summary() {
    StringBuilder sb = new StringBuilder();
    long th = 0, tm = 0;
    for ( int b = 0 ; b <= EDGES.length ; b++ ) {
      long h = hit_[b].sum(), m = miss_[b].sum(), n = h + m;
      th += h; tm += m;
      if ( n == 0 ) continue;
      String range = b == 0 ? "<8" : b == EDGES.length ? ">=" + EDGES[b - 1] : EDGES[b - 1] + "-" + (EDGES[b] - 1);
      sb.append(String.format("len %s calls %d hit %d miss %d interned %d savedMB %d; ",
        range, n, h, m, interned_[b].sum(), (hitChars_[b].sum() + 56L * h) / 1_000_000));
    }
    long n = th + tm;
    sb.append(String.format("total calls %d hit %.1f%% interned %d", n, n == 0 ? 0.0 : 100.0 * th / n, interned()));
    return sb.toString();
  }

  void hit(int b, String s) { hit_[b].increment(); hitChars_[b].add(s.length()); }

  static int bucket(int len) {
    for ( int i = 0 ; i < EDGES.length ; i++ ) if ( len < EDGES[i] ) return i;
    return EDGES.length;
  }

  static LongAdder[] adders() {
    LongAdder[] a = new LongAdder[EDGES.length + 1];
    for ( int i = 0 ; i < a.length ; i++ ) a[i] = new LongAdder();
    return a;
  }

  static long sum(LongAdder[] a) { long n = 0; for ( LongAdder v : a ) n += v.sum(); return n; }
}
