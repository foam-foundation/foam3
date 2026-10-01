/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.script;

import foam.lang.X;
import foam.core.logger.Logger;
import foam.core.script.jShell.EvalInstruction;
import foam.core.script.jShell.InstructionPresentation;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintStream;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import javax.script.ScriptException;
import jdk.jshell.execution.DirectExecutionControl;
import jdk.jshell.JShell;
import jdk.jshell.spi.ExecutionControl;
import jdk.jshell.spi.ExecutionControlProvider;
import jdk.jshell.spi.ExecutionEnv;


public class JShellExecutor {
  public static final Object[] OBJECT_HOLDER = new Object[1];

  public Object runExecutor(X x, PrintStream ps, String serviceScript ) throws IOException  {

    JShell jShell = createJShell(ps);

    long token = foam.core.script.Script.X_SEQ.incrementAndGet();
    foam.core.script.Script.X_REGISTRY.put(token, x);
    String init = "import foam.lang.X; import foam.core.boot.CSpec; X x = foam.core.script.Script.X_REGISTRY.get(" + token + "L); ";

    try {
      execute(x, jShell, init + serviceScript);
      jShell.eval("foam.core.boot.CSpec.OBJECT_HOLDER[0] = service;");
      return OBJECT_HOLDER[0];
    } finally {
      foam.core.script.Script.X_REGISTRY.remove(token);
      jShell.close();
    }
  }

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
      throw new IllegalStateException("Unexpected IOException reading script",e);
    }

    List<String> instructionList = new InstructionPresentation(jShell).parseToInstruction(l1);
    EvalInstruction console = new EvalInstruction(jShell, instructionList, x);
    String print = null;
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
}
