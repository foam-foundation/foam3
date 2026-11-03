/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.canvas',
  name: 'CanvasBlock',
  extends: 'foam.core.reflow.Block',

  properties: [
    {
      name: 'canvas'
    }
  ],

  methods: [
    function addFlowChild_(c) {
      debugger;
      this.addToScope(c);
    },

    function removeFlowChild_(c) {
      debugger;
      c.remove();
    },
  ]
});

// TODO: eval_ should accept an optional block type
foam.CLASS({
  package: 'foam.core.reflow.canvas',
  name: 'Canvas',
  extends: 'foam.graphics.Box',
  implements: [ 'foam.core.reflow.Flowable' ],

  requires: [
    'foam.core.reflow.canvas.CanvasBlock as Block',
    'foam.core.reflow.canvas.Circle'
  ],

  imports: [ 'block', 'createFlowChildName' ],

  properties: [
    [ 'autoRepaint', true ],
    [ 'width', 600 ],
    [ 'height', 400 ],
    [ 'color', '#f3f3f3' ]
  ],

  methods: [
  ],

  actions: [
    {
      name: 'circle',
      code: function() {
        let name = this.createFlowChildName('circle');
        let c = this.Circle.create({x:100, y:100});
        this.add(c);
        this.block.addFlowChild(this.Block.create({flowName: name, value: c}));
      }
    }
  ]
});


/*
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
*/
