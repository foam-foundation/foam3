/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.svg.map2d',
  name: 'CompoundGridPlacementPlan',
  extends: 'foam.u2.svg.map2d.PredeterminedGridPlacementPlan',

  documentation: `
    A PredeterminedGridPlacementPlan where some nodes are nested inside
    container nodes. A node listed in parentOf is placed in its
    container's own sub-grid (coordinates relative to that container)
    instead of the plan's root grid, and shapes tracks the size of each
    container's sub-grid. A node not listed in parentOf behaves exactly
    as in the base class, so a plan with an empty parentOf is identical
    to a PredeterminedGridPlacementPlan.
  `,

  properties: [
    {
      name: 'parentOf',
      class: 'Map',
      documentation: 'Node id -> id of the container node it sits in. Absent means root scope.'
    },
    {
      name: 'shapes',
      class: 'Map',
      documentation: `Container id -> [layers, rows] of that container's own sub-grid.`
    },
    {
      name: 'detached',
      class: 'Map',
      documentation: `Node id -> order index for nodes that have no links inside
        their scope. They get no grid cell (getPlacement() returns null) so the
        view can show them apart from the connected graph, in this order.`
    }
  ],

  methods: [
    function addAssociation_(id, coords, cellSize = [1, 1]) {
      var p = this.parentOf[id];
      if ( ! p ) return this.SUPER(id, coords, cellSize);

      this.coords[id] = coords;

      if ( ! this.shapes[p] ) this.shapes[p] = [0, 0];
      for ( var i = 0 ; i < coords.length ; i++ ) {
        this.shapes[p][i] = Math.max(coords[i] + cellSize[i], this.shapes[p][i]);
      }
    }
  ]
});
