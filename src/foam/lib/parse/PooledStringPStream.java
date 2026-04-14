/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Arena-allocated StringPStream that reuses pre-allocated objects instead of
 * creating new ones on every tail() and setValue() call.
 *
 * Usage:
 *   PooledStringPStream ps = PooledStringPStream.create("json data");
 *   PStream result = ps.apply(parser, x);
 *   ps.resetPool();  // reclaim all pool slots for next entry
 *
 * If the pool is exhausted mid-parse, falls back to regular StringPStream
 * allocation (safe degradation).
 */
public class PooledStringPStream implements PStream {
  private static final int DEFAULT_POOL_SIZE = 8192;

  // Pool storage — shared across all instances from the same root
  private final PooledStringPStream[] pool_;
  private final int                   poolSize_;
  private int                         poolNext_ = 0;
  // Only the root tracks poolNext_ — pool slots delegate to root
  private final PooledStringPStream   root_;

  // Per-instance fields (same semantics as StringPStream)
  private CharSequence str_;
  private int          pos_;
  private Object       value_;
  private PStream      tail_;

  /** Create a root pooled stream for a given string. */
  public static PooledStringPStream create(String data) {
    return create(data, DEFAULT_POOL_SIZE);
  }

  public static PooledStringPStream create(String data, int poolSize) {
    PooledStringPStream root = new PooledStringPStream(null, poolSize);
    root.str_ = data;
    root.pos_ = 0;
    // Pre-allocate pool slots
    for ( int i = 0 ; i < poolSize ; i++ ) {
      root.pool_[i] = new PooledStringPStream(root, poolSize);
    }
    return root;
  }

  // Root constructor
  private PooledStringPStream(PooledStringPStream root, int poolSize) {
    poolSize_ = poolSize;
    if ( root == null ) {
      // This IS the root
      pool_ = new PooledStringPStream[poolSize];
      root_ = this;
    } else {
      // This is a pool slot — share root's pool array
      pool_ = root.pool_;
      root_ = root;
    }
  }

  /** Reclaim all pool slots. Call between journal entries. */
  public void resetPool() {
    for ( int i = 0 ; i < root_.poolNext_ ; i++ ) {
      pool_[i].tail_  = null;
      pool_[i].value_ = null;
    }
    tail_  = null;
    value_ = null;
    root_.poolNext_ = 0;
  }

  /** Reset for a new string (reuse the same pool). */
  public void setString(String data) {
    resetPool();
    str_ = data;
    pos_ = 0;
  }

  private PStream allocate(CharSequence str, int pos, Object value) {
    if ( root_.poolNext_ < poolSize_ ) {
      PooledStringPStream ps = pool_[root_.poolNext_++];
      ps.str_   = str;
      ps.pos_   = pos;
      ps.value_ = value;
      ps.tail_  = null;
      return ps;
    }
    // Pool exhausted — fall back to heap allocation
    return new StringPStream(new Reference<>(str), pos, value);
  }

  @Override public char head()     { return str_.charAt(pos_); }
  @Override public boolean valid()  { return pos_ < str_.length(); }
  @Override public Object value()   { return value_; }
  @Override public int pos()        { return pos_; }

  @Override
  public PStream tail() {
    if ( tail_ == null ) {
      tail_ = allocate(str_, pos_ + 1, null);
    }
    return tail_;
  }

  @Override
  public PStream setValue(Object value) {
    return allocate(str_, pos_, value);
  }

  @Override
  public String substring(PStream end) {
    return str_.subSequence(pos_, end.pos()).toString();
  }

  @Override
  public PStream apply(Parser p, ParserContext x) {
    return p.parse(this, x);
  }
}
