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
    Checks the value has quoted keys and that the loader reads it back.
  `,

  javaImports: [
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
        UserFlowAccess access = new UserFlowAccess();
        access.setUserId(42);
        access.setAccessLevel(FlowAccess.PUBLIC_RW);

        String value = SaveFlowToFileRuleAction.listTagValue(x, Flow.SPECIFIED_USER_ACCESS, new FObject[] { access });
        test(value.contains("\\"userId\\":") && value.contains("\\"accessLevel\\":"), "keys are quoted: " + value);
        test(! value.contains("{userId") && ! value.contains(",accessLevel"), "no key is left unquoted: " + value);

        // LoadFlowFromFileDAO reads the tag value the same way
        Flow parsed = (Flow) x.create(JSONParser.class).parseString("{\\"specifiedUserAccess\\":" + value + "}", Flow.class);
        UserFlowAccess[] list = parsed == null ? null : parsed.getSpecifiedUserAccess();
        test(list != null && list.length == 1, "the loader reads one entry back");
        test(list != null && list.length == 1 && list[0].getUserId() == 42 && list[0].getAccessLevel() == FlowAccess.PUBLIC_RW,
          "the entry keeps its user and access level");
      `
    }
  ]
});
