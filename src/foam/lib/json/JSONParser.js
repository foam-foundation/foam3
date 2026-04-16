/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json',
  name: 'JSONParser',

  // Note: JSONParser.java has a limitation - the class has to be
  // the first key, to avoid having to build an intermediate object
  // to hold all the args while we parse

  javaImports: [
    'foam.lang.FObject',
    'foam.lib.parse.Parser',
    'foam.lib.parse.ParserContext',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.FastStringPStream',
    'foam.lib.parse.PooledStringPStream',
    'foam.lib.parse.StringPStream'
  ],

  javaCode: `
    protected Parser parser = ExprParser.instance();

    public FObject parseString(String data, Class defaultClass) {
      StringPStream ps = new StringPStream(data);
      ParserContext x = new ParserContextImpl();
      x.set("X", getX());
      try {
        ps = (StringPStream) ps.apply(defaultClass == null ? parser : ExprParser.create(defaultClass), x);
        return ps == null ? null : (FObject) ps.value();
      } catch ( Throwable t ) {
        return null;
      }
    }

    public FObject parseStringPooled(String data, Class defaultClass, PooledStringPStream pooledPs) {
      pooledPs.setString(data);
      ParserContext x = new ParserContextImpl();
      x.set("X", getX());
      try {
        foam.lib.parse.PStream result = pooledPs.apply(
          defaultClass == null ? parser : ExprParser.create(defaultClass), x);
        return result == null ? null : (FObject) result.value();
      } catch ( Throwable t ) {
        return null;
      }
    }

    public FObject parseStringFast(String data, Class defaultClass, FastStringPStream fps) {
      fps.setString(data);
      ParserContext x = new ParserContextImpl();
      x.set("X", getX());
      try {
        foam.lib.parse.PStream result = fps.apply(
          defaultClass == null ? parser : ExprParser.create(defaultClass), x);
        return result == null ? null : (FObject) result.value();
      } catch ( Throwable t ) {
        return null;
      }
    }

    public FObject parseStringCircular(String data, Class defaultClass) {
      foam.lib.parse.CircularStringPStream cps = new foam.lib.parse.CircularStringPStream(data);
      ParserContext x = new ParserContextImpl();
      x.set("X", getX());
      try {
        foam.lib.parse.PStream result = cps.apply(
          defaultClass == null ? parser : ExprParser.create(defaultClass), x);
        return result == null ? null : (FObject) result.value();
      } catch ( Throwable t ) {
        return null;
      }
    }

    public Object[] parseStringForArray(String data, Class defaultClass) {
      StringPStream ps = new StringPStream(data);
      ParserContext x = new ParserContextImpl();
      x.set("X", getX());

      try {
        ps = (StringPStream) ps.apply(FObjectArrayParser.create(defaultClass), x);
        return ps == null ? null : (Object[]) ps.value();
      } catch ( Throwable t ) {
        return null;
      }
    }
 `,

  methods: [
    {
      name: 'parseString',
      args: 'String data',
      type: 'FObject',
      javaCode: 'return parseString(data, null);'
    }
  ]
});
