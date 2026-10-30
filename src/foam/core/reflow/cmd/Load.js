/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Load',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'flow', 'flowDAO?', 'mementoMgr', 'selected' ],

  properties: [
    [ 'description', 'Load a specified flow' ],
    [ 'parserClass', 'foam.core.reflow.parser.FlowNameParser' ]
  ],

  methods: [
    async function execute(flowName) {
      if ( ! flowName || ! this.flowDAO ) return;
      var loaded = await this.flowDAO.find(flowName);

      if ( loaded ) {
        // Don't save the 'load' command
        this.block.del();
        this.maybeCallScript(loaded.preLoadScript);
        this.flow.loadComplete.sub(() => this.maybeCallScript(loaded.postLoadScript));
        this.selected = this.flow;
        // When the saved script is identical to the current one, copyFrom's set
        // is suppressed by the propertyChange equality gate, so the Console's
        // onScriptChange reload never runs and loadComplete never fires. Force
        // the pub so load/loadPerf on an unchanged flow still re-executes.
        var sameScript = this.flow.script === loaded.script;
        this.flow.copyFrom(loaded);
        if ( sameScript ) this.flow.pub('propertyChange', 'script', this.flow.script$);
        // After loading, revert the revision back to 0
        this.flow.loadComplete.sub(foam.events.oneTime(() => {
          this.mementoMgr.clear();
        }));
      }
    },
    async function maybeCallScript(s) {
      if ( s ) {
        await eval('(async function() {' + s + '})').call(this)
      }
    }
  ]
});
