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
NodeJS environment provided by Javet.
See:
https://docs.google.com/presentation/d/1lQ8xIHuywuE0ydqm2w6xq8OeQZO_WeTLYXW9bNflQb8/edit?pli=1&slide=id.p#slide=id.p
https://github.com/caoccao/Javet
https://www.caoccao.com/Javet/index.html
https://www.caoccao.com/Javet/reference/javadoc/allclasses-frame.html

    TODO: move to real doc

    Use: (presently)

    Use through Script:
    See example: 'NodeShellTest'
    Create a script with language NODESHELL with FOAM javascript:

    client.countryDAO.select(function(c) {
      console.info('Country (1)', c.toSummary());
    });

    s = await client.countryDAO.select();
    s.array.forEach(c => {
      console.info('Country (2)', c.toSummary());
    });

    Direct JavaShell:
    JavetShell shell = (JavetShell) x.get("javetShell");
    shell.setCode(...);
    shell.execute(x);

    Other
    JavetShell provides for specifying the user whose session will be used to initialize the ClientBuilder. Defaults to 'admin'.

    FUTURE WORK:
    client initialization of ClientBuilder is slow. Consider just
    loading cspecs and menus daos directly.
   `,

  javaImports: [
    'com.caoccao.javet.enums.JavetPromiseRejectEvent',
    'com.caoccao.javet.enums.V8AwaitMode',
    'com.caoccao.javet.exceptions.JavetException',
    'com.caoccao.javet.interception.logging.JavetStandardConsoleInterceptor',
    'com.caoccao.javet.interop.V8Runtime',
    'com.caoccao.javet.interop.callback.IJavetPromiseRejectCallback',
    'com.caoccao.javet.interop.callback.JavetPromiseRejectCallback',
    'com.caoccao.javet.interop.callback.JavetBuiltInModuleResolver',
    'com.caoccao.javet.utils.JavetOSUtils',
    'com.caoccao.javet.values.V8Value',
    'com.caoccao.javet.values.reference.IV8ValueObject',
    'com.caoccao.javet.values.reference.IV8ValuePromise',
    'com.caoccao.javet.values.reference.V8ValueError',
    'com.caoccao.javet.values.reference.V8ValueObject',
    'com.caoccao.javet.values.reference.V8ValuePromise',

    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.core.session.Session',
    'foam.dao.DAO',
    'foam.lang.X',
    'static foam.mlang.MLang.EQ',
    'foam.util.SafetyUtil',

    'java.io.File',
    'java.io.IOException',
    'java.io.PrintStream',
    'java.util.Arrays',
    'java.util.stream.Collectors'
  ],

  javaCode: `
  IJavetPromiseRejectCallback rejectCallback_ = null;
  IV8ValuePromise.IListener promiseListener_ = null;
  JavetStandardConsoleInterceptor javetConsoleInterceptor_ = null;
  V8ValueObject v8ValueObject_ = null;

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

  methods: [
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
      PM pm = null;
      try {
        setup(x);
        pm = new PM("JavetShell", "execute");
        if ( SafetyUtil.isEmpty(getFilename()) ) {

        Logger logger = Loggers.logger(x, this, "clientBuilder");
        Session session = (Session) ((DAO) x.get("sessionDAO")).find(EQ(Session.USER_ID, getUser()));
        if ( session == null ) {
          throw new RuntimeException("Session not found for user "+getUser());
        }
        logger.debug("initializing with session", session.getId());
          executeString(x, """
// FIXME: hack until javet/node context/isolation understood.
var c = typeof cb !== 'undefined' ? cb : null;
if ( ! c || c.sessionID !== session.getId() ) {
  console.debug('create new ClientBuilder');
  c = foam.core.client.ClientBuilder.create({sessionID: '%s'});
} else {
  console.debug('re-use new ClientBuilder');
}
c.promise.then(async client => {
  let x = client.__subContext__;
  let MLang = foam.mlang.Expressions.create();

  %s
}, err => {
  console.error('%s', err);
});
        """.formatted(session.getId(), getCode(), getId()));
        } else {
          executeFile(x, getFilename());
        }
        if ( pm != null ) pm.log(x);
      } catch (Throwable t) {
        if ( pm != null ) pm.error(x);
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

      promiseListener_ = new IV8ValuePromise.IListener() {
        public void onCatch(V8Value v8Value) {
          // assertTrue(v8Value instanceof V8ValueError);
          // Handle the error.
          logger.error("listener,onCatch", v8Value);
        }
        public void onFulfilled(V8Value v8Value) {
          // Handle the fulfillment.
          logger.debug("listener,onFufilled", v8Value);
          // TODO: how to inform the v8Runtime to stop waiting?
        }
        public void onRejected(V8Value v8Value) {
          // Handle the rejection.
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
          if ( ps != null )
            ps.println(msg);
        }
        public void consoleWarn(V8Value... v8Values) {
          logger.warning((Object[])v8Values);
        }
        public void consoleError(V8Value... v8Values) {
          logger.error((Object[])v8Values);
        }
      };
      // Register the Javet console to V8 global object - why? - doesn't work otherwise - but not sure why. If a v8Runtime.createV8ValueObject() is used, System.out is useded, meaning this registration didn't work.
      // v8ValueObject_ = v8Runtime.createV8ValueObject();
      // javetConsoleInterceptor_.register(new IV8ValueObject[] {v8ValueObject_});
      javetConsoleInterceptor_.register(new IV8ValueObject[] {v8Runtime.getGlobalObject()});
      `
    },
    {
      name: 'teardown',
      args: 'X x',
      javaThrows: ['JavetException' ],
      javaCode: `
      V8Runtime v8Runtime = (V8Runtime) getV8Runtime();
      if ( javetConsoleInterceptor_ != null )
        javetConsoleInterceptor_.unregister(new IV8ValueObject[] {v8Runtime.getGlobalObject()});
        // javetConsoleInterceptor_.unregister(new IV8ValueObject[] {v8ValueObject_});

      v8Runtime.close();
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
      // TODO: understand how to have the listener tell the runtime to resolve.
      v8ValuePromise.register(promiseListener_);
      logger.debug("waiting");
      v8Runtime.await();
      logger.debug("complete");
      `
    }
  ]
});
