/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.json.test',
  name: 'ReentrantParseTestModel',

  documentation: `
    Test model that triggers a reentrant JSONParser.parseString() call
    during its own JSON deserialization. Used by JSONParserReentrancyTest
    to verify that reentrant parsing does not corrupt the outer parse.

    When the 'trigger' property is set during parsing, its javaPostSet
    calls parseString() on the same JSONParser instance (stored in a
    static field by the test). This simulates what happens in production
    when a RELATIONSHIP javaPostSet calls DAO.find() which triggers
    journal replay on the same ThreadLocal JSONParser.
  `,

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'trigger',
      javaPostSet: `
        // Simulate reentrant parsing: when this property is set during
        // JSON deserialization, call parseString on the same parser.
        foam.lib.json.JSONParser p = foam.lib.json.JSONParserReentrancyTest.reentrantTestParser_;
        if ( p != null ) {
          foam.lib.json.JSONParserReentrancyTest.reentrantTestResult_ =
            p.parseString("{class:\\"foam.core.test.Test\\",id:\\"nested-reentrant\\"}", null);
        }
      `
    },
    {
      class: 'String',
      name: 'afterTrigger',
      documentation: 'Property parsed AFTER trigger — will fail to parse if the reentrant call corrupted the stream'
    }
  ]
});

foam.CLASS({
  package: 'foam.lib.json',
  name: 'JSONParserReentrancyTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Tests that JSONParser.parseString() is safe for reentrant use.

    Bug: JSONParser previously reused a single StringPStream field across
    parseString() calls. StringPStream uses a shared Reference<CharSequence>
    that propagates to ALL derived PStreams (via tail() and setValue()).
    When pi.set() during parsing triggers a javaPostSet that calls
    DAO.find() -> journal replay -> parseString() on the SAME ThreadLocal
    JSONParser, setString() mutated the shared Reference, corrupting the
    outer parse's entire PStream chain.

    Fix: JSONParser now creates a new StringPStream(data) per parseString()
    call. Each call gets its own Reference, so reentrant calls cannot
    corrupt the outer parse.
  `,

  javaImports: [
    'foam.lang.FObject',
    'foam.lib.json.JSONParser',
    'foam.lib.parse.*'
  ],

  javaCode: `
    // Static fields used by ReentrantParseTestModel's javaPostSet to trigger
    // and capture results of reentrant parseString() calls during parsing.
    public static volatile JSONParser reentrantTestParser_ = null;
    public static volatile FObject   reentrantTestResult_  = null;
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testReentrantParseString(x);
        testSequentialParseString(x);
        testNestedFObjectParsing(x);
      `
    },
    {
      name: 'testReentrantParseString',
      args: 'Context x',
      documentation: 'Verify that calling parseString() reentrantly during parsing does not corrupt the outer parse',
      javaCode: `
        // This test replicates the actual bug: during JSON parsing of a model,
        // a property's javaPostSet calls parseString() on the SAME JSONParser.
        //
        // ReentrantParseTestModel has a 'trigger' property whose javaPostSet
        // reads the static reentrantTestParser_ field and calls parseString().
        // The 'afterTrigger' property comes AFTER 'trigger' in the JSON — if
        // the reentrant call corrupts the StringPStream, 'afterTrigger' will
        // fail to parse.

        JSONParser parser = new JSONParser();
        parser.setX(x);

        // Set up: store the parser so the model's javaPostSet can call it reentrantly
        reentrantTestParser_ = parser;
        reentrantTestResult_ = null;

        try {
          // Parse a ReentrantParseTestModel. Property order matters:
          // 1. 'id' is parsed first (normal)
          // 2. 'trigger' is parsed — javaPostSet fires, calling parseString on SAME parser
          // 3. 'afterTrigger' is parsed — THIS FAILS with old code because StringPStream is corrupted
          FObject obj = parser.parseString(
            "{class:\\"foam.lib.json.test.ReentrantParseTestModel\\",id:\\"outer\\",trigger:\\"go\\",afterTrigger:\\"survived\\"}",
            null
          );

          test(obj != null, "Reentrant: outer parse succeeds");

          if ( obj != null ) {
            foam.lib.json.test.ReentrantParseTestModel model =
              (foam.lib.json.test.ReentrantParseTestModel) obj;

            test("outer".equals(model.getId()),
              "Reentrant: outer id is 'outer', got '" + model.getId() + "'");

            test("go".equals(model.getTrigger()),
              "Reentrant: trigger is 'go', got '" + model.getTrigger() + "'");

            test("survived".equals(model.getAfterTrigger()),
              "Reentrant: afterTrigger parsed correctly after reentrant call, got '" + model.getAfterTrigger() + "'");
          }

          test(reentrantTestResult_ != null, "Reentrant: nested parseString also succeeded");

          if ( reentrantTestResult_ != null ) {
            String nestedId = ((foam.core.test.Test) reentrantTestResult_).getId();
            test("nested-reentrant".equals(nestedId),
              "Reentrant: nested object id is 'nested-reentrant', got '" + nestedId + "'");
          }
        } finally {
          // Clean up static state
          reentrantTestParser_ = null;
          reentrantTestResult_ = null;
        }
      `
    },
    {
      name: 'testSequentialParseString',
      args: 'Context x',
      documentation: 'Verify sequential parseString calls produce correct independent results',
      javaCode: `
        JSONParser parser = new JSONParser();
        parser.setX(x);

        String json1 = "{class:\\"foam.core.test.Test\\",id:\\"first\\"}";
        String json2 = "{class:\\"foam.core.test.Test\\",id:\\"second\\"}";
        String json3 = "{class:\\"foam.core.test.Test\\",id:\\"third\\"}";

        FObject obj1 = parser.parseString(json1, null);
        FObject obj2 = parser.parseString(json2, null);
        FObject obj3 = parser.parseString(json3, null);

        test(obj1 != null, "Sequential: first parse succeeds");
        test(obj2 != null, "Sequential: second parse succeeds");
        test(obj3 != null, "Sequential: third parse succeeds");

        if ( obj1 != null && obj2 != null && obj3 != null ) {
          test("first".equals(((foam.core.test.Test) obj1).getId()), "Sequential: first id correct");
          test("second".equals(((foam.core.test.Test) obj2).getId()), "Sequential: second id correct");
          test("third".equals(((foam.core.test.Test) obj3).getId()), "Sequential: third id correct");
        }
      `
    },
    {
      name: 'testNestedFObjectParsing',
      args: 'Context x',
      documentation: 'Verify parsing nested FObjects works correctly',
      javaCode: `
        JSONParser parser = new JSONParser();
        parser.setX(x);

        String json = "{class:\\"foam.core.auth.User\\",id:999,firstName:\\"Test\\",lastName:\\"User\\",address:{class:\\"foam.core.auth.Address\\",city:\\"Toronto\\"}}";

        FObject obj = parser.parseString(json, null);
        test(obj != null, "Nested: parse succeeded");
        if ( obj != null ) {
          foam.core.auth.User u = (foam.core.auth.User) obj;
          test("Test".equals(u.getFirstName()), "Nested: firstName correct");
          test(u.getAddress() != null, "Nested: address is non-null");
          if ( u.getAddress() != null ) {
            test("Toronto".equals(u.getAddress().getCity()), "Nested: city correct");
          }
        }
      `
    }
  ]
});
