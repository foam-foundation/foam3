/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

import java.lang.ref.Reference;
import java.lang.ref.ReferenceQueue;
import java.lang.ref.WeakReference;
import java.util.concurrent.ConcurrentHashMap;

/**
 * String deduplication without String.intern().
 *
 * intern() crosses into the VM on every call and funnels every thread through
 * one shared native table; a hand-rolled deduplicator is several times faster
 * (https://shipilev.net/jvm/anatomy-quarks/10-string-intern/ — the same
 * conclusion Spark and Hive reached).
 *
 * A weak interner gives full deduplication — every equal string maps to one
 * canonical instance — while each entry dies with the last reference to its
 * string, so values belonging to an unloaded DAO are released instead of
 * pinned. Same coverage as intern(): every String value, any length.
 *
 * The map's key IS the entry: a WeakReference to the canonical string that
 * caches the hash and compares by referent value. When the string is
 * collected the reference lands on a queue and the entry is removed on a
 * later intern() call. All operations are plain ConcurrentHashMap operations;
 * the races are benign (at worst a value is briefly canonicalized twice).
 *
 * Unlike intern(), equal strings from different sources are canonical only
 * while an instance stays reachable — never compare strings with ==. For lock
 * identity (synchronized on a canonical instance), keep String.intern().
 */
public final class StringInterner {

  protected static final ConcurrentHashMap<Key, Key> MAP   = new ConcurrentHashMap<>(1 << 17);
  protected static final ReferenceQueue<String>      QUEUE = new ReferenceQueue<>();

  protected static final class Key extends WeakReference<String> {
    protected final int hash_;

    Key(String s) {
      super(s, QUEUE);
      hash_ = s.hashCode();
    }

    @Override public int hashCode() { return hash_; }

    @Override public boolean equals(Object o) {
      if ( this == o ) return true;
      if ( ! ( o instanceof Key ) ) return false;
      String a = get(), b = ((Key) o).get();
      return a != null && a.equals(b);
    }
  }

  private StringInterner() {}

  public static String intern(String s) {
    if ( s == null ) return null;

    // Evict entries whose canonical string was collected. A cleared Key still
    // removes by identity: its equals() starts with this == o.
    Reference<? extends String> dead;
    while ( ( dead = QUEUE.poll() ) != null ) MAP.remove(dead);

    Key key = new Key(s);
    for ( ; ; ) {
      Key entry = MAP.putIfAbsent(key, key);
      if ( entry == null ) return s;

      String canonical = entry.get();
      if ( canonical != null ) return canonical;

      // The entry's string was collected between lookup and get: drop it and retry.
      MAP.remove(key, entry);
    }
  }

  /** Live entry count; monitoring and tests. */
  public static int size() { return MAP.size(); }
}
