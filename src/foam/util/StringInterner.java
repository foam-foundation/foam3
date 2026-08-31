/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

import com.google.common.collect.Interner;
import com.google.common.collect.Interners;

/**
 * String deduplication without String.intern().
 *
 * intern() crosses into the VM on every call and funnels every thread through
 * one shared native table; a hand-rolled deduplicator is several times faster
 * (https://shipilev.net/jvm/anatomy-quarks/10-string-intern/ — the same
 * conclusion Spark and Hive reached when they replaced intern() with Guava's
 * weak interner).
 *
 * A weak interner gives full deduplication — every equal string maps to one
 * canonical instance — while each entry dies with the last reference to its
 * string, so values belonging to an unloaded DAO are released instead of
 * pinned. The length gate skips very long values: they are almost always
 * unique, and hashing them costs O(length) per occurrence.
 *
 * Unlike intern(), equal strings from different sources are canonical only
 * while an instance stays reachable — never compare strings with ==. For lock
 * identity (synchronized on a canonical instance), keep String.intern().
 */
public final class StringInterner {

  protected static final int MAX_LENGTH = 128;

  protected static final Interner<String> INTERNER = Interners.newWeakInterner();

  private StringInterner() {}

  public static String intern(String s) {
    if ( s == null || s.length() > MAX_LENGTH ) return s;
    return INTERNER.intern(s);
  }
}
