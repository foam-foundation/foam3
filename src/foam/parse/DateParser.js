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
      value: function(alt, anyChar, chars, optional, range, repeat, seq, str, sym) {
        return {
          START: sym('dateOrDatetime'),

          // Main entry point - try all three main formats
          dateOrDatetime: alt(
            sym('yyyymmdd'),
            sym('mmddyyyy'),
            sym('yymmdd')
          ),

          // YYYYMMDD - tries all variants (compact with time, compact, separated)
          // Covers: YYYYMMDDHHMMSS, YYYYMMDD, YYYY-MM-DD, YYYY/MM/DD with optional time
          yyyymmdd: alt(
            sym('yyyymmddhhmmss-compact'),
            sym('yyyymmdd-compact'),
            sym('yyyymmdd-sep')
          ),

          // Timezone format: Z or +/-HH:MM or +/-HHMM
          timezone: alt(
            'Z',
            // +HH:MM format
            seq(
              chars('+-'),
              repeat(range('0', '9'), null, 2),
              ':',
              repeat(range('0', '9'), null, 2)
            ),
            // +HHMM format (no colon)
            seq(
              chars('+-'),
              repeat(range('0', '9'), null, 4)
            ),
            // +HH format (hours only)
            seq(
              chars('+-'),
              repeat(range('0', '9'), null, 2)
            )
          ),

          // YYYYMMDD with separators and optional time
          // YYYY-MM-DD, YYYY/MM/DD, YYYY-MM-DDTHH:MM, YYYY-MM-DDTHH:MM:SS, YYYY-MM-DDTHH:MM:SS.sss
          'yyyymmdd-sep': alt(
            // With milliseconds and timezone
            seq(
              sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              chars('T '), sym('hour2'), ':', sym('minute2'), ':', sym('second2'), '.', sym('millisecond3'),
              optional(sym('timezone'))
            ),
            // With seconds and timezone
            seq(
              sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              chars('T '), sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              chars('T '), sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('year4'), chars('-/'), sym('month2'), chars('-/'), sym('day2')
            )
          ),

          // YYYYMMDD compact: 8 digits (year 1900-2999)
          'yyyymmdd-compact': str(seq(sym('year4_1900_2999'), sym('month2'), sym('day2'))),

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
            // With seconds and timezone
            seq(
              sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4'),
              ' ', sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4'),
              ' ', sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('month2'), chars('-/'), sym('day2'), chars('-/'), sym('year4')
            )
          ),

          // MMDDYYYY compact: 8 digits (that don't match YYYY 1900-2999 pattern)
          'mmddyyyy-compact': str(repeat(range('0', '9'), null, 8)),

          // YYMMDD - tries all variants (compact, separated)
          // Covers: YYMMDD, YY-MM-DD, YY/MM/DD with optional time
          yymmdd: alt(
            sym('yymmdd-compact'),
            sym('yymmdd-sep')
          ),

          // YYMMDD with separators and optional time
          // YY-MM-DD, YY/MM/DD, YY-MM-DD HH:MM, YY-MM-DD HH:MM:SS with optional timezone
          'yymmdd-sep': alt(
            // With seconds and timezone
            seq(
              sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              ' ', sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2'),
              ' ', sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('year2'), chars('-/'), sym('month2'), chars('-/'), sym('day2')
            )
          ),

          // YYMMDD compact: 6 digits
          'yymmdd-compact': str(repeat(range('0', '9'), null, 6)),

          // DDMMYYYY - NOT in main dateOrDatetime, accessible via opt_name only
          // Covers: DD-MM-YYYY, DD/MM/YYYY, DDMMYYYY, DD-MM-YY, DD/MM/YY, DDMMYY with optional time
          ddmmyyyy: alt(
            sym('ddmmyyyy-sep'),
            sym('ddmmyy-sep'),
            sym('ddmmyyyy-compact'),
            sym('ddmmyy-compact')
          ),

          // DDMMYYYY with separators and optional time
          // DD-MM-YYYY, DD/MM/YYYY, DD-MM-YYYY HH:MM, DD-MM-YYYY HH:MM:SS
          'ddmmyyyy-sep': alt(
            // With seconds and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4'),
              ' ', sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4'),
              ' ', sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year4')
            )
          ),

          // DDMMYYYY compact: 8 digits (that don't match YYYY 1900-2999 pattern)
          'ddmmyyyy-compact': str(repeat(range('0', '9'), null, 8)),

          // DDMMYY with separators and optional time (2-digit year)
          // DD-MM-YY, DD/MM/YY, DD-MM-YY HH:MM, DD-MM-YY HH:MM:SS
          'ddmmyy-sep': alt(
            // With seconds and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2'),
              ' ', sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2'),
              ' ', sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('day2'), chars('-/'), sym('month2'), chars('-/'), sym('year2')
            )
          ),

          // DDMMYY compact: 6 digits
          'ddmmyy-compact': str(repeat(range('0', '9'), null, 6)),

          // YYYYDDMM - NOT in main dateOrDatetime, accessible via opt_name only
          // Covers: YYYY-DD-MM, YYYY/DD/MM, YYYYDDMM, YY-DD-MM, YY/DD/MM, YYDDMM with optional time
          yyyyddmm: alt(
            sym('yyyyddmm-compact'),
            sym('yyyyddmm-sep'),
            sym('yyddmm')
          ),

          // YYYYDDMM with separators and optional time
          // YYYY-DD-MM, YYYY/DD/MM, YYYY-DD-MM HH:MM, YYYY-DD-MM HH:MM:SS
          'yyyyddmm-sep': alt(
            // With seconds and timezone
            seq(
              sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              ' ', sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              ' ', sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('year4'), chars('-/'), sym('day2'), chars('-/'), sym('month2')
            )
          ),

          // YYYYDDMM compact: 8 digits
          'yyyyddmm-compact': str(repeat(range('0', '9'), null, 8)),

          // YYDDMM - 2-digit year, day, month (6 digits)
          yyddmm: alt(
            sym('yyddmm-compact'),
            sym('yyddmm-sep')
          ),

          // YYDDMM with separators and optional time
          // YY-DD-MM, YY/DD/MM, YY-DD-MM HH:MM, YY-DD-MM HH:MM:SS
          'yyddmm-sep': alt(
            // With seconds and timezone
            seq(
              sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              ' ', sym('hour2'), ':', sym('minute2'), ':', sym('second2'),
              optional(sym('timezone'))
            ),
            // With minutes and timezone
            seq(
              sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2'),
              ' ', sym('hour2'), ':', sym('minute2'),
              optional(sym('timezone'))
            ),
            // Date only
            seq(
              sym('year2'), chars('-/'), sym('day2'), chars('-/'), sym('month2')
            )
          ),

          // YYDDMM compact: 6 digits
          'yyddmm-compact': str(repeat(range('0', '9'), null, 6)),

          // Component parsers
          year4: str(repeat(range('0', '9'), null, 4)),
          year4_1900_2999: str(alt(
            seq('1', '9', range('0', '9'), range('0', '9')),
            seq('2', range('0', '9'), range('0', '9'), range('0', '9'))
          )),
          year2: str(seq(range('0', '9'), range('0', '9'))),
          month2: str(seq(range('0', '1'), range('0', '9'))),
          day2: str(seq(range('0', '3'), range('0', '9'))),
          hour2: str(seq(range('0', '2'), range('0', '9'))),
          minute2: str(seq(range('0', '5'), range('0', '9'))),
          second2: str(seq(range('0', '5'), range('0', '9'))),
          millisecond3: str(repeat(range('0', '9'), null, 3))
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
          // v = [YYYY, sep, MM, sep, DD] or [YYYY, sep, MM, sep, DD, T/space, HH, :, MM, :, SS, ., ms, timezone]
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
              if ( v[12] !== undefined ) result.millisecond = parseInt(v[12]);

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // YYYYMMDD compact: 8 digits "20250115"
          // v = "20250115"
          'yyyymmdd-compact': function(v) {
            return {
              year: parseInt(v.substring(0, 4)),
              month: parseInt(v.substring(4, 6)) - 1,
              day: parseInt(v.substring(6, 8))
            };
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
          // v = [MM, sep, DD, sep, YYYY] or [MM, sep, DD, sep, YYYY, space, HH, :, MM, :, SS, timezone]
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

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // MMDDYYYY compact: 8 digits "01152025"
          // v = "01152025"
          'mmddyyyy-compact': function(v) {
            return {
              year: parseInt(v.substring(4, 8)),
              month: parseInt(v.substring(0, 2)) - 1,
              day: parseInt(v.substring(2, 4))
            };
          },

          // YYMMDD with separators: YY-MM-DD, YY/MM/DD with optional time and timezone
          // v = [YY, sep, MM, sep, DD] or [YY, sep, MM, sep, DD, space, HH, :, MM, :, SS, timezone]
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
          // v = [DD, sep, MM, sep, YYYY] or [DD, sep, MM, sep, YYYY, space, HH, :, MM, :, SS, timezone]
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

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // DDMMYYYY compact: 8 digits "15012025"
          // v = "15012025"
          'ddmmyyyy-compact': function(v) {
            return {
              year: parseInt(v.substring(4, 8)),
              month: parseInt(v.substring(2, 4)) - 1,
              day: parseInt(v.substring(0, 2))
            };
          },

          // DDMMYY with separators: DD-MM-YY, DD/MM/YY with optional time
          // v = [DD, sep, MM, sep, YY] or [DD, sep, MM, sep, YY, space, HH, :, MM, :, SS, timezone]
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
          // v = [YYYY, sep, DD, sep, MM] or [YYYY, sep, DD, sep, MM, space, HH, :, MM, :, SS, timezone]
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

              // Check for timezone (last element if present)
              if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
                result.timezone = self.flattenTimezone(v[v.length - 1]);
              } else if ( v[v.length - 1] === 'Z' ) {
                result.timezone = 'Z';
              }
            }

            return result;
          },

          // YYYYDDMM compact: 8 digits "20251501"
          // v = "20251501"
          'yyyyddmm-compact': function(v) {
            return {
              year: parseInt(v.substring(0, 4)),
              month: parseInt(v.substring(6, 8)) - 1,
              day: parseInt(v.substring(4, 6))
            };
          },

          // YYDDMM with separators: YY-DD-MM, YY/DD/MM with optional time
          // v = [YY, sep, DD, sep, MM] or [YY, sep, DD, sep, MM, space, HH, :, MM, :, SS, timezone]
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
          console.warn('DateParser: Partial parse detected. Input:', str, 'Consumed up to position:', parseResult.pos, 'Remaining:', str.substring(parseResult.pos));
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
          console.warn('DateParser: Partial parse detected for UTC. Input:', str, 'Consumed up to position:', parseResult.pos, 'Remaining:', str.substring(parseResult.pos));
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
