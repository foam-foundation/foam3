/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * High-performance StringPStream using direct char[] access instead of
 * Reference&lt;CharSequence&gt; indirection.
 *
 * head() is a direct array access: chars_[pos_]
 * valid() is a direct int comparison: pos_ < len_
 *
 * Drop-in replacement for StringPStream. All grammar parsers benefit
 * from reduced per-character overhead.
 */
public class FastStringPStream
  implements PStream
{
  protected char[]           chars_;
  protected int              pos_;
  protected int              len_;
  protected FastStringPStream tail_ = null;
  private   Object           value_ = null;

  public FastStringPStream() {
    chars_ = new char[0];
    len_   = 0;
    pos_   = 0;
  }

  public FastStringPStream(String s) {
    chars_ = s.toCharArray();
    len_   = chars_.length;
    pos_   = 0;
  }

  protected FastStringPStream(char[] chars, int len, int pos) {
    chars_ = chars;
    len_   = len;
    pos_   = pos;
  }

  protected FastStringPStream(char[] chars, int len, int pos, Object value) {
    chars_ = chars;
    len_   = len;
    pos_   = pos;
    value_ = value;
  }

  /** Reset for a new string (reuse same object, like StringPStream.setString). */
  public void setString(String s) {
    chars_ = s.toCharArray();
    len_   = chars_.length;
    pos_   = 0;
    tail_  = null;
    value_ = null;
  }

  @Override
  public char head() {
    return chars_[pos_];
  }

  @Override
  public boolean valid() {
    return pos_ < len_;
  }

  @Override
  public PStream tail() {
    if ( tail_ == null ) tail_ = new FastStringPStream(chars_, len_, pos_ + 1);
    return tail_;
  }

  @Override
  public Object value() {
    return value_;
  }

  @Override
  public PStream setValue(Object value) {
    return new FastStringPStream(chars_, len_, pos_, value);
  }

  @Override
  public String substring(PStream end) {
    return new String(chars_, pos_, end.pos() - pos_);
  }

  @Override
  public PStream apply(Parser p, ParserContext x) {
    return p.parse(this, x);
  }

  @Override
  public int pos() {
    return pos_;
  }

  /** Return the underlying string for indexOf-based optimizations. */
  public String getString() {
    return new String(chars_, 0, len_);
  }

  /** Create a new FastStringPStream at the given position sharing the same char[]. */
  public FastStringPStream createAt(int newPos) {
    return new FastStringPStream(chars_, len_, newPos);
  }
}
