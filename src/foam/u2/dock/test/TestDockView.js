/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dock.test',
  name: 'TestDockView',
  extends: 'foam.u2.View',

  implements: [ 'foam.u2.dock.DockItem' ],

  documentation: 'A DockItem that is a view, for DockTest: docking it should add it to the app shell.',

  methods: [
    function open() {}
  ]
});
