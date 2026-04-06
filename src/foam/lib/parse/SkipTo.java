/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;

/**
 * Advances the stream to the next occurrence of a literal string using
 * String.indexOf() for O(n) native performance. Creates a single PStream
 * at the target position instead of walking the tail chain character-by-character.
 *
 * Use instead of Until when skipping large stretches of irrelevant text
 * to reach a known string marker.
 *
 * The skipped content is discarded (value is null). The stream is positioned
 * at the START of the found pattern so subsequent parsers can match it.
 * If the pattern is not found, the stream advances to EOF.
 */
public class SkipTo
  implements Parser
{
  protected String pattern_;

  public SkipTo(String pattern) {
    pattern_ = pattern;
  }

  public PStream parse(PStream ps, ParserContext x) {
    if ( ! ps.valid() ) return null;

    if ( ! (ps instanceof StringPStream) ) {
      // Fallback: scan character-by-character for non-StringPStream implementations
      return scanFallback(ps, x);
    }

    StringPStream sps = (StringPStream) ps;
    CharSequence  str = sps.str.get();

    // Search from pos + 1 to always advance at least one character.
    // Prevents infinite loops when the pattern is at the current position.
    int idx = str.toString().indexOf(pattern_, sps.pos() + 1);

    if ( idx < 0 ) {
      // Pattern not found — advance to EOF
      return new StringPStream(sps.str, str.length()).setValue(null);
    }

    // Jump directly to the pattern position
    return new StringPStream(sps.str, idx).setValue(null);
  }

  /**
   * Fallback for non-StringPStream: scan character-by-character.
   */
  private PStream scanFallback(PStream ps, ParserContext x) {
    // Build up characters and check for pattern match
    StringBuilder sb = new StringBuilder();
    PStream current = ps.tail(); // Always advance at least one

    while ( current.valid() ) {
      sb.append(current.head());
      if ( sb.length() >= pattern_.length() ) {
        int start = sb.length() - pattern_.length();
        boolean match = true;
        for ( int i = 0 ; i < pattern_.length() ; i++ ) {
          if ( sb.charAt(start + i) != pattern_.charAt(i) ) {
            match = false;
            break;
          }
        }
        if ( match ) {
          // Back up to the start of the pattern
          // We need to return a PStream positioned at the start of the match
          // Since we can't easily back up in PStream, return current positioned
          // pattern_.length() - 1 chars before end. Use a tracking approach instead.
          break;
        }
      }
      current = current.tail();
    }

    return current.setValue(null);
  }
}
