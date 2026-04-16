/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Experimental PStream variant: a 256-char circular buffer that slides forward
 * as the parse advances, instead of holding the full source string directly in
 * the hot access path.
 *
 * Hypothesis (night-shift experiment): if the parser's working set is small
 * (a JSON value rarely straddles more than a few dozen chars), keeping the
 * live window in a power-of-two char[] under bitmask indexing may improve
 * cache locality and code-gen compared to StringPStream's
 * Reference&lt;CharSequence&gt;.get().charAt(pos) lookup.
 *
 * Correctness: the source string is still retained so substring() and the
 * fallback path in head() can serve positions that have scrolled out of the
 * window. Parsers that backtrack more than RING_SIZE characters hit the
 * source fallback — correct, just slower on that path.
 *
 * Same interface contract as StringPStream: head, tail, valid, value, setValue,
 * substring, pos, apply.
 */
public class CircularStringPStream
  implements PStream
{
  public static final int RING_SIZE = 256;
  public static final int RING_MASK = RING_SIZE - 1;

  /**
   * State shared across every PStream node from one parse. Mutable: the ring
   * slides forward as positions are touched. Readers that fall behind the
   * window use the source-string fallback.
   */
  static final class Buffer {
    final CharSequence source_;
    final int          sourceLen_;
    final char[]       ring_ = new char[RING_SIZE];
    int                ringBase_ = 0;     // absolute pos whose ring slot is (ringBase_ & MASK)
    int                ringLoadedEnd_ = 0; // exclusive upper bound of loaded range

    Buffer(CharSequence s) {
      source_    = s;
      sourceLen_ = s.length();
      int initial = Math.min(RING_SIZE, sourceLen_);
      for ( int i = 0 ; i < initial ; i++ ) ring_[i] = s.charAt(i);
      ringLoadedEnd_ = initial;
    }

    /** Slide the ring forward so `pos` is loaded. Idempotent if already loaded. */
    void ensureLoaded(int pos) {
      if ( pos < ringLoadedEnd_ ) return;
      int target = Math.min(pos + 1, sourceLen_);
      while ( ringLoadedEnd_ < target ) {
        ring_[ringLoadedEnd_ & RING_MASK] = source_.charAt(ringLoadedEnd_);
        ringLoadedEnd_++;
      }
      ringBase_ = Math.max(0, ringLoadedEnd_ - RING_SIZE);
    }

    char charAt(int pos) {
      if ( pos >= ringBase_ && pos < ringLoadedEnd_ ) {
        return ring_[pos & RING_MASK];
      }
      // Out-of-window (backtracked past ring) — correct but slow path.
      return source_.charAt(pos);
    }
  }

  protected final Buffer  buf_;
  protected final int     pos_;
  protected CircularStringPStream tail_ = null;
  private   Object        value_ = null;

  public CircularStringPStream(String s) {
    buf_ = new Buffer(s);
    pos_ = 0;
  }

  public CircularStringPStream(CharSequence s) {
    buf_ = new Buffer(s);
    pos_ = 0;
  }

  protected CircularStringPStream(Buffer buf, int pos) {
    buf_ = buf;
    pos_ = pos;
  }

  protected CircularStringPStream(Buffer buf, int pos, Object value) {
    buf_   = buf;
    pos_   = pos;
    value_ = value;
  }

  /** Create a fresh instance at position 0 for a new source string. */
  public static CircularStringPStream forString(String s) {
    return new CircularStringPStream(s);
  }

  @Override
  public char head() {
    buf_.ensureLoaded(pos_);
    return buf_.charAt(pos_);
  }

  @Override
  public boolean valid() {
    return pos_ < buf_.sourceLen_;
  }

  @Override
  public PStream tail() {
    if ( tail_ == null ) tail_ = new CircularStringPStream(buf_, pos_ + 1);
    return tail_;
  }

  @Override
  public Object value() {
    return value_;
  }

  @Override
  public PStream setValue(Object value) {
    return new CircularStringPStream(buf_, pos_, value);
  }

  @Override
  public String substring(PStream end) {
    return buf_.source_.subSequence(pos_, end.pos()).toString();
  }

  @Override
  public PStream apply(Parser p, ParserContext x) {
    return p.parse(this, x);
  }

  @Override
  public int pos() {
    return pos_;
  }

  /** Return the underlying source for indexOf-style optimizations. */
  public CharSequence getString() {
    return buf_.source_;
  }

  /** Create a new PStream at the given position sharing the same buffer. */
  public CircularStringPStream createAt(int newPos) {
    return new CircularStringPStream(buf_, newPos);
  }
}
