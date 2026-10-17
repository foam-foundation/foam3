/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Shared layout for a class generated with javaSparse: which property ordinals an
 * instance has set, and the slot each one occupies in the instance's values array.
 *
 * One shape per distinct set of ordinals, canonical per class, so every instance with
 * the same set of properties points at the same shape and owns only its values array.
 * A first-time set moves an instance to the shape with that ordinal added (cached per
 * transition); a clear moves it to the shape without it.
 */
public final class SparseShape {
  public static final Object[] EMPTY = new Object[0];

  private final short[]      slotOf_;    // ordinal -> slot in values, -1 when absent
  private final short[]      ordinals_;  // sorted ordinals present
  private final SparseShape[] with_;     // transition cache, indexed by ordinal

  // Every shape reachable from one root, keyed by its ordinal set, so insertion order
  // never produces two shapes for the same set.
  private final ConcurrentHashMap<Key, SparseShape> canonical_;

  /** The empty shape for a class with propertyCount sparse properties. */
  public static SparseShape root(int propertyCount) {
    ConcurrentHashMap<Key, SparseShape> canonical = new ConcurrentHashMap<>();
    SparseShape root = new SparseShape(propertyCount, new short[0], canonical);
    canonical.put(new Key(root.ordinals_), root);
    return root;
  }

  private SparseShape(int propertyCount, short[] ordinals, ConcurrentHashMap<Key, SparseShape> canonical) {
    slotOf_ = new short[propertyCount];
    Arrays.fill(slotOf_, (short) -1);
    for ( short i = 0 ; i < ordinals.length ; i++ ) slotOf_[ordinals[i]] = i;
    ordinals_  = ordinals;
    with_      = new SparseShape[propertyCount];
    canonical_ = canonical;
  }

  /** Slot of the ordinal in the values array, or -1 when the property is not set. */
  public int slotOf(int ordinal) {
    return slotOf_[ordinal];
  }

  public int size() {
    return ordinals_.length;
  }

  /** The shape with this ordinal present; this shape when it already is. */
  public SparseShape with(int ordinal) {
    if ( slotOf_[ordinal] >= 0 ) return this;
    SparseShape s = with_[ordinal];
    if ( s != null ) return s;
    short[] next = new short[ordinals_.length + 1];
    int i = 0;
    while ( i < ordinals_.length && ordinals_[i] < ordinal ) { next[i] = ordinals_[i]; i++; }
    next[i] = (short) ordinal;
    System.arraycopy(ordinals_, i, next, i + 1, ordinals_.length - i);
    s = canonical_.computeIfAbsent(new Key(next), k -> new SparseShape(slotOf_.length, next, canonical_));
    with_[ordinal] = s; // a racing writer stores the same canonical instance
    return s;
  }

  /** The shape with this ordinal absent; this shape when it already is. */
  public SparseShape without(int ordinal) {
    int slot = slotOf_[ordinal];
    if ( slot < 0 ) return this;
    short[] next = new short[ordinals_.length - 1];
    System.arraycopy(ordinals_, 0, next, 0, slot);
    System.arraycopy(ordinals_, slot + 1, next, slot, ordinals_.length - slot - 1);
    return canonical_.computeIfAbsent(new Key(next), k -> new SparseShape(slotOf_.length, next, canonical_));
  }

  public static Object[] insertAt(Object[] a, int i, Object v) {
    Object[] b = new Object[a.length + 1];
    System.arraycopy(a, 0, b, 0, i);
    b[i] = v;
    System.arraycopy(a, i, b, i + 1, a.length - i);
    return b;
  }

  public static Object[] removeAt(Object[] a, int i) {
    Object[] b = new Object[a.length - 1];
    System.arraycopy(a, 0, b, 0, i);
    System.arraycopy(a, i + 1, b, i, a.length - i - 1);
    return b;
  }

  private static final class Key {
    private final short[] ordinals_;

    Key(short[] ordinals) { ordinals_ = ordinals; }

    @Override public int hashCode() { return Arrays.hashCode(ordinals_); }

    @Override public boolean equals(Object o) {
      return o instanceof Key && Arrays.equals(ordinals_, ((Key) o).ordinals_);
    }
  }
}
