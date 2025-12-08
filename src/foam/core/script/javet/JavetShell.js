/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.script.javet',
  name: 'JavetShell',
  implements: [ 'foam.lang.ContextAgent' ],

  documentation: `A script agent which executes FOAM javascript in a
NodeJS environment.`,
/*
  Implementation
  to be used by flow and scripts
  JavetShell - create via JavetShellFactory
  for flow, set user - default to admin (42)
  set code
  execute(x)
  // FUTURE WORK:
  // ClientBuilder support to optionally:
  // - not load menus
  // - bypass HTTPBox - hit router.
*/
  javaImports: [
    'com.caoccao.javet.enums.JavetPromiseRejectEvent',
    'com.caoccao.javet.exceptions.JavetException',
    'com.caoccao.javet.interception.logging.JavetStandardConsoleInterceptor',
    'com.caoccao.javet.interop.V8Runtime',
    'com.caoccao.javet.interop.callback.IJavetPromiseRejectCallback',
    'com.caoccao.javet.interop.callback.JavetPromiseRejectCallback',
    'com.caoccao.javet.utils.JavetOSUtils',
    'com.caoccao.javet.values.V8Value',
    'com.caoccao.javet.values.reference.IV8ValueObject',
    'com.caoccao.javet.values.reference.IV8ValuePromise',
    'com.caoccao.javet.values.reference.V8ValueError',
    'com.caoccao.javet.values.reference.V8ValuePromise',

    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.session.Session',
    'foam.dao.DAO',
    'foam.lang.X',
    'static foam.mlang.MLang.EQ',
    'foam.util.SafetyUtil',

    'java.io.File',
    'java.io.IOException',
    'java.io.PrintStream'
  ],

  javaCode: `
  IJavetPromiseRejectCallback rejectCallback_ = null;
  IV8ValuePromise.IListener promiseListener_ = null;
  JavetStandardConsoleInterceptor javetConsoleInterceptor_ = null;

  public JavetShell(X x, V8Runtime v8Runtime) {
    setX(x);
    setV8Runtime(v8Runtime);
  }
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
      // NOT YET USED.
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
    }
  ],

  // add x (clientBuilder), out, scriptParameter
  methods: [
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
      try {
        setup(x);
        // TODO: inject out - boas, scriptParameter
        if ( SafetyUtil.isEmpty(getFilename()) ) {
          executeString(x, """
(async function() {
  try {
    %s
  } catch (e) {
    console.error('%s', e);
  }
}());
""".formatted(getCode(), getId()));
        } else {
          executeFile(x, getFilename());
        }
      } catch (Throwable t) {
        throw new RuntimeException(t);
      } finally {
        try {
          teardown(x);
        } catch (Throwable t) {
          Loggers.logger(x, this).debug("Failed teardown", t);
        }
      }
      `
    },
    {
      name: 'setup',
      args: 'X x',
      javaThrows: [ 'JavetException' ],
      javaCode: `
      V8Runtime v8Runtime = (V8Runtime) getV8Runtime();
      final Logger logger = Loggers.logger(x, this);
      PrintStream ps = (PrintStream) getPrintStream();

      rejectCallback_ = (event, promise, value) -> {
        logger.debug("PromiseRejectCallback event", event, "promise", promise, "value", value);
      };
      v8Runtime.setPromiseRejectCallback(rejectCallback_);

      promiseListener_ = new IV8ValuePromise.IListener() {
        // @Override
        public void onCatch(V8Value v8Value) {
          // assertTrue(v8Value instanceof V8ValueError);
          // Handle the error.
          logger.error("callback,onCatch", v8Value);
        }
        // @Override
        public void onFulfilled(V8Value v8Value) {
          // Handle the fulfillment.
          logger.info("callback,onFufilled", v8Value);
        }

        // @Override
        public void onRejected(V8Value v8Value) {
          // Handle the rejection.
          logger.warning("callback,onRejected", v8Value);
        }
      };

      // TODO: setup/use PrintStream
      //      String.join(",", Arrays.asList(v8Values));
      JavetStandardConsoleInterceptor javetConsoleInterceptor_ =
      new JavetStandardConsoleInterceptor(v8Runtime) {
        public void consoleDebug(V8Value... v8Values) {
          logger.debug((Object[])v8Values);
        }
        public void consoleInfo(V8Value... v8Values) {
          logger.info((Object[])v8Values);
        }
        public void consoleWarn(V8Value... v8Values) {
          logger.warning((Object[])v8Values);
        }
        public void consoleError(V8Value... v8Values) {
          logger.error((Object[])v8Values);
        }
      };
      // Register the Javet console to V8 global object - why?
      javetConsoleInterceptor_.register(new IV8ValueObject[] {v8Runtime.getGlobalObject()});

      loadClientBuilder(x);
      `
    },
    {
      name: 'teardown',
      args: 'X x',
      javaThrows: ['JavetException' ],
      javaCode: `
      if ( javetConsoleInterceptor_ != null )
        javetConsoleInterceptor_.unregister(new IV8ValueObject[] {((V8Runtime)getV8Runtime()).getGlobalObject()});
      `
    },
    {
      name: 'loadClientBuilder',
      args: 'X x',
      javaThrows: [ 'JavetException' ],
      javaCode: `
      Logger logger = Loggers.logger(x, this, "clientBuilder");
      Session session = (Session) ((DAO) x.get("sessionDAO")).find(EQ(Session.USER_ID, getUser()));
      if ( session == null ) {
        throw new RuntimeException("Session not found for user "+getUser());
      }
      logger.debug("initializing with session", session.getId());
      executeString(x, """
const cb = foam.core.client.ClientBuilder.create({sessionID: '%s'});
cb.promise.then(async client => {
  globalThis.x = client;
}, err => {
  console.error(err);
});
      """.formatted(session.getId()));
      logger.debug("initialized");
      `
    },
    {
      name: 'executeString',
      args: 'X x, String string',
      javaThrows: [ 'JavetException' ],
      javaCode: `
      Logger logger = Loggers.logger(x, this, "executeString");
      logger.debug("string", string);
      V8Runtime v8Runtime = (V8Runtime) getV8Runtime();
      logger.debug("executing");
      V8ValuePromise v8ValuePromise = v8Runtime.getExecutor(string).execute();
      logger.debug("executed");
      v8ValuePromise.register(promiseListener_);
      logger.debug("waiting");
      v8Runtime.await();
      logger.debug("complete");
      `
    },
    {
      name: 'executeFile',
      args: 'X x, String filename',
      javaThrows: ['JavetException', 'IOException'],
      javaCode: `
      File file = new File(JavetOSUtils.WORKING_DIRECTORY, filename);
      if ( ! file.exists() || ! file.canRead() ) {
        throw new java.io.IOException("File not found: "+file.getAbsolutePath());
      }
      Logger logger = Loggers.logger(x, this, "executeFile", filename);
      V8Runtime v8Runtime = (V8Runtime) getV8Runtime();
      logger.debug("loading");
      V8ValuePromise v8ValuePromise = v8Runtime.getExecutor(file).execute();
      logger.debug("loaded");
      v8ValuePromise.register(promiseListener_);
      logger.debug("waiting");
      v8Runtime.await();
      logger.debug("complete");
      `
    }
  ]
});
