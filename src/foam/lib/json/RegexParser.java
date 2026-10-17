/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lib.parse.*;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

public class RegexParser
  extends ProxyParser
{
  private static Parser instance__ = new RegexParser();
  private static final Map<Character, Integer> FLAGS = new HashMap<>();

  static {
    FLAGS.put('i', Pattern.CASE_INSENSITIVE);
    FLAGS.put('m', Pattern.MULTILINE);
    FLAGS.put('s', Pattern.DOTALL);
    FLAGS.put('x', Pattern.COMMENTS);
  }

  public static Parser instance() {
    return instance__ == null ? new ProxyParser() { public Parser getDelegate() { return instance__; } } : instance__;
  }

  private RegexParser() {
    setDelegate(StringParser.instance());
  }

  @Override
  public PStream parse(PStream ps, ParserContext x) {
    ps = super.parse(ps, x);
    if ( ps == null ) return null;

    Object value = ps.value();
    if ( ! ( value instanceof String ) ) return ps;

    try {
      return ps.setValue(toPattern((String) value));
    } catch ( PatternSyntaxException e ) {
      return null;
    }
  }

  protected Pattern toPattern(String value) {
    if ( value == null ) return null;

    int length = value.length();
    if ( length >= 2 && value.charAt(0) == '/' ) {
      int closingSlash = findClosingSlash(value);
      if ( closingSlash > 0 && closingSlash < length ) {
        String pattern = value.substring(1, closingSlash);
        int flags = parseFlags(value.substring(closingSlash + 1));
        return flags == 0 ? Pattern.compile(pattern) : Pattern.compile(pattern, flags);
      }
    }

    return Pattern.compile(value);
  }

  protected int findClosingSlash(String value) {
    for ( int i = value.length() - 1 ; i > 0 ; i-- ) {
      if ( value.charAt(i) != '/' ) continue;
      if ( isEscaped(value, i) ) continue;
      return i;
    }

    return -1;
  }

  protected boolean isEscaped(String value, int index) {
    int slashCount = 0;
    for ( int i = index - 1 ; i >= 0 && value.charAt(i) == '\\' ; i-- ) {
      slashCount++;
    }

    return slashCount % 2 == 1;
  }

  protected int parseFlags(String rawFlags) {
    int flags = 0;
    for ( int i = 0 ; i < rawFlags.length() ; i++ ) {
      Integer flag = FLAGS.get(rawFlags.charAt(i));
      if ( flag != null ) flags |= flag;
    }
    return flags;
  }
}
