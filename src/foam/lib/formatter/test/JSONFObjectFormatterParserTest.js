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

      JSONFObjectFormatter formatter = null;
      JSONParser parser = null;
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
      test ( json.contains("foam.core.ruler.RuleGroup"), testId+" should output obj class name");
      test ( ! json.contains("priority:") && ! json.contains("predicate:"), testId+" should not output properties default value");

      testId = "OutputDefaultClassNames:false-OutputDefaultValues:false";
      json = testJSONFObjectFormatter(testId, rg, false, false, rg.getClassInfo());
      test ( ! json.contains("foam.core.ruler.RuleGroup"), testId+" should not output obj class name");
      test ( ! json.contains("priority:") && ! json.contains("predicate:"), testId+" should not output properties default value");

      testId = "OutputDefaultClassNames:false-OutputDefaultValues:false-DefaultClass:null";
      json = testJSONFObjectFormatter(testId, rg, false, false, null);
      test ( json.contains("foam.core.ruler.RuleGroup"), testId+" should output obj class name");
      test ( ! json.contains("priority:") && ! json.contains("predicate:"), testId+" should not output properties default value");

      testId = "OutputDefaultClassNames:false-OutputDefaultValues:true";
      json = testJSONFObjectFormatter(testId, rg, false, true, rg.getClassInfo());
      test ( ! json.contains("foam.core.ruler.RuleGroup"), testId+" should not output obj class name");
      test ( json.contains("priority:10") && json.contains("foam.mlang.predicate.True"), testId+" should output properties default value");

      rg = new foam.core.ruler.RuleGroup(); // initialize new object because properties factory of the old object has already been invoked
      testId = "OutputDefaultClassNames:false-OutputDefaultValues:true-DefaultClass:null";
      json = testJSONFObjectFormatter(testId, rg, false, true, null);
      test ( json.contains("foam.core.ruler.RuleGroup"), testId+" should output obj class name");
      test ( json.contains("priority:10") && json.contains("foam.mlang.predicate.True"), testId+" should output properties default value");

      rg = new foam.core.ruler.RuleGroup();
      testId = "OutputDefaultClassNames:true-OutputDefaultValues:true";
      json = testJSONFObjectFormatter(testId, rg, true, true, rg.getClassInfo());
      test ( json.contains("foam.core.ruler.RuleGroup"), testId+" should output obj class name");
      test ( json.contains("priority:10") && json.contains("foam.mlang.predicate.True"), testId+" should output properties default value");

      // test outputting property after factory is invoked
      rg = new foam.core.ruler.RuleGroup();
      rg.getPredicate();
      testId = "OutputDefaultClassNames:true-OutputDefaultValues:false-InvokePropertyFactory";
      json = testJSONFObjectFormatter(testId, rg, false, false, rg.getClassInfo());
      test ( json.contains("foam.mlang.predicate.True"), testId+" should output properties set by factory");
      test ( ! json.contains("priority:10"), testId+" should output unset properties");



      if (true) return;




      parser = new JSONParser();
      try {
        Object o = parser.parseString(json);
        test ( o != null, testId+" valid json generated. " + json);
      } catch ( Throwable t ) {
        // Should fail parsing, but not through exception
        test ( false, testId+" Error parsing: "+t.getMessage());
      }

      testId = "OutputDefaultClassNames:true-OutputDefaultValues:true";
      formatter = new JSONFObjectFormatter();
      // formatter.setOutputDefaultClassNames(true); - default
      formatter.setOutputDefaultValues(true);
      rg = new foam.core.ruler.RuleGroup();
      rg.setId(this.getClass().getSimpleName());
      // predicate defaults to TRUE
      formatter.output(rg);
      json = formatter.builder().toString();

      test ( ! SafetyUtil.isEmpty(json) && ! json.contains(":,"), testId+" valid json generated: "+json.toString());
      parser = new JSONParser();
      try {
        Object o = parser.parseString(json);
        test ( o != null, testId+" json parsed");
      } catch ( Throwable t ) {
        test ( false, testId+" Error parsing: "+t.getMessage());
      }

      testId = "OutputDefaultClassNames:true-OutputDefaultValues:false";
      formatter = new JSONFObjectFormatter();
      // formatter.setOutputDefaultClassNames(true); - default
      // formatter.setOutputDefaultValues(false); - default
      rg = new foam.core.ruler.RuleGroup();
      rg.setId(this.getClass().getSimpleName());
      // predicate defaults to TRUE
      formatter.output(rg);
      json = formatter.builder().toString();
      test ( ! SafetyUtil.isEmpty(json) && ! json.contains(":,"), testId+" valid json generated: "+json.toString());
      parser = new JSONParser();
      try {
        Object o = parser.parseString(json);
        test ( o != null, testId+" json parsed");
      } catch ( Throwable t ) {
        test ( false, testId+" Error parsing: "+t.getMessage());
      }

      testId = "OutputDefaultClassNames:false-OutputDefaultValues:false";
      formatter = new JSONFObjectFormatter();
      formatter.setOutputDefaultClassNames(false);
      // formatter.setOutputDefaultValues(false); - default
      rg = new foam.core.ruler.RuleGroup();
      rg.setId(this.getClass().getSimpleName());
      // predicate defaults to TRUE
      formatter.output(rg);
      json = formatter.builder().toString();
      test ( ! SafetyUtil.isEmpty(json) && ! json.contains(":,"), testId+" valid json generated: "+json.toString());
      parser = new JSONParser();
      try {
        Object o = parser.parseString(json);
        test ( o != null, testId+" json parsed");
      } catch ( Throwable t ) {
        test ( false, testId+" Error parsing: "+t.getMessage());
      }

      // ============================================================
      // Test empty/default FObjectProperty (like User.address)
      // When OutputDefaultClassNames=true, empty FObjects should output {class:"..."}
      // ============================================================

      testId = "EmptyFObjectProperty-OutputDefaultClassNames:true";
      formatter = new JSONFObjectFormatter();
      formatter.setOutputDefaultClassNames(true);

      var user = new User();
      user.setId(12345L);
      user.setAddress(new Address()); // Empty/default address
      formatter.output(user);
      json = formatter.builder().toString();
      // Should contain address with at least the class
      test ( ! SafetyUtil.isEmpty(json) && ! json.contains(":,"), testId+" valid json generated (no empty values)");
      test ( json.contains("address") && json.contains("foam.core.auth.Address"), testId+" address with class present: "+json);
      parser = new JSONParser();
      try {
        Object o = parser.parseString(json);
        test ( o != null, testId+" json parsed successfully");
        if ( o instanceof User ) {
          User parsedUser = (User) o;
          test ( parsedUser.getAddress() != null, testId+" parsed user has address object");
        }
      } catch ( Throwable t ) {
        test ( false, testId+" Error parsing: "+t.getMessage());
      }

      // ============================================================
      // Test empty/default FObjectProperty (like User.address)
      // When OutputDefaultClassNames=false, empty FObjects should output {}
      // ============================================================
      testId = "EmptyFObjectProperty-OutputDefaultClassNames:false";
      formatter = new JSONFObjectFormatter();
      formatter.setOutputDefaultClassNames(false);

      formatter.output(user);
      json = formatter.builder().toString();
      test ( json.contains("address:{}"), testId+" output address as empty json: "+json);

      // Test outputting enum with custom javaCode
      testId = "EnumWithCustomJavaCode";
      formatter = new JSONFObjectFormatter();
      formatter.output(foam.test.TestEnum.CUSTOM);
      json = formatter.builder().toString();
      test ( ! SafetyUtil.isEmpty(json) && ! json.contains("$"), testId+" valid json generated: " + json);
      `
    }
  ],

  javaCode: `
    protected String testJSONFObjectFormatter(String testId, foam.lang.FObject obj, boolean outputDefaultClassNames, boolean outputDefaultValues) {
      return testJSONFObjectFormatter(testId, obj, outputDefaultClassNames, outputDefaultValues, null);
    }

    protected String testJSONFObjectFormatter(String testId, foam.lang.FObject obj, boolean outputDefaultClassNames, boolean outputDefaultValues, foam.lang.ClassInfo defaultCls) {
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
    }
  `
})
