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
    - With or without time components
    - With or without timezones

    Usage:
      Extend this class and add actions for date conversion,
      or use foam.parse.DateParser which provides the actions.
  `,

  methods: [
    function grammar(alt, anyChar, chars, literalIC, optional, range, repeat, seq, str, sym) {
      return {
        START: sym('dateOrDatetime'),

        // Main entry point - try all formats including unambiguous month names
        // NOTE: Month name formats go FIRST because they contain letters (unambiguous!)
        // Once the parser sees letters, it knows it's not a numeric format
        dateOrDatetime: alt(
          sym('datemonthname'),  // All month name formats (with or without separators)
          sym('yyyymmdd'),
          sym('mmddyyyy'),
          sym('mmddyy')
        ),

        // Date with month names - ALL completely unambiguous (contain letters!)
        // DD-MMM-YYYY, DD/MMM/YYYY, DDMMMYYYY, YYYY-DD-MMM, YYYY/DD/MMM, YYYYDDMMM
        // NOTE: yyyyddmmmcompact must come BEFORE ddmmmyyyycompact to match correctly
        datemonthname: alt(
          // Support: MMM dd yyyy (e.g., Jan 02 2025)
          sym('mmmddyyyyspace'),
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
        yyyymmddsep: alt(
          // With fractional seconds (milliseconds/microseconds) and timezone
          seq(
            sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2')
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
          sym('mmddyyyysep')
        ),

        // MMDDYYYY with separators and optional time
        // MM-DD-YYYY, MM/DD/YYYY, MM-DD-YYYY HH:MM, MM-DD-YYYY HH:MM:SS
        mmddyyyysep: alt(
          // With fractional seconds and timezone
          seq(
            sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4')
          )
        ),

        // MMDDYYYY compact: 8 digits (that don't match YYYY 1900-2999 pattern) with optional space-separated time
        mmddyyyycompact: alt(
          // With space and compact time (HHMMSS - no colons)
          seq(
            str(repeat(range('0', '9'), null, 8, 8)),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          // With space and time with colons
          seq(
            str(repeat(range('0', '9'), null, 8, 8)),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          // Date only
          str(repeat(range('0', '9'), null, 8, 8))
        ),

        // YYMMDD - tries all variants (compact, separated)
        // Covers: YYMMDD, YY-MM-DD, YY/MM/DD with optional time
        yymmdd: alt(
          sym('yymmddcompact'),
          sym('yymmddsep')
        ),

        // YYMMDD with separators and optional time
        // YY-MM-DD, YY/MM/DD, YY-MM-DD HH:MM, YY-MM-DD HH:MM:SS with optional timezone
        yymmddsep: alt(
          // With fractional seconds and timezone
          seq(
            sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2')
          )
        ),

        // YYMMDD compact: 6 digits
        yymmddcompact: str(repeat(range('0', '9'), null, 6, 6)),

        // MMDDYY - tries all variants (compact, separated)
        // Covers: MMDDYY, MM-DD-YY, MM/DD/YY with optional time
        mmddyy: alt(
          sym('mmddyycompact'),
          sym('mmddyysep')
        ),

        // MMDDYY with separators and optional time (2-digit year)
        // MM-DD-YY, MM/DD/YY, MM-DD-YY HH:MM, MM-DD-YY HH:MM:SS
        // MM-DD-YYTHH:MM:SS+TZ (with T separator and timezone)
        mmddyysep: alt(
          // With fractional seconds and timezone
          seq(
            sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year2')
          )
        ),

        // MMDDYY compact: 6 digits
        mmddyycompact: str(repeat(range('0', '9'), null, 6, 6)),

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
        ddmmyyyysep: alt(
          // With fractional seconds and timezone
          seq(
            sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4')
          )
        ),

        // DDMMYYYY compact: 8 digits (that don't match YYYY 1900-2999 pattern) with optional space-separated time
        ddmmyyyycompact: alt(
          // With space and compact time (HHMMSS - no colons)
          seq(
            str(repeat(range('0', '9'), null, 8, 8)),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          // With space and time with colons
          seq(
            str(repeat(range('0', '9'), null, 8, 8)),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          // Date only
          str(repeat(range('0', '9'), null, 8, 8))
        ),

        // DDMMYY with separators and optional time (2-digit year)
        // DD-MM-YY, DD/MM/YY, DD-MM-YY HH:MM, DD-MM-YY HH:MM:SS
        // DD-MM-YYTHH:MM:SS+TZ (with T separator and timezone)
        ddmmyysep: alt(
          // With fractional seconds and timezone
          seq(
            sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2')
          )
        ),

        // DDMMYY compact: 6 digits
        ddmmyycompact: str(repeat(range('0', '9'), null, 6, 6)),

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
        yyyyddmmsep: alt(
          // With fractional seconds and timezone
          seq(
            sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2')
          )
        ),

        // YYYYDDMM compact: 8 digits with optional space-separated time
        yyyyddmmcompact: alt(
          // With space and compact time (HHMMSS - no colons)
          seq(
            str(repeat(range('0', '9'), null, 8, 8)),
            sym('datetimesep'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),
          // With space and time with colons
          seq(
            str(repeat(range('0', '9'), null, 8, 8)),
            sym('datetimesep'),
            sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
            optional(sym('timezone'))
          ),
          // Date only
          str(repeat(range('0', '9'), null, 8, 8))
        ),

        // YYDDMM - 2-digit year, day, month (6 digits)
        yyddmm: alt(
          sym('yyddmmcompact'),
          sym('yyddmmsep')
        ),

        // YYDDMM with separators and optional time
        // YY-DD-MM, YY/DD/MM, YY-DD-MM HH:MM, YY-DD-MM HH:MM:SS
        // YY-DD-MMTHH:MM:SS+TZ (with T separator and timezone)
        yyddmmsep: alt(
          // With fractional seconds and timezone
          seq(
            sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
            optional(sym('timezone'))
          ),
          // With seconds and timezone
          seq(
            sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
            optional(sym('timezone'))
          ),
          // With minutes and timezone
          seq(
            sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
            sym('datetimesep'), sym('hour2'), ':', sym('minute2'),
            optional(sym('timezone'))
          ),
          // Date only
          seq(
            sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2')
          )
        ),

        // YYDDMM compact: 6 digits
        yyddmmcompact: str(repeat(range('0', '9'), null, 6, 6)),

        // YYYYDDMMM with separators: YYYY-DD-MMM, YYYY/DD/MMM
        yyyyddmmmsep: seq(
          sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month3alpha')
        ),

        // YYYYDDMMM compact: YYYYDDMMM (no separators, like 202531JAN)
        yyyyddmmmcompact: seq(
          sym('year4'), sym('day2'), sym('month3alpha')
        ),

        // DDMMMYYYY with separators: DD-MMM-YYYY, DD/MMM/YYYY
        ddmmmyyyysep: seq(
          sym('day2'), chars('-/'), sym('month3alpha'), chars('-/'), sym('year4')
        ),

        // DDMMMYYYY compact: DDMMMYYYY (no separators, like 31JAN2025)
        ddmmmyyyycompact: seq(
          sym('day2'), sym('month3alpha'), sym('year4')
        ),

        // MMM dd yyyy with spaces: "Jan 02 2025"
        mmmddyyyyspace: seq(
          sym('month3alpha'), ' ', sym('day2'), ' ', sym('year4')
        ),

        // Component parsers
        year4: str(repeat(range('0', '9'), null, 4, 4)),  // Exactly 4 digits
        year4_1900_2999: str(alt(
          seq('1', '9', range('0', '9'), range('0', '9')),
          seq('2', range('0', '9'), range('0', '9'), range('0', '9'))
        )),
        year2: str(seq(range('0', '9'), range('0', '9'))),
        month2: str(seq(range('0', '1'), range('0', '9'))),
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
        day2: str(seq(range('0', '3'), range('0', '9'))),
        hour2: str(seq(range('0', '2'), range('0', '9'))),
        minute2: str(seq(range('0', '5'), range('0', '9'))),
        second2: str(seq(range('0', '5'), range('0', '9'))),
        fractionalSeconds: str(repeat(range('0', '9'), null, 1, 6))  // 1-6 digits for milliseconds or microseconds
      };
    }
  ]
});
