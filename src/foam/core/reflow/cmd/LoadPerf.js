/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'LoadPerf',
  extends: 'foam.core.reflow.cmd.Load',

  documentation: `Load a flow while capturing performance (elapsed, FPS, heap delta,
    long tasks). 'load' clears and rebuilds the entire flow, so a perf block placed
    before a load cannot survive it; this command runs the capture outside the block
    tree and appends a perf block with the results after loadComplete.`,

  requires: [ 'foam.core.reflow.perf.Perf' ],

  imports: [ 'perfCapture_' ],

  properties: [
    [ 'description', 'Load perf a flow with performance capture' ]
  ],

  methods: [
    async function execute(flowName) {
      if ( ! flowName ) return;
      var self = this;
      // SUPER is bound for the synchronous frame only (Method.js restores it in a
      // finally), so hold it before the find below yields.
      var SUPER = this.SUPER;
      // An unresolvable name loads nothing (Load.execute returns silently), and no load
      // means no loadComplete - so capturing here would wrap fetch and console.warn for
      // the rest of the session. Checked before startCapture_ so it isn't measured.
      if ( ! await this.flowDAO.find(flowName) ) return;

      var runner    = this.Perf.create({}, this);
      var finishing = false;

      runner.startCapture_();
      // Per-block costs are recorded by the Console's load loop, which has no handle
      // on this capture - hand it the buffer for the duration of the load. The Console
      // clears it when the load ends (onScriptChange).
      this.perfCapture_ = runner.capture_;
      // That clear is the one signal a load emits whether it passed or threw: a load
      // that throws never pubs loadComplete, leaving the wrappers below installed.
      // Subscribed after the set above so it can't fire on our own write.
      this.perfCapture_$.sub(foam.events.oneTime(function() {
        if ( ! finishing ) runner.stopCapture_();
      }));
      this.flow.loadComplete.sub(foam.events.oneTime(async function() {
        finishing = true;   // set before the first await: the clear lands in between
        var report = await runner.finishCapture_();
        report.label = 'loadPerf: ' + flowName;
        // Append a perf block to the loaded flow and inject the measured report.
        // copyFrom (not assignment) so the new view's report slot fires.
        var blk = await self.eval_('perf', true, true);
        blk.value.copyFrom(report);
      }));

      await SUPER.call(this, flowName);
    }
  ]
});
