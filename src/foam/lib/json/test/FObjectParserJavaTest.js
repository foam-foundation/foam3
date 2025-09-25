/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json.test',
  name: 'FObjectParserJavaTest',
  extends: 'foam.core.test.Test',

  documentation: 'Verify the system can parse an explicit java class which extends a modelled class',

  javaImports: [
    'foam.core.test.Test',
    'foam.lib.formatter.JSONFObjectFormatter',
    'foam.lib.json.FObjectParser',
    'foam.lib.json.JSONParser',
    'foam.lib.parse.Parser',
    'foam.lib.parse.ParserContext',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.StringPStream',
    'foam.util.SafetyUtil'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      var json = "{class:\\""+FObjectParserJavaTestClass.class.getName()+"\\", id:\\""+FObjectParserJavaTestClass.class.getSimpleName()+"\\"}";

      var f = new JSONFObjectFormatter(x);
      f.builder().append(json);

      var data = f.builder().toString();
      test ( ! SafetyUtil.isEmpty(data), "formatted" );

      var ps = new StringPStream();
      ps.setString(data);
      var xp = new ParserContextImpl();
      xp.set("X", x);
      ps = (StringPStream) ps.apply(FObjectParser.instance(), xp);
      test ( ps != null && ps.value() != null, "parsed");
      Test test = (Test) ps.value();
      test ( test.getClass() == FObjectParserJavaTestClass.class, "correct class "+test.getClass().getName());
      test ( test.getId().equals(FObjectParserJavaTestClass.class.getSimpleName()), "id set "+test.getId());
      `
    }
  ]
});
