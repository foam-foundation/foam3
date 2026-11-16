/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Include',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'includeFlow' ],

  properties: [
    [ 'description', 'Include the blocks of a specified flow as children of this block' ],
    [ 'parserClass', 'foam.core.reflow.parser.FlowNameParser' ]
  ],

  methods: [
    async function execute(flowName) {
      // The included flow's blocks become children of this 'include' block.
      // They are not saved with this flow, so every load includes the library
      // flow as it is now, and new children don't belong in it.
      await this.includeFlow(flowName, this.block);
      this.block.childTransient = true;
    }
  ]
});
