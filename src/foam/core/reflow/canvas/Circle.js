/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.canvas',
  name: 'Circle',
  extends: 'foam.graphics.Circle',
  implements: [ 'foam.core.reflow.Flowable' ],
  // implements: [ 'foam.physics.Physical' ],

  requires: [
    'foam.core.reflow.canvas.Circle'
  ],

  imports: [ 'createFlowChildName' ],

  properties: [
    [ 'arcWidth', 1 ],
    [ 'gravity',  1 ],
    [ 'radius',   25 ],
    [ 'friction', 0.98 ]
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
        let c = this.Circle.create({flowName: name, x:10, y:10});
//        this.add(c);
        this.block.addFlowChild(c);
      }
    }
  ]
});
