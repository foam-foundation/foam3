/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.ascript;

import java.text.DecimalFormat;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AScript standard function library - Java implementation.
 *
 * Scalar functions (value in, value out) providing server-side evaluation
 * of AScript expressions. Mirrors foam.ascript.Lib JavaScript implementation.
 *
 * SCOPE: per-record, scalar-in / scalar-out only. Range/aggregation functions
 * are handled by the query layer.
 */
public class Lib {

  // ─────────────────────────────── Text ───────────────────────────────

  public static int LEN(String text) {
    return text == null ? 0 : text.length();
  }

  public static String UPPER(String text) {
    return text == null ? "" : text.toUpperCase();
  }

  public static String LOWER(String text) {
    return text == null ? "" : text.toLowerCase();
  }

  public static String PROPER(String text) {
    if (text == null || text.isEmpty()) return text;

    Pattern pattern = Pattern.compile("\\b(.)");
    Matcher matcher = pattern.matcher(text.toLowerCase());
    StringBuffer sb = new StringBuffer();

    while (matcher.find()) {
        matcher.appendReplacement(sb, matcher.group(1).toUpperCase());
    }
    matcher.appendTail(sb);

    return sb.toString();
  }

  public static String TRIM(String text) {
    return text == null ? "" : text.replaceAll("\\s+", " ").trim();
  }

  public static String CLEAN(String text) {
    return text == null ? "" : text.replaceAll("[\\x00-\\x1F\\x7F]", "");
  }

  public static String LEFT(String text, Integer numChars) {
    String s = text == null ? "" : text;
    int n = numChars == null ? 1 : numChars;
    return n <= 0 ? "" : s.substring(0, Math.min(n, s.length()));
  }

  public static String RIGHT(String text, Integer numChars) {
    String s = text == null ? "" : text;
    int n = numChars == null ? 1 : numChars;
    return n <= 0 ? "" : s.substring(Math.max(0, s.length() - n));
  }

  public static String MID(String text, Integer start, Integer numChars) {
    String s = text == null ? "" : text;
    int begin = Math.max(0, (start == null ? 1 : start) - 1);
    int len = numChars == null ? 0 : numChars;
    if (begin >= s.length() || len <= 0) return "";
    return s.substring(begin, Math.min(s.length(), begin + len));
  }

  public static String SUBSTR(String text, Integer start, Integer end) {
    String s = text == null ? "" : text;
    int st = start == null ? 0 : start;
    int e = (end == null || end < 0) ? s.length() : end;
    st = Math.max(0, Math.min(st, e));
    return s.substring(st, e);
  }

  public static String SUBSTITUTE(String text, String oldText, String newText, Integer instanceNum) {
    String s = text == null ? "" : text;
    String o = oldText == null ? "" : oldText;
    String n = newText == null ? "" : newText;
    if (o.isEmpty()) return s;

    if (instanceNum == null) {
      return s.replace(o, n);
    }

    String[] parts = s.split(java.util.regex.Pattern.quote(o), -1);
    StringBuilder sb = new StringBuilder(parts[0]);
    for (int i = 1; i < parts.length; i++) {
      sb.append(i == instanceNum ? n : o).append(parts[i]);
    }
    return sb.toString();
  }

  public static String REPLACE(String oldText, Integer startNum, Integer numChars, String newText) {
    String s = oldText == null ? "" : oldText;
    int start = (startNum == null ? 1 : startNum) - 1;
    int len = numChars == null ? 0 : numChars;
    String n = newText == null ? "" : newText;
    return s.substring(0, start) + n + s.substring(start + len);
  }

  public static String REPT(String text, Integer times) {
    if (times == null || times <= 0) return "";
    String s = text == null ? "" : text;
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < times; i++) sb.append(s);
    return sb.toString();
  }

  public static int FIND(String findText, String withinText, Integer startNum) {
    String w = withinText == null ? "" : withinText;
    String f = findText == null ? "" : findText;
    int start = (startNum == null ? 1 : startNum) - 1;
    int index = w.indexOf(f, start);
    return index == -1 ? -1 : index + 1;
  }

  public static int SEARCH(String findText, String withinText, Integer startNum) {
    String w = (withinText == null ? "" : withinText).toLowerCase();
    String f = (findText == null ? "" : findText).toLowerCase();
    int start = (startNum == null ? 1 : startNum) - 1;
    int index = w.indexOf(f, start);
    return index == -1 ? -1 : index + 1;
  }

  public static boolean EXACT(String text1, String text2) {
    return text1.equals(text2);
  }

  public static String REVERSE(String text) {
    return text == null ? "" : new StringBuilder(text).reverse().toString();
  }

  public static String CHAR(int number) {
    return String.valueOf((char) number);
  }

  public static int CODE(String text) {
    return text == null || text.isEmpty() ? 0 : text.charAt(0);
  }

  public static double VALUE(String text) {
    try {
      return Double.parseDouble(text);
    } catch (NumberFormatException | NullPointerException e) {
      return 0;
    }
  }

  public static String LPAD(String str, int len, String ch) {
    String s = str == null ? "" : str;
    String pad = ch == null || ch.isEmpty() ? "0" : ch;
    if (s.length() >= len) return s;
    StringBuilder sb = new StringBuilder();
    while (sb.length() < len - s.length()) sb.append(pad);
    sb.setLength(len - s.length());
    sb.append(s);
    return sb.toString();
  }

  public static String RPAD(String str, int len, String ch) {
    String s = str == null ? "" : str;
    String pad = ch == null || ch.isEmpty() ? "0" : ch;
    if (s.length() >= len) return s;
    StringBuilder sb = new StringBuilder(s);
    while (sb.length() < len) sb.append(pad);
    sb.setLength(len);
    return sb.toString();
  }

  public static String LMASK(String str, int len, String ch) {
    String s = str == null ? "" : str;
    String pad = ch == null || ch.isEmpty() ? "*" : ch;
    return LPAD(s.substring(Math.min(len, s.length())), s.length(), pad);
  }

  public static String RMASK(String str, int len, String ch) {
    String s = str == null ? "" : str;
    String pad = ch == null || ch.isEmpty() ? "*" : ch;
    return RPAD(s.substring(0, Math.max(0, s.length() - len)), s.length(), pad);
  }

  // ─────────────────────────────── Math ───────────────────────────────

  public static double DIFF(double a, double b) {
    return Math.abs(a - b);
  }

  public static double ROUND(double num, Integer digits) {
    int d = digits == null ? 0 : digits;
    double f = Math.pow(10, d);
    return Math.round(num * f) / f;
  }

  public static double ROUNDUP(double num, Integer digits) {
    int d = digits == null ? 0 : digits;
    double f = Math.pow(10, d);
    return (num < 0 ? -1 : 1) * Math.ceil(Math.abs(num) * f) / f;
  }

  public static double ROUNDDOWN(double num, Integer digits) {
    int d = digits == null ? 0 : digits;
    double f = Math.pow(10, d);
    return (num < 0 ? -1 : 1) * Math.floor(Math.abs(num) * f) / f;
  }

  public static double MROUND(double num, double multiple) {
    return Math.round(num / multiple) * multiple;
  }

  public static double INT(double num) {
    return Math.floor(num);
  }

  /*
  public static double TRUNC(double num, Integer digits) {
    int d = digits == null ? 0 : digits;
    double f = Math.pow(10, d);
    return (long)(num * f) / f;
    }*/

  public static double CEILING(double num, Double significance) {
    double s = significance == null ? 1 : significance;
    return Math.ceil(num / s) * s;
  }

  public static double FLOOR(double num, Double significance) {
    double s = significance == null ? 1 : significance;
    return Math.floor(num / s) * s;
  }

  public static double QUOTIENT(double numerator, double denominator) {
    return (long)(numerator / denominator);
  }

  public static double SQRT(double num) {
    return Math.sqrt(num);
  }

  public static double EVEN(double num) {
    long r = Math.round(Math.abs(num));
    return ((r % 2 == 0 ? r : r + 1) * (num < 0 ? -1 : 1));
  }

  public static double ODD(double num) {
    long r = Math.round(Math.abs(num));
    return ((r % 2 == 1 ? r : r + 1) * (num < 0 ? -1 : 1));
  }

  public static String FIX(double num, Integer precision) {
    int p = precision == null ? 0 : precision;
    DecimalFormat df = new DecimalFormat();
    df.setMaximumFractionDigits(p);
    df.setMinimumFractionDigits(p);
    return df.format(num);
  }

  public static String CURRENCY(double amt, Integer precision) {
    int p = (precision == null) ? 2 : precision;
    DecimalFormat df = new DecimalFormat();
    df.setMaximumFractionDigits(p);
    df.setMinimumFractionDigits(p);
    df.setGroupingUsed(true);
    return df.format(amt);
  }

  // ───────────────── Advanced math (category-hidden by default) ─────────────────

  public static double LOG(double num, Double base) {
    double b = base == null ? 10 : base;
    return Math.log(num) / Math.log(b);
  }

  public static long FACT(int num) {
    long result = 1;
    for (int i = 2; i <= num; i++) result *= i;
    return result;
  }

  public static double COMBIN(int n, int k) {
    return FACT(n) / (double)(FACT(k) * FACT(n - k));
  }

  public static double PERMUT(int n, int k) {
    return FACT(n) / (double)FACT(n - k);
  }

  public static long GCD(long a, long b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b != 0) {
      long temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  public static long LCM(long a, long b) {
    return Math.abs(a * b) / GCD(a, b);
  }

  public static double DEGREES(double radians) {
    return radians * 180 / Math.PI;
  }

  public static double RADIANS(double degrees) {
    return degrees * Math.PI / 180;
  }

  // ─────────────────────────── Logical / type ───────────────────────────

  public static boolean ISBLANK(Object value) {
    return value == null || (value instanceof String && ((String)value).isEmpty());
  }

  public static boolean ISNUMBER(Object value) {
    return value instanceof Number && !(Double.isNaN(((Number)value).doubleValue()));
  }

  public static boolean ISTEXT(Object value) {
    return value instanceof String;
  }

  public static boolean ISLOGICAL(Object value) {
    return value instanceof Boolean;
  }

  public static boolean ISEVEN(long num) {
    return num % 2 == 0;
  }

  public static boolean ISODD(long num) {
    return Math.abs(num % 2) == 1;
  }

  public static double N(Object value) {
    if (value instanceof Number) return ((Number)value).doubleValue();
    if (value instanceof Boolean) return (Boolean)value ? 1 : 0;
    if (value instanceof Date) return ((Date)value).getTime();
    return 0;
  }

  // ─────────────────────────────── Date ───────────────────────────────

  public static int YEAR(Date date) {
    if (date == null) return -1;
    Calendar cal = Calendar.getInstance();
    cal.setTime(date);
    return cal.get(Calendar.YEAR);
  }

  public static int MONTH(Date date) {
    if (date == null) return -1;
    Calendar cal = Calendar.getInstance();
    cal.setTime(date);
    return cal.get(Calendar.MONTH) + 1;
  }

  public static int DAY(Date date) {
    if (date == null) return -1;
    Calendar cal = Calendar.getInstance();
    cal.setTime(date);
    return cal.get(Calendar.DAY_OF_MONTH);
  }

  public static int HOUR(Date date) {
    if (date == null) return -1;
    Calendar cal = Calendar.getInstance();
    cal.setTime(date);
    return cal.get(Calendar.HOUR_OF_DAY);
  }

  public static int MINUTE(Date date) {
    if (date == null) return -1;
    Calendar cal = Calendar.getInstance();
    cal.setTime(date);
    return cal.get(Calendar.MINUTE);
  }

  public static int SECOND(Date date) {
    if (date == null) return -1;
    Calendar cal = Calendar.getInstance();
    cal.setTime(date);
    return cal.get(Calendar.SECOND);
  }

  public static int WEEKDAY(Date date, Integer returnType) {
    Calendar cal = Calendar.getInstance();
    cal.setTime(date);
    int day = cal.get(Calendar.DAY_OF_WEEK) - 1; // 0=Sun
    if (returnType != null && returnType == 3) {
      return day == 0 ? 6 : day - 1; // Mon=0..Sun=6
    }
    return day == 0 ? 7 : day; // Mon=1..Sun=7
  }

  public static Date DATE(int year, int month, int day) {
    Calendar cal = Calendar.getInstance();
    cal.set(year, month - 1, day);
    return cal.getTime();
  }

  public static Date EDATE(Date startDate, int months) {
    Calendar cal = Calendar.getInstance();
    cal.setTime(startDate);
    cal.add(Calendar.MONTH, months);
    return cal.getTime();
  }

  public static Date EOMONTH(Date startDate, int months) {
    Calendar cal = Calendar.getInstance();
    cal.setTime(startDate);
    cal.add(Calendar.MONTH, months + 1);
    cal.set(Calendar.DAY_OF_MONTH, 0);
    return cal.getTime();
  }

  public static int DATEDIF(Date startDate, Date endDate, String unit) {
    long diffMs = endDate.getTime() - startDate.getTime();
    if (unit == null) return 0;
    switch (unit.toUpperCase()) {
      case "Y": return (int)(diffMs / (1000L * 60 * 60 * 24 * 365));
      case "M": return (int)(diffMs / (1000L * 60 * 60 * 24 * 30));
      case "D": return (int)(diffMs / (1000L * 60 * 60 * 24));
      default: return 0;
    }
  }

  // ─────────── Base conversions (category-hidden by default) ───────────

  public static String ROMAN(int number) {
    int[] values = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};
    String[] numerals = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < values.length; i++) {
      while (number >= values[i]) {
        out.append(numerals[i]);
        number -= values[i];
      }
    }
    return out.toString();
  }

  public static int ARABIC(String text) {
    Map<Character, Integer> v = new HashMap<>();
    v.put('M', 1000); v.put('D', 500); v.put('C', 100); v.put('L', 50);
    v.put('X', 10); v.put('V', 5); v.put('I', 1);

    int result = 0;
    text = text.toUpperCase();
    for (int i = 0; i < text.length(); i++) {
      Integer cur = v.get(text.charAt(i));
      Integer nxt = i + 1 < text.length() ? v.get(text.charAt(i + 1)) : null;
      if (cur != null) {
        result += (nxt != null && cur < nxt) ? -cur : cur;
      }
    }
    return result;
  }

  public static String BASE(long number, int radix, Integer minLength) {
    String s = Long.toString(number, radix).toUpperCase();
    int min = minLength == null ? 0 : minLength;
    while (s.length() < min) s = "0" + s;
    return s;
  }

  public static long DECIMAL(String text, int radix) {
    return Long.parseLong(text, radix);
  }

  public static long BIN2DEC(String binary) {
    return Long.parseLong(binary, 2);
  }

  public static String DEC2BIN(long decimal) {
    return Long.toBinaryString(decimal);
  }

  public static long HEX2DEC(String hex) {
    return Long.parseLong(hex, 16);
  }

  public static String DEC2HEX(long decimal) {
    return Long.toHexString(decimal).toUpperCase();
  }

  public static long OCT2DEC(String octal) {
    return Long.parseLong(octal, 8);
  }

  public static String DEC2OCT(long decimal) {
    return Long.toOctalString(decimal);
  }
}
