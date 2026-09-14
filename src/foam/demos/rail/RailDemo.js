/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.rail',
  name: 'RailDemo',
  extends: 'foam.u2.View',

  documentation: 'Mounts the railroad viewer with typed grammar text enabled (dev only) and the toy preset loaded.',

  requires: [ 'foam.parse.rail.RailDiagramView' ],

  methods: [
    function render() {
      var view = this.RailDiagramView.create({ allowTypedGrammar: true });
      window.__rail = view;     // demo-only handle for scripted checks from the console
      this.add(view);
      view.usePreset('comma list (toy)');
    }
  ]
});
