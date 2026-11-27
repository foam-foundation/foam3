/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

/**
 * Hands back a canonical instance equal to the string it is given, so equal
 * values can share one String. Null passes through.
 *
 * Interners chain: StringInterner keeps the values it has seen during one
 * replay and hands each value it sees a second time to the next interner;
 * GLOBAL, shared by every replay, is a bounded LRU in front of the JVM table.
 */
public interface Interner {

  /** The shared chain replays hand their second sights to. */
  Interner GLOBAL = new LruInterner(1 << 20, 16, JvmInterner.INSTANCE);

  String intern(String s);

  /**
   * The canonical already held for s, or null; never stores s. StringInterner
   * asks on a first sight. The default holds nothing, so a first sight stays
   * raw, as without this method.
   */
  default String find(String s) { return null; }
}
