/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Models',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [
    'foam.core.reflow.cells.Cells'
  ],

  imports: [ ],

  properties: [
    [ 'description', 'Models explorer' ]
  ],

  methods: [
    function execute() {
      this.out.tag(foam.doc.DocBrowser);
    }
  ]
});
