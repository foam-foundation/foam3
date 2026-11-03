/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'DAOPromptRunningProbeAgent',

  documentation: `A select agent the test holds open: execute() waits on gate,
    then throws when fail is set, else selects from the prompt's DAO.`,

  imports: [ 'sinkDAO as dao' ],

  properties: [
    'gate',
    { class: 'Boolean', name: 'fail' }
  ],

  methods: [
    async function execute(e) {
      await this.gate;
      if ( this.fail ) throw new Error('probe select failed');
      await this.dao.select();
    },
    function addToE() {}
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'DAOPromptRunningTest',
  extends: 'foam.core.test.JSTest',

  documentation: `DAOPrompt.running is true from a run request, or from an aql
    change that schedules maybeAutoRun, until the select has returned; an
    erroring select leaves running false and hasError true, and the next
    successful run clears hasError.`,

  requires: [
    'foam.core.auth.User',
    'foam.core.reflow.DAOPrompt',
    'foam.core.reflow.DAOPromptView',
    'foam.core.reflow.test.DAOPromptRunningProbeAgent',
    'foam.dao.MDAO'
  ],

  methods: [
    async function runTest(x) {
      var self  = this;
      var wait  = ms => new Promise(r => setTimeout(r, ms));
      var gate  = () => { var open; var p = new Promise(r => { open = r; }); p.open = open; return p; };
      var vx    = x.createSubContext({ block: {}, scope: {}, eval_: () => {} });
      var dao   = this.MDAO.create({ of: this.User });
      var agent = this.DAOPromptRunningProbeAgent.create();
      var g     = gate();
      agent.gate = g;

      var prompt = this.DAOPrompt.create({ dao: dao, autoRun: true }, vx);
      prompt.select = agent;
      agent = prompt.select; // preSet recontextualizes by clone
      agent.gate = g;
      await wait(50);        // init() subscribes to aql after an await

      var view = this.DAOPromptView.create({ data: prompt }, vx);
      view.write(x.document.body);
      await wait(50);
      x.test(prompt.running, 'running while the first select is open');

      g.open();
      await wait(50);
      x.test(! prompt.running, 'not running once the first select returned');
      x.test(! prompt.hasError, 'no error after a successful select');

      // aql change: running at once, before maybeAutoRun fires, until the new select returns.
      g = gate();
      agent.gate = g;
      prompt.aql = 'id:1';
      x.test(prompt.running, 'running immediately after an aql change');
      await wait(600);       // maybeAutoRun 250 + view onUpdate 150, select still open
      x.test(prompt.running, 'still running while the filtered select is open');
      g.open();
      await wait(50);
      x.test(! prompt.running, 'not running once the filtered select returned');

      // erroring select
      g = gate();
      agent.gate = g;
      agent.fail = true;
      g.open();
      prompt.run();
      x.test(prompt.running, 'running immediately after run()');
      await wait(400);
      x.test(! prompt.running, 'not running after an erroring select');
      x.test(prompt.hasError, 'hasError set after an erroring select');

      // next success clears hasError
      agent.fail = false;
      prompt.run();
      await wait(400);
      x.test(! prompt.running, 'not running after the recovering select');
      x.test(! prompt.hasError, 'hasError cleared by the next successful select');

      view.remove();
    }
  ]
});
