/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.formatter.test',
  name: 'JSONFObjectFormatterParserTest',
  extends: 'foam.core.test.Test',

  documentation: 'Test formatting and parsing json',

  javaImports: [
    'foam.core.auth.Address',
    'foam.core.auth.User',
    'foam.lib.formatter.JSONFObjectFormatter',
    'foam.lib.json.JSONParser',
    'foam.util.SafetyUtil'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      String json = null;
      String testId = null;

      // Test output and parsing of fobject with predicate TRUE/FALSE.
      // The TRUE/FALSE predicate only outputs it's default class name

      // This combination should produce invalid json.
      // Setting OutputDefaultClassNames(false) will set OutputDefaultValues(false)
      // but this test case explicitly setOutputDefaultValues(true)
      var rg = new foam.core.ruler.RuleGroup();
      rg.setId(this.getClass().getSimpleName());

      testId = "OutputDefaultClassNames:true-OutputDefaultValues:false";
      json = testJSONFObjectFormatter(testId, rg, true, false, rg.getClassInfo());
      test ( json.contains("foam.core.ruler.RuleGroup"), testId+" -- output obj class name");
      test ( ! json.contains("priority:") && ! json.contains("predicate:"), testId+" -- do not output properties default value");

      testId = "OutputDefaultClassNames:false-OutputDefaultValues:false";
      json = testJSONFObjectFormatter(testId, rg, false, false, rg.getClassInfo());
      test ( ! json.contains("foam.core.ruler.RuleGroup"), testId+" -- do not output obj class name");
      test ( ! json.contains("priority:") && ! json.contains("predicate:"), testId+" -- do not output properties default value");

      testId = "OutputDefaultClassNames:false-OutputDefaultValues:false-DefaultClass:null";
      json = testJSONFObjectFormatter(testId, rg, false, false, null);
      test ( json.contains("foam.core.ruler.RuleGroup"), testId+" -- output obj class name");
      test ( ! json.contains("priority:") && ! json.contains("predicate:"), testId+" -- do not output properties default value");

      testId = "OutputDefaultClassNames:false-OutputDefaultValues:true";
      json = testJSONFObjectFormatter(testId, rg, false, true, rg.getClassInfo());
      test ( ! json.contains("foam.core.ruler.RuleGroup"), testId+" -- do not output obj class name");
      test ( json.contains("priority:10") && json.contains("foam.mlang.predicate.True"), testId+" -- output properties default value");

      rg = new foam.core.ruler.RuleGroup(); // initialize new object because properties factory of the old object has already been invoked
      testId = "OutputDefaultClassNames:false-OutputDefaultValues:true-DefaultClass:null";
      json = testJSONFObjectFormatter(testId, rg, false, true, null);
      test ( json.contains("foam.core.ruler.RuleGroup"), testId+" -- output obj class name");
      test ( json.contains("priority:10") && json.contains("foam.mlang.predicate.True"), testId+" -- output properties default value");

      rg = new foam.core.ruler.RuleGroup();
      testId = "OutputDefaultClassNames:true-OutputDefaultValues:true";
      json = testJSONFObjectFormatter(testId, rg, true, true, rg.getClassInfo());
      test ( json.contains("foam.core.ruler.RuleGroup"), testId+" -- output obj class name");
      test ( json.contains("priority:10") && json.contains("foam.mlang.predicate.True"), testId+" -- output properties default value");

      // test outputting property after factory is invoked
      rg = new foam.core.ruler.RuleGroup();
      rg.getPredicate();
      testId = "OutputDefaultClassNames:true-OutputDefaultValues:false-InvokePropertyFactory";
      json = testJSONFObjectFormatter(testId, rg, false, false, rg.getClassInfo());
      test ( json.contains("foam.mlang.predicate.True"), testId+" -- output properties set by factory");
      test ( ! json.contains("priority:10"), testId+" -- do not output unset properties");

      // test outputting empty fobject property
      var user = new User();
      user.setId(12345L);
      user.setAddress(new Address()); // Empty address

      testId = "OutputDefaultClassNames:true-OutputDefaultValues:false-EmptyFObjectProperty";
      json = testJSONFObjectFormatter(testId, user, true, false, user.getClassInfo());
      test ( json.contains("address:{class:\\\"foam.core.auth.Address\\\"}"), testId+" -- output empty fobject property");

      testId = "OutputDefaultClassNames:false-OutputDefaultValues:false-EmptyFObjectProperty";
      json = testJSONFObjectFormatter(testId, user, false, false, user.getClassInfo());
      test ( json.contains("address:{class:\\\"foam.core.auth.Address\\\"}"), testId+" -- output empty fobject property");

      // test outputting enum with custom javaCode
      testId = "EnumWithCustomJavaCode";
      var formatter = new JSONFObjectFormatter();
      formatter.output(foam.test.TestEnum.CUSTOM);
      json = formatter.builder().toString();
      test ( ! SafetyUtil.isEmpty(json) && ! json.contains("$"), testId+" -- do not output java anonymous class name: " + json);
      `
    },
    {
      name: 'testJSONFObjectFormatter',
      type: 'String',
      args: 'String testId, FObject obj, Boolean outputDefaultClassNames, Boolean outputDefaultValues, foam.lang.ClassInfo defaultCls',
      javaCode: `
        var fmt = new JSONFObjectFormatter();
        fmt.setOutputDefaultClassNames(outputDefaultClassNames);
        fmt.setOutputDefaultValues(outputDefaultValues);
        fmt.output(obj, defaultCls);

        String json = fmt.builder().toString();

        var parser = new JSONParser();
        try {
          Object o = parser.parseString(json, defaultCls != null ? defaultCls.getObjClass() : null);
          test( o != null, testId + " generate valid json: " + json );
        } catch ( Throwable t ) {
          test( false, testId + " error parsing: " + t.getMessage() );
        }
        return json;
      `
    }
  ]
})
