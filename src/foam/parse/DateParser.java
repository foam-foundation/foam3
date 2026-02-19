/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.parse;

import foam.lib.parse.*;
import foam.lib.parse.Optional;
import foam.util.LRULinkedHashMap;
import java.util.*;

/**
 * Comprehensive date and datetime parser that handles all formats from DateUtil.js.
 * Uses FOAM parser framework with Grammar to support all date/datetime formats in a single parser.
 * Supports both date-only and datetime formats.
 *
 * This Java implementation mirrors the JavaScript DateParser.js grammar structure
 * to ensure identical parsing behavior across JavaScript and Java codebases.
 *
 * Supported formats:
 * - YYYYMMDD (separated and compact with optional time)
 * - MMDDYYYY (separated and compact)
 * - YYMMDD (separated and compact, with 2-digit year pivot at 50)
 * - DDMMYYYY (via opt_name only, separated and compact)
 * - YYYYDDMM (via opt_name only, separated and compact)
 * - DDMMMYYYY, YYYYDDMMM (month names: JAN, FEB, etc.)
 * - Timezone support: Z, +HH:MM, +HHMM, +HH
 *
 * Usage:
 *   DateParser parser = new DateParser();
 *   Date date = parser.parseString("2025-01-15");
 *   Date datetime = parser.parseString("2025-01-15T14:30:45");
 */
public class DateParser {

  public enum DateParseMode { DATE, STRING, DATETIME, DATETIME_UTC }

  private Grammar grammar_;

  /**
   * If true, throws errors for invalid dates. If false, logs warnings and returns MAX_DATE.
   * Static because DateParser is used as a singleton pattern - each call creates a new instance
   * but the strictValidation setting should be shared across all instances (like JavaScript Singleton).
   */
  private static boolean strictValidation_ = false;

  public boolean getStrictValidation() { return strictValidation_; }
  public void setStrictValidation(boolean v) { strictValidation_ = v; }

  /**
   * Maximum cache size per method to prevent unbounded growth.
   */
  private static final int MAX_CACHE_SIZE = 10000;

  /**
   * Separate LRU caches for each parse method (thread-safe).
   * Using separate caches avoids string concatenation overhead for cache keys.
   * Each cache is keyed by the input string directly (or opt_name:str when opt_name is provided).
   * Caches store Long timestamps (from Date.getTime()) instead of Date objects to save memory.
   */
  private static final LRULinkedHashMap<String, Long> stringCache_ =
    new LRULinkedHashMap<>("DateParser.STRING", MAX_CACHE_SIZE / 10);
  private static final LRULinkedHashMap<String, Long> dateCache_ =
    new LRULinkedHashMap<>("DateParser.DATE", MAX_CACHE_SIZE / 10);
  private static final LRULinkedHashMap<String, Long> dateTimeCache_ =
    new LRULinkedHashMap<>("DateParser.DATETIME", MAX_CACHE_SIZE);
  private static final LRULinkedHashMap<String, Long> dateTimeUtcCache_ =
    new LRULinkedHashMap<>("DateParser.DATETIME_UTC", MAX_CACHE_SIZE);

  /**
   * Maximum date value for invalid dates
   */
  public static final Date MAX_DATE = new Date(Long.MAX_VALUE);

  /**
   * Invalid date marker
   */
  public static final Date INVALID_DATE = new Date(Long.MIN_VALUE);

  /**
   * Constructor - initializes the grammar
   */
  public DateParser() {
    grammar_ = getGrammar();
  }

  // ========== Cache Helper Methods ==========

  /**
   * Build cache key: use str directly when opt_name is null (common case),
   * otherwise concatenate opt_name:str (rare case).
   */
  private String buildCacheKey(String str, String opt_name) {
    if ( opt_name == null || opt_name.isEmpty() ) {
      return str;
    }
    return opt_name + ":" + str;
  }

  /**
   * Get from cache and create a new Date from the cached timestamp.
   * Returns null if not in cache.
   */
  private Date cacheGet(LRULinkedHashMap<String, Long> cache, String key) {
    Long cached = cache.get(key);
    if ( cached != null ) {
      return new Date(cached);
    }
    return null;
  }

  /**
   * Store timestamp in cache and return the original Date.
   */
  private Date cacheSet(LRULinkedHashMap<String, Long> cache, String key, Date value) {
    cache.put(key, value.getTime());
    return value;
  }

  /**
   * Convenience method: parse with grammar and return String value
   */
  private Object parseStringWithGrammar(String str, String opt_name) {
    if ( str == null || str.trim().isEmpty() ) {
      return null;
    }

    try {
      ParserContext x = new ParserContextImpl();
      StringPStream ps = new StringPStream(str);

      Parser startSymbol = grammar_.sym(opt_name != null && !opt_name.isEmpty() ? opt_name : "START");
      PStream parseResult = ps.apply(startSymbol, x);

      if ( parseResult == null ) {
        return null;
      }

      return parseResult.value();
    } catch (Exception e) {
      return null;
    }
  }

  /**
   * Parse a date/datetime string and return a Date object.
   * Auto-detects format and handles time if present.
   * Throws RuntimeException for invalid formats if strictValidation is true,
   * otherwise returns MAX_DATE with warning.
   *
   * @param str The date string to parse
   * @param opt_name Optional grammar symbol name to use (e.g., "ddmmyyyy", "yyyyddmm")
   * @return Parsed Date object
   * @throws RuntimeException if format is unsupported and strictValidation is true
   */
  public Date parseString(String str, String opt_name) {
    if ( str == null || str.trim().isEmpty() ) {
      if ( strictValidation_ ) {
        throw new RuntimeException("Unsupported Date format: empty or null string");
      }
      System.err.println("Warning: Invalid date: empty or null string; assuming MAX_DATE.");
      return MAX_DATE;
    }

    str = str.trim();

    // Check cache first - use str directly as key when opt_name is null (common case)
    String cacheKey = buildCacheKey(str, opt_name);
    Date cached = cacheGet(stringCache_, cacheKey);
    if ( cached != null ) return cached;

    StringPStream sps = new StringPStream(str);
    ParserContext x = new ParserContextImpl();
    x.set("dateParseMode", DateParseMode.STRING);

    PStream parseResult = grammar_.parse(sps, x, opt_name);
    if ( parseResult == null || parseResult.value() == null ) {
      if ( strictValidation_ ) {
        throw new RuntimeException("Unsupported Date format: " + str);
      }
      System.err.println("Warning: Invalid date: \"" + str + "\"; assuming MAX_DATE.");
      return MAX_DATE;
    }

    return cacheSet(stringCache_, cacheKey, (Date) parseResult.value());
  }

  /**
   * Convenience method: parseString with default grammar START symbol
   */
  public Date parseString(String str) {
    return parseString(str, null);
  }

  /**
   * Parse a date string - ignores any time component and returns date at noon GMT.
   * Throws RuntimeException for invalid formats if strictValidation is true,
   * otherwise returns MAX_DATE with warning.
   *
   * @param str The date string to parse
   * @param opt_name Optional grammar symbol name
   * @return Parsed Date object at noon GMT, or MAX_DATE if invalid and strictValidation is false
   */
  public Date parseDateString(String str, String opt_name) {
    if ( str == null || str.trim().isEmpty() ) {
      if ( strictValidation_ ) {
        throw new RuntimeException("Unsupported Date format: empty or null string");
      }
      System.err.println("Warning: Invalid date: empty or null string; assuming MAX_DATE.");
      return MAX_DATE;
    }

    str = str.trim();

    // Check cache first - use str directly as key when opt_name is null (common case)
    String cacheKey = buildCacheKey(str, opt_name);
    Date cached = cacheGet(dateCache_, cacheKey);
    if ( cached != null ) return cached;

    StringPStream sps = new StringPStream(str);
    ParserContext x = new ParserContextImpl();
    x.set("dateParseMode", DateParseMode.DATE);

    PStream parseResult = grammar_.parse(sps, x, opt_name);
    if ( parseResult == null || parseResult.value() == null ) {
      if ( strictValidation_ ) {
        throw new RuntimeException("Unsupported Date format: " + str);
      }
      System.err.println("Warning: Invalid date: \"" + str + "\"; assuming MAX_DATE.");
      return MAX_DATE;
    }

    return cacheSet(dateCache_, cacheKey, (Date) parseResult.value());
  }

  /**
   * Convenience method: parseDateString with default grammar
   */
  public Date parseDateString(String str) {
    return parseDateString(str, null);
  }

  /**
   * Parse a datetime string using local time.
   * Uses time if present, otherwise sets to noon.
   * If timezone is present, converts to UTC.
   * Throws RuntimeException for invalid formats if strictValidation is true,
   * otherwise returns MAX_DATE with warning.
   *
   * @param str The datetime string to parse
   * @param opt_name Optional grammar symbol name
   * @return Parsed Date object in local time, or MAX_DATE if invalid and strictValidation is false
   */
  public Date parseDateTime(String str, String opt_name) {
    if ( str == null || str.trim().isEmpty() ) {
      if ( strictValidation_ ) {
        throw new RuntimeException("Unsupported DateTime format: empty or null string");
      }
      System.err.println("Warning: Invalid datetime: empty or null string; assuming MAX_DATE.");
      return MAX_DATE;
    }

    str = str.trim();

    // Check cache first - use str directly as key when opt_name is null (common case)
    String cacheKey = buildCacheKey(str, opt_name);
    Date cached = cacheGet(dateTimeCache_, cacheKey);
    if ( cached != null ) return cached;

    StringPStream sps = new StringPStream(str);
    ParserContext x = new ParserContextImpl();
    x.set("dateParseMode", DateParseMode.DATETIME);

    PStream parseResult = grammar_.parse(sps, x, opt_name);
    if ( parseResult == null || parseResult.value() == null ) {
      if ( strictValidation_ ) {
        throw new RuntimeException("Unsupported DateTime format: " + str);
      }
      System.err.println("Warning: Invalid datetime: \"" + str + "\"; assuming MAX_DATE.");
      return MAX_DATE;
    }

    return cacheSet(dateTimeCache_, cacheKey, (Date) parseResult.value());
  }

  /**
   * Convenience method: parseDateTime with default grammar
   */
  public Date parseDateTime(String str) {
    return parseDateTime(str, null);
  }

  /**
   * Parse a datetime string using UTC time.
   * Uses time if present, otherwise sets to midnight.
   * If timezone is present, converts to UTC.
   * Throws RuntimeException for invalid formats if strictValidation is true,
   * otherwise returns MAX_DATE with warning.
   *
   * @param str The datetime string to parse
   * @param opt_name Optional grammar symbol name
   * @return Parsed Date object in UTC, or MAX_DATE if invalid and strictValidation is false
   */
  public Date parseDateTimeUTC(String str, String opt_name) {
    if ( str == null || str.trim().isEmpty() ) {
      if ( strictValidation_ ) {
        throw new RuntimeException("Unsupported DateTime format: empty or null string");
      }
      System.err.println("Warning: Invalid datetime: empty or null string; assuming MAX_DATE.");
      return MAX_DATE;
    }

    str = str.trim();

    // Check cache first - use str directly as key when opt_name is null (common case)
    String cacheKey = buildCacheKey(str, opt_name);
    Date cached = cacheGet(dateTimeUtcCache_, cacheKey);
    if ( cached != null ) return cached;

    StringPStream sps = new StringPStream(str);
    ParserContext x = new ParserContextImpl();
    x.set("dateParseMode", DateParseMode.DATETIME_UTC);

    PStream parseResult = grammar_.parse(sps, x, opt_name);
    if ( parseResult == null || parseResult.value() == null ) {
      if ( strictValidation_ ) {
        throw new RuntimeException("Unsupported DateTime format: " + str);
      }
      System.err.println("Warning: Invalid datetime: \"" + str + "\"; assuming MAX_DATE.");
      return MAX_DATE;
    }

    return cacheSet(dateTimeUtcCache_, cacheKey, (Date) parseResult.value());
  }

  /**
   * Convenience method: parseDateTimeUTC with default grammar
   */
  public Date parseDateTimeUTC(String str) {
    return parseDateTimeUTC(str, null);
  }

  // ========== Helper Methods ==========

  /**
   * Flatten timezone array from parser into a string
   */
  private String flattenTimezone(Object tzArray) {
    if ( tzArray == null ) return null;
    if ( tzArray instanceof String ) return (String) tzArray;

    // Handle array structure from parser
    if ( tzArray instanceof Object[] ) {
      StringBuilder result = new StringBuilder();
      Object[] arr = (Object[]) tzArray;
      for ( Object item : arr ) {
        if ( item instanceof Object[] ) {
          for ( Object subItem : (Object[]) item ) {
            result.append(subItem);
          }
        } else if ( item != null ) {
          result.append(item);
        }
      }
      return result.toString();
    }

    return String.valueOf(tzArray);
  }

  /**
   * Normalize Unix timezone format to standard format.
   * GMT/UTC -> "Z", numeric offsets are flattened to string.
   */
  private String normalizeUnixTimezone(Object tz) {
    if ( tz == null ) return null;

    // Handle string values (GMT, UTC)
    if ( tz instanceof String ) {
      String tzUpper = ((String) tz).toUpperCase();
      if ( tzUpper.equals("GMT") || tzUpper.equals("UTC") ) {
        return "Z";
      }
      return (String) tz;
    }

    // Handle array values from Seq parser - offset format like ['+', ['0', '5', '3', '0']]
    if ( tz instanceof Object[] ) {
      return flattenTimezone(tz);
    }

    return null;
  }

  /**
   * Normalize JS timezone: Seq result [GMT_literal, optional_offset] to standard format.
   * ['GMT', null] → 'Z', ['GMT', ['+', ['0','4','0','0']]] → '+0400'
   */
  private String normalizeJsTimezone(Object tz) {
    if ( tz == null ) return "Z";
    if ( ! (tz instanceof Object[]) ) return "Z";
    Object[] arr = (Object[]) tz;
    // arr = [GMT_literal, optional_offset]
    if ( arr.length < 2 || arr[1] == null ) return "Z";
    return flattenTimezone(arr[1]);
  }

  /**
   * Parse timezone string and return offset in minutes.
   * Z means UTC (0). +05:30 means +330 minutes.
   */
  private int parseTimezone(String tz) {
    if ( tz == null || tz.equals("Z") ) return 0;

    int sign = tz.charAt(0) == '+' ? 1 : -1;
    String nums = tz.substring(1).replace(":", "");

    int hours, minutes;
    if ( nums.length() >= 4 ) {
      // HHMM format
      hours = Integer.parseInt(nums.substring(0, 2));
      minutes = Integer.parseInt(nums.substring(2, 4));
    } else if ( nums.length() == 2 ) {
      // HH format (no minutes)
      hours = Integer.parseInt(nums);
      minutes = 0;
    } else {
      return 0;
    }

    return sign * (hours * 60 + minutes);
  }

  /**
   * Converts 2-digit year using fixed pivot at 50:
   * - Years 00-49 map to 2000-2049
   * - Years 50-99 map to 1950-1999
   */
  private int convertTwoDigitYear(int twoDigitYear) {
    // Fixed pivot at 50
    if ( twoDigitYear < 50 ) {
      return 2000 + twoDigitYear;
    }
    return 1900 + twoDigitYear;
  }

  /**
   * Converts 3-letter month abbreviation to 0-based month index (JAN→0, FEB→1, etc.)
   */
  private int parseMonthName(String monthName) {
    String month = monthName.toUpperCase();
    switch (month) {
      case "JAN": return 0;
      case "FEB": return 1;
      case "MAR": return 2;
      case "APR": return 3;
      case "MAY": return 4;
      case "JUN": return 5;
      case "JUL": return 6;
      case "AUG": return 7;
      case "SEP": return 8;
      case "OCT": return 9;
      case "NOV": return 10;
      case "DEC": return 11;
      default:
        if ( strictValidation_ ) {
          throw new RuntimeException("Invalid month name: \"" + monthName + "\"");
        }
        System.err.println("Warning: Invalid month name: \"" + monthName + "\"; assuming January.");
        return 0;
    }
  }

  /**
   * Build a Date object from parsed components based on mode
   */
  private Date buildDate(DateParseMode mode, int year, int month, int day,
                         int hour, int minute, int second, int ms, String tz) {
    Calendar cal;
    switch (mode) {
      case DATE:
        // Always noon GMT - for parseDateString
        cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.clear();
        cal.set(year, month, day, 12, 0, 0);
        return cal.getTime();
      case STRING:
        // For parseString: date-only → noon GMT, with time → local time
        if ( hour < 0 && minute < 0 && second < 0 ) {
          // No time components - return noon GMT
          cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.clear();
          cal.set(year, month, day, 12, 0, 0);
          return cal.getTime();
        }
        // Has time - return local time
        if ( tz != null ) {
          int offset = parseTimezone(tz);
          cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.clear();
          cal.set(year, month, day, hour >= 0 ? hour : 0,
                  minute >= 0 ? minute : 0, second >= 0 ? second : 0);
          if ( ms >= 0 ) cal.set(Calendar.MILLISECOND, ms);
          cal.add(Calendar.MINUTE, -offset);
          return cal.getTime();
        }
        cal = Calendar.getInstance();
        cal.clear();
        cal.set(year, month, day, hour >= 0 ? hour : 0,
                minute >= 0 ? minute : 0, second >= 0 ? second : 0);
        if ( ms >= 0 ) cal.set(Calendar.MILLISECOND, ms);
        return cal.getTime();
      case DATETIME:
        // Always local time with default hour 12 - for parseDateTime
        if ( tz != null ) {
          int offset = parseTimezone(tz);
          cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
          cal.clear();
          cal.set(year, month, day, hour >= 0 ? hour : 12,
                  minute >= 0 ? minute : 0, second >= 0 ? second : 0);
          if ( ms >= 0 ) cal.set(Calendar.MILLISECOND, ms);
          cal.add(Calendar.MINUTE, -offset);
          return cal.getTime();
        }
        cal = Calendar.getInstance();
        cal.clear();
        cal.set(year, month, day, hour >= 0 ? hour : 12,
                minute >= 0 ? minute : 0, second >= 0 ? second : 0);
        if ( ms >= 0 ) cal.set(Calendar.MILLISECOND, ms);
        return cal.getTime();
      case DATETIME_UTC:
        // Always UTC - for parseDateTimeUTC
        cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
        cal.clear();
        cal.set(year, month, day, hour >= 0 ? hour : 0,
                minute >= 0 ? minute : 0, second >= 0 ? second : 0);
        if ( ms >= 0 ) cal.set(Calendar.MILLISECOND, ms);
        if ( tz != null ) cal.add(Calendar.MINUTE, -parseTimezone(tz));
        return cal.getTime();
      default:
        return null;
    }
  }

  /**
   * Parse integer from array or return default value
   */
  private int parseIntOrDefault(Object[] v, int idx, int defaultVal) {
    if ( v.length <= idx || v[idx] == null ) return defaultVal;
    return Integer.parseInt((String) v[idx]);
  }

  /**
   * Parse fractional seconds string (1-6 digits) and convert to milliseconds (0-999).
   * Pads short strings with trailing zeros (e.g., "1" -> 100, "12" -> 120).
   * Truncates long strings to 3 digits (e.g., "123456" -> 123).
   */
  private int parseFractionalSeconds(String fracStr) {
    if ( fracStr == null || fracStr.isEmpty() ) return -1;

    // Pad to 3 digits if shorter
    if ( fracStr.length() < 3 ) {
      while ( fracStr.length() < 3 ) {
        fracStr = fracStr + "0";
      }
    }

    // Truncate to 3 digits if longer
    if ( fracStr.length() > 3 ) {
      fracStr = fracStr.substring(0, 3);
    }

    return Integer.parseInt(fracStr);
  }

  /**
   * Extract fractional seconds from parsed value array if present
   */
  private int extractFractionalSeconds(Object[] v, int fracIdx) {
    if ( v.length <= fracIdx || v[fracIdx] == null ) return -1;
    return parseFractionalSeconds((String) v[fracIdx]);
  }

  /**
   * Extract timezone from parsed value array
   */
  private String extractTimezone(Object[] v) {
    if ( v.length == 0 ) return null;
    Object last = v[v.length - 1];
    if ( last == null ) return null;
    if ( "Z".equals(last) ) return "Z";
    if ( !(last instanceof String) ) return flattenTimezone(last);
    return null;
  }


  // ========== Grammar Definition ==========

  /**
   * Creates and returns the complete grammar for date parsing.
   * This mirrors the JavaScript DateParser.js grammar structure exactly.
   */
  private Grammar getGrammar() {
    Grammar grammar = new Grammar();

    // START symbol - entry point
    grammar.addSymbol("START", grammar.sym("dateOrDatetime"));

    // Main entry point - tries all formats including month names
    // NOTE: Month name formats go FIRST because they contain letters (unambiguous!)
    // Timestamps (10-13 digits) go LAST to avoid matching date formats like YYYYMMDDHH
    // NOTE: YYMMDD is NOT in the main entry point because it's ambiguous with MMDDYY
    //       (e.g., "25/01/15" could be YY-MM-DD or MM-DD-YY). Use opt_name='yymmdd' to parse explicitly.
    grammar.addSymbol("dateOrDatetime", new Alt(
      grammar.sym("date-monthname"),  // Month name formats first (unambiguous)
      grammar.sym("yyyymmdd"),
      grammar.sym("mmddyyyy"),
      grammar.sym("mmddyy"),          // 2-digit year US format (MM-DD-YY)
      grammar.sym("timestamp")        // Unix/JS timestamps (10-13 digits, must not match date formats)
    ));

    // Unix timestamp (10 digits, seconds) or JavaScript timestamp (13 digits, milliseconds)
    grammar.addSymbol("timestamp", new Alt(
      grammar.sym("timestamp13"),  // 13-digit JavaScript millisecond timestamp (always safe)
      grammar.sym("timestamp10")   // 10-digit Unix second timestamp (checked after date formats fail)
    ));
    grammar.addSymbol("timestamp13", new Join(new Repeat(Range.create('0', '9'), null, 13, 13)));
    grammar.addSymbol("timestamp10", new Join(new Repeat(Range.create('0', '9'), null, 10, 10)));

    // Date with month names - ALL completely unambiguous (contain letters!)
    grammar.addSymbol("date-monthname", new Alt(
      grammar.sym("js-date-tostring"),   // JS Date.toString(): "Thu Feb 19 2026 16:20:23 GMT-0400 (Atlantic Standard Time)"
      grammar.sym("unix-date-tostring"), // Unix/Java Date.toString(): "Tue Apr 01 05:17:59 GMT 2025"
      grammar.sym("mmmddyyyy-space"),    // MMM dd yyyy (e.g., Jan 02 2025)
      grammar.sym("ddmmmyyyy-space"),    // DD MMM YYYY (e.g., 15 JAN 2025)
      grammar.sym("ddmmmyyyy-sep"),
      grammar.sym("yyyyddmmm-sep"),
      grammar.sym("yyyyddmmm-compact"),
      grammar.sym("ddmmmyyyy-compact")
    ));

    // ========== Component Parsers ==========

    // year4: Exactly 4 digits
    grammar.addSymbol("year4", new Join(new Repeat(Range.create('0', '9'), null, 4, 4)));

    // year4_1900_2999: Years 1900-2999 only
    grammar.addSymbol("year4_1900_2999", new Join(new Alt(
      new Seq(Literal.create("1"), Literal.create("9"), Range.create('0', '9'), Range.create('0', '9')),
      new Seq(Literal.create("2"), Range.create('0', '9'), Range.create('0', '9'), Range.create('0', '9'))
    )));

    // year2: 2 digits
    grammar.addSymbol("year2", new Join(new Seq(Range.create('0', '9'), Range.create('0', '9'))));

    // month2: 01-12 (strict 2 digits for compact formats)
    grammar.addSymbol("month2", new Join(new Alt(
      new Seq(Literal.create("0"), Range.create('1', '9')),  // 01-09
      new Seq(Literal.create("1"), Range.create('0', '2'))   // 10-12
    )));

    // monthFlexible: 1 or 2 digits (for formats with separators)
    // Allows slightly out-of-range values for JavaScript Date normalization
    grammar.addSymbol("monthFlexible", new Alt(
      new Join(new Seq(Literal.create("1"), Range.create('0', '9'))),  // 10-19
      new Join(new Seq(Literal.create("0"), Range.create('0', '9'))),  // 00-09
      new Join(Range.create('0', '9'))                                  // 0-9 (single digit)
    ));

    // day2: 01-31 (strict 2 digits for compact formats)
    grammar.addSymbol("day2", new Join(new Alt(
      new Seq(Literal.create("0"), Range.create('1', '9')),              // 01-09
      new Seq(Range.create('1', '2'), Range.create('0', '9')),           // 10-29
      new Seq(Literal.create("3"), Range.create('0', '1'))               // 30-31
    )));

    // dayFlexible: 1 or 2 digits (for formats with separators)
    // Day: 0-39 range to allow normalization (e.g., Feb 30 → Mar 2)
    grammar.addSymbol("dayFlexible", new Alt(
      new Join(new Seq(Literal.create("3"), Range.create('0', '9'))),           // 30-39
      new Join(new Seq(Range.create('0', '2'), Range.create('0', '9'))),        // 00-29
      new Join(Range.create('0', '9'))                                          // 0-9 (single digit)
    ));

    // hour2: 00-23 (accept any 2 digits, validation in action)
    grammar.addSymbol("hour2", new Join(new Seq(Range.create('0', '2'), Range.create('0', '9'))));

    // minute2: 00-59
    grammar.addSymbol("minute2", new Join(new Seq(Range.create('0', '5'), Range.create('0', '9'))));

    // second2: 00-59
    grammar.addSymbol("second2", new Join(new Seq(Range.create('0', '5'), Range.create('0', '9'))));

    // fractionalSeconds: 1-6 digits for milliseconds or microseconds
    grammar.addSymbol("fractionalSeconds", new Join(new Repeat(Range.create('0', '9'), null, 1, 6)));

    // millisecond3: 3 digits (kept for backward compatibility)
    grammar.addSymbol("millisecond3", new Join(new Repeat(Range.create('0', '9'), null, 3, 3)));

    // month3alpha: JAN, FEB, MAR, etc. (case insensitive)
    grammar.addSymbol("month3alpha", new Alt(
      new LiteralIC("JAN"), new LiteralIC("FEB"), new LiteralIC("MAR"),
      new LiteralIC("APR"), new LiteralIC("MAY"), new LiteralIC("JUN"),
      new LiteralIC("JUL"), new LiteralIC("AUG"), new LiteralIC("SEP"),
      new LiteralIC("OCT"), new LiteralIC("NOV"), new LiteralIC("DEC")
    ));

    // day3alpha: Mon, Tue, Wed, Thu, Fri, Sat, Sun (case insensitive)
    grammar.addSymbol("day3alpha", new Alt(
      new LiteralIC("MON"), new LiteralIC("TUE"), new LiteralIC("WED"),
      new LiteralIC("THU"), new LiteralIC("FRI"), new LiteralIC("SAT"), new LiteralIC("SUN")
    ));

    // timezoneAlpha: GMT, UTC (case insensitive)
    grammar.addSymbol("timezoneAlpha", new Alt(
      new LiteralIC("GMT"), new LiteralIC("UTC")
    ));

    // unixTimezone: GMT, UTC, or +/-HHMM or +/-HH:MM (for Unix Date.toString() format)
    grammar.addSymbol("unixTimezone", new Alt(
      new LiteralIC("GMT"),
      new LiteralIC("UTC"),
      // +HHMM or -HHMM format
      new Seq(
        new Chars("+-"),
        new Repeat(Range.create('0', '9'), null, 4, 4)
      ),
      // +HH:MM or -HH:MM format
      new Seq(
        new Chars("+-"),
        new Repeat(Range.create('0', '9'), null, 2, 2),
        Literal.create(":"),
        new Repeat(Range.create('0', '9'), null, 2, 2)
      )
    ));

    // datetimesep: T or space (datetime separator)
    grammar.addSymbol("datetimesep", new Chars("T "));

    // timezone: Z or +/-HH:MM or +/-HHMM or +/-HH
    grammar.addSymbol("timezone", new Alt(
      Literal.create("Z"),
      // +HH:MM format
      new Seq(
        new Chars("+-"),
        new Repeat(Range.create('0', '9'), null, 2, 2),
        Literal.create(":"),
        new Repeat(Range.create('0', '9'), null, 2, 2)
      ),
      // +HHMM format (no colon)
      new Seq(
        new Chars("+-"),
        new Repeat(Range.create('0', '9'), null, 4, 4)
      ),
      // +HH format (hours only)
      new Seq(
        new Chars("+-"),
        new Repeat(Range.create('0', '9'), null, 2, 2)
      )
    ));

    // ========== YYYYMMDD Formats ==========

    grammar.addSymbol("yyyymmdd", new Alt(
      grammar.sym("yyyymmddhhmmss-compact"),
      grammar.sym("yyyymmdd-compact"),
      grammar.sym("yyyymmdd-sep")
    ));

    // YYYYMMDD with separators and optional time
    // Supports single-digit months and days (e.g., 2025-1-5)
    grammar.addSymbol("yyyymmdd-sep", new Alt(
      // With fractional seconds (milliseconds/microseconds) and timezone
      new Seq(
        grammar.sym("year4"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"), Literal.create("."), grammar.sym("fractionalSeconds"),
        new Optional(grammar.sym("timezone"))
      ),
      // With seconds and timezone
      new Seq(
        grammar.sym("year4"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"),
        new Optional(grammar.sym("timezone"))
      ),
      // With minutes and timezone
      new Seq(
        grammar.sym("year4"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Seq(
        grammar.sym("year4"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible")
      )
    ));

    // YYYYMMDD compact: 8 digits
    grammar.addSymbol("yyyymmdd-compact", new Join(
      new Seq(grammar.sym("year4_1900_2999"), grammar.sym("month2"), grammar.sym("day2"))
    ));

    // YYYYMMDDHHMMSS compact: 14 digits
    grammar.addSymbol("yyyymmddhhmmss-compact", new Seq(
      grammar.sym("year4_1900_2999"), grammar.sym("month2"), grammar.sym("day2"),
      grammar.sym("hour2"), grammar.sym("minute2"), grammar.sym("second2")
    ));

    // ========== MMDDYYYY Formats ==========

    grammar.addSymbol("mmddyyyy", new Alt(
      grammar.sym("mmddyyyy-compact"),
      grammar.sym("mmddyyyy-sep")
    ));

    // MMDDYYYY with separators - supports single-digit month/day (e.g., 7/2/2025)
    grammar.addSymbol("mmddyyyy-sep", new Alt(
      // With fractional seconds and timezone
      new Seq(
        grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("year4"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"), Literal.create("."), grammar.sym("fractionalSeconds"),
        new Optional(grammar.sym("timezone"))
      ),
      // With seconds and timezone
      new Seq(
        grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("year4"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"),
        new Optional(grammar.sym("timezone"))
      ),
      // With minutes and timezone
      new Seq(
        grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("year4"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Seq(
        grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("year4")
      )
    ));

    // MMDDYYYY compact: 8 digits with validated month (01-12), day (01-31), year
    grammar.addSymbol("mmddyyyy-compact", new Alt(
      // With space and compact time (HHMMSS - no colons)
      new Seq(
        new Join(new Seq(grammar.sym("month2"), grammar.sym("day2"), grammar.sym("year4"))),
        grammar.sym("datetimesep"),
        grammar.sym("hour2"), grammar.sym("minute2"), grammar.sym("second2")
      ),
      // With space and time with colons
      new Seq(
        new Join(new Seq(grammar.sym("month2"), grammar.sym("day2"), grammar.sym("year4"))),
        grammar.sym("datetimesep"),
        grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(new Seq(Literal.create(":"), grammar.sym("second2"))),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Join(new Seq(grammar.sym("month2"), grammar.sym("day2"), grammar.sym("year4")))
    ));

    // ========== MMDDYY Formats (2-digit year) ==========

    grammar.addSymbol("mmddyy", new Alt(
      grammar.sym("mmddyy-compact"),
      grammar.sym("mmddyy-sep")
    ));

    // MMDDYY with separators - supports single-digit month/day (e.g., 7/2/25)
    grammar.addSymbol("mmddyy-sep", new Alt(
      // With fractional seconds and timezone
      new Seq(
        grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("year2"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"), Literal.create("."), grammar.sym("fractionalSeconds"),
        new Optional(grammar.sym("timezone"))
      ),
      // With seconds and timezone
      new Seq(
        grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("year2"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"),
        new Optional(grammar.sym("timezone"))
      ),
      // With minutes and timezone
      new Seq(
        grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("year2"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Seq(
        grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("year2")
      )
    ));

    // MMDDYY compact: 6 digits with validated month (01-12), day (01-31), year
    grammar.addSymbol("mmddyy-compact", new Join(new Seq(grammar.sym("month2"), grammar.sym("day2"), grammar.sym("year2"))));

    // ========== YYMMDD Formats ==========

    grammar.addSymbol("yymmdd", new Alt(
      grammar.sym("yymmdd-compact"),
      grammar.sym("yymmdd-sep")
    ));

    // YYMMDD with separators - supports single-digit months/days (e.g., 25-1-5)
    grammar.addSymbol("yymmdd-sep", new Alt(
      // With fractional seconds and timezone
      new Seq(
        grammar.sym("year2"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"), Literal.create("."), grammar.sym("fractionalSeconds"),
        new Optional(grammar.sym("timezone"))
      ),
      // With seconds and timezone
      new Seq(
        grammar.sym("year2"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"),
        new Optional(grammar.sym("timezone"))
      ),
      // With minutes and timezone
      new Seq(
        grammar.sym("year2"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Seq(
        grammar.sym("year2"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("dayFlexible")
      )
    ));

    // YYMMDD compact: 6 digits with validated year, month (01-12), day (01-31)
    grammar.addSymbol("yymmdd-compact", new Join(new Seq(grammar.sym("year2"), grammar.sym("month2"), grammar.sym("day2"))));

    // ========== DDMMYYYY Formats (via opt_name only) ==========

    grammar.addSymbol("ddmmyyyy", new Alt(
      grammar.sym("ddmmyyyy-sep"),
      grammar.sym("ddmmyy-sep"),
      grammar.sym("ddmmyyyy-compact"),
      grammar.sym("ddmmyy-compact")
    ));

    // DDMMYYYY with separators - supports single-digit days and months (e.g., 5-1-2025)
    grammar.addSymbol("ddmmyyyy-sep", new Alt(
      // With fractional seconds and timezone
      new Seq(
        grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("year4"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"), Literal.create("."), grammar.sym("fractionalSeconds"),
        new Optional(grammar.sym("timezone"))
      ),
      // With seconds and timezone
      new Seq(
        grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("year4"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"),
        new Optional(grammar.sym("timezone"))
      ),
      // With minutes and timezone
      new Seq(
        grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("year4"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Seq(
        grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("year4")
      )
    ));

    // DDMMYYYY compact: 8 digits with validated day (01-31), month (01-12), year
    grammar.addSymbol("ddmmyyyy-compact", new Alt(
      // With space and compact time (HHMMSS - no colons)
      new Seq(
        new Join(new Seq(grammar.sym("day2"), grammar.sym("month2"), grammar.sym("year4"))),
        grammar.sym("datetimesep"),
        grammar.sym("hour2"), grammar.sym("minute2"), grammar.sym("second2")
      ),
      // With space and time with colons
      new Seq(
        new Join(new Seq(grammar.sym("day2"), grammar.sym("month2"), grammar.sym("year4"))),
        grammar.sym("datetimesep"),
        grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(new Seq(Literal.create(":"), grammar.sym("second2"))),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Join(new Seq(grammar.sym("day2"), grammar.sym("month2"), grammar.sym("year4")))
    ));

    // DDMMYY with separators - supports single-digit days and months (e.g., 5-1-25)
    grammar.addSymbol("ddmmyy-sep", new Alt(
      // With fractional seconds and timezone
      new Seq(
        grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("year2"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"), Literal.create("."), grammar.sym("fractionalSeconds"),
        new Optional(grammar.sym("timezone"))
      ),
      // With seconds and timezone
      new Seq(
        grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("year2"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"),
        new Optional(grammar.sym("timezone"))
      ),
      // With minutes and timezone
      new Seq(
        grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("year2"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Seq(
        grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"), new Chars("-/"), grammar.sym("year2")
      )
    ));

    // DDMMYY compact: 6 digits with validated day (01-31), month (01-12), year
    grammar.addSymbol("ddmmyy-compact", new Join(new Seq(grammar.sym("day2"), grammar.sym("month2"), grammar.sym("year2"))));

    // ========== YYYYDDMM Formats (via opt_name only) ==========

    grammar.addSymbol("yyyyddmm", new Alt(
      grammar.sym("yyyyddmm-compact"),
      grammar.sym("yyyyddmm-sep"),
      grammar.sym("yyddmm")
    ));

    // YYYYDDMM with separators - supports single-digit days and months (e.g., 2025-5-1)
    grammar.addSymbol("yyyyddmm-sep", new Alt(
      // With fractional seconds and timezone
      new Seq(
        grammar.sym("year4"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"), Literal.create("."), grammar.sym("fractionalSeconds"),
        new Optional(grammar.sym("timezone"))
      ),
      // With seconds and timezone
      new Seq(
        grammar.sym("year4"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"),
        new Optional(grammar.sym("timezone"))
      ),
      // With minutes and timezone
      new Seq(
        grammar.sym("year4"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Seq(
        grammar.sym("year4"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible")
      )
    ));

    // YYYYDDMM compact: 8 digits with validated year, day (01-31), month (01-12)
    grammar.addSymbol("yyyyddmm-compact", new Alt(
      // With space and compact time (HHMMSS - no colons)
      new Seq(
        new Join(new Seq(grammar.sym("year4"), grammar.sym("day2"), grammar.sym("month2"))),
        grammar.sym("datetimesep"),
        grammar.sym("hour2"), grammar.sym("minute2"), grammar.sym("second2")
      ),
      // With space and time with colons
      new Seq(
        new Join(new Seq(grammar.sym("year4"), grammar.sym("day2"), grammar.sym("month2"))),
        grammar.sym("datetimesep"),
        grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(new Seq(Literal.create(":"), grammar.sym("second2"))),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Join(new Seq(grammar.sym("year4"), grammar.sym("day2"), grammar.sym("month2")))
    ));

    grammar.addSymbol("yyddmm", new Alt(
      grammar.sym("yyddmm-compact"),
      grammar.sym("yyddmm-sep")
    ));

    // YYDDMM with separators - supports single-digit days and months (e.g., 25-5-1)
    grammar.addSymbol("yyddmm-sep", new Alt(
      // With fractional seconds and timezone
      new Seq(
        grammar.sym("year2"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"), Literal.create("."), grammar.sym("fractionalSeconds"),
        new Optional(grammar.sym("timezone"))
      ),
      // With seconds and timezone
      new Seq(
        grammar.sym("year2"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        Literal.create(":"), grammar.sym("second2"),
        new Optional(grammar.sym("timezone"))
      ),
      // With minutes and timezone
      new Seq(
        grammar.sym("year2"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible"),
        grammar.sym("datetimesep"), grammar.sym("hour2"), Literal.create(":"), grammar.sym("minute2"),
        new Optional(grammar.sym("timezone"))
      ),
      // Date only
      new Seq(
        grammar.sym("year2"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("monthFlexible")
      )
    ));

    // YYDDMM compact: 6 digits with validated year, day (01-31), month (01-12)
    grammar.addSymbol("yyddmm-compact", new Join(new Seq(grammar.sym("year2"), grammar.sym("day2"), grammar.sym("month2"))));

    // ========== Julian Date Formats ==========

    // Combined Julian date parser - tries YYDDD first (5 digits), then YDDD (4 digits)
    // Use opt_name='juliandate' in mapping configurations
    grammar.addSymbol("juliandate", new Alt(
      grammar.sym("yyddd"),   // Try 5-digit format first (more specific)
      grammar.sym("yddd")     // Fall back to 4-digit format
    ));

    // YYDDD format: 5-digit Julian date (2-digit year + 3-digit day of year)
    // e.g., "25216" = Year 2025, Day 216 = August 4, 2025
    // Year cutoff: 00-50 = 2000-2050, 51-99 = 1951-1999
    grammar.addSymbol("yyddd", new Join(new Seq(
      grammar.sym("year2"),      // YY: 2-digit year (00-99)
      grammar.sym("dayOfYear")   // DDD: day of year (001-366)
    )));

    // YDDD format: 4-digit Julian date (1-digit year + 3-digit day of year)
    // e.g., "5216" = Year 2025, Day 216 = August 4, 2025
    // Year mapping: 0-9 = 2020-2029
    grammar.addSymbol("yddd", new Join(new Seq(
      Range.create('0', '9'),    // Y: 1-digit year (0-9 → 2020-2029)
      grammar.sym("dayOfYear")   // DDD: day of year (001-366)
    )));

    // Day of year (001-366) - used for Julian date formats
    grammar.addSymbol("dayOfYear", new Alt(
      new Seq(Literal.create("3"), Literal.create("6"), Range.create('0', '6')),  // 360-366
      new Seq(Literal.create("3"), Range.create('0', '5'), Range.create('0', '9')),  // 300-359
      new Seq(Range.create('1', '2'), Range.create('0', '9'), Range.create('0', '9')),  // 100-299
      new Seq(Literal.create("0"), Range.create('0', '9'), Range.create('0', '9'))   // 000-099
    ));

    // ========== Month Name Formats ==========

    // YYYYDDMMM with separators - supports single-digit days (e.g., 2025-5-JAN)
    grammar.addSymbol("yyyyddmmm-sep", new Seq(
      grammar.sym("year4"), new Chars("-/"), grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("month3alpha")
    ));

    grammar.addSymbol("yyyyddmmm-compact", new Seq(
      grammar.sym("year4"), grammar.sym("day2"), grammar.sym("month3alpha")
    ));

    // DDMMMYYYY with separators - supports single-digit days (e.g., 5-JAN-2025)
    grammar.addSymbol("ddmmmyyyy-sep", new Seq(
      grammar.sym("dayFlexible"), new Chars("-/"), grammar.sym("month3alpha"), new Chars("-/"), grammar.sym("year4")
    ));

    grammar.addSymbol("ddmmmyyyy-compact", new Seq(
      grammar.sym("day2"), grammar.sym("month3alpha"), grammar.sym("year4")
    ));

    // MMM dd yyyy with spaces: "Jan 02 2025" or "Jan 2 2025" - supports single-digit days
    grammar.addSymbol("mmmddyyyy-space", new Seq(
      grammar.sym("month3alpha"), Literal.create(" "), grammar.sym("dayFlexible"), Literal.create(" "), grammar.sym("year4")
    ));

    // DD MMM YYYY with spaces: "15 JAN 2025" or "5 JAN 2025" - supports single-digit days
    grammar.addSymbol("ddmmmyyyy-space", new Seq(
      grammar.sym("dayFlexible"), Literal.create(" "), grammar.sym("month3alpha"), Literal.create(" "), grammar.sym("year4")
    ));

    // JavaScript Date.toString() format: "Thu Feb 19 2026 16:20:23 GMT-0400 (Atlantic Standard Time)"
    // Format: DDD MMM DD YYYY HH:MM:SS GMT±HHMM (Timezone Name)
    grammar.addSymbol("js-date-tostring", new Seq(
      grammar.sym("day3alpha"),           // Day name (ignored)
      Literal.create(" "),
      grammar.sym("month3alpha"),         // Month name
      Literal.create(" "),
      grammar.sym("dayFlexible"),         // Day of month
      Literal.create(" "),
      grammar.sym("year4"),               // Year (before time)
      Literal.create(" "),
      grammar.sym("hour2"),               // Hour
      Literal.create(":"),
      grammar.sym("minute2"),             // Minute
      Literal.create(":"),
      grammar.sym("second2"),             // Second
      Literal.create(" "),
      grammar.sym("jsTimezone"),          // GMT or GMT±HHMM
      new Optional(new Seq(              // Optional (Timezone Name)
        Literal.create(" "),
        Literal.create("("),
        new Repeat(new NotChars(")"), (Parser) null, 1),
        Literal.create(")")
      ))
    ));

    // JS timezone format: GMT optionally followed by ±HHMM offset
    grammar.addSymbol("jsTimezone", new Seq(
      new LiteralIC("GMT"),
      new Optional(new Seq(
        new Chars("+-"),
        new Repeat(Range.create('0', '9'), null, 4, 4)
      ))
    ));

    // Unix/Java Date.toString() format: "Tue Apr 01 05:17:59 GMT 2025"
    // Format: DDD MMM DD HH:MM:SS TZ YYYY
    grammar.addSymbol("unix-date-tostring", new Seq(
      grammar.sym("day3alpha"),           // Day name (Tue, Wed, etc.) - ignored for date construction
      Literal.create(" "),
      grammar.sym("month3alpha"),         // Month name (Jan, Feb, etc.)
      Literal.create(" "),
      grammar.sym("dayFlexible"),         // Day of month (01-31, can be single digit)
      Literal.create(" "),
      grammar.sym("hour2"),               // Hour (00-23)
      Literal.create(":"),
      grammar.sym("minute2"),             // Minute (00-59)
      Literal.create(":"),
      grammar.sym("second2"),             // Second (00-59)
      Literal.create(" "),
      grammar.sym("unixTimezone"),        // Timezone (GMT, UTC, or +/-offset)
      Literal.create(" "),
      grammar.sym("year4")                // Year (4 digits)
    ));

    // ========== Add Actions ==========
    addActions(grammar);

    return grammar;
  }

  /**
   * Add action handlers to convert parsed arrays to Date objects
   */
  private void addActions(Grammar grammar) {
    final DateParser self = this;

    // YYYYMMDD-Sep action: [YYYY, sep, MM, sep, DD] or with time
    // With fractional seconds: [YYYY, sep, MM, sep, DD, T, HH, :, MM, :, SS, ., fracSec, tz]
    grammar.addAction("yyyymmdd-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[0]),
        Integer.parseInt((String) v[2]) - 1,
        Integer.parseInt((String) v[4]),
        self.parseIntOrDefault(v, 6, -1),
        self.parseIntOrDefault(v, 8, -1),
        self.parseIntOrDefault(v, 10, -1),
        self.extractFractionalSeconds(v, 12),
        self.extractTimezone(v));
    });

    // YYYYMMDD-Compact action: "20250115"
    grammar.addAction("yyyymmdd-compact", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt(v.substring(0, 4)),
        Integer.parseInt(v.substring(4, 6)) - 1,
        Integer.parseInt(v.substring(6, 8)),
        -1, -1, -1, -1, null);
    });

    // YYYYMMDDHHMMSS-Compact action: [year, month, day, hour, minute, second]
    grammar.addAction("yyyymmddhhmmss-compact", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[0]),
        Integer.parseInt((String) v[1]) - 1,
        Integer.parseInt((String) v[2]),
        Integer.parseInt((String) v[3]),
        Integer.parseInt((String) v[4]),
        Integer.parseInt((String) v[5]),
        -1, null);
    });

    // MMDDYYYY-Sep action
    grammar.addAction("mmddyyyy-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[4]),
        Integer.parseInt((String) v[0]) - 1,
        Integer.parseInt((String) v[2]),
        self.parseIntOrDefault(v, 6, -1),
        self.parseIntOrDefault(v, 8, -1),
        self.parseIntOrDefault(v, 10, -1),
        -1,
        self.extractTimezone(v));
    });

    // MMDDYYYY-Compact action: "01152025"
    grammar.addAction("mmddyyyy-compact", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt(v.substring(4, 8)),
        Integer.parseInt(v.substring(0, 2)) - 1,
        Integer.parseInt(v.substring(2, 4)),
        -1, -1, -1, -1, null);
    });

    // YYMMDD-Sep action
    grammar.addAction("yymmdd-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt((String) v[0]);
      return self.buildDate(mode,
        self.convertTwoDigitYear(twoDigitYear),
        Integer.parseInt((String) v[2]) - 1,
        Integer.parseInt((String) v[4]),
        self.parseIntOrDefault(v, 6, -1),
        self.parseIntOrDefault(v, 8, -1),
        self.parseIntOrDefault(v, 10, -1),
        -1,
        self.extractTimezone(v));
    });

    // YYMMDD-Compact action: "250115"
    grammar.addAction("yymmdd-compact", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt(v.substring(0, 2));
      return self.buildDate(mode,
        self.convertTwoDigitYear(twoDigitYear),
        Integer.parseInt(v.substring(2, 4)) - 1,
        Integer.parseInt(v.substring(4, 6)),
        -1, -1, -1, -1, null);
    });

    // DDMMYYYY-Sep action
    grammar.addAction("ddmmyyyy-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[4]),
        Integer.parseInt((String) v[2]) - 1,
        Integer.parseInt((String) v[0]),
        self.parseIntOrDefault(v, 6, -1),
        self.parseIntOrDefault(v, 8, -1),
        self.parseIntOrDefault(v, 10, -1),
        -1,
        self.extractTimezone(v));
    });

    // DDMMYYYY-Compact action: "15012025"
    grammar.addAction("ddmmyyyy-compact", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt(v.substring(4, 8)),
        Integer.parseInt(v.substring(2, 4)) - 1,
        Integer.parseInt(v.substring(0, 2)),
        -1, -1, -1, -1, null);
    });

    // DDMMYY-Sep action
    grammar.addAction("ddmmyy-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt((String) v[4]);
      return self.buildDate(mode,
        self.convertTwoDigitYear(twoDigitYear),
        Integer.parseInt((String) v[2]) - 1,
        Integer.parseInt((String) v[0]),
        self.parseIntOrDefault(v, 6, -1),
        self.parseIntOrDefault(v, 8, -1),
        self.parseIntOrDefault(v, 10, -1),
        -1,
        self.extractTimezone(v));
    });

    // DDMMYY-Compact action: "150125"
    grammar.addAction("ddmmyy-compact", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt(v.substring(4, 6));
      return self.buildDate(mode,
        self.convertTwoDigitYear(twoDigitYear),
        Integer.parseInt(v.substring(2, 4)) - 1,
        Integer.parseInt(v.substring(0, 2)),
        -1, -1, -1, -1, null);
    });

    // YYYYDDMM-Sep action
    grammar.addAction("yyyyddmm-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[0]),
        Integer.parseInt((String) v[4]) - 1,
        Integer.parseInt((String) v[2]),
        self.parseIntOrDefault(v, 6, -1),
        self.parseIntOrDefault(v, 8, -1),
        self.parseIntOrDefault(v, 10, -1),
        -1,
        self.extractTimezone(v));
    });

    // YYYYDDMM-Compact action: "20251501"
    grammar.addAction("yyyyddmm-compact", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt(v.substring(0, 4)),
        Integer.parseInt(v.substring(6, 8)) - 1,
        Integer.parseInt(v.substring(4, 6)),
        -1, -1, -1, -1, null);
    });

    // YYDDMM-Sep action
    grammar.addAction("yyddmm-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt((String) v[0]);
      return self.buildDate(mode,
        self.convertTwoDigitYear(twoDigitYear),
        Integer.parseInt((String) v[4]) - 1,
        Integer.parseInt((String) v[2]),
        self.parseIntOrDefault(v, 6, -1),
        self.parseIntOrDefault(v, 8, -1),
        self.parseIntOrDefault(v, 10, -1),
        -1,
        self.extractTimezone(v));
    });

    // YYDDMM-Compact action: "251501"
    grammar.addAction("yyddmm-compact", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt(v.substring(0, 2));
      return self.buildDate(mode,
        self.convertTwoDigitYear(twoDigitYear),
        Integer.parseInt(v.substring(4, 6)) - 1,
        Integer.parseInt(v.substring(2, 4)),
        -1, -1, -1, -1, null);
    });

    // DDMMMYYYY-Sep action: [DD, sep, MMM, sep, YYYY]
    grammar.addAction("ddmmmyyyy-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[4]),
        self.parseMonthName((String) v[2]),
        Integer.parseInt((String) v[0]),
        -1, -1, -1, -1, null);
    });

    // DDMMMYYYY-Compact action: [DD, MMM, YYYY]
    grammar.addAction("ddmmmyyyy-compact", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[2]),
        self.parseMonthName((String) v[1]),
        Integer.parseInt((String) v[0]),
        -1, -1, -1, -1, null);
    });

    // YYYYDDMMM-Sep action: [YYYY, sep, DD, sep, MMM]
    grammar.addAction("yyyyddmmm-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[0]),
        self.parseMonthName((String) v[4]),
        Integer.parseInt((String) v[2]),
        -1, -1, -1, -1, null);
    });

    // YYYYDDMMM-Compact action: [YYYY, DD, MMM]
    grammar.addAction("yyyyddmmm-compact", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[0]),
        self.parseMonthName((String) v[2]),
        Integer.parseInt((String) v[1]),
        -1, -1, -1, -1, null);
    });

    // Timestamp actions - convert timestamp strings directly to Date objects

    // 13-digit JavaScript timestamp (milliseconds since epoch)
    grammar.addAction("timestamp13", (val, x) -> {
      String v = (String) val;
      return new Date(Long.parseLong(v));
    });

    // 10-digit Unix timestamp (seconds since epoch)
    grammar.addAction("timestamp10", (val, x) -> {
      String v = (String) val;
      return new Date(Long.parseLong(v) * 1000);
    });

    // MMM dd yyyy space action: [MMM, ' ', DD, ' ', YYYY]
    grammar.addAction("mmmddyyyy-space", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[4]),
        self.parseMonthName((String) v[0]),
        Integer.parseInt((String) v[2]),
        -1, -1, -1, -1, null);
    });

    // DD MMM YYYY space action: [DD, ' ', MMM, ' ', YYYY]
    grammar.addAction("ddmmmyyyy-space", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      return self.buildDate(mode,
        Integer.parseInt((String) v[4]),
        self.parseMonthName((String) v[2]),
        Integer.parseInt((String) v[0]),
        -1, -1, -1, -1, null);
    });

    // JS Date.toString() action: [DDD, ' ', MMM, ' ', DD, ' ', YYYY, ' ', HH, ':', MM, ':', SS, ' ', TZ, optional]
    // Index mapping: 0=day_name, 1=' ', 2=month, 3=' ', 4=day, 5=' ', 6=year, 7=' ', 8=hour, 9=':', 10=min, 11=':', 12=sec, 13=' ', 14=tz, 15=optional
    grammar.addAction("js-date-tostring", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      String tz = self.normalizeJsTimezone(v[14]);
      return self.buildDate(mode,
        Integer.parseInt((String) v[6]),    // year
        self.parseMonthName((String) v[2]), // month
        Integer.parseInt((String) v[4]),    // day
        Integer.parseInt((String) v[8]),    // hour
        Integer.parseInt((String) v[10]),   // minute
        Integer.parseInt((String) v[12]),   // second
        -1,                                  // ms
        tz);
    });

    // Unix/Java Date.toString() action: [DDD, ' ', MMM, ' ', DD, ' ', HH, ':', MM, ':', SS, ' ', TZ, ' ', YYYY]
    // Index mapping: 0=day_name, 1=' ', 2=month, 3=' ', 4=day, 5=' ', 6=hour, 7=':', 8=min, 9=':', 10=sec, 11=' ', 12=tz, 13=' ', 14=year
    grammar.addAction("unix-date-tostring", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      // Normalize timezone: GMT/UTC -> "Z", otherwise flatten array to string
      String tz = self.normalizeUnixTimezone(v[12]);
      return self.buildDate(mode,
        Integer.parseInt((String) v[14]),   // year
        self.parseMonthName((String) v[2]), // month
        Integer.parseInt((String) v[4]),    // day
        Integer.parseInt((String) v[6]),    // hour
        Integer.parseInt((String) v[8]),    // minute
        Integer.parseInt((String) v[10]),   // second
        -1,                                  // ms
        tz);
    });

    // MMDDYY-Sep action (2-digit year)
    grammar.addAction("mmddyy-sep", (val, x) -> {
      Object[] v = (Object[]) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt((String) v[4]);
      return self.buildDate(mode,
        self.convertTwoDigitYear(twoDigitYear),
        Integer.parseInt((String) v[0]) - 1,
        Integer.parseInt((String) v[2]),
        self.parseIntOrDefault(v, 6, -1),
        self.parseIntOrDefault(v, 8, -1),
        self.parseIntOrDefault(v, 10, -1),
        -1,
        self.extractTimezone(v));
    });

    // MMDDYY-Compact action: "011525" (2-digit year)
    grammar.addAction("mmddyy-compact", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt(v.substring(4, 6));
      return self.buildDate(mode,
        self.convertTwoDigitYear(twoDigitYear),
        Integer.parseInt(v.substring(0, 2)) - 1,
        Integer.parseInt(v.substring(2, 4)),
        -1, -1, -1, -1, null);
    });

    // YYDDD Julian date action: "25216" (5 digits)
    // 2-digit year + 3-digit day of year
    grammar.addAction("yyddd", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int twoDigitYear = Integer.parseInt(v.substring(0, 2));
      int dayOfYear = Integer.parseInt(v.substring(2));
      int year = self.convertTwoDigitYear(twoDigitYear);

      // Convert day-of-year to month and day using Calendar
      Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
      cal.clear();
      cal.set(Calendar.YEAR, year);
      cal.set(Calendar.DAY_OF_YEAR, dayOfYear);

      return self.buildDate(mode,
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH),
        cal.get(Calendar.DAY_OF_MONTH),
        -1, -1, -1, -1, null);
    });

    // YDDD Julian date action: "5216" (4 digits)
    // 1-digit year + 3-digit day of year
    // Year mapping: Sliding window based on current year
    // - Uses current decade as base (e.g., 2020 in 2025, 2030 in 2035)
    // - If result is more than 5 years in future, assumes previous decade
    grammar.addAction("yddd", (val, x) -> {
      String v = (String) val;
      DateParseMode mode = (DateParseMode) x.get("dateParseMode");
      int oneDigitYear = Integer.parseInt(v.substring(0, 1));
      int dayOfYear = Integer.parseInt(v.substring(1));

      // Sliding window: calculate year based on current decade
      int currentYear = Calendar.getInstance(TimeZone.getTimeZone("GMT")).get(Calendar.YEAR);
      int decade = (currentYear / 10) * 10;
      int year = decade + oneDigitYear;

      // If calculated year is more than 5 years in future, assume previous decade
      if ( year > currentYear + 5 ) {
        year -= 10;
      }

      // Convert day-of-year to month and day using Calendar
      Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
      cal.clear();
      cal.set(Calendar.YEAR, year);
      cal.set(Calendar.DAY_OF_YEAR, dayOfYear);

      return self.buildDate(mode,
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH),
        cal.get(Calendar.DAY_OF_MONTH),
        -1, -1, -1, -1, null);
    });
  }
}
