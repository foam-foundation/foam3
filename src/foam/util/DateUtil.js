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
    /*
     supported formats:
     YYYY/MM/DD, DD/MM/YYYY, YY/MM/DD, DD/MM/YY
     YYYY-MM-DD, DD-MM-YYYY, YY-MM-DD, DD-MM-YY
     MM/YY, MM/YYYY, MM-YY, MM-YYYY
    */
    public static Date parseDateString(String d) throws RuntimeException {
      d = d.trim();
      String[] ds = d.split("[/-]");
      int day, month, year;
      if ( ds.length == 2 ) {
        month = Integer.parseInt(ds[0]);
        year = Integer.parseInt(ds[1]);
        day = 0;
      } else if ( ds.length == 3 ) {
        month = Integer.parseInt(ds[1]);
        if ( ds[0].length() == 4 ) {
          year = Integer.parseInt(ds[0]);
          day = Integer.parseInt(ds[2]);
        } else if ( ds[2].length() == 4 ) {
          year = Integer.parseInt(ds[2]);
          day = Integer.parseInt(ds[0]);
        } else {
          // since ddMMyy seems to be the more common format
          // first try to parse as ddMMyy and only try yyMMdd in the case that it fails
          day = Integer.parseInt(ds[0]);
          year = Integer.parseInt(ds[2]);
          try {
            return validateAndGetLocalDate(year, month, day);
          } catch (RuntimeException e ) {
            day = Integer.parseInt(ds[2]);
            year = Integer.parseInt(ds[0]);
          }
        }
      } else throw new RuntimeException(INVALID_FORMAT);
      return validateAndGetLocalDate(year, month, day);
    }

    private static Date validateAndGetLocalDate(int year, int month, int day) throws RuntimeException {
      // validate and set date
      var cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("GMT"));
      int currentYear = cal.get(Calendar.YEAR);

      if ( year > 100 && year < 1000 ) throw new RuntimeException(INVALID_FORMAT);
      // case 2 digit year
      // if year + 2000 is within 10 years of current year, then use 2000, otherwise use 1900 ?
      if ( year < 100) year += ( year + 2000 <= currentYear + 10 ) ? 2000 : 1900;
      cal.set(Calendar.YEAR, year);
      
      if ( month < 1 || month > 12 ) throw new RuntimeException(INVALID_FORMAT);
      cal.set(Calendar.MONTH, month - 1);

      var lastDayOfMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH);
      if ( day == 0 ) day = lastDayOfMonth;
      if ( day < 1 || day > lastDayOfMonth ) throw new RuntimeException(INVALID_FORMAT);
      cal.set(Calendar.DAY_OF_MONTH, day);

      cal.set(java.util.Calendar.HOUR_OF_DAY, 12);
      cal.set(java.util.Calendar.MINUTE, 0);
      cal.set(java.util.Calendar.SECOND, 0);

      return cal.getTime();
    }

    public static Date adapt(Object o) {
      try {
        if ( o != null ) {
          if ( o instanceof Number ) {
            return new java.util.Date(((Number) o).longValue());
          }
          if ( o instanceof String ) {
            // o = (java.util.Date) fromString((String) o);
          }
          // convert the Date to be Noon time in GMT
          var cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("GMT"));
          cal.setTime((java.util.Date) o);
          cal.set(java.util.Calendar.HOUR_OF_DAY, 12);
          cal.set(java.util.Calendar.MINUTE, 0);
          return cal.getTime();
        }
        return (java.util.Date) o;
      } catch ( Throwable t ) {
        throw new RuntimeException(t);
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
