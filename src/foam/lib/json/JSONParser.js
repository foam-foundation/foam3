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

  properties: [
    {
      class: 'Boolean',
      name: 'throwExceptions',
      value: false,
      documentation: 'If true, parsing errors will be thrown instead of returning null. Allows caller to handle errors explicitly.'
    },
    {
      class: 'Boolean',
      name: 'throwOnNull',
      value: false,
      documentation: 'If true, null parser results will throw an exception instead of returning null. Only takes effect when throwExceptions is true.'
    }
  ],

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

    public FObject parseString(String data, Class defaultClass) throws Exception {
      StringPStream ps = stringps;

      ps.setString(data);
      ParserContext x = new ParserContextImpl();
      x.set("X", getX());
      try {
        ps = (StringPStream) ps.apply(defaultClass == null ? parser : ExprParser.create(defaultClass), x);

        // Check for null parser result if throwOnNull is enabled
        if ( getThrowOnNull() && ps == null ) {
          throw new RuntimeException("Parser returned null - failed to parse JSON");
        }

        FObject result = ps == null ? null : (FObject) ps.value();

        // Check for null value if throwOnNull is enabled
        if ( getThrowOnNull() && result == null ) {
          throw new RuntimeException("Parser value is null - failed to extract object from parse result");
        }

        return result;
      } catch ( Throwable t ) {
        // If throwExceptions is enabled, re-throw with context
        if ( getThrowExceptions() ) {
          String preview = data != null && data.length() > 200 ? data.substring(0, 200) + "..." : data;
          throw new Exception("JSON parsing failed: " + t.getMessage() + " | JSON preview: " + preview, t);
        }
        // Default behavior: return null
        return null;
      }
    }

    public Object[] parseStringForArray(String data, Class defaultClass) throws Exception {
      StringPStream ps = stringps;
      ps.setString(data);
      ParserContext x = new ParserContextImpl();
      x.set("X", getX());

      try {
        ps = (StringPStream) ps.apply(FObjectArrayParser.create(defaultClass), x);

        // Check for null parser result if throwOnNull is enabled
        if ( getThrowOnNull() && ps == null ) {
          throw new RuntimeException("Parser returned null - failed to parse JSON array");
        }

        Object[] result = ps == null ? null : (Object[]) ps.value();

        // Check for null value if throwOnNull is enabled
        if ( getThrowOnNull() && result == null ) {
          throw new RuntimeException("Parser value is null - failed to extract array from parse result");
        }

        return result;
      } catch ( Throwable t ) {
        // If throwExceptions is enabled, re-throw with context
        if ( getThrowExceptions() ) {
          String preview = data != null && data.length() > 200 ? data.substring(0, 200) + "..." : data;
          throw new Exception("JSON parsing failed: " + t.getMessage() + " | JSON preview: " + preview, t);
        }
        // Default behavior: return null
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
