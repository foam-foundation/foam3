/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'FScript',
  extends: 'foam.mlang.AbstractExpr',

  javaImports: [
    'foam.lib.parse.PStream',
    'foam.lib.parse.ParserContext',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.StringPStream',
    'foam.parse.FScriptParser',
    'foam.lang.PropertyInfo'
  ],

  properties: [
    {
      class: 'String',
      name: 'query'
    },
    {
      class: 'Object',
      name: 'prop',
      javaType: 'PropertyInfo'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(o) {
        var pred = foam.parse.FScriptParser.create({of: o.cls_, thisValue: this.prop}).parseString(this.query);
        return pred ? pred.partialEval().f(o) : false;
      },
      javaCode: `
      FScriptParser parser;
      if ( getProp() != null ) {
        parser = FScriptParser.create(getProp());
      } else {
        parser = FScriptParser.create(((foam.lang.FObject) obj).getClassInfo());
      }
      StringPStream sps = new StringPStream();
      sps.setString(getQuery());
      PStream ps = sps;
      ParserContext x = new ParserContextImpl();
      ps = parser.parse(ps, x);
      if ( ps == null ) {
        foam.lib.parse.ErrorReportingPStream eps = new foam.lib.parse.ErrorReportingPStream(sps);
        parser.parse(eps, x);
        int pos = eps.getErrorPosition();

        System.err.println("FScript Syntax Error:: class: " + obj.getClass() + ", error: " + eps.getMessage());
        System.err.println("input: " + getQuery().substring(0, pos) + "<ERROR>" + getQuery().substring(pos));

        return Boolean.FALSE;
      }

      if ( ps.value() instanceof foam.mlang.Expr ) {
        return ((foam.mlang.Expr) ps.value()).f(obj);
      }

      return ((foam.mlang.predicate.Predicate) ps.value()).f(obj);
      `
    },
    {
      name: 'authorize',
      javaCode: `
        // The script is only a string until parsed against a class, so
        // without this "salary > 50000" would skip the salary
        // read-permission check. A script that does not parse reads nothing.
        if ( getProp() != null ) getProp().authorize(x, of);

        FScriptParser parser = getProp() != null ? FScriptParser.create(getProp()) : FScriptParser.create(of);
        StringPStream sps    = new StringPStream();
        sps.setString(getQuery());
        PStream ps = parser.parse(sps, new ParserContextImpl());
        if ( ps != null ) ((foam.mlang.PropertyAuthorizable) ps.value()).authorize(x, of);
      `
    }
  ]
});
