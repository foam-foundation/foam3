/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dock.test',
  name: 'TestDockItem',

  implements: [ 'foam.u2.dock.DockItem' ],

  documentation: 'A DockItem for DockTest that counts how often it was opened.',

  properties: [
    { class: 'Int', name: 'opened' }
  ],

  methods: [
    function open() { this.opened++; }
  ]
});
