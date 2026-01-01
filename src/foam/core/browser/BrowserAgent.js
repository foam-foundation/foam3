/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.browser',
  name: 'BrowserAgent',

  implements: [
    'foam.lang.ContextAgent'
  ],

  documentation: `Agent which launches a headless or headed browser.
Example usage: see foam.core.test.TestRunnerScript.js

The caller creates a new BrowserAgent
and overrides the waitTerminate method, which BrowserAgent
will call once the Browser is launched. Returning from
the waitTerminate method will close the browser process.

Optionally implement 'getTeeOutputStreamWriter' to receive data
from the Process inputStream, and 'getTeeErrorStreamWriter' to
receive data from the Process error inputStream.

Optionally implement destroyed to handled any post shutdown logic.

In this example, the caller waits for the browser to perform
an operation which will eventually set a completed flag.

      String path = "admin.tests"; // menu with TestBorder
      List<String> params = new ArrayList();
      params.add("testRunId="+testRun.getId());
      if ( !SafetyUtil.isEmpty(testRun.getFilter()) )
        params.add("filter=" + testRun.getFilter());

      BrowserAgent agent = new BrowserAgent(x, path, params) {
        public void waitTerminate(X x) {
          logger.info("BrowserAgent,waitTerminate");
          while ( true ) {
            try {
              TestRun tr = (TestRun) dao.find(id);
              if ( tr.getCompleted() )
                break;
              Thread.currentThread().sleep(5000);
            } catch (InterruptedException e) {
              break;
            }
          }
          logger.info("BrowserAgent,waitTerminate,exit");
        }
      };
      agent.setHeadless( ! Boolean.getBoolean(SYSTEM_TEST_HEADED) );
      agent.execute(x);
`,

  javaImports: [
    'foam.core.app.AppConfig',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.logger.PrefixLogger',
    'foam.core.session.Session',
    'foam.dao.DAO',
    'foam.lang.Agency',
    'foam.lang.X',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'java.io.BufferedReader',
    'java.io.IOException',
    'java.io.InputStream',
    'java.io.InputStreamReader',
    'java.io.OutputStreamWriter',
    'java.net.URI',
    'java.util.concurrent.CompletableFuture',
    'java.util.concurrent.TimeUnit',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List'
  ],

  properties: [
    {
      documentation: 'Browser type to locate BrowserConfig',
      name: 'type',
      class: 'String',
      value: 'chrome'
    },
    {
      name: 'userId',
      class: 'Reference',
      of: 'foam.core.auth.User',
      value: 42 // foam admin
    },
    {
      name: 'path',
      class: 'String'
    },
    {
      name: 'params',
      class: 'List'
    },
    {
      documentation: 'timeout in seconds',
      name: 'timeout',
      class: 'Long',
      unit: 's',
      value: 30
    },
    {
      name: 'headless',
      class: 'Boolean',
      value: true
    },
    {
      name: 'process',
      class: 'Object'
    },
    {
      name: 'logger',
      class: 'FObjectProperty',
      of: 'foam.core.logger.Logger'
    }
  ],

  javaCode: `
  public BrowserAgent(X x, String path, List params) {
    setX(x);
    setPath(path);
    setParams(params);
  }
  public BrowserAgent(X x, String path, List params, long userId) {
    setX(x);
    setPath(path);
    setParams(params);
    setUserId(userId);
  }
  `,

  methods: [
    {
      name: 'execute',
      javaCode: `
      final Logger logger = new PrefixLogger(new Object[] { "BrowserAgent", getPath() }, Loggers.logger(x));

      try {
        List<String> command = buildCommand(x);
        logger.info("Launching", command.toString());
        ProcessBuilder pb = new ProcessBuilder(command);
        final Process process = pb.start();
        setProcess(process);
        final OutputStreamWriter teeOutputWriter = getTeeOutputStreamWriter(x);
        final OutputStreamWriter teeErrorWriter = getTeeOutputErrorStreamWriter(x);

        try {
          CompletableFuture.runAsync(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
              String line = null;
              while ( (line = reader.readLine()) != null ) {
                logger.info(line);
                if ( teeOutputWriter != null ) {
                  teeOutputWriter.write(line);
                }
              }
            } catch (IOException e) {
              logger.warning("Process inputstream reader interupted");
            }
          });
          CompletableFuture.runAsync(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
              String line = null;
              while ( (line = reader.readLine()) != null ) {
                logger.error(line);
                if ( teeErrorWriter != null ) {
                  teeErrorWriter.write(line);
                }
              }
            } catch (IOException e) {
              logger.warning("Process errorstream reader interupted");
            }
          });
        } catch ( Throwable t ) {
          logger.error(t);
        }
      } catch (IOException e) {
        logger.error(e);
      } finally {
        Process process = (Process) getProcess();
        ProcessHandle processHandle = process.toHandle();
        ProcessHandle.Info processInfo = processHandle.info();
        logger.info("pid", processHandle.pid());

        boolean alive = process != null && process.isAlive();
        if ( alive ) {
          waitTerminate(x);
        }
        process.destroy();
        if ( alive ) {
          process.destroyForcibly();
        }
        destroyed(x);
        setProcess(null);
      }
      `
    },
    {
      documentation: `Hook for caller to tee into the Process InputStream`,
      name: 'getTeeOutputStreamWriter',
      args: 'X x',
      type: 'java.io.OutputStreamWriter',
      javaCode: `
      return null;
      `
    },
    {
      documentation: `Hook for caller to tee into the Process Error InputStream`,
      name: 'getTeeOutputErrorStreamWriter',
      args: 'X x',
      type: 'java.io.OutputStreamWriter',
      javaCode: `
      return null;
      `
    },
    {
      documentation: `Hook for caller to control termination. Implement
waitTerminate and return when browser process can be closed.

new BrowserAgent(...) {
  public void waitTerminate(X x) {
    ...
  }
}
`,
      name: 'waitTerminate',
      args: 'X x',
      javaCode: `
      try {
        ((Process) getProcess()).waitFor(getTimeout(), TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        // nop
      }
      `
    },
    {
      name: 'destroyed',
      args: 'X x',
      javaCode: `
        // nop
      `
    },
    {
      name: 'buildUrl',
      args: 'X x',
      type: 'String',
      javaCode: `
      AppConfig appConfig = (AppConfig) x.get("appConfig");
      String sessionId = createSession(x);
      try {
        StringBuilder sb = new StringBuilder();
        sb.append(appConfig.getUrl());
        sb.append("/?sessionId=");
        sb.append(sessionId);
        sb.append("#");
        sb.append(getPath());
        if ( getParams() != null ) {
          List<String> params = getParams();
          for ( int i = 0; i < params.size(); i++ ) {
            if ( i == 0 )
              sb.append("?");
            else 
              sb.append("&");
            sb.append(params.get(i));
          }
        }
        return URI.create(sb.toString()).toString();
      } catch (Exception e) {
        throw new RuntimeException("Failed url creation", e);
      }
      `
    },
    {
      name: 'buildCommand',
      args: 'X x',
      type: 'List',
      javaCode: `
      BrowserConfig bc = (BrowserConfig) ((DAO) x.get("browserConfigDAO")).find(AND(EQ(BrowserConfig.ENABLED, true), EQ(BrowserConfig.TYPE, getType())));
      List list = new ArrayList();
      list.add(bc.getExecutable(x));
      // Add user data directory FIRST if configured (must be before other flags)
      if ( bc.getDataDir() != null && !bc.getDataDir().isEmpty() ) {
        list.add("--user-data-dir=" + bc.getDataDir());
      }
      if ( getHeadless() ) {
        list.addAll(List.of(bc.getHeadlessFlags()));
      } else {
        list.addAll(List.of(bc.getHeadedFlags()));
      }
      list.add(buildUrl(x));
      return list;
      `
    },
    {
      name: 'createSession',
      args: 'X x',
      type: 'String',
      javaCode: `
      Session session = new Session();
      session.setUserId(getUserId());
      session.setRemoteHost("[0:0:0:0:0:0:0:1]");
      session = (Session) ((DAO) x.get("sessionDAO")).put_(x, session);
      return session.getId();
      `
    }
  ]
});
