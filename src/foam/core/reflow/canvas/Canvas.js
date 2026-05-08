/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.canvas',
  name: 'Canvas',
  extends: 'foam.graphics.Box',
  implements: [ 'foam.core.reflow.Flowable' ],

  requires: [
    'foam.core.reflow.Block',
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
    function addFlowChild_(c) {
      this.add(c);
    },

    function removeFlowChild_(c) {
    }
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
