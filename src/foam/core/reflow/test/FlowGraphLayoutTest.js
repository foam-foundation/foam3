/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'FlowGraphLayoutTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.graph.Graph',
    'foam.graph.GraphNode',
    'foam.graph.map2d.LayeredGridPlacementStrategy'
  ],

  methods: [
    function graphOf(ids, edges) {
      var data = {};
      for ( var i = 0 ; i < ids.length ; i++ ) {
        data[ids[i]] = this.GraphNode.create({ data: { id: ids[i] } });
      }
      for ( var j = 0 ; j < (edges || []).length ; j++ ) {
        var e = edges[j];
        var from = e[0];
        var to = e[1];
        var kind = e[2];
        var fwd = kind ? { id: to, kind: kind } : { id: to };
        var inv = kind ? { id: from, kind: kind } : { id: from };
        data[from].forwardLinks = data[from].forwardLinks.concat([fwd]);
        data[to].inverseLinks = data[to].inverseLinks.concat([inv]);
      }
      return this.Graph.create({ data: data });
    },

    function place(plan, id) {
      return plan.getPlacement(id);
    },

    async function runTest(x) {
      // 1. Longest path wins over shortest path.
      var g1 = this.graphOf(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['A', 'C']]);
      var plan1 = this.LayeredGridPlacementStrategy.create({ graph: g1 }).getPlan();
      x.test(this.place(plan1, 'A')[0] === 0, '1: A is layer 0');
      x.test(this.place(plan1, 'B')[0] === 1, '1: B is layer 1');
      x.test(this.place(plan1, 'C')[0] === 2, '1: C is layer 2 (longest path A->B->C, not shortest A->C)');

      // 2a. Multi-root: both roots land on layer 0, ordered by document order.
      var g2 = this.graphOf(['A', 'B', 'C'], [['A', 'C'], ['B', 'C']]);
      var plan2 = this.LayeredGridPlacementStrategy.create({ graph: g2 }).getPlan();
      x.test(this.place(plan2, 'A')[0] === 0 && this.place(plan2, 'B')[0] === 0, '2a: both roots are layer 0');
      x.test(this.place(plan2, 'A')[1] === 0, '2a: A is index 0');
      x.test(this.place(plan2, 'B')[1] === 1, '2a: B is index 1 (document order)');

      // 2b. Nodes with no link at all are detached from the grid, in document
      // order, so they can be shown in their own section.
      var g2b = this.graphOf(['U1', 'A', 'U2', 'B'], [['A', 'B']]);
      var plan2b = this.LayeredGridPlacementStrategy.create({ graph: g2b }).getPlan();
      x.test(this.place(plan2b, 'U1') === null && this.place(plan2b, 'U2') === null, '2b: unlinked nodes have no grid cell');
      x.test(plan2b.detached.U1 === 0 && plan2b.detached.U2 === 1, '2b: unlinked nodes are ordered by document order');
      x.test(plan2b.detached.A === undefined && this.place(plan2b, 'B')[0] === 1, '2b: linked nodes are still layered');
      x.test(plan2b.shape[0] === 2 && plan2b.shape[1] === 1, '2b: the grid shape counts linked nodes only');
      var g2c = this.graphOf(['A', 'B'], []);
      var plan2c = this.LayeredGridPlacementStrategy.create({ graph: g2c }).getPlan();
      x.test(plan2c.detached.A === 0 && plan2c.detached.B === 1, '2c: a graph with no links is entirely detached');

      // 3a. A soft link places its target one layer below, when there is no hard predecessor.
      var g3a = this.graphOf(['A', 'S'], [['A', 'S', 'reaction']]);
      var plan3a = this.LayeredGridPlacementStrategy.create({
        graph: g3a,
        softKinds: ['reaction']
      }).getPlan();
      x.test(this.place(plan3a, 'S')[0] === 1, '3a: S is layer 1 via the soft link');

      // 3b. A hard predecessor always wins over a soft one.
      var g3b = this.graphOf(
        ['A', 'B', 'C', 'S'],
        [['A', 'B'], ['B', 'C'], ['C', 'S', 'reaction'], ['A', 'S']]
      );
      var plan3b = this.LayeredGridPlacementStrategy.create({
        graph: g3b,
        softKinds: ['reaction']
      }).getPlan();
      x.test(this.place(plan3b, 'S')[0] === 1, '3b: S is layer 1 (hard A->S wins; soft C->S ignored)');

      // 4a. Barycenter ordering follows the predecessor's row.
      var g4a = this.graphOf(['A', 'B', 'Y', 'X'], [['A', 'Y'], ['B', 'X']]);
      var plan4a = this.LayeredGridPlacementStrategy.create({ graph: g4a }).getPlan();
      x.test(this.place(plan4a, 'Y')[1] === 0, '4a: Y is index 0 in layer 1 (follows A)');
      x.test(this.place(plan4a, 'X')[1] === 1, '4a: X is index 1 in layer 1 (follows B)');

      // 4b. Ties in the barycenter key fall back to document order.
      var g4b = this.graphOf(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]);
      var plan4b = this.LayeredGridPlacementStrategy.create({ graph: g4b }).getPlan();
      x.test(this.place(plan4b, 'B')[1] === 0, '4b: B is index 0 (tie-break by document order)');
      x.test(this.place(plan4b, 'C')[1] === 1, '4b: C is index 1 (tie-break by document order)');

      // 5a. A cycle is tolerated: the DFS back-edge is dropped for layering only.
      var g5a = this.graphOf(['A', 'B'], [['A', 'B'], ['B', 'A']]);
      var plan5a = this.LayeredGridPlacementStrategy.create({ graph: g5a }).getPlan();
      x.test(
        !! this.place(plan5a, 'A') && !! this.place(plan5a, 'B'),
        '5a: both nodes are placed despite the cycle'
      );
      var layers5a = [this.place(plan5a, 'A')[0], this.place(plan5a, 'B')[0]].sort();
      x.test(layers5a[0] === 0 && layers5a[1] === 1, '5a: layers are 0 and 1');
      x.test(this.place(plan5a, 'A')[0] === 0, '5a: A is first by document order (B->A back-edge dropped)');

      // 5b. A self-loop is not a link: the node is detached like any unlinked node.
      var g5b = this.graphOf(['A'], [['A', 'A']]);
      var plan5b = this.LayeredGridPlacementStrategy.create({ graph: g5b }).getPlan();
      x.test(this.place(plan5b, 'A') === null && plan5b.detached.A === 0, '5b: self-loop node is detached');

      // 6. Compound nodes: edges into/out of a container's children are lifted
      // to the container in the parent scope, and a container is one cell
      // there while its own children get their own relative sub-grid.
      var g6 = this.graphOf(['D', 'L', 'c1', 'c2'], [['c1', 'c2'], ['D', 'c1']]);
      var strat6 = this.LayeredGridPlacementStrategy.create({
        graph: g6,
        parentOf: { c1: 'L', c2: 'L' }
      });
      var plan6 = strat6.getPlan();
      x.test(plan6.shapes.L[0] === 2 && plan6.shapes.L[1] === 1, '6: plan.shapes.L is [2, 1]');
      x.test(
        this.place(plan6, 'L')[0] === this.place(plan6, 'D')[0] + 1,
        '6: L is one layer after D (D->c1 lifted to D->L)'
      );
      x.test(
        this.place(plan6, 'c1')[0] === 0 && this.place(plan6, 'c1')[1] === 0,
        `6: c1 is at [0, 0] relative to L`
      );
      x.test(
        this.place(plan6, 'c2')[0] === 1 && this.place(plan6, 'c2')[1] === 0,
        `6: c2 is at [1, 0] relative to L`
      );
      x.test(plan6.shape[0] === 2 && plan6.shape[1] === 1, '6: root plan.shape is [2, 1] (D and L only)');

      // 7. Bounds: every coordinate stays within its own scope's shape.
      var boundsOk = true;
      [ 'D', 'L' ].forEach(id => {
        var c = this.place(plan6, id);
        if ( ! (c[0] < plan6.shape[0] && c[1] < plan6.shape[1]) ) boundsOk = false;
      });
      [ 'c1', 'c2' ].forEach(id => {
        var c = this.place(plan6, id);
        if ( ! (c[0] < plan6.shapes.L[0] && c[1] < plan6.shapes.L[1]) ) boundsOk = false;
      });
      x.test(boundsOk, `7: every member's coords are within its scope's shape`);

      // 8. Smoke: a 200-node chain plus 50 skip-edges lays out without error.
      var ids8 = [];
      for ( var i = 0 ; i < 200 ; i++ ) ids8.push('n' + i);
      var edges8 = [];
      for ( var i2 = 0 ; i2 < 199 ; i2++ ) edges8.push([ 'n' + i2, 'n' + (i2 + 1) ]);
      for ( var i3 = 0 ; i3 < 50 ; i3++ ) {
        if ( i3 + 7 < 200 ) edges8.push([ 'n' + i3, 'n' + (i3 + 7) ]);
      }
      var g8 = this.graphOf(ids8, edges8);
      var plan8 = this.LayeredGridPlacementStrategy.create({ graph: g8 }).getPlan();
      var allPlaced = true;
      var maxLayer8 = -1;
      for ( var i4 = 0 ; i4 < 200 ; i4++ ) {
        var p = this.place(plan8, 'n' + i4);
        if ( ! p ) allPlaced = false;
        else maxLayer8 = Math.max(maxLayer8, p[0]);
      }
      x.test(allPlaced, '8: smoke - every one of the 200 nodes has a placement');
      x.test(maxLayer8 === 199, '8: smoke - max layer is 199 (chain longest path)');
    }
  ]
});
