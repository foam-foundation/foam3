/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.theme.test',
  name: 'CSSAuditRuleTest',
  extends: 'foam.core.theme.test.CSSAuditTest',

  documentation: `
    An application adds a rule to CSSAuditTest by adding a row to rules:.
    This test is such a subclass: it adds a radius row and a selector row and
    audits in-memory css: blocks instead of the tree.
  `,

  javaImports: [
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List'
  ],

  javaCode: `
  // Whether auditing css (as if it were in file) reports a rule with this id.
  protected boolean reports(String file, String css, String ruleId) {
    for ( Finding f : auditBlock(file, css) ) {
      for ( CSSAuditRule r : f.broken ) if ( ruleId.equals(r.getId()) ) return true;
    }
    return false;
  }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
    String file = "src/my/app/View.js";

    test(reports(file, "^ { color: #fff; }", "colour"),
      "default rules: color: #fff is reported");
    test(! reports(file, "^ { border-radius: 8px; }", "scale-radius"),
      "default rules: border-radius: 8px is not reported");

    List<CSSAuditRule> rules = new ArrayList(Arrays.asList(getRules()));
    rules.add(new CSSAuditRule.Builder(x)
      .setId("scale-radius")
      .setMatch("^border-radius$")
      .setAllow(new String[] { "token" })
      .setAdvice("is not on the radius scale; use $radius-sm, $radius-md or $radius-lg")
      .build());
    rules.add(new CSSAuditRule.Builder(x)
      .setId("private-chip")
      .setWhere("selector")
      .setMatch("<<chip")
      .setOutside("src/my/app/ui/")
      .setAdvice("is a private chip; use the shared one")
      .build());
    setRules(rules.toArray(new CSSAuditRule[0]));

    test(reports(file, "^ { border-radius: 8px; }", "scale-radius"),
      "an added row reports border-radius: 8px");
    test(! reports(file, "^ { border-radius: $radius-md; }", "scale-radius"),
      "an added row allows border-radius: $radius-md");
    test(reports(file, "^ { color: #fff; }", "colour"),
      "the default rows still run beside an added one");
    test(reports(file, "<<chip { padding: $space-2; }", "private-chip"),
      "a selector row reports a matching selector");
    test(! reports("src/my/app/ui/Chip.js", "<<chip { padding: $space-2; }", "private-chip"),
      "a row does not apply to a file under its outside: path");
      `
    }
  ]
});
