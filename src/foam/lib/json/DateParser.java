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
