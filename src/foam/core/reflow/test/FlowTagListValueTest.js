/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'FlowTagListValueTest',
  extends: 'foam.core.test.Test',

  documentation: `
    A doc flow saved to its .md file carries its access list in the <flow> tag,
    e.g. specifiedUserAccess='[{"userId":42,"accessLevel":"2"}]'. The build reads
    that value with JSON.parse, so a key written without quotes stops the build.
    Checks a strict JSON parser accepts the value, as JSON.parse does, and that
    the loader reads every entry back.
  `,

  javaImports: [
    'com.fasterxml.jackson.databind.ObjectMapper',
    'foam.core.reflow.Flow',
    'foam.core.reflow.FlowAccess',
    'foam.core.reflow.UserFlowAccess',
    'foam.lang.FObject',
    'foam.lib.json.JSONParser',
    'foam.u2.markdown.SaveFlowToFileRuleAction'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        UserFlowAccess editor = new UserFlowAccess();
        editor.setUserId(42);
        editor.setAccessLevel(FlowAccess.PUBLIC_RW);
        UserFlowAccess reader = new UserFlowAccess();
        reader.setUserId(43);
        reader.setAccessLevel(FlowAccess.PUBLIC_RO);

        String value = SaveFlowToFileRuleAction.listTagValue(x, Flow.SPECIFIED_USER_ACCESS, new FObject[] { editor, reader });

        // Jackson, like JSON.parse in tools/JournalMaker.js, refuses a key without quotes
        boolean strict;
        try {
          strict = new ObjectMapper().readTree(value).size() == 2;
        } catch ( Exception e ) {
          strict = false;
        }
        test(strict, "a strict JSON parser reads both entries: " + value);

        // LoadFlowFromFileDAO reads the tag value the same way
        Flow parsed = (Flow) x.create(JSONParser.class).parseString("{\\"specifiedUserAccess\\":" + value + "}", Flow.class);
        UserFlowAccess[] list = parsed == null ? null : parsed.getSpecifiedUserAccess();
        test(list != null && list.length == 2, "the loader reads both entries back");
        test(list != null && list.length == 2
          && list[0].getUserId() == 42 && list[0].getAccessLevel() == FlowAccess.PUBLIC_RW
          && list[1].getUserId() == 43 && list[1].getAccessLevel() == FlowAccess.PUBLIC_RO,
          "each entry keeps its user and access level");
      `
    }
  ]
});
