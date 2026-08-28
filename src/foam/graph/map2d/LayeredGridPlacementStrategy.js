/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graph.map2d',
  name: 'LayeredGridPlacementStrategy',
  documentation: `
    A GridPlacementStrategy that lays out a left-to-right node graph into
    layers (columns) and rows, for graphs where nodes may be nested inside
    container (compound) nodes. This strategy only decides topology - which
    layer and which row each node gets, per scope - pixel sizing is the
    view's job.

    Layout runs once per scope (the root, plus once per container), using:
      1. Edges are lifted to the scope: an edge between two descendants of
         the same scope is rewritten as an edge between their ancestors
         that are direct members of that scope.
      2. Any remaining cycle (after lifting) is broken by dropping DFS
         back-edges, so the layering step always sees a DAG. The dropped
         edges are only ignored for layout purposes; they stay in the graph.
      3. Members with no link at all in the scope are marked detached on the
         plan (document order) instead of getting a grid cell, so the view can
         place them in their own section below the connected graph.
      4. Layers are assigned by longest path over the surviving hard edges.
      5. Nodes with no hard predecessor but a soft predecessor (a link
         whose kind is in softKinds) are pulled at least one layer below
         it, so soft links can suggest order without creating structure.
      6. Within each layer, two barycenter sweeps (forward, then backward)
         reduce edge crossings between adjacent layers.

    A container node is placed as a single cell in its own scope; its
    children are placed in their own sub-grid, relative to it.
  `,

  requires: [
    'foam.u2.svg.map2d.CompoundGridPlacementPlan'
  ],

  properties: [
    {
      name: 'graph',
      class: 'FObjectProperty',
      of: 'foam.graph.Graph'
    },
    {
      name: 'parentOf',
      class: 'Map',
      documentation: 'Node id -> container node id, for compound nesting. Default {} means a flat graph.'
    },
    {
      name: 'softKinds',
      class: 'StringArray',
      documentation: `
        link.kind values that only influence ordering, never layering.
        Default [] means every link is treated as hard.
      `
    }
  ],

  methods: [
    function getPlan() {
      var plan = this.CompoundGridPlacementPlan.create({
        parentOf: this.parentOf,
        shape: [0, 0]
      });

      var childrenByParent = this.buildChildrenByParent_();
      this.layoutScope_(null, plan, childrenByParent);
      return plan;
    },

    function buildChildrenByParent_() {
      var map = new Map();
      var ids = Object.keys(this.graph.data);
      for ( var i = 0 ; i < ids.length ; i++ ) {
        var id = ids[i];
        var p = this.parentOf[id] || null;
        if ( ! map.has(p) ) map.set(p, []);
        map.get(p).push(id);
      }
      return map;
    },

    function liftTo_(id, scopeId) {
      var cur = id;
      while ( (this.parentOf[cur] || null) !== scopeId ) {
        var p = this.parentOf[cur] || null;
        if ( p === null ) return null;
        cur = p;
      }
      return cur;
    },

    function layoutScope_(scopeId, plan, childrenByParent) {
      var members = childrenByParent.get(scopeId) || [];
      if ( members.length === 0 ) return;

      for ( var i = 0 ; i < members.length ; i++ ) {
        var id = members[i];
        if ( childrenByParent.has(id) ) this.layoutScope_(id, plan, childrenByParent);
      }

      var edges = this.liftEdges_(scopeId);

      // Members with no link in this scope go to their own section: recorded
      // as detached in document order rather than layered with the graph.
      var connected = new Set();
      edges.hard.concat(edges.soft).forEach(function(e) { connected.add(e[0]); connected.add(e[1]); });
      var detachedCount = 0;
      members = members.filter(function(id) {
        if ( connected.has(id) ) return true;
        plan.detached[id] = detachedCount++;
        return false;
      });
      if ( members.length === 0 ) return;

      var hardEdges = this.dropBackEdges_(members, edges.hard);
      var layering = this.computeLayers_(members, hardEdges);
      this.applySoftConstraint_(members, layering.layer, layering.hardPredecessors, edges.soft);

      var allNeighbors = this.buildUndirectedAdjacency_(hardEdges.concat(edges.soft));
      var maxLayer = 0;
      for ( var j = 0 ; j < members.length ; j++ ) {
        maxLayer = Math.max(maxLayer, layering.layer.get(members[j]));
      }
      var layerLists = this.orderLayers_(members, layering.layer, allNeighbors, maxLayer);

      for ( var L = 0 ; L < layerLists.length ; L++ ) {
        var list = layerLists[L];
        for ( var idx = 0 ; idx < list.length ; idx++ ) {
          plan.addAssociation_(list[idx], [L, idx]);
        }
      }
    },

    function liftEdges_(scopeId) {
      var hard = [];
      var soft = [];
      var hardSeen = new Set();
      var softSeen = new Set();
      var ids = Object.keys(this.graph.data);

      for ( var i = 0 ; i < ids.length ; i++ ) {
        var u = ids[i];
        var links = this.graph.data[u].forwardLinks || [];
        for ( var j = 0 ; j < links.length ; j++ ) {
          var link = links[j];
          var a = this.liftTo_(u, scopeId);
          var b = this.liftTo_(link.id, scopeId);
          if ( a === null || b === null || a === b ) continue;

          var isSoft = this.softKinds.includes(link.kind);
          var key = a + '\u0001' + b;
          if ( isSoft ) {
            if ( ! softSeen.has(key) ) { softSeen.add(key); soft.push([a, b]); }
          } else {
            if ( ! hardSeen.has(key) ) { hardSeen.add(key); hard.push([a, b]); }
          }
        }
      }

      return { hard: hard, soft: soft };
    },

    function dropBackEdges_(members, hardEdges) {
      var adj = new Map();
      for ( var i = 0 ; i < members.length ; i++ ) adj.set(members[i], []);
      for ( var i2 = 0 ; i2 < hardEdges.length ; i2++ ) {
        adj.get(hardEdges[i2][0]).push(hardEdges[i2][1]);
      }

      var state = new Map();
      var toDrop = new Set();

      for ( var s = 0 ; s < members.length ; s++ ) {
        var start = members[s];
        if ( state.has(start) ) continue;

        var stack = [{ id: start, i: 0 }];
        state.set(start, 'visiting');
        while ( stack.length ) {
          var frame = stack[stack.length - 1];
          var neighbors = adj.get(frame.id);
          if ( frame.i < neighbors.length ) {
            var next = neighbors[frame.i];
            frame.i++;
            if ( state.get(next) === 'visiting' ) {
              toDrop.add(frame.id + '\u0001' + next);
            } else if ( ! state.has(next) ) {
              state.set(next, 'visiting');
              stack.push({ id: next, i: 0 });
            }
          } else {
            state.set(frame.id, 'done');
            stack.pop();
          }
        }
      }

      return hardEdges.filter(function(e) {
        return ! toDrop.has(e[0] + '\u0001' + e[1]);
      });
    },

    function computeLayers_(members, hardEdges) {
      var indeg = new Map();
      var predecessors = new Map();
      var succ = new Map();
      for ( var i = 0 ; i < members.length ; i++ ) {
        indeg.set(members[i], 0);
        predecessors.set(members[i], []);
        succ.set(members[i], []);
      }
      for ( var j = 0 ; j < hardEdges.length ; j++ ) {
        var u = hardEdges[j][0];
        var v = hardEdges[j][1];
        succ.get(u).push(v);
        predecessors.get(v).push(u);
        indeg.set(v, indeg.get(v) + 1);
      }

      var layer = new Map();
      var queue = [];
      for ( var k = 0 ; k < members.length ; k++ ) {
        if ( indeg.get(members[k]) === 0 ) queue.push(members[k]);
      }

      var qi = 0;
      while ( qi < queue.length ) {
        var id = queue[qi++];
        var preds = predecessors.get(id);
        var l = 0;
        for ( var p = 0 ; p < preds.length ; p++ ) {
          l = Math.max(l, layer.get(preds[p]) + 1);
        }
        layer.set(id, l);

        var succs = succ.get(id);
        for ( var sIdx = 0 ; sIdx < succs.length ; sIdx++ ) {
          var v2 = succs[sIdx];
          indeg.set(v2, indeg.get(v2) - 1);
          if ( indeg.get(v2) === 0 ) queue.push(v2);
        }
      }

      return { layer: layer, hardPredecessors: predecessors };
    },

    function applySoftConstraint_(members, layer, hardPredecessors, softEdges) {
      var softPredecessors = new Map();
      for ( var i = 0 ; i < softEdges.length ; i++ ) {
        var u = softEdges[i][0];
        var v = softEdges[i][1];
        if ( ! softPredecessors.has(v) ) softPredecessors.set(v, []);
        softPredecessors.get(v).push(u);
      }

      // Reads pre-adjustment (hard) layers, so this stays a single pass with
      // no propagation between nodes that both need the soft fallback.
      var baseLayer = new Map(layer);
      for ( var j = 0 ; j < members.length ; j++ ) {
        var id = members[j];
        var sPreds = softPredecessors.get(id);
        if ( hardPredecessors.get(id).length === 0 && sPreds && sPreds.length ) {
          var l = 0;
          for ( var k = 0 ; k < sPreds.length ; k++ ) {
            l = Math.max(l, baseLayer.get(sPreds[k]) + 1);
          }
          layer.set(id, l);
        }
      }
    },

    function buildUndirectedAdjacency_(edges) {
      var adj = new Map();
      for ( var i = 0 ; i < edges.length ; i++ ) {
        var a = edges[i][0];
        var b = edges[i][1];
        if ( ! adj.has(a) ) adj.set(a, []);
        if ( ! adj.has(b) ) adj.set(b, []);
        adj.get(a).push(b);
        adj.get(b).push(a);
      }
      return adj;
    },

    function orderLayers_(members, layer, allNeighbors, maxLayer) {
      var docIndex = new Map();
      for ( var i = 0 ; i < members.length ; i++ ) docIndex.set(members[i], i);

      var layerLists = [];
      for ( var L = 0 ; L <= maxLayer ; L++ ) layerLists.push([]);
      for ( var j = 0 ; j < members.length ; j++ ) {
        layerLists[layer.get(members[j])].push(members[j]);
      }

      function indexOf(list) {
        var idx = new Map();
        for ( var i2 = 0 ; i2 < list.length ; i2++ ) idx.set(list[i2], i2);
        return idx;
      }

      function sortByKey(list, keyFn) {
        var curIdx = indexOf(list);
        var keyed = list.map(function(id) {
          return { id: id, key: keyFn(id, curIdx) };
        });
        keyed.sort(function(x, y) {
          return (x.key - y.key) || (docIndex.get(x.id) - docIndex.get(y.id));
        });
        return keyed.map(function(k) { return k.id; });
      }

      for ( var Lf = 1 ; Lf <= maxLayer ; Lf++ ) {
        var prevIdx = indexOf(layerLists[Lf - 1]);
        layerLists[Lf] = sortByKey(layerLists[Lf], function(id, curIdx) {
          var neigh = (allNeighbors.get(id) || []).filter(function(n) {
            return layer.get(n) === Lf - 1;
          });
          if ( ! neigh.length ) return curIdx.get(id);
          var sum = 0;
          for ( var n = 0 ; n < neigh.length ; n++ ) sum += prevIdx.get(neigh[n]);
          return sum / neigh.length;
        });
      }

      for ( var Lb = maxLayer - 1 ; Lb >= 0 ; Lb-- ) {
        var nextIdx = indexOf(layerLists[Lb + 1]);
        layerLists[Lb] = sortByKey(layerLists[Lb], function(id, curIdx) {
          var neigh = (allNeighbors.get(id) || []).filter(function(n) {
            return layer.get(n) === Lb + 1;
          });
          if ( ! neigh.length ) return curIdx.get(id);
          var sum = 0;
          for ( var n = 0 ; n < neigh.length ; n++ ) sum += nextIdx.get(neigh[n]);
          return sum / neigh.length;
        });
      }

      return layerLists;
    }
  ]
});
