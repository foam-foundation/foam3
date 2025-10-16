/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ruler.action',
  name: 'JShellRuleAction',
  implements: [ 'foam.core.ruler.RuleAction' ],

  documentation: 'Execute a JShell script as a RuleAction.',

  javaImports: [
    'foam.core.script.JShellExecutor',
    'foam.dao.DAO',
    'javax.script.ScriptException',
    'jdk.jshell.JShell'
  ],

  properties: [
    {
      class: 'Code',
      name: 'code',
//      writePermissionRequired: true
    }
  ],

  methods: [
    {
      name: 'applyAction',
      // args: 'Context x, foam.lang.FObject obj, foam.lang.FObject oldObj, foam.core.ruler.RuleEngine ruler, foam.core.ruler.Rule rule, foam.lang.Agency agency'
      javaCode: `
        System.err.println("************** EXECUTING: " + getCode());
        try ( JShell js = JShell.create() ) {
          js.eval("import foam.lang.X; import foam.lang.*; foam.core.ruler.*;");

          synchronized ( ARGS ) {
            ARGS[0] = x;
            ARGS[1] = obj;
            ARGS[2] = oldObj;
            ARGS[3] = ruler;
            ARGS[4] = rule;
            ARGS[5] = agency;
            js.eval("X                           x      = (X)                           JShellRuleAction.ARGS[0];");
            js.eval("foam.lang.FObject           obj    = (foam.lang.FObject)           JShellRuleAction.ARGS[1];");
            js.eval("foam.lang.FObject           oldObj = (foam.lang.FObject)           JShellRuleAction.ARGS[2];");
            js.eval("foam.core.ruler.RuleEnginer ruler  = (foam.core.ruler.RuleEnginer) JShellRuleAction.ARGS[3];");
            js.eval("foam.core.ruler.Rule        rule   = (foam.core.ruler.Rule)        JShellRuleAction.ARGS[4];");
            js.eval("foam.lang.Agency agency     agency = (foam.lang.Agency)            JShellRuleAction.ARGS[5];");
          }

          js.eval("System.err.println(\\"running\\");");
          js.eval(getCode());
        } catch (Throwable t) {
          System.err.println(t);
          t.printStackTrace();
        }
      `
    }
  ],

  javaCode: `
  public final static Object[] ARGS = new Object[6];
  `
});
