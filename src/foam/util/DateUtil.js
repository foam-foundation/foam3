/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util',
  name: 'DateUtil',

  documentation: `
    Contains old DateUtil.java methods as well as new methods for adapting dates and parsing date strings.
  `,

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.time.TimeZone',
    'foam.util.SafetyUtil',
    'java.text.ParseException',
    'java.text.SimpleDateFormat',
    'java.time.LocalDate',
    'java.time.LocalDateTime',
    'java.time.ZoneId',
    'java.util.Date',
    'java.util.Calendar',
    'static foam.mlang.MLang.*'
  ],

  messages: [
    { name: 'INVALID_FORMAT', message: 'Invalid format.' }
  ],

  javaCode: `
    public static final Date MAX_DATE = new Date(Long.MAX_VALUE);

    /*
     supported formats:
     YYYY/MM/DD, MM/DD/YYYY, YY/MM/DD
     YYYY-MM-DD, MM-DD-YYYY, YY-MM-DD
    */
    public static Date parseDateString(String d) throws RuntimeException {
      SimpleDateFormat format;
      Date date;
      try {
        if ( d.matches("^\\\\d{4}[-/]?\\\\d{2}[-/]?\\\\d{2}\\\\b.*") ) { // yyyyMMdd
          format = new SimpleDateFormat("yyyyMMdd");
          format.setLenient(false);
          date = format.parse(d.replaceAll("[-/]", ""));
        } else if ( d.matches("^\\\\d{2}[-/]?\\\\d{2}[-/]?\\\\d{4}\\\\b.*") ) { // MMddyyyy
          format = new SimpleDateFormat("MMddyyyy");
          format.setLenient(false);
          date = format.parse(d.replaceAll("[-/]", ""));
        } else if ( d.matches("^\\\\d{2}[-/]?\\\\d{2}[-/]?\\\\d{2}\\\\b.*") ) { // yyMMdd
          format = new SimpleDateFormat("yyMMdd");
          format.setLenient(false);
          date = format.parse(d.replaceAll("[-/]", ""));
        } else {
          throw new RuntimeException("Unsupported Date format: " + d);
        }
      } catch ( ParseException e ) {
        throw new RuntimeException("Cannot parse invalid date: " + d);
      }
      return date;
    }

    public static Date adapt(Object o) {
      try {
        if ( o != null ) {
          Date date;
          if ( o instanceof Number ) {
            date = new java.util.Date(((Number) o).longValue());
          } else if ( o instanceof String ) {
            date = parseDateString((String) o);
          } else {
            date = (java.util.Date) o;
          }
          return date;
        }
        return null;
      } catch ( Throwable t ) {
        System.err.println("Cannot adapt date:" + o + "; assuming " + MAX_DATE.toString());
        return MAX_DATE;
      }
    }

    // methods from old DateUtil
    public static ZoneId getTimeZoneId(X x, String timeZoneStr) {
      ZoneId zone = ZoneId.systemDefault();

      if ( SafetyUtil.isEmpty(timeZoneStr) ) return zone;

      TimeZone timeZone = (TimeZone) ((DAO) x.get("timeZoneDAO"))
        .find(OR(EQ(TimeZone.ID, timeZoneStr), EQ(TimeZone.DISPLAY_NAME, timeZoneStr)));

      return timeZone == null ? zone : ZoneId.of(timeZone.getId());
    }

    public static Date localDateToDate(LocalDate localDate) {
      return Date.from(localDate.atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    public static Date localDateToDate(LocalDate localDate, ZoneId zone) {
      if ( zone == null ) {
        return localDateToDate(localDate);
      }
      return Date.from(localDate.atStartOfDay(zone).toInstant());
    }

    public static Date localDateTimeToDate(LocalDateTime localDateTime) {
      return Date.from(localDateTime.atZone(ZoneId.systemDefault()).toInstant());
    }

    public static Date localDateTimeToDate(LocalDateTime localDateTime, ZoneId zone) {
      if ( zone == null ) {
        return localDateTimeToDate(localDateTime);
      }
      return Date.from(localDateTime.atZone(zone).toInstant());
    }

    public static LocalDate dateToLocalDate(Date date) {
      return LocalDate.ofInstant(date.toInstant(), ZoneId.systemDefault());
    }

    public static LocalDate dateToLocalDate(Date date, ZoneId zone) {
      if ( zone == null ) {
        return dateToLocalDate(date);
      }
      return LocalDate.ofInstant(date.toInstant(), zone);
    }

    public static LocalDateTime dateToLocalDateTime(Date date) {
      return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
    }

    public static LocalDateTime dateToLocalDateTime(Date date, ZoneId zone) {
      if ( zone == null ) {
        return dateToLocalDateTime(date);
      }
      return LocalDateTime.ofInstant(date.toInstant(), zone);
    }
  `
});
