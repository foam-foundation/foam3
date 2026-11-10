/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.ai.vector;

import foam.mlang.predicate.Predicate;
import foam.util.SafetyUtil;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * The in-memory search store behind VectorStoreDAO.
 *
 * Rows are grouped by embedding model and dimension count, because vectors of
 * different models can never be compared. Each group keeps its vectors, scaled
 * to unit length, in one contiguous float[] so a search reads them end to end,
 * and keeps the rows themselves in a parallel array.
 *
 * A row is added, replaced or removed in place when VectorStoreDAO writes it, so
 * the index is built once and never rebuilt.
 *
 * Vectors are normalised here, once, so a score is a cosine similarity.
 *
 * Search is an exact, single-threaded scan of every row in the matching groups,
 * with the caller's predicate checked before each score.
 */
public class VectorIndex {

  /** One search result: the stored row and its cosine similarity to the query. */
  public static final class Hit {
    public final VectorEmbedding row;
    public final float           score;

    Hit(VectorEmbedding row, float score) {
      this.row   = row;
      this.score = score;
    }
  }

  /**
   * Worst first: a lower score, then a larger id. A heap of this order drops the worst
   * hit, and equal scores break the same way whatever k is, so pages of tied rows (the
   * same chunk embedded twice) neither repeat nor skip a row.
   */
  static final Comparator<Hit> BY_SCORE = (a, b) -> {
    int c = Float.compare(a.score, b.score);
    return c != 0 ? c : b.row.getId().compareTo(a.row.getId());
  };

  /** All vectors of one model and dimension count. */
  static final class Group {
    final int         dims;
    float[]           data = new float[0];
    VectorEmbedding[] rows = new VectorEmbedding[0];
    int               size;

    Group(int dims) {
      this.dims = dims;
    }

    void write(int slot, VectorEmbedding row, float[] unit) {
      if ( slot >= rows.length ) {
        // The most rows whose floats fit one Java array.
        int limit = Integer.MAX_VALUE / dims;
        if ( slot >= limit )
          throw new IllegalStateException(
            "VectorIndex group full: " + slot + " rows of " + dims + " dims");
        int cap = (int) Math.min(limit, Math.max(16L, rows.length * 2L));
        data = Arrays.copyOf(data, cap * dims);
        rows = Arrays.copyOf(rows, cap);
      }
      System.arraycopy(unit, 0, data, slot * dims, dims);
      rows[slot] = row;
    }

    /** Remove a slot by moving the last row into it; returns the moved row, or null. */
    VectorEmbedding removeAt(int slot) {
      int last = --size;
      VectorEmbedding moved = null;
      if ( slot != last ) {
        System.arraycopy(data, last * dims, data, slot * dims, dims);
        rows[slot] = moved = rows[last];
      }
      rows[last] = null;
      return moved;
    }
  }

  /** Where a row's vector lives, so an update or remove finds it without a scan. */
  static final class Slot {
    final String key;
    int          index;

    Slot(String key, int index) {
      this.key   = key;
      this.index = index;
    }
  }

  // One read/write lock for the whole store: writes wait for in-flight searches.
  protected final ReentrantReadWriteLock lock_   = new ReentrantReadWriteLock();
  protected final Map<String, Group>     groups_ = new HashMap<>();
  protected final Map<String, Slot>      slots_  = new HashMap<>();
  protected volatile boolean             loaded_ = false;

  public boolean isLoaded() { return loaded_; }
  public void setLoaded(boolean loaded) { loaded_ = loaded; }

  /** True when every component is a real number; NaN or infinity would poison every score. */
  public static boolean isFinite(float[] v) {
    if ( v == null ) return true;
    for ( float f : v ) if ( ! Float.isFinite(f) ) return false;
    return true;
  }

  /**
   * Why a vector cannot be indexed, or null when it can: NaN or infinity would
   * poison every score, and a zero vector has no direction to compare. A row with
   * no vector at all is not an error; it is simply not indexed.
   */
  public static String check(float[] v) {
    if ( v == null || v.length == 0 ) return null;
    if ( ! isFinite(v) ) return "contains NaN or infinity";
    double norm = 0;
    for ( float f : v ) norm += (double) f * f;
    return norm == 0 ? "is all zeros" : null;
  }

  /** v scaled to unit length; a zero or non-finite vector becomes all zeros, which scores 0. */
  public static float[] normalized(float[] v) {
    double norm = 0;
    for ( float f : v ) norm += (double) f * f;
    norm = Math.sqrt(norm);
    float[] u = new float[v.length];
    if ( norm == 0 || ! Double.isFinite(norm) ) return u;
    for ( int i = 0 ; i < v.length ; i++ ) u[i] = (float) (v[i] / norm);
    return u;
  }

  static String key(String model, int dims) {
    return (model == null ? "" : model) + '\u0000' + dims;
  }

  // ── writes ─────────────────────────────────────────────────────────────────

  /**
   * Add or replace a row. A row with no vector is removed from the index.
   * Throws IllegalArgumentException when its vector cannot be used (see {@link #check}),
   * and whatever the index throws when it cannot hold it; the caller that loads many
   * rows decides what one bad row costs.
   */
  public void put(VectorEmbedding row) {
    float[] v = row.getVector();
    if ( v == null || v.length == 0 ) {
      remove(row.getId());
      return;
    }
    String problem = check(v);
    if ( problem != null ) throw new IllegalArgumentException("vector " + problem);
    float[] unit = normalized(v);
    String  key  = key(row.getEmbeddingModel(), unit.length);
    lock_.writeLock().lock();
    try {
      Slot slot = slots_.get(row.getId());
      if ( slot != null && slot.key.equals(key) ) {
        groups_.get(key).write(slot.index, row, unit);
        return;
      }
      // A changed model or dimension count moves the row to another group.
      if ( slot != null ) removeLocked(row.getId());

      Group group = groups_.computeIfAbsent(key, k -> new Group(unit.length));
      int   index = group.size;
      // write throws when the group is full; size is only bumped after it succeeds.
      group.write(index, row, unit);
      group.size++;
      slots_.put(row.getId(), new Slot(key, index));
    } finally {
      lock_.writeLock().unlock();
    }
  }

  public void remove(String id) {
    lock_.writeLock().lock();
    try {
      removeLocked(id);
    } finally {
      lock_.writeLock().unlock();
    }
  }

  protected void removeLocked(String id) {
    Slot slot = slots_.remove(id);
    if ( slot == null ) return;
    Group           group = groups_.get(slot.key);
    VectorEmbedding moved = group.removeAt(slot.index);
    if ( moved != null ) slots_.get(moved.getId()).index = slot.index;
    if ( group.size == 0 ) groups_.remove(slot.key);
  }

  public void clear() {
    lock_.writeLock().lock();
    try {
      groups_.clear();
      slots_.clear();
      loaded_ = false;
    } finally {
      lock_.writeLock().unlock();
    }
  }

  public int size() {
    lock_.readLock().lock();
    try {
      return slots_.size();
    } finally {
      lock_.readLock().unlock();
    }
  }

  // ── search ─────────────────────────────────────────────────────────────────

  /**
   * The k rows most similar to query, best first.
   *
   * model selects the group to scan; when empty, every group whose dimension count
   * matches the query is scanned (the caller's predicate can still pin the model).
   * predicate, when not null, is checked on each row before its score is computed, so a
   * filter on a few documents scores only their rows. It runs on every row in scope, under
   * the read lock that writes wait on: keep it cheap and dependent on the row alone. A check
   * that reads other records belongs before the search (the ids it allows) or in the
   * delegate, which VectorStoreDAO asks for each hit.
   */
  public List<Hit> search(float[] query, String model, Predicate predicate, int k) {
    List<Hit> result = new ArrayList<>();
    if ( query == null || query.length == 0 || k <= 0 ) return result;
    if ( ! isFinite(query) )
      throw new IllegalArgumentException("query vector contains NaN or infinity");
    float[] q = normalized(query);

    lock_.readLock().lock();
    try {
      // k can be the whole store when a caller sets no limit; the heap grows on demand.
      PriorityQueue<Hit> best =
        new PriorityQueue<>(Math.min(k, Math.min(slots_.size(), 1024)) + 1, BY_SCORE);
      for ( Map.Entry<String, Group> e : groups_.entrySet() ) {
        Group group = e.getValue();
        if ( group.dims != q.length ) continue;
        if ( ! SafetyUtil.isEmpty(model) && ! e.getKey().equals(key(model, q.length)) ) continue;
        scan(group, q, predicate, k, best);
      }
      result.addAll(best);
    } finally {
      lock_.readLock().unlock();
    }

    result.sort(BY_SCORE.reversed());
    return result;
  }

  protected void scan(Group group, float[] q, Predicate predicate, int k, PriorityQueue<Hit> best) {
    int dims = group.dims;
    for ( int i = 0 ; i < group.size ; i++ ) {
      VectorEmbedding row = group.rows[i];
      if ( predicate != null && ! predicate.f(row) ) continue;

      int   offset = i * dims;
      float s      = 0f;
      for ( int j = 0 ; j < dims ; j++ ) s += q[j] * group.data[offset + j];

      // A Hit is only allocated for rows that make the current top k.
      if ( best.size() < k ) {
        best.add(new Hit(row, s));
      } else {
        Hit worst = best.peek();
        if ( s > worst.score || s == worst.score && row.getId().compareTo(worst.row.getId()) < 0 ) {
          best.poll();
          best.add(new Hit(row, s));
        }
      }
    }
  }
}
