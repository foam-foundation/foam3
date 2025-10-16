/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util',
  name: 'DateServiceImpl',

  implements: ['foam.util.DateService'],

  documentation: `
    Implementation of DateService that provides date parsing, adaptation, and conversion operations.
    Migrated from static methods in DateUtil to instance methods in a service.
  `,

  javaImports: [
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

  methods: [
    {
      name: 'parseDateString',
      args: 'Context x, String d',
      type: 'Date',
      documentation: 'Parses date strings in formats: YYYY/MM/DD, MM/DD/YYYY, YY/MM/DD, YYYY-MM-DD, MM-DD-YYYY, YY-MM-DD',
      code: function(x, d) {
        // Try each format in FORMATS_ORDER until one matches
        for ( var i = 0; i < this.FORMATS_ORDER.length; i++ ) {
          var format = this.FORMATS_ORDER[i];
          var match = d.match(format.regex);

          if ( match ) {
            var year, month, day;

            // Map captured groups based on the format's group definition
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
            format.set2DigitYearStart(new java.util.Date(-631152000000L));
            date = format.parse(d.replaceAll("[-/]", "").substring(0, 6));
          }
          // YYMMDD (no separators)
          else if ( d.matches("^\\\\d{6}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyMMdd");
            format.setLenient(false);
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
      args: 'Context x, Object o',
      type: 'Date',
      documentation: 'Adapts various types to Date, normalizing to noon GMT',
      code: function(x, o) {
        try {
          if ( o != null ) {
            var date;
            if ( typeof o === 'number' ) {
              date = new Date(o);
            } else if ( typeof o === 'string' ) {
              date = this.parseDateString(x, o);
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
          return this.MAX_DATE;
        }
      },
      javaCode: `
        try {
          if ( o != null ) {
            Date date;
            if ( o instanceof Number ) {
              date = new java.util.Date(((Number) o).longValue());
            } else if ( o instanceof String ) {
              date = parseDateString(x, (String) o);
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
        ZoneId zone = ZoneId.systemDefault();
        if ( SafetyUtil.isEmpty(timeZoneStr) ) return zone;

        TimeZone timeZone = (TimeZone) ((DAO) x.get("timeZoneDAO"))
          .find(OR(EQ(TimeZone.ID, timeZoneStr), EQ(TimeZone.DISPLAY_NAME, timeZoneStr)));

        return timeZone == null ? zone : ZoneId.of(timeZone.getId());
      `
    },
    {
      name: 'localDateToDate',
      args: 'Context x, LocalDate localDate',
      type: 'Date',
      documentation: 'Converts a local date to Date at start of day in system timezone',
      code: function(x, localDate) {
        if ( ! localDate ) return localDate;
        var d = new Date(localDate);
        d.setHours(0, 0, 0, 0);
        return d;
      },
      javaCode: `
        return Date.from(localDate.atStartOfDay(ZoneId.systemDefault()).toInstant());
      `
    },
    {
      name: 'localDateToDateWithZone',
      args: 'Context x, LocalDate localDate, ZoneId zone',
      type: 'Date',
      documentation: 'Converts a local date to Date at start of day in specified timezone',
      code: function(x, localDate, zone) {
        if ( ! localDate ) return localDate;
        // JavaScript doesn't have full ZoneId support, use system timezone
        return this.localDateToDate(x, localDate);
      },
      javaCode: `
        if ( zone == null ) {
          return localDateToDate(x, localDate);
        }
        return Date.from(localDate.atStartOfDay(zone).toInstant());
      `
    },
    {
      name: 'localDateTimeToDate',
      args: 'Context x, LocalDateTime localDateTime',
      type: 'Date',
      documentation: 'Converts a local datetime to Date using system timezone',
      code: function(x, localDateTime) {
        if ( ! localDateTime ) return localDateTime;
        return new Date(localDateTime);
      },
      javaCode: `
        return Date.from(localDateTime.atZone(ZoneId.systemDefault()).toInstant());
      `
    },
    {
      name: 'localDateTimeToDateWithZone',
      args: 'Context x, LocalDateTime localDateTime, ZoneId zone',
      type: 'Date',
      documentation: 'Converts a local datetime to Date using specified timezone',
      code: function(x, localDateTime, zone) {
        if ( ! localDateTime ) return localDateTime;
        // JavaScript doesn't have full ZoneId support, use system timezone
        return this.localDateTimeToDate(x, localDateTime);
      },
      javaCode: `
        if ( zone == null ) {
          return localDateTimeToDate(x, localDateTime);
        }
        return Date.from(localDateTime.atZone(zone).toInstant());
      `
    },
    {
      name: 'dateToLocalDate',
      args: 'Context x, Date date',
      type: 'LocalDate',
      documentation: 'Converts Date to local date using system timezone',
      code: function(x, date) {
        if ( ! date ) return date;
        var d = new Date(date);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      },
      javaCode: `
        return LocalDate.ofInstant(date.toInstant(), ZoneId.systemDefault());
      `
    },
    {
      name: 'dateToLocalDateWithZone',
      args: 'Context x, Date date, ZoneId zone',
      type: 'LocalDate',
      documentation: 'Converts Date to local date using specified timezone',
      code: function(x, date, zone) {
        if ( ! date ) return date;
        // JavaScript doesn't have full ZoneId support, use system timezone
        return this.dateToLocalDate(x, date);
      },
      javaCode: `
        if ( zone == null ) {
          return dateToLocalDate(x, date);
        }
        return LocalDate.ofInstant(date.toInstant(), zone);
      `
    },
    {
      name: 'dateToLocalDateTime',
      args: 'Context x, Date date',
      type: 'LocalDateTime',
      documentation: 'Converts Date to local datetime using system timezone',
      code: function(x, date) {
        if ( ! date ) return date;
        return new Date(date);
      },
      javaCode: `
        return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
      `
    },
    {
      name: 'dateToLocalDateTimeWithZone',
      args: 'Context x, Date date, ZoneId zone',
      type: 'LocalDateTime',
      documentation: 'Converts Date to local datetime using specified timezone',
      code: function(x, date, zone) {
        if ( ! date ) return date;
        // JavaScript doesn't have full ZoneId support, use system timezone
        return this.dateToLocalDateTime(x, date);
      },
      javaCode: `
        if ( zone == null ) {
          return dateToLocalDateTime(x, date);
        }
        return LocalDateTime.ofInstant(date.toInstant(), zone);
      `
    },
    {
      name: 'getMaxDate',
      args: 'Context x',
      type: 'Date',
      documentation: 'Returns the maximum date value',
      code: function(x) {
        return this.MAX_DATE;
      },
      javaCode: `
        return MAX_DATE;
      `
    }
  ]
});
