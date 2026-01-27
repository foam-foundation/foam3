package foam.util;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
   String helper methods.
 */
public class StringUtil {

  protected static ThreadLocal<StringBuilder> builder__ = new ThreadLocal<StringBuilder>() {
    @Override
    protected StringBuilder initialValue() {
      return new StringBuilder();
    }
    @Override
    public StringBuilder get() {
      StringBuilder sb = super.get();
      sb.setLength(0);
      return sb;
    }
  };

  private static ThreadLocal<java.util.List<String>> storage__ =
    new ThreadLocal<java.util.List<String>>() {
      @Override
      protected java.util.List<String> initialValue() {
        return new java.util.ArrayList<String>(30);
      }

      @Override
      public java.util.List<String> get() {
        java.util.List<String> a = super.get();
        a.clear();
        return a;
      }
    };

  public static String daoize(String s) {
    return (s.length() > 0 ? s.substring(0,1).toLowerCase() : "")
      + (s.length() > 1 ? s.substring(1) : "")
      + "DAO";
  }

  // A string splitting mechanism which does not split if the
  // separator has been escaped.
  public static String[] split(String s, char separator) {
    java.util.List<String> list = storage__.get();

    StringBuilder sb = builder__.get();
    boolean escaping = false;
    char escape = '\\';
    char prev;
    char[] cs = s.toCharArray();

    for ( int i = 0 ; i < cs.length ; i++ ) {
      char c = cs[i];

      if ( escaping ) {
        sb.append(c);
        escaping = false;
      } else if ( c == escape ) {
        escaping = true;
      } else if ( c == separator ) {
        list.add(sb.toString());
        sb.setLength(0);
      } else {
        sb.append(c);
      }
    }

    list.add(sb.toString());

    String[] result = new String[list.size()];

    return list.toArray(result);
  }

  public static String capitalize(String s) {
    if ( SafetyUtil.isEmpty(s) ) return s;
    char[] chars = s.toCharArray();
    chars[0] = Character.toUpperCase(chars[0]);
    return new String(chars);
  }

  public static String constantize(String s) {
    // convert from from fooBar to FOO_BAR
    return s.replaceAll("-","_").replaceAll("([a-z])([^0-9a-z_])", "$1_$2").replaceAll("\\s","").toUpperCase();
  }

  // Replace non ASC-II unicode with non unicode representation, finally strip out any remaining printable unicode characters.
  public static String normalize(String s) {
    return java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replaceAll("\\P{Print}", "");
  }

  public static String labelize(String s) {
    if ( SafetyUtil.isEmpty(s) ) return s;

    var sb = new StringBuilder();
    char current = 0;
    for ( var c : s.toCharArray() ) {
      if ( current == 0 ) {
        current = Character.toUpperCase(c);
      } else {
        // Replace underscore with space
        if ( c == '_' ) c = ' ';

        if ( Character.isLowerCase(current) && Character.isUpperCase(c) ) {
          sb.append(' ');
        }
        current = c;
      }
      sb.append(current);
    }
    return sb.toString();
  }

  /**
   * Sets the suffix of a string to the provided suffix, will not set the suffix if it's already set
   * @param s String to add suffix too
   * @param suffix The suffix to add to the string
   * @param ignoreCase Whether of not the suffix check is case-sensitive
   * @return The string s with the suffix set
   */
  public static String setSuffix(String s, String suffix, boolean ignoreCase) {
    if ( suffix.regionMatches(ignoreCase, 0, s, s.length() - suffix.length(), suffix.length()) )
      return s;
    return s + suffix;
  }

  public static String toQueryString(String... data) {
    if ( data.length % 2 == 1 )
      throw new RuntimeException("Invalid query string data");

    var sb = new StringBuilder();
    for ( var i = 0 ; i < data.length - 1 ; i += 2 ) {
      if ( i > 0 )
        sb.append('&');

      sb.append(URLEncoder.encode(data[i], StandardCharsets.UTF_8))
        .append('=')
        .append(URLEncoder.encode(data[i+1], StandardCharsets.UTF_8));
    }
    return sb.toString();
  }
}
