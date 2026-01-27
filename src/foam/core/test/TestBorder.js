/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.test',
  name: 'TestBorder',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.memento.Memorable'],
  implements: ['foam.mlang.Expressions'],

  imports: [
    'stack',
    'testRunDAO'
  ],

  requires: [
    'foam.core.script.Language',
    'foam.core.script.ScriptStatus',
    'foam.core.test.Test',
    'foam.core.test.TestRun',
    'foam.u2.table.TableView'
  ],

  css: `
    ^upper > span{
      margin: 0 10px 10px 0;
    }
    ^container{
      display: flex;
      flex-direction: column;
      height: 100%
    }
    ^upper{
      flex: 0 0 0;
      margin-bottom: 10px;
    }
    ^table{
      /* Add a fixed height and let flex extend to max possible */
      flex: 1;
      height: 424px;
    }
  `,

  properties: [
    'status',
    { class: 'Int', name: 'total' },
    { class: 'Int', name: 'passed' },
    { class: 'Int', name: 'failed' },
    { class: 'Map', name: 'selectedObjects' },
    {
      documentation: 'Intended for remote automation - when set test execution will occur on render',
      name: 'testRunId',
      class: 'String',
      memorable: true,
      visibility: 'HIDDEN'
    },
    {
      documentation: 'Intended for remote automation - restrict language of tests to consider',
      name: 'language',
      class: 'String',
      value: 'JS',
      memorable: true,
      visibility: 'HIDDEN'
    },
    {
      documentation: 'Intended for remote automation - filter tests to run',
      name: 'filter',
      class: 'String',
      memorable: true,
      visibility: 'HIDDEN'
    },
    {
      name: 'dao',
      visibility: 'HIDDEN',
      expression: function(testRunId, language, filter) {
        var d = this.data;
        d = d.where(this.EQ(foam.core.test.Test.ENABLED, true));
        if ( this.testRunId ) {
          d = d.where(this.EQ(foam.core.test.Test.LANGUAGE, this.language));
          if ( this.filter ) {
            d = d.where(this.IN(foam.core.test.Test.ID, this.filter.split(',')));
          }
        }
        return d;
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.onDetach(this.stack.setTrailingContainer(
        this.E()
          .style({display: 'inline-flex', marginBottom: '10px'})
          .startContext({ data: this })
          .start().tag(this.RUN_CLIENT).tag(this.RUN_FAILED_CLIENT).end()
          .start().tag(this.RUN_ALL).tag(this.RUN_FAILED).end()
          .start().tag(this.RUN_SERVER).tag(this.RUN_FAILED_SERVER).end()
          .endContext()
      ));
      this.SUPER();
      var self = this;
      this
        .addClass(this.myClass('container'))
        .start()
          .addClass(this.myClass('upper'))
          .start('span').add('Total: ',  this.total$).end()
          .start('span').add('Passed: ', this.passed$).end()
          .start('span').add('Failed: ', this.failed$).end()
          .start('span').add('Status: ', this.status$).end()
        .end()
        .start(this.TableView, { data$: this.data$, selectedObjects$: this.selectedObjects$ })
          .addClass(this.myClass('table'))
        .end();

      this.dao.select({ put: function(t) { self.total += 1; } });
      if ( this.testRunId ) {
        this.runTests(this.dao);
      }
    },

    async function runTests(dao) {
      var self = this;
      this.status = 'Testing...';
      this.passed = this.failed = 0;

      console.log('Testing starting');
      var startTime = Date.now();
      var count     = (await dao.select(this.Count.create())).value;
      var visited   = 0;
      var testRun   = null;
      if ( this.testRunId ) {
        testRun = await this.testRunDAO.find(this.testRunId);
        if ( ! testRun ) {
          testRun = this.TestRun.create({id: this.testRunId});
          testRun.server = false;
        } else {
          testRun.completed = false;
        }
      }

      dao.select({
        put: async function(t) {
          try {
            self.status = 'Testing: ' + t.id;

            // When running a lot of unit tests at once, we don't want to get flooded
            // with notifications, so turn them off in this context
            t = t.clone(t.__context__.createSubContext({
              notificationDAO: foam.dao.NullDAO.create(),
              myNotificationDAO: foam.dao.NullDAO.create()
            }));

            t.run();
            t.copyFrom(await dao.put(t));
            self.passed += t.passed;
            if ( t.failed ) {
              self.failed += t.failed;
              if ( testRun ) {
                // TODO: capture individual tests failures on the test,
                // so they can be added here.
                testRun.failures.push(t.id);
              }
            }
          } catch (e) {
            console.error('Test failed', t.id, e);
            self.failed += 1;
          } finally {
            visited += 1;
            if ( visited == count ) {
              if ( testRun ) {
                testRun.cases     = self.total;
                testRun.passed    = self.passed;
                testRun.failed    = self.failed;
                testRun.tests     = self.passed + self.failed;
                testRun.completed = true;
                self.testRunDAO.put(testRun);
              }
              var duration = (Date.now() - startTime) / 1000;
              self.status = `${self.passed + self.failed} tests run in ${duration.toFixed(2)} seconds`;
              console.log('Testing complete.', self.status);
            }
          }
        }
      });
    }
  ],

  actions: [
    {
      name: 'runClient',
      code: function(X) {
        this.runTests(this.dao.where(this.EQ(this.Test.LANGUAGE, 'JS')));
      }
    },
    {
      name: 'runFailedClient',
      code: function(X) {
        this.runTests(this.dao.where(
          this.AND(
            this.GT(this.Test.FAILED, 0),
            this.EQ(this.Test.LANGUAGE, 'JS')
          )));
      }
    },
    {
      name: 'runAll',
      code: function(X) {
        this.runTests(this.dao);
      }
    },
    {
      name: 'runFailed',
      code: function(X) {
        this.runTests(this.dao.where(this.GT(this.Test.FAILED, 0)));
      }
    },
    {
      name: 'runServer',
      code: function(X) {
        this.runTests(this.dao.where(
          this.OR(
            this.EQ(this.Test.LANGUAGE, 'BEANSHELL'),
            this.EQ(this.Test.LANGUAGE, 'JSHELL')
          )));
      }
    },
    {
      name: 'runFailedServer',
      code: function(X) {
        this.runTests(this.dao.where(
          this.AND(
            this.GT(this.Test.FAILED, 0),
            this.OR(
              this.EQ(this.Test.LANGUAGE, 'BEANSHELL'),
              this.EQ(this.Test.LANGUAGE, 'JSHELL')
            ))));
      }
    }
  ]
});
