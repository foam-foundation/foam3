/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Layout',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'block', 'currentBlock' ],

  methods: [
    function execute(...args) {
      // Take over old block and replace it
      let b = foam.core.reflow.LayoutBlock.create({
        cmd: this.block.cmd,
        flowParent: this.block.flowParent,
        flowName: this.block.flowName
      }, this.block.flowParent);
      this.block.flowParent.addFlowChild(b);
      this.block.del();
      this.currentBlock = b;
//      console.log(this.block, this.currentBlock, b);
    }
  ]
});
