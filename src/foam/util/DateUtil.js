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

  constants: [
    {
      name: 'MAX_DATE',
      type: 'Date',
      factory: function() {
        return new Date(8640000000000000); // JavaScript max date
      },
      javaFactory: 'return new Date(Long.MAX_VALUE);'
    },
    {
      name: 'FORMATS_ORDER',
      documentation: 'List of regex patterns that map to capture groups: year, month, day',
      factory: function() {
        return [
          // YYYY/MM/DD or YYYY-MM-DD format (with separators)
          // Capture groups: (1) year, (2) month, (3) day
          { regex: /^(\d{4})[-/](\d{2})[-/](\d{2})(?!\d).*/, groups: ['year', 'month', 'day'] },

          // YYYYMMDD format (no separators, year must be 1900-2999)
          // Capture groups: (1) year, (2) month, (3) day
          { regex: /^(1[9]\d{2}|2\d{3})(\d{2})(\d{2})(?!\d).*/, groups: ['year', 'month', 'day'] },

          // MM/DD/YYYY or MM-DD-YYYY format (with separators)
          // Capture groups: (1) month, (2) day, (3) year
          { regex: /^(\d{2})[-/](\d{2})[-/](\d{4})(?!\d).*/, groups: ['month', 'day', 'year'] },

          // MMDDYYYY format (no separators)
          // Capture groups: (1) month, (2) day, (3) year
          { regex: /^(\d{2})(\d{2})(\d{4})(?!\d).*/, groups: ['month', 'day', 'year'] },

          // YY/MM/DD or YY-MM-DD format (with separators, assumes 2000s if < 50, else 1900s)
          // Capture groups: (1) year (2-digit), (2) month, (3) day
          { regex: /^(\d{2})[-/](\d{2})[-/](\d{2})(?!\d).*/, groups: ['year2', 'month', 'day'] },

          // YYMMDD format (no separators)
          // Capture groups: (1) year (2-digit), (2) month, (3) day
          { regex: /^(\d{2})(\d{2})(\d{2})(?!\d).*/, groups: ['year2', 'month', 'day'] }
        ];
      }
    }
  ],

  static: [
    {
      name: 'parseDateString',
      args: 'String d',
      type: 'Date',
      documentation: 'Parses date strings in formats: YYYY/MM/DD, MM/DD/YYYY, YY/MM/DD, YYYY-MM-DD, MM-DD-YYYY, YY-MM-DD',
      code: function(d) {
        // Try each format in FORMATS_ORDER until one matches
        for ( var i = 0; i < foam.util.DateUtil.FORMATS_ORDER.length; i++ ) {
          var format = foam.util.DateUtil.FORMATS_ORDER[i];
          var match = d.match(format.regex);

          if ( match ) {
            var year, month, day;

            // Map captured groups based on the format's group definition
            // For example, if groups = ['month', 'day', 'year'], then:
            //   match[1] = month, match[2] = day, match[3] = year
            for ( var j = 0; j < format.groups.length; j++ ) {
              if ( format.groups[j] === 'year' ) {
                year = parseInt(match[j + 1]);
              } else if ( format.groups[j] === 'year2' ) {
                // 2-digit year: < 50 = 2000s, >= 50 = 1900s
                year = parseInt(match[j + 1]);
                year = year < 50 ? 2000 + year : 1900 + year;
              } else if ( format.groups[j] === 'month' ) {
                month = parseInt(match[j + 1]) - 1; // JavaScript months are 0-indexed
              } else if ( format.groups[j] === 'day' ) {
                day = parseInt(match[j + 1]);
              }
            }

            // Validate the date is valid
            var date = new Date(year, month, day);
            if ( date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ) {
              return date;
            }
            throw new Error('Cannot parse invalid date: ' + d);
          }
        }

        throw new Error('Unsupported Date format: ' + d);
      },
      javaCode: `
        /*
         Supported formats (checked in order):
         1. YYYY/MM/DD, YYYY-MM-DD (with separators)
         2. YYYYMMDD (no separators, year 1900-2999)
         3. MM/DD/YYYY, MM-DD-YYYY (with separators)
         4. MMDDYYYY (no separators)
         5. YY/MM/DD, YY-MM-DD (with separators, 2-digit year)
         6. YYMMDD (no separators, 2-digit year)
        */
        SimpleDateFormat format;
        Date date;
        try {
          // YYYY/MM/DD or YYYY-MM-DD (with separators)
          if ( d.matches("^\\\\d{4}[-/]\\\\d{2}[-/]\\\\d{2}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyyyMMdd");
            format.setLenient(false);
            date = format.parse(d.replaceAll("[-/]", "").substring(0, 8));
          }
          // YYYYMMDD (no separators, year must be 1900-2999)
          else if ( d.matches("^(1[9]\\\\d{2}|2\\\\d{3})\\\\d{2}\\\\d{2}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyyyMMdd");
            format.setLenient(false);
            date = format.parse(d.substring(0, 8));
          }
          // MM/DD/YYYY or MM-DD-YYYY (with separators)
          else if ( d.matches("^\\\\d{2}[-/]\\\\d{2}[-/]\\\\d{4}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("MMddyyyy");
            format.setLenient(false);
            date = format.parse(d.replaceAll("[-/]", "").substring(0, 8));
          }
          // MMDDYYYY (no separators)
          else if ( d.matches("^\\\\d{8}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("MMddyyyy");
            format.setLenient(false);
            date = format.parse(d.substring(0, 8));
          }
          // YY/MM/DD or YY-MM-DD (with separators)
          else if ( d.matches("^\\\\d{2}[-/]\\\\d{2}[-/]\\\\d{2}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyMMdd");
            format.setLenient(false);
            // Set 2-digit year pivot to Jan 1, 1950: years 00-49 = 2000-2049, years 50-99 = 1950-1999
            format.set2DigitYearStart(new java.util.Date(-631152000000L));
            date = format.parse(d.replaceAll("[-/]", "").substring(0, 6));
          }
          // YYMMDD (no separators)
          else if ( d.matches("^\\\\d{6}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyMMdd");
            format.setLenient(false);
            // Set 2-digit year pivot to Jan 1, 1950: years 00-49 = 2000-2049, years 50-99 = 1950-1999
            format.set2DigitYearStart(new java.util.Date(-631152000000L));
            date = format.parse(d.substring(0, 6));
          }
          else {
            throw new RuntimeException("Unsupported Date format: " + d);
          }
        } catch ( ParseException e ) {
          throw new RuntimeException("Cannot parse invalid date: " + d);
        }
        return date;
      `
    },
    {
      name: 'adapt',
      args: 'Object o',
      type: 'Date',
      documentation: 'Adapts various types to Date, normalizing to noon GMT',
      code: function(o) {
        try {
          if ( o != null ) {
            var date;
            if ( typeof o === 'number' ) {
              date = new Date(o);
            } else if ( typeof o === 'string' ) {
              date = foam.util.DateUtil.parseDateString(o);
            } else if ( o instanceof Date ) {
              date = o;
            } else {
              date = new Date(o);
            }
            // Convert the Date to be noon in GMT
            var utcYear = date.getUTCFullYear();
            var utcMonth = date.getUTCMonth();
            var utcDate = date.getUTCDate();
            return new Date(Date.UTC(utcYear, utcMonth, utcDate, 12, 0, 0, 0));
          }
          return o;
        } catch ( t ) {
          console.error('Cannot adapt date:', o, '; assuming MAX_DATE');
          return foam.util.DateUtil.MAX_DATE;
        }
      },
      javaCode: `
        // Adapts various types to Date, normalizing to noon GMT
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
            // convert the Date to be noon in GMT
            var cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("GMT"));
            cal.setTime(date);
            cal.set(java.util.Calendar.HOUR_OF_DAY, 12);
            cal.set(java.util.Calendar.MINUTE, 0);
            cal.set(java.util.Calendar.SECOND, 0);
            return cal.getTime();
          }
          return (java.util.Date) o;
        } catch ( Throwable t ) {
          System.err.println("Cannot adapt date:" + o + "; assuming " + MAX_DATE.toString());
          return MAX_DATE;
        }
      `
    },
    {
      name: 'getTimeZoneId',
      args: 'Context x, String timeZoneStr',
      type: 'ZoneId',
      documentation: 'Gets timezone ID from context',
      code: function(x, timeZoneStr) {
        // JavaScript uses IANA timezone identifiers
        // Return system default or the provided timezone string
        if ( ! timeZoneStr || timeZoneStr === '' ) {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        }

        var timeZoneDAO = x.timeZoneDAO;
        if ( timeZoneDAO ) {
          var timeZone = timeZoneDAO.find(foam.mlang.predicate.Or.create({
            args: [
              foam.mlang.predicate.Eq.create({
                arg1: foam.time.TimeZone.ID,
                arg2: timeZoneStr
              }),
              foam.mlang.predicate.Eq.create({
                arg1: foam.time.TimeZone.DISPLAY_NAME,
                arg2: timeZoneStr
              })
            ]
          }));

          if ( timeZone ) return timeZone.id;
        }

        return timeZoneStr || Intl.DateTimeFormat().resolvedOptions().timeZone;
      },
      javaCode: `
        // Method from old DateUtil - gets timezone ID from context
        ZoneId zone = ZoneId.systemDefault();

        if ( SafetyUtil.isEmpty(timeZoneStr) ) return zone;

        TimeZone timeZone = (TimeZone) ((DAO) x.get("timeZoneDAO"))
          .find(OR(EQ(TimeZone.ID, timeZoneStr), EQ(TimeZone.DISPLAY_NAME, timeZoneStr)));

        return timeZone == null ? zone : ZoneId.of(timeZone.getId());
      `
    },
    {
      name: 'localDateToDate',
      args: 'LocalDate localDate',
      type: 'Date',
      documentation: 'Converts a local date to Date at start of day in system timezone',
      code: function(localDate) {
        if ( ! localDate ) return localDate;

        // Start of day in system timezone
        var d = new Date(localDate);
        d.setHours(0, 0, 0, 0);
        return d;
      },
      javaCode: `
        // Method from old DateUtil
        return Date.from(localDate.atStartOfDay(ZoneId.systemDefault()).toInstant());
      `
    },
    {
      name: 'localDateTimeToDate',
      args: 'LocalDateTime localDateTime',
      type: 'Date',
      documentation: 'Converts a local datetime to Date using system timezone',
      code: function(localDateTime) {
        if ( ! localDateTime ) return localDateTime;

        return new Date(localDateTime);
      },
      javaCode: `
        // Method from old DateUtil
        return Date.from(localDateTime.atZone(ZoneId.systemDefault()).toInstant());
      `
    },
    {
      name: 'dateToLocalDate',
      args: 'Date date',
      type: 'LocalDate',
      documentation: 'Converts Date to local date using system timezone (date only, no time)',
      code: function(date) {
        if ( ! date ) return date;

        var d = new Date(date);
        // Use local timezone
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      },
      javaCode: `
        // Method from old DateUtil
        return LocalDate.ofInstant(date.toInstant(), ZoneId.systemDefault());
      `
    },
    {
      name: 'dateToLocalDateTime',
      args: 'Date date',
      type: 'LocalDateTime',
      documentation: 'Converts Date to local datetime using system timezone',
      code: function(date) {
        if ( ! date ) return date;

        // JavaScript Date is already a datetime
        return new Date(date);
      },
      javaCode: `
        // Method from old DateUtil
        return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
      `
    }
  ],

  javaCode: `
    /*
     * Java method overloads (2-parameter versions)
     *
     * FOAM's static array doesn't support method overloading - you cannot define
     * two methods with the same name but different parameters. JavaScript doesn't
     * support method overloading either, so only the 1-parameter versions are needed
     * in the static array above.
     *
     * However, the original Java code had overloaded methods (1-param and 2-param versions)
     * for backward compatibility with existing code. These Java-only overloads are defined
     * here in the javaCode block to maintain API compatibility without conflicting with
     * the FOAM static method definitions.
     */

    // Java method overloads (2-parameter versions)
    public static Date localDateToDate(LocalDate localDate, ZoneId zone) {
      if ( zone == null ) {
        return localDateToDate(localDate);
      }
      return Date.from(localDate.atStartOfDay(zone).toInstant());
    }

    public static Date localDateTimeToDate(LocalDateTime localDateTime, ZoneId zone) {
      if ( zone == null ) {
        return localDateTimeToDate(localDateTime);
      }
      return Date.from(localDateTime.atZone(zone).toInstant());
    }

    public static LocalDate dateToLocalDate(Date date, ZoneId zone) {
      if ( zone == null ) {
        return dateToLocalDate(date);
      }
      return LocalDate.ofInstant(date.toInstant(), zone);
    }

    public static LocalDateTime dateToLocalDateTime(Date date, ZoneId zone) {
      if ( zone == null ) {
        return dateToLocalDateTime(date);
      }
      return LocalDateTime.ofInstant(date.toInstant(), zone);
    }
  `
});
