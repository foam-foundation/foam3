/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.script.javet',
  name: 'JavetShellFactory',

  documentation: `Context factory which manages the JavetEnginePool from
which V8Runtimes are aquired when creating JavetShells.
A JavetEngine is allocated from the Pool for each calling Thread,
and FOAM is loaded once into each engine.
The V8Runtime are similar to JDBC connections from a connection pool.

See JavetShell.md for more info.
`,

  javaImplements: [
    'foam.lang.XFactory'
  ],

  javaImports: [
    'com.caoccao.javet.enums.JSRuntimeType',
    'com.caoccao.javet.exceptions.JavetException',
    'com.caoccao.javet.interop.V8Host',
    'com.caoccao.javet.interop.V8Runtime',
    'com.caoccao.javet.interop.options.NodeRuntimeOptions',
    'com.caoccao.javet.interop.engine.IJavetEngine',
    'com.caoccao.javet.interop.engine.IJavetEnginePool',
    'com.caoccao.javet.interop.engine.JavetEngineConfig',
    'com.caoccao.javet.interop.engine.JavetEnginePool',
    'com.caoccao.javet.utils.JavetOSUtils',

    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.util.SafetyUtil',

    'java.io.ByteArrayInputStream',
    'java.io.File',
    'java.io.InputStream',
    'java.io.IOException',
    'java.nio.charset.StandardCharsets'
  ],

  // Should be a property, but needed during static initialization
  constants: [
    {
      name: 'foamBinNodeFile',
      type: 'String',
      value: 'foam-bin-node.js'
    }
  ],

  javaCode: `

  static protected IJavetEnginePool iJavetEnginePool_;
  static {
    NodeRuntimeOptions.V8_FLAGS.setUseStrict(false);
    iJavetEnginePool_ = new JavetEnginePool();
    iJavetEnginePool_.getConfig().setJSRuntimeType(JSRuntimeType.Node);
  }

  protected static ThreadLocal<IJavetEngine> engine = new ThreadLocal<IJavetEngine>() {
    @Override
    protected IJavetEngine initialValue() {
      try {
        IJavetEngine engine = iJavetEnginePool_.getEngine();
        try ( V8Runtime v8Runtime = engine.getV8Runtime(); ) {
          loadFOAM(v8Runtime);
        }
        return engine;
      } catch (Throwable t) {
        Logger logger = Loggers.logger(XLocator.get());
        logger.error(t);
      }
      return null;
    }
  };

  protected V8Runtime getV8Runtime() throws JavetException {
    return engine.get().getV8Runtime();
  }

  /**
   * Load foam-bin into this thread's engine
   */
  static public void loadFOAM(V8Runtime v8Runtime)
    throws JavetException, java.io.IOException {
    PM pm = new PM("JavetShellFactory","load");
    try {
      Logger logger = Loggers.logger(XLocator.get());
      String name = "foam-bin-node.js";
      Storage storage = (Storage) XLocator.get().get(Storage.class);
      if ( storage instanceof FileSystemStorage ) {
        logger.debug("WORKING_DIRECTORY", JavetOSUtils.WORKING_DIRECTORY);
        File file = new File(
                             JavetOSUtils.WORKING_DIRECTORY,
                             "build/js/"+name); // build with -agw)
        if (file.exists() && file.canRead()) {
          logger.debug("FOAM Loading (file)", name);
          v8Runtime.getExecutor(file).executeVoid();
          logger.debug("FOAM Loaded", name);

          logger.debug("FOAM Flags setting", name);
          v8Runtime.getExecutor("foam.flags.node=true;").executeVoid();
          logger.debug("FOAM Flags set", name);
        } else {
          throw new java.io.IOException("File not found: "+file.getAbsolutePath());
        }
      } else {
        String path = "../webroot/"+name;
        InputStream is = new ByteArrayInputStream(storage.getBytes(path));
        logger.debug("FOAM Loading (resource)", name);
        v8Runtime.getExecutor(new String(is.readAllBytes(), StandardCharsets.UTF_8)).executeVoid();
        logger.debug("FOAM Loaded", name);
      }
      logger.debug("FOAM initializing");
      v8Runtime.getExecutor("foam.flags.node = true;").executeVoid();
      logger.debug("FOAM initialized");
    } finally {
      pm.log(XLocator.get());
    }
  }
  `,

  methods: [
    {
      documentation: `Create a new JavetShell with a V8Runtime
acquired from this thread's engine`,
      name: 'create',
      args: 'X x',
      type: 'JavetShell',
      javaCode: `
    try {
      var v8Runtime = getV8Runtime();
      return new JavetShell(x, v8Runtime);
    } catch (Throwable e) {
      throw new RuntimeException("JavetShellFactory.create", e);
    }
    `
    }
  ]
});
