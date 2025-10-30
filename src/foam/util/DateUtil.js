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
    Uses DateParser for all JavaScript date parsing.
  `,

  requires: [
    'foam.parse.DateParser'
  ],

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

  properties: [
    {
      name: 'parser_',
      documentation: 'Shared DateParser instance for all date parsing operations',
      factory: function() {
        return this.DateParser.create();
      }
    }
  ],

  constants: [
    {
      name: 'MAX_DATE',
      type: 'Date',
      factory: function() {
        return new Date(8640000000000000); // JavaScript max date
      },
      javaFactory: 'return new Date(Long.MAX_VALUE);'
    }
  ],

  static: [
    {
      name: 'parseDateTime',
      args: 'String d, String opt_name',
      type: 'Date',
      documentation: 'Parses datetime strings using DateParser in local time. Optional opt_name to specify format.',
      code: function(d, opt_name) {
        // Handle null/undefined
        if ( d === null || d === undefined ) return d;

        // Only accept strings - convert to string if needed
        if ( ! foam.String.isInstance(d) ) {
          d = String(d);
        }

        var parser = foam.util.DateUtil.parser_ || foam.parse.DateParser.create();
        return parser.parseDateTime(d, opt_name);
      },
      javaCode: `
        // TODO: When migrating to Java grammar-based parsing, replace this with DateParser.parseDateTime()
        // Parses datetime string in local timezone
        try {
          return parseDateTimeWithTimezone(d, java.util.TimeZone.getDefault().getID());
        } catch ( ParseException e ) {
          throw new RuntimeException("Cannot parse invalid datetime: " + d);
        }
      `
    },
    {
      name: 'parseDateTimeUTC',
      args: 'String d, String opt_name',
      type: 'Date',
      documentation: 'Parses datetime strings using DateParser in UTC time. Optional opt_name to specify format.',
      code: function(d, opt_name) {
        // Handle null/undefined
        if ( d === null || d === undefined ) return d;

        // Only accept strings - convert to string if needed
        if ( ! foam.String.isInstance(d) ) {
          d = String(d);
        }

        var parser = foam.util.DateUtil.parser_ || foam.parse.DateParser.create();
        return parser.parseDateTimeUTC(d, opt_name);
      },
      javaCode: `
        // TODO: When migrating to Java grammar-based parsing, replace this with DateParser.parseDateTimeUTC()
        // Parses datetime string in UTC timezone
        try {
          return parseDateTimeWithTimezone(d, "GMT");
        } catch ( ParseException e ) {
          throw new RuntimeException("Cannot parse invalid datetime: " + d);
        }
      `
    },
    {
      name: 'parseDateString',
      args: 'String d, String opt_name',
      type: 'Date',
      documentation: 'Parses date strings using DateParser. Supports YYYY/MM/DD, MM/DD/YYYY, YY/MM/DD and compact formats. Optional opt_name to specify format (e.g., "ddmmyyyy").',
      code: function(d, opt_name) {
        // Handle null/undefined
        if ( d === null || d === undefined ) return d;

        // Only accept strings - convert to string if needed
        if ( ! foam.String.isInstance(d) ) {
          d = String(d);
        }

        var parser = foam.util.DateUtil.parser_ || foam.parse.DateParser.create();
        return parser.parseDateString(d, opt_name);
      },
      javaCode: `
        /*
         TODO: When migrating to Java grammar-based parsing, replace this with DateParser.parseDateString()

         Supported formats (checked in order):
         1. YYYY/MM/DD, YYYY-MM-DD (with separators)
         2. YYYYMMDD (no separators, year 1900-2999)
         3. MM/DD/YYYY, MM-DD-YYYY (with separators)
         4. MMDDYYYY (no separators)
         5. YY/MM/DD, YY-MM-DD (with separators, 2-digit year with sliding window)
         6. YYMMDD (no separators, 2-digit year with sliding window)
        */
        SimpleDateFormat format;
        Date date;
        try {
          // YYYY/MM/DD or YYYY-MM-DD (with separators)
          if ( d.matches("^\\\\d{4}[-/]\\\\d{2}[-/]\\\\d{2}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyyyMMdd");
            format.setLenient(false);
            format.setTimeZone(java.util.TimeZone.getTimeZone("GMT"));
            date = format.parse(d.replaceAll("[-/]", "").substring(0, 8));
          }
          // YYYYMMDD (no separators, year must be 1900-2999)
          else if ( d.matches("^(1[9]\\\\d{2}|2\\\\d{3})\\\\d{2}\\\\d{2}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyyyMMdd");
            format.setLenient(false);
            format.setTimeZone(java.util.TimeZone.getTimeZone("GMT"));
            date = format.parse(d.substring(0, 8));
          }
          // MM/DD/YYYY or MM-DD-YYYY (with separators)
          else if ( d.matches("^\\\\d{2}[-/]\\\\d{2}[-/]\\\\d{4}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("MMddyyyy");
            format.setLenient(false);
            format.setTimeZone(java.util.TimeZone.getTimeZone("GMT"));
            date = format.parse(d.replaceAll("[-/]", "").substring(0, 8));
          }
          // MMDDYYYY (no separators)
          else if ( d.matches("^\\\\d{8}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("MMddyyyy");
            format.setLenient(false);
            format.setTimeZone(java.util.TimeZone.getTimeZone("GMT"));
            date = format.parse(d.substring(0, 8));
          }
          // YY/MM/DD or YY-MM-DD (with separators)
          else if ( d.matches("^\\\\d{2}[-/]\\\\d{2}[-/]\\\\d{2}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyMMdd");
            format.setLenient(false);
            format.setTimeZone(java.util.TimeZone.getTimeZone("GMT"));
            // Sliding window: 100-year window centered on current year (50 years back, 50 years forward)
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.add(java.util.Calendar.YEAR, -50);
            format.set2DigitYearStart(cal.getTime());
            date = format.parse(d.replaceAll("[-/]", "").substring(0, 6));
          }
          // YYMMDD (no separators)
          else if ( d.matches("^\\\\d{6}(?!\\\\d).*") ) {
            format = new SimpleDateFormat("yyMMdd");
            format.setLenient(false);
            format.setTimeZone(java.util.TimeZone.getTimeZone("GMT"));
            // Sliding window: 100-year window centered on current year (50 years back, 50 years forward)
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.add(java.util.Calendar.YEAR, -50);
            format.set2DigitYearStart(cal.getTime());
            date = format.parse(d.substring(0, 6));
          }
          else {
            throw new RuntimeException("Unsupported Date format: " + d);
          }

          // Normalize to noon GMT (12:00:00)
          java.util.Calendar cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("GMT"));
          cal.setTime(date);
          cal.set(java.util.Calendar.HOUR_OF_DAY, 12);
          cal.set(java.util.Calendar.MINUTE, 0);
          cal.set(java.util.Calendar.SECOND, 0);
          cal.set(java.util.Calendar.MILLISECOND, 0);
          date = cal.getTime();
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
      documentation: 'Adapts various input types to Date. Delegates to parseDateString for backward compatibility.',
      code: function(o) {
        if ( ! o ) return null;
        if ( o instanceof Date ) return o;
        if ( foam.String.isInstance(o) ) {
          var parser = foam.util.DateUtil.parser_ || foam.parse.DateParser.create();
          return parser.parseDateString(o);
        }
        if ( typeof o === 'number' ) return new Date(o);
        return null;
      },
      javaCode: `
        // Backward compatibility adapter method
        if ( o == null ) return null;

        if ( o instanceof Date ) {
          // Normalize Date to noon GMT
          Date inputDate = (Date) o;
          java.util.Calendar cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("GMT"));
          cal.setTime(inputDate);
          cal.set(java.util.Calendar.HOUR_OF_DAY, 12);
          cal.set(java.util.Calendar.MINUTE, 0);
          cal.set(java.util.Calendar.SECOND, 0);
          cal.set(java.util.Calendar.MILLISECOND, 0);
          return cal.getTime();
        }

        if ( o instanceof String ) {
          try {
            return parseDateString((String) o, null);
          } catch ( RuntimeException e ) {
            // Return MAX_DATE for invalid strings instead of throwing exception
            return MAX_DATE;
          }
        }

        if ( o instanceof Number ) return new Date(((Number) o).longValue());
        return null;
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
    },
    {
      name: 'format',
      args: 'java.util.Date date, String timezone',
      type: 'String',
      documentation: 'Formats a date/datetime using locale default format in the specified timezone (or system default if not provided)',
      code: function(date, timezone) {
        // Use provided timezone or default to system timezone
        // Empty string or falsy values default to undefined (system timezone)
        var tz = timezone || undefined; // undefined means system default

        try {
          // Use toLocaleString for natural locale formatting (includes both date and time)
          var options = { timeZone: tz };
          var result = date.toLocaleString(foam.locale, options);
          return result;
        } catch (e) {
          // Invalid timezone or formatting error - return empty string
          console.warn('[DateUtil.format] Error:', e.message, 'timezone:', timezone);
          return '';
        }
      },
      javaCode: `
        // Format date in specified timezone using locale default format
        if ( date == null ) return "";

        // Use provided timezone or default to system timezone
        String tz = timezone != null ? timezone : java.util.TimeZone.getDefault().getID();

        // Use standard locale datetime format (medium style for both date and time)
        java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("MMM dd, yyyy HH:mm:ss");
        format.setTimeZone(java.util.TimeZone.getTimeZone(tz));
        return format.format(date);
      `
    },
    {
      name: 'formatWithTimeControl',
      args: 'java.util.Date date, Object timeFirst, String timezone',
      type: 'String',
      documentation: 'Formats a date in the specified timezone (or system default if not provided). timeFirst can be null/undefined (date only), true (time then date), or false (date then time)',
      code: function(date, timeFirst, timezone) {
        if ( date === undefined || date === null ) {
          return '';
        }
        if ( typeof date === 'number' ) date = new Date(date);
        if ( ! ( date instanceof Date ) || isNaN(date.getTime()) ) {
          return '';
        }

        // Use provided timezone or default to system timezone
        // Empty string or falsy values default to undefined (system timezone)
        var tz = timezone || undefined; // undefined means system default

        try {
          // Format date in specified timezone
          var dateOptions = {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            timeZone: tz
          };
          var formattedDate = date.toLocaleDateString(foam.locale, dateOptions);

          if ( timeFirst === undefined || timeFirst === null ) {
            return formattedDate;
          }

          // Format time in specified timezone
          var timeOptions = {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: tz
          };
          var formattedTime = date.toLocaleTimeString(foam.locale, timeOptions);

          var result = ( timeFirst ? formattedTime + ' ' : '' )
               + formattedDate
               + ( ! timeFirst ? ' ' + formattedTime : '' );
          return result;
        } catch (e) {
          // Invalid timezone or formatting error - return empty string
          console.warn('[DateUtil.formatWithTimeControl] Error:', e.message, 'timezone:', timezone);
          return '';
        }
      },
      javaCode: `
        // Format date in specified timezone
        if ( date == null ) return "";

        // Use provided timezone or default to system timezone
        String tz = timezone != null ? timezone : java.util.TimeZone.getDefault().getID();

        java.text.SimpleDateFormat dateFormat = new java.text.SimpleDateFormat("MMM dd, yyyy");
        dateFormat.setTimeZone(java.util.TimeZone.getTimeZone(tz));
        String formattedDate = dateFormat.format(date);

        // If timeFirst is null, return date only
        if ( timeFirst == null ) return formattedDate;

        java.text.SimpleDateFormat timeFormat = new java.text.SimpleDateFormat("HH:mm:ss");
        timeFormat.setTimeZone(java.util.TimeZone.getTimeZone(tz));
        String formattedTime = timeFormat.format(date);

        // Convert timeFirst to boolean - handles Boolean wrapper or String "true"/"false"
        boolean showTimeFirst = false;
        if ( timeFirst instanceof Boolean ) {
          showTimeFirst = ((Boolean) timeFirst).booleanValue();
        } else if ( timeFirst instanceof String ) {
          showTimeFirst = Boolean.parseBoolean((String) timeFirst);
        }

        return showTimeFirst ? formattedTime + " " + formattedDate : formattedDate + " " + formattedTime;
      `
    }
  ],

  javaCode: `
    /*
     * Generic Java datetime parsing helper used by both parseDateTime and parseDateTimeUTC
     */
    private static Date parseDateTimeWithTimezone(String d, String timeZoneId) throws ParseException {
      SimpleDateFormat format;
      Date date;

      // Check for ISO 8601 timezone suffix (Z, +HH:MM, -HH:MM, +HHMM, -HHMM)
      // If present, use it instead of the provided timeZoneId
      String actualTimeZone = timeZoneId;
      String dateTimePart = d;

      // Check for Z (UTC) suffix
      if ( d.matches(".*[0-9]Z$") ) {
        actualTimeZone = "GMT";
        dateTimePart = d.substring(0, d.length() - 1);
      }
      // Check for +HH:MM or -HH:MM format
      else if ( d.matches(".*[+-]\\\\d{2}:\\\\d{2}$") ) {
        String offset = d.substring(d.length() - 6);
        actualTimeZone = "GMT" + offset;
        dateTimePart = d.substring(0, d.length() - 6);
      }
      // Check for +HHMM or -HHMM format (no colon)
      else if ( d.matches(".*[+-]\\\\d{4}$") ) {
        String offset = d.substring(d.length() - 5);
        // Convert +HHMM to +HH:MM
        actualTimeZone = "GMT" + offset.substring(0, 3) + ":" + offset.substring(3);
        dateTimePart = d.substring(0, d.length() - 5);
      }

      // ISO 8601: YYYY-MM-DDTHH:MM:SS.SSS or YYYY-MM-DD HH:MM:SS.SSS
      if ( dateTimePart.matches("^\\\\d{4}[-/]\\\\d{2}[-/]\\\\d{2}[T ]\\\\d{2}:\\\\d{2}:\\\\d{2}(?:\\\\.\\\\d{3})?$") ) {
        String normalized = dateTimePart.replaceAll("[T ]", " ").replaceAll("[-/]", "-");
        int dotIndex = normalized.indexOf('.');

        if ( dotIndex > 0 ) {
          format = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS");
          format.setLenient(false);
          format.setTimeZone(java.util.TimeZone.getTimeZone(actualTimeZone));
          date = format.parse(normalized.substring(0, Math.min(23, normalized.length())));
        } else {
          format = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
          format.setLenient(false);
          format.setTimeZone(java.util.TimeZone.getTimeZone(actualTimeZone));
          date = format.parse(normalized.substring(0, Math.min(19, normalized.length())));
        }
      }
      // ISO 8601 short: YYYY-MM-DDTHH:MM or YYYY-MM-DD HH:MM
      else if ( dateTimePart.matches("^\\\\d{4}[-/]\\\\d{2}[-/]\\\\d{2}[T ]\\\\d{2}:\\\\d{2}$") ) {
        String normalized = dateTimePart.replaceAll("[T ]", " ").replaceAll("[-/]", "-");
        format = new SimpleDateFormat("yyyy-MM-dd HH:mm");
        format.setLenient(false);
        format.setTimeZone(java.util.TimeZone.getTimeZone(actualTimeZone));
        date = format.parse(normalized.substring(0, Math.min(16, normalized.length())));
      }
      // US format with time: MM/DD/YYYY HH:MM:SS or MM-DD-YYYY HH:MM:SS
      else if ( dateTimePart.matches("^\\\\d{2}[-/]\\\\d{2}[-/]\\\\d{4} \\\\d{2}:\\\\d{2}:\\\\d{2}$") ) {
        String normalized = dateTimePart.replaceAll("/", "-");
        format = new SimpleDateFormat("MM-dd-yyyy HH:mm:ss");
        format.setLenient(false);
        format.setTimeZone(java.util.TimeZone.getTimeZone(actualTimeZone));
        date = format.parse(normalized.substring(0, Math.min(19, normalized.length())));
      }
      // US format with time short: MM/DD/YYYY HH:MM or MM-DD-YYYY HH:MM
      else if ( dateTimePart.matches("^\\\\d{2}[-/]\\\\d{2}[-/]\\\\d{4} \\\\d{2}:\\\\d{2}$") ) {
        String normalized = dateTimePart.replaceAll("/", "-");
        format = new SimpleDateFormat("MM-dd-yyyy HH:mm");
        format.setLenient(false);
        format.setTimeZone(java.util.TimeZone.getTimeZone(actualTimeZone));
        date = format.parse(normalized.substring(0, Math.min(16, normalized.length())));
      }
      // Compact: YYYYMMDDHHMMSS
      else if ( dateTimePart.matches("^(1[9]\\\\d{2}|2\\\\d{3})\\\\d{2}\\\\d{2}\\\\d{2}\\\\d{2}\\\\d{2}$") ) {
        format = new SimpleDateFormat("yyyyMMddHHmmss");
        format.setLenient(false);
        format.setTimeZone(java.util.TimeZone.getTimeZone(actualTimeZone));
        date = format.parse(dateTimePart.substring(0, 14));
      }
      // 2-digit year format with time and seconds: YY-MM-DD HH:MM:SS or YY/MM/DD HH:MM:SS
      else if ( dateTimePart.matches("^\\\\d{2}[-/]\\\\d{2}[-/]\\\\d{2} \\\\d{2}:\\\\d{2}:\\\\d{2}$") ) {
        String normalized = dateTimePart.replaceAll("/", "-");
        // Parse with 4-digit year format to get full control over year conversion
        format = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        format.setLenient(false);
        format.setTimeZone(java.util.TimeZone.getTimeZone(actualTimeZone));
        // Extract 2-digit year and convert: 00-49 → 2000-2049, 50-99 → 1950-1999
        int yy = Integer.parseInt(normalized.substring(0, 2));
        int yyyy = yy < 50 ? 2000 + yy : 1900 + yy;
        String fullDate = yyyy + normalized.substring(2);
        date = format.parse(fullDate);
      }
      // 2-digit year format with time (no seconds): YY-MM-DD HH:MM or YY/MM/DD HH:MM
      else if ( dateTimePart.matches("^\\\\d{2}[-/]\\\\d{2}[-/]\\\\d{2} \\\\d{2}:\\\\d{2}$") ) {
        String normalized = dateTimePart.replaceAll("/", "-");
        // Parse with 4-digit year format to get full control over year conversion
        format = new SimpleDateFormat("yyyy-MM-dd HH:mm");
        format.setLenient(false);
        format.setTimeZone(java.util.TimeZone.getTimeZone(actualTimeZone));
        // Extract 2-digit year and convert: 00-49 → 2000-2049, 50-99 → 1950-1999
        int yy = Integer.parseInt(normalized.substring(0, 2));
        int yyyy = yy < 50 ? 2000 + yy : 1900 + yy;
        String fullDate = yyyy + normalized.substring(2);
        date = format.parse(fullDate);
      }
      else {
        throw new RuntimeException("Unsupported DateTime format: " + d);
      }

      return date;
    }

    /*
     * Java method overloads
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

    // Java method overload for parseDateTime (1-parameter version for backward compatibility)
    public static Date parseDateTime(String d) {
      return parseDateTime(d, null);
    }

    // Java method overload for parseDateTimeUTC (1-parameter version for backward compatibility)
    public static Date parseDateTimeUTC(String d) {
      return parseDateTimeUTC(d, null);
    }

    // Java method overload for parseDateString (1-parameter version for backward compatibility)
    public static Date parseDateString(String d) {
      return parseDateString(d, null);
    }

    // Java method overload for format (1-parameter version for backward compatibility)
    public static String format(Date date) {
      return format(date, (String) null);
    }

    // Java method overload for formatWithTimeControl (2-parameter versions for backward compatibility)
    public static String formatWithTimeControl(Date date, Object timeFirst) {
      return formatWithTimeControl(date, timeFirst, null);
    }

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
