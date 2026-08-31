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

  public DateParser() {
    super(new Alt(
      NullParser.instance(),
      // Bare epoch millis — how journals and the JSON formatter write Date
      // values, so it goes first. The Not guard backtracks when the digits
      // turn out to be a datetime's year ("1982-07-07..." or "1982/07/07..."),
      // handing the input to the branches below.
      new Seq1(0,
        new LongParser(),
        new Not(new Chars("-/"))),
      // YYYY-MM-DDTHH:MM:SS[.fff]Z — JSON canonical instant, optionally quoted.
      new Quoted(new Seq( // 0 year, 1 "-", 2 month, 3 "-", 4 day,
                          // 5 "T", 6 hr, 7 ":", 8 min, 9 ":", 10 sec,
                          // 11 optional millis Object[], 12 "Z"
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
        Literal.create("Z")
      )),
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
      // YYYY-MM-DD — date-only, optionally quoted (the RFC 8259 canonical form
      // for a JSON date, since JSON has no native date type).
      new Quoted(new Seq(
        IntParser.instance(), // 0 - year
        new Alt(  // 1
          Literal.create("-"),
          Literal.create("/")),
        IntParser.instance(), // 2 - month
        new Alt( // 3
          Literal.create("-"),
          Literal.create("/")),
        IntParser.instance() // 4 - day
      )),
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

    // All Seq branches above produce arrays starting at index 0 with year /
    // separator / month / separator / day. Bare date-only is length 5, space
    // datetime is length 12, full ISO is length 13.
    Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
    c.clear();
    c.set(
      (Integer) result[0],
      (Integer) result[2] - 1, // Java calendar uses zero-indexed months
      (Integer) result[4],
      result.length >= 7 ? (Integer) result[6] : 0,
      result.length >= 9 ? (Integer) result[8] : 0,
      result.length >= 11 ? (Integer) result[10] : 0);
    if ( result.length < 12 ) return ps.setValue(c.getTime());
    if ( result[11] == null ) return ps.setValue(c.getTime());
    Object[] milli = (Object[]) result[11];

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
