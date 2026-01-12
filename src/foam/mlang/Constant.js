/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang',
  name: 'Constant',
  extends: 'foam.mlang.AbstractExpr',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'An Expression which always returns the same constant value.',
/*
  axioms: [
    foam.pattern.Multiton.create({property: 'value'})
  ],
  */

  properties: [
    {
      class: 'Object',
      name: 'value'
    }
  ],

  methods: [
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;',
    },
    {
      name: 'f',
      code: function() { return this.value; },
      swiftCode: 'return value',
      javaCode: 'return value_;'
    },
    {
      name: 'createStatement',
      javaCode: 'return " ? "; '
    },
    {
      name: 'prepareStatement',
      javaCode: 'stmt.setObject(getValue());'
    },

    function toString_(x) {
      return typeof x === 'number' ? '' + x :
        typeof x === 'string' ? '"' + x + '"' :
        typeof x === 'boolean' ? ( x ? 'true' : 'false' ) :
        x === null ? 'null' :
        x === undefined ? 'undefined' :
        Array.isArray(x) ? '[' + x.map(this.toString_.bind(this)).join(', ') + ']' :
        x && x.toString?.();
    },

    {
      name: 'toString',
      code: function() { return this.toString_(this.value); },
      javaCode: 'return getValue() == null ? null : getValue().toString();'
    },

    // TODO(adamvy): Re-enable when we can parse this in java more correctly.
    function xxoutputJSON(os) {
      os.output(this.value);
    },

    function toMQL() {
      if ( this.value && foam.Date.isInstance(this.value) ) {
        var isoDateString = this.value.toISOString();
        return isoDateString.substr(0, isoDateString.indexOf(':', isoDateString.indexOf(':') + 1));
      }

      if ( foam.String.isInstance(this.value) )
        return '\"' + this.value + '\"';
      return this.value;
    }
  ]
});
