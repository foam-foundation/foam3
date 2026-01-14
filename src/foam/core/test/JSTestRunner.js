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

      // NOTE: Explicit Promise used so it can be resolved from within
      // the last DAO select sink when all test cases have been processed.
      // With 'await' the dao select returns before the sink is complete
      return new Promise((resolve, reject) => {
        var self = this;
        console.info('Testing starting');

        var testRunId = this.testRunId || Date.now().toString();
        this.testRunDAO.find(testRunId).then(function(testRun) {
          if ( ! testRun ) {
            console.warn('TestRun not found', testRunId);
            testRun = self.TestRun.create({ id: testRunId });
          } else {
            testRun.completed = false;
          }

          var testDAO = self.testDAO;
          testDAO     = testDAO.where(self.EQ(self.Test.ENABLED, true));
          testDAO     = testDAO.where(self.EQ(self.Test.LANGUAGE, self.Language.JS));

          if ( self.testSuites ) {
            testRun.setSuites(self.testSuites);
            testDAO = testDAO.where(self.IN(self.Test.TEST_SUITE, self.testSuites.split(",")));
          }

          if ( self.testIds ) {
            testRun.setFilter(self.testIds);
            var includeIds = [];
            var excludeIds = [];
            self.testsIds.split(',').forEach(i => {
              if ( i.startsWith('-') )
                excludeIds.push(i.substring(1));
              else
                includeIds.push(i);
            });
            if ( includeIds.length > 0 ) {
              testDAO = TestDAO.where(self.IN(self.Test.ID, includeIds));
            }
            if ( excludeIds.length > 0 ) {
              testDAO = TestDAO.where(self.NOT(self.IN(self.Test.ID, excludeIds)));
            }
          }

          testDAO.select(self.Count.create()).then(function(count) {
            testRun.cases = count.value;
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
                    resolve();
                  }
                }
              }
            });
          });
        });
      });
    }
  ]
});
