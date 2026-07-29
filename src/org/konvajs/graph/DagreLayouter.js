/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph',
  name: 'DagreLayouter',
  extends: 'org.konvajs.graph.Layouter',

  documentation: `Layered left-to-right layout via dagre (CDN-loaded).
    Pinned nodes are excluded from the layout entirely - dagre has no
    fixed-node support - so they keep their position and their edges fall
    back to straight lines. If dagre fails to load (JsLib resolves even on
    error), returns an empty result and warns once: the graph renders
    unlayouted and the app stays alive.`,

  requires: [ 'org.konvajs.graph.DagreLib' ],

  properties: [
    { class: 'String', name: 'rankDir', value: 'LR' },
    { class: 'Int',    name: 'rankSep', value: 90 },
    { class: 'Int',    name: 'nodeSep', value: 15 },
    { class: 'Boolean', name: 'warned_' }
  ],

  methods: [
    async function layout(nodes, edges) {
      await this.DagreLib.create().load();

      if ( ! globalThis.dagre ) {
        if ( ! this.warned_ ) {
          console.warn('DagreLayouter: dagre failed to load; rendering unlayouted.');
          this.warned_ = true;
        }
        return { nodes: {}, edges: {} };
      }

      var g = new dagre.graphlib.Graph({ multigraph: true });
      g.setGraph({
        rankdir: this.rankDir,
        ranksep: this.rankSep,
        nodesep: this.nodeSep
      });
      g.setDefaultEdgeLabel(function() { return {}; });

      var inGraph = {};
      nodes.forEach(n => {
        if ( n.pinned ) return;
        inGraph[n.id] = true;
        g.setNode(n.id, { width: n.width, height: n.height });
      });

      edges.forEach(e => {
        if ( inGraph[e.sourceId] && inGraph[e.targetId] ) {
          g.setEdge(e.sourceId, e.targetId, {}, e.id);
        }
      });

      dagre.layout(g);

      var result = { nodes: {}, edges: {} };

      g.nodes().forEach(id => {
        var n = g.node(id);
        // dagre positions are centers; GraphNode x/y is top-left.
        result.nodes[id] = { x: n.x - n.width / 2, y: n.y - n.height / 2 };
      });

      g.edges().forEach(ref => {
        var e = g.edge(ref);
        if ( ! e.points ) return;
        var flat = [];
        e.points.forEach(p => { flat.push(p.x, p.y); });
        result.edges[ref.name] = { points: flat };
      });

      return result;
    }
  ]
});
