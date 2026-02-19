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

  properties: [
    {
      name: 'dateParseMode',
      value: 'DATETIME'
    },
    {
      class: 'Boolean',
      name: 'strictValidation',
      documentation: 'If true, throws errors for invalid dates. If false, logs warnings and returns MAX_DATE.'
    },
    {
      name: 'stringCache_',
      documentation: 'LRU cache for parseString results. Stores timestamps (Date.getTime()) instead of Date objects.',
      factory: function() { return new Map(); }
    },
    {
      name: 'dateCache_',
      documentation: 'LRU cache for parseDateString results. Stores timestamps instead of Date objects.',
      factory: function() { return new Map(); }
    },
    {
      name: 'dateTimeCache_',
      documentation: 'LRU cache for parseDateTime results. Stores timestamps instead of Date objects.',
      factory: function() { return new Map(); }
    },
    {
      name: 'dateTimeUtcCache_',
      documentation: 'LRU cache for parseDateTimeUTC results. Stores timestamps instead of Date objects.',
      factory: function() { return new Map(); }
    },
    {
      class: 'Int',
      name: 'maxCacheSize_',
      value: 10000
    }
  ],

  methods: [
    // ========== Cache Helper Methods ==========

    /**
     * Build cache key: use str directly when opt_name is null (common case),
     * otherwise concatenate opt_name:str (rare case).
     */
    function buildCacheKey_(str, opt_name) {
      if ( ! opt_name ) {
        return str;
      }
      return opt_name + ':' + str;
    },

    function cacheGet_(cache, key) {
      if ( cache.has(key) ) {
        var cached = cache.get(key);
        // LRU: delete and re-add to move to end (most recently used)
        cache.delete(key);
        cache.set(key, cached);
        // Create new Date from cached timestamp
        return new Date(cached);
      }
      return null;
    },

    function cacheSet_(cache, key, value, maxSize) {
      // LRU eviction: remove oldest entry if at capacity
      if ( cache.size >= maxSize ) {
        var oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
      // Store timestamp instead of Date object
      cache.set(key, value.getTime());
      // Return the original Date
      return value;
    },

    function buildDate(mode, year, month, day, hour, minute, second, ms, tz) {
      var offset, utcTime;
      switch ( mode ) {
        case 'DATE':
          // Always noon GMT - for parseDateString
          return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
        case 'STRING':
          // For parseString: date-only → noon GMT, with time → local time
          if ( hour < 0 && minute < 0 && second < 0 ) {
            // No time components - return noon GMT
            return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
          }
          // Has time - return local time
          if ( tz ) {
            offset = this.parseTimezone(tz);
            utcTime = Date.UTC(year, month, day,
              hour >= 0 ? hour : 0, minute >= 0 ? minute : 0,
              second >= 0 ? second : 0, ms >= 0 ? ms : 0);
            return new Date(utcTime - offset * 60000);
          }
          return new Date(year, month, day,
            hour >= 0 ? hour : 0, minute >= 0 ? minute : 0,
            second >= 0 ? second : 0, ms >= 0 ? ms : 0);
        case 'DATETIME':
          // Always local time with default hour 12 - for parseDateTime
          if ( tz ) {
            offset = this.parseTimezone(tz);
            utcTime = Date.UTC(year, month, day,
              hour >= 0 ? hour : 12, minute >= 0 ? minute : 0,
              second >= 0 ? second : 0, ms >= 0 ? ms : 0);
            return new Date(utcTime - offset * 60000);
          }
          return new Date(year, month, day,
            hour >= 0 ? hour : 12, minute >= 0 ? minute : 0,
            second >= 0 ? second : 0, ms >= 0 ? ms : 0);
        case 'DATETIME_UTC':
          // Always UTC - for parseDateTimeUTC
          utcTime = Date.UTC(year, month, day,
            hour >= 0 ? hour : 0, minute >= 0 ? minute : 0,
            second >= 0 ? second : 0, ms >= 0 ? ms : 0);
          if ( tz ) utcTime -= this.parseTimezone(tz) * 60000;
          return new Date(utcTime);
        default:
          return new Date(NaN);
      }
    },

    function parseIntOrDefault(v, idx, defaultVal) {
      if ( ! v || v.length <= idx || v[idx] === undefined || v[idx] === null ) return defaultVal;
      return parseInt(v[idx]);
    },

    function extractTimezone(v) {
      if ( ! v || v.length === 0 ) return null;
      var last = v[v.length - 1];
      if ( last === undefined || last === null ) return null;
      if ( last === 'Z' ) return 'Z';
      if ( typeof last !== 'string' ) return this.flattenTimezone(last);
      return null;
    },
    // YYYYMMDD with separators: YYYY-MM-DD, YYYY/MM/DD with optional time
    // v = [YYYY, sep, MM, sep, DD] or [YYYY, sep, MM, sep, DD, T/space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function yyyymmddsepAction(v) {
      var ms = -1;
      if ( v[12] !== undefined ) {
        var fracStr = v[12];
        if ( fracStr.length <= 3 ) {
          ms = parseInt(fracStr.padEnd(3, '0'));
        } else {
          ms = parseInt(fracStr.substring(0, 3));
        }
      }
      return this.buildDate(this.dateParseMode,
        parseInt(v[0]),
        parseInt(v[2]) - 1,
        parseInt(v[4]),
        this.parseIntOrDefault(v, 6, -1),
        this.parseIntOrDefault(v, 8, -1),
        this.parseIntOrDefault(v, 10, -1),
        ms,
        this.extractTimezone(v));
    },

    // YYYYMMDD compact: 8 digits "20250115" or "20250115 143045" or "20250115 14:30" or "20250115 14:30:45"
    // v = "20250115" OR v = ["20250115", sep, HH, MM, SS] (compact time) OR v = ["20250115", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
    function yyyymmddcompactAction(v) {
      var dateStr = typeof v === 'string' ? v : v[0];
      var hour = -1, minute = -1, second = -1, tz = null;

      if ( Array.isArray(v) && v.length > 2 ) {
        if ( v[3] && v[3] !== ':' ) {
          hour = parseInt(v[2]);
          minute = parseInt(v[3]);
          second = parseInt(v[4]);
        } else {
          hour = parseInt(v[2]);
          minute = parseInt(v[4]);
          if ( v[5] && Array.isArray(v[5]) ) {
            second = parseInt(v[5][1]);
          }
          tz = this.extractTimezone(v);
        }
      }

      return this.buildDate(this.dateParseMode,
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(4, 6)) - 1,
        parseInt(dateStr.substring(6, 8)),
        hour, minute, second, -1, tz);
    },

    // YYYYMMDDHHMMSS compact: 14 digits with time
    // v = [year, month, day, hour, minute, second]
    function yyyymmddhhmmsscompactAction(v) {
      return this.buildDate(this.dateParseMode,
        parseInt(v[0]),
        parseInt(v[1]) - 1,
        parseInt(v[2]),
        parseInt(v[3]),
        parseInt(v[4]),
        parseInt(v[5]),
        -1, null);
    },

    // MMDDYYYY with separators: MM-DD-YYYY, MM/DD/YYYY with optional time
    // v = [MM, sep, DD, sep, YYYY] or [MM, sep, DD, sep, YYYY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function mmddyyyysepAction(v) {
      var ms = -1;
      if ( v[12] !== undefined ) {
        var fracStr = v[12];
        if ( fracStr.length <= 3 ) {
          ms = parseInt(fracStr.padEnd(3, '0'));
        } else {
          ms = parseInt(fracStr.substring(0, 3));
        }
      }
      return this.buildDate(this.dateParseMode,
        parseInt(v[4]),
        parseInt(v[0]) - 1,
        parseInt(v[2]),
        this.parseIntOrDefault(v, 6, -1),
        this.parseIntOrDefault(v, 8, -1),
        this.parseIntOrDefault(v, 10, -1),
        ms,
        this.extractTimezone(v));
    },

    // MMDDYYYY compact: 8 digits "01152025" or "01152025 143045" or "01152025 14:30" or "01152025 14:30:45"
    // v = "01152025" OR v = ["01152025", sep, HH, MM, SS] (compact time) OR v = ["01152025", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
    function mmddyyyycompactAction(v) {
      var dateStr = typeof v === 'string' ? v : v[0];
      var hour = -1, minute = -1, second = -1, tz = null;

      if ( Array.isArray(v) && v.length > 2 ) {
        if ( v[3] && v[3] !== ':' ) {
          hour = parseInt(v[2]);
          minute = parseInt(v[3]);
          second = parseInt(v[4]);
        } else {
          hour = parseInt(v[2]);
          minute = parseInt(v[4]);
          if ( v[5] && Array.isArray(v[5]) ) {
            second = parseInt(v[5][1]);
          }
          tz = this.extractTimezone(v);
        }
      }

      return this.buildDate(this.dateParseMode,
        parseInt(dateStr.substring(4, 8)),
        parseInt(dateStr.substring(0, 2)) - 1,
        parseInt(dateStr.substring(2, 4)),
        hour, minute, second, -1, tz);
    },

    // YYMMDD with separators: YY-MM-DD, YY/MM/DD with optional time and timezone
    // v = [YY, sep, MM, sep, DD] or [YY, sep, MM, sep, DD, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function yymmddsepAction(v) {
      var twoDigitYear = parseInt(v[0]);
      var ms = -1;
      if ( v[12] !== undefined ) {
        var fracStr = v[12];
        if ( fracStr.length <= 3 ) {
          ms = parseInt(fracStr.padEnd(3, '0'));
        } else {
          ms = parseInt(fracStr.substring(0, 3));
        }
      }
      return this.buildDate(this.dateParseMode,
        this.convertTwoDigitYear(twoDigitYear),
        parseInt(v[2]) - 1,
        parseInt(v[4]),
        this.parseIntOrDefault(v, 6, -1),
        this.parseIntOrDefault(v, 8, -1),
        this.parseIntOrDefault(v, 10, -1),
        ms,
        this.extractTimezone(v));
    },

    // YYMMDD compact: 6 digits "250115"
    // v = "250115"
    function yymmddcompactAction(v) {
      var twoDigitYear = parseInt(v.substring(0, 2));
      return this.buildDate(this.dateParseMode,
        this.convertTwoDigitYear(twoDigitYear),
        parseInt(v.substring(2, 4)) - 1,
        parseInt(v.substring(4, 6)),
        -1, -1, -1, -1, null);
    },

    // MMDDYY with separators: MM-DD-YY, MM/DD/YY with optional time
    // v = [MM, sep, DD, sep, YY] or [MM, sep, DD, sep, YY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function mmddyysepAction(v) {
      var twoDigitYear = parseInt(v[4]);
      var ms = -1;
      if ( v[12] !== undefined ) {
        var fracStr = v[12];
        if ( fracStr.length <= 3 ) {
          ms = parseInt(fracStr.padEnd(3, '0'));
        } else {
          ms = parseInt(fracStr.substring(0, 3));
        }
      }
      return this.buildDate(this.dateParseMode,
        this.convertTwoDigitYear(twoDigitYear),
        parseInt(v[0]) - 1,
        parseInt(v[2]),
        this.parseIntOrDefault(v, 6, -1),
        this.parseIntOrDefault(v, 8, -1),
        this.parseIntOrDefault(v, 10, -1),
        ms,
        this.extractTimezone(v));
    },

    // MMDDYY compact: 6 digits "011525"
    // v = "011525"
    function mmddyycompactAction(v) {
      var twoDigitYear = parseInt(v.substring(4, 6));
      return this.buildDate(this.dateParseMode,
        this.convertTwoDigitYear(twoDigitYear),
        parseInt(v.substring(0, 2)) - 1,
        parseInt(v.substring(2, 4)),
        -1, -1, -1, -1, null);
    },

    // DDMMYYYY with separators: DD-MM-YYYY, DD/MM/YYYY with optional time
    // v = [DD, sep, MM, sep, YYYY] or [DD, sep, MM, sep, YYYY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function ddmmyyyysepAction(v) {
      var ms = -1;
      if ( v[12] !== undefined ) {
        var fracStr = v[12];
        if ( fracStr.length <= 3 ) {
          ms = parseInt(fracStr.padEnd(3, '0'));
        } else {
          ms = parseInt(fracStr.substring(0, 3));
        }
      }
      return this.buildDate(this.dateParseMode,
        parseInt(v[4]),
        parseInt(v[2]) - 1,
        parseInt(v[0]),
        this.parseIntOrDefault(v, 6, -1),
        this.parseIntOrDefault(v, 8, -1),
        this.parseIntOrDefault(v, 10, -1),
        ms,
        this.extractTimezone(v));
    },

    // DDMMYYYY compact: 8 digits "15012025" or "15012025 143045" or "15012025 14:30" or "15012025 14:30:45"
    // v = "15012025" OR v = ["15012025", sep, HH, MM, SS] (compact time) OR v = ["15012025", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
    function ddmmyyyycompactAction(v) {
      var dateStr = typeof v === 'string' ? v : v[0];
      var hour = -1, minute = -1, second = -1, tz = null;

      if ( Array.isArray(v) && v.length > 2 ) {
        if ( v[3] && v[3] !== ':' ) {
          hour = parseInt(v[2]);
          minute = parseInt(v[3]);
          second = parseInt(v[4]);
        } else {
          hour = parseInt(v[2]);
          minute = parseInt(v[4]);
          if ( v[5] && Array.isArray(v[5]) ) {
            second = parseInt(v[5][1]);
          }
          tz = this.extractTimezone(v);
        }
      }

      return this.buildDate(this.dateParseMode,
        parseInt(dateStr.substring(4, 8)),
        parseInt(dateStr.substring(2, 4)) - 1,
        parseInt(dateStr.substring(0, 2)),
        hour, minute, second, -1, tz);
    },

    // DDMMYY with separators: DD-MM-YY, DD/MM/YY with optional time
    // v = [DD, sep, MM, sep, YY] or [DD, sep, MM, sep, YY, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function ddmmyysepAction(v) {
      var twoDigitYear = parseInt(v[4]);
      var ms = -1;
      if ( v[12] !== undefined ) {
        var fracStr = v[12];
        if ( fracStr.length <= 3 ) {
          ms = parseInt(fracStr.padEnd(3, '0'));
        } else {
          ms = parseInt(fracStr.substring(0, 3));
        }
      }
      return this.buildDate(this.dateParseMode,
        this.convertTwoDigitYear(twoDigitYear),
        parseInt(v[2]) - 1,
        parseInt(v[0]),
        this.parseIntOrDefault(v, 6, -1),
        this.parseIntOrDefault(v, 8, -1),
        this.parseIntOrDefault(v, 10, -1),
        ms,
        this.extractTimezone(v));
    },

    // DDMMYY compact: 6 digits "150125"
    // v = "150125"
    function ddmmyycompactAction(v) {
      var twoDigitYear = parseInt(v.substring(4, 6));
      return this.buildDate(this.dateParseMode,
        this.convertTwoDigitYear(twoDigitYear),
        parseInt(v.substring(2, 4)) - 1,
        parseInt(v.substring(0, 2)),
        -1, -1, -1, -1, null);
    },

    // YYYYDDMM with separators: YYYY-DD-MM, YYYY/DD/MM with optional time
    // v = [YYYY, sep, DD, sep, MM] or [YYYY, sep, DD, sep, MM, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function yyyyddmmsepAction(v) {
      var ms = -1;
      if ( v[12] !== undefined ) {
        var fracStr = v[12];
        if ( fracStr.length <= 3 ) {
          ms = parseInt(fracStr.padEnd(3, '0'));
        } else {
          ms = parseInt(fracStr.substring(0, 3));
        }
      }
      return this.buildDate(this.dateParseMode,
        parseInt(v[0]),
        parseInt(v[4]) - 1,
        parseInt(v[2]),
        this.parseIntOrDefault(v, 6, -1),
        this.parseIntOrDefault(v, 8, -1),
        this.parseIntOrDefault(v, 10, -1),
        ms,
        this.extractTimezone(v));
    },

    // YYYYDDMM compact: 8 digits "20251501" or "20251501 143045" or "20251501 14:30" or "20251501 14:30:45"
    // v = "20251501" OR v = ["20251501", sep, HH, MM, SS] (compact time) OR v = ["20251501", sep, HH, :, MM, optional([:, SS]), optional(timezone)] (time with colons)
    function yyyyddmmcompactAction(v) {
      var dateStr = typeof v === 'string' ? v : v[0];
      var hour = -1, minute = -1, second = -1, tz = null;

      if ( Array.isArray(v) && v.length > 2 ) {
        if ( v[3] && v[3] !== ':' ) {
          hour = parseInt(v[2]);
          minute = parseInt(v[3]);
          second = parseInt(v[4]);
        } else {
          hour = parseInt(v[2]);
          minute = parseInt(v[4]);
          if ( v[5] && Array.isArray(v[5]) ) {
            second = parseInt(v[5][1]);
          }
          tz = this.extractTimezone(v);
        }
      }

      return this.buildDate(this.dateParseMode,
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(6, 8)) - 1,
        parseInt(dateStr.substring(4, 6)),
        hour, minute, second, -1, tz);
    },

    // YYDDMM with separators: YY-DD-MM, YY/DD/MM with optional time
    // v = [YY, sep, DD, sep, MM] or [YY, sep, DD, sep, MM, space, HH, :, MM, :, SS, ., fractionalSecs, timezone]
    function yyddmmsepAction(v) {
      var twoDigitYear = parseInt(v[0]);
      var ms = -1;
      if ( v[12] !== undefined ) {
        var fracStr = v[12];
        if ( fracStr.length <= 3 ) {
          ms = parseInt(fracStr.padEnd(3, '0'));
        } else {
          ms = parseInt(fracStr.substring(0, 3));
        }
      }
      return this.buildDate(this.dateParseMode,
        this.convertTwoDigitYear(twoDigitYear),
        parseInt(v[4]) - 1,
        parseInt(v[2]),
        this.parseIntOrDefault(v, 6, -1),
        this.parseIntOrDefault(v, 8, -1),
        this.parseIntOrDefault(v, 10, -1),
        ms,
        this.extractTimezone(v));
    },

    // YYDDMM compact: 6 digits "251501"
    // v = "251501"
    function yyddmmcompactAction(v) {
      var twoDigitYear = parseInt(v.substring(0, 2));
      return this.buildDate(this.dateParseMode,
        this.convertTwoDigitYear(twoDigitYear),
        parseInt(v.substring(4, 6)) - 1,
        parseInt(v.substring(2, 4)),
        -1, -1, -1, -1, null);
    },

    // DDMMMYYYY with separators: DD-MMM-YYYY, DD/MMM/YYYY
    // v = [DD, sep, MMM, sep, YYYY]
    function ddmmmyyyysepAction(v) {
      return this.buildDate(this.dateParseMode,
        parseInt(v[4]),
        this.parseMonthName(v[2]),
        parseInt(v[0]),
        -1, -1, -1, -1, null);
    },

    // DDMMMYYYY compact: DDMMMYYYY "31JAN2025"
    // v = [DD, MMM, YYYY]
    function ddmmmyyyycompactAction(v) {
      return this.buildDate(this.dateParseMode,
        parseInt(v[2]),
        this.parseMonthName(v[1]),
        parseInt(v[0]),
        -1, -1, -1, -1, null);
    },

    // MMM dd yyyy with spaces: "Jan 02 2025"
    // v = [MMM, ' ', DD, ' ', YYYY]
    function mmmddyyyyspaceAction(v) {
      return this.buildDate(this.dateParseMode,
        parseInt(v[4]),
        this.parseMonthName(v[0]),
        parseInt(v[2]),
        -1, -1, -1, -1, null);
    },

    // DD MMM YYYY with spaces: "15 JAN 2025"
    // v = [DD, ' ', MMM, ' ', YYYY]
    function ddmmmyyyyspaceAction(v) {
      return this.buildDate(this.dateParseMode,
        parseInt(v[4]),
        this.parseMonthName(v[2]),
        parseInt(v[0]),
        -1, -1, -1, -1, null);
    },

    // JavaScript Date.toString() format: DDD MMM DD YYYY HH:MM:SS GMT±HHMM (Timezone Name)
    // e.g., "Thu Feb 19 2026 16:20:23 GMT-0400 (Atlantic Standard Time)"
    // v = [DDD, ' ', MMM, ' ', DD, ' ', YYYY, ' ', HH, ':', MM, ':', SS, ' ', TZ, optional]
    function jsdatetostringAction(v) {
      // v[0] = day name (ignored)
      // v[2] = month name
      // v[4] = day
      // v[6] = year
      // v[8] = hour
      // v[10] = minute
      // v[12] = second
      // v[14] = jsTimezone [GMT_literal, optional_offset]
      var tz = this.normalizeJsTimezone(v[14]);
      return this.buildDate(this.dateParseMode,
        parseInt(v[6]),
        this.parseMonthName(v[2]),
        parseInt(v[4]),
        parseInt(v[8]),
        parseInt(v[10]),
        parseInt(v[12]),
        -1,
        tz);
    },

    // Normalize JS timezone: ['GMT', ['+', ['0','4','0','0']]] → '+0400'
    // or ['GMT', null] → 'Z'
    function normalizeJsTimezone(tz) {
      if ( ! tz || ! Array.isArray(tz) ) return 'Z';
      var offset = tz[1]; // optional offset part
      if ( ! offset ) return 'Z'; // Just "GMT" with no offset
      return this.flattenTimezone(offset);
    },

    // Unix/Java Date.toString() format: DDD MMM DD HH:MM:SS TZ YYYY
    // e.g., "Tue Apr 01 05:17:59 GMT 2025"
    // v = [DDD, ' ', MMM, ' ', DD, ' ', HH, ':', MM, ':', SS, ' ', TZ, ' ', YYYY]
    function unixdatetostringAction(v) {
      // v[0] = day name (ignored)
      // v[2] = month name
      // v[4] = day
      // v[6] = hour
      // v[8] = minute
      // v[10] = second
      // v[12] = timezone (GMT, UTC, or +/-offset)
      // v[14] = year
      var tz = this.normalizeUnixTimezone(v[12]);
      return this.buildDate(this.dateParseMode,
        parseInt(v[14]),
        this.parseMonthName(v[2]),
        parseInt(v[4]),
        parseInt(v[6]),
        parseInt(v[8]),
        parseInt(v[10]),
        -1,
        tz);
    },

    // Normalize Unix timezone format to standard format
    // GMT/UTC -> 'Z', +0530 -> '+05:30', etc.
    function normalizeUnixTimezone(tz) {
      if ( ! tz ) return null;
      // Handle string values (GMT, UTC)
      if ( typeof tz === 'string' ) {
        var tzUpper = tz.toUpperCase();
        if ( tzUpper === 'GMT' || tzUpper === 'UTC' ) {
          return 'Z';
        }
        return tz;
      }
      // Handle array values from seq() - offset format like ['+', ['0', '5', '3', '0']]
      if ( Array.isArray(tz) ) {
        return this.flattenTimezone(tz);
      }
      return null;
    },

    // YYYYDDMMM with separators: YYYY-DD-MMM, YYYY/DD/MMM
    // v = [YYYY, sep, DD, sep, MMM]
    function yyyyddmmmsepAction(v) {
      return this.buildDate(this.dateParseMode,
        parseInt(v[0]),
        this.parseMonthName(v[4]),
        parseInt(v[2]),
        -1, -1, -1, -1, null);
    },

    // YYYYDDMMM compact: YYYYDDMMM "202531JAN"
    // v = [YYYY, DD, MMM]
    function yyyyddmmmcompactAction(v) {
      return this.buildDate(this.dateParseMode,
        parseInt(v[0]),
        this.parseMonthName(v[2]),
        parseInt(v[1]),
        -1, -1, -1, -1, null);
    },

    // YYDDD Julian date format: 5-digit (2-digit year + 3-digit day of year)
    // v = "25216" (string) where 25=year 2025, 216=day of year (August 4)
    // Year cutoff: 00-49 = 2000-2049, 50-99 = 1950-1999 (uses convertTwoDigitYear)
    function yydddAction(v) {
      var twoDigitYear = parseInt(v.substring(0, 2), 10);
      var dayOfYear = parseInt(v.substring(2), 10);
      var year = this.convertTwoDigitYear(twoDigitYear);

      // Convert day-of-year to month and day using UTC to avoid timezone issues
      // Create Jan 1 of the year at noon UTC, then add (dayOfYear - 1) days
      var date = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
      date.setUTCDate(dayOfYear);

      return this.buildDate(this.dateParseMode,
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        -1, -1, -1, -1, null);
    },

    // YDDD Julian date format: 4-digit (1-digit year + 3-digit day of year)
    // v = "5216" (string) where 5=year 2025, 216=day of year (August 4)
    // Year mapping: Sliding window based on current year
    // - Uses current decade as base (e.g., 2020 in 2025, 2030 in 2035)
    // - If result is more than 5 years in future, assumes previous decade
    function ydddAction(v) {
      var oneDigitYear = parseInt(v.substring(0, 1), 10);
      var dayOfYear = parseInt(v.substring(1), 10);

      // Sliding window: calculate year based on current decade
      var currentYear = new Date().getUTCFullYear();
      var decade = Math.floor(currentYear / 10) * 10;
      var year = decade + oneDigitYear;

      // If calculated year is more than 5 years in future, assume previous decade
      if ( year > currentYear + 5 ) {
        year -= 10;
      }

      // Convert day-of-year to month and day using UTC to avoid timezone issues
      // Create Jan 1 of the year at noon UTC, then add (dayOfYear - 1) days
      var date = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
      date.setUTCDate(dayOfYear);

      return this.buildDate(this.dateParseMode,
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        -1, -1, -1, -1, null);
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
        if ( this.strictValidation ) {
          throw new Error('Invalid date: "' + str + '"');
        }
        date = foam.Date.MAX_DATE;
        console.warn("Invalid date: " + str + "; assuming " + date.toISOString() + ".");
        return date;
      }
      return date;
    },

    function validateDateUTC(date, str) {
      // Check if date is NaN
      if ( isNaN(date.getTime()) ) {
        if ( this.strictValidation ) {
          throw new Error('Invalid date: "' + str + '"');
        }
        date = foam.Date.MAX_DATE;
        console.warn("Invalid date: " + str + "; assuming " + date.toISOString() + ".");
        return date;
      }
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
      if ( months[month] === undefined ) {
        if ( this.strictValidation ) {
          throw new Error('Invalid month name: "' + monthName + '"');
        }
        console.warn('Invalid month name: "' + monthName + '"; assuming January.');
        return 0;
      }
      return months[month];
    },

    function parseString(str, opt_name) {
      if ( ! str || str.trim() === '' ) {
        if ( this.strictValidation ) {
          throw new Error('Unsupported Date format: empty or null string');
        }
        console.warn('Invalid date: empty or null string; assuming MAX_DATE.');
        return foam.Date.MAX_DATE;
      }
      str = str.trim();

      // Check cache first - use str directly as key when opt_name is null (common case)
      var cacheKey = this.buildCacheKey_(str, opt_name);
      var cached = this.cacheGet_(this.stringCache_, cacheKey);
      if ( cached ) return cached;

      this.dateParseMode = 'STRING';

      // Use parse() to get position information
      var parseResult = this.parse(this.StringPStream.create({ str: str }), this, opt_name);

      if ( ! parseResult || ! parseResult.value ) {
        if ( this.strictValidation ) {
          throw new Error('Unsupported Date format: ' + str);
        }
        console.warn('Invalid date: "' + str + '"; assuming MAX_DATE.');
        return foam.Date.MAX_DATE;
      }

      if ( parseResult.pos < str.length ) {
        console.warn('DateParser: Partial parse in parseString. Input:', str);
      }

      var result = parseResult.value;

      if ( ! result ) {
        // Unparseable format - return MAX_DATE
        return this.validateDate(this.INVALID_DATE, str);
      }

      // Check if result is already a Date object (from timestamp actions)
      if ( result instanceof Date ) {
        return this.cacheSet_(this.stringCache_, cacheKey, this.validateDate(result, str), this.maxCacheSize_ / 10);
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

      return this.cacheSet_(this.stringCache_, cacheKey, this.validateDate(ret, str), this.maxCacheSize_ / 10);
    },

    function parseDateString(str, opt_name) {
      if ( ! str || str.trim() === '' ) {
        if ( this.strictValidation ) {
          throw new Error('Unsupported Date format: empty or null string');
        }
        console.warn('Invalid date: empty or null string; assuming MAX_DATE.');
        return foam.Date.MAX_DATE;
      }
      str = str.trim();

      // Check cache first - use str directly as key when opt_name is null (common case)
      var cacheKey = this.buildCacheKey_(str, opt_name);
      var cached = this.cacheGet_(this.dateCache_, cacheKey);
      if ( cached ) return cached;

      this.dateParseMode = 'DATE';

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
        return this.cacheSet_(this.dateCache_, cacheKey, this.validateDate(result, str), this.maxCacheSize_ / 10);
      }

      return this.cacheSet_(this.dateCache_, cacheKey, parseResult.value, this.maxCacheSize_ / 10);
    },

    function parseDateTime(str, opt_name) {
      if ( ! str || str.trim() === '' ) {
        if ( this.strictValidation ) {
          throw new Error('Unsupported DateTime format: empty or null string');
        }
        console.warn('Invalid datetime: empty or null string; assuming MAX_DATE.');
        return foam.Date.MAX_DATE;
      }
      str = str.trim();

      // Check cache first - use str directly as key when opt_name is null (common case)
      var cacheKey = this.buildCacheKey_(str, opt_name);
      var cached = this.cacheGet_(this.dateTimeCache_, cacheKey);
      if ( cached ) return cached;

      this.dateParseMode = 'DATETIME';

      // Use parse() instead of parseString() to get position information
      var parseResult = this.parse(this.StringPStream.create({ str: str }), this, opt_name);

      if ( ! parseResult || ! parseResult.value ) {
        if ( this.strictValidation ) {
          throw new Error('Unsupported DateTime format: ' + str);
        }
        console.warn('Invalid datetime: "' + str + '"; assuming MAX_DATE.');
        return foam.Date.MAX_DATE;
      }

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
        return this.cacheSet_(this.dateTimeCache_, cacheKey, this.validateDate(result, str), this.maxCacheSize_);
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
      }

      return this.cacheSet_(this.dateTimeCache_, cacheKey, this.validateDate(ret, str), this.maxCacheSize_);
    },

    function parseDateTimeUTC(str, opt_name) {
      if ( ! str || str.trim() === '' ) {
        if ( this.strictValidation ) {
          throw new Error('Unsupported DateTime format: empty or null string');
        }
        console.warn('Invalid datetime: empty or null string; assuming MAX_DATE.');
        return foam.Date.MAX_DATE;
      }
      str = str.trim();

      // Check cache first - use str directly as key when opt_name is null (common case)
      var cacheKey = this.buildCacheKey_(str, opt_name);
      var cached = this.cacheGet_(this.dateTimeUtcCache_, cacheKey);
      if ( cached ) return cached;

      this.dateParseMode = 'DATETIME_UTC';

      // Use parse() instead of parseString() to get position information
      var parseResult = this.parse(this.StringPStream.create({ str: str }), this, opt_name);

      if ( ! parseResult || ! parseResult.value ) {
        if ( this.strictValidation ) {
          throw new Error('Unsupported DateTime format: ' + str);
        }
        console.warn('Invalid datetime: "' + str + '"; assuming MAX_DATE.');
        return foam.Date.MAX_DATE;
      }

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
        return this.cacheSet_(this.dateTimeUtcCache_, cacheKey, this.validateDateUTC(result, str), this.maxCacheSize_);
      }

      // Validate time components if present
      // Note: Grammar already enforces valid ranges (hour2: 00-23, minute2/second2: 00-59)
      // but we keep these checks as a safety measure
      if ( result.hour !== undefined && (result.hour < 0 || result.hour > 23) ) {
        return this.validateDateUTC(this.INVALID_DATE, str);
      }

      return this.cacheSet_(this.dateTimeUtcCache_, cacheKey, parseResult.value, this.maxCacheSize_);
    }
  ]
});
