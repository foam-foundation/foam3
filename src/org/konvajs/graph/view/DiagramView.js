/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph.view',
  name: 'DiagramView',
  extends: 'foam.u2.View',

  documentation: `Coordinator for a node-link diagram: projects nodeDAO and
    edgeDAO onto a Konva stage via GraphNodeView / GraphEdgeView element
    views, runs debounced layout passes, and owns selection.

    Layout policy: DAO additions/removals schedule a debounced (150ms)
    layout pass; updates and drags never do ("align nodes" = runLayout()
    is the explicit re-layout trigger). Layout results are applied to the
    views first (tweened), then written back to the models under a
    per-pass token guard so the resulting puts don't re-reconcile or
    re-schedule. A real put landing mid-pass carries no token entry and
    reconciles normally.

    Node removal removes incident edge VIEWS only - cascading the edge
    DAO records is application policy, not the primitive's.`,

  requires: [
    'org.konvajs.KonvaView',
    'org.konvajs.graph.DagreLayouter',
    'org.konvajs.graph.view.GraphNodeView',
    'org.konvajs.graph.view.GraphEdgeView'
  ],

  exports: [ 'selected' ],

  css: `
    ^ { width: 100%; height: 100%; }
  `,

  properties: [
    { name: 'nodeDAO' },
    { name: 'edgeDAO' },
    {
      class: 'FObjectProperty',
      of: 'org.konvajs.graph.Layouter',
      name: 'layouter',
      factory: function() { return this.DagreLayouter.create(); }
    },
    {
      class: 'String',
      name: 'nodeViewClass',
      documentation: `Class id of the node view to instantiate per node.
        Apps override to render custom nodes (one view class per
        diagram). The class must follow the GraphNodeView subclass
        contract.`,
      value: 'org.konvajs.graph.view.GraphNodeView'
    },
    {
      class: 'Function',
      name: 'onReady',
      documentation: `Called as onReady(stage, layer) at the end of
        initDiagram - the app hook for stage-level overlays such as a
        Transformer.`,
      value: function(stage, layer) { }
    },
    {
      class: 'FObjectProperty',
      name: 'selected',
      documentation: 'Selected GraphNode or GraphEdge, or null.',
      postSet: function(old, nu) {
        if ( old ) { old.state = 'normal'; }
        if ( nu )  { nu.state  = 'highlighted'; }
      }
    },
    { class: 'Boolean', name: 'autoLayout', value: true },
    { class: 'Boolean', name: 'pannable',   value: true },
    { class: 'Boolean', name: 'zoomable',   value: true },
    { name: 'konvaView' },
    { name: 'nodeViews_',   factory: function() { return {}; } },
    { name: 'edgeViews_',   factory: function() { return {}; } },
    {
      name: 'edgesByNode_',
      documentation: 'nodeId -> { edgeId: true } incidence index.',
      factory: function() { return {}; }
    },
    { class: 'Int',     name: 'layoutToken_' },
    { name: 'layoutPuts_', factory: function() { return {}; } },
    { class: 'Simple',  name: 'layoutTimer_' },
    { class: 'Boolean', name: 'newElements_' },
    { name: 'warnedEdges_', factory: function() { return {}; } },
    { name: 'nodeTweens_', factory: function() { return {}; } }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.addClass().tag(this.KonvaView, {
        fillContainer: true,
        pannable: this.pannable,
        zoomable: this.zoomable,
        // Bound: KonvaView invokes this as its own property.
        onStageReady: this.initDiagram.bind(this)
      }, this.konvaView$);
    },

    function initDiagram(stage, layer) {
      var self = this;

      stage.on('click tap', function(e) {
        if ( e.target === stage ) self.selected = null;
      });

      this.onDetach(this.nodeDAO.on.put.sub(function(_, __, ___, obj) {
        if ( self.layoutPuts_[obj.id] === self.layoutToken_ ) {
          delete self.layoutPuts_[obj.id];
          return;
        }
        if ( self.nodeViews_[obj.id] ) {
          var nv = self.nodeViews_[obj.id];
          nv.data = obj;
          nv.updateNode();
          self.updateIncidentEdges(obj.id);
        } else {
          self.addNode(obj);
          self.newElements_ = true;
          self.scheduleLayout();
        }
        layer.batchDraw();
      }));

      this.onDetach(this.nodeDAO.on.remove.sub(function(_, __, ___, obj) {
        self.removeNode(obj.id);
        if ( self.selected && self.selected.id === obj.id ) self.selected = null;
        self.scheduleLayout();
        layer.batchDraw();
      }));

      this.onDetach(this.edgeDAO.on.put.sub(function(_, __, ___, obj) {
        if ( self.edgeViews_[obj.id] ) {
          var ev = self.edgeViews_[obj.id];
          var oldSrc = ev.data.sourceId;
          var oldTgt = ev.data.targetId;
          ev.data = obj;
          // Update incidence index if endpoints changed.
          if ( oldSrc !== obj.sourceId || oldTgt !== obj.targetId ) {
            delete (self.edgesByNode_[oldSrc] || {})[obj.id];
            delete (self.edgesByNode_[oldTgt] || {})[obj.id];
            self.edgesByNode_[obj.sourceId] = self.edgesByNode_[obj.sourceId] || {};
            self.edgesByNode_[obj.targetId] = self.edgesByNode_[obj.targetId] || {};
            self.edgesByNode_[obj.sourceId][obj.id] = true;
            self.edgesByNode_[obj.targetId][obj.id] = true;
          }
          self.refreshEdge(obj.id);
        } else {
          self.addEdge(obj);
          self.newElements_ = true;
          self.scheduleLayout();
        }
        layer.batchDraw();
      }));

      this.onDetach(this.edgeDAO.on.remove.sub(function(_, __, ___, obj) {
        self.removeEdge(obj.id);
        if ( self.selected && self.selected.id === obj.id ) self.selected = null;
        self.scheduleLayout();
        layer.batchDraw();
      }));

      Promise.all([ this.nodeDAO.select(), this.edgeDAO.select() ])
        .then(function(sinks) {
          sinks[0].array.forEach(n => self.addNode(n));
          sinks[1].array.forEach(e => self.addEdge(e));
          self.newElements_ = true;
          self.scheduleLayout();
          layer.batchDraw();
        });

      this.onDetach(function() {
        if ( self.layoutTimer_ ) clearTimeout(self.layoutTimer_);
        Object.keys(self.nodeTweens_).forEach(id => {
          if ( self.nodeTweens_[id] ) {
            self.nodeTweens_[id].destroy();
          }
        });
        self.nodeTweens_ = {};
        Object.keys(self.nodeViews_).forEach(id => self.removeNode(id));
      });

      this.onReady(stage, layer);
    },

    function addNode(obj) {
      var self = this;
      var nv = this.__subContext__.lookup(this.nodeViewClass).create({
        data: obj,
        onSelected: function(d) { self.selected = d; },
        onMoved: function(d) {
          // Persist drag position; the put listener reconciles the same
          // instance (explicit update) and never schedules a re-layout.
          self.nodeDAO.put(d);
        },
        onDragMove: function(id, x, y) {
          self.updateIncidentEdges(id, { x: x, y: y });
        }
      }, this);
      this.konvaView.layer.add(nv.createNode());
      this.nodeViews_[obj.id] = nv;
    },

    function getNodeView(id) {
      /** The live node view for a node id, or null. Apps use this to
          reach the Konva group (e.g. to attach a Transformer). **/
      return this.nodeViews_[id] || null;
    },

    function removeNode(id) {
      var nv = this.nodeViews_[id];
      if ( ! nv ) return;
      // Destroy any pending tween for this node.
      if ( this.nodeTweens_[id] ) {
        this.nodeTweens_[id].destroy();
        delete this.nodeTweens_[id];
      }
      // Incident edge views go too (their DAO records remain).
      Object.keys(this.edgesByNode_[id] || {}).forEach(eid => this.removeEdge(eid));
      nv.removeNode();
      nv.detach();
      delete this.nodeViews_[id];
    },

    function addEdge(obj) {
      var self = this;
      if ( ! this.nodeViews_[obj.sourceId] || ! this.nodeViews_[obj.targetId] ) {
        if ( ! this.warnedEdges_[obj.id] ) {
          console.warn('DiagramView: edge', obj.id, 'has a dangling endpoint; not rendered.');
          this.warnedEdges_[obj.id] = true;
        }
        return;
      }
      var ev = this.GraphEdgeView.create({
        data: obj,
        onSelected: function(d) { self.selected = d; }
      }, this);
      this.konvaView.layer.add(ev.createEdge());
      ev.group.moveToBottom();
      this.edgeViews_[obj.id] = ev;

      this.edgesByNode_[obj.sourceId] = this.edgesByNode_[obj.sourceId] || {};
      this.edgesByNode_[obj.targetId] = this.edgesByNode_[obj.targetId] || {};
      this.edgesByNode_[obj.sourceId][obj.id] = true;
      this.edgesByNode_[obj.targetId][obj.id] = true;

      this.refreshEdge(obj.id);
    },

    function removeEdge(id) {
      var ev = this.edgeViews_[id];
      if ( ! ev ) return;
      delete (this.edgesByNode_[ev.data.sourceId] || {})[id];
      delete (this.edgesByNode_[ev.data.targetId] || {})[id];
      ev.removeEdge();
      ev.detach();
      delete this.edgeViews_[id];
    },

    function nodeRect(id, opt_override) {
      var d = this.nodeViews_[id].data;
      var o = opt_override || {};
      return {
        x: o.x !== undefined ? o.x : d.x,
        y: o.y !== undefined ? o.y : d.y,
        width: d.width,
        height: d.height
      };
    },

    function refreshEdge(id, opt_dragId, opt_pos) {
      var ev = this.edgeViews_[id];
      if ( ! ev ) return;
      var src = this.nodeRect(ev.data.sourceId,
        ev.data.sourceId === opt_dragId ? opt_pos : null);
      var tgt = this.nodeRect(ev.data.targetId,
        ev.data.targetId === opt_dragId ? opt_pos : null);
      ev.updateEdge(src, tgt);
    },

    function updateIncidentEdges(nodeId, opt_pos) {
      Object.keys(this.edgesByNode_[nodeId] || {}).forEach(eid => {
        var ev = this.edgeViews_[eid];
        // A drag invalidates any layouted polyline through this node.
        if ( opt_pos && ev ) ev.data.points = null;
        this.refreshEdge(eid, opt_pos ? nodeId : undefined, opt_pos);
      });
    },

    function scheduleLayout() {
      if ( ! this.autoLayout ) return;
      var self = this;
      if ( this.layoutTimer_ ) clearTimeout(this.layoutTimer_);
      this.layoutTimer_ = setTimeout(function() { self.runLayout(); }, 150);
    },

    async function runLayout() {
      var self  = this;
      var token = ++this.layoutToken_;
      this.layoutPuts_ = {};

      var nodes = Object.values(this.nodeViews_).map(v => v.data);
      var edges = Object.values(this.edgeViews_).map(v => v.data);
      if ( ! nodes.length ) return;

      var result = await this.layouter.layout(nodes, edges);
      if ( token !== this.layoutToken_ ) return;   // superseded

      Object.keys(result.edges).forEach(eid => {
        var ev = self.edgeViews_[eid];
        if ( ev ) ev.data.points = result.edges[eid].points;
      });

      // For edges absent from result, clear layout-driven points so they fall back
      // to straight lines.
      Object.keys(self.edgeViews_).forEach(eid => {
        if ( ! result.edges[eid] ) {
          var ev = self.edgeViews_[eid];
          ev.data.points = null;
          self.refreshEdge(eid);
        }
      });

      var pending = 0;
      Object.keys(result.nodes).forEach(id => {
        var nv = self.nodeViews_[id];
        if ( ! nv ) return;
        var pos = result.nodes[id];
        pending++;
        // Destroy any existing tween for this node.
        if ( self.nodeTweens_[id] ) {
          self.nodeTweens_[id].destroy();
        }
        var tween = new Konva.Tween({
          node: nv.group,
          x: pos.x,
          y: pos.y,
          duration: 0.2,
          onUpdate: function() {
            self.updateIncidentEdges(id, { x: nv.group.x(), y: nv.group.y() });
          },
          onFinish: function() {
            if ( token !== self.layoutToken_ ) return;
            // Re-check that the node still exists (not removed mid-tween).
            if ( ! self.nodeViews_[id] || self.nodeViews_[id] !== nv ) {
              if ( --pending === 0 && self.newElements_ ) {
                self.newElements_ = false;
                self.fitView();
              }
              return;
            }
            // Write back to the model under the pass token so the put
            // listener skips reconcile and doesn't re-schedule.
            self.layoutPuts_[id] = token;
            nv.data.x = pos.x;
            nv.data.y = pos.y;
            self.nodeDAO.put(nv.data);
            self.updateIncidentEdges(id);
            if ( --pending === 0 && self.newElements_ ) {
              self.newElements_ = false;
              self.fitView();
            }
          }
        }).play();
        self.nodeTweens_[id] = tween;
      });

      if ( pending === 0 ) {
        Object.keys(self.edgeViews_).forEach(eid => self.refreshEdge(eid));
        var layer = this.konvaView.layer;
        if ( layer ) layer.batchDraw();
      }
    },

    function fitView() {
      var kv = this.konvaView;
      if ( ! kv || ! kv.stage ) return;
      var stage = kv.stage;
      var rect  = kv.layer.getClientRect({ relativeTo: stage });
      if ( ! rect.width || ! rect.height ) return;

      var pad   = 40;
      var scale = Math.min(
        (stage.width()  - pad * 2) / rect.width,
        (stage.height() - pad * 2) / rect.height,
        1);

      new Konva.Tween({
        node: stage,
        scaleX: scale,
        scaleY: scale,
        x: (stage.width()  - rect.width  * scale) / 2 - rect.x * scale,
        y: (stage.height() - rect.height * scale) / 2 - rect.y * scale,
        duration: 0.2
      }).play();
    },

    function resetView() {
      if ( this.konvaView ) this.konvaView.resetView();
    }
  ]
});
