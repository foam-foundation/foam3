/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lib.parse.*;
import foam.util.SafetyUtil;
import java.util.Calendar;
import java.util.Date;
import java.util.TimeZone;

public class DateParser
  extends ProxyParser
{
  private final static Parser instance__ = new DateParser();

  public static Parser instance() { return instance__; }

  protected static ThreadLocal<StringBuilder> sb = new ThreadLocal<StringBuilder>() {
    @Override
    protected StringBuilder initialValue() {
      return new StringBuilder();
    }

    @Override
    public StringBuilder get() {
      StringBuilder b = super.get();
      b.setLength(0);
      return b;
    }
  };

  // Helper method to convert Object[] (from Repeat parser) to char[]
  private static char[] toCharArray(Object[] objArray) {
    char[] chars = new char[objArray.length];
    for ( int i = 0; i < objArray.length; i++ ) {
      chars[i] = (Character) objArray[i];
    }
    return chars;
  }

  // Helper method to convert month name to month number (1-12)
  private static int monthNameToNumber(String monthName) {
    switch ( monthName ) {
      case "Jan": return 1;
      case "Feb": return 2;
      case "Mar": return 3;
      case "Apr": return 4;
      case "May": return 5;
      case "Jun": return 6;
      case "Jul": return 7;
      case "Aug": return 8;
      case "Sep": return 9;
      case "Oct": return 10;
      case "Nov": return 11;
      case "Dec": return 12;
      default: throw new IllegalArgumentException("Invalid month name: " + monthName);
    }
  }

  public DateParser() {
    super(new Alt(
      NullParser.instance(),
      new Seq(
        Literal.create("\""),
        IntParser.instance(),
        Literal.create("-"),
        IntParser.instance(),
        Literal.create("-"),
        IntParser.instance(),
        Literal.create("T"),
        IntParser.instance(),
        Literal.create(":"),
        IntParser.instance(),
        Literal.create(":"),
        IntParser.instance(),
        new Optional(
          new Seq1(1, Literal.create("."),
          new Repeat(new Chars("0123456789"), null, 3, 3))
        ),
        Literal.create("Z"),
        Literal.create("\"")),
      new Seq( // YYYY-MM-DD HH:MM:SS || YYYY-MM-DD HH:MM:SS.III
        IntParser.instance(), // 0 - year
        new Alt(  // 1
          Literal.create("-"),
          Literal.create("/")),
        IntParser.instance(), // 2 - month
        new Alt( // 3
          Literal.create("-"),
          Literal.create("/")),
        IntParser.instance(), // 4 - day
        Literal.create(" "), // 5
        IntParser.instance(), // 6 - hr
        Literal.create(":"), // 7
        IntParser.instance(), // 8 - min
        Literal.create(":"), // 9
        IntParser.instance(), // 10 - sec
        new Optional( // 11 - mill
          new Seq1(1, Literal.create("."),
          new Repeat(new Chars("0123456789"), null, 3, 3))
        )),
      // YYYYMMDD HHMMSS (compact format - no delimiters, space between date and time)
      new Seq(
        new Repeat(new Chars("0123456789"), null, 4, 4), // 0 - year (4 digits as chars)
        new Repeat(new Chars("0123456789"), null, 2, 2), // 1 - month (2 digits as chars)
        new Repeat(new Chars("0123456789"), null, 2, 2), // 2 - day (2 digits as chars)
        Literal.create(" "),  // 3
        new Repeat(new Chars("0123456789"), null, 2, 2), // 4 - hr (2 digits as chars)
        new Repeat(new Chars("0123456789"), null, 2, 2), // 5 - min (2 digits as chars)
        new Repeat(new Chars("0123456789"), null, 2, 2)  // 6 - sec (2 digits as chars)
      ),
      // YYYY-MM-DD (date only)
      new Seq(
        IntParser.instance(), // 0 - year
        new Alt(  // 1
          Literal.create("-"),
          Literal.create("/")),
        IntParser.instance(), // 2 - month
        new Alt( // 3
          Literal.create("-"),
          Literal.create("/")),
        IntParser.instance() // 4 - day
        ),
      // SQL Server format: "Mon DD YYYY HH:MMAM/PM" (e.g., "Sep 24 2025 12:00AM")
      new Seq(
        new Alt( // 0 - month name
          Literal.create("Jan"), Literal.create("Feb"), Literal.create("Mar"),
          Literal.create("Apr"), Literal.create("May"), Literal.create("Jun"),
          Literal.create("Jul"), Literal.create("Aug"), Literal.create("Sep"),
          Literal.create("Oct"), Literal.create("Nov"), Literal.create("Dec")),
        Literal.create(" "),    // 1
        IntParser.instance(),   // 2 - day
        Literal.create(" "),    // 3
        IntParser.instance(),   // 4 - year
        Literal.create(" "),    // 5
        IntParser.instance(),   // 6 - hour
        Literal.create(":"),    // 7
        IntParser.instance(),   // 8 - minute
        new Alt(                // 9 - AM/PM
          Literal.create("AM"),
          Literal.create("PM"))
      ),
      new LongParser()
    ));
  }

  public PStream parse(PStream ps, ParserContext x) {
    ps = super.parse(ps, x);

    if ( ps == null ) return null;

    if ( ps.value() == null ) return ps.setValue(null);

    // Checks if Long Date (Timestamp from epoch)
    if ( ps.value() instanceof Long ) {
      return ps.setValue(new Date((Long) ps.value()));
    }

    Object[] result = (Object[]) ps.value();

    // TODO: Handle sub-millisecond accuracy, either with java 8 java.time package or some custom type
    // to support java 7

    Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
    c.clear();
    Object[] milli = null;

    // Check if this is compact format (YYYYMMDD HHMMSS) - result[0] will be char array
    if ( result.length == 7 && result[0] instanceof Object[] ) {
      // Compact format: convert char arrays to integers
      String yearStr = new String(toCharArray((Object[]) result[0]));
      String monthStr = new String(toCharArray((Object[]) result[1]));
      String dayStr = new String(toCharArray((Object[]) result[2]));
      String hourStr = new String(toCharArray((Object[]) result[4]));
      String minStr = new String(toCharArray((Object[]) result[5]));
      String secStr = new String(toCharArray((Object[]) result[6]));

      c.set(
        Integer.parseInt(yearStr),
        Integer.parseInt(monthStr) - 1, // Java calendar uses zero-indexed months
        Integer.parseInt(dayStr),
        Integer.parseInt(hourStr),
        Integer.parseInt(minStr),
        Integer.parseInt(secStr));
      return ps.setValue(c.getTime());
    }

    // Check if this is SQL Server format (Mon DD YYYY HH:MMAM/PM)
    if ( result.length == 10 && result[0] instanceof String ) {
      String monthName = (String) result[0];
      int month = monthNameToNumber(monthName);
      int day = (Integer) result[2];
      int year = (Integer) result[4];
      int hour = (Integer) result[6];
      int minute = (Integer) result[8];
      String ampm = (String) result[9];

      // Convert 12-hour to 24-hour format
      if ( "PM".equals(ampm) && hour != 12 ) {
        hour += 12;
      } else if ( "AM".equals(ampm) && hour == 12 ) {
        hour = 0;
      }

      c.set(year, month - 1, day, hour, minute, 0);
      return ps.setValue(c.getTime());
    }

    try {
      // Format with colons: YYYY-MM-DD HH:MM:SS
      c.set(
        (Integer) result[1],
        (Integer) result[3] - 1, // Java calendar uses zero-indexed months
        (Integer) result[5],
        (Integer) result[7],
        (Integer) result[9],
        (Integer) result[11]);
      if ( result[12] == null ) return ps.setValue(c.getTime());
      milli = (Object[]) result[12];
    } catch (Exception e ) {
      // Date only: YYYY-MM-DD
      c.set(
        (Integer) result[0],
        (Integer) result[2] - 1, // Java calendar uses zero-indexed months
        (Integer) result[4],
        result.length >= 7 ? (Integer) result[6] : 0,
        result.length >= 9 ? (Integer) result[8] : 0,
        result.length >= 11 ? (Integer) result[10] : 0);
      if ( result.length < 12 ) return ps.setValue(c.getTime());
      if ( result[11] == null ) return ps.setValue(c.getTime());
      milli = (Object[]) result[11];
    }

    boolean zeroPrefixed = true;
    StringBuilder milliseconds = sb.get();

    for ( int i = 0 ; i < milli.length ; i++ ) {
      // do not prefix with zeros
      if ( zeroPrefixed && '0' == (char) milli[i] ) continue;

      // append millisecond
      if ( zeroPrefixed ) zeroPrefixed = false;
      milliseconds.append((char) milli[i]);
    }

    // try to parse milliseconds, default to 0
    c.add(
      Calendar.MILLISECOND,
      ! SafetyUtil.isEmpty(milliseconds.toString()) ?
        Integer.parseInt(milliseconds.toString(), 10) :
        0);

    return ps.setValue(c.getTime());
  }
}
