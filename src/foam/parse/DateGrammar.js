/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'DateGrammar',
  extends: 'foam.parse.Grammar',

  documentation: `
    Grammar definitions for parsing date and datetime strings.
    Supports all common date formats including:
    - YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD
    - MM-DD-YYYY, MM/DD/YYYY, MMDDYYYY
    - DD-MM-YYYY, DD/MM/YYYY, DDMMYYYY
    - Month name formats (DD-MMM-YYYY, MMM dd YYYY, etc.)
    - Unix/Java Date.toString() format (DDD MMM DD HH:MM:SS TZ YYYY)
    - With or without time components
    - With or without timezones

    Usage:
      Extend this class and add actions for date conversion,
      or use foam.parse.DateParser which provides the actions.
  `,

  methods: [
    function grammar(alt, anyChar, chars, literalIC, notChars, optional, range, repeat, seq, str, sym) {
      return {
        START: sym('dateOrDatetime'),

        // Main entry point - try all formats including unambiguous month names
        // NOTE: Month name formats go FIRST because they contain letters (unambiguous!)
        // Once the parser sees letters, it knows it's not a numeric format
        // Timestamps (10-13 digits) go LAST to avoid matching date formats like YYYYMMDDHH
        dateOrDatetime: alt(
          sym('datemonthname'),  // All month name formats (with or without separators)
          sym('yyyymmdd'),
          sym('mmddyyyy'),
          sym('mmddyy'),
          sym('timestamp')       // Unix/JS timestamps (10-13 digits, must not match date formats)
        ),

        // Julian date formats (YYDDD and YDDD) - day-of-year formats
        // These are NOT in main dateOrDatetime to avoid ambiguity with other formats.
        // Use opt_name='juliandate' for auto-detection, or 'yyddd'/'yddd' for explicit format.
        //
        // Combined Julian date parser - tries YYDDD first (5 digits), then YDDD (4 digits)
        // Use this in mapping configurations: opt_name='juliandate'
        juliandate: alt(
          sym('yyddd'),   // Try 5-digit format first (more specific)
          sym('yddd')     // Fall back to 4-digit format
        ),

        // YYDDD format: 5-digit Julian date (2-digit year + 3-digit day of year)
        // e.g., "25216" = Year 2025, Day 216 = August 4, 2025
        // Year cutoff: 00-49 = 2000-2049, 50-99 = 1950-1999
        yyddd: str(seq(
          sym('year2'),                                    // YY: 2-digit year (00-99)
          sym('dayOfYear')                                 // DDD: day of year (001-366)
        )),

        // YDDD format: 4-digit Julian date (1-digit year + 3-digit day of year)
        // e.g., "5216" = Year 2025, Day 216 = August 4, 2025
        // Year mapping: Sliding window based on current year (decade + digit, with 5-year future limit)
        yddd: str(seq(
          range('0', '9'),                                 // Y: 1-digit year (sliding window)
          sym('dayOfYear')                                 // DDD: day of year (001-366)
        )),

        // Day of year (001-366) - used for Julian date formats
        // Wrapped in str() to ensure it returns a string, not an array
        dayOfYear: str(alt(
          seq('3', '6', range('0', '6')),                  // 360-366
          seq('3', range('0', '5'), range('0', '9')),      // 300-359
          seq(range('1', '2'), range('0', '9'), range('0', '9')),  // 100-299
          seq('0', range('0', '9'), range('0', '9'))       // 000-099
        )),

        // Unix timestamp (10 digits, seconds) or JavaScript timestamp (13 digits, milliseconds)
        // Placed LAST in dateOrDatetime to avoid matching date formats like YYYYMMDDHH
        // Note: 10-digit timestamps will only match if they don't match any other format
        timestamp: alt(
          sym('timestamp13'),  // 13-digit JavaScript millisecond timestamp (always safe)
          sym('timestamp10')   // 10-digit Unix second timestamp (checked after date formats fail)
        ),
        timestamp13: str(repeat(range('0', '9'), null, 13, 13)),
        timestamp10: str(repeat(range('0', '9'), null, 10, 10)),

        // Date with month names - ALL completely unambiguous (contain letters!)
        // DD-MMM-YYYY, DD/MMM/YYYY, DDMMMYYYY, YYYY-DD-MMM, YYYY/DD/MMM, YYYYDDMMM
        // DD MMM YYYY (with spaces)
        // Unix/Java Date.toString() format: DDD MMM DD HH:MM:SS TZ YYYY
        // NOTE: yyyyddmmmcompact must come BEFORE ddmmmyyyycompact to match correctly
        // NOTE: jsdatetostring must come FIRST (year before time), then unixdatetostring
        datemonthname: alt(
          // Support: DDD MMM DD YYYY HH:MM:SS GMT±HHMM (Timezone Name) (e.g., "Thu Feb 19 2026 16:20:23 GMT-0400 (Atlantic Standard Time)")
          sym('jsdatetostring'),
          // Support: DDD MMM DD HH:MM:SS TZ YYYY (e.g., "Tue Apr 01 05:17:59 GMT 2025")
          sym('unixdatetostring'),
          // Support: MMM dd yyyy (e.g., Jan 02 2025)
          sym('mmmddyyyyspace'),
          // Support: DD MMM YYYY (e.g., 15 JAN 2025)
          sym('ddmmmyyyyspace'),
          sym('ddmmmyyyysep'),
          sym('yyyyddmmmsep'),
          sym('yyyyddmmmcompact'),  // Try this before ddmmmyyyycompact
          sym('ddmmmyyyycompact')
        ),

        // YYYYMMDD - tries all variants (compact with time, compact, separated)
        // Covers: YYYYMMDDHHMMSS, YYYYMMDD, YYYY-MM-DD, YYYY/MM/DD with optional time
        yyyymmdd: alt(
          sym('yyyymmddhhmmsscompact'),
          sym('yyyymmddcompact'),
          sym('yyyymmddsep')
        ),

        // Datetime separator: T or space
        datetimesep: chars('T '),

        // Timezone format: Z or +/-HH:MM or +/-HHMM
        timezone: alt(
          'Z',
          // +HH:MM format
          seq(
            chars('+-'),
            repeat(range('0', '9'), null, 2, 2),
            ':',
            repeat(range('0', '9'), null, 2, 2)
          ),
          // +HHMM format (no colon)
          seq(
            chars('+-'),
            repeat(range('0', '9'), null, 4, 4)
          ),
          // +HH format (hours only)
          seq(
            chars('+-'),
            repeat(range('0', '9'), null, 2, 2)
          )
        ),

        // YYYYMMDD with separators and optional time
        // YYYY-MM-DD, YYYY/MM/DD, YYYY-MM-DDTHH:MM, YYYY-MM-DDTHH:MM:SS, YYYY-MM-DDTHH:MM:SS.sss
        // Supports single-digit months and days (e.g., 2025-1-5)
        yyyymmddsep: alt(
          // With fractional seconds (milliseconds/microseconds) and timezone
          seq(
            sym('year4'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('dayFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('year4'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('dayFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('year4'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('dayFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('year4'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('dayFlexible')
          )
        ),

        // YYYYMMDD compact: 8 digits (year 1900-2999) with optional space-separated time
        yyyymmddcompact: alt(
          // With space and compact time (HHMMSS - no colons)
          seq(
            str(seq(sym('year4_1900_2999'), sym('month2'), sym('day2'))),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          // With space and time with colons
          seq(
            str(seq(sym('year4_1900_2999'), sym('month2'), sym('day2'))),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          // Date only
          str(seq(sym('year4_1900_2999'), sym('month2'), sym('day2')))
        ),

        // YYYYMMDDHHMMSS compact: 14 digits
        yyyymmddhhmmsscompact: seq(
          sym('year4_1900_2999'), sym('month2'), sym('day2'),
          sym('hour2'), sym('minute2'), sym('second2')
        ),

        // MMDDYYYY - tries all variants (compact, separated)
        // Covers: MMDDYYYY, MM-DD-YYYY, MM/DD/YYYY with optional time
        mmddyyyy: alt(
          sym('mmddyyyycompact'),
          sym('mmddyyyysep'),
          sym('mmddyysep'),
          sym('mmddyycompact')
        ),

        // MMDDYYYY with separators and optional time
        // MM-DD-YYYY, MM/DD/YYYY, MM-DD-YYYY HH:MM, MM-DD-YYYY HH:MM:SS
        // Fix: Changed month2/day2 to monthFlexible/dayFlexible to support 7/2/2025
        mmddyyyysep: alt(
          // With fractional seconds and timezone
          seq(
            sym('monthFlexible'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('monthFlexible'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('monthFlexible'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('monthFlexible'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('year4')
          )
        ),

        // MMDDYYYY compact: 8 digits with validated month (01-12), day (01-31), year (1900-2999)
        // Uses year4_1900_2999 to prevent matching invalid years like 5033 in filenames
        mmddyyyycompact: alt(
          // With space and compact time (HHMMSS - no colons)
          seq(
            str(seq(sym('month2'), sym('day2'), sym('year4_1900_2999'))),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          // With space and time with colons
          seq(
            str(seq(sym('month2'), sym('day2'), sym('year4_1900_2999'))),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          // Date only
          str(seq(sym('month2'), sym('day2'), sym('year4_1900_2999')))
        ),

        // YYMMDD - tries all variants (compact, separated)
        // Covers: YYMMDD, YY-MM-DD, YY/MM/DD with optional time
        yymmdd: alt(
          sym('yymmddcompact'),
          sym('yymmddsep')
        ),

        // YYMMDD with separators and optional time
        // YY-MM-DD, YY/MM/DD, YY-MM-DD HH:MM, YY-MM-DD HH:MM:SS with optional timezone
        // Supports single-digit months and days (e.g., 25-1-5)
        yymmddsep: alt(
          // With fractional seconds and timezone
          seq(
            sym('year2'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('dayFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('year2'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('dayFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('year2'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('dayFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('year2'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('dayFlexible')
          )
        ),

        // YYMMDD compact: 6 digits with validated year, month (01-12), day (01-31)
        // Supports optional time: YYMMDD HHMMSS, YYMMDD HH:MM:SS, or YYMMDD (date only)
        yymmddcompact: alt(
          seq(
            str(seq(sym('year2'), sym('month2'), sym('day2'))),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          seq(
            str(seq(sym('year2'), sym('month2'), sym('day2'))),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          str(seq(sym('year2'), sym('month2'), sym('day2')))
        ),

        // MMDDYY - tries all variants (compact, separated)
        // Covers: MMDDYY, MM-DD-YY, MM/DD/YY with optional time
        mmddyy: alt(
          sym('mmddyycompact'),
          sym('mmddyysep')
        ),

        // MMDDYY with separators and optional time (2-digit year)
        // MM-DD-YY, MM/DD/YY, MM-DD-YY HH:MM, MM-DD-YY HH:MM:SS
        // Fix: Changed month2/day2 to monthFlexible/dayFlexible to support 7/2/25
        mmddyysep: alt(
          // With fractional seconds and timezone
          seq(
            sym('monthFlexible'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('monthFlexible'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('monthFlexible'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('monthFlexible'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('year2')
          )
        ),

        // MMDDYY compact: 6 digits with validated month (01-12), day (01-31), year
        // Supports optional time: MMDDYY HHMMSS, MMDDYY HH:MM:SS, or MMDDYY (date only)
        mmddyycompact: alt(
          seq(
            str(seq(sym('month2'), sym('day2'), sym('year2'))),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          seq(
            str(seq(sym('month2'), sym('day2'), sym('year2'))),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          str(seq(sym('month2'), sym('day2'), sym('year2')))
        ),

        // DDMMYYYY - NOT in main dateOrDatetime, accessible via opt_name only
        // Covers: DD-MM-YYYY, DD/MM/YYYY, DDMMYYYY, DD-MM-YY, DD/MM/YY, DDMMYY with optional time
        // NUMERIC dates only (month names are handled in STANDARD format via datemonthname)
        ddmmyyyy: alt(
          sym('ddmmyyyysep'),
          sym('ddmmyysep'),
          sym('ddmmyyyycompact'),
          sym('ddmmyycompact')
        ),

        // DDMMYYYY with separators and optional time
        // DD-MM-YYYY, DD/MM/YYYY, DD-MM-YYYY HH:MM, DD-MM-YYYY HH:MM:SS
        // DD-MM-YYYYTHH:MM:SS+TZ (with T separator and timezone)
        // Supports single-digit days and months (e.g., 5-1-2025)
        ddmmyyyysep: alt(
          // With fractional seconds and timezone
          seq(
            sym('dayFlexible'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('dayFlexible'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('dayFlexible'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('dayFlexible'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('year4')
          )
        ),

        // DDMMYYYY compact: 8 digits with validated day (01-31), month (01-12), year (1900-2999)
        // Uses year4_1900_2999 to prevent matching invalid years like 5033 in filenames
        ddmmyyyycompact: alt(
          // With space and compact time (HHMMSS - no colons)
          seq(
            str(seq(sym('day2'), sym('month2'), sym('year4_1900_2999'))),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          // With space and time with colons
          seq(
            str(seq(sym('day2'), sym('month2'), sym('year4_1900_2999'))),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          // Date only
          str(seq(sym('day2'), sym('month2'), sym('year4_1900_2999')))
        ),

        // DDMMYY with separators and optional time (2-digit year)
        // DD-MM-YY, DD/MM/YY, DD-MM-YY HH:MM, DD-MM-YY HH:MM:SS
        // DD-MM-YYTHH:MM:SS+TZ (with T separator and timezone)
        // Supports single-digit days and months (e.g., 5-1-25)
        ddmmyysep: alt(
          // With fractional seconds and timezone
          seq(
            sym('dayFlexible'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('dayFlexible'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('dayFlexible'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('dayFlexible'), chars('-/'), sym('monthFlexible'), chars('-/'), sym('year2')
          )
        ),

        // DDMMYY compact: 6 digits with validated day (01-31), month (01-12), year
        // Supports optional time: DDMMYY HHMMSS, DDMMYY HH:MM:SS, or DDMMYY (date only)
        ddmmyycompact: alt(
          // With space/T and compact time (HHMMSS - no colons)
          seq(
            str(seq(sym('day2'), sym('month2'), sym('year2'))),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          // With space/T and colon time (HH:MM:SS)
          seq(
            str(seq(sym('day2'), sym('month2'), sym('year2'))),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          // Date only
          str(seq(sym('day2'), sym('month2'), sym('year2')))
        ),

        // YYYYDDMM - NOT in main dateOrDatetime, accessible via opt_name only
        // Covers: YYYY-DD-MM, YYYY/DD/MM, YYYYDDMM, YY-DD-MM, YY/DD/MM, YYDDMM with optional time
        // NUMERIC dates only (month names are handled in STANDARD format via datemonthname)
        yyyyddmm: alt(
          sym('yyyyddmmcompact'),
          sym('yyyyddmmsep'),
          sym('yyddmm')
        ),

        // YYYYDDMM with separators and optional time
        // YYYY-DD-MM, YYYY/DD/MM, YYYY-DD-MM HH:MM, YYYY-DD-MM HH:MM:SS
        // YYYY-DD-MMTHH:MM:SS+TZ (with T separator and timezone)
        // Supports single-digit days and months (e.g., 2025-5-1)
        yyyyddmmsep: alt(
          // With fractional seconds and timezone
          seq(
            sym('year4'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('monthFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('year4'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('monthFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('year4'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('monthFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('year4'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('monthFlexible')
          )
        ),

        // YYYYDDMM compact: 8 digits with validated year (1900-2999), day (01-31), month (01-12)
        // Uses year4_1900_2999 to prevent matching invalid years in filenames
        yyyyddmmcompact: alt(
          // With space and compact time (HHMMSS - no colons)
          seq(
            str(seq(sym('year4_1900_2999'), sym('day2'), sym('month2'))),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          // With space and time with colons
          seq(
            str(seq(sym('year4_1900_2999'), sym('day2'), sym('month2'))),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          // Date only
          str(seq(sym('year4_1900_2999'), sym('day2'), sym('month2')))
        ),

        // YYDDMM - 2-digit year, day, month (6 digits)
        yyddmm: alt(
          sym('yyddmmcompact'),
          sym('yyddmmsep')
        ),

        // YYDDMM with separators and optional time
        // YY-DD-MM, YY/DD/MM, YY-DD-MM HH:MM, YY-DD-MM HH:MM:SS
        // YY-DD-MMTHH:MM:SS+TZ (with T separator and timezone)
        // Supports single-digit days and months (e.g., 25-5-1)
        yyddmmsep: alt(
          // With fractional seconds and timezone
          seq(
            sym('year2'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('monthFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('year2'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('monthFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('year2'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('monthFlexible'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('year2'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('monthFlexible')
          )
        ),

        // YYDDMM compact: 6 digits with validated year, day (01-31), month (01-12)
        // Supports optional time: YYDDMM HHMMSS, YYDDMM HH:MM:SS, or YYDDMM (date only)
        yyddmmcompact: alt(
          seq(
            str(seq(sym('year2'), sym('day2'), sym('month2'))),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          seq(
            str(seq(sym('year2'), sym('day2'), sym('month2'))),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          str(seq(sym('year2'), sym('day2'), sym('month2')))
        ),

        // YYYYDDMMM with separators: YYYY-DD-MMM, YYYY/DD/MMM
        // Supports single-digit days (e.g., 2025-5-JAN)
        yyyyddmmmsep: seq(
          sym('year4'), chars('-/'), sym('dayFlexible'), chars('-/'), sym('month3alpha')
        ),

        // YYYYDDMMM compact: YYYYDDMMM (no separators, like 202531JAN)
        yyyyddmmmcompact: seq(
          sym('year4'), sym('day2'), sym('month3alpha')
        ),

        // DDMMMYYYY with separators: DD-MMM-YYYY, DD/MMM/YYYY
        // Supports single-digit days (e.g., 5-JAN-2025)
        ddmmmyyyysep: seq(
          sym('dayFlexible'), chars('-/'), sym('month3alpha'), chars('-/'), sym('year4')
        ),

        // DDMMMYYYY compact: DDMMMYYYY (no separators, like 31JAN2025)
        ddmmmyyyycompact: seq(
          sym('day2'), sym('month3alpha'), sym('year4')
        ),

        // MMM dd yyyy with spaces: "Jan 02 2025" or "Jan 2 2025"
        // Supports single-digit days
        mmmddyyyyspace: seq(
          sym('month3alpha'), ' ', sym('dayFlexible'), ' ', sym('year4')
        ),

        // DD MMM YYYY with spaces: "15 JAN 2025" or "5 JAN 2025"
        // Supports single-digit days
        ddmmmyyyyspace: seq(
          sym('dayFlexible'), ' ', sym('month3alpha'), ' ', sym('year4')
        ),

        // JavaScript Date.toString() format: DDD MMM DD YYYY HH:MM:SS GMT±HHMM (Timezone Name)
        // e.g., "Thu Feb 19 2026 16:20:23 GMT-0400 (Atlantic Standard Time)"
        // The day name (Mon, Tue, etc.) is parsed but ignored for date construction
        // Year comes BEFORE time (unlike Unix format), timezone is GMT fused with offset
        jsdatetostring: seq(
          sym('day3alpha'), ' ',      // Day name (ignored)
          sym('month3alpha'), ' ',    // Month name
          sym('dayFlexible'), ' ',    // Day of month (1-31 or 01-31)
          sym('year4'), ' ',          // Year
          sym('hour2'), ':', sym('minute2'), ':', sym('second2'), ' ',  // Time HH:MM:SS
          sym('jsTimezone'),          // Timezone (GMT or GMT±HHMM)
          optional(seq(' ', '(', str(repeat(notChars(')'), null, 1)), ')'))  // Optional (Timezone Name)
        ),

        // JS timezone format: GMT optionally followed by ±HHMM offset
        jsTimezone: seq(
          literalIC('GMT'),
          optional(seq(chars('+-'), repeat(range('0', '9'), null, 4, 4)))
        ),

        // Unix/Java Date.toString() format: DDD MMM DD HH:MM:SS TZ YYYY
        // e.g., "Tue Apr 01 05:17:59 GMT 2025"
        // The day name (Mon, Tue, etc.) is parsed but ignored for date construction
        unixdatetostring: seq(
          sym('day3alpha'), ' ',      // Day name (ignored)
          sym('month3alpha'), ' ',    // Month name
          sym('dayFlexible'), ' ',    // Day of month (1-31 or 01-31)
          sym('hour2'), ':', sym('minute2'), ':', sym('second2'), ' ',  // Time HH:MM:SS
          sym('unixTimezone'), ' ',   // Timezone (GMT, UTC, or +/-offset)
          sym('year4')                // Year
        ),

        // 3-letter day name (case insensitive): Mon, Tue, Wed, Thu, Fri, Sat, Sun
        day3alpha: alt(
          literalIC('MON'),
          literalIC('TUE'),
          literalIC('WED'),
          literalIC('THU'),
          literalIC('FRI'),
          literalIC('SAT'),
          literalIC('SUN')
        ),

        // Unix timezone format: GMT, UTC, or +/-HHMM
        unixTimezone: alt(
          literalIC('GMT'),
          literalIC('UTC'),
          // +HHMM or -HHMM format
          seq(
            chars('+-'),
            repeat(range('0', '9'), null, 4, 4)
          ),
          // +HH:MM or -HH:MM format
          seq(
            chars('+-'),
            repeat(range('0', '9'), null, 2, 2),
            ':',
            repeat(range('0', '9'), null, 2, 2)
          )
        ),

        // Component parsers
        year4: str(repeat(range('0', '9'), null, 4, 4)),  // Exactly 4 digits
        year4_1900_2999: str(alt(
          seq('1', '9', range('0', '9'), range('0', '9')),
          seq('2', range('0', '9'), range('0', '9'), range('0', '9'))
        )),
        year2: str(seq(range('0', '9'), range('0', '9'))),
        // Month (01-12) for compact formats - strict validation to prevent timestamp mismatches
        month2: str(alt(
          seq('0', range('1', '9')),      // 01-09
          seq('1', range('0', '2'))       // 10-12
        )),

        // Flexible parsers to support single digits (e.g. 7/2/2025) in formats with separators
        // Allows slightly out-of-range values for JavaScript Date normalization:
        // - Month 0 → December of previous year, Month 13 → January of next year
        // - Day 0 → last day of previous month, Day 32 → normalized to next month
        // But rejects obviously invalid values like 99
        monthFlexible: alt(
          str(seq('1', range('0', '9'))),      // 10-19 (allows 13 for normalization)
          str(seq('0', range('0', '9'))),      // 00-09
          range('0', '9')                       // 0-9 (single digit)
        ),
        // Day: 0-39 range to allow normalization (e.g., Feb 30 → Mar 2)
        dayFlexible: alt(
          str(seq('3', range('0', '9'))),      // 30-39
          str(seq(range('0', '2'), range('0', '9'))), // 00-29
          range('0', '9')                       // 0-9 (single digit)
        ),

        month3alpha: alt(
          literalIC('JAN'),
          literalIC('FEB'),
          literalIC('MAR'),
          literalIC('APR'),
          literalIC('MAY'),
          literalIC('JUN'),
          literalIC('JUL'),
          literalIC('AUG'),
          literalIC('SEP'),
          literalIC('OCT'),
          literalIC('NOV'),
          literalIC('DEC')
        ),
        // Day (01-31) for compact formats - strict validation to prevent timestamp mismatches
        day2: str(alt(
          seq('0', range('1', '9')),           // 01-09
          seq(range('1', '2'), range('0', '9')), // 10-29
          seq('3', range('0', '1'))            // 30-31
        )),
        hour2: str(seq(range('0', '2'), range('0', '9'))),
        minute2: str(seq(range('0', '5'), range('0', '9'))),
        second2: str(seq(range('0', '5'), range('0', '9'))),
        fractionalSeconds: str(repeat(range('0', '9'), null, 1, 6))  // 1-6 digits for milliseconds or microseconds
      };
    }
  ]
});
