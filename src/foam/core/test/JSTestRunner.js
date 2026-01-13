/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.test',
  name: 'JSTestRunner',

  implements: [
    'foam.lang.ContextAgent',
    'foam.mlang.Expressions'
  ],

  imports: [
    'testDAO',
    'testRunDAO'
  ],

  requires: [
    'foam.core.script.Language',
    'foam.core.script.Script',
    'foam.core.test.Test',
    'foam.core.test.TestRun'
  ],

  properties: [
    {
      name: 'testRunId',
      class: 'String'
    },
    {
      name: 'testIds',
      class: 'String'
    },
    {
      name: 'testSuites',
      class: 'String'
    }
  ],

  methods: [
    async function execute(x) {
      var self = this;
      console.info('Testing starting');

      var testRunId = this.testRunId || Date.now().toString();
      var testRun   = await this.testRunDAO.find(testRunId);
      if ( ! testRun ) {
        console.warn('TestRun not found', testRunId);
        testRun = this.TestRun.create({ id: testRunId });
      } else {
        testRun.completed = false;
      }

      var testDAO = this.testDAO;
      testDAO     = testDAO.where(this.EQ(this.Test.ENABLED, true));
      testDAO     = testDAO.where(this.EQ(this.Test.LANGUAGE, this.Language.JS));

      if ( this.testSuites ) {
        testRun.setSuites(this.testSuites);
        testDAO = testDAO.where(this.IN(this.Test.TEST_SUITE, this.testSuites.split(",")));
      }

      if ( this.testIds ) {
        testRun.setFilter(this.testIds);
        var includeIds = [];
        var excludeIds = [];
        this.testsIds.split(',').forEach(i => {
          if ( i.startsWith('-') )
            excludeIds.push(i.substring(1));
          else
            includeIds.push(i);
        });
        if ( includeIds.length > 0 ) {
          testDAO = TestDAO.where(this.IN(this.Test.ID, includeIds));
        }
        if ( excludeIds.length > 0 ) {
          testDAO = TestDAO.where(this.NOT(this.IN(this.Test.ID, excludeIds)));
        }
      }

      let count     = (await testDAO.select(this.Count.create())).value;
      testRun.cases = count;
      var visited   = 0;
      testDAO.select({
        put: async function(t) {
          try {
            console.info('Test', t.id);
            await t.runScript();
            // t.copyFrom(await testDAO.find(t.id));
            // t.run();
            t.copyFrom(await testDAO.put(t));
            testRun.passed += t.passed;
            testRun.failed += t.failed;
            if ( t.failed ) {
              console.warn('Test', t.id, t.passed, t.failed);
              // TODO: capture individual tests failures on the test,
              // so they can be added here.
              testRun.failures.push(t.id);
            } else {
              console.info('Test', t.id, t.passed, t.failed);
            }
          } catch (e) {
            console.error('Test failed', t.id, e);
            testRun.failed += 1;
          } finally {
            visited += 1;
            if ( visited == count ) {
              if ( testRun ) {
                testRun.tests = testRun.passed + testRun.failed;
                testRun.completed = true;
                testRun = await self.testRunDAO.put(testRun);
              }
              console.info('Testing complete');

              // Shutdown JavetShell
              if ( typeof signalDone === 'function' ) {
                console.info('JSTestRunner: signalDone');
                signalDone();
              }
            }
          }
        }
      });
    }
  ]
});
