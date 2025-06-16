/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.core.reflow.lib',

  /*
    round(number), ex. round(this.amount)
    abs(number), ex. round(this.amount)
    diff(number1, number2), ex. diff(this.sum1, this.sum2)
    fix(number, precision), ex. fix(this.amount, 3) or fix(this.amount)
    currency(number, option precision which defaults to 2), ex. currency(this,amount, 3) or currency(this.amount)
    lPad(string, len, option pad character which default to '0'), ex. lPad(this.cycle, 3)
    lMask(string, len, option masking character which defaults to '*'), ex. lMask(this.arn, 5) or lMast(this.arn, 5, '#')
    toLowerCase(string), ex. toLowerCase(this.name)
  */
  methods: [
    {
      name: 'round',
      code: function (n) {
        /* Round a number to the nearest integer. */
        return Math.round(n);
      }
    },
    {
      name: 'abs',
      code: function (n) {
        /* Return the absolute value of a number. */
        return Math.abs(n);
      }
    },
    {
      name: 'diff',
      code: function(a, b) {
        /* Return the positive difference between two numbers. */
        return Math.abs(a-b);
      }
    },
    {
      name: 'fix',
      code: function(num, precision) {
        /* Convert a number to a fixed precision. */
        return num.valueOf().toFixed(precision);
      }
    },
    {
      name: 'currency',
      code: function(amt, opt_precision) {
        /* Format a number as a currency with the specified number of decimal places. */
        return amt.toLocaleString(
          foam.locale,
          foam.Undefined.isInstance(opt_precision) ?
            undefined :
            {maximumFractionDigits: opt_precision});
      }
    },
    {
      name: 'lPad',
      code: function(str, len, char) {
        /* Left pad the supplied string to the specified length using the supplied character, or '0' is not specified. */
        return str.padStart(len, char || '0');
      }
    },
    {
      name: 'rPad',
      code: function(str, len, char) {
        /* Right pad the supplied string to the specified length using the supplied character, or '0' is not specified. */
        return str.padEnd(len, char || '0');
      }
    },
    {
      name: 'lMask',
      code: function(str, len, char) {
        /* Left mask the specified number of characters. */
        return this.lPad(str.substring(len), str.length, char || '*');
      }
    },
    {
      name: 'rMask',
      code: function(str, len, char) {
        /* Right mask the specified number of characters. */
        return this.rPad(str.substring(0, str.length-len), str.length, char || '*');
      }
    },
    {
      name: 'toLowerCase',
      code: function(s) {
        /* Convert a string to lower case. */
        return s ? s.toString().toLowerCase() : '';
      }
    },
    {
      name: 'toUpperCase',
      code: function(s) {
        /* Convert a string to upper case. */
        return s ? s.toString().toUpperCase() : '';
      }
    }
  ]
});
