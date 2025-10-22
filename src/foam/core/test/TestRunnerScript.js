/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.test',
  name: 'TestRunnerScript',
  extends: 'foam.core.script.Script',

  documentation: `Script for running Test Scripts - both Server (Java) and Client (Javascript).
Test execution results are output standard out (log file).
Example:
TEST REPORT SERVER - TEST CASES: 77, TESTS: 688
 PASSED: 688
 FAILED: 0

TEST REPORT CLIENT - TEST CASES: 8, TESTS: 14
 PASSED: 14
 FAILED: 0

Test results are also captured in the TestRun DAO - but since the test
are normally run from the build, the TestRun DAO is destroyed on each
run.

To run headed rather than headless, run tests with the following.
This will also keep the foam application running for inspection from the GUI.
./build.sh --client-tests --test-headed
`,

  javaImports: [
    'foam.core.browser.BrowserAgent',
    'foam.core.logger.LogLevelFilterLogger',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.logger.PrefixLogger',
    'foam.core.script.Language',
    'foam.core.test.Test',
    'foam.core.test.TestRun',
    'foam.dao.DAO',
    'foam.dao.ArraySink',
    'foam.lang.Agency',
    'foam.lang.X',
    'foam.log.LogLevel',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.IN',
    'static foam.mlang.MLang.OR',
    'static foam.mlang.MLang.NOT',
    'foam.util.SafetyUtil',
    'java.time.Duration',
    'java.time.temporal.ChronoUnit',
    'java.util.*'
  ],

  constants: [
    {
      name: 'CHECK_MARK',
      type: 'String',
      value: '\u2713'
    },
    {
      name: 'CROSS_MARK',
      type: 'String',
      value: '\u2718'
    },
    {
      name: 'GREEN_COLOR',
      type: 'String',
      value: '\u001B[32m'
    },
    {
      name: 'RED_COLOR',
      type: 'String',
      value: '\u001B[31m'
    },
    {
      name: 'RESET_COLOR',
      type: 'String',
      value: '\u001B[0m'
    },
    {
      name: 'SERVER_SIDE',
      type: 'String',
      value: 'server'
    },
    {
      name: 'CLIENT_SIDE',
      type: 'String',
      value: 'client'
    },
    {
      name: 'BOTH_SIDE',
      type: 'String',
      value: 'both'
    },
    {
      name: 'SYSTEM_TESTS',
      type: 'String',
      value: 'foam.tests'
    },
    {
      name: 'SYSTEM_TEST_SUITES',
      type: 'String',
      value: 'foam.test.suites'
    },
    {
      name: 'SYSTEM_TEST_SIDE',
      type: 'String',
      value: 'foam.test.side'
    },
    {
      name: 'SYSTEM_TEST_HEADED',
      type: 'String',
      value: 'foam.test.headed'
    }
  ],

  properties: [
    {
      documentation: 'Default user to run test. Refine in applications to use application admin',
      name: 'userId',
      class: 'Long',
      value: 42 // foam admin
    },
    {
      name: 'path',
      class: 'String',
      value: 'admin.tests' // menu with TestBorder
    },
    {
      name: 'includeTestIds',
      class: 'List'
    },
    {
      name: 'excludeTestIds',
      class: 'List'
    }
  ],

  methods: [
    {
      name: 'runScript',
      args: 'Context x',
      javaCode: `
      TestRun serverTestRun  = null;
      TestRun clientTestRun  = null;
      List<Test> serverTests = null;
      List<Test> clientTests = null;
      DAO testRunDAO = (DAO) x.get("testRunDAO");
      String side = System.getProperty(SYSTEM_TEST_SIDE);
      String filter = System.getProperty(SYSTEM_TESTS);
      includeExcludeTestIds(x, filter);
      // int filtered = SafetyUtil.isEmpty(filter) ? 0 : filter.split(",").length;
      String suites = System.getProperty(SYSTEM_TEST_SUITES);
      boolean exit = ! Boolean.valueOf(System.getProperty(SYSTEM_TEST_HEADED, "false"));
      int totalTests = 0;

      if ( SafetyUtil.isEmpty(side) ||
           SERVER_SIDE.equals(side) ||
           BOTH_SIDE.equals(side) ) {
        TestRun testRun = new TestRun();
        testRun.setDescription(getPath());
        if ( ! SafetyUtil.isEmpty(suites) )
          testRun.setDescription(testRun.getDescription() + "-" + suites);
        if ( ! SafetyUtil.isEmpty(filter) )
          testRun.setDescription(testRun.getDescription() + "-" + filter);
        List<Test> tests = getServerSideTests(x, testRun);
        if ( tests.size() > 0 ) {
          setupServerSide(x);
          testRun.setCases(tests.size());
          testRun = (TestRun) testRunDAO.put(testRun).fclone();
          testRun = runServerSideTests(x, tests, testRun);
          teardownServerSide(x);
          serverTests = tests;
          totalTests += tests.size();
          serverTestRun = testRun;
        }
      }

      if ( SafetyUtil.isEmpty(side) ||
           CLIENT_SIDE.equals(side) ||
           BOTH_SIDE.equals(side) ) {
        TestRun testRun = new TestRun();
        testRun.setServer(false);
        testRun.setDescription(getPath());
        if ( ! SafetyUtil.isEmpty(suites) )
          testRun.setDescription(testRun.getDescription() + "-" + suites);
        if ( ! SafetyUtil.isEmpty(filter) )
          testRun.setDescription(testRun.getDescription() + "-" + filter);
        List<Test> tests = getClientSideTests(x, testRun);
        if ( tests.size() > 0 ) {
          setupClientSide(x);
          testRun.setCases(tests.size());
          testRun = (TestRun) testRunDAO.put(testRun).fclone();
          testRun = runClientSideTests(x, tests, testRun);
          teardownClientSide(x);
          testRun = (TestRun) testRunDAO.find(testRun.getId());
          clientTestRun = testRun;
          clientTests = tests;
          totalTests += tests.size();
        }
      }

      int exitCode = 0;
      if ( serverTestRun != null ) {
        reportResults(x, serverTestRun);
        if ( serverTestRun.getFailed() > 0 )
          exitCode = 1;
      }
      if ( clientTestRun != null ) {
        reportResults(x, clientTestRun);
        if (clientTestRun.getFailed() > 0 )
          exitCode = 1;
      }
      System.out.println("");

      if ( getIncludeTestIds().size() > 0 &&
           getIncludeTestIds().size() != totalTests ) {
        Map<String, String> m = new HashMap();
        for ( String id : (List<String>) getIncludeTestIds() ) {
          m.put(id, BOTH_SIDE);
        }
        if ( clientTests != null ) {
          for ( Test test : clientTests ) {
            if ( m.get(test.getId()) != null &&
                 ( BOTH_SIDE.equals(side) || CLIENT_SIDE.equals(side)) ) {
              m.remove(test.getId());
            } else {
              m.put(test.getId(), CLIENT_SIDE);
            }
          }
        }
        if ( serverTests != null ) {
          for ( Test test : serverTests ) {
            if ( m.get(test.getId()) != null &&
                 ( BOTH_SIDE.equals(side) || SERVER_SIDE.equals(side)) ) {
              m.remove(test.getId());
            } else {
              m.put(test.getId(), SERVER_SIDE);
            }
          }
        }
        if ( m.size() > 0 ) {
          for ( String id : m.keySet() ) {
            String mode = m.get(id);
            StringBuilder sb = new StringBuilder();
            sb.append("WARNING :: Test not run: ");
            sb.append(id);
            sb.append(". Mode: ");
            sb.append(side);
            if ( ! SafetyUtil.isEmpty(suites) ) {
              sb.append(". Suites: ");
              sb.append(suites);
            }
            sb.append(". Possible client/server/suite mismatch or typo.");
            printBold(RED_COLOR + " " + sb.toString() +" "+ RESET_COLOR);
          }
          exitCode = 1;
        }
      }

      if ( exit )
        System.exit(exitCode);
      `
    },
    {
      name: 'includeExcludeTestIds',
      args: 'X x, String ids',
      javaCode: `
      List<String> includeTestIds = new ArrayList<String>();
      List<String> excludeTestIds = new ArrayList<String>();
      if ( ! SafetyUtil.isEmpty(ids) ) {
        for ( String id : ids.split(",") ) {
          if ( id.startsWith("-") )
            excludeTestIds.add(id.substring(1));
          else
            includeTestIds.add(id);
        }
      }
      setIncludeTestIds(includeTestIds);
      setExcludeTestIds(excludeTestIds);
      `
    },
    {
      name: 'setupServerSide',
      args: 'X x',
      javaCode: `
        x.get("http");

        // Control logging level with JVM parameter -Dlog.level=INFO
        // set through the build with --log-level:INFO

        LogLevelFilterLogger loggerFilter = (LogLevelFilterLogger) x.get("logger");
        LogLevel logLevel = LogLevel.valueOf(System.getProperty("log.level", "ERROR"));
        loggerFilter.setLogDebug(logLevel.getOrdinal() <= LogLevel.DEBUG.getOrdinal());
        loggerFilter.setLogInfo(logLevel.getOrdinal() <= LogLevel.INFO.getOrdinal());
        loggerFilter.setLogWarning(logLevel.getOrdinal() <= LogLevel.WARN.getOrdinal());
      `
    },
    {
      name: 'teardownServerSide',
      args: 'X x',
      javaCode: `
      // Don't reset logger when running just server side tests,
      // else the results are obscured by the Shutdown hook output
      if ( ! SERVER_SIDE.equals(System.getProperty(SYSTEM_TEST_SIDE)) ) {
        LogLevelFilterLogger loggerFilter = (LogLevelFilterLogger) x.get("logger");
        loggerFilter.setLogDebug(false);
        loggerFilter.setLogInfo(true);
        loggerFilter.setLogWarning(true);
      }
      `
    },
    {
      name: 'setupClientSide',
      args: 'X x',
      javaCode: `
        x.get("http");

        LogLevelFilterLogger loggerFilter = (LogLevelFilterLogger) x.get("logger");
        loggerFilter.setLogDebug(false); // easier to see report on stdout
        loggerFilter.setLogInfo(true);
        loggerFilter.setLogWarning(true);
      `
    },
    {
      name: 'teardownClientSide',
      args: 'X x',
      javaCode: `
        // re-disable debug, info so results are displayed last
        LogLevelFilterLogger loggerFilter = (LogLevelFilterLogger) x.get("logger");
        loggerFilter.setLogDebug(false);
        loggerFilter.setLogInfo(false);
        loggerFilter.setLogWarning(false);
      `
    },
    {
      name: 'getServerSideTests',
      args: 'X x, TestRun testRun',
      type: 'List',
      javaCode: `
        DAO testDAO = (DAO) x.get("testDAO");
        testDAO = testDAO.where(
          AND(
            EQ(Test.ENABLED, true),
            OR(
              EQ(Test.LANGUAGE, Language.BEANSHELL),
              EQ(Test.LANGUAGE, Language.JSHELL)
            )));

        String testSuites = System.getProperty(SYSTEM_TEST_SUITES);
        if ( ! SafetyUtil.isEmpty(testSuites) ) {
          testRun.setSuites(testSuites);
          testDAO = testDAO.where(IN(Test.TEST_SUITE, Arrays.asList(testSuites.split(","))));
        }

        if ( getIncludeTestIds().size() > 0 ) {
          testRun.setFilter(String.join(",", ((List<String>)getIncludeTestIds())));
          testDAO = testDAO.where(IN(Test.ID, (List<String>)getIncludeTestIds()));
        }
        if ( getExcludeTestIds().size() > 0 ) {
          testRun.setFilter(String.join(",-", ((List<String>)getExcludeTestIds())));
          testDAO = testDAO.where(NOT(IN(Test.ID, (List<String>)getExcludeTestIds())));
        }

        return (List) ((ArraySink) testDAO.select(new ArraySink())).getArray();
      `
    },
    {
      name: 'runServerSideTests',
      args: 'X x, List tests, TestRun testRun',
      type: 'TestRun',
      javaCode: `
        int passed = 0;
        int failed = 0;
        List<Test> failedTests = new ArrayList();
        for ( Test test : (List<Test>)tests ) {
          test = (Test) test.fclone();

          printBold(test.getId());
          try {
            test.runScript(x);
            passed += test.getPassed();
            failed += test.getFailed();
            if ( (int) test.getFailed() > 0) {
              failedTests.add(test);
            }
            printOutput(test);
          }
          catch ( Exception e ) {
            Loggers.logger(x).error("TestRunnerScript,runServerSideTests", e);
            failed += 1;
            failedTests.add(test);
          }
        }

        testRun.setCases(tests.size());
        testRun.setPassed(passed);
        testRun.setFailed(failed);
        testRun.setTests(passed + failed);
        testRun.setCompleted(true);

        if ( failedTests.size() > 0 ) {
          List<String> results = new ArrayList<String>();
          for (Test test: failedTests ) {
            results.add(test.getId());
            String outputs[] = test.getOutput().split("\\n");
            for( String output: outputs ) {
              if ( output.startsWith("FAILURE") ) {
                results.add(output);
              }
            }
          }
          testRun.setFailures(results);
        }
        return (TestRun) ((DAO) x.get("testRunDAO")).put(testRun);
      `
    },
    {
      name: 'getClientSideTests',
      args: 'X x, TestRun testRun',
      type: 'List',
      javaCode: `
        DAO testDAO = (DAO) x.get("testDAO");
        testDAO = testDAO.where(
          AND(
            EQ(Test.ENABLED, true),
            EQ(Test.LANGUAGE, Language.JS)
          ));

        String testSuites = System.getProperty(SYSTEM_TEST_SUITES);
        if ( ! SafetyUtil.isEmpty(testSuites) ) {
          testRun.setSuites(testSuites);
          testDAO = testDAO.where(IN(Test.TEST_SUITE, Arrays.asList(testSuites.split(","))));
        }

        if ( getIncludeTestIds().size() > 0 ) {
          testRun.setFilter(String.join(",", ((List<String>)getIncludeTestIds())));
          testDAO = testDAO.where(IN(Test.ID, (List<String>)getIncludeTestIds()));
        }
        if ( getExcludeTestIds().size() > 0 ) {
          testRun.setFilter(String.join(",-", ((List<String>)getExcludeTestIds())));
          testDAO = testDAO.where(NOT(IN(Test.ID, (List<String>)getExcludeTestIds())));
        }

        return (List) ((ArraySink) testDAO.select(new ArraySink())).getArray();
      `
    },
    {
      name: 'runClientSideTests',
      args: 'X x, List tests, TestRun testRun',
      type: 'TestRun',
      javaCode: `
      final Logger logger = new PrefixLogger(new Object[] { "TestRunnerScript", getPath() }, Loggers.logger(x));
      x = x.put("logger", logger);

      final DAO dao = (DAO) x.get("testRunDAO");
      final String id = testRun.getId();

      List<String> params = new ArrayList();
      params.add("testRunId="+testRun.getId());
      if ( !SafetyUtil.isEmpty(testRun.getFilter()) )
        params.add("filter=" + testRun.getFilter());

      BrowserAgent agent = new BrowserAgent(x, getPath(), params) {
        public void waitTerminate(X x) {
          logger.info("BrowserAgent,terminate,wait");
          long timeout = Duration.of(getTimeout(), ChronoUnit.SECONDS).toMillis();
          long startTime = System.currentTimeMillis();
          long processTime = 0L;
          while ( processTime <= timeout ) {
            try {
              TestRun tr = (TestRun) dao.find(id);
              if ( tr.getCompleted() ) {
                logger.info("BrowserAgent,terminate,exit");
                return;
              }
              logger.info("BrowserAgent,terminate,wait,5s,timeout in",Duration.of(processTime - timeout, ChronoUnit.MILLIS));
              Thread.currentThread().sleep(5000);
            } catch (InterruptedException e) {
              logger.warning("BrowserAgent,terminate,exit,interrupted");
              return;
            }
            processTime = System.currentTimeMillis() - startTime;
          }
          logger.warning("BrowserAgent,terminate,exit,timeout");
        }
      };
      agent.setHeadless( ! Boolean.getBoolean(SYSTEM_TEST_HEADED) );
      agent.execute(x);
      return (TestRun) dao.find(testRun.getId());
      `
    },
    {
      name: 'reportResults',
      args: 'X x, TestRun testRun',
      javaCode: `
        System.out.println();
        System.out.println("TEST REPORT" + (testRun.getServer() ? " SERVER - ":" CLIENT - ") + "TEST CASES: " + testRun.getCases() + ", TESTS: " + testRun.getTests());
        if ( ! SafetyUtil.isEmpty(testRun.getSuites()) )
          System.out.println("TEST SUITES: " + testRun.getSuites());

        printBold(GREEN_COLOR + " " +  "PASSED: " + Integer.toString(testRun.getPassed()) + " " + RESET_COLOR);
        printBold(RED_COLOR + " " + "FAILED: " + Integer.toString(testRun.getFailed()) + " " + RESET_COLOR);
        if ( testRun.getFailures() != null &&
             testRun.getFailures().size() > 0 ) {
          for ( String line : (List<String>) testRun.getFailures() ) {
            if ( line.startsWith("FAILURE") ) {
              System.out.println("\\t" + RED_COLOR + " "+ CROSS_MARK + " " + line + " " + RESET_COLOR);
            } else {
              System.out.println(line);
            }
          }
        }
      `
    },
    {
      name: 'printBold',
      args: 'String message',
      javaCode: 'System.out.println("\\033[0;1m" + message + RESET_COLOR);'
    },
    {
      name: 'printOutput',
      args: 'Test test',
      javaCode: `
        String outputs[] = test.getOutput().split("\\n");
        for( String output: outputs ) {
          if ( output.startsWith("SUCCESS") ) {
            System.out.println("\\t" + GREEN_COLOR + " " + CHECK_MARK + " " + output + " " + RESET_COLOR);
          }
          else if ( output.startsWith("FAILURE") ) {
            System.out.println("\\t" + RED_COLOR + " "+ CROSS_MARK + " " + output + " " + RESET_COLOR);
          }
        }
      `
    }
  ]
});
