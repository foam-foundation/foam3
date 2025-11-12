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
    'foam.lang.X',
    'foam.core.logger.Logger',
    'foam.core.script.JShellExecutor',
    'foam.core.script.jShell.EvalInstruction',
    'foam.core.script.jShell.InstructionPresentation',
    'foam.dao.DAO',
    'java.io.BufferedReader',
    'java.io.IOException',
    'java.io.PrintStream',
    'java.io.StringReader',
    'java.util.ArrayList',
    'java.util.List',
    'java.util.Map',
    'javax.script.ScriptException',
    'jdk.jshell.JShell',
    'jdk.jshell.execution.DirectExecutionControl',
    'jdk.jshell.spi.ExecutionControl',
    'jdk.jshell.spi.ExecutionControlProvider',
    'jdk.jshell.spi.ExecutionEnv'
  ],

  properties: [
    {
      class: 'Code',
      name: 'code',
      value: `/*
    Availabe variables:
    x      - Context used for accessing services.
    logger - FOAM Logger object. Call logger.debug/log/info/warn/error()
    obj    - The object being operated on.
    oldObj - The previous version of the object be operated on in the case of an update operation.
    ruler  - The Rule Engine.
    rule   - The current Rule.
    agency - The Agency used for executing asynchronous operations.

    The following Java imports have already been applied:
    foam.lang.*
    foam.core.ruler.*
    foam.mlang.MLang.*
*/
      `
//      writePermissionRequired: true
    }
  ],

  methods: [
    {
      name: 'applyAction',
      // args: 'Context x, foam.lang.FObject obj, foam.lang.FObject oldObj, foam.core.ruler.RuleEngine ruler, foam.core.ruler.Rule rule, foam.lang.Agency agency'
      javaCode: `
        try ( JShell js = createJShell(System.out) ) {
          js.eval("import foam.core.ruler.action.JShellRuleAction;");
          js.eval("import foam.lang.*;");
          js.eval("import foam.core.ruler.*;");
          js.eval("import foam.core.logger.Logger;");
          js.eval("static import foam.mlang.MLang.*;");

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
            js.eval("Logger                      logger = (Logger)                      x.get(\\"logger\\");");
          }

          execute(x, js, getCode());
        } catch (Throwable t) {
          System.err.println(t);
          t.printStackTrace();
        }
      `
    }
  ],

  javaCode: `
  public final static Object[] ARGS = new Object[6];
  // extracted because IOException is thrown in a way that doesn't make it
  // easy to have one try-catch block.
  private List<String> readScript(String script) throws IOException {
    List<String> l1 = new ArrayList<String>();

    // nullcheck on script to prevent IOException in loop
    try ( BufferedReader rdr = new BufferedReader(new StringReader(script != null ? script : "")) ) {
      for ( String line = rdr.readLine() ; line != null ; line = rdr.readLine() ) {
        l1.add(line);
      }
    }
    return l1;
  }

  public String execute(X x, JShell jShell, String script, boolean rethrow) throws ScriptException {
    List<String> l1;

    try {
      l1 = readScript(script);
    } catch(IOException e) {
      // we're using a StringReader. it should be impossible for
      // this to happen while readScript() is running
      throw new IllegalStateException("Unexpected IOException reading script", e);
    }

    List<String>    instructionList = new InstructionPresentation(jShell).parseToInstruction(l1);
    EvalInstruction console         = new EvalInstruction(jShell, instructionList, x);
    String          print           = null;

    try {
      print = console.runEvalInstruction();
    } catch (Exception e) {
      if ( rethrow ) {
        throw new ScriptException(e);
      }

      Logger logger = (Logger) x.get("logger");
      if ( logger != null ) {
        logger = foam.core.logger.StdoutLogger.instance();
      }
      logger.error(this.getClass().getSimpleName(), "execute", e);
    }
    return print;
  }

  public String execute(X x, JShell jShell, String script) {
    try {
      return execute(x, jShell, script, false);
    } catch (ScriptException e) {
      // code execution should not end up here
      // as we've asked for no rethrows
      throw new IllegalStateException("execute() rethrew exception when asked not to", e);
    }
  }

  public JShell createJShell(PrintStream ps) {
    JShell jShell = JShell.
      builder().
      out(ps).
      executionEngine(new ExecutionControlProvider() {
        @Override
        public String name() {
          return "direct";
        }

        @Override
        public ExecutionControl generate(ExecutionEnv ee, Map<String, String> map) throws Throwable {
          return new DirectExecutionControl();
        }
      }, null).build();
    return jShell;
  }

  `
});
