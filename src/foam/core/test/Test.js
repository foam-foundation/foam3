/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.test',
  name: 'Test',
  extends: 'foam.core.script.Script',

  imports: [
    'testDAO',
    'testEventDAO'
  ],

  javaImports: [
    'bsh.Interpreter',
    'foam.core.app.AppConfig',
    'foam.core.app.Mode',
    'foam.core.logger.Logger',
    'foam.core.pm.PM',
    'foam.core.script.*',
    'java.io.ByteArrayOutputStream',
    'java.io.PrintStream',
    'java.util.Date',
    'jdk.jshell.JShell'
  ],

  tableColumns: [
    'id',
    'enabled',
    'source',
    'passed',
    'failed',
    'run',
    'status'
  ],

  searchColumns: [
    'id',
    'description',
    'source',
    'language',
    'status'
  ],

  documentation: `
    A scriptable Unit Test.
    Tests can be run on either the server in BeanShell or on the client in Javascript.
    Call test(boolean exp, String message) for each test, where 'exp' evaluates to
    true if the test passed and false if it failed.
  `,

  properties: [
    'id',
    {
      class: 'String',
      name: 'source',
      tableWidth: 300,
      transient: true,
      visibility: 'RO',
      factory: function() { return this.cls_.id === 'foam.core.test.Test' ? this.language : this.cls_.id; },
      javaFactory: 'return getClass().toString();'
    },
    'enabled',
    {
      class: 'String',
      name: 'testSuite'
    },
    {
      class: 'String',
      name: 'daoKey',
      value: 'testDAO'
    },
    {
      name: 'code',
      visibility: function() {
        return this.cls_.id === 'foam.core.test.Test' ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      name: 'modelCode',
      label: 'Code',
      view: { class: 'foam.u2.tag.TextArea', rows: 20 },
      factory: function() {
        var s = '';
        if ( this.runTest && this.runTest != foam.core.test.Test.prototype.runTest ) {
          s += 'Javascript: ' + this.runTest.toString();
        }
        if ( this.cls_.getAxiomByName('runTest').javaCode ) {
          if ( s ) s += '\n\n';
          s += 'Java: ' + this.cls_.getAxiomByName('runTest').javaCode;
        }
        return s;
      },
      visibility: function() {
        return this.cls_.id === 'foam.core.test.Test' ?
          foam.u2.DisplayMode.HIDDEN :
          foam.u2.DisplayMode.RO ;
      }
    },
    {
      class: 'Long',
      name: 'passed',
      visibility: 'RO',
      tableCellFormatter: function(value) {
        if ( value ) this.start().style({ color: '#3a3', 'font-weight': 'bold' }).add(value).end();
      },
      tableWidth: 85
    },
    {
      class: 'Long',
      name: 'failed',
      visibility: 'RO',
      tableCellFormatter: function(value) {
        if ( value ) this.start().style({ color: '#a33', 'font-weight': 'bold' }).add(value).end();
      },
      tableWidth: 85
    },
    {
      class: 'Boolean',
      name: 'onlyReportFailed',
      documentation: 'when true, only output results for failures.  When a suite has hundreds of tests, the max output is reached before, potentially, displaying all the failed tests.',
      value: false
    },
    {
      class: 'String',
      name: 'eventDaoKey',
      value: 'testEventDAO'
    }
  ],

  methods: [
    {
      /** Template method used to add additional code in subclasses. */
      name: 'runTest',
      type: 'Void',
      javaThrows: ['Throwable'],
      code: function(x) {
        return eval('(async () => {' + this.code + '})()');
      },
      args: 'Context x',
      javaCode: '/* NOOP */'
    },
    {
      name: 'test',
      type: 'Void',
      args: 'Boolean exp, String message',
      // javascript code defined in runScript()
      javaCode: `
        if ( exp ) {
          setPassed(getPassed()+1);
          if ( ! getOnlyReportFailed() )
            print("SUCCESS: " + message);
        } else {
          setFailed(getFailed()+1);
          print("FAILURE: " + message);
        }
      `
    },
    {
      name: 'fail',
      type: 'Void',
      args: 'String message',
      documentation: `
      Logs a test failure with the given message.
      Equivalent to test(false, message).
      `,
      javaCode: `
      test(false, message);
      `
    },
    {
      name: 'pass',
      type: 'Void',
      args: 'String message',
      documentation: `
      Logs a test success with the given message.
      Equivalent to test(true, message).
      `,
      javaCode: `
      test(true, message);
      `
    },
    {
      name: 'testThrows',
      type: 'Void',
      args: [
        {
          name: 'fn', type: 'Runnable'
        },
        {
          name: 'expectedExceptionMessage', type: 'String'
        },
        {
          name: 'expectedExceptionType', type: 'java.lang.Class'
        },
        {
          name: 'message', type: 'String'
        }
      ],
      documentation: `
      Executes the given runnable in a try/catch block and checks if an exception was thrown.
      This test will pass if 1) the exception was thrown, 2) the exception matched the
      expectedExceptionType, and 3) the exception message matches the expectedExceptionMessage.
      Otherwise, a failure will be noted, and test execution will continue.
      `,
      javaCode: `
      boolean   threw           = false;
      String    returnedMessage = "";
      Throwable throwable       = null;

      try {
        fn.run();
      } catch (Throwable t) {
        // only grab information necessary in the catch block
        threw = true;
        throwable = t;
        returnedMessage = t.getMessage();
        if ( foam.lang.FOAMException.class.isInstance(t) ) {
          returnedMessage = ((foam.lang.FOAMException) t).getTranslation();
        }
      }

      if ( ! threw ) {
        fail(message + " (expected exception to be thrown, but exception never was thrown)");
        return;
      }

      if ( ! expectedExceptionType.isInstance(throwable) ) {
        // makes sense to log this information twice
        // one for the test results, one for the log
        // and we do this below as well.
        System.out.println("Exception type mismatch.");
        System.out.println("EXPECTED: '" + expectedExceptionType.getName() + "'");
        System.out.println("ACTUAL  : '" + throwable.getClass().getName() + "'");
        throwable.printStackTrace();

        fail(message +
          " (exception type mismatch, expected " +
          expectedExceptionType.getName() +
          ", actual was: " +
          throwable.getClass().getName() +
          ")");
        return;
      }

      if ( ! foam.util.SafetyUtil.isEmpty(expectedExceptionMessage) &&
           ! returnedMessage.equals(expectedExceptionMessage) ) {
        System.out.println("Error message was not correct.");
        System.out.println("EXPECTED: '" + expectedExceptionMessage + "'");
        System.out.println("ACTUAL  : '" + returnedMessage + "''");

        fail(message+
          " (exception message mismatch, expected '"+
          expectedExceptionMessage+
          "', actual was: "+
          returnedMessage +
          ")");
        return;
      }

      // assume a pass at this point
      pass(message);
      `
    },
    {
      name: 'expect',
      type: 'Void',
      args: 'Object value, Object expectedValue, String message',
      javaCode: `
        if ( foam.util.SafetyUtil.equals(value, expectedValue) ) {
          setPassed(getPassed()+1);
          print("SUCCESS: " + message);
        } else {
          setFailed(getFailed()+1);
          print("FAILURE: " + message + " (expected '"+expectedValue+"', actual result: '"+value+"')");
        }
      `
    },
    {
      name: 'print',
      type: 'Void',
      args: 'String message',
      javaCode: `
        setOutput(getOutput() + "\\n" + message);
      `
    },
    {
      name: 'runScript',
      code: function() {
        var startTime = Date.now();

        return new Promise((resolve, reject) => {
          try {
            this.passed = 0;
            this.failed = 0;
            this.output = '';
            var log = function() {
              this.output += Array.from(arguments).join('') + '\n';
            }.bind(this);
            var test = (condition, message) => {
              if ( condition ) {
                this.passed += 1;
              } else {
                this.failed += 1;
              }
              this.output += ( condition ? 'SUCCESS: ' : 'FAILURE: ' ) +
                message + '\n';

            };
            var expect = (value, expectedValue, message) => {
              if ( foam.util.equals(value, expectedValue) ) {
                this.passed += 1;
                this.output += 'SUCCESS: '+message+'\n';
              } else {
                this.failed += 1;
                this.output += 'FAILURE: '+message+' (expected "'+expectedValue+'", actual result: "'+value+'")\n';
              }
            };

            var updateStats = (err) => {
              var endTime  = Date.now();
              var duration = endTime - startTime; // Unit: milliseconds
              this.lastRun = new Date();
              this.lastDuration = duration;
              if ( err ) {
                this.output += err + '\n';
              }
            };

            with ( { log: log, print: log, x: this.__context__, expect: expect, test: test } ) {
              Promise.resolve(
                this.code ?
                  eval('(async () => {' + this.code + '})()') :
                  this.runTest(this.__context__.createSubContext({
                    log: log, print: log, expect: expect, test: test
                  }))
              ).then(() => {
                updateStats();
                resolve();
              }, (err) => {
                updateStats(err);
                this.failed += 1;
                reject(err);
              });
            }
          } catch (err) {
            updateStats(err);
            this.failed += 1;
            reject(err);
          }
        });
      },
      args: 'Context x',
      javaCode: `
        // disable tests in production
        if ( ((AppConfig) x.get("appConfig")).getMode() == Mode.PRODUCTION ) {
          return;
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintStream           ps   = new PrintStream(baos);
        PM                    pm   = new PM(this.getClass(), getId());
        Language              l    = getLanguage();

        setPassed(0);
        setFailed(0);
        try {
          if ( l == foam.core.script.Language.BEANSHELL ) {
            Interpreter shell = (Interpreter) createInterpreter(x, null);
            setOutput("");
            shell.setOut(ps);

            shell.eval("test(boolean exp, String message) { if ( exp ) { currentScript.setPassed(currentScript.getPassed()+1); } else { currentScript.setFailed(currentScript.getFailed()+1); } print((exp ? \\"SUCCESS: \\" : \\"FAILURE: \\")+message);}");
            shell.eval("pass(String message) { test(true, message);}");
            shell.eval("fail(String message) { test(false, message);}");
            shell.eval("expect(Object value, Object expectedValue, String message) { currentScript.expect(value, expectedValue, message); }");

            shell.eval(getCode());
          } else if ( l == foam.core.script.Language.JSHELL ) {
            String print = null;
            JShell jShell = (JShell) createInterpreter(x, ps);
            print = new JShellExecutor().execute(x, jShell, getCode());
            ps.print(print);
          } else {
            throw new RuntimeException("Script language not supported");
          }
          runTest(x);
          setStatus(ScriptStatus.UNSCHEDULED);
        } catch (Throwable t) {
          setStatus(ScriptStatus.ERROR);
          setFailed(getFailed() + 1);
          ps.println("FAILURE: " + t.getMessage());
          t.printStackTrace(ps);
          Logger logger = (Logger) x.get("logger");
          logger.error(this.getClass().getSimpleName(), "runTest", getId(), t);
          pm.error(x, t);
        } finally {
          pm.log(x);
        }

        setLastRun(new Date());
        setLastDuration(pm.getTime());
        ps.flush();
        setOutput(baos.toString() + getOutput());
      `
    }
  ]
});
