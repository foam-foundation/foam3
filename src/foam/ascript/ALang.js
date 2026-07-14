/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/** Generate models for AScript Library and register in foam.alib registry. **/
// To debug Java code-generation in browser, load with ?genjava=true flag
foam.ALIB = function(ms) {
  ms.forEach(l => {
    l.aName = l.aName || l.name.toUpperCase();

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
      name: l.aName,
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
    foam.ascript.AScriptParser.FUNCTIONS[l.aName] = {
      minArgs: min,
      maxArgs: l.args.length,
      build: function(a) {
        let args = {};
        for ( let i = 0 ; i < l.args.length ; i++ ) {
          args[l.args[i].name] = a[i];
        }
        return foam.mlang.expr[l.aName].create(args);
      }
    }
  });
};


foam.ALIB([
  {
    name: 'lPad',
    documentation: "Left pad the supplied string to the specified length using the supplied character, or '0' is not specified.",
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'len' },
      { class: 'String', name: 'ch', value: '0' }
    ],
    code: function(str, len, ch) {
      return foam.core.reflow.lib.lPad(str, len, ch || '0');
    },
    javaCode: `
      if ( str == null ) str = "";
      if ( ch == null || ch.isEmpty() ) ch = "0";
      int padLen = len - str.length();
      if ( padLen <= 0 ) return str;
      StringBuilder sb = new StringBuilder(len);   // final length is exactly len
      while ( sb.length() < padLen ) sb.append(ch);
      sb.setLength(padLen);                        // trim multi-char-pad overshoot (matches padStart)
      sb.append(str);
      return sb.toString();    `
  },
  {
    name: 'rPad',
    documentation: "Right pad the supplied string to the specified length using the supplied character, or '0' is not specified.",
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'len' },
      { class: 'String', name: 'ch', value: '0' }
    ],
    code: function(str, len, ch) {
      return foam.core.reflow.lib.rPad(str, len, ch || '0');
    },
    javaCode: `
      if ( str == null ) str = "";
      if ( ch == null || ch.isEmpty() ) ch = "0";
      int padLen = len - str.length();
      if ( padLen <= 0 ) return str;
      StringBuilder sb = new StringBuilder(len);
      sb.append(str);
      while ( sb.length() < len ) sb.append(ch);
      sb.setLength(len);                           // trim overshoot (matches padEnd)
      return sb.toString();
    `
  },
  {
    name: 'diff', // 'diff' is reserved as an FObject method name
    documentation: 'The positive (absolute) difference between two numbers.',
    args: [ { class: 'Double', name: 'a1' }, { class: 'Double', name: 'a2' } ],
    code: function(a1, a2) { return foam.core.reflow.lib.diff(a1, a2); },
    javaCode: `return Math.abs(a1 - a2);`
  },
  {
    name: 'fix',
    documentation: 'Format a number to a fixed number of decimal places (default 0).',
    args: [ { class: 'Double', name: 'num' }, { class: 'Int', name: 'precision', value: 0 } ],
    code: function(num, precision) { return foam.core.reflow.lib.fix(num, precision); },
    javaCode: `return String.format("%." + precision + "f", num);`
  },
  {
    name: 'currency',
    documentation: 'Format a number with grouped thousands and a fixed precision (default 2).',
    args: [ { class: 'Double', name: 'amt' }, { class: 'Int', name: 'precision', value: 2 } ],
    code: function(amt, precision) { return foam.core.reflow.lib.currency(amt, precision); },
    javaCode: `
      java.text.NumberFormat nf = java.text.NumberFormat.getNumberInstance();
      nf.setMaximumFractionDigits(precision);
      return nf.format(amt);
  `
  },
  {
    name: 'mid',
    aName: 'MID',
    documentation: 'Return len characters of str starting at 1-based position start (Excel MID).',
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'start' },
      { class: 'Int',    name: 'len' }
    ],
    code: function(str, start, len) {
      if ( str == null ) return '';
      str = '' + str;
      var begin = Math.max(0, start - 1);
      if ( begin >= str.length || len <= 0 ) return '';
      return str.substring(begin, Math.min(str.length, begin + len));
    },
    javaCode: `
      if ( str == null ) return "";
      int begin = Math.max(0, start - 1);
      if ( begin >= str.length() || len <= 0 ) return "";
      return str.substring(begin, Math.min(str.length(), begin + len));
  `
  },
  {
    name: 'substr',
    aName: 'SUBSTR',
    documentation: 'JS-style substring: 0-based, end index exclusive (SUBSTR("hello",1,3)="el"). Second arg optional -> to end.',
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'start' },
      { class: 'Int',    name: 'end', value: -1 }   // -1 sentinel: "to end of string"
    ],
    code: function(str, start, end) {
      if ( str == null ) return '';
      str = '' + str;
      return str.substring(start, end < 0 ? str.length : end);
    },
    javaCode: `
      if ( str == null ) return "";
      int e = end < 0 ? str.length() : Math.min(end, str.length());
      int s = Math.max(0, Math.min(start, e));
      return str.substring(s, e);
    `
  }
]);
