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
      testId = "OutputDefaultClassNames:false-OutputDefaultValues:true";
      formatter = new JSONFObjectFormatter();
      formatter.setOutputDefaultClassNames(false);
      formatter.setOutputDefaultValues(true);
      var rg = new foam.core.ruler.RuleGroup();
      rg.setId(this.getClass().getSimpleName());
      // predicate defaults to TRUE
      formatter.output(rg);
      json = formatter.builder().toString();
      test ( ! SafetyUtil.isEmpty(json) && json.contains(":,"), testId+" INVALID json generated "+json.toString());
      parser = new JSONParser();
      try {
        Object o = parser.parseString(json);
        test ( o == null, testId+" json NOT parsed");
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
      // formatter.setOutputDefaultClassNames(true); - default
      formatter.setOutputDefaultValues(true);
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

      // Test with OutputDefaultValues=false (JRL default) - the actual use case from PR
      // When OutputDefaultValues=false, the empty Address outputs nothing except the class
      testId = "EmptyFObjectProperty-JRLDefaults";
      formatter = new JSONFObjectFormatter();
      // OutputDefaultClassNames=true (default)
      // OutputDefaultValues=false (default) - mimics JRL behavior
      user = new User();
      user.setId(12345L);
      user.setAddress(new Address()); // Empty/default address
      formatter.output(user);
      json = formatter.builder().toString();
      // With default settings (JRL-like), empty Address should still have class output
      test ( ! SafetyUtil.isEmpty(json) && ! json.contains(":,"), testId+" valid json generated");
      test ( json.contains("address") && json.contains("foam.core.auth.Address"), testId+" address with class present: "+json);

      // Test outputting enum with custom javaCode
      testId = "EnumWithCustomJavaCode";
      formatter = new JSONFObjectFormatter();
      formatter.output(foam.test.TestEnum.CUSTOM);
      json = formatter.builder().toString();
      test ( ! SafetyUtil.isEmpty(json) && ! json.contains("$"), testId+" valid json generated: " + json);
      `
    }
  ]
})
