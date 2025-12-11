/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.script.javet',
  name: 'JavetShellFactory',

  javaImplements: [
    'foam.core.COREService',
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
    'com.caoccao.javet.interop.engine.JavetEnginePool',
    'com.caoccao.javet.interop.callback.IJavetPromiseRejectCallback',
    'com.caoccao.javet.interop.callback.JavetPromiseRejectCallback',
    'com.caoccao.javet.enums.JavetPromiseRejectEvent',
    'com.caoccao.javet.utils.JavetOSUtils',

    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.lang.X',
    'foam.util.SafetyUtil',

    'java.io.ByteArrayInputStream',
    'java.io.File',
    'java.io.InputStream',
    'java.io.IOException',
    'java.nio.charset.StandardCharsets'
  ],

  properties: [
    {
      name: 'foamBinNodeFile',
      class: 'String',
      value: 'foam-bin-node.js'
    },
    {
      class: 'Boolean',
      name: 'initialized',
      transient: true,
      hidden: true
    },
  ],

  javaCode: `
  protected IJavetEnginePool iJavetEnginePool_ = null;
  protected IJavetEngine iJavetEngine_ = null;
  `,

  methods: [
    {
      name: 'create',
      args: 'Context x',
      type: 'JavetShell',
      javaCode: `
      maybeInit();
      try {
        return new JavetShell(x, iJavetEngine_.getV8Runtime());
      } catch (JavetException e) {
        throw new RuntimeException("JavetShellFactory.create", e);
      }
      `
    },
    {
      name: 'maybeInit',
      synchronized: true,
      javaCode: `
      if ( getInitialized() )
        return;

      PM pm = new PM("JavatShellFactory","maybeInit");
      try {
        NodeRuntimeOptions.V8_FLAGS.setUseStrict(false);

        iJavetEnginePool_ = new JavetEnginePool();
        iJavetEnginePool_.getConfig().setJSRuntimeType(JSRuntimeType.Node);
        iJavetEngine_ = iJavetEnginePool_.getEngine();

        // load foam
        load(getX(), iJavetEngine_.getV8Runtime());

        setInitialized(true);
        pm.log(getX());
      } catch (Throwable t) {
        pm.error(getX());
        Loggers.logger(getX(), this).error("Failed initialization", t.getMessage());
        throw new RuntimeException(t);
      } 
      `
    },
    {
      name: 'start',
      javaCode: `
      maybeInit();
      `
    },
    {
      name: 'stop',
      javaCode: `
      try {
        if (iJavetEngine_ != null) {
          iJavetEngine_.close();
        }
        if (iJavetEnginePool_ != null) {
          iJavetEnginePool_.close();
        }
      } catch (JavetException e) {
        Loggers.logger(getX(), this).error("Failed stop", e);
      }
      `
    },
    {
      name: 'load',
      args: 'X x, V8Runtime v8Runtime',
      javaThrows: ['JavetException', 'java.io.IOException' ],
      javaCode: `
      PM pm = new PM("JavetShellFactory","load");
      try {
        Logger logger = Loggers.logger(x, this, "load");
        String name = getFoamBinNodeFile();
        Storage storage = (Storage) x.get(Storage.class);
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
        pm.log(x);
      }
      `
    }
  ]
});
