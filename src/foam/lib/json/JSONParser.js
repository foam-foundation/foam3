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
    'foam.lib.parse.StringPStream'
  ],

  javaCode: `
    protected Parser        parser   = ExprParser.instance();
    protected StringPStream stringps = new StringPStream();

    public FObject parseString(String data, Class defaultClass) {
      StringPStream ps = stringps;

      ps.setString(data);
      ParserContext x = new ParserContextImpl();
      x.set("X", getX());
      try {
        ps = (StringPStream) ps.apply(defaultClass == null ? parser : ExprParser.create(defaultClass), x);
        return ps == null ? null : (FObject) ps.value();
      } catch ( Throwable t ) {
        return null;
      }
    }

    public Object[] parseStringForArray(String data, Class defaultClass) {
      StringPStream ps = stringps;
      ps.setString(data);
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
