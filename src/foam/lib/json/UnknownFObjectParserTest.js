/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json',
  name: 'UnknownFObjectParserTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.lib.parse.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // setup parser
        var parser  = UnknownFObjectParser.instance();
        var psx     = new ParserContextImpl();

        // parse json
        var input = "{\\"key\\":\\"value\\",\\"key2\\":true,\\"key3\\":null,\\"key4\\":{\\"foo\\":\\"bar\\"},\\"key5\\":[true,false,null,\\"text\\",1.23]}";
        var ps = new StringPStream(input);
        ps = (StringPStream) ps.apply(parser, psx);
        test ( ps != null && ((UnknownFObject) ps.value()).getJson().equals(input), "Parsed json, input:" + input );

        // parse empty json
        var input2 = "{}";
        ps = new StringPStream(input2);
        ps = (StringPStream) ps.apply(parser, psx);
        test ( ps != null && ((UnknownFObject) ps.value()).getJson().equals(input2), "Parsed empty json, input:" + input2 );

        // parse json with un-quoted key
        var input3 = "{key:\\"}\\"}";
        ps = new StringPStream(input3);
        ps = (StringPStream) ps.apply(parser, psx);
        test ( ps != null && ((UnknownFObject) ps.value()).getJson().equals("{\\"key\\":\\"}\\"}"), "Parsed json with un-quoted key, input:" + input3 );

        // parse json with comment line before key:value
        var input4 = "{//comment1 \\n key:\\"1\\"," + "//comment2 \\n key2:\\"2\\"}";
        var input4_print = "{//comment1 \\\\n key:\\"1\\"," + "//comment2 \\\\n key2:\\"2\\"}";
        ps = new StringPStream(input4);
        ps = (StringPStream) ps.apply(parser, psx);
        test ( ps != null && ((UnknownFObject) ps.value()).getJson().equals("{\\"key\\":\\"1\\",\\"key2\\":\\"2\\"}"), "Parsed json with comment above properties, input:" + input4_print );

        // parse empty json with just comments
        var input5 = "{// comment1 \\n  // comment2 \\n}";
        var input5_print = "{// comment1 \\\\n  // comment2 \\\\n}";
        ps = new StringPStream(input5);
        ps = (StringPStream) ps.apply(parser, psx);
        test ( ps != null && ((UnknownFObject) ps.value()).getJson().equals("{}"), "Parsed empty json with just comment, input:" + input5_print );
      `
    }
  ]
});
