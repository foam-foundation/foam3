/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
  AScript standard function library.

  Plain scalar functions (value in, value out) — the single source that the
  ALIB-generated mlang wrappers delegate to, that the AScript parser exposes as
  functions, and that JS callers can use directly. No mlang/Expr/Constant
  awareness, so it is standalone-loadable without AScript or FOAM's mlang layer.

  SCOPE: per-record, scalar-in / scalar-out only. Range/aggregation functions
  (SUM over a column, AVERAGE, COUNT, VLOOKUP, MATCH, regression, range-based
  finance, array ops) deliberately do NOT live here — those are the query
  layer's job (GroupBy / Count / where). n-ary SUM(a,b,c) is also absent: use +.

  NAMES are canonical Excel (UPPER). foam/reflow/lib.js aliases the old
  camelCase names (lPad -> LPAD, toLowerCase -> LOWER, year -> YEAR, ...) into
  these, so existing JS scripts keep working. The AScript parser already
  upper-cases function names on lookup, so it accepts any casing.

  The ADVANCED MATH / TRIG / BASE-CONVERSION sections are included for
  completeness but are expected to be category-hidden from the autocomplete
  list unless a science/FLOW use-case enables them.
*/

foam.LIB({
  name: 'foam.ascript.Lib',

  methods: [
    // ─────────────────────────────── Text ───────────────────────────────
    {
      name: 'LEN',
      code: function(text) { /* Length of text (0 for null). */
        return text == null ? 0 : String(text).length;
      }
    },
    {
      name: 'UPPER',
      code: function(text) { /* Convert text to upper case. */
        return text == null ? '' : String(text).toUpperCase();
      }
    },
    {
      name: 'LOWER',
      code: function(text) { /* Convert text to lower case. */
        return text == null ? '' : String(text).toLowerCase();
      }
    },
    {
      name: 'PROPER',
      code: function(text) { /* Capitalize the first letter of each word. */
        return text == null ? '' :
          String(text).toLowerCase().replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      }
    },
    {
      name: 'TRIM',
      code: function(text) { /* Trim ends and collapse internal whitespace to single spaces. */
        return text == null ? '' : String(text).replace(/\s+/g, ' ').trim();
      }
    },
    {
      name: 'CLEAN',
      code: function(text) { /* Remove non-printable control characters. */
        return text == null ? '' : String(text).replace(/[\x00-\x1F\x7F]/g, '');
      }
    },
    {
      name: 'LEFT',
      code: function(text, numChars) { /* Leftmost numChars characters (default 1). */
        return text == null ? '' : String(text).substring(0, numChars == null ? 1 : numChars);
      }
    },
    {
      name: 'RIGHT',
      code: function(text, numChars) { /* Rightmost numChars characters (default 1). */
        var s = text == null ? '' : String(text);
        var n = numChars == null ? 1 : numChars;
        return n <= 0 ? '' : s.substring(Math.max(0, s.length - n));
      }
    },
    {
      name: 'MID',
      code: function(text, start, numChars) { /* numChars chars from 1-based position start (Excel MID). */
        var s = text == null ? '' : String(text);
        var begin = Math.max(0, (start || 1) - 1);
        if ( begin >= s.length || numChars <= 0 ) return '';
        return s.substring(begin, Math.min(s.length, begin + numChars));
      }
    },
    {
      name: 'SUBSTR',
      code: function(text, start, end) { /* JS-style substring: 0-based, end exclusive; end omitted -> to end. */
        var s = text == null ? '' : String(text);
        return s.substring(start, end == null || end < 0 ? s.length : end);
      }
    },
    {
      name: 'SUBSTITUTE',
      code: function(text, oldText, newText, instanceNum) { /* Replace oldText with newText (all, or the instanceNum-th). */
        var s = text == null ? '' : String(text);
        var o = String(oldText), n = newText == null ? '' : String(newText);
        if ( o === '' ) return s;
        if ( instanceNum == null ) return s.split(o).join(n);
        var parts = s.split(o), out = parts[0];
        for ( var i = 1 ; i < parts.length ; i++ )
          out += ( i === instanceNum ? n : o ) + parts[i];
        return out;
      }
    },
    {
      name: 'REPLACE',
      code: function(oldText, startNum, numChars, newText) { /* Replace numChars chars from 1-based startNum with newText. */
        var s = oldText == null ? '' : String(oldText);
        return s.substring(0, startNum - 1) + (newText == null ? '' : String(newText)) +
               s.substring(startNum - 1 + numChars);
      }
    },
    {
      name: 'REPT',
      code: function(text, times) { /* Repeat text `times` times. */
        return times <= 0 ? '' : String(text == null ? '' : text).repeat(times);
      }
    },
    {
      name: 'FIND',
      code: function(findText, withinText, startNum) { /* 1-based position of findText (case-sensitive), or -1. */
        var i = String(withinText == null ? '' : withinText).indexOf(String(findText), (startNum || 1) - 1);
        return i === -1 ? -1 : i + 1;
      }
    },
    {
      name: 'SEARCH',
      code: function(findText, withinText, startNum) { /* 1-based position of findText (case-insensitive), or -1. */
        var i = String(withinText == null ? '' : withinText).toLowerCase()
                  .indexOf(String(findText).toLowerCase(), (startNum || 1) - 1);
        return i === -1 ? -1 : i + 1;
      }
    },
    {
      name: 'EXACT',
      code: function(text1, text2) { /* True if the two texts are identical (case-sensitive). */
        return String(text1) === String(text2);
      }
    },
    {
      name: 'REVERSE',
      code: function(text) { /* Reverse the characters of text. */
        return text == null ? '' : String(text).split('').reverse().join('');
      }
    },
    {
      name: 'CHAR',
      code: function(number) { /* Character for a character code. */
        return String.fromCharCode(number);
      }
    },
    {
      name: 'CODE',
      code: function(text) { /* Character code of the first character. */
        return String(text).charCodeAt(0);
      }
    },
    {
      name: 'VALUE',
      code: function(text) { /* Convert text to a number. */
        return Number(text);
      }
    },
    {
      name: 'LPAD',
      code: function(str, len, ch) { /* Left-pad str to len using ch (default '0'). */
        return String(str == null ? '' : str).padStart(len, ch || '0');
      }
    },
    {
      name: 'RPAD',
      code: function(str, len, ch) { /* Right-pad str to len using ch (default '0'). */
        return String(str == null ? '' : str).padEnd(len, ch || '0');
      }
    },
    {
      name: 'LMASK',
      code: function(str, len, ch) { /* Mask the leftmost len characters with ch (default '*'). */
        str = String(str == null ? '' : str);
        return this.LPAD(str.substring(len), str.length, ch || '*');
      }
    },
    {
      name: 'RMASK',
      code: function(str, len, ch) { /* Mask the rightmost len characters with ch (default '*'). */
        str = String(str == null ? '' : str);
        return this.RPAD(str.substring(0, str.length - len), str.length, ch || '*');
      }
    },

    // ─────────────────────────────── Math ───────────────────────────────
    {
      name: 'DIFF',
      code: function(a, b) { /* Positive (absolute) difference between two numbers. */ return Math.abs(a - b); }
    },
    {
      name: 'ROUND',
      code: function(num, digits) { /* Round to `digits` decimal places (default 0), half away from zero. */
        var f = Math.pow(10, digits || 0);
        return Math.round(num * f) / f;
      }
    },
    {
      name: 'ROUNDUP',
      code: function(num, digits) { /* Round away from zero to `digits` places (default 0). */
        var f = Math.pow(10, digits || 0);
        return (num < 0 ? -1 : 1) * Math.ceil(Math.abs(num) * f) / f;
      }
    },
    {
      name: 'ROUNDDOWN',
      code: function(num, digits) { /* Round toward zero to `digits` places (default 0). */
        var f = Math.pow(10, digits || 0);
        return (num < 0 ? -1 : 1) * Math.floor(Math.abs(num) * f) / f;
      }
    },
    {
      name: 'MROUND',
      code: function(num, multiple) { /* Round to the nearest multiple. */
        return Math.round(num / multiple) * multiple;
      }
    },
    {
      name: 'INT',
      code: function(num) { /* Round down to the nearest integer (toward -infinity). */ return Math.floor(num); }
    },
    /*
    {
      name: 'TRUNC',
      code: function(num, digits) { // Truncate toward zero to `digits` places (default 0).
        var f = Math.pow(10, digits || 0);
        return Math.trunc(num * f) / f;
      }
},
         */
    {
      name: 'CEILING',
      code: function(num, significance) { /* Round up to the nearest multiple of significance (default 1). */
        var s = significance == null ? 1 : significance;
        return Math.ceil(num / s) * s;
      }
    },
    {
      name: 'FLOOR',
      code: function(num, significance) { /* Round down to the nearest multiple of significance (default 1). */
        var s = significance == null ? 1 : significance;
        return Math.floor(num / s) * s;
      }
    },
    {
      name: 'QUOTIENT',
      code: function(numerator, denominator) { /* Integer portion of a division. */
        return Math.trunc(numerator / denominator);
      }
    },
    {
      name: 'SQRT',
      code: function(num) { /* Square root. */ return Math.sqrt(num); }
    },
    {
      name: 'EVEN',
      code: function(num) { /* Round away from zero to the nearest even integer. */
        var r = Math.ceil(Math.abs(num));
        return (r % 2 === 0 ? r : r + 1) * (num < 0 ? -1 : 1);
      }
    },
    {
      name: 'ODD',
      code: function(num) { /* Round away from zero to the nearest odd integer. */
        var r = Math.ceil(Math.abs(num));
        return (r % 2 === 1 ? r : r + 1) * (num < 0 ? -1 : 1);
      }
    },
    {
      name: 'FIX',
      code: function(num, precision) { /* Format a number to fixed decimal places (default 0) as text. */
        return Number(num).toFixed(precision || 0);
      }
    },
    {
      name: 'CURRENCY',
      code: function(amt, opt_precision) { /* Format a number with grouping and fixed max precision (default 2). */
        return Number(amt).toLocaleString(
          foam.locale,
          { maximumFractionDigits: ( opt_precision === null || opt_precision === undefined ) ? 2 : opt_precision });
      }
    },

    // ───────────────── Advanced math (category-hidden by default) ─────────────────
    {
      name: 'LOG',
      code: function(num, base) { /* Logarithm to a base (default 10). */
        return Math.log(num) / Math.log(base == null ? 10 : base);
      }
    },
    {
      name: 'FACT',
      code: function(num) { /* Factorial. */
        var r = 1;
        for ( var i = 2 ; i <= num ; i++ ) r *= i;
        return r;
      }
    },
    {
      name: 'COMBIN',
      code: function(n, k) { /* Number of combinations of n things taken k at a time. */
        return this.FACT(n) / (this.FACT(k) * this.FACT(n - k));
      }
    },
    {
      name: 'PERMUT',
      code: function(n, k) { /* Number of permutations of n things taken k at a time. */
        return this.FACT(n) / this.FACT(n - k);
      }
    },
    {
      name: 'GCD',
      code: function(a, b) { /* Greatest common divisor of two integers. */
        a = Math.abs(Math.floor(a)); b = Math.abs(Math.floor(b));
        while ( b ) { var t = b; b = a % b; a = t; }
        return a;
      }
    },
    {
      name: 'LCM',
      code: function(a, b) { /* Least common multiple of two integers. */
        return Math.abs(Math.floor(a) * Math.floor(b)) / this.GCD(a, b);
      }
    },
    {
      name: 'DEGREES',
      code: function(radians) { /* Radians to degrees. */ return radians * 180 / Math.PI; }
    },
    {
      name: 'RADIANS',
      code: function(degrees) { /* Degrees to radians. */ return degrees * Math.PI / 180; }
    },

    // ─────────────────────────── Logical / type ───────────────────────────
    {
      name: 'ISBLANK',
      code: function(value) { /* True if value is null, undefined, or empty string. */
        return value === null || value === undefined || value === '';
      }
    },
    {
      name: 'ISNUMBER',
      code: function(value) { /* True if value is a number. */
        return typeof value === 'number' && ! isNaN(value);
      }
    },
    {
      name: 'ISTEXT',
      code: function(value) { /* True if value is a string. */ return typeof value === 'string'; }
    },
    {
      name: 'ISLOGICAL',
      code: function(value) { /* True if value is a boolean. */ return typeof value === 'boolean'; }
    },
    {
      name: 'ISEVEN',
      code: function(num) { /* True if num is even. */ return num % 2 === 0; }
    },
    {
      name: 'ISODD',
      code: function(num) { /* True if num is odd. */ return Math.abs(num % 2) === 1; }
    },
    {
      name: 'N',
      code: function(value) { /* Coerce to number: number->itself, true->1, false->0, date->epoch, else 0. */
        if ( typeof value === 'number' )  return value;
        if ( typeof value === 'boolean' ) return value ? 1 : 0;
        if ( value instanceof Date )      return value.getTime();
        return 0;
      }
    },

    // ─────────────────────────────── Date ───────────────────────────────
    // Singular calendar-component extractors (distinct from the duration
    // mlangs YEARS/MONTHS/DAYS/HOURS/MINUTES). Return -1 for a null date.
    {
      name: 'YEAR',
      code: function(date) { /* Calendar year, or -1 if null. */
        if ( ! date ) return -1;
        return (date instanceof Date ? date : new Date(date)).getFullYear();
      }
    },
    {
      name: 'MONTH',
      code: function(date) { /* Calendar month 1-12, or -1 if null. */
        if ( ! date ) return -1;
        return (date instanceof Date ? date : new Date(date)).getMonth() + 1;
      }
    },
    {
      name: 'DAY',
      code: function(date) { /* Day of month, or -1 if null. */
        if ( ! date ) return -1;
        return (date instanceof Date ? date : new Date(date)).getDate();
      }
    },
    {
      name: 'HOUR',
      code: function(date) { /* Hour 0-23, or -1 if null. */
        if ( ! date ) return -1;
        return (date instanceof Date ? date : new Date(date)).getHours();
      }
    },
    {
      name: 'MINUTE',
      code: function(date) { /* Minute 0-59, or -1 if null. */
        if ( ! date ) return -1;
        return (date instanceof Date ? date : new Date(date)).getMinutes();
      }
    },
    {
      name: 'SECOND',
      code: function(date) { /* Second 0-59, or -1 if null. */
        if ( ! date ) return -1;
        return (date instanceof Date ? date : new Date(date)).getSeconds();
      }
    },
    {
      name: 'WEEKDAY',
      code: function(date, returnType) { /* Day of week; returnType 1 (default): Mon=1..Sun=7. */
        var day = (date instanceof Date ? date : new Date(date)).getDay(); // 0=Sun
        if ( returnType === 3 ) return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
        return day === 0 ? 7 : day;                             // Mon=1..Sun=7
      }
    },
    {
      name: 'DATE',
      code: function(year, month, day) { /* Construct a date from year, 1-based month, day. */
        return new Date(year, month - 1, day);
      }
    },
    {
      name: 'EDATE',
      code: function(startDate, months) { /* Date `months` before/after startDate. */
        var d = new Date(startDate instanceof Date ? startDate.getTime() : startDate);
        d.setMonth(d.getMonth() + months);
        return d;
      }
    },
    {
      name: 'EOMONTH',
      code: function(startDate, months) { /* Last day of the month `months` before/after startDate. */
        var d = new Date(startDate instanceof Date ? startDate.getTime() : startDate);
        d.setMonth(d.getMonth() + months + 1, 0);
        return d;
      }
    },
    {
      name: 'DATEDIF',
      code: function(startDate, endDate, unit) { /* Difference between dates in unit Y/M/D. */
        var start = startDate instanceof Date ? startDate : new Date(startDate);
        var end   = endDate   instanceof Date ? endDate   : new Date(endDate);
        var ms    = end - start;
        switch ( String(unit).toUpperCase() ) {
          case 'Y': return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
          case 'M': return Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44));
          case 'D': return Math.floor(ms / (1000 * 60 * 60 * 24));
          default:  return 0;
        }
      }
    },

    // ─────────── Base conversions (category-hidden by default) ───────────
    {
      name: 'ROMAN',
      code: function(number) { /* Convert an integer to Roman numerals. */
        var values   = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
        var numerals = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
        var out = '';
        for ( var i = 0 ; i < values.length ; i++ )
          while ( number >= values[i] ) { out += numerals[i]; number -= values[i]; }
        return out;
      }
    },
    {
      name: 'ARABIC',
      code: function(text) { /* Convert Roman numerals to an integer. */
        var v = { M:1000, D:500, C:100, L:50, X:10, V:5, I:1 }, r = 0;
        text = String(text).toUpperCase();
        for ( var i = 0 ; i < text.length ; i++ ) {
          var cur = v[text[i]], nxt = v[text[i + 1]];
          r += ( nxt && cur < nxt ) ? -cur : cur;
        }
        return r;
      }
    },
    {
      name: 'BASE',
      code: function(number, radix, minLength) { /* Integer to text in a given base, optionally zero-padded. */
        return number.toString(radix).toUpperCase().padStart(minLength || 0, '0');
      }
    },
    {
      name: 'DECIMAL',
      code: function(text, radix) { /* Text in a given base to a decimal integer. */
        return parseInt(text, radix);
      }
    },
    { name: 'BIN2DEC', code: function(b) { /* Binary text to decimal. */      return parseInt(b, 2); } },
    { name: 'DEC2BIN', code: function(n) { /* Decimal to binary text. */      return n.toString(2); } },
    { name: 'HEX2DEC', code: function(h) { /* Hex text to decimal. */         return parseInt(h, 16); } },
    { name: 'DEC2HEX', code: function(n) { /* Decimal to hex text. */         return n.toString(16).toUpperCase(); } },
    { name: 'OCT2DEC', code: function(o) { /* Octal text to decimal. */       return parseInt(o, 8); } },
    { name: 'DEC2OCT', code: function(n) { /* Decimal to octal text. */       return n.toString(8); } }
  ]
});
