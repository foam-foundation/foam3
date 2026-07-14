/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.ascript;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Date;

/**
  AScript standard function library (Java tier).

  The server-side twin of the JS foam.ascript.lib. Each ALIB-generated mlang's
  javaCode delegates here (e.g. `return foam.ascript.Lib.LPAD(str, len, ch);`),
  so the implementation lives once per tier and client/server agree.

  SCOPE: per-record, scalar-in / scalar-out only. Range/aggregation (SUM over a
  column, AVERAGE, VLOOKUP, regression, ...) is the query layer's job, not here.

  TYPES: numeric args/returns are `double`/`long` to line up with FOAM's Float
  (double) and Int (long) property javaTypes; the generated prelude casts each
  arg via its PropertyInfo before the call, so defaults are already filled and
  every method receives its full arg list. FOAM's SafetyUtil.compare/equals
  treats all Number subtypes as double, so returning long here interoperates
  with double results elsewhere in an expression.

  CROSS-TIER PARITY NOTES (the only places JS and Java can legitimately differ):
   - Date extractors use the default timezone (Calendar.getInstance()) to mirror
     JS local-time getFullYear()/getMonth(); if client and server run in
     different zones the same instant can yield a different YEAR/DAY. Pin both to
     a chosen zone if that matters.
   - CURRENCY separators come from the runtime locale (NumberFormat vs JS
     toLocaleString) — digits/precision agree, grouping/decimal marks may not.
   - DATEDIF Y/M use average-length approximations (365.25 / 30.44 days), same as
     the JS side — not calendar-exact month counting.
   - VALUE("") is 0 in JS (Number("")) but NaN here (parse fails) — empty-string
     coercion is the one small edge that differs.
*/
public class Lib {

  // ─────────────────────────────── Text ───────────────────────────────

  /** Length of text (0 for null). */
  public static long LEN(String text) { return text == null ? 0 : text.length(); }

  /** Convert text to upper case. */
  public static String UPPER(String text) { return text == null ? "" : text.toUpperCase(); }

  /** Convert text to lower case. */
  public static String LOWER(String text) { return text == null ? "" : text.toLowerCase(); }

  /** Capitalize the first letter of each word. */
  public static String PROPER(String text) {
    if ( text == null ) return "";
    StringBuilder sb = new StringBuilder(text.length());
    boolean start = true;
    for ( int i = 0 ; i < text.length() ; i++ ) {
      char c = text.charAt(i);
      if ( Character.isLetterOrDigit(c) ) {
        sb.append(start ? Character.toUpperCase(c) : Character.toLowerCase(c));
        start = false;
      } else {
        sb.append(c);
        start = true;
      }
    }
    return sb.toString();
  }

  /** Trim ends and collapse internal whitespace to single spaces. */
  public static String TRIM(String text) {
    return text == null ? "" : text.replaceAll("\\s+", " ").trim();
  }

  /** Remove non-printable control characters. */
  public static String CLEAN(String text) {
    return text == null ? "" : text.replaceAll("[\\x00-\\x1F\\x7F]", "");
  }

  /** Leftmost numChars characters (default 1). */
  public static String LEFT(String text, long numChars) {
    if ( text == null ) return "";
    int n = (int) Math.max(0, numChars);
    return text.substring(0, Math.min(n, text.length()));
  }
  public static String LEFT(String text) { return LEFT(text, 1); }

  /** Rightmost numChars characters (default 1). */
  public static String RIGHT(String text, long numChars) {
    if ( text == null ) return "";
    int n = (int) numChars;
    if ( n <= 0 ) return "";
    return text.substring(Math.max(0, text.length() - n));
  }
  public static String RIGHT(String text) { return RIGHT(text, 1); }

  /** numChars characters from 1-based position start (Excel MID). */
  public static String MID(String text, long start, long numChars) {
    if ( text == null ) return "";
    int begin = (int) Math.max(0, start - 1);
    if ( begin >= text.length() || numChars <= 0 ) return "";
    return text.substring(begin, (int) Math.min(text.length(), begin + numChars));
  }

  /** JS-style substring: 0-based, end exclusive; end < 0 -> to end of string. */
  public static String SUBSTR(String text, long start, long end) {
    if ( text == null ) return "";
    int len = text.length();
    int e = end < 0 ? len : (int) Math.min(end, len);
    int s = (int) Math.max(0, Math.min(start, e));
    return text.substring(s, e);
  }
  public static String SUBSTR(String text, long start) { return SUBSTR(text, start, -1); }

  /** Replace oldText with newText (all occurrences, or only the instanceNum-th when > 0). */
  public static String SUBSTITUTE(String text, String oldText, String newText, long instanceNum) {
    String s = text == null ? "" : text;
    if ( oldText == null || oldText.isEmpty() ) return s;
    String n = newText == null ? "" : newText;
    if ( instanceNum <= 0 ) return s.replace(oldText, n); // replace() is all literal occurrences
    StringBuilder sb = new StringBuilder();
    int idx = 0, count = 0;
    while ( true ) {
      int p = s.indexOf(oldText, idx);
      if ( p < 0 ) { sb.append(s.substring(idx)); break; }
      count++;
      if ( count == instanceNum ) {
        sb.append(s, idx, p).append(n).append(s.substring(p + oldText.length()));
        break;
      }
      sb.append(s, idx, p + oldText.length());
      idx = p + oldText.length();
    }
    return sb.toString();
  }
  public static String SUBSTITUTE(String text, String oldText, String newText) {
    return SUBSTITUTE(text, oldText, newText, 0);
  }

  /** Replace numChars characters from 1-based startNum with newText. */
  public static String REPLACE(String oldText, long startNum, long numChars, String newText) {
    String s = oldText == null ? "" : oldText;
    int st  = (int) Math.max(0, Math.min(startNum - 1, s.length()));
    int end = (int) Math.max(st, Math.min(st + numChars, s.length()));
    return s.substring(0, st) + (newText == null ? "" : newText) + s.substring(end);
  }

  /** Repeat text `times` times. */
  public static String REPT(String text, long times) {
    if ( times <= 0 || text == null ) return "";
    StringBuilder sb = new StringBuilder();
    for ( long i = 0 ; i < times ; i++ ) sb.append(text);
    return sb.toString();
  }

  /** 1-based position of findText (case-sensitive), or -1. */
  public static long FIND(String findText, String withinText, long startNum) {
    int i = (withinText == null ? "" : withinText).indexOf(findText == null ? "" : findText, (int) startNum - 1);
    return i == -1 ? -1 : i + 1;
  }
  public static long FIND(String findText, String withinText) { return FIND(findText, withinText, 1); }

  /** 1-based position of findText (case-insensitive), or -1. */
  public static long SEARCH(String findText, String withinText, long startNum) {
    int i = (withinText == null ? "" : withinText).toLowerCase()
              .indexOf((findText == null ? "" : findText).toLowerCase(), (int) startNum - 1);
    return i == -1 ? -1 : i + 1;
  }
  public static long SEARCH(String findText, String withinText) { return SEARCH(findText, withinText, 1); }

  /** True if the two texts are identical (case-sensitive). */
  public static boolean EXACT(String text1, String text2) {
    return String.valueOf(text1).equals(String.valueOf(text2));
  }

  /** Reverse the characters of text. */
  public static String REVERSE(String text) {
    return text == null ? "" : new StringBuilder(text).reverse().toString();
  }

  /** Character for a character code. */
  public static String CHAR(long number) { return String.valueOf((char) number); }

  /** Character code of the first character (0 if empty). */
  public static long CODE(String text) {
    return ( text == null || text.isEmpty() ) ? 0 : text.charAt(0);
  }

  /** Convert text to a number (NaN if unparseable). */
  public static double VALUE(String text) {
    if ( text == null ) return Double.NaN;
    try { return Double.parseDouble(text.trim()); }
    catch ( NumberFormatException e ) { return Double.NaN; }
  }

  /** Left-pad str to len using ch (default '0'). */
  public static String LPAD(String str, long len, String ch) {
    if ( str == null ) str = "";
    if ( ch == null || ch.isEmpty() ) ch = "0";
    int padLen = (int) len - str.length();
    if ( padLen <= 0 ) return str;
    StringBuilder sb = new StringBuilder((int) len);
    while ( sb.length() < padLen ) sb.append(ch);
    sb.setLength(padLen);              // trim multi-char-pad overshoot (matches JS padStart)
    sb.append(str);
    return sb.toString();
  }
  public static String LPAD(String str, long len) { return LPAD(str, len, "0"); }

  /** Right-pad str to len using ch (default '0'). */
  public static String RPAD(String str, long len, String ch) {
    if ( str == null ) str = "";
    if ( ch == null || ch.isEmpty() ) ch = "0";
    StringBuilder sb = new StringBuilder((int) len);
    sb.append(str);
    while ( sb.length() < len ) sb.append(ch);
    if ( sb.length() > len ) sb.setLength((int) len);
    return sb.toString();
  }
  public static String RPAD(String str, long len) { return RPAD(str, len, "0"); }

  /** Mask the leftmost len characters with ch (default '*'). */
  public static String LMASK(String str, long len, String ch) {
    if ( str == null ) str = "";
    if ( ch == null || ch.isEmpty() ) ch = "*";
    int n = (int) len;
    String rest = n >= str.length() ? "" : str.substring(n);
    return LPAD(rest, str.length(), ch);
  }
  public static String LMASK(String str, long len) { return LMASK(str, len, "*"); }

  /** Mask the rightmost len characters with ch (default '*'). */
  public static String RMASK(String str, long len, String ch) {
    if ( str == null ) str = "";
    if ( ch == null || ch.isEmpty() ) ch = "*";
    int n = (int) len;
    String head = n >= str.length() ? "" : str.substring(0, str.length() - n);
    return RPAD(head, str.length(), ch);
  }
  public static String RMASK(String str, long len) { return RMASK(str, len, "*"); }

  // ─────────────────────────────── Math ───────────────────────────────

  /** Absolute value. */
  public static double ABS(double num) { return Math.abs(num); }

  /** Sign of a number (-1, 0, or 1). */
  public static double SIGN(double num) { return Math.signum(num); }

  /** Positive (absolute) difference between two numbers. */
  public static double DIFF(double a, double b) { return Math.abs(a - b); }

  /** Round to `digits` decimal places (default 0), half away from zero. */
  public static double ROUND(double num, long digits) {
    double f = Math.pow(10, digits);
    return Math.round(num * f) / f;
  }
  public static double ROUND(double num) { return ROUND(num, 0); }

  /** Round away from zero to `digits` places (default 0). */
  public static double ROUNDUP(double num, long digits) {
    double f = Math.pow(10, digits);
    return (num < 0 ? -1 : 1) * Math.ceil(Math.abs(num) * f) / f;
  }
  public static double ROUNDUP(double num) { return ROUNDUP(num, 0); }

  /** Round toward zero to `digits` places (default 0). */
  public static double ROUNDDOWN(double num, long digits) {
    double f = Math.pow(10, digits);
    return (num < 0 ? -1 : 1) * Math.floor(Math.abs(num) * f) / f;
  }
  public static double ROUNDDOWN(double num) { return ROUNDDOWN(num, 0); }

  /** Round to the nearest multiple. */
  public static double MROUND(double num, double multiple) {
    return Math.round(num / multiple) * multiple;
  }

  /** Round down to the nearest integer (toward -infinity). */
  public static double INT(double num) { return Math.floor(num); }

  /** Truncate toward zero to `digits` places (default 0). */
  public static double TRUNC(double num, long digits) {
    double f = Math.pow(10, digits);
    double x = num * f;
    return (x < 0 ? Math.ceil(x) : Math.floor(x)) / f;
  }
  public static double TRUNC(double num) { return TRUNC(num, 0); }

  /** Round up to the nearest multiple of significance (default 1). */
  public static double CEILING(double num, double significance) {
    return Math.ceil(num / significance) * significance;
  }
  public static double CEILING(double num) { return CEILING(num, 1); }

  /** Round down to the nearest multiple of significance (default 1). */
  public static double FLOOR(double num, double significance) {
    return Math.floor(num / significance) * significance;
  }
  public static double FLOOR(double num) { return FLOOR(num, 1); }

  /** Remainder, taking the sign of the divisor (Excel MOD). */
  public static double MOD(double num, double divisor) {
    return num - divisor * Math.floor(num / divisor);
  }

  /** Integer portion of a division (toward zero). */
  public static double QUOTIENT(double numerator, double denominator) {
    double q = numerator / denominator;
    return q < 0 ? Math.ceil(q) : Math.floor(q);
  }

  /** num raised to power. */
  public static double POWER(double num, double power) { return Math.pow(num, power); }

  /** Square root. */
  public static double SQRT(double num) { return Math.sqrt(num); }

  /** Round away from zero to the nearest even integer. */
  public static double EVEN(double num) {
    double r = Math.ceil(Math.abs(num));
    return ( ((long) r) % 2 == 0 ? r : r + 1 ) * (num < 0 ? -1 : 1);
  }

  /** Round away from zero to the nearest odd integer. */
  public static double ODD(double num) {
    double r = Math.ceil(Math.abs(num));
    return ( ((long) r) % 2 == 1 ? r : r + 1 ) * (num < 0 ? -1 : 1);
  }

  /** Format a number to fixed decimal places (default 0) as text. */
  public static String FIX(double num, long precision) {
    return String.format("%." + (int) precision + "f", num);
  }
  public static String FIX(double num) { return FIX(num, 0); }

  /** Format a number with grouping and fixed max precision (default 2). */
  public static String CURRENCY(double amt, long precision) {
    NumberFormat nf = NumberFormat.getNumberInstance();
    nf.setMaximumFractionDigits((int) precision);
    return nf.format(amt);
  }
  public static String CURRENCY(double amt) { return CURRENCY(amt, 2); }

  // ─────────────── Advanced math (category-hidden by default) ───────────────

  /** Natural logarithm. */
  public static double LN(double num) { return Math.log(num); }

  /** Logarithm to a base (default 10). */
  public static double LOG(double num, double base) { return Math.log(num) / Math.log(base); }
  public static double LOG(double num) { return Math.log10(num); }

  /** Base-10 logarithm. */
  public static double LOG10(double num) { return Math.log10(num); }

  /** e raised to num. */
  public static double EXP(double num) { return Math.exp(num); }

  /** The value of pi. */
  public static double PI() { return Math.PI; }

  /** Square root of (num * pi). */
  public static double SQRTPI(double num) { return Math.sqrt(num * Math.PI); }

  /** Factorial. */
  public static double FACT(double num) {
    double r = 1;
    for ( long i = 2 ; i <= num ; i++ ) r *= i;
    return r;
  }

  /** Number of combinations of n things taken k at a time. */
  public static double COMBIN(double n, double k) { return FACT(n) / (FACT(k) * FACT(n - k)); }

  /** Number of permutations of n things taken k at a time. */
  public static double PERMUT(double n, double k) { return FACT(n) / FACT(n - k); }

  /** Greatest common divisor of two integers. */
  public static long GCD(long a, long b) {
    a = Math.abs(a); b = Math.abs(b);
    while ( b != 0 ) { long t = b; b = a % b; a = t; }
    return a;
  }

  /** Least common multiple of two integers. */
  public static long LCM(long a, long b) { return Math.abs(a * b) / GCD(a, b); }

  /** Radians to degrees. */
  public static double DEGREES(double radians) { return radians * 180 / Math.PI; }

  /** Degrees to radians. */
  public static double RADIANS(double degrees) { return degrees * Math.PI / 180; }

  public static double SIN(double x)          { return Math.sin(x); }
  public static double COS(double x)          { return Math.cos(x); }
  public static double TAN(double x)          { return Math.tan(x); }
  public static double ASIN(double x)         { return Math.asin(x); }
  public static double ACOS(double x)         { return Math.acos(x); }
  public static double ATAN(double x)         { return Math.atan(x); }
  public static double ATAN2(double x, double y) { return Math.atan2(y, x); }
  public static double SINH(double x)         { return Math.sinh(x); }
  public static double COSH(double x)         { return Math.cosh(x); }
  public static double TANH(double x)         { return Math.tanh(x); }
  public static double ASINH(double x)        { return Math.log(x + Math.sqrt(x * x + 1)); }
  public static double ACOSH(double x)        { return Math.log(x + Math.sqrt(x * x - 1)); }
  public static double ATANH(double x)        { return 0.5 * Math.log((1 + x) / (1 - x)); }

  // ─────────────────────────── Logical / type ───────────────────────────

  /** True if value is null or empty string. */
  public static boolean ISBLANK(Object value) { return value == null || "".equals(value); }

  /** True if value is a number. */
  public static boolean ISNUMBER(Object value) { return value instanceof Number; }

  /** True if value is text. */
  public static boolean ISTEXT(Object value) { return value instanceof String; }

  /** True if value is a boolean. */
  public static boolean ISLOGICAL(Object value) { return value instanceof Boolean; }

  /** True if num is even. */
  public static boolean ISEVEN(double num) { return num % 2 == 0; }

  /** True if num is odd. */
  public static boolean ISODD(double num) { return Math.abs(num % 2) == 1; }

  /** Coerce to number: Number->itself, Boolean->1/0, Date->epoch millis, else 0. */
  public static double N(Object value) {
    if ( value instanceof Number )  return ((Number) value).doubleValue();
    if ( value instanceof Boolean ) return ((Boolean) value) ? 1 : 0;
    if ( value instanceof Date )    return ((Date) value).getTime();
    return 0;
  }

  // ─────────────────────────────── Date ───────────────────────────────
  // Singular calendar-component extractors (distinct from the duration mlangs
  // YEARS/MONTHS/DAYS/HOURS/MINUTES). Return -1 for a null date. See the
  // timezone parity note at the top of this file.

  private static Calendar cal(Date d) {
    Calendar c = Calendar.getInstance();
    c.setTime(d);
    return c;
  }

  /** Calendar year, or -1 if null. */
  public static long YEAR(Date date)   { return date == null ? -1 : cal(date).get(Calendar.YEAR); }

  /** Calendar month 1-12, or -1 if null. */
  public static long MONTH(Date date)  { return date == null ? -1 : cal(date).get(Calendar.MONTH) + 1; }

  /** Day of month, or -1 if null. */
  public static long DAY(Date date)    { return date == null ? -1 : cal(date).get(Calendar.DAY_OF_MONTH); }

  /** Hour 0-23, or -1 if null. */
  public static long HOUR(Date date)   { return date == null ? -1 : cal(date).get(Calendar.HOUR_OF_DAY); }

  /** Minute 0-59, or -1 if null. */
  public static long MINUTE(Date date) { return date == null ? -1 : cal(date).get(Calendar.MINUTE); }

  /** Second 0-59, or -1 if null. */
  public static long SECOND(Date date) { return date == null ? -1 : cal(date).get(Calendar.SECOND); }

  /** Day of week; returnType 1 (default) Mon=1..Sun=7, returnType 3 Mon=0..Sun=6. */
  public static long WEEKDAY(Date date, long returnType) {
    int js = cal(date).get(Calendar.DAY_OF_WEEK) - 1; // Calendar Sun=1 -> js Sun=0..Sat=6
    if ( returnType == 3 ) return js == 0 ? 6 : js - 1;
    return js == 0 ? 7 : js;
  }
  public static long WEEKDAY(Date date) { return WEEKDAY(date, 1); }

  /** Construct a date from year, 1-based month, day. */
  public static Date DATE(long year, long month, long day) {
    Calendar c = Calendar.getInstance();
    c.clear();
    c.set((int) year, (int) month - 1, (int) day);
    return c.getTime();
  }

  /** Date `months` before/after startDate. */
  public static Date EDATE(Date startDate, long months) {
    Calendar c = cal(startDate);
    c.add(Calendar.MONTH, (int) months);
    return c.getTime();
  }

  /** Last day of the month `months` before/after startDate. */
  public static Date EOMONTH(Date startDate, long months) {
    Calendar c = cal(startDate);
    c.add(Calendar.MONTH, (int) months + 1);
    c.set(Calendar.DAY_OF_MONTH, 1);
    c.add(Calendar.DAY_OF_MONTH, -1);
    return c.getTime();
  }

  /** Difference between dates in unit Y/M/D (Y and M are average-length approximations). */
  public static long DATEDIF(Date startDate, Date endDate, String unit) {
    double days = (endDate.getTime() - startDate.getTime()) / (1000.0 * 60 * 60 * 24);
    switch ( unit == null ? "" : unit.toUpperCase() ) {
      case "Y": return (long) Math.floor(days / 365.25);
      case "M": return (long) Math.floor(days / 30.44);
      case "D": return (long) Math.floor(days);
      default:  return 0;
    }
  }

  // ─────────── Base conversions (category-hidden by default) ───────────

  /** Convert an integer to Roman numerals. */
  public static String ROMAN(long number) {
    int[]    values   = { 1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1 };
    String[] numerals = { "M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I" };
    StringBuilder out = new StringBuilder();
    for ( int i = 0 ; i < values.length ; i++ )
      while ( number >= values[i] ) { out.append(numerals[i]); number -= values[i]; }
    return out.toString();
  }

  /** Convert Roman numerals to an integer. */
  public static long ARABIC(String text) {
    if ( text == null ) return 0;
    text = text.toUpperCase();
    java.util.Map<Character, Integer> v = new java.util.HashMap<>();
    v.put('M', 1000); v.put('D', 500); v.put('C', 100); v.put('L', 50);
    v.put('X', 10);   v.put('V', 5);   v.put('I', 1);
    long r = 0;
    for ( int i = 0 ; i < text.length() ; i++ ) {
      Integer cur = v.get(text.charAt(i));
      Integer nxt = i + 1 < text.length() ? v.get(text.charAt(i + 1)) : null;
      if ( cur == null ) continue;
      r += ( nxt != null && cur < nxt ) ? -cur : cur;
    }
    return r;
  }

  /** Integer to text in a given base, optionally zero-padded to minLength. */
  public static String BASE(long number, long radix, long minLength) {
    return LPAD(Long.toString(number, (int) radix).toUpperCase(), minLength, "0");
  }
  public static String BASE(long number, long radix) { return BASE(number, radix, 0); }

  /** Text in a given base to a decimal integer. */
  public static long DECIMAL(String text, long radix) { return Long.parseLong(text, (int) radix); }

  public static long   BIN2DEC(String b) { return Long.parseLong(b, 2); }
  public static String DEC2BIN(long n)   { return Long.toString(n, 2); }
  public static long   HEX2DEC(String h) { return Long.parseLong(h, 16); }
  public static String DEC2HEX(long n)   { return Long.toString(n, 16).toUpperCase(); }
  public static long   OCT2DEC(String o) { return Long.parseLong(o, 8); }
  public static String DEC2OCT(long n)   { return Long.toString(n, 8); }
}
