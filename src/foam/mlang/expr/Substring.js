/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'Substring',
  extends: 'foam.mlang.AbstractExpr',
  implements: [ 'foam.lang.Serializable' ],

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1'
    },
    {
      class: 'Int',
      name: 'start'
    },
    {
      class: 'Int',
      name: 'end',
      value: -1
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(obj) {
        var v = this.arg1 ? this.arg1.f(obj) : null;
        if ( v == null ) return null;

        var s = String(v);
        var start = this.start;
        var end = this.end;

        if ( start == null || start < 0 ) return null;
        if ( start > s.length ) return null;

        if ( end == null || end < 0 ) return s.substring(start);
        if ( end < start ) return null;

        return s.substring(start, Math.min(end, s.length));
      },
      javaCode: `
        Object v = getArg1() == null ? null : getArg1().f(obj);
        if ( v == null ) return null;

        String s = v.toString();
        int start = getStart();
        int end = getEnd();

        if ( start < 0 ) return null;
        if ( start > s.length() ) return null;

        if ( end < 0 ) return s.substring(start);
        if ( end < start ) return null;
        if ( end > s.length() ) end = s.length();

        return s.substring(start, end);
      `
    },
    {
      name: 'toString',
      code: function() {
        return 'Substring(' + this.arg1 + ', ' + this.start +
          ( this.end != null && this.end >= 0 ? (', ' + this.end) : '' ) + ')';
      },
      javaCode: `
        return "Substring(" + getArg1() + ", " + getStart() +
          ( getEnd() >= 0 ? (", " + getEnd()) : "" ) + ")";
      `
    }
  ]
});

