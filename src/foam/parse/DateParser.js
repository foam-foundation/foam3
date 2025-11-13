/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'DateParser',

  extends: 'foam.parse.AbstractParser',
  
  documentation: `
    Comprehensive date and datetime parser that handles all formats from DateUtil.js.
    Uses FOAM parser framework with alt() to support all date/datetime formats in a single parser.
    Supports both date-only and datetime formats.

    Usage:
      var parser = foam.parse.DateParser.create();
      var date = parser.parseString('2025-01-15');
      var datetime = parser.parseString('2025-01-15T14:30:45');
  `,

  requires: [
    'foam.parse.Grammar',
    'foam.parse.Parsers'
  ],

  constants: {
    INVALID_DATE: new Date(NaN)
  },

  properties: [
    {
      name: 'baseGrammar_',
      value: function(alt, anyChar, chars, literalIC, optional, range, repeat, seq, str, sym) {
        return {
          START: sym('dateOrDatetime'),

          // Main entry point - try all formats including unambiguous month names
          // NOTE: Month name formats go FIRST because they contain letters (unambiguous!)
          // Once the parser sees letters, it knows it's not a numeric format
          dateOrDatetime: alt(
            sym('date-monthname'),  // All month name formats (with or without separators)
            sym('yyyymmdd'),
            sym('mmddyyyy'),
            sym('yymmdd')
          ),

          // Date with month names - ALL completely unambiguous (contain letters!)
          // DD-MMM-YYYY, DD/MMM/YYYY, DDMMMYYYY, YYYY-DD-MMM, YYYY/DD/MMM, YYYYDDMMM
          // NOTE: yyyyddmmm-compact must come BEFORE ddmmmyyyy-compact to match correctly
          'date-monthname': alt(
            // Support: MMM dd yyyy (e.g., Jan 02 2025)
            sym('mmmddyyyy-space'),
            sym('ddmmmyyyy-sep'),
            sym('yyyyddmmm-sep'),
            sym('yyyyddmmm-compact'),  // Try this before ddmmmyyyy-compact
            sym('ddmmmyyyy-compact')
          ),

          // YYYYMMDD - tries all variants (compact with time, compact, separated)
          // Covers: YYYYMMDDHHMMSS, YYYYMMDD, YYYY-MM-DD, YYYY/MM/DD with optional time
          yyyymmdd: alt(
            sym('yyyymmddhhmmss-compact'),
            sym('yyyymmdd-compact'),
            sym('yyyymmdd-sep')
          ),

          // Datetime separator: T or space
          'datetime-sep': chars('T '),

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
          'yyyymmdd-sep': alt(
            // With fractional seconds (milliseconds/microseconds) and timezone
            seq(
              sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
              optional(sym('timezone'))
            ),
            // With seconds and timezone
            seq(
              sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2')
            )
          ),

          // YYYYMMDD compact: 8 digits (year 1900-2999) with optional space-separated time
          'yyyymmdd-compact': alt(
            // With space and compact time (HHMMSS - no colons)
            seq(
              str(seq(sym('year4_1900_2999'), sym('month2'), sym('day2'))),
              sym('datetime-sep'),
              sym('hour2'), sym('minute2'), sym('second2')
            ),
            // With space and time with colons
            seq(
              str(seq(sym('year4_1900_2999'), sym('month2'), sym('day2'))),
              sym('datetime-sep'),
              sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
              optional(sym('timezone'))
            ),
            // Date only
            str(seq(sym('year4_1900_2999'), sym('month2'), sym('day2')))
          ),

          // YYYYMMDDHHMMSS compact: 14 digits
          'yyyymmddhhmmss-compact': seq(
            sym('year4_1900_2999'), sym('month2'), sym('day2'),
            sym('hour2'), sym('minute2'), sym('second2')
          ),

          // MMDDYYYY - tries all variants (compact, separated)
          // Covers: MMDDYYYY, MM-DD-YYYY, MM/DD/YYYY with optional time
          mmddyyyy: alt(
            sym('mmddyyyy-compact'),
            sym('mmddyyyy-sep')
          ),

          // MMDDYYYY with separators and optional time
          // MM-DD-YYYY, MM/DD/YYYY, MM-DD-YYYY HH:MM, MM-DD-YYYY HH:MM:SS
          'mmddyyyy-sep': alt(
            // With fractional seconds and timezone
            seq(
              sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
              optional(sym('timezone'))
            ),
            // With seconds and timezone
            seq(
              sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4')
            )
          ),

          // MMDDYYYY compact: 8 digits (that don't match YYYY 1900-2999 pattern) with optional space-separated time
          'mmddyyyy-compact': alt(
            // With space and compact time (HHMMSS - no colons)
            seq(
              str(repeat(range('0', '9'), null, 8, 8)),
              sym('datetime-sep'),
              sym('hour2'), sym('minute2'), sym('second2')
            ),
            // With space and time with colons
            seq(
              str(repeat(range('0', '9'), null, 8, 8)),
              sym('datetime-sep'),
              sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
              optional(sym('timezone'))
            ),
            // Date only
            str(repeat(range('0', '9'), null, 8, 8))
          ),

          // YYMMDD - tries all variants (compact, separated)
          // Covers: YYMMDD, YY-MM-DD, YY/MM/DD with optional time
          yymmdd: alt(
            sym('yymmdd-compact'),
            sym('yymmdd-sep')
          ),

          // YYMMDD with separators and optional time
          // YY-MM-DD, YY/MM/DD, YY-MM-DD HH:MM, YY-MM-DD HH:MM:SS with optional timezone
          'yymmdd-sep': alt(
            // With fractional seconds and timezone
            seq(
              sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
              optional(sym('timezone'))
            ),
            // With seconds and timezone
            seq(
              sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2')
            )
          ),

          // YYMMDD compact: 6 digits
          'yymmdd-compact': str(repeat(range('0', '9'), null, 6, 6)),

          // DDMMYYYY - NOT in main dateOrDatetime, accessible via opt_name only
          // Covers: DD-MM-YYYY, DD/MM/YYYY, DDMMYYYY, DD-MM-YY, DD/MM/YY, DDMMYY with optional time
          // NUMERIC dates only (month names are handled in STANDARD format via date-monthname)
          ddmmyyyy: alt(
            sym('ddmmyyyy-sep'),
            sym('ddmmyy-sep'),
            sym('ddmmyyyy-compact'),
            sym('ddmmyy-compact')
          ),

          // DDMMYYYY with separators and optional time
          // DD-MM-YYYY, DD/MM/YYYY, DD-MM-YYYY HH:MM, DD-MM-YYYY HH:MM:SS
          // DD-MM-YYYYTHH:MM:SS+TZ (with T separator and timezone)
          'ddmmyyyy-sep': alt(
            // With fractional seconds and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
              optional(sym('timezone'))
            ),
            // With seconds and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4')
            )
          ),

          // DDMMYYYY compact: 8 digits (that don't match YYYY 1900-2999 pattern) with optional space-separated time
          'ddmmyyyy-compact': alt(
            // With space and compact time (HHMMSS - no colons)
            seq(
              str(repeat(range('0', '9'), null, 8, 8)),
              sym('datetime-sep'),
              sym('hour2'), sym('minute2'), sym('second2')
            ),
            // With space and time with colons
            seq(
              str(repeat(range('0', '9'), null, 8, 8)),
              sym('datetime-sep'),
              sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
              optional(sym('timezone'))
            ),
            // Date only
            str(repeat(range('0', '9'), null, 8, 8))
          ),

          // DDMMYY with separators and optional time (2-digit year)
          // DD-MM-YY, DD/MM/YY, DD-MM-YY HH:MM, DD-MM-YY HH:MM:SS
          // DD-MM-YYTHH:MM:SS+TZ (with T separator and timezone)
          'ddmmyy-sep': alt(
            // With fractional seconds and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
              optional(sym('timezone'))
            ),
            // With seconds and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2')
            )
          ),

          // DDMMYY compact: 6 digits
          'ddmmyy-compact': str(repeat(range('0', '9'), null, 6, 6)),

          // YYYYDDMM - NOT in main dateOrDatetime, accessible via opt_name only
          // Covers: YYYY-DD-MM, YYYY/DD/MM, YYYYDDMM, YY-DD-MM, YY/DD/MM, YYDDMM with optional time
          // NUMERIC dates only (month names are handled in STANDARD format via date-monthname)
          yyyyddmm: alt(
            sym('yyyyddmm-compact'),
            sym('yyyyddmm-sep'),
            sym('yyddmm')
          ),

          // YYYYDDMM with separators and optional time
          // YYYY-DD-MM, YYYY/DD/MM, YYYY-DD-MM HH:MM, YYYY-DD-MM HH:MM:SS
          // YYYY-DD-MMTHH:MM:SS+TZ (with T separator and timezone)
          'yyyyddmm-sep': alt(
            // With fractional seconds and timezone
            seq(
              sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
              optional(sym('timezone'))
            ),
            // With seconds and timezone
            seq(
              sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2')
            )
          ),

          // YYYYDDMM compact: 8 digits with optional space-separated time
          'yyyyddmm-compact': alt(
            // With space and compact time (HHMMSS - no colons)
            seq(
              str(repeat(range('0', '9'), null, 8, 8)),
              sym('datetime-sep'),
              sym('hour2'), sym('minute2'), sym('second2')
            ),
            // With space and time with colons
            seq(
              str(repeat(range('0', '9'), null, 8, 8)),
              sym('datetime-sep'),
              sym('hour2'), ':', sym('minute2'), optional(seq(':', sym('second2'))),
              optional(sym('timezone'))
            ),
            // Date only
            str(repeat(range('0', '9'), null, 8, 8))
          ),

          // YYDDMM - 2-digit year, day, month (6 digits)
          yyddmm: alt(
            sym('yyddmm-compact'),
            sym('yyddmm-sep')
          ),

          // YYDDMM with separators and optional time
          // YY-DD-MM, YY/DD/MM, YY-DD-MM HH:MM, YY-DD-MM HH:MM:SS
          // YY-DD-MMTHH:MM:SS+TZ (with T separator and timezone)
          'yyddmm-sep': alt(
            // With fractional seconds and timezone
            seq(
              sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('fractionalSeconds'),
              optional(sym('timezone'))
            ),
            // With seconds and timezone
            seq(
              sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              sym('datetime-sep'), sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2')
            )
          ),

          // YYDDMM compact: 6 digits
          'yyddmm-compact': str(repeat(range('0', '9'), null, 6, 6)),

          // YYYYDDMMM with separators: YYYY-DD-MMM, YYYY/DD/MMM
          'yyyyddmmm-sep': seq(
            sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month3alpha')
          ),

          // YYYYDDMMM compact: YYYYDDMMM (no separators, like 202531JAN)
          'yyyyddmmm-compact': seq(
            sym('year4'), sym('day2'), sym('month3alpha')
          ),

          // DDMMMYYYY with separators: DD-MMM-YYYY, DD/MMM/YYYY
          'ddmmmyyyy-sep': seq(
            sym('day2'), chars('-/'), sym('month3alpha'), chars('-/'), sym('year4')
          ),

          // DDMMMYYYY compact: DDMMMYYYY (no separators, like 31JAN2025)
          'ddmmmyyyy-compact': seq(
            sym('day2'), sym('month3alpha'), sym('year4')
          ),

          // MMM dd yyyy with spaces: "Jan 02 2025"
          'mmmddyyyy-space': seq(
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
    },
    {
      name: 'grammar_',
      factory: function() {
        let baseGrammar = foam.Function.withArgs(this.baseGrammar_, this.Parsers.create(), this);
        let self = this;

        let actions = {
          // YYYYMMDD with separators: YYYY-MM-DD, YYYY/MM/DD with optional time
          // v = [YYYY, sep, MM, sep, DD] or [YYYY, sep, MM, sep, DD, T/space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
          'yyyymmdd-sep': function(v) {
            let result = {
              year: parseInt(v[0]),
              month: parseInt(v[2]) - 1,
              day: parseInt(v[4])
            };

            // Check if time components exist (length > 5 means time is present)
            if ( v.length > 5 && v[6] !== undefined ) {
              result.hour = parseInt(v[6]);
              if ( v[8] !== undefined ) result.minute = parseInt(v[8]);
              if ( v[10] !== undefined ) result.second = parseInt(v[10]);

              // Handle fractional seconds (1-6 digits) - normalize to milliseconds (3 digits)
              if ( v[12] !== undefined ) {
                let fracStr = v[12];
                // If less than 3 digits, pad with zeros; if more than 3, truncate to milliseconds
                if ( fracStr.length <= 3 ) {
                  result.millisecond = parseInt(fracStr.padEnd(3, '0'));
                } else {
                  result.millisecond = parseInt(fracStr.substring(0, 3));
                }
              }

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // YYYYMMDD compact: 8 digits "20250115" or "20250115 143045" or "20250115 14:30" or "20250115 14:30:45"
          // v = "20250115" OR v = ["20250115", sep, HH, MM, SS] (compact time) OR v = ["20250115", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
          'yyyymmdd-compact': function(v) {
            let dateStr = typeof v === 'string' ? v : v[0];
            let result = {
              year: parseInt(dateStr.substring(0, 4)),
              month: parseInt(dateStr.substring(4, 6)) - 1,
              day: parseInt(dateStr.substring(6, 8))
            };

            // Check if time is present (array format)
            if ( Array.isArray(v) && v.length > 2 ) {
              // Check if this is compact time format (HHMMSS - no colons)
              // v = ["20250115", sep, HH, MM, SS] where v[3] is a 2-digit string (not ':')
              if ( v[3] && v[3] !== ':' ) {
                // Compact time format: HHMMSS
                result.hour = parseInt(v[2]);
                result.minute = parseInt(v[3]);
                result.second = parseInt(v[4]);
              } else {
                // Time with colons format: HH:MM or HH:MM:SS
                result.hour = parseInt(v[2]);
                result.minute = parseInt(v[4]);

                // Check for seconds (v[5] is optional array [: SS])
                if ( v[5] && Array.isArray(v[5]) ) {
                  result.second = parseInt(v[5][1]);
                }

                // Check for timezone (last element if present)
                let lastIdx = v.length - 1;
                if ( v[lastIdx] !== undefined && typeof v[lastIdx] !== 'string' ) {
                  result.timezone = self.flattenTimezone(v[lastIdx]);
                } else if ( v[lastIdx] === 'Z' ) {
                  result.timezone = 'Z';
                }
              }
            }

            return result;
          },

          // YYYYMMDDHHMMSS compact: 14 digits with time
          // v = [year, month, day, hour, minute, second]
          'yyyymmddhhmmss-compact': function(v) {
            return {
              year: parseInt(v[0]),
              month: parseInt(v[1]) - 1,
              day: parseInt(v[2]),
              hour: parseInt(v[3]),
              minute: parseInt(v[4]),
              second: parseInt(v[5])
            };
          },

          // MMDDYYYY with separators: MM-DD-YYYY, MM/DD/YYYY with optional time
          // v = [MM, sep, DD, sep, YYYY] or [MM, sep, DD, sep, YYYY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
          'mmddyyyy-sep': function(v) {
            let result = {
              year: parseInt(v[4]),
              month: parseInt(v[0]) - 1,
              day: parseInt(v[2])
            };

            // Check if time components exist
            if ( v.length > 5 && v[6] !== undefined ) {
              result.hour = parseInt(v[6]);
              if ( v[8] !== undefined ) result.minute = parseInt(v[8]);
              if ( v[10] !== undefined ) result.second = parseInt(v[10]);

              // Handle fractional seconds (1-6 digits) - normalize to milliseconds (3 digits)
              if ( v[12] !== undefined ) {
                let fracStr = v[12];
                if ( fracStr.length <= 3 ) {
                  result.millisecond = parseInt(fracStr.padEnd(3, '0'));
                } else {
                  result.millisecond = parseInt(fracStr.substring(0, 3));
                }
              }

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // MMDDYYYY compact: 8 digits "01152025" or "01152025 143045" or "01152025 14:30" or "01152025 14:30:45"
          // v = "01152025" OR v = ["01152025", sep, HH, MM, SS] (compact time) OR v = ["01152025", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
          'mmddyyyy-compact': function(v) {
            let dateStr = typeof v === 'string' ? v : v[0];
            let result = {
              year: parseInt(dateStr.substring(4, 8)),
              month: parseInt(dateStr.substring(0, 2)) - 1,
              day: parseInt(dateStr.substring(2, 4))
            };

            // Check if time is present (array format)
            if ( Array.isArray(v) && v.length > 2 ) {
              // Check if this is compact time format (HHMMSS - no colons)
              if ( v[3] && v[3] !== ':' ) {
                // Compact time format: HHMMSS
                result.hour = parseInt(v[2]);
                result.minute = parseInt(v[3]);
                result.second = parseInt(v[4]);
              } else {
                // Time with colons format: HH:MM or HH:MM:SS
                result.hour = parseInt(v[2]);
                result.minute = parseInt(v[4]);

                // Check for seconds (v[5] is optional array [: SS])
                if ( v[5] && Array.isArray(v[5]) ) {
                  result.second = parseInt(v[5][1]);
                }

                // Check for timezone (last element if present)
                let lastIdx = v.length - 1;
                if ( v[lastIdx] !== undefined && typeof v[lastIdx] !== 'string' ) {
                  result.timezone = self.flattenTimezone(v[lastIdx]);
                } else if ( v[lastIdx] === 'Z' ) {
                  result.timezone = 'Z';
                }
              }
            }

            return result;
          },

          // YYMMDD with separators: YY-MM-DD, YY/MM/DD with optional time and timezone
          // v = [YY, sep, MM, sep, DD] or [YY, sep, MM, sep, DD, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
          'yymmdd-sep': function(v) {
            let twoDigitYear = parseInt(v[0]);
            let result = {
              year: self.convertTwoDigitYear(twoDigitYear),
              month: parseInt(v[2]) - 1,
              day: parseInt(v[4])
            };

            // Check if time components are present
            if ( v.length > 5 && v[6] !== undefined ) {
              result.hour = parseInt(v[6]);
              result.minute = parseInt(v[8]);

              // Check if seconds are present (v[10] exists and is not timezone)
              if ( v[10] !== undefined ) result.second = parseInt(v[10]);

              // Handle fractional seconds (1-6 digits) - normalize to milliseconds (3 digits)
              if ( v[12] !== undefined ) {
                let fracStr = v[12];
                if ( fracStr.length <= 3 ) {
                  result.millisecond = parseInt(fracStr.padEnd(3, '0'));
                } else {
                  result.millisecond = parseInt(fracStr.substring(0, 3));
                }
              }

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // YYMMDD compact: 6 digits "250115"
          // v = "250115"
          'yymmdd-compact': function(v) {
            let twoDigitYear = parseInt(v.substring(0, 2));
            return {
              year: self.convertTwoDigitYear(twoDigitYear),
              month: parseInt(v.substring(2, 4)) - 1,
              day: parseInt(v.substring(4, 6))
            };
          },

          // DDMMYYYY with separators: DD-MM-YYYY, DD/MM/YYYY with optional time
          // v = [DD, sep, MM, sep, YYYY] or [DD, sep, MM, sep, YYYY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
          'ddmmyyyy-sep': function(v) {
            let result = {
              year: parseInt(v[4]),
              month: parseInt(v[2]) - 1,
              day: parseInt(v[0])
            };

            // Check if time components exist
            if ( v.length > 5 && v[6] !== undefined ) {
              result.hour = parseInt(v[6]);
              if ( v[8] !== undefined ) result.minute = parseInt(v[8]);
              if ( v[10] !== undefined ) result.second = parseInt(v[10]);

              // Handle fractional seconds (1-6 digits) - normalize to milliseconds (3 digits)
              if ( v[12] !== undefined ) {
                let fracStr = v[12];
                if ( fracStr.length <= 3 ) {
                  result.millisecond = parseInt(fracStr.padEnd(3, '0'));
                } else {
                  result.millisecond = parseInt(fracStr.substring(0, 3));
                }
              }

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // DDMMYYYY compact: 8 digits "15012025" or "15012025 143045" or "15012025 14:30" or "15012025 14:30:45"
          // v = "15012025" OR v = ["15012025", sep, HH, MM, SS] (compact time) OR v = ["15012025", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
          'ddmmyyyy-compact': function(v) {
            let dateStr = typeof v === 'string' ? v : v[0];
            let result = {
              year: parseInt(dateStr.substring(4, 8)),
              month: parseInt(dateStr.substring(2, 4)) - 1,
              day: parseInt(dateStr.substring(0, 2))
            };

            // Check if time is present (array format)
            if ( Array.isArray(v) && v.length > 2 ) {
              // Check if this is compact time format (HHMMSS - no colons)
              if ( v[3] && v[3] !== ':' ) {
                // Compact time format: HHMMSS
                result.hour = parseInt(v[2]);
                result.minute = parseInt(v[3]);
                result.second = parseInt(v[4]);
              } else {
                // Time with colons format: HH:MM or HH:MM:SS
                result.hour = parseInt(v[2]);
                result.minute = parseInt(v[4]);

                // Check for seconds (v[5] is optional array [: SS])
                if ( v[5] && Array.isArray(v[5]) ) {
                  result.second = parseInt(v[5][1]);
                }

                // Check for timezone (last element if present)
                let lastIdx = v.length - 1;
                if ( v[lastIdx] !== undefined && typeof v[lastIdx] !== 'string' ) {
                  result.timezone = self.flattenTimezone(v[lastIdx]);
                } else if ( v[lastIdx] === 'Z' ) {
                  result.timezone = 'Z';
                }
              }
            }

            return result;
          },

          // DDMMYY with separators: DD-MM-YY, DD/MM/YY with optional time
          // v = [DD, sep, MM, sep, YY] or [DD, sep, MM, sep, YY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
          'ddmmyy-sep': function(v) {
            let twoDigitYear = parseInt(v[4]);
            let result = {
              year: self.convertTwoDigitYear(twoDigitYear),
              month: parseInt(v[2]) - 1,
              day: parseInt(v[0])
            };

            // Check if time components exist
            if ( v.length > 5 && v[6] !== undefined ) {
              result.hour = parseInt(v[6]);
              if ( v[8] !== undefined ) result.minute = parseInt(v[8]);
              if ( v[10] !== undefined ) result.second = parseInt(v[10]);

              // Handle fractional seconds (1-6 digits) - normalize to milliseconds (3 digits)
              if ( v[12] !== undefined ) {
                let fracStr = v[12];
                if ( fracStr.length <= 3 ) {
                  result.millisecond = parseInt(fracStr.padEnd(3, '0'));
                } else {
                  result.millisecond = parseInt(fracStr.substring(0, 3));
                }
              }

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // DDMMYY compact: 6 digits "150125"
          // v = "150125"
          'ddmmyy-compact': function(v) {
            let twoDigitYear = parseInt(v.substring(4, 6));
            return {
              year: self.convertTwoDigitYear(twoDigitYear),
              month: parseInt(v.substring(2, 4)) - 1,
              day: parseInt(v.substring(0, 2))
            };
          },

          // YYYYDDMM with separators: YYYY-DD-MM, YYYY/DD/MM with optional time
          // v = [YYYY, sep, DD, sep, MM] or [YYYY, sep, DD, sep, MM, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
          'yyyyddmm-sep': function(v) {
            let result = {
              year: parseInt(v[0]),
              month: parseInt(v[4]) - 1,
              day: parseInt(v[2])
            };

            // Check if time components exist
            if ( v.length > 5 && v[6] !== undefined ) {
              result.hour = parseInt(v[6]);
              if ( v[8] !== undefined ) result.minute = parseInt(v[8]);
              if ( v[10] !== undefined ) result.second = parseInt(v[10]);

              // Handle fractional seconds (1-6 digits) - normalize to milliseconds (3 digits)
              if ( v[12] !== undefined ) {
                let fracStr = v[12];
                if ( fracStr.length <= 3 ) {
                  result.millisecond = parseInt(fracStr.padEnd(3, '0'));
                } else {
                  result.millisecond = parseInt(fracStr.substring(0, 3));
                }
              }

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // YYYYDDMM compact: 8 digits "20251501" or "20251501 143045" or "20251501 14:30" or "20251501 14:30:45"
          // v = "20251501" OR v = ["20251501", sep, HH, MM, SS] (compact time) OR v = ["20251501", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
          'yyyyddmm-compact': function(v) {
            let dateStr = typeof v === 'string' ? v : v[0];
            let result = {
              year: parseInt(dateStr.substring(0, 4)),
              month: parseInt(dateStr.substring(6, 8)) - 1,
              day: parseInt(dateStr.substring(4, 6))
            };

            // Check if time is present (array format)
            if ( Array.isArray(v) && v.length > 2 ) {
              // Check if this is compact time format (HHMMSS - no colons)
              if ( v[3] && v[3] !== ':' ) {
                // Compact time format: HHMMSS
                result.hour = parseInt(v[2]);
                result.minute = parseInt(v[3]);
                result.second = parseInt(v[4]);
              } else {
                // Time with colons format: HH:MM or HH:MM:SS
                result.hour = parseInt(v[2]);
                result.minute = parseInt(v[4]);

                // Check for seconds (v[5] is optional array [: SS])
                if ( v[5] && Array.isArray(v[5]) ) {
                  result.second = parseInt(v[5][1]);
                }

                // Check for timezone (last element if present)
                let lastIdx = v.length - 1;
                if ( v[lastIdx] !== undefined && typeof v[lastIdx] !== 'string' ) {
                  result.timezone = self.flattenTimezone(v[lastIdx]);
                } else if ( v[lastIdx] === 'Z' ) {
                  result.timezone = 'Z';
                }
              }
            }

            return result;
          },

          // YYDDMM with separators: YY-DD-MM, YY/DD/MM with optional time
          // v = [YY, sep, DD, sep, MM] or [YY, sep, DD, sep, MM, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
          'yyddmm-sep': function(v) {
            let twoDigitYear = parseInt(v[0]);
            let result = {
              year: self.convertTwoDigitYear(twoDigitYear),
              month: parseInt(v[4]) - 1,
              day: parseInt(v[2])
            };

            // Check if time components exist
            if ( v.length > 5 && v[6] !== undefined ) {
              result.hour = parseInt(v[6]);
              if ( v[8] !== undefined ) result.minute = parseInt(v[8]);
              if ( v[10] !== undefined ) result.second = parseInt(v[10]);

              // Handle fractional seconds (1-6 digits) - normalize to milliseconds (3 digits)
              if ( v[12] !== undefined ) {
                let fracStr = v[12];
                if ( fracStr.length <= 3 ) {
                  result.millisecond = parseInt(fracStr.padEnd(3, '0'));
                } else {
                  result.millisecond = parseInt(fracStr.substring(0, 3));
                }
              }

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // YYDDMM compact: 6 digits "251501"
          // v = "251501"
          'yyddmm-compact': function(v) {
            let twoDigitYear = parseInt(v.substring(0, 2));
            return {
              year: self.convertTwoDigitYear(twoDigitYear),
              month: parseInt(v.substring(4, 6)) - 1,
              day: parseInt(v.substring(2, 4))
            };
          },

          // DDMMMYYYY with separators: DD-MMM-YYYY, DD/MMM/YYYY
          // v = [DD, sep, MMM, sep, YYYY]
          'ddmmmyyyy-sep': function(v) {
            return {
              year: parseInt(v[4]),
              month: self.parseMonthName(v[2]),
              day: parseInt(v[0])
            };
          },

          // DDMMMYYYY compact: DDMMMYYYY "31JAN2025"
          // v = [DD, MMM, YYYY]
          'ddmmmyyyy-compact': function(v) {
            return {
              year: parseInt(v[2]),
              month: self.parseMonthName(v[1]),
              day: parseInt(v[0])
            };
          },

          // MMM dd yyyy with spaces: "Jan 02 2025"
          // v = [MMM, ' ', DD, ' ', YYYY]
          'mmmddyyyy-space': function(v) {
            return {
              year: parseInt(v[4]),
              month: self.parseMonthName(v[0]),
              day: parseInt(v[2])
            };
          },

          // YYYYDDMMM with separators: YYYY-DD-MMM, YYYY/DD/MMM
          // v = [YYYY, sep, DD, sep, MMM]
          'yyyyddmmm-sep': function(v) {
            return {
              year: parseInt(v[0]),
              month: self.parseMonthName(v[4]),
              day: parseInt(v[2])
            };
          },

          // YYYYDDMMM compact: YYYYDDMMM "202531JAN"
          // v = [YYYY, DD, MMM]
          'yyyyddmmm-compact': function(v) {
            return {
              year: parseInt(v[0]),
              month: self.parseMonthName(v[2]),
              day: parseInt(v[1])
            };
          }
        };

        let g = this.Grammar.create({
          symbols: baseGrammar
        });

        g.addActions(actions);
        return g;
      }
    }
  ],

  methods: [
    {
      name: 'flattenTimezone',
      documentation: 'Flatten timezone array from parser into a string',
      code: function(tzArray) {
        if ( ! tzArray ) return null;
        if ( tzArray === 'Z' ) return 'Z';

        // tzArray formats:
        // +HH:MM → ['+', ['0', '5'], ':', ['3', '0']]
        // +HHMM → ['+', ['0', '5', '3', '0']]
        // +HH → ['+', ['0', '5']]
        let result = '';
        for ( let i = 0; i < tzArray.length; i++ ) {
          if ( Array.isArray(tzArray[i]) ) {
            result += tzArray[i].join('');
          } else if ( tzArray[i] !== undefined ) {
            result += tzArray[i];
          }
        }
        return result;
      }
    },

    {
      name: 'parseTimezone',
      documentation: 'Parse timezone string and return offset in minutes. Z means UTC (0). +05:30 means +330 minutes.',
      code: function(tz) {
        if ( ! tz || tz === 'Z' ) return 0;

        let sign = tz[0] === '+' ? 1 : -1;
        let nums = tz.slice(1).replace(':', ''); // Remove colon if present

        let hours, minutes;
        if ( nums.length >= 4 ) {
          // HHMM format
          hours = parseInt(nums.slice(0, 2));
          minutes = parseInt(nums.slice(2, 4));
        } else if ( nums.length === 2 ) {
          // HH format (no minutes)
          hours = parseInt(nums);
          minutes = 0;
        } else {
          // Invalid format
          return 0;
        }

        return sign * (hours * 60 + minutes);
      }
    },

    {
      name: 'validateDate',
      documentation: 'Validates a date object (local time) and returns MAX_DATE for invalid dates',
      code: function(date, str) {
        // Check if date is NaN
        if ( isNaN(date.getTime()) ) {
          date = foam.Date.MAX_DATE;
          console.warn("Invalid date: " + str + "; assuming " + date.toISOString() + ".");
          return date;
        }

        // Allow JavaScript's native date normalization (e.g., 2025-13-01 → 2026-01-01)
        return date;
      }
    },

    {
      name: 'validateDateUTC',
      documentation: 'Validates a date object (UTC time) and returns MAX_DATE for invalid dates',
      code: function(date, str) {
        // Check if date is NaN
        if ( isNaN(date.getTime()) ) {
          date = foam.Date.MAX_DATE;
          console.warn("Invalid date: " + str + "; assuming " + date.toISOString() + ".");
          return date;
        }

        // Allow JavaScript's native date normalization (e.g., 2025-13-01 → 2026-01-01)
        return date;
      }
    },

    {
      name: 'convertTwoDigitYear',
      documentation: 'Converts 2-digit year using fixed pivot: 00-49 → 2000-2049, 50-99 → 1950-1999',
      code: function(twoDigitYear) {
        // Fixed pivot at 50:
        // Years 00-49 map to 2000-2049
        // Years 50-99 map to 1950-1999
        if ( twoDigitYear < 50 ) {
          return 2000 + twoDigitYear;
        }
        return 1900 + twoDigitYear;
      }
    },

    {
      name: 'parseMonthName',
      documentation: 'Converts 3-letter month abbreviation to 0-based month index (JAN→0, FEB→1, etc.)',
      code: function(monthName) {
        // Convert to uppercase for case-insensitive matching
        var month = monthName.toUpperCase();
        var months = {
          'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
          'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
          'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };
        return months[month] !== undefined ? months[month] : 0;
      }
    },

    {
      name: 'parseString',
      documentation: 'Parse a date/datetime string and return a Date object. Auto-detects format and handles time if present. Returns MAX_DATE for invalid dates.',
      code: function(str, opt_name) {
        let result = this.grammar_.parseString(str, opt_name || 'START');

        if ( ! result ) {
          // Unparseable format - return MAX_DATE
          return this.validateDate(this.INVALID_DATE, str);
        }

        // Determine if this is a datetime or date-only result based on presence of time components
        let ret;
        if ( result.hour !== undefined || result.minute !== undefined || result.second !== undefined ) {
          // Datetime format - use local time
          ret = new Date(
            result.year,
            result.month,
            result.day,
            result.hour !== undefined ? result.hour : 0,
            result.minute !== undefined ? result.minute : 0,
            result.second !== undefined ? result.second : 0,
            result.millisecond !== undefined ? result.millisecond : 0
          );
        } else {
          // Date-only format - use noon GMT (matches DateUtil behavior)
          ret = new Date(Date.UTC(result.year, result.month, result.day, 12, 0, 0, 0));
        }

        return this.validateDate(ret, str);
      }
    },

    {
      name: 'parseDateString',
      documentation: 'Parse a date string - ignores any time component and returns date at noon local time. Returns MAX_DATE for invalid dates.',
      code: function(str, opt_name) {
        let result = this.grammar_.parseString(str, opt_name || 'START');

        if ( ! result ) {
          // Unparseable format - return MAX_DATE
          return this.validateDate(this.INVALID_DATE, str);
        }

        // Always return date at noon UTC, ignoring time even if present
        let ret = new Date(Date.UTC(result.year, result.month, result.day, 12, 0, 0, 0));

        return this.validateDate(ret, str);
      }
    },

    {
      name: 'parseDateTime',
      documentation: 'Parse a datetime string using local time - uses time if present, otherwise sets to noon. If timezone is present, converts to UTC. Returns MAX_DATE for invalid dates.',
      code: function(str, opt_name) {
        // Trim input to remove leading/trailing whitespace
        str = str ? str.trim() : str;

        // Use parse() instead of parseString() to get position information
        this.grammar_.ps.setString(str);
        let start = this.grammar_.getSymbol(opt_name || 'START');
        let parseResult = this.grammar_.ps.apply(start, this.grammar_);

        if ( ! parseResult ) {
          // Unparseable format - return MAX_DATE
          return this.validateDate(this.INVALID_DATE, str);
        }

        // Check if entire string was consumed
        if ( parseResult.pos < str.length ) {
          // Partial parse - remaining characters indicate invalid format
          console.warn('DateParser: Partial parse detected. Input:', str,'opt_name:', opt_name, 'Consumed up to position:', parseResult.pos, 'Remaining:', str.substring(parseResult.pos));
          return this.validateDate(this.INVALID_DATE, str);
        }

        let result = parseResult.value;

        if ( ! result ) {
          // Unparseable format - return MAX_DATE
          return this.validateDate(this.INVALID_DATE, str);
        }

        // Validate time components if present
        // Note: Grammar already enforces valid ranges (hour2: 00-23, minute2/second2: 00-59)
        // but we keep these checks as a safety measure
        if ( result.hour !== undefined && (result.hour < 0 || result.hour > 23) ) {
          return this.validateDate(this.INVALID_DATE, str);
        }
        if ( result.minute !== undefined && (result.minute < 0 || result.minute > 59) ) {
          return this.validateDate(this.INVALID_DATE, str);
        }
        if ( result.second !== undefined && (result.second < 0 || result.second > 59) ) {
          return this.validateDate(this.INVALID_DATE, str);
        }

        let ret;
        if ( result.timezone ) {
          // Timezone present - convert to UTC
          let offset = this.parseTimezone(result.timezone);
          let utcTime = Date.UTC(
            result.year,
            result.month,
            result.day,
            result.hour !== undefined ? result.hour : 12,
            result.minute !== undefined ? result.minute : 0,
            result.second !== undefined ? result.second : 0,
            result.millisecond !== undefined ? result.millisecond : 0
          );
          // Subtract offset to convert to UTC (if timezone is +05:00, we subtract 5 hours)
          utcTime -= offset * 60000;
          ret = new Date(utcTime);
          // Don't validate date parts - timezone conversion is expected to change the date
          return this.validateDate(ret, str);
        } else {
          // No timezone - use local time
          ret = new Date(
            result.year,
            result.month,
            result.day,
            result.hour !== undefined ? result.hour : 12,
            result.minute !== undefined ? result.minute : 0,
            result.second !== undefined ? result.second : 0,
            result.millisecond !== undefined ? result.millisecond : 0
          );
          return this.validateDate(ret, str);
        }
      }
    },

    {
      name: 'parseDateTimeUTC',
      documentation: 'Parse a datetime string using UTC time - uses time if present, otherwise sets to midnight. If timezone is present, converts to UTC. Returns MAX_DATE for invalid dates.',
      code: function(str, opt_name) {
        // Trim input to remove leading/trailing whitespace
        str = str ? str.trim() : str;

        // Use parse() instead of parseString() to get position information
        this.grammar_.ps.setString(str);
        let start = this.grammar_.getSymbol(opt_name || 'START');
        let parseResult = this.grammar_.ps.apply(start, this.grammar_);

        if ( ! parseResult ) {
          // Unparseable format - return MAX_DATE
          return this.validateDateUTC(this.INVALID_DATE, str);
        }

        // Check if entire string was consumed
        if ( parseResult.pos < str.length ) {
          // Partial parse - remaining characters indicate invalid format
          console.warn('DateParser: Partial parse detected for UTC. Input:', str, 'opt_name:', opt_name, 'Consumed up to position:', parseResult.pos, 'Remaining:', str.substring(parseResult.pos));
          return this.validateDateUTC(this.INVALID_DATE, str);
        }

        let result = parseResult.value;

        if ( ! result ) {
          // Unparseable format - return MAX_DATE
          return this.validateDateUTC(this.INVALID_DATE, str);
        }

        // Validate time components if present
        // Note: Grammar already enforces valid ranges (hour2: 00-23, minute2/second2: 00-59)
        // but we keep these checks as a safety measure
        if ( result.hour !== undefined && (result.hour < 0 || result.hour > 23) ) {
          return this.validateDateUTC(this.INVALID_DATE, str);
        }
        if ( result.minute !== undefined && (result.minute < 0 || result.minute > 59) ) {
          return this.validateDateUTC(this.INVALID_DATE, str);
        }
        if ( result.second !== undefined && (result.second < 0 || result.second > 59) ) {
          return this.validateDateUTC(this.INVALID_DATE, str);
        }

        let ret;
        if ( result.timezone ) {
          // Timezone present - convert to UTC
          let offset = this.parseTimezone(result.timezone);
          let utcTime = Date.UTC(
            result.year,
            result.month,
            result.day,
            result.hour !== undefined ? result.hour : 0,
            result.minute !== undefined ? result.minute : 0,
            result.second !== undefined ? result.second : 0,
            result.millisecond !== undefined ? result.millisecond : 0
          );
          // Subtract offset to convert to UTC (if timezone is +05:00, we subtract 5 hours)
          utcTime -= offset * 60000;
          ret = new Date(utcTime);
          // Don't validate date parts - timezone conversion is expected to change the date
          return this.validateDateUTC(ret, str);
        } else {
          // No timezone - use UTC time as-is
          ret = new Date(Date.UTC(
            result.year,
            result.month,
            result.day,
            result.hour !== undefined ? result.hour : 0,
            result.minute !== undefined ? result.minute : 0,
            result.second !== undefined ? result.second : 0,
            result.millisecond !== undefined ? result.millisecond : 0
          ));
          return this.validateDateUTC(ret, str);
        }
      }
    }
  ]
});
