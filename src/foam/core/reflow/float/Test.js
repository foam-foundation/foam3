/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.float',
  name: 'PassFailView',
  extends: 'foam.u2.View',

  properties: [ 'nodeName', 'span' ],

  methods: [
    function render() {
      this.SUPER();
      this.style({display: 'inline'});
      this.add(this.dynamic(function(data) {
        if ( data ) {
          this.start('span').style({color: 'green'}).add('PASSED');
        } else {
          this.start('span').style({color: 'red'}).add('FAILED');
        }
      }));
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.float',
  name: 'TestResults',

  requires: [ 'foam.dao.EasyDAO' ],

  imports: [ 'eval_', 'flow?' ],

  properties: [
    {
      class: 'Int',
      name: 'passed',
      reactive: false,
      visibility: 'RO',
      transient: true
    },
    {
      class: 'Int',
      name: 'failed',
      reactive: false,
      visibility: 'RO',
      transient: true
    },
    {
      class: 'Int',
      name: 'missing',
      reactive: false,
      visibility: 'RO',
      transient: true,
      expression: function(passed, failed, total) {
        return total - passed - failed;
      }
    },
    {
      class: 'Int',
      name: 'total',
      reactive: false,
      // Not transient, is stored so we know if any tests are missing
      visibility: 'RO'
    },
    {
      name: 'dao',
      hidden: true,
      transient: true,
      factory: function() {
        return this.EasyDAO.create({
          seqNo: true,
          daoType: 'MDAO',
          of: foam.core.reflow.float.Test
        });
      }
    },
    {
      class: 'Boolean',
      name: 'success',
      hidden: true,
      transient: true,
      expression: function(passed, failed, total) {
        return passed == total;
      }
    },
    {
      name: 'status',
      transient: true,
      reactive: false,
      visibility: 'RO',
      expression: function(success, passed, failed, total, missing) {
        var msg = success ? 'PASSED' : 'FAILED';
        msg = msg + ` (Passed=${passed}, Failed=${failed}`;
        if ( missing ) msg = msg + `, Missing=${missing}`;
        return msg + ')';
      }
    }
  ],

  methods: [
    function report(test) {
      this.dao.put(test);
      if ( test.status ) { this.passed++; } else { this.failed++; }
      test.status$.sub((_, __, ___, slot) => {
        if ( slot.get() ) {
          this.passed++;
          this.failed--;
        } else {
          this.passed--;
          this.failed++;
        }

        this.dao.put(test);
        this.updateStatus();
      });

      this.updateStatus();
    },

    function updateStatus() {
      this.total = Math.max(this.total, this.passed + this.failed);

      if ( this.flow ) {
        this.flow.status = this.status;
      }
    }
  ],

  actions: [
    {
      name: 'resetTotal',
      isEnabled: function(failed, passed, total) { return total != passed + failed; },
      code: function() { this.total = this.failed + this.passed; }
    },
    {
      name: 'browse',
      code: function() {
        this.eval_('dao(testResults.dao, "Test Results")');
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.float',
  name: 'TestView',
  extends: 'foam.u2.View',

  methods: [
    function render() {
      this.SUPER();
      this.start('h3').
        add(function(status) {
          if ( status ) {
            this.start('span').style({color: 'green'}).add('TEST PASSED: ');
          } else {
            this.start('span').style({color: 'red'}).add('TEST FAILED: ');
          }
        }).
        add(this.data.description$);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.float',
  name: 'TestResultsView',
  extends: 'foam.u2.View',

  methods: [
    function render() {
      this.SUPER();

      this.
        start('h2').
          add('Test Results').
        end().
        start().
          style({marginLeft: '20px', marginBottom: '20px', fontSize: 'larger'}).

          select(this.data.dao, function(t) {
            this.startContext({data: t}).add(t.id, ' ').start(t.STATUS).style({display: 'inline-block', width: '70px'}).end().add(' ', t.description).br();
          }).

          br().

          start().
            show(this.data.passed$).
            style({color: 'green'}).
            add('PASSED: ', this.data.passed$).
          end().
          start().
            show(this.data.failed$).
            style({color: 'red'}).
            add('FAILED: ',   this.data.failed$).
          end().
          start().
            show(this.data.missing$).
            style({color: 'red'}).
            add('MISSING: ',  this.data.missing$).
          end().
          start('b').add('TOTAL: ', this.data.total$);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.float',
  name: 'Test',

  tableColumns: [
    'description', 'status'
  ],

  properties: [
    {
      class: 'Long',
      name: 'id',
      hidden: true,
      reactive: false,
      transient: true
    },
    {
      class: 'String',
      name: 'description',
      reactive: false,
    },
    {
      class: 'String',
      name: 'notes',
      reactive: false,
      width: 80,
      view: { class: 'foam.u2.tag.TextArea', rows: 3, cols: 78 }
    },
    {
      class: 'String',
      name: 'received',
      reactive: false,
      transient: true,
      visibility: 'RO',
      width: 80,
      view: { class: 'foam.u2.tag.TextArea', rows: 6, cols: 78 }
    },
    {
      class: 'String',
      name: 'expected',
//      visibility: 'RO',
      reactive: false,
      width: 80,
      view: { class: 'foam.u2.tag.TextArea', rows: 6, cols: 78 }
    },
    {
      class: 'Boolean',
      name: 'status',
      reactive: false,
      visibility: 'RO',
      view: 'foam.core.reflow.float.PassFailView',
      tableCellFormatter: function(value, obj) {
        this.start(foam.core.reflow.float.PassFailView, {data: value});
      },
      expression: function(received, expected) {
        return received === expected;
      }
    }
  ],

  actions: [
    {
      name: 'accept',
      isEnabled: function(status) { return ! status; },
      code: function() {
        this.expected = this.received;
      }
    }
  ]
});
