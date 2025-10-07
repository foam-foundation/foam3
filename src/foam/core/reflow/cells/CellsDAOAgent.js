/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cells',
  name: 'CellsDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  requires: [ 'foam.core.reflow.cells.CellsSink' ],

  methods: [
    function getSink() { return this.CellsSink.create({of: this.of}); }
  ]
});
