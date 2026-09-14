/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.rail',
  name: 'RailDemo',
  extends: 'foam.u2.View',

  documentation: 'Mounts the railroad viewer with typed grammar text enabled (dev only), the window.__rail debug hook, and the toy preset loaded.',

  requires: [ 'foam.parse.rail.RailDiagramView' ],

  methods: [
    function render() {
      var view = this.RailDiagramView.create({ allowTypedGrammar: true, debugHook: true });
      this.add(view);
      view.usePreset('comma list (toy)');
    }
  ]
});
