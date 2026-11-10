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
import java.util.Base64;
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
 * different models can never be compared. Each group packs its vectors with the
 * index's Quantizer, and a search scores the packed bytes
 * directly with {@link Quantizer#dot}, so it allocates nothing per row.
 *
 * Vectors are normalised to unit length here, once, before any quantizer sees
 * them, so a score is a cosine similarity whatever the precision.
 *
 * A journaled row is decoded by its vectorFormat with {@link #format}: the
 * quantizer this index is configured with, then the built-ins (Quantizers). A row
 * journaled in one format and indexed in another, after the configuration
 * changed, is decoded and re-encoded on load.
 *
 * Search is an exact, single-threaded scan of every matching row, with the
 * caller's predicate checked before each score.
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

  /** All vectors of one model and dimension count, packed by one Quantizer. */
  static final class Group {
    final Quantizer   quantizer;
    final int         dims;
    final int         rowBytes;
    byte[]            data = new byte[0];
    VectorEmbedding[] rows = new VectorEmbedding[0];
    int               size;

    Group(Quantizer quantizer, int dims) {
      this.quantizer = quantizer;
      this.dims      = dims;
      this.rowBytes  = quantizer.encodedSize(dims);
    }

    void write(int slot, VectorEmbedding row, byte[] encoded) {
      if ( slot >= rows.length ) {
        // The most rows whose bytes fit one Java array.
        int limit = Integer.MAX_VALUE / rowBytes;
        if ( slot >= limit )
          throw new IllegalStateException(
            "VectorIndex group full: " + slot + " rows of " + dims + " dims");
        int cap = (int) Math.min(limit, Math.max(16L, rows.length * 2L));
        data = Arrays.copyOf(data, cap * rowBytes);
        rows = Arrays.copyOf(rows, cap);
      }
      System.arraycopy(encoded, 0, data, slot * rowBytes, rowBytes);
      rows[slot] = row;
    }

    /** Remove a slot by moving the last row into it; returns the moved row, or null. */
    VectorEmbedding removeAt(int slot) {
      int last = --size;
      VectorEmbedding moved = null;
      if ( slot != last ) {
        System.arraycopy(data, last * rowBytes, data, slot * rowBytes, rowBytes);
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

  /** A row's vector checked, normalised and encoded for its group; see {@link #pack}. */
  public static final class Packed {
    public final String    model;
    public final int       dims;
    public final Quantizer quantizer;
    public final byte[]    bytes;
    /** True when bytes differ from the row's vectorData, so the row must be rewritten. */
    public final boolean   changed;

    Packed(String model, int dims, Quantizer quantizer, byte[] bytes, boolean changed) {
      this.model     = model;
      this.dims      = dims;
      this.quantizer = quantizer;
      this.bytes     = bytes;
      this.changed   = changed;
    }
  }

  protected final Quantizer               quantizer_;

  // One read/write lock for the whole store: writes wait for in-flight searches.
  // Per-group copy-on-write would let writes overlap long scans if that is ever needed.
  protected final ReentrantReadWriteLock lock_   = new ReentrantReadWriteLock();
  protected final Map<String, Group>     groups_ = new HashMap<>();
  protected final Map<String, Slot>      slots_  = new HashMap<>();
  protected volatile boolean             loaded_ = false;

  /** quantizer packs every row. */
  public VectorIndex(Quantizer quantizer) {
    quantizer_ = quantizer;
  }

  public boolean isLoaded() { return loaded_; }
  public void setLoaded(boolean loaded) { loaded_ = loaded; }

  /** The Quantizer that reads a vectorFormat in this index, or null if it is unknown here. */
  public Quantizer format(String format) {
    return quantizer_.formatId().equals(format) ? quantizer_ : Quantizers.builtIn(format);
  }

  /**
   * A row's vector, checked and encoded the way its group stores it: the one
   * place a vector is validated. Returns null when the row has no vector. Throws
   * IllegalArgumentException when the vector cannot be used: an unknown format,
   * bytes that are not base64 or not a whole number of dimensions, NaN or
   * infinity, or a zero vector.
   *
   * Packed bytes already in the group's format and within 1% of unit length are kept
   * as they are, so a lossy format is never quantized twice (a quantized unit vector
   * drifts a little from length 1); anything else is normalised and re-encoded.
   */
  public Packed pack(VectorEmbedding row) {
    float[]   unit;
    byte[]    stored = null;
    Quantizer from   = null;
    if ( row.getVector() != null && row.getVector().length > 0 ) {
      unit = row.getVector();
    } else if ( SafetyUtil.isEmpty(row.getVectorData()) ) {
      return null;
    } else {
      from = format(row.getVectorFormat());
      if ( from == null )
        throw new IllegalArgumentException("unknown vector format " + row.getVectorFormat());
      stored = Base64.getDecoder().decode(row.getVectorData());
      try {
        unit = from.decode(stored);
      } catch (RuntimeException e) {
        // A custom Quantizer may throw on bytes it cannot read: that row is bad, not the store.
        throw new IllegalArgumentException(
          "vector bytes cannot be decoded as " + from.formatId(), e);
      }
      if ( unit.length == 0 || stored.length != from.encodedSize(unit.length) )
        throw new IllegalArgumentException(
          "vector bytes are not a whole number of " + from.formatId() + " dimensions");
    }
    if ( ! isFinite(unit) ) throw new IllegalArgumentException("vector contains NaN or infinity");
    double norm = 0;
    for ( float f : unit ) norm += (double) f * f;
    if ( norm == 0 ) throw new IllegalArgumentException("vector is all zeros");

    int       dims = unit.length;
    Quantizer to   = quantizer_;
    boolean   keep = from != null && from.formatId().equals(to.formatId())
      && Math.abs(Math.sqrt(norm) - 1) < 1e-2;
    byte[]    bytes = keep ? stored : to.encode(normalized(unit));
    return new Packed(row.getEmbeddingModel(), dims, to, bytes, ! keep);
  }

  /** True when every component is a real number; NaN or infinity would poison every score. */
  public static boolean isFinite(float[] v) {
    if ( v == null ) return true;
    for ( float f : v ) if ( ! Float.isFinite(f) ) return false;
    return true;
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
   * Add or replace a row. A row with no vector is removed from the store.
   * Throws IllegalArgumentException when its vector cannot be used (see {@link #pack}),
   * and whatever a custom Quantizer throws on it; the caller that loads many rows
   * decides what one bad row costs.
   */
  public void put(VectorEmbedding row) {
    put(row, pack(row));
  }

  /** Add or replace a row whose vector {@link #pack} already produced; null removes it. */
  public void put(VectorEmbedding row, Packed packed) {
    if ( packed == null ) {
      remove(row.getId());
      return;
    }
    String key = key(packed.model, packed.dims);
    lock_.writeLock().lock();
    try {
      Slot slot = slots_.get(row.getId());
      if ( slot != null && slot.key.equals(key) ) {
        groups_.get(key).write(slot.index, row, packed.bytes);
        return;
      }
      if ( slot != null ) removeLocked(row.getId());

      Group group = groups_.computeIfAbsent(key, k -> new Group(packed.quantizer, packed.dims));
      int   index = group.size;
      // write throws when the group is full; size is only bumped after it succeeds.
      group.write(index, row, packed.bytes);
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
    for ( int i = 0 ; i < group.size ; i++ ) {
      VectorEmbedding row = group.rows[i];
      if ( predicate != null && ! predicate.f(row) ) continue;

      float s = group.quantizer.dot(q, group.data, i * group.rowBytes);

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
