/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'DateParser',
  extends: 'foam.parse.DateGrammar',

  documentation: `
    Comprehensive date and datetime parser that handles all formats from DateUtil.js.
    Extends DateGrammar and adds actions for converting parsed results to Date objects.
    Supports both date-only and datetime formats.

    Usage:
      var parser = foam.parse.DateParser.create();
      var date = parser.parseString('2025-01-15');
      var datetime = parser.parseString('2025-01-15T14:30:45');
  `,

  // Singleton pattern - reuse the same parser instance to avoid rebuilding grammar
  axioms: [
    foam.pattern.Singleton.create()
  ],

  constants: {
    INVALID_DATE: new Date(NaN)
  },

  methods: [
    // YYYYMMDD with separators: YYYY-MM-DD, YYYY/MM/DD with optional time
    // v = [YYYY, sep, MM, sep, DD] or [YYYY, sep, MM, sep, DD, T/space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function yyyymmddsepAction(v) {
      var result = {
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
          var fracStr = v[12];
          // If less than 3 digits, pad with zeros; if more than 3, truncate to milliseconds
          if ( fracStr.length <= 3 ) {
            result.millisecond = parseInt(fracStr.padEnd(3, '0'));
          } else {
            result.millisecond = parseInt(fracStr.substring(0, 3));
          }
        }

        // Check for timezone (last element if present)
        if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
          result.timezone = this.flattenTimezone(v[v.length - 1]);
        } else if ( v[v.length - 1] === 'Z' ) {
          result.timezone = 'Z';
        }
      }

      return result;
    },

    // YYYYMMDD compact: 8 digits "20250115" or "20250115 143045" or "20250115 14:30" or "20250115 14:30:45"
    // v = "20250115" OR v = ["20250115", sep, HH, MM, SS] (compact time) OR v = ["20250115", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
    function yyyymmddcompactAction(v) {
      var dateStr = typeof v === 'string' ? v : v[0];
      var result = {
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
          var lastIdx = v.length - 1;
          if ( v[lastIdx] !== undefined && typeof v[lastIdx] !== 'string' ) {
            result.timezone = this.flattenTimezone(v[lastIdx]);
          } else if ( v[lastIdx] === 'Z' ) {
            result.timezone = 'Z';
          }
        }
      }

      return result;
    },

    // YYYYMMDDHHMMSS compact: 14 digits with time
    // v = [year, month, day, hour, minute, second]
    function yyyymmddhhmmsscompactAction(v) {
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
    function mmddyyyysepAction(v) {
      var result = {
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
          var fracStr = v[12];
          if ( fracStr.length <= 3 ) {
            result.millisecond = parseInt(fracStr.padEnd(3, '0'));
          } else {
            result.millisecond = parseInt(fracStr.substring(0, 3));
          }
        }

        // Check for timezone (last element if present)
        if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
          result.timezone = this.flattenTimezone(v[v.length - 1]);
        } else if ( v[v.length - 1] === 'Z' ) {
          result.timezone = 'Z';
        }
      }

      return result;
    },

    // MMDDYYYY compact: 8 digits "01152025" or "01152025 143045" or "01152025 14:30" or "01152025 14:30:45"
    // v = "01152025" OR v = ["01152025", sep, HH, MM, SS] (compact time) OR v = ["01152025", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
    function mmddyyyycompactAction(v) {
      var dateStr = typeof v === 'string' ? v : v[0];
      var result = {
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
          var lastIdx = v.length - 1;
          if ( v[lastIdx] !== undefined && typeof v[lastIdx] !== 'string' ) {
            result.timezone = this.flattenTimezone(v[lastIdx]);
          } else if ( v[lastIdx] === 'Z' ) {
            result.timezone = 'Z';
          }
        }
      }

      return result;
    },

    // YYMMDD with separators: YY-MM-DD, YY/MM/DD with optional time and timezone
    // v = [YY, sep, MM, sep, DD] or [YY, sep, MM, sep, DD, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function yymmddsepAction(v) {
      var twoDigitYear = parseInt(v[0]);
      var result = {
        year: this.convertTwoDigitYear(twoDigitYear),
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
          var fracStr = v[12];
          if ( fracStr.length <= 3 ) {
            result.millisecond = parseInt(fracStr.padEnd(3, '0'));
          } else {
            result.millisecond = parseInt(fracStr.substring(0, 3));
          }
        }

        // Check for timezone (last element if present)
        if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
          result.timezone = this.flattenTimezone(v[v.length - 1]);
        } else if ( v[v.length - 1] === 'Z' ) {
          result.timezone = 'Z';
        }
      }

      return result;
    },

    // YYMMDD compact: 6 digits "250115"
    // v = "250115"
    function yymmddcompactAction(v) {
      var twoDigitYear = parseInt(v.substring(0, 2));
      return {
        year: this.convertTwoDigitYear(twoDigitYear),
        month: parseInt(v.substring(2, 4)) - 1,
        day: parseInt(v.substring(4, 6))
      };
    },

    // MMDDYY with separators: MM-DD-YY, MM/DD/YY with optional time
    // v = [MM, sep, DD, sep, YY] or [MM, sep, DD, sep, YY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function mmddyysepAction(v) {
      var twoDigitYear = parseInt(v[4]);
      var result = {
        year: this.convertTwoDigitYear(twoDigitYear),
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
          var fracStr = v[12];
          if ( fracStr.length <= 3 ) {
            result.millisecond = parseInt(fracStr.padEnd(3, '0'));
          } else {
            result.millisecond = parseInt(fracStr.substring(0, 3));
          }
        }

        // Check for timezone (last element if present)
        if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
          result.timezone = this.flattenTimezone(v[v.length - 1]);
        } else if ( v[v.length - 1] === 'Z' ) {
          result.timezone = 'Z';
        }
      }

      return result;
    },

    // MMDDYY compact: 6 digits "011525"
    // v = "011525"
    function mmddyycompactAction(v) {
      var twoDigitYear = parseInt(v.substring(4, 6));
      return {
        year: this.convertTwoDigitYear(twoDigitYear),
        month: parseInt(v.substring(0, 2)) - 1,
        day: parseInt(v.substring(2, 4))
      };
    },

    // DDMMYYYY with separators: DD-MM-YYYY, DD/MM/YYYY with optional time
    // v = [DD, sep, MM, sep, YYYY] or [DD, sep, MM, sep, YYYY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function ddmmyyyysepAction(v) {
      var result = {
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
          var fracStr = v[12];
          if ( fracStr.length <= 3 ) {
            result.millisecond = parseInt(fracStr.padEnd(3, '0'));
          } else {
            result.millisecond = parseInt(fracStr.substring(0, 3));
          }
        }

        // Check for timezone (last element if present)
        if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
          result.timezone = this.flattenTimezone(v[v.length - 1]);
        } else if ( v[v.length - 1] === 'Z' ) {
          result.timezone = 'Z';
        }
      }

      return result;
    },

    // DDMMYYYY compact: 8 digits "15012025" or "15012025 143045" or "15012025 14:30" or "15012025 14:30:45"
    // v = "15012025" OR v = ["15012025", sep, HH, MM, SS] (compact time) OR v = ["15012025", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
    function ddmmyyyycompactAction(v) {
      var dateStr = typeof v === 'string' ? v : v[0];
      var result = {
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
          var lastIdx = v.length - 1;
          if ( v[lastIdx] !== undefined && typeof v[lastIdx] !== 'string' ) {
            result.timezone = this.flattenTimezone(v[lastIdx]);
          } else if ( v[lastIdx] === 'Z' ) {
            result.timezone = 'Z';
          }
        }
      }

      return result;
    },

    // DDMMYY with separators: DD-MM-YY, DD/MM/YY with optional time
    // v = [DD, sep, MM, sep, YY] or [DD, sep, MM, sep, YY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function ddmmyysepAction(v) {
      var twoDigitYear = parseInt(v[4]);
      var result = {
        year: this.convertTwoDigitYear(twoDigitYear),
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
          var fracStr = v[12];
          if ( fracStr.length <= 3 ) {
            result.millisecond = parseInt(fracStr.padEnd(3, '0'));
          } else {
            result.millisecond = parseInt(fracStr.substring(0, 3));
          }
        }

        // Check for timezone (last element if present)
        if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
          result.timezone = this.flattenTimezone(v[v.length - 1]);
        } else if ( v[v.length - 1] === 'Z' ) {
          result.timezone = 'Z';
        }
      }

      return result;
    },

    // DDMMYY compact: 6 digits "150125"
    // v = "150125"
    function ddmmyycompactAction(v) {
      var twoDigitYear = parseInt(v.substring(4, 6));
      return {
        year: this.convertTwoDigitYear(twoDigitYear),
        month: parseInt(v.substring(2, 4)) - 1,
        day: parseInt(v.substring(0, 2))
      };
    },

    // YYYYDDMM with separators: YYYY-DD-MM, YYYY/DD/MM with optional time
    // v = [YYYY, sep, DD, sep, MM] or [YYYY, sep, DD, sep, MM, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function yyyyddmmsepAction(v) {
      var result = {
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
          var fracStr = v[12];
          if ( fracStr.length <= 3 ) {
            result.millisecond = parseInt(fracStr.padEnd(3, '0'));
          } else {
            result.millisecond = parseInt(fracStr.substring(0, 3));
          }
        }

        // Check for timezone (last element if present)
        if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
          result.timezone = this.flattenTimezone(v[v.length - 1]);
        } else if ( v[v.length - 1] === 'Z' ) {
          result.timezone = 'Z';
        }
      }

      return result;
    },

    // YYYYDDMM compact: 8 digits "20251501" or "20251501 143045" or "20251501 14:30" or "20251501 14:30:45"
    // v = "20251501" OR v = ["20251501", sep, HH, MM, SS] (compact time) OR v = ["20251501", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
    function yyyyddmmcompactAction(v) {
      var dateStr = typeof v === 'string' ? v : v[0];
      var result = {
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
          var lastIdx = v.length - 1;
          if ( v[lastIdx] !== undefined && typeof v[lastIdx] !== 'string' ) {
            result.timezone = this.flattenTimezone(v[lastIdx]);
          } else if ( v[lastIdx] === 'Z' ) {
            result.timezone = 'Z';
          }
        }
      }

      return result;
    },

    // YYDDMM with separators: YY-DD-MM, YY/DD/MM with optional time
    // v = [YY, sep, DD, sep, MM] or [YY, sep, DD, sep, MM, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function yyddmmsepAction(v) {
      var twoDigitYear = parseInt(v[0]);
      var result = {
        year: this.convertTwoDigitYear(twoDigitYear),
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
          var fracStr = v[12];
          if ( fracStr.length <= 3 ) {
            result.millisecond = parseInt(fracStr.padEnd(3, '0'));
          } else {
            result.millisecond = parseInt(fracStr.substring(0, 3));
          }
        }

        // Check for timezone (last element if present)
        if ( v[v.length - 1] !== undefined && typeof v[v.length - 1] !== 'string' ) {
          result.timezone = this.flattenTimezone(v[v.length - 1]);
        } else if ( v[v.length - 1] === 'Z' ) {
          result.timezone = 'Z';
        }
      }

      return result;
    },

    // YYDDMM compact: 6 digits "251501"
    // v = "251501"
    function yyddmmcompactAction(v) {
      var twoDigitYear = parseInt(v.substring(0, 2));
      return {
        year: this.convertTwoDigitYear(twoDigitYear),
        month: parseInt(v.substring(4, 6)) - 1,
        day: parseInt(v.substring(2, 4))
      };
    },

    // DDMMMYYYY with separators: DD-MMM-YYYY, DD/MMM/YYYY
    // v = [DD, sep, MMM, sep, YYYY]
    function ddmmmyyyysepAction(v) {
      return {
        year: parseInt(v[4]),
        month: this.parseMonthName(v[2]),
        day: parseInt(v[0])
      };
    },

    // DDMMMYYYY compact: DDMMMYYYY "31JAN2025"
    // v = [DD, MMM, YYYY]
    function ddmmmyyyycompactAction(v) {
      return {
        year: parseInt(v[2]),
        month: this.parseMonthName(v[1]),
        day: parseInt(v[0])
      };
    },

    // MMM dd yyyy with spaces: "Jan 02 2025"
    // v = [MMM, ' ', DD, ' ', YYYY]
    function mmmddyyyyspaceAction(v) {
      return {
        year: parseInt(v[4]),
        month: this.parseMonthName(v[0]),
        day: parseInt(v[2])
      };
    },

    // DD MMM YYYY with spaces: "15 JAN 2025"
    // v = [DD, ' ', MMM, ' ', YYYY]
    function ddmmmyyyyspaceAction(v) {
      return {
        year: parseInt(v[4]),
        month: this.parseMonthName(v[2]),
        day: parseInt(v[0])
      };
    },

    // YYYYDDMMM with separators: YYYY-DD-MMM, YYYY/DD/MMM
    // v = [YYYY, sep, DD, sep, MMM]
    function yyyyddmmmsepAction(v) {
      return {
        year: parseInt(v[0]),
        month: this.parseMonthName(v[4]),
        day: parseInt(v[2])
      };
    },

    // YYYYDDMMM compact: YYYYDDMMM "202531JAN"
    // v = [YYYY, DD, MMM]
    function yyyyddmmmcompactAction(v) {
      return {
        year: parseInt(v[0]),
        month: this.parseMonthName(v[2]),
        day: parseInt(v[1])
      };
    },

    // Timestamp actions - convert timestamp strings directly to Date objects
    // These return Date objects directly (not {year, month, day} objects) because
    // timestamps are already a complete date representation

    // 13-digit JavaScript timestamp (milliseconds since epoch)
    // v = "1754308800000" (string)
    function timestamp13Action(v) {
      return new Date(parseInt(v, 10));
    },

    // 10-digit Unix timestamp (seconds since epoch)
    // v = "1754308800" (string)
    function timestamp10Action(v) {
      return new Date(parseInt(v, 10) * 1000);
    },

    function flattenTimezone(tzArray) {
      if ( ! tzArray ) return null;
      if ( tzArray === 'Z' ) return 'Z';

      // tzArray formats:
      // +HH:MM -> ['+', ['0', '5'], ':', ['3', '0']]
      // +HHMM -> ['+', ['0', '5', '3', '0']]
      // +HH -> ['+', ['0', '5']]
      var result = '';
      for ( var i = 0; i < tzArray.length; i++ ) {
        if ( Array.isArray(tzArray[i]) ) {
          result += tzArray[i].join('');
        } else if ( tzArray[i] !== undefined ) {
          result += tzArray[i];
        }
      }
      return result;
    },

    function parseTimezone(tz) {
      if ( ! tz || tz === 'Z' ) return 0;

      var sign = tz[0] === '+' ? 1 : -1;
      var nums = tz.slice(1).replace(':', ''); // Remove colon if present

      var hours, minutes;
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
    },

    function validateDate(date, str) {
      // Check if date is NaN
      if ( isNaN(date.getTime()) ) {
        date = foam.Date.MAX_DATE;
        console.warn("Invalid date: " + str + "; assuming " + date.toISOString() + ".");
        return date;
      }

      // Allow JavaScript's native date normalization (e.g., 2025-13-01 -> 2026-01-01)
      return date;
    },

    function validateDateUTC(date, str) {
      // Check if date is NaN
      if ( isNaN(date.getTime()) ) {
        date = foam.Date.MAX_DATE;
        console.warn("Invalid date: " + str + "; assuming " + date.toISOString() + ".");
        return date;
      }

      // Allow JavaScript's native date normalization (e.g., 2025-13-01 -> 2026-01-01)
      return date;
    },

    function convertTwoDigitYear(twoDigitYear) {
      // Fixed pivot at 50:
      // Years 00-49 map to 2000-2049
      // Years 50-99 map to 1950-1999
      if ( twoDigitYear < 50 ) {
        return 2000 + twoDigitYear;
      }
      return 1900 + twoDigitYear;
    },

    function parseMonthName(monthName) {
      // Convert to uppercase for case-insensitive matching
      var month = monthName.toUpperCase();
      var months = {
        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
        'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
        'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
      };
      return months[month] !== undefined ? months[month] : 0;
    },

    function parseString(str, opt_name) {
      // Handle null, undefined, or empty string
      if ( ! str || str.trim() === '' ) {
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Trim input to remove leading/trailing whitespace
      str = str.trim();

      // Use parse() to get position information
      var parseResult = this.parse(this.StringPStream.create({ str: str }), this, opt_name);

      if ( ! parseResult ) {
        // Unparseable format - return MAX_DATE
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Check if entire string was consumed - warn but still return parsed value
      if ( parseResult.pos < str.length ) {
        console.warn('DateParser: Partial parse in parseString. Input:', str, 'Consumed up to position:', parseResult.pos, 'Remaining:', str.substring(parseResult.pos));
      }

      var result = parseResult.value;

      if ( ! result ) {
        // Unparseable format - return MAX_DATE
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Check if result is already a Date object (from timestamp actions)
      if ( result instanceof Date ) {
        return this.validateDate(result, str);
      }

      // Determine if this is a datetime or date-only result based on presence of time components
      var ret;
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
    },

    function parseDateString(str, opt_name) {
      // Handle null, undefined, or empty string
      if ( ! str || str.trim() === '' ) {
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Trim input to remove leading/trailing whitespace
      str = str.trim();

      // Use parse() to get position information
      var parseResult = this.parse(this.StringPStream.create({ str: str }), this, opt_name);

      if ( ! parseResult ) {
        // Unparseable format - return MAX_DATE
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Check if entire string was consumed - warn but still return parsed value
      if ( parseResult.pos < str.length ) {
        console.warn('DateParser: Partial parse in parseDateString. Input:', str, 'Consumed up to position:', parseResult.pos, 'Remaining:', str.substring(parseResult.pos));
      }

      var result = parseResult.value;

      if ( ! result ) {
        // Unparseable format - return MAX_DATE
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Check if result is already a Date object (from timestamp actions)
      if ( result instanceof Date ) {
        return this.validateDate(result, str);
      }

      // Always return date at noon UTC, ignoring time even if present
      var ret = new Date(Date.UTC(result.year, result.month, result.day, 12, 0, 0, 0));

      return this.validateDate(ret, str);
    },

    function parseDateTime(str, opt_name) {
      // Handle null, undefined, or empty string
      if ( ! str || str.trim() === '' ) {
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Trim input to remove leading/trailing whitespace
      str = str.trim();

      // Use parse() instead of parseString() to get position information
      var parseResult = this.parse(this.StringPStream.create({ str: str }), this, opt_name);

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

      var result = parseResult.value;

      if ( ! result ) {
        // Unparseable format - return MAX_DATE
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Check if result is already a Date object (from timestamp actions)
      if ( result instanceof Date ) {
        return this.validateDate(result, str);
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

      var ret;
      if ( result.timezone ) {
        // Timezone present - convert to UTC
        var offset = this.parseTimezone(result.timezone);
        var utcTime = Date.UTC(
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
    },

    function parseDateTimeUTC(str, opt_name) {
      // Handle null, undefined, or empty string
      if ( ! str || str.trim() === '' ) {
        return this.validateDateUTC(this.INVALID_DATE, str);
      }

      // Trim input to remove leading/trailing whitespace
      str = str.trim();

      // Use parse() instead of parseString() to get position information
      var parseResult = this.parse(this.StringPStream.create({ str: str }), this, opt_name);

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

      var result = parseResult.value;

      if ( ! result ) {
        // Unparseable format - return MAX_DATE
        return this.validateDateUTC(this.INVALID_DATE, str);
      }

      // Check if result is already a Date object (from timestamp actions)
      if ( result instanceof Date ) {
        return this.validateDateUTC(result, str);
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

      var ret;
      if ( result.timezone ) {
        // Timezone present - convert to UTC
        var offset = this.parseTimezone(result.timezone);
        var utcTime = Date.UTC(
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
  ]
});
