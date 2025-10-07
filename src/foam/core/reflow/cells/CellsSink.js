/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cells',
  name: 'CellsSink',
  extends: 'foam.dao.ArraySink',

  requires: [ 'foam.core.reflow.cells.Cells' ],

  methods: [
    function addToE(e) {
      if ( ! this.array.length ) return;
      var ps  = this.of.getAxiomsByClass(foam.lang.Property).
        filter(p => ! p.networkTransient && ! p.hidden);
      var cs  = {};
      var row = 1;

      for ( var i = 0 ; i < ps.length ; i++ ) {
        cs[String.fromCharCode(65+i) + 0] = '<b>' + ps[i].label + '</b';
      }

      for ( var row = 0 ; row < this.array.length ; row++ ) {
        var o = this.array[row];

        for ( var i = 0 ; i < ps.length ; i++ ) {
          cs[String.fromCharCode(65+i) + (row+1)] = ps[i].get(o);
        }
      }

      var cells = this.Cells.create({rows: row+2, columns: ps.length+2}, this);
      cells.loadCells(cs);
      e.tag(cells);
    }
  ]
});
