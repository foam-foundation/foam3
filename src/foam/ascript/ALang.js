/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/** Generate models for AScript Library and register in foam.alib registry. **/
// To debug Java code-generation in browser, load with ?genjava=true flag
foam.ALANG = function(ms) {
  ms.forEach(l => {
    function getValue(a) {
      let v = `get${foam.String.capitalize(a.name)}().f(obj)`;
      let t = a.javaType;

      if ( t === 'boolean' ) return `(Boolean) ${v}`;
      if ( t === 'double'  ) return `((Number) ${v}).doubleValue()`;
      if ( t === 'float'   ) return `((Number) ${v}).floatValue()`;
      if ( t === 'long'    ) return `((Number) ${v}).longtValue()`;
      if ( t === 'int'     ) return `((Number) ${v}).intValue()`;
      if ( t === 'short'   ) return `((Number) ${v}).shortValue()`;

      return `(${t}) ${v}`;
    }

    let properties = l.args.map(a => {
      let m = {...a, class: 'foam.mlang.ExprProperty' };

      // Re-encode default values and Constant expressions
      if ( ! foam.Undefined.isInstance(a.value) ) m.value = foam.mlang.Constant.create({value: a.value});

      return m;
    });

    let javaCode = foam.flags.genjava && foam.json.parse(l.args).map(
      a => `${a.javaType} ${a.name} = ${getValue(a)};\n`
    ).join('') + l.javaCode;

    // TODO: Generate Model
    let m = {
      package: 'foam.mlang.expr',
      name: l.name,
      extends: 'foam.mlang.AbstractExpr',
      flags: [ 'java' ], // Cause java generation
      // Make all arguments into ExprProperty's
      properties: properties,
      methods: [
        {
          name: 'f',
          code: function(obj) {
            return l.code.apply(this, l.args.map(a => this[a.name].f(obj)));
          },
          javaCode: javaCode
        }
      ]
    };

    foam.CLASS(m);

    let min = 0;
    for ( ; min < l.args.length && ! l.args[min].hasOwnProperty('value') ; min++ );
    foam.ascript.AScriptParser.FUNCTIONS[l.name] = {
      minArgs: min,
      maxArgs: l.args.length,
      build: function(a) {
        let args = {};
        for ( let i = 0 ; i < l.args.length ; i++ ) {
          args[l.args[i].name] = a[i];
        }
        return foam.mlang.expr[l.name].create(args);
      }
    }
  });
};


foam.ALANG([
  {
    name: 'LPAD',
    documentation: "Left pad the supplied string to the specified length using the supplied character, or '0' is not specified.",
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'len' },
      { class: 'String', name: 'ch', value: '0' }
    ],
    code: function(str, len, ch) {
      return foam.ascript.Lib.LPAD(str, len, ch || '0');
    },
    javaCode: 'return foam.ascript.Lib.LPAD(str, len, ch);'
  },
  {
    name: 'RPAD',
    documentation: "Right pad the supplied string to the specified length using the supplied character, or '0' is not specified.",
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'len' },
      { class: 'String', name: 'ch', value: '0' }
    ],
    code: function(str, len, ch) {
      return foam.ascript.Lib.RPAD(str, len, ch || '0');
    },
    javaCode: 'return foam.ascript.Lib.RPAD(str, len, ch);'
  },
  {
    name: 'DIFF', // 'diff' is reserved as an FObject method name
    documentation: 'The positive (absolute) difference between two numbers.',
    args: [ { class: 'Double', name: 'a1' }, { class: 'Double', name: 'a2' } ],
    code: function(a1, a2) { return foam.core.reflow.lib.diff(a1, a2); },
    javaCode: 'return Math.abs(a1 - a2);'
  },
  {
    name: 'FIX',
    documentation: 'Format a number to a fixed number of decimal places (default 0).',
    args: [ { class: 'Double', name: 'num' }, { class: 'Int', name: 'precision', value: 0 } ],
    code: function(num, precision) { return foam.ascript.Lib.FIX(num, precision); },
    javaCode: 'return foam.ascript.Lib.FIX(num, precision);'
  },
  {
    name: 'CURRENCY',
    documentation: 'Format a number with grouped thousands and a fixed precision (default 2).',
    args: [ { class: 'Double', name: 'amt' }, { class: 'Int', name: 'precision', value: 2 } ],
    code: function(amt, precision) { return foam.ascript.Lib.CURRENCY(amt, precision); },
    javaCode: 'return foam.ascript.Lib.CURRENCY(amt, precision);'
  },
  {
    name: 'MID',
    documentation: 'Return len characters of str starting at 1-based position start (Excel MID).',
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'start' },
      { class: 'Int',    name: 'len' }
    ],
    code: function(str, start, len) { return foam.ascript.Lib.MID(str, start, len); },
    javaCode: 'return foam.ascript.Lib.MID(str, start, len);'
  },
  {
    name: 'SUBSTR',
    documentation: 'JS-style substring: 0-based, end index exclusive (SUBSTR("hello",1,3)="el"). Second arg optional -> to end.',
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'start' },
      { class: 'Int',    name: 'end', value: -1 }   // -1 sentinel: "to end of string"
    ],
    code: function(str, start, end) { return foam.ascript.Lib.SUBSTR(str, start, end); },
    javaCode: 'return foam.ascript.Lib.SUBSTR(str, start, end);'
  },

  // ============================================================================
  // MATH & AGGREGATION FUNCTIONS
  // ============================================================================
/*
  {
    name: 'SUM',
    documentation: 'Adds all numbers in the supplied range.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.SUM.apply(null, arguments);
    },
    javaCode: `
      double sum = 0;
      for (Object arg : args) {
        if (arg instanceof Number) {
          sum += ((Number) arg).doubleValue();
        }
      }
      return sum;
    `
  },
  {
    name: 'AVERAGE',
    documentation: 'Returns the average of numbers in the supplied range.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.AVERAGE.apply(null, arguments);
    },
    javaCode: `
      double sum = 0;
      int count = 0;
      for (Object arg : args) {
        if (arg instanceof Number) {
          sum += ((Number) arg).doubleValue();
          count++;
        }
      }
      return count > 0 ? sum / count : 0;
    `
  },
  {
    name: 'COUNT',
    documentation: 'Counts the number of numeric values in the supplied range.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.COUNT.apply(null, arguments);
    },
    javaCode: `
      int count = 0;
      for (Object arg : args) {
        if (arg instanceof Number) count++;
      }
      return count;
    `
  },
  {
    name: 'COUNTA',
    documentation: 'Counts non-empty values in the supplied range.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.COUNTA.apply(null, arguments);
    },
    javaCode: `
      int count = 0;
      for (Object arg : args) {
        if (arg != null && !arg.toString().isEmpty()) count++;
      }
      return count;
    `
  },
  {
    name: 'MIN',
    documentation: 'Returns the smallest number in the supplied range.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.MIN.apply(null, arguments);
    },
    javaCode: `
      double min = Double.MAX_VALUE;
      int count = 0;
      for (Object arg : args) {
        if (arg instanceof Number) {
          min = Math.min(min, ((Number) arg).doubleValue());
          count++;
        }
      }
      return count > 0 ? min : 0;
    `
  },
  {
    name: 'MAX',
    documentation: 'Returns the largest number in the supplied range.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.MAX.apply(null, arguments);
    },
    javaCode: `
      double max = Double.MIN_VALUE;
      int count = 0;
      for (Object arg : args) {
        if (arg instanceof Number) {
          max = Math.max(max, ((Number) arg).doubleValue());
          count++;
        }
      }
      return count > 0 ? max : 0;
    `
  },
    */
  /*
  {
    name: 'PRODUCT',
    documentation: 'Multiplies all numbers in the supplied range.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.PRODUCT.apply(null, arguments);
    },
    javaCode: `
      double product = 1;
      for (Object arg : args) {
        if (arg instanceof Number) {
          product *= ((Number) arg).doubleValue();
        }
      }
      return product;
    `
    },
    */
  {
    name: 'MEDIAN',
    documentation: 'Returns the median value of numbers in the supplied range.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.MEDIAN.apply(null, arguments);
    },
    javaCode: `
      // Implementation would convert to List, sort, and return middle value
      return 0;
    `
  },

  // ============================================================================
  // ROUNDING FUNCTIONS
  // ============================================================================
  {
    name: 'ROUND',
    documentation: 'Rounds a number to the specified number of decimal digits.',
    args: [
      { class: 'Double', name: 'num' },
      { class: 'Int',    name: 'digits', value: 0 }
    ],
    code: function(num, digits) { return foam.ascript.Lib.ROUND(num, digits); },
    javaCode: 'return foam.ascript.Lib.ROUND(num, digits);'
  },
  {
    name: 'ROUNDUP',
    documentation: 'Rounds a number up to the specified number of decimal digits.',
    args: [
      { class: 'Double', name: 'num' },
      { class: 'Int',    name: 'digits', value: 0 }
    ],
    code: function(num, digits) { return foam.ascript.Lib.ROUNDUP(num, digits); },
    javaCode: 'return foam.ascript.Lib.ROUNDUP(num, digits);'
  },
  {
    name: 'ROUNDDOWN',
    documentation: 'Rounds a number down to the specified number of decimal digits.',
    args: [
      { class: 'Double', name: 'num' },
      { class: 'Int', name: 'digits', value: 0 }
    ],
    code: function(num, digits) { return foam.ascript.Lib.ROUNDDOWN(num, digits); },
    javaCode: 'return foam.ascript.Lib.ROUNDDOWN(num, digits);'
  },
  {
    name: 'INT',
    documentation: 'Rounds a number down to the nearest integer.',
    args: [
      { class: 'Double', name: 'num' }
    ],
    code: function(num) { return foam.ascript.Lib.INT(num); },
    javaCode: 'return Math.floor(num);'
  },
  /*
  {
    name: 'TRUNC',
    documentation: 'Truncates a number to an integer.',
    args: [
      { class: 'Double', name: 'num' },
      { class: 'Int', name: 'digits', value: 0 }
    ],
    code: function(num, digits) {
      return foam.ascript.Lib.TRUNC(num, digits);
    },
    javaCode: `
      double scale = Math.pow(10, digits);
      return Math.truncate(num * scale) / scale;
    `
    },
    */

  // ============================================================================
  // BASIC MATH FUNCTIONS
  // ============================================================================
  {
    name: 'ABS',
    documentation: 'Returns the absolute value of a number.',
    args: [
      { class: 'Double', name: 'num' }
    ],
    code: function(num) { return Math.abs(num); },
    javaCode: 'return Math.abs(num);'
  },
  {
    name: 'SQRT',
    documentation: 'Returns the square root of a number.',
    args: [
      { class: 'Double', name: 'num' }
    ],
    code: function(num) { return foam.ascript.Lib.SQRT(num); },
    javaCode: 'return Math.sqrt(num);'
  },
  {
    name: 'POWER',
    documentation: 'Returns a number raised to a power.',
    args: [
      { class: 'Double', name: 'num' },
      { class: 'Double', name: 'power' }
    ],
    code: function(num, power) { return Math.pow(num, power); },
    javaCode: 'return Math.pow(num, power);'
  },
  {
    name: 'MOD',
    documentation: 'Returns the remainder after division.',
    args: [
      { class: 'Double', name: 'num' },
      { class: 'Double', name: 'divisor' }
    ],
    code: function(num, divisor) { return num % divisor; },
    javaCode: 'return num % divisor;'
  },
  {
    name: 'SIGN',
    documentation: 'Returns the sign of a number (-1, 0, or 1).',
    args: [
      { class: 'Double', name: 'num' }
    ],
    code: function(num) { return Math.sign(num); },
    javaCode: 'return (int) Math.signum(num);'
  },

  // ============================================================================
  // LOGARITHM & EXPONENTIAL FUNCTIONS
  // ============================================================================
  {
    name: 'LN',
    documentation: 'Returns the natural logarithm of a number.',
    args: [
      { class: 'Double', name: 'num' }
    ],
    code: function(num) { return Math.log(num); },
    javaCode: 'return Math.log(num);'
  },
  {
    name: 'LOG',
    documentation: 'Returns the logarithm of a number to a specified base.',
    args: [
      { class: 'Double', name: 'num' },
      { class: 'Double', name: 'base', value: 10 }
    ],
    code: function(num, base) { return foam.ascript.Lib.LOG(num, base); },
    javaCode: 'return Math.log(num) / Math.log(base);'
  },
  {
    name: 'LOG10',
    documentation: 'Returns the base-10 logarithm of a number.',
    args: [
      { class: 'Double', name: 'num' }
    ],
    code: function(num) { return Math.log10(num); },
    javaCode: 'return Math.log10(num);'
  },
  {
    name: 'EXP',
    documentation: 'Returns e raised to the power of a number.',
    args: [
      { class: 'Double', name: 'num' }
    ],
    code: function(num) { return Math.exp(num); },
    javaCode: 'return Math.exp(num);'
  },

  // ============================================================================
  // TEXT FUNCTIONS
  // ============================================================================
  {
    name: 'UPPER',
    documentation: 'Converts text to uppercase.',
    args: [
      { class: 'String', name: 'text' }
    ],
    code: function(text) { return foam.ascript.Lib.UPPER(text); },
    javaCode: 'return foam.ascript.Lib.UPPER(text);'
  },
  {
    name: 'LOWER',
    documentation: 'Converts text to lowercase.',
    args: [
      { class: 'String', name: 'text' }
    ],
    code: function(text) { return foam.ascript.Lib.LOWER(text); },
    javaCode: 'return foam.ascript.Lib.LOWER(text);'
  },
  {
    name: 'PROPER',
    documentation: 'Capitalizes the first letter of each word in text.',
    args: [
      { class: 'String', name: 'text' }
    ],
    code: function(text) {
      return foam.ascript.Lib.PROPER(text);
    },
    javaCode: 'return foam.ascript.Lib.PROPER(text);'
  },
  {
    name: 'TRIM',
    documentation: 'Removes extra spaces from text.',
    args: [
      { class: 'String', name: 'text' }
    ],
    code: function(text) { return foam.ascript.Lib.TRIM(text); },
    javaCode: 'return foam.ascript.Lib.TRIM(text);'
  },
  {
    name: 'LEN',
    documentation: 'Returns the length of text.',
    args: [
      { class: 'String', name: 'text' }
    ],
    code: function(text) { return foam.ascript.Lib.LEN(text); },
    javaCode: 'return foam.ascript.Lib.LEN(text);'
  },
  {
    name: 'LEFT',
    documentation: 'Returns the leftmost characters from text.',
    args: [
      { class: 'String', name: 'text' },
      { class: 'Int',    name: 'numChars', value: 1 }
    ],
    code: function(text, numChars) { return foam.ascript.Lib.LEFT(text, numChars); },
    javaCode: 'return foam.ascript.Lib.LEFT(text, numChars);'
  },
  {
    name: 'RIGHT',
    documentation: 'Returns the rightmost characters from text.',
    args: [
      { class: 'String', name: 'text' },
      { class: 'Int',    name: 'numChars', value: 1 }
    ],
    code: function(text, numChars) { return foam.ascript.Lib.RIGHT(text, numChars); },
    javaCode: 'return foam.ascript.Lib.RIGHT(text, numChars);'
  },
  /*
  {
    name: 'CONCATENATE',
    documentation: 'Joins text strings together.',
    args: [
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(args) {
      return foam.ascript.Lib.CONCATENATE.apply(null, arguments);
    },
    javaCode: `
      StringBuilder sb = new StringBuilder();
      for (Object arg : args) {
        if (arg != null) sb.append(arg.toString());
      }
      return sb.toString();
    `
    },
  */
  /*
  {
    name: 'TEXTJOIN',
    documentation: 'Joins text with a delimiter, optionally ignoring empty values.',
    args: [
      { class: 'String', name: 'delimiter' },
      { class: 'Boolean', name: 'ignoreEmpty' },
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(delimiter, ignoreEmpty, args) {
      return foam.ascript.Lib.TEXTJOIN.apply(null, arguments);
    },
    javaCode: `
      StringBuilder sb = new StringBuilder();
      boolean first = true;
      for (Object arg : args) {
        String s = arg == null ? "" : arg.toString();
        if (ignoreEmpty && s.isEmpty()) continue;
        if (!first) sb.append(delimiter);
        sb.append(s);
        first = false;
      }
      return sb.toString();
    `
    },
    */
  {
    name: 'FIND',
    documentation: 'Finds text within text (case-sensitive).',
    args: [
      { class: 'String', name: 'findText' },
      { class: 'String', name: 'withinText' },
      { class: 'Int',    name: 'startNum', value: 1 }
    ],
    code: function(findText, withinText, startNum) {
      return foam.ascript.Lib.FIND(findText, withinText, startNum);
    },
    javaCode: 'return foam.ascript.Lib.FIND(findText, withinText, startNum);'
  },
  {
    name: 'SUBSTITUTE',
    documentation: 'Replaces text in a string.',
    args: [
      { class: 'String', name: 'text' },
      { class: 'String', name: 'oldText' },
      { class: 'String', name: 'newText' },
      { class: 'Int',    name: 'instanceNum', value: -1 }
    ],
    code: function(text, oldText, newText, instanceNum) {
      return foam.ascript.Lib.SUBSTITUTE(text, oldText, newText, instanceNum);
    },
    javaCode: 'return foam.ascript.Lib.SUBSTITUTE(text, oldText, newText, instanceNum);'
  },

  /*
  {
    name: 'SWITCH',
    documentation: 'Returns value based on expression match.',
    args: [
      { class: 'Object', name: 'expression' },
      { class: 'Object', name: 'args', isVarArgs: true }
    ],
    code: function(expression, args) {
      return foam.ascript.Lib.SWITCH.apply(null, arguments);
    },
    javaCode: `
      // args should come in pairs: value, result, value, result, ...
      for (int i = 0; i < args.length - 1; i += 2) {
        if (expression.equals(args[i])) return args[i + 1];
      }
      return args.length % 2 == 1 ? args[args.length - 1] : null;
    `
    },
    */

  // ============================================================================
  // TYPE CHECKING FUNCTIONS
  // ============================================================================
  {
    name: 'ISNUMBER',
    documentation: 'Checks if a value is a number.',
    args: [
      { class: 'Object', name: 'value' }
    ],
    code: function(value) { return foam.ascript.Lib.ISNUMBER(value); },
    javaCode: 'return value instanceof Number && !(Double.isNaN((Double) value));'
  },
  {
    name: 'ISTEXT',
    documentation: 'Checks if a value is text.',
    args: [
      { class: 'Object', name: 'value' }
    ],
    code: function(value) { return foam.ascript.Lib.ISTEXT(value); },
    javaCode: 'return value instanceof String;'
  },
  {
    name: 'ISBLANK',
    documentation: 'Checks if a value is empty.',
    args: [
      { class: 'Object', name: 'value' }
    ],
    code: function(value) { return foam.ascript.Lib.ISBLANK(value); },
    javaCode: 'return value == null || (value instanceof String && ((String) value).isEmpty());'
  }
]);
