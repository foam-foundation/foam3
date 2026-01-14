/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.script.javet',
  name: 'JavetShell',
  implements: [ 'foam.lang.ContextAgent' ],

  javaGenerateConvenienceConstructor: false,
  javaGenerateDefaultConstructor: false,

  documentation: `A script agent which executes FOAM javascript in a
NodeJS environment provided by Javet.

See JavetShell.md for more info.
   `,

  javaImports: [
    'com.caoccao.javet.annotations.V8Function',
    'com.caoccao.javet.enums.JavetPromiseRejectEvent',
    'com.caoccao.javet.enums.V8AwaitMode',
    'com.caoccao.javet.exceptions.JavetException',
    'com.caoccao.javet.interception.logging.JavetStandardConsoleInterceptor',
    'com.caoccao.javet.interfaces.IJavetAnonymous',
    'com.caoccao.javet.interop.NodeRuntime',
    'com.caoccao.javet.interop.V8Runtime',
    'com.caoccao.javet.interop.callback.JavetBuiltInModuleResolver',
    'com.caoccao.javet.utils.JavetOSUtils',
    'com.caoccao.javet.values.V8Value',
    'com.caoccao.javet.values.primitive.V8ValueZonedDateTime',
    'com.caoccao.javet.values.reference.IV8ValueObject',
    'com.caoccao.javet.values.reference.IV8ValuePromise',
    'com.caoccao.javet.values.reference.V8ValueError',
    'com.caoccao.javet.values.reference.V8ValueObject',
    'com.caoccao.javet.values.reference.V8ValuePromise',

    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.core.script.ScriptParameter',
    'foam.core.session.Session',
    'foam.dao.DAO',
    'foam.lang.X',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.util.DateUtil.getTimeZoneId',
    'foam.util.SafetyUtil',

    'java.io.File',
    'java.io.IOException',
    'java.io.PrintStream',
    'java.nio.charset.StandardCharsets',
    'java.util.Arrays',
    'java.util.Date',
    'java.util.HashMap',
    'java.util.Map',
    'java.util.concurrent.atomic.AtomicBoolean',
    'java.util.stream.Collectors'
  ],

  javaCode: `
  IV8ValuePromise.IListener promiseListener_ = null;
  JavetStandardConsoleInterceptor javetConsoleInterceptor_ = null;
  volatile boolean stopping_ = false;

  public JavetShell(X x, V8Runtime v8Runtime) {
    setX(x);
    setV8Runtime(v8Runtime);
  }

  public static JavetShell create(X x, String code) {
    JavetShell shell = (JavetShell) x.get("javetShell");
    shell.setX(x);
    shell.setCode(code);
    return shell;
  }

  // Force creation via Factory
  protected JavetShell() {};
  protected JavetShell(X x) {};
  `,

  properties: [
    {
      name: 'id',
      class: 'String'
    },
    {
      documentation: 'Run as user',
      name: 'user',
      class: 'Reference',
      of: 'foam.core.auth.User',
      value: 42, // refine in application
      includeInDigest: true,
      writePermissionRequired: true
    },
    {
      name: 'code',
      class: 'Code',
      includeInDigest: true,
      writePermissionRequired: true
    },
    {
      documentation: 'relative to journals/',
      name: 'filename',
      class: 'String'
    },
    {
      name: 'parameters',
      class: 'Map',
      javaFactory: 'return new java.util.HashMap();',
    },
    {
      name: 'printStream',
      class: 'Object',
      transient: true,
      hidden: true
    },
    {
      name: 'v8Runtime',
      class: 'Object',
      transient: true,
      hidden: true
    },
    {
      documentation: 'Enable code eval in v8Runtime, required by JS Test cases which use modelCode',
      name: 'allowEval',
      class: 'Boolean'
    }
  ],

  methods: [
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
      PM pm = null;
      V8Runtime v8Runtime = (V8Runtime) getV8Runtime();
      try {
        setup(x, v8Runtime);
        pm = new PM("JavetShell", "execute");
        Logger logger = Loggers.logger(x, this, "execute");
        try ( V8ValueObject v8ValueObject = v8Runtime.createV8ValueObject() ) {
          v8Runtime.getGlobalObject().set("ps", v8ValueObject);
          ScriptParameter sp = (ScriptParameter) ((DAO) x.get("scriptParameterDAO"))
            .find(AND(
              EQ(ScriptParameter.ENABLED, true),
              EQ(ScriptParameter.NAME, getId())
            ));
          v8ValueObject.bind(new IJavetAnonymous() {
            @V8Function(name = "getParameters")
            public Map<String, Object> getParameters() {
              if ( sp != null )
                return sp.getParameters();
              return null;
            }

            @V8Function(name = "getDate")
            public V8ValueZonedDateTime getDate() {
              if ( sp != null && sp.getDate() != null ) {
                try {
                  java.time.ZonedDateTime z = sp.getDate().toInstant().atZone(getTimeZoneId(x, null));
                  logger.debug("getDate", z);
                  return new V8ValueZonedDateTime(v8Runtime, sp.getDate().toInstant().atZone(getTimeZoneId(x, null)));
                } catch (JavetException e) {
                  logger.error("(Anonymous) ScriptParameter.getDate", e);
                }
              }
              return null;
            }

            @V8Function(name = "getParameter")
            public Object getParameter(String key) {
              if ( sp != null )
                return sp.getParameters().get(key);
              return null;
            }

            @V8Function(name = "get")
            public Object get(String key) {
              if ( sp != null )
                return sp.getParameters().get(key);
              return null;
            }
          });
          if ( SafetyUtil.isEmpty(getFilename()) ) {
            Session session = (Session) ((DAO) x.get("sessionDAO")).find(EQ(Session.USER_ID, getUser()));
            if ( session == null ) {
              throw new RuntimeException("Session not found for user "+getUser());
            }
            logger.debug("initializing with session", session.getId());

            executeString(x, v8Runtime, """
foam.core.client.ClientBuilder.create({sessionID: '%s'}).promise.then(async client => {
  let x = client.__subContext__;
  let MLang = foam.mlang.Expressions.create();
  // this.loginSuccess = true;
  async function code() {
    %s
  };
  await code.call(x);
  if ( typeof signalDone === 'function' ) {
    console.info('JavetShell: code complete, calling signalDone()');
    signalDone();
  }
}, err => {
  console.error('%s', err);
  if ( typeof signalDone === 'function' ) {
    console.info('JavetShell: error path, calling signalDone()');
    signalDone();
  }
});
            """.formatted(session.getId(), getCode(), getId()));
          } else {
            executeFile(x, v8Runtime, getFilename());
          }
        }
        if ( pm != null ) pm.log(x);
      } catch (Throwable t) {
        if ( pm != null ) pm.error(x);
        Loggers.logger(x, this).error("Failed executiong", getId(), getCode(), t);
      } finally {
        try {
          v8Runtime.getGlobalObject().delete("ps");
          teardown(x, v8Runtime);
        } catch (Throwable t) {
          Loggers.logger(x, this).debug("Failed teardown", t);
        }
      }
      `
    },
    {
      name: 'setup',
      args: 'X x, V8Runtime v8Runtime',
      javaThrows: [ 'JavetException' ],
      javaCode: `
      final Logger logger = Loggers.logger(x, this);
      final Logger log = logger;
      PrintStream ps = (PrintStream) getPrintStream();

      promiseListener_ = new IV8ValuePromise.IListener() {
        public void onCatch(V8Value v8Value) {
          // Handle the error.
          logger.error("listener,onCatch", v8Value);
        }
        public void onFulfilled(V8Value v8Value) {
          logger.debug("listener,onFufilled", v8Value);
        }
        public void onRejected(V8Value v8Value) {
          logger.warning("listener,onRejected", v8Value);
        }
      };

      JavetStandardConsoleInterceptor javetConsoleInterceptor_ =
      new JavetStandardConsoleInterceptor(v8Runtime) {
        public void consoleDebug(V8Value... v8Values) {
          logger.debug((Object[])v8Values);
        }
        public void consoleInfo(V8Value... v8Values) {
          String msg = Arrays.asList(v8Values).stream().map(V8Value::toString).collect(Collectors.joining(", "));
          logger.info(msg);
          PrintStream ps = (PrintStream) getPrintStream();
          if ( ps != null ) {
            ps.println(msg);
          }
        }
        public void consoleWarn(V8Value... v8Values) {
          logger.warning((Object[])v8Values);
        }
        public void consoleError(V8Value... v8Values) {
          logger.error((Object[])v8Values);
        }
      };
      javetConsoleInterceptor_.register(new IV8ValueObject[] {v8Runtime.getGlobalObject()});

      v8Runtime.allowEval(getAllowEval());

      // Expose signalDone() function to JavaScript so scripts can signal completion
      // This calls setStopping(true) which causes await(RunOnce) to return false
      logger.debug("v8Runtime class", v8Runtime.getClass().getName());
      if ( v8Runtime instanceof NodeRuntime ) {
        logger.debug("Binding signalDone() to NodeRuntime");
        NodeRuntime nodeRuntime = (NodeRuntime) v8Runtime;
        v8Runtime.getGlobalObject().bind(new IJavetAnonymous() {
          @V8Function(name = "signalDone")
          public void signalDone() {
            logger.debug("signalDone called - setting stop flag");
            // Set flag to break out of await loop (single-threaded pattern)
            stopping_ = true;
            // Also tell Node.js to stop scheduling new tasks
            nodeRuntime.setStopping(true);
          }
        });
      } else {
        // For non-Node V8Runtime, signalDone is a no-op (event loop drains naturally)
        logger.debug("v8Runtime is V8Runtime (not Node), signalDone will be no-op");
        v8Runtime.getGlobalObject().bind(new IJavetAnonymous() {
          @V8Function(name = "signalDone")
          public void signalDone() {
            logger.debug("signalDone called (V8Runtime) - no-op");
          }
        });
      }
      `
    },
    {
      name: 'teardown',
      args: 'X x, V8Runtime v8Runtime',
      javaThrows: ['JavetException' ],
      javaCode: `
      if ( javetConsoleInterceptor_ != null )
        javetConsoleInterceptor_.unregister(new IV8ValueObject[] {v8Runtime.getGlobalObject()});
      if ( getAllowEval() )
        v8Runtime.allowEval(false);

      // Proper shutdown sequence for NodeRuntime:
      // 1. terminateExecution() - stops any running synchronous code
      // 2. setStopping(true) - signals event loop to stop
      // 3. lowMemoryNotification() - cleanup
      // 4. close() - release resources
      v8Runtime.terminateExecution();
      if ( v8Runtime instanceof NodeRuntime ) {
        ((NodeRuntime) v8Runtime).setStopping(true);
      }
      v8Runtime.lowMemoryNotification();
      v8Runtime.close();
      `
    },
    {
      name: 'executeString',
      args: 'X x, V8Runtime v8Runtime, String string',
      javaThrows: [ 'JavetException' ],
      javaCode: `
      final Logger logger = Loggers.logger(x, this, "executeString");
      logger.debug("string", string);
      logger.debug("executing");
      stopping_ = false; // Reset flag for this execution
      try ( V8ValuePromise v8ValuePromise = v8Runtime.getExecutor(string).execute() ) {
        v8ValuePromise.register(promiseListener_);
        logger.debug("waiting");

        // Use RunOnce mode with flag check - signalDone() sets stopping_=true
        // This is the single-threaded pattern: flag breaks the loop immediately
        while ( ! stopping_ && v8Runtime.await(V8AwaitMode.RunOnce) ) {
          // continue processing events until signalDone() or no more tasks
        }
        logger.debug("complete", stopping_ ? "signalDone called" : "event loop drained");
      }
      `
    },
    {
      name: 'executeFile',
      args: 'X x, V8Runtime v8Runtime, String filename',
      javaThrows: ['JavetException', 'IOException'],
      javaCode: `
      File file = new File(JavetOSUtils.WORKING_DIRECTORY, filename);
      if ( ! file.exists() || ! file.canRead() ) {
        throw new java.io.IOException("File not found: "+file.getAbsolutePath());
      }
      final Logger logger = Loggers.logger(x, this, "executeFile", filename);
      logger.debug("loading");

      // Read file content and wrap with signalDone() auto-append
      String fileContent = new String(java.nio.file.Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
      String wrappedCode = """
(async () => {
  try {
    %s
  } finally {
    if ( typeof signalDone === 'function' ) {
      console.info('JavetShell: file execution complete, calling signalDone()');
      signalDone();
    }
  }
})();
      """.formatted(fileContent);

      stopping_ = false; // Reset flag for this execution
      try ( V8ValuePromise v8ValuePromise = v8Runtime.getExecutor(wrappedCode).execute() ) {
        v8ValuePromise.register(promiseListener_);
        logger.debug("waiting");

        // Use RunOnce mode with flag check - signalDone() sets stopping_=true
        while ( ! stopping_ && v8Runtime.await(V8AwaitMode.RunOnce) ) {
          // continue processing events until signalDone() or no more tasks
        }
        logger.debug("complete", stopping_ ? "signalDone called" : "event loop drained");
      }
      `
    }
  ]
});
