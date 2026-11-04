/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Cells',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.cells.Cells' ],

  properties: [
    [ 'description', 'Cells spreadsheet grid' ]
  ],

  methods: [
    function execute(rows, cols) {
      this.out.tag(this.Cells, rows && cols && { rows: rows, columns: cols});
    }
  ]
});
