/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'FlowGraphView',
  extends: 'foam.u2.View',

  documentation: `
    Renders a Reflow flow's blocks as a pannable/zoomable dependency graph,
    as an alternative to the document view. Mounted by
    Console.mountGraph_() with data set to the Console itself (so
    this.data.graphMode etc. are reachable), and graph$ following
    Console.flowGraph_$ (the DependencyScanner output, refreshed whenever
    the flow's script regenerates).

    Rendering is a single HTML canvas: GraphScene owns pan/zoom and four
    paint-order layers (containers, edges, nodes, overlay), and this view
    is responsible for building/positioning the GraphNodeCView /
    GraphContainerCView / GraphEdgeCView instances that populate them, plus
    all pointer interaction (hit-testing is done against the scene, since
    there is no DOM element per node any more).

    Not a Controller: Controller exports 'as data', which would shadow the
    Console's own 'data' import used elsewhere in the Reflow Blocks.
  `,

  requires: [
    'foam.graph.Graph',
    'foam.graph.GraphNode',
    'foam.graph.map2d.LayeredGridPlacementStrategy',
    'foam.core.reflow.graph.GraphScene',
    'foam.core.reflow.graph.GraphTheme',
    'foam.core.reflow.graph.GraphNodeCView',
    'foam.core.reflow.graph.GraphContainerCView',
    'foam.core.reflow.graph.GraphEdgeCView',
    'foam.core.reflow.graph.GraphTooltipCView'
  ],

  imports: [
    'selectFromTree',
    'serializeBlocks',
    'pasteBlocks',
    'findFlowChildByName',
    'notify'
  ],

  mixins: [ 'foam.u2.util.ClipboardAccess' ],

  constants: [
    { type: 'Int', name: 'NODE_W',           value: 240 },
    { type: 'Int', name: 'GAP_X',            value: 80 },
    { type: 'Int', name: 'GAP_Y',            value: 24 },
    { type: 'Int', name: 'PORT_Y',           value: 18 },
    { type: 'Int', name: 'CONTAINER_PAD',    value: 16 },
    { type: 'Int', name: 'COLLAPSED_H',      value: 96, documentation: 'Height of a collapsed layout box.' },
    {
      type: 'Int',
      name: 'BAND_GAP',
      value: 72,
      documentation: 'Vertical gap between the connected graph and the section of blocks with no links.'
    },
    {
      type: 'Int',
      name: 'BAND_COLS',
      value: 4,
      documentation: 'Minimum number of columns the unlinked section wraps at when the connected graph is narrower.'
    }
  ],

  messages: [
    { name: 'ZOOM_HINT', message: 'Scroll to zoom · Shift-drag to select · Drag to pan' },
    { name: 'UNLINKED_LABEL', message: 'Not linked to other blocks' },
    { name: 'FOCUS_PREFIX', message: 'Focused on ' },
    { name: 'PREVIEW_LABEL', message: 'Preview' }
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      min-height: 0;
      background: $backgroundSecondary;
      outline: none;
      user-select: none;
    }
    ^:focus-visible { outline: 2px solid $primary400; outline-offset: -2px; }
    ^toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      color: $textSecondary;
    }
    ^preview-toggle { margin-left: auto; }
    ^viewport {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }
    ^viewport canvas { display: block; }
    ^grab { cursor: grab; }
    ^grabbing { cursor: grabbing; }
    ^pointer { cursor: pointer; }
  `,

  properties: [
    {
      name: 'graph',
      documentation: 'DependencyScanner output: { nodes: [{id,name,cmd,cls,parent,depth,block}], edges: [{source,target,kind,field}] } -- id/parent/source/target are node ids (positional; see DependencyScanner), name is the display flowName.'
    },
    { name: 'selected' },
    { name: 'softSelected' },
    {
      class: 'Boolean',
      name: 'preview',
      value: true,
      documentation: 'Bound to Console.graphPreview: show the selected block\'s output under the canvas.'
    },
    {
      class: 'Boolean',
      name: 'visible',
      value: true,
      documentation: 'False while the graph pane is display:none. Layout needs measured heights, so a rebuild is deferred until the pane shows again.'
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.FlowMode',
      name: 'flowMode',
      value: 'CONSOLE'
    },
    {
      name: 'selection_',
      documentation: 'node id -> block, for the current multi-selection. Always replaced wholesale (never mutated) so slots derived from it fire.',
      factory: function() { return {}; }
    },
    { name: 'scene_', hidden: true, transient: true, documentation: 'The GraphScene root CView.' },
    { name: 'theme_', hidden: true, transient: true, factory: function() { return this.GraphTheme.create({}, this.__subContext__); } },
    { name: 'canvasEl_', hidden: true, transient: true, documentation: 'The foam.graphics.Canvas u2 Element hosting scene_.' },
    { name: 'nodeViews_', hidden: true, transient: true, documentation: 'node id -> GraphNodeCView|GraphContainerCView, for every currently displayed node.', factory: function() { return {}; } },
    { name: 'edgeViews_', hidden: true, transient: true, documentation: 'Array of { source, target, view: GraphEdgeCView } (source/target are node ids) for every currently drawn edge.', factory: function() { return []; } },
    { name: 'tooltip_', hidden: true, transient: true, documentation: 'The single GraphTooltipCView reused for hover tooltips.' },
    { name: 'marquee_', hidden: true, transient: true, documentation: 'The foam.graphics.Box marquee CView while shift-drag-selecting, else null.' },
    { name: 'drag_', hidden: true, transient: true, documentation: 'Pointer interaction state while a button is held: { kind: node|pan|marquee, ... }, else null.' },
    { name: 'stateSubs_', hidden: true, transient: true, documentation: 'Detachables for the per-block shown$/error$/locked$ subscriptions set up in rebuild(); dropped and replaced on every rebuild.', factory: function() { return []; } },
    { name: 'sizes_', hidden: true, transient: true, factory: function() { return {}; } },
    { class: 'String', name: 'signature_', hidden: true, transient: true },
    {
      class: 'String',
      name: 'focusRoot_',
      documentation: `flowName of the block the canvas is focused on: only its dependency chain
        (upstream and downstream) is laid out. Empty shows the whole flow. Kept as a name
        (Console.graphFocus is a flowName, also consumed by the Block action) -- rebuild()
        resolves it to the id of the LAST node with that name before using it.`
    },
    {
      name: 'nodes_',
      hidden: true,
      transient: true,
      documentation: 'The graph nodes currently laid out (all of them, or the focused chain).',
      factory: function() { return []; }
    },
    {
      name: 'edgeList_',
      hidden: true,
      transient: true,
      documentation: 'Collapsed edges (one per source|target) currently drawn.',
      factory: function() { return []; }
    },
    {
      name: 'focusSet_',
      hidden: true,
      transient: true,
      documentation: 'flowName -> true for the selection and everything on its dependency chain; null when nothing is selected. Drives dimming.',
      expression: function(selection_, edgeList_, nodes_) {
        var names = Object.keys(selection_ || {});
        if ( ! names.length ) return null;
        var set = this.connectedSet_(this.withDescendants_(names), edgeList_);
        this.withAncestors_(Object.keys(set)).forEach(function(n) { set[n] = true; });
        return set;
      }
    },
    {
      name: 'expanded_',
      hidden: true,
      transient: true,
      documentation: 'Container id -> true for layouts the user expanded. Containers start collapsed: one card, children hidden, their edges lifted onto it.',
      factory: function() { return {}; }
    },
    {
      class: 'String',
      name: 'reveal_',
      hidden: true,
      transient: true,
      documentation: 'node id to select and centre on once it is laid out; set when `selected` changes from outside the canvas (e.g. Block "Show in Graph").'
    },
    {
      class: 'Boolean',
      name: 'selectingFromGraph_',
      hidden: true,
      transient: true
    },
    {
      class: 'Boolean',
      name: 'lastModifier_',
      hidden: true,
      transient: true,
      documentation: 'Whether shift/ctrl/meta was held on the most recent pointerdown on a node/container, captured before the click-vs-drag decision.'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass().attrs({ tabindex: 0 }).on('pointerdown', function() { self.focus(); });

      this.start().addClass(this.myClass('toolbar'))
        .startContext({ data: this }).tag(this.FIT).endContext()
        .start('span').add(this.slot(function(scene_$zoom) {
          return Math.round(( scene_$zoom || 1 ) * 100) + '%';
        })).end()
        .start('span').add(this.ZOOM_HINT).end()
        .startContext({ data: this }).tag(this.FOCUS_SELECTION).tag(this.UNFOCUS).tag(this.EXPAND_ALL).tag(this.COLLAPSE_ALL).endContext()
        .start(foam.u2.CheckBox, { data$: this.preview$, label: this.PREVIEW_LABEL }).addClass(this.myClass('preview-toggle')).end()
        .start('span').add(this.focusRoot_$.map(function(r) { return r ? self.FOCUS_PREFIX + r : ''; })).end()
      .end();

      this.scene_ = this.GraphScene.create({ theme: this.theme_ });
      this.tooltip_ = this.GraphTooltipCView.create({ theme: this.theme_ });
      this.scene_.overlay.add(this.tooltip_);
      this.canvasEl_ = this.scene_.toE(null, this.__subSubContext__);

      var host = this.start().addClass(this.myClass('viewport'), this.myClass('grab'));
      host.add(this.canvasEl_);
      host.resizeObserver(function(entries) {
        var box = entries[0].contentRect;
        var w = Math.round(box.width), h = Math.round(box.height);
        if ( ! w || ! h ) return;
        var firstSize = ! self.scene_.viewWidth && ! self.scene_.viewHeight;
        self.scene_.viewWidth = w;
        self.scene_.viewHeight = h;
        if ( firstSize ) self.fitToNodes_();
      });

      this.canvasEl_.on('pointerdown', function(evt) { self.onCanvasPointerDown_(evt); });
      this.canvasEl_.on('pointermove', function(evt) { self.onCanvasPointerMove_(evt); });
      this.canvasEl_.on('pointerup', function(evt) { self.onCanvasPointerUp_(evt); });
      this.canvasEl_.on('pointercancel', function(evt) { self.onCanvasPointerUp_(evt); });
      this.canvasEl_.on('pointerleave', function(evt) { self.onCanvasPointerLeave_(evt); });
      this.canvasEl_.on('dblclick', function(evt) { self.onCanvasDblClick_(evt); });
      this.canvasEl_.on('wheel', function(evt) { self.onCanvasWheel_(evt); }, { passive: false });
      // Plain DOM listeners via .on(): these die with canvasEl_ itself (a
      // child of this view), same as the framework's own un-wrapped .on()
      // calls elsewhere -- no onDetach needed for them.

      // A theme/variant change re-resolves the palette; the scene has to repaint to show it.
      this.onDetach(this.theme_.colors$.sub(function() { self.scene_.invalidate(); }));

      this.onDetach(function() {
        self.stateSubs_.forEach(function(s) { s.detach(); });
      });

      if ( this.graph ) this.rebuild();
    },

    function onCanvasPointerDown_(evt) {
      if ( evt.button !== 0 && evt.button !== 1 ) return;
      this.canvasEl_.el_().setPointerCapture(evt.pointerId);

      if ( evt.button === 1 ) {
        this.drag_ = { kind: 'pan', last: { clientX: evt.clientX, clientY: evt.clientY } };
        return;
      }

      var hit = this.scene_.hitAt(evt.clientX, evt.clientY);

      if ( hit && hit.role === 'toggle' ) {
        var c = hit.parent;
        while ( c && ! this.GraphContainerCView.isInstance(c) ) c = c.parent;
        if ( c ) this.toggleExpanded_(c.id, c.collapsed);
        return;
      }

      if ( this.GraphNodeCView.isInstance(hit) || this.GraphContainerCView.isInstance(hit) ) {
        this.lastModifier_ = evt.shiftKey || evt.ctrlKey || evt.metaKey;
        if ( ! this.selection_[hit.id] && ! this.lastModifier_ ) {
          var sel = {};
          if ( hit.block ) sel[hit.id] = hit.block;
          this.selection_ = sel;
        }
        this.drag_ = {
          kind: 'node',
          target: hit,
          start: this.scene_.toScene(evt.clientX, evt.clientY),
          origins: this.snapshotOrigins_(hit.id),
          moved: false
        };
        return;
      }

      if ( evt.shiftKey ) {
        var start = this.scene_.toScene(evt.clientX, evt.clientY);
        this.marquee_ = foam.graphics.Box.create({
          x: start.x, y: start.y, width: 0, height: 0,
          color: this.theme_.colors.marqueeFill,
          border: this.theme_.colors.marqueeStroke,
          alpha: 0.15
        });
        this.scene_.overlay.add(this.marquee_);
        this.drag_ = { kind: 'marquee', start: start };
        return;
      }

      this.drag_ = { kind: 'pan', last: { clientX: evt.clientX, clientY: evt.clientY } };
    },

    function onCanvasPointerMove_(evt) {
      var self = this;
      var drag = this.drag_;

      if ( drag && drag.kind === 'node' ) {
        var p = this.scene_.toScene(evt.clientX, evt.clientY);
        var dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if ( Math.abs(dx) > 2 || Math.abs(dy) > 2 ) drag.moved = true;
        Object.keys(drag.origins).forEach(function(name) {
          var cv = self.nodeViews_[name];
          if ( ! cv ) return;
          var o = drag.origins[name];
          cv.x = o.x + dx;
          cv.y = o.y + dy;
        });
        return;
      }

      if ( drag && drag.kind === 'pan' ) {
        this.scene_.panBy(evt.clientX - drag.last.clientX, evt.clientY - drag.last.clientY);
        drag.last = { clientX: evt.clientX, clientY: evt.clientY };
        return;
      }

      if ( drag && drag.kind === 'marquee' ) {
        var p2 = this.scene_.toScene(evt.clientX, evt.clientY);
        this.marquee_.x = Math.min(drag.start.x, p2.x);
        this.marquee_.y = Math.min(drag.start.y, p2.y);
        this.marquee_.width = Math.abs(p2.x - drag.start.x);
        this.marquee_.height = Math.abs(p2.y - drag.start.y);
        return;
      }

      // No drag in progress: hover.
      var hit = this.scene_.hitAt(evt.clientX, evt.clientY);
      var tip = '';
      if ( this.GraphNodeCView.isInstance(hit) || this.GraphContainerCView.isInstance(hit) ) {
        this.softSelected = hit.block;
        tip = hit.tooltipAt(this.localPoint_(evt, hit)) || '';
      } else if ( this.GraphEdgeCView.isInstance(hit) ) {
        this.softSelected = null;
        tip = hit.tooltipAt() || '';
      } else {
        this.softSelected = null;
      }

      this.tooltip_.text = tip;
      if ( tip ) {
        var scenePt = this.scene_.toScene(evt.clientX, evt.clientY);
        this.tooltip_.anchorX = scenePt.x;
        this.tooltip_.anchorY = scenePt.y;
      }

      var host = this.canvasEl_.parentNode;
      host.enableClass(this.myClass('grab'), ! hit);
      host.enableClass(this.myClass('pointer'), !! hit);
    },

    function onCanvasPointerUp_(evt) {
      var self = this;
      var drag = this.drag_;
      this.drag_ = null;
      if ( ! drag ) return;

      if ( drag.kind === 'node' ) {
        if ( ! drag.moved ) {
          var id = drag.target.id;
          if ( this.lastModifier_ ) {
            var sel = Object.assign({}, this.selection_);
            if ( sel[id] ) {
              delete sel[id];
            } else if ( drag.target.block ) {
              sel[id] = drag.target.block;
            }
            this.selection_ = sel;
          } else {
            var sel2 = {};
            if ( drag.target.block ) sel2[id] = drag.target.block;
            this.selection_ = sel2;
          }
        }
        this.selectingFromGraph_ = true;
        this.selected = drag.target.block;
        this.selectingFromGraph_ = false;
        return;
      }

      if ( drag.kind === 'marquee' ) {
        var box = this.marquee_;
        this.scene_.overlay.remove(this.marquee_);
        this.marquee_ = null;
        if ( box.width < 2 && box.height < 2 ) return;

        var hits = {};
        Object.keys(this.nodeViews_).forEach(function(nm) {
          var cv = self.nodeViews_[nm];
          var intersects = cv.x < box.x + box.width && cv.x + cv.width > box.x &&
                           cv.y < box.y + box.height && cv.y + cv.height > box.y;
          if ( ! intersects ) return;
          var b = self.blockOf_(nm);
          if ( b ) hits[nm] = b;
        });

        this.selection_ = ( evt.ctrlKey || evt.metaKey ) ?
          Object.assign({}, this.selection_, hits) :
          hits;
      }
      // pan: nothing further to do.
    },

    function onCanvasPointerLeave_(evt) {
      this.softSelected = null;
      this.tooltip_.text = '';
    },

    function onCanvasDblClick_(evt) {
      var hit = this.scene_.hitAt(evt.clientX, evt.clientY);
      if ( ( this.GraphNodeCView.isInstance(hit) || this.GraphContainerCView.isInstance(hit) ) && hit.block ) {
        this.data.graphMode = false;
        this.selectFromTree(hit.block);
      }
    },

    function onCanvasWheel_(evt) {
      evt.preventDefault();
      var rect = this.canvasEl_.el_().getBoundingClientRect();
      var vx = evt.clientX - rect.left, vy = evt.clientY - rect.top;
      var deltaY = evt.deltaMode === 1 ? evt.deltaY * 16 : evt.deltaY;
      this.scene_.zoomAt(vx, vy, Math.exp(-deltaY * 0.0015));
    },

    function localPoint_(evt, cv) {
      /** Pointer-event client coordinates -> cv's own local coordinates. */
      var rect = this.canvasEl_.el_().getBoundingClientRect();
      var p = foam.graphics.Point.create({
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
        w: 1
      });
      return cv.globalToLocalCoordinates(p);
    },

    function toggleExpanded_(id, collapsed) {
      var next = Object.assign({}, this.expanded_);
      if ( collapsed ) next[id] = true; else delete next[id];
      this.expanded_ = next;
    },

    function applyState_() {
      var self = this;
      var sel = this.selection_ || {};
      var soft = this.softSelected;
      var focusSet = this.focusSet_;

      Object.keys(this.nodeViews_).forEach(function(id) {
        var cv = self.nodeViews_[id];
        cv.isSelected = !! sel[id];
        // soft.dependencies is name-based (Flowable.dependencies), so match by name here.
        cv.isDependent = !! soft && soft !== cv.block && ( soft.dependencies || [] ).indexOf(cv.name) !== -1;
        cv.dimmed = !! focusSet && ! focusSet[id];
      });

      this.edgeViews_.forEach(function(e) {
        var srcBlock = self.blockOf_(e.source);
        var dstBlock = self.blockOf_(e.target);
        e.view.active = !! soft && ( soft === srcBlock || soft === dstBlock );
        e.view.selectedEdge = !! ( sel[e.source] || sel[e.target] );
        e.view.dimmed = !! focusSet && ! ( focusSet[e.source] && focusSet[e.target] );
      });
    },

    function withDescendants_(ids) {
      /** ids plus every node nested (at any depth) inside those that are containers. */
      var nodes = this.nodes_ || [];
      var out = {};
      var queue = ids.slice();
      while ( queue.length ) {
        var n = queue.shift();
        if ( out[n] ) continue;
        out[n] = true;
        nodes.forEach(function(x) { if ( x.parent === n ) queue.push(x.id); });
      }
      return Object.keys(out);
    },

    function withAncestors_(ids) {
      /** ids plus the containers holding them, up to the root. */
      var byId = {};
      ( this.nodes_ || [] ).forEach(function(n) { byId[n.id] = n; });
      var out = {};
      ids.forEach(function(n) {
        for ( var cur = n ; cur && ! out[cur] ; cur = byId[cur] && byId[cur].parent ) out[cur] = true;
      });
      return Object.keys(out);
    },

    function containerNames_() {
      /** Every layout container's id in the flow, whether or not it is currently shown expanded. */
      var out = {};
      ( this.graph && this.graph.nodes || [] ).forEach(function(n) { if ( n.parent ) out[n.parent] = true; });
      return Object.keys(out);
    },

    function isContainer_(id) {
      return ( this.nodes_ || [] ).some(function(n) { return n.parent === id; });
    },

    function connectedSet_(ids, edges) {
      /** ids plus their dependency chain: everything upstream (followed
          against edge direction) and everything downstream (along it).
          Siblings that merely share a source are not included. */
      var down = {}, up = {};
      ( edges || [] ).forEach(function(e) {
        ( down[e.source] = down[e.source] || [] ).push(e.target);
        ( up[e.target]   = up[e.target]   || [] ).push(e.source);
      });
      var seen = {};
      ids.forEach(function(n) { seen[n] = true; });
      [ down, up ].forEach(function(adj) {
        var queue = ids.slice();
        var visited = {};
        while ( queue.length ) {
          var n = queue.shift();
          if ( visited[n] ) continue;
          visited[n] = true;
          ( adj[n] || [] ).forEach(function(m) { seen[m] = true; queue.push(m); });
        }
      });
      return seen;
    },

    function blockOf_(id) {
      var n = ( this.nodes_ || [] ).find(function(x) { return x.id === id; });
      return n ? n.block : null;
    },

    function idOfBlock_(block) {
      /** The id of the currently laid-out node whose block is this exact
          instance (identity match, so duplicate flowNames resolve to the
          right occurrence); falls back to idForName_(block.flowName) when
          the block isn't laid out yet. */
      var nodes = this.nodes_ || [];
      for ( var i = 0 ; i < nodes.length ; i++ ) {
        if ( nodes[i].block === block ) return nodes[i].id;
      }
      return this.idForName_(block.flowName);
    },

    function idForName_(name) {
      /** The id of the last currently laid-out node with this flowName --
          matching the flow scope's last-wins binding -- falling back to the
          name itself when no node has it yet: a name introduced by paste is
          guaranteed fresh/unique (Console.pasteBlocks renames on any
          collision), so its eventual id will be its own first occurrence. */
      var lastId = null;
      ( this.nodes_ || [] ).forEach(function(n) { if ( n.name === name ) lastId = n.id; });
      return lastId || name;
    },

    function selectedRoots_() {
      /** Selected nodes, minus any whose ancestor is also selected. */
      var self = this;
      var byId = {};
      ( this.nodes_ || [] ).forEach(function(n) { byId[n.id] = n; });

      function hasSelectedAncestor(id) {
        var n = byId[id];
        while ( n && n.parent ) {
          if ( self.selection_[n.parent] ) return true;
          n = byId[n.parent];
        }
        return false;
      }

      return Object.keys(this.selection_ || {})
        .filter(function(id) { return ! hasSelectedAncestor(id); })
        .map(function(id) { return byId[id]; })
        .filter(function(n) { return !! n; });
    },

    function snapshotOrigins_(fallbackId) {
      /** node id -> {x,y} for every currently-selected node, plus every descendant of a selected container. */
      var self = this;
      var ids = Object.keys(this.selection_ || {});
      if ( ! ids.length && fallbackId ) ids = [ fallbackId ];

      var result = {};
      function addWithDescendants(id) {
        var cv = self.nodeViews_[id];
        if ( cv && ! result[id] ) result[id] = { x: cv.x, y: cv.y };
        ( self.nodes_ || [] ).forEach(function(n) {
          if ( n.parent === id ) addWithDescendants(n.id);
        });
      }
      ids.forEach(addWithDescendants);
      return result;
    },

    function revealPending_() {
      var id = this.reveal_;
      if ( ! id ) return;
      var block = this.blockOf_(id);
      var cv = this.nodeViews_[id];
      var s = this.sizes_[id];
      if ( ! block || ! cv || ! s ) return;
      this.reveal_ = '';
      var sel = {};
      sel[id] = block;
      this.selection_ = sel;
      // Focused: the rebuild already framed the chain. Otherwise bring the block to the middle.
      if ( ! this.focusRoot_ ) this.scene_.centerOn(cv.x + s[0] / 2, cv.y + s[1] / 2, 1);
    },

    function kindOf(node) {
      /** A value class names the kind of block it makes in its BLOCK_KIND
          constant, which a subclass inherits. Anything else is a plain block. */
      var cls = node.cls && foam.maybeLookup(node.cls);
      return ( cls && cls.BLOCK_KIND ) || 'block';
    },

    function summaryOf(node) {
      /** node: one entry of graph.nodes ({name,cmd,cls,parent,depth,block}).
          The command text, then whatever the block's value says about itself
          through toSummary(). Never throws. */
      function trunc(s) {
        s = String(s == null ? '' : s);
        return s.length > 60 ? s.slice(0, 59) + '…' : s;
      }

      var lines = [ trunc(node.cmd) ];
      try {
        var value = node.block && node.block.value;
        if ( foam.lang.FObject.isInstance(value) ) lines.push(trunc(value.toSummary()));
      } catch (e) {}

      return lines.filter(function(l) { return !! l; });
    },

    function fitToNodes_() {
      var self = this;
      var bounds = null;
      ( this.nodes_ || [] ).forEach(function(n) {
        if ( n.parent ) return;
        var cv = self.nodeViews_[n.id];
        var s = self.sizes_[n.id];
        if ( ! cv || ! s ) return;
        var x0 = cv.x, y0 = cv.y, x1 = x0 + s[0], y1 = y0 + s[1];
        if ( ! bounds ) {
          bounds = { x0: x0, y0: y0, x1: x1, y1: y1 };
        } else {
          bounds.x0 = Math.min(bounds.x0, x0);
          bounds.y0 = Math.min(bounds.y0, y0);
          bounds.x1 = Math.max(bounds.x1, x1);
          bounds.y1 = Math.max(bounds.y1, y1);
        }
      });
      if ( ! bounds ) return;
      // GraphScene.fit() itself caps at zoom 1, so a small graph is never blown up.
      this.scene_.fit({
        x: bounds.x0, y: bounds.y0,
        width: bounds.x1 - bounds.x0, height: bounds.y1 - bounds.y0
      });
    },

    function placeScope_(scopeId, plan, childrenByParent, containerNames, origin) {
      /**
       * Lays out one scope (the root, or one container's children) left to
       * right by layer, top to bottom by row within a layer, columns
       * centred against the tallest column. Container members are sized by
       * a dry-run recursive call before this scope's columns are measured,
       * then re-run for real once this scope has decided the container's
       * (x, y). Returns this scope's bounding box, relative to origin.
       */
      var self = this;
      var members = childrenByParent[scopeId] || [];
      if ( ! members.length ) return { x: origin.x, y: origin.y, width: 0, height: 0 };

      // Blocks with no links are still laid out, in their own section under
      // the connected graph, so they do not pad the graph's first column.
      var detached = members
        .filter(function(name) { return plan.detached[name] !== undefined; })
        .sort(function(a, b) { return plan.detached[a] - plan.detached[b]; });
      members = members.filter(function(name) { return plan.detached[name] === undefined; });

      // Size container members first (dry run at a throwaway origin -- only
      // the resulting bbox is kept here; positions are reassigned for real
      // below, once this scope knows the container's column).
      members.concat(detached).forEach(function(name) {
        if ( ! containerNames[name] ) return;
        var innerBbox = self.placeScope_(name, plan, childrenByParent, containerNames, { x: 0, y: 0 });
        var size = [
          innerBbox.width + 2 * self.CONTAINER_PAD,
          innerBbox.height + 2 * self.CONTAINER_PAD + self.GraphContainerCView.HEADER_H
        ];
        self.sizes_[name] = size;
        var cv = self.nodeViews_[name];
        if ( cv ) { cv.width = size[0]; cv.height = size[1]; }
      });

      function sizeOf(name) { return self.sizes_[name] || [ self.NODE_W, 40 ]; }

      var byLayer = {}, maxLayer = -1;
      members.forEach(function(name) {
        var p = plan.getPlacement(name) || [ 0, 0 ];
        ( byLayer[p[0]] = byLayer[p[0]] || [] ).push({ name: name, row: p[1] });
        maxLayer = Math.max(maxLayer, p[0]);
      });

      var colW = [], colX = [], x = origin.x;
      for ( var L = 0 ; L <= maxLayer ; L++ ) {
        var list = ( byLayer[L] || [] ).sort(function(a, b) { return a.row - b.row; });
        byLayer[L] = list;
        colW[L] = list.reduce(function(w, m) { return Math.max(w, sizeOf(m.name)[0]); }, self.NODE_W);
        colX[L] = x;
        x += colW[L] + self.GAP_X;
      }

      var colHeight = [], maxHeight = 0;
      for ( var L2 = 0 ; L2 <= maxLayer ; L2++ ) {
        var list2 = byLayer[L2];
        var h = list2.reduce(function(sum, m) { return sum + sizeOf(m.name)[1] + self.GAP_Y; }, 0);
        if ( h ) h -= self.GAP_Y;
        colHeight[L2] = h;
        maxHeight = Math.max(maxHeight, h);
      }

      for ( var L3 = 0 ; L3 <= maxLayer ; L3++ ) {
        var list3 = byLayer[L3];
        var y = origin.y + ( maxHeight - colHeight[L3] ) / 2;
        list3.forEach(function(m) {
          var cv = self.nodeViews_[m.name];
          cv.x = colX[L3];
          cv.y = y;
          if ( containerNames[m.name] ) {
            self.placeScope_(m.name, plan, childrenByParent, containerNames, {
              x: colX[L3] + self.CONTAINER_PAD,
              y: y + self.CONTAINER_PAD + self.GraphContainerCView.HEADER_H
            });
          }
          y += sizeOf(m.name)[1] + self.GAP_Y;
        });
      }

      var gridWidth = members.length ? x - self.GAP_X - origin.x : 0;
      if ( ! detached.length ) {
        return { x: origin.x, y: origin.y, width: gridWidth, height: maxHeight };
      }

      // Unlinked section: rows wrapping at the graph's width (or BAND_COLS
      // columns when the graph is narrower), separated from the graph by a
      // dashed line at the root scope.
      var bandTop  = origin.y + ( members.length ? maxHeight + self.BAND_GAP : 0 );
      var rowLimit = Math.max(gridWidth, self.BAND_COLS * ( self.NODE_W + self.GAP_X ) - self.GAP_X);
      var bx = origin.x, by = bandTop, rowH = 0, bandWidth = 0;
      detached.forEach(function(name) {
        var size = sizeOf(name);
        if ( bx > origin.x && bx + size[0] > origin.x + rowLimit ) {
          bx = origin.x;
          by += rowH + self.GAP_Y;
          rowH = 0;
        }
        var cv = self.nodeViews_[name];
        cv.x = bx;
        cv.y = by;
        if ( containerNames[name] ) {
          self.placeScope_(name, plan, childrenByParent, containerNames, {
            x: bx + self.CONTAINER_PAD,
            y: by + self.CONTAINER_PAD + self.GraphContainerCView.HEADER_H
          });
        }
        bx += size[0] + self.GAP_X;
        rowH = Math.max(rowH, size[1]);
        bandWidth = Math.max(bandWidth, bx - self.GAP_X - origin.x);
      });
      var width = Math.max(gridWidth, bandWidth);

      if ( scopeId === null && members.length ) {
        var lineY = bandTop - self.BAND_GAP / 2;
        self.scene_.containers.add(
          foam.graphics.Line.create({
            startX: origin.x, startY: lineY,
            endX: origin.x + width, endY: lineY,
            color: self.theme_.colors.nodeBorder,
            lineDash: [ 6, 6 ]
          }),
          foam.graphics.Label.create({
            x: origin.x, y: lineY - 20,
            width: 300, height: 16,
            text: self.UNLINKED_LABEL,
            font: self.theme_.fonts.badge,
            color: self.theme_.colors.textMuted
          })
        );
      }

      return { x: origin.x, y: origin.y, width: width, height: by + rowH - origin.y };
    },

    function rebuild() {
      if ( ! this.graph ) return;
      if ( ! this.visible ) {
        this.signature_ = '';
        return;
      }
      var self = this;

      var nodes = this.graph.nodes;
      var edges = this.graph.edges || [];

      // Focus mode: only the focused block's dependency chain, laid out flat
      // (layout containers are structure, not data, so their shells are
      // left out). focusRoot_ is a flowName (see its documentation); resolve
      // it to the id of the LAST node with that name -- the flow scope's
      // own binding rule -- before using it. Drop the focus if the name is gone.
      var focusId = null;
      if ( this.focusRoot_ ) {
        nodes.forEach(function(n) { if ( n.name === self.focusRoot_ ) focusId = n.id; });
        if ( ! focusId ) this.focusRoot_ = '';
      }
      if ( focusId ) {
        var keep = this.connectedSet_([ focusId ], edges);
        nodes = nodes.filter(function(n) { return keep[n.id]; })
          .map(function(n) { return Object.assign({}, n, { parent: null, depth: 0 }); });
        edges = edges.filter(function(e) { return keep[e.source] && keep[e.target]; });
      }
      // Every container in the flow (before collapsing), for card kind/summary.
      var hasChildren = {};
      nodes.forEach(function(n) { if ( n.parent ) hasChildren[n.parent] = true; });

      // Collapsed containers (the default) show as one card: descendants are
      // hidden and edges touching them attach to the highest collapsed ancestor.
      if ( ! this.focusRoot_ ) {
        var parentOfAll = {};
        nodes.forEach(function(n) { if ( n.parent ) parentOfAll[n.id] = n.parent; });
        var rep = function(id) {
          var top = id;
          for ( var p = parentOfAll[id] ; p ; p = parentOfAll[p] ) {
            if ( ! self.expanded_[p] ) top = p;
          }
          return top;
        };
        nodes = nodes.filter(function(n) { return rep(n.id) === n.id; });
        edges = edges
          .map(function(e) { return Object.assign({}, e, { source: rep(e.source), target: rep(e.target) }); })
          .filter(function(e) { return e.source !== e.target; });
      }
      // Node ids are the identity here (see DependencyScanner); a duplicate
      // flowName is drawn as its own node rather than collapsed away.
      this.nodes_ = nodes;

      var sig = JSON.stringify({
        f: this.focusRoot_,
        x: Object.keys(this.expanded_).sort(),
        n: nodes.map(function(n) { return [ n.id, n.parent, n.cls ]; }),
        e: edges.map(function(e) { return [ e.source, e.target, e.kind ]; })
      });

      if ( sig === this.signature_ ) {
        nodes.forEach(function(n) {
          var nv = self.nodeViews_[n.id];
          if ( nv && self.GraphNodeCView.isInstance(nv) ) nv.summary = self.summaryOf(n);
        });
        return;
      }
      this.signature_ = sig;

      if ( this.marquee_ ) { this.scene_.overlay.remove(this.marquee_); this.marquee_ = null; }
      this.scene_.containers.removeAllChildren();
      this.scene_.edges.removeAllChildren();
      this.scene_.nodes.removeAllChildren();
      this.stateSubs_.forEach(function(s) { s.detach(); });
      this.stateSubs_ = [];
      this.nodeViews_ = {};
      this.edgeViews_ = [];
      this.sizes_ = {};

      // Build the foam.graph.Graph model and the parent map.
      var parentOf = {};
      var containerNames = {};
      var data = {};
      nodes.forEach(function(n) {
        data[n.id] = self.GraphNode.create({ id: n.id, data: n });
        if ( n.parent ) {
          parentOf[n.id] = n.parent;
          containerNames[n.parent] = true;
        }
      });

      // Collapse duplicate source|target edges into one, keeping the
      // strongest kind and every field that referenced it (for the tooltip).
      var STRENGTH = { data: 3, script: 2, reaction: 1 };
      var collapsed = {};
      edges.forEach(function(e) {
        var key = e.source + '|' + e.target;
        var c = collapsed[key];
        if ( ! c ) {
          collapsed[key] = { source: e.source, target: e.target, kind: e.kind, fields: e.field ? [ e.field ] : [] };
        } else {
          if ( ( STRENGTH[e.kind] || 0 ) > ( STRENGTH[c.kind] || 0 ) ) c.kind = e.kind;
          if ( e.field ) c.fields.push(e.field);
        }
      });
      var edgeList = Object.keys(collapsed).map(function(k) { return collapsed[k]; });
      this.edgeList_ = edgeList;

      edgeList.forEach(function(e) {
        if ( ! data[e.source] || ! data[e.target] ) return;
        data[e.source].forwardLinks = data[e.source].forwardLinks.concat([ { id: e.target, kind: e.kind } ]);
        data[e.target].inverseLinks = data[e.target].inverseLinks.concat([ { id: e.source, kind: e.kind } ]);
      });

      var graphModel = this.Graph.create({ data: data });

      // Create a CView for every node.
      nodes.forEach(function(n) {
        var isContainer = !! containerNames[n.id];
        var hasIn  = graphModel.data[n.id].inverseLinks.length > 0;
        var hasOut = graphModel.data[n.id].forwardLinks.length > 0;

        if ( isContainer ) {
          var ccv = self.GraphContainerCView.create({
            id: n.id,
            block: n.block,
            name: n.name,
            collapsed: false,
            childCount: ( n.block && n.block.flowChildren || [] ).length,
            theme: self.theme_,
            hasIn: hasIn,
            hasOut: hasOut
          });
          self.nodeViews_[n.id] = ccv;
          self.scene_.containers.add(ccv);
          // Its width/height are set once placeScope_ has measured its children.
        } else if ( hasChildren[n.id] ) {
          // A collapsed layout: its own card shape at card size, children hidden.
          var col = self.GraphContainerCView.create({
            id: n.id,
            block: n.block,
            name: n.name,
            collapsed: true,
            width: self.NODE_W,
            height: self.COLLAPSED_H,
            childCount: ( n.block && n.block.flowChildren || [] ).length,
            theme: self.theme_,
            hasIn: hasIn,
            hasOut: hasOut
          });
          self.nodeViews_[n.id] = col;
          self.scene_.nodes.add(col);
          self.sizes_[n.id] = [ self.NODE_W, self.COLLAPSED_H ];
        } else {
          var summary = self.summaryOf(n);
          var ncv = self.GraphNodeCView.create({
            id: n.id,
            block: n.block,
            name: n.name,
            kind: self.kindOf(n),
            summary: summary,
            theme: self.theme_,
            renders: !! ( n.block && n.block.rendersOutput ),
            hidden: n.block ? ! n.block.shown : false,
            locked: !! ( n.block && n.block.locked ),
            error: n.block ? n.block.error : '',
            hasIn: hasIn,
            hasOut: hasOut
          });
          self.nodeViews_[n.id] = ncv;
          self.scene_.nodes.add(ncv);
          self.sizes_[n.id] = [ self.NODE_W, self.GraphNodeCView.heightFor(summary.length) ];

          if ( n.block ) {
            var block = n.block;
            self.stateSubs_.push(block.shown$.sub(function() {
              ncv.hidden = ! block.shown;
              ncv.renders = !! block.rendersOutput;
            }));
            self.stateSubs_.push(block.error$.sub(function() {
              ncv.error = block.error || '';
            }));
            self.stateSubs_.push(block.locked$.sub(function() {
              ncv.locked = !! block.locked;
            }));
          }
        }
      });

      // Layout.
      var plan = this.LayeredGridPlacementStrategy.create({
        graph: graphModel,
        parentOf: parentOf,
        softKinds: [ 'reaction', 'script' ]
      }).getPlan();

      var childrenByParent = {};
      nodes.forEach(function(n) {
        var p = n.parent || null;
        ( childrenByParent[p] = childrenByParent[p] || [] ).push(n.id);
      });

      this.placeScope_(null, plan, childrenByParent, containerNames, { x: 0, y: 0 });

      // Edges, positioned off the nodeViews_ CViews GraphEdgeCView holds.
      edgeList.forEach(function(e) {
        var srcCv = self.nodeViews_[e.source], dstCv = self.nodeViews_[e.target];
        if ( ! srcCv || ! dstCv ) return;
        var edgeCv = self.GraphEdgeCView.create({
          from: srcCv,
          to: dstCv,
          fromPortY: self.GraphContainerCView.isInstance(srcCv) ? self.GraphContainerCView.PORT_Y : self.GraphNodeCView.PORT_Y,
          toPortY:   self.GraphContainerCView.isInstance(dstCv) ? self.GraphContainerCView.PORT_Y : self.GraphNodeCView.PORT_Y,
          kind: e.kind,
          fields: e.fields,
          theme: self.theme_
        });
        self.scene_.edges.add(edgeCv);
        self.edgeViews_.push({ source: e.source, target: e.target, view: edgeCv });
      });

      this.applyState_();
      this.fitToNodes_();
      this.revealPending_();
    }
  ],

  listeners: [
    {
      name: 'onSelected',
      on: [ 'this.propertyChange.selected' ],
      code: function() {
        if ( this.selectingFromGraph_ ) return;
        var b = this.selected;
        if ( ! b || b === this.data || ! b.flowName ) return;
        var id = this.idOfBlock_(b);
        if ( ! id ) return;
        this.reveal_ = id;
        // A block outside the focused chain cannot be shown while focused.
        if ( this.focusRoot_ && ! this.blockOf_(id) ) {
          this.focusRoot_ = '';
          return;
        }
        if ( this.visible && this.nodeViews_[id] ) this.revealPending_();
      }
    },
    {
      name: 'onSelectionState',
      on: [ 'this.propertyChange.selection_', 'this.propertyChange.softSelected', 'this.propertyChange.focusSet_' ],
      code: function() {
        if ( this.scene_ ) this.applyState_();
      }
    },
    {
      name: 'onGraph',
      on: [ 'this.propertyChange.graph', 'this.propertyChange.visible', 'this.propertyChange.focusRoot_', 'this.propertyChange.expanded_' ],
      isMerged: true,
      delay: 250,
      code: function() { this.rebuild(); }
    }
  ],

  actions: [
    {
      name: 'fit',
      label: 'Fit',
      buttonStyle: 'SECONDARY',
      size: 'SMALL',
      code: function() { this.fitToNodes_(); }
    },
    {
      name: 'copySelection',
      label: '',
      keyboardShortcuts: [ 'ctrl-c', 'meta-c' ],
      isAvailable: function(flowMode) { return ! flowMode.isLimitedEditMode; },
      code: function() {
        var roots = this.selectedRoots_();
        if ( ! roots.length ) return false;
        var blocks = roots.map(function(n) { return n.block; }).filter(function(b) { return !! b; });
        if ( ! blocks.length ) return false;
        this.copy(this.serializeBlocks(blocks));
        return true;
      }
    },
    {
      name: 'pasteSelection',
      label: '',
      keyboardShortcuts: [ 'ctrl-v', 'meta-v' ],
      isAvailable: function(flowMode) { return ! flowMode.isLimitedEditMode; },
      code: async function() {
        var self = this;
        try {
          var text = await this.paste(false);
          var names = await this.pasteBlocks(text);
          var sel = {};
          names.forEach(function(n) {
            var b = self.findFlowChildByName(n);
            if ( b ) sel[self.idForName_(n)] = b;
          });
          this.selection_ = sel;
        } catch (e) {
          this.notify(e.message, '', 'ERROR', true);
        }
        return true;
      }
    },
    {
      name: 'duplicateSelection',
      label: '',
      keyboardShortcuts: [ 'ctrl-d', 'meta-d' ],
      isAvailable: function(flowMode) { return ! flowMode.isLimitedEditMode; },
      code: async function() {
        var self = this;
        var roots = this.selectedRoots_();
        var blocks = roots.map(function(n) { return n.block; }).filter(function(b) { return !! b; });
        if ( ! blocks.length ) return false;
        try {
          var text = this.serializeBlocks(blocks);
          var names = await this.pasteBlocks(text);
          var sel = {};
          names.forEach(function(n) {
            var b = self.findFlowChildByName(n);
            if ( b ) sel[self.idForName_(n)] = b;
          });
          this.selection_ = sel;
        } catch (e) {
          this.notify(e.message, '', 'ERROR', true);
        }
        return true;
      }
    },
    {
      name: 'deleteSelection',
      label: '',
      keyboardShortcuts: [ 'delete', 'backspace' ],
      isAvailable: function(flowMode) { return ! flowMode.isLimitedEditMode; },
      code: function() {
        var roots = this.selectedRoots_();
        if ( ! roots.length ) return false;
        // Block.del asks about dependents itself (Console.deleteFlowChild).
        roots.forEach(function(n) { if ( n.block ) n.block.del(); });
        return true;
      }
    },
    {
      name: 'selectAll',
      label: '',
      keyboardShortcuts: [ 'ctrl-a', 'meta-a' ],
      code: function() {
        var sel = {};
        ( this.nodes_ || [] ).forEach(function(n) {
          if ( n.block ) sel[n.id] = n.block;
        });
        this.selection_ = sel;
        return true;
      }
    },
    {
      name: 'focusSelection',
      label: 'Focus',
      toolTip: 'Show only this block and everything linked to it (F)',
      buttonStyle: 'SECONDARY',
      size: 'SMALL',
      isAvailable: function(focusRoot_) { return ! focusRoot_; },
      isEnabled: function(selection_, nodes_) {
        var ids = Object.keys(selection_ || {});
        return ids.length === 1 && ! this.isContainer_(ids[0]);
      },
      code: function() {
        var ids = Object.keys(this.selection_ || {});
        if ( ids.length !== 1 || this.isContainer_(ids[0]) ) return false;
        // Console.graphFocus (focusRoot_) is a flowName, not a node id --
        // rebuild() resolves it back to the last matching id.
        var n = ( this.nodes_ || [] ).find(function(x) { return x.id === ids[0]; });
        if ( ! n ) return false;
        this.focusRoot_ = n.name;
        return true;
      }
    },
    {
      name: 'unfocus',
      label: 'Unfocus',
      toolTip: 'Back to the whole flow (F)',
      buttonStyle: 'SECONDARY',
      size: 'SMALL',
      isAvailable: function(focusRoot_) { return !! focusRoot_; },
      code: function() {
        this.focusRoot_ = '';
        return true;
      }
    },
    {
      name: 'togglePreview',
      label: '',
      keyboardShortcuts: [ 'p' ],
      code: function() {
        this.preview = ! this.preview;
        return true;
      }
    },
    {
      name: 'expandAll',
      label: 'Expand all',
      toolTip: 'Open every layout container',
      buttonStyle: 'SECONDARY',
      size: 'SMALL',
      isAvailable: function(graph, expanded_, focusRoot_) {
        return ! focusRoot_ && this.containerNames_().some(function(c) { return ! expanded_[c]; });
      },
      code: function() {
        var next = {};
        this.containerNames_().forEach(function(c) { next[c] = true; });
        this.expanded_ = next;
        return true;
      }
    },
    {
      name: 'collapseAll',
      label: 'Collapse all',
      toolTip: 'Close every layout container',
      buttonStyle: 'SECONDARY',
      size: 'SMALL',
      isAvailable: function(graph, expanded_, focusRoot_) {
        var names = this.containerNames_();
        return ! focusRoot_ && names.length > 0 && names.every(function(c) { return !! expanded_[c]; });
      },
      code: function() {
        this.expanded_ = {};
        return true;
      }
    },
    {
      name: 'toggleFocus',
      label: '',
      documentation: 'Keyboard-only: one key for both buttons, since a shortcut can bind to a single action.',
      keyboardShortcuts: [ 'f' ],
      code: function() {
        return this.focusRoot_ ? this.unfocus() : this.focusSelection();
      }
    },
    {
      name: 'clearSelection',
      label: '',
      keyboardShortcuts: [ 'escape' ],
      code: function() {
        if ( Object.keys(this.selection_ || {}).length ) {
          this.selection_ = {};
          return true;
        }
        if ( this.focusRoot_ ) {
          this.focusRoot_ = '';
          return true;
        }
        return false;
      }
    }
  ]
});
