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
    'foam.u2.dialog.ConfirmationModal',
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
    { name: 'DELETE_LOCKED_TITLE', message: 'Delete blocks with dependents?' },
    { name: 'DELETE_LOCKED_BODY', message: 'The following blocks are referenced elsewhere in the flow. Deleting them may break those blocks: ' },
    { name: 'UNLINKED_LABEL', message: 'Not linked to other blocks' },
    { name: 'FOCUS_PREFIX', message: 'Focused on ' },
    { name: 'PREVIEW_LABEL', message: 'Preview' },
    { name: 'DELETE_CONFIRM', message: 'Delete' },
    { name: 'DELETE_CANCEL', message: 'Cancel' }
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
      documentation: 'DependencyScanner output: { nodes: [{name,cmd,cls,parent,depth,block}], edges: [{source,target,kind,field}] }.'
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
      documentation: 'flowName -> block, for the current multi-selection. Always replaced wholesale (never mutated) so slots derived from it fire.',
      factory: function() { return {}; }
    },
    { name: 'scene_', hidden: true, transient: true, documentation: 'The GraphScene root CView.' },
    { name: 'theme_', hidden: true, transient: true, factory: function() { return this.GraphTheme.create({}, this.__subContext__); } },
    { name: 'canvasEl_', hidden: true, transient: true, documentation: 'The foam.graphics.Canvas u2 Element hosting scene_.' },
    { name: 'nodeViews_', hidden: true, transient: true, documentation: 'flowName -> GraphNodeCView|GraphContainerCView, for every currently displayed node.', factory: function() { return {}; } },
    { name: 'edgeViews_', hidden: true, transient: true, documentation: 'Array of { source, target, view: GraphEdgeCView } for every currently drawn edge.', factory: function() { return []; } },
    { name: 'tooltip_', hidden: true, transient: true, documentation: 'The single GraphTooltipCView reused for hover tooltips.' },
    { name: 'marquee_', hidden: true, transient: true, documentation: 'The foam.graphics.Box marquee CView while shift-drag-selecting, else null.' },
    { name: 'drag_', hidden: true, transient: true, documentation: 'Pointer interaction state while a button is held: { kind: node|pan|marquee, ... }, else null.' },
    { name: 'stateSubs_', hidden: true, transient: true, documentation: 'Detachables for the per-block shown$/error$/locked$ subscriptions set up in rebuild(); dropped and replaced on every rebuild.', factory: function() { return []; } },
    { name: 'sizes_', hidden: true, transient: true, factory: function() { return {}; } },
    { class: 'String', name: 'signature_', hidden: true, transient: true },
    {
      class: 'String',
      name: 'focusRoot_',
      documentation: 'flowName of the block the canvas is focused on: only its dependency chain (upstream and downstream) is laid out. Empty shows the whole flow.'
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
      documentation: 'Container flowName -> true for layouts the user expanded. Containers start collapsed: one card, children hidden, their edges lifted onto it.',
      factory: function() { return {}; }
    },
    {
      class: 'String',
      name: 'reveal_',
      hidden: true,
      transient: true,
      documentation: 'flowName to select and centre on once it is laid out; set when `selected` changes from outside the canvas (e.g. Block "Show in Graph").'
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
        if ( c ) this.toggleExpanded_(c.name, c.collapsed);
        return;
      }

      if ( this.GraphNodeCView.isInstance(hit) || this.GraphContainerCView.isInstance(hit) ) {
        this.lastModifier_ = evt.shiftKey || evt.ctrlKey || evt.metaKey;
        if ( ! this.selection_[hit.name] && ! this.lastModifier_ ) {
          var sel = {};
          if ( hit.block ) sel[hit.name] = hit.block;
          this.selection_ = sel;
        }
        this.drag_ = {
          kind: 'node',
          target: hit,
          start: this.scene_.toScene(evt.clientX, evt.clientY),
          origins: this.snapshotOrigins_(hit.name),
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
          var name = drag.target.name;
          if ( this.lastModifier_ ) {
            var sel = Object.assign({}, this.selection_);
            if ( sel[name] ) {
              delete sel[name];
            } else if ( drag.target.block ) {
              sel[name] = drag.target.block;
            }
            this.selection_ = sel;
          } else {
            var sel2 = {};
            if ( drag.target.block ) sel2[name] = drag.target.block;
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

    function toggleExpanded_(name, collapsed) {
      var next = Object.assign({}, this.expanded_);
      if ( collapsed ) next[name] = true; else delete next[name];
      this.expanded_ = next;
    },

    function applyState_() {
      var self = this;
      var sel = this.selection_ || {};
      var soft = this.softSelected;
      var focusSet = this.focusSet_;

      Object.keys(this.nodeViews_).forEach(function(name) {
        var cv = self.nodeViews_[name];
        cv.isSelected = !! sel[name];
        cv.isDependent = !! soft && soft !== cv.block && ( soft.dependencies || [] ).indexOf(name) !== -1;
        cv.dimmed = !! focusSet && ! focusSet[name];
      });

      this.edgeViews_.forEach(function(e) {
        var srcBlock = self.blockOf_(e.source);
        var dstBlock = self.blockOf_(e.target);
        e.view.active = !! soft && ( soft === srcBlock || soft === dstBlock );
        e.view.selectedEdge = !! ( sel[e.source] || sel[e.target] );
        e.view.dimmed = !! focusSet && ! ( focusSet[e.source] && focusSet[e.target] );
      });
    },

    function withDescendants_(names) {
      /** names plus every block nested (at any depth) inside those that are containers. */
      var nodes = this.nodes_ || [];
      var out = {};
      var queue = names.slice();
      while ( queue.length ) {
        var n = queue.shift();
        if ( out[n] ) continue;
        out[n] = true;
        nodes.forEach(function(x) { if ( x.parent === n ) queue.push(x.name); });
      }
      return Object.keys(out);
    },

    function withAncestors_(names) {
      /** names plus the containers holding them, up to the root. */
      var byName = {};
      ( this.nodes_ || [] ).forEach(function(n) { byName[n.name] = n; });
      var out = {};
      names.forEach(function(n) {
        for ( var cur = n ; cur && ! out[cur] ; cur = byName[cur] && byName[cur].parent ) out[cur] = true;
      });
      return Object.keys(out);
    },

    function containerNames_() {
      /** Every layout container in the flow, whether or not it is currently shown expanded. */
      var out = {};
      ( this.graph && this.graph.nodes || [] ).forEach(function(n) { if ( n.parent ) out[n.parent] = true; });
      return Object.keys(out);
    },

    function isContainer_(name) {
      return ( this.nodes_ || [] ).some(function(n) { return n.parent === name; });
    },

    function connectedSet_(names, edges) {
      /** names plus their dependency chain: everything upstream (followed
          against edge direction) and everything downstream (along it).
          Siblings that merely share a source are not included. */
      var down = {}, up = {};
      ( edges || [] ).forEach(function(e) {
        ( down[e.source] = down[e.source] || [] ).push(e.target);
        ( up[e.target]   = up[e.target]   || [] ).push(e.source);
      });
      var seen = {};
      names.forEach(function(n) { seen[n] = true; });
      [ down, up ].forEach(function(adj) {
        var queue = names.slice();
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

    function blockOf_(name) {
      var n = ( this.nodes_ || [] ).find(function(x) { return x.name === name; });
      return n ? n.block : null;
    },

    function selectedRoots_() {
      /** Selected nodes, minus any whose ancestor is also selected. */
      var self = this;
      var byName = {};
      ( this.nodes_ || [] ).forEach(function(n) { byName[n.name] = n; });

      function hasSelectedAncestor(name) {
        var n = byName[name];
        while ( n && n.parent ) {
          if ( self.selection_[n.parent] ) return true;
          n = byName[n.parent];
        }
        return false;
      }

      return Object.keys(this.selection_ || {})
        .filter(function(name) { return ! hasSelectedAncestor(name); })
        .map(function(name) { return byName[name]; })
        .filter(function(n) { return !! n; });
    },

    function snapshotOrigins_(fallbackName) {
      /** flowName -> {x,y} for every currently-selected node, plus every descendant of a selected container. */
      var self = this;
      var names = Object.keys(this.selection_ || {});
      if ( ! names.length && fallbackName ) names = [ fallbackName ];

      var result = {};
      function addWithDescendants(name) {
        var cv = self.nodeViews_[name];
        if ( cv && ! result[name] ) result[name] = { x: cv.x, y: cv.y };
        ( self.nodes_ || [] ).forEach(function(n) {
          if ( n.parent === name ) addWithDescendants(n.name);
        });
      }
      names.forEach(addWithDescendants);
      return result;
    },

    function revealPending_() {
      var name = this.reveal_;
      if ( ! name ) return;
      var block = this.blockOf_(name);
      var cv = this.nodeViews_[name];
      var s = this.sizes_[name];
      if ( ! block || ! cv || ! s ) return;
      this.reveal_ = '';
      var sel = {};
      sel[name] = block;
      this.selection_ = sel;
      // Focused: the rebuild already framed the chain. Otherwise bring the block to the middle.
      if ( ! this.focusRoot_ ) this.scene_.centerOn(cv.x + s[0] / 2, cv.y + s[1] / 2, 1);
    },

    function kindOf(node) {
      var cls = node.cls || '';
      var DAO = [
        'foam.core.reflow.DAOPrompt', 'foam.core.reflow.DAOFilterPrompt',
        'foam.core.reflow.DAOCreate', 'foam.core.reflow.Upload', 'foam.core.reflow.Mapping'
      ];
      var SCRIPT = [
        'foam.core.reflow.Script', 'foam.core.reflow.BadBlock', 'foam.core.reflow.float.Test'
      ];
      var INPUT = [
        'foam.core.reflow.Prompt',
        'foam.core.reflow.cmd.Button.FlowAction',
        'foam.core.reflow.cmd.Buttons.FlowActionArrayHolder'
      ];
      var DOC = [
        'foam.core.reflow.Markdown', 'foam.core.reflow.Header',
        'foam.core.reflow.Image', 'foam.core.reflow.Link', 'foam.core.reflow.Doc'
      ];
      var TRANSFORM = [
        'foam.core.reflow.Pivot', 'foam.core.reflow.GridBy', 'foam.core.reflow.cells.Cells'
      ];

      if ( DAO.indexOf(cls) !== -1 ) return 'dao';
      if ( SCRIPT.indexOf(cls) !== -1 ) return 'script';
      if ( INPUT.indexOf(cls) !== -1 ) return 'input';
      if ( DOC.indexOf(cls) !== -1 ) return 'doc';
      if ( TRANSFORM.indexOf(cls) !== -1 ) return 'transform';

      var shortName = cls.split('.').pop() || '';
      if ( /Transform$/.test(shortName) ) return 'transform';
      if ( /Holder$/.test(shortName) && cls.indexOf('foam.lang.') === 0 ) return 'doc';

      return 'other';
    },

    function summaryOf(node) {
      /** node: one entry of graph.nodes ({name,cmd,cls,parent,depth,block}). Never throws. */
      function trunc(s) {
        s = String(s == null ? '' : s);
        return s.length > 60 ? s.slice(0, 59) + '…' : s;
      }
      function firstLine(s) {
        var lines = String(s || '').split('\n');
        for ( var i = 0 ; i < lines.length ; i++ ) {
          if ( lines[i].trim() ) return lines[i].trim();
        }
        return '';
      }

      var block = node.block;
      if ( ! block ) return [ trunc(node.cmd) ];

      var lines = [];
      try {
        var value = block.value;
        var cls = value && value.cls_ && value.cls_.id;

        if ( cls === 'foam.core.reflow.DAOPrompt' ) {
          lines.push(trunc(block.cmd));
          if ( value.aql ) {
            lines.push(trunc(value.aql));
          } else if ( value.where ) {
            lines.push(trunc(value.where));
          }
          if ( value.filters && value.filters.length ) lines.push(value.filters.length + ' filters');
          if ( value.select ) {
            var selName = ( value.select.cls_ && value.select.cls_.name ) || '';
            lines.push(trunc(selName + ( value.limit ? ' limit ' + value.limit : '' )));
          }
        } else if ( value && value.cls_ && value.cls_.getAxiomByName && value.cls_.getAxiomByName('daoKey') ) {
          if ( value.daoKey ) lines.push(trunc(value.daoKey));
          if ( value.calculations ) lines.push(value.calculations.length + ' calcs');
          if ( value.joins ) lines.push(value.joins.length + ' joins');
        } else if ( cls === 'foam.core.reflow.Script' ) {
          lines.push(trunc(firstLine(value.code) + ( value.autoRun ? ' · auto' : '' )));
        } else if ( cls === 'foam.core.reflow.Prompt' ) {
          lines.push(trunc(( value.label || '' ) + ': ' + ( value.value != null ? value.value : '' )));
          if ( value.type ) lines.push(trunc(value.type));
        } else if ( cls === 'foam.core.reflow.Markdown' ) {
          lines.push(trunc(firstLine(value.markdown)));
        } else if ( cls === 'foam.core.reflow.Header' ) {
          lines.push(trunc(( value.type || '' ) + ' ' + ( value.text || '' )));
        } else if ( cls === 'foam.core.reflow.cmd.Button.FlowAction' ) {
          lines.push(trunc(value.label));
          lines.push(trunc(firstLine(value.script)));
        } else if ( cls === 'foam.core.reflow.cmd.Buttons.FlowActionArrayHolder' ) {
          lines.push(( value.actions || [] ).length + ' buttons');
        } else if ( block.flowChildren && block.flowChildren.length ) {
          lines.push(block.flowChildren.length + ' blocks');
        } else {
          lines.push(trunc(block.cmd));
        }
      } catch (e) {
        lines = [ trunc(block.cmd) ];
      }

      return lines.filter(function(l) { return !! l; }).slice(0, 4);
    },

    function fitToNodes_() {
      var self = this;
      var bounds = null;
      ( this.nodes_ || [] ).forEach(function(n) {
        if ( n.parent ) return;
        var cv = self.nodeViews_[n.name];
        var s = self.sizes_[n.name];
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
      // left out). Drop the focus if the block is gone.
      if ( this.focusRoot_ && ! nodes.some(function(n) { return n.name === self.focusRoot_; }) ) {
        this.focusRoot_ = '';
      }
      if ( this.focusRoot_ ) {
        var keep = this.connectedSet_([ this.focusRoot_ ], edges);
        nodes = nodes.filter(function(n) { return keep[n.name]; })
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
        nodes.forEach(function(n) { if ( n.parent ) parentOfAll[n.name] = n.parent; });
        var rep = function(name) {
          var top = name;
          for ( var p = parentOfAll[name] ; p ; p = parentOfAll[p] ) {
            if ( ! self.expanded_[p] ) top = p;
          }
          return top;
        };
        nodes = nodes.filter(function(n) { return rep(n.name) === n.name; });
        edges = edges
          .map(function(e) { return Object.assign({}, e, { source: rep(e.source), target: rep(e.target) }); })
          .filter(function(e) { return e.source !== e.target; });
      }
      this.nodes_ = nodes;

      var sig = JSON.stringify({
        f: this.focusRoot_,
        x: Object.keys(this.expanded_).sort(),
        n: nodes.map(function(n) { return [ n.name, n.parent, n.cls ]; }),
        e: edges.map(function(e) { return [ e.source, e.target, e.kind ]; })
      });

      if ( sig === this.signature_ ) {
        nodes.forEach(function(n) {
          var nv = self.nodeViews_[n.name];
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
        data[n.name] = self.GraphNode.create({ id: n.name, data: n });
        if ( n.parent ) {
          parentOf[n.name] = n.parent;
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
        var isContainer = !! containerNames[n.name];
        var hasIn  = graphModel.data[n.name].inverseLinks.length > 0;
        var hasOut = graphModel.data[n.name].forwardLinks.length > 0;

        if ( isContainer ) {
          var ccv = self.GraphContainerCView.create({
            block: n.block,
            name: n.name,
            collapsed: false,
            childCount: ( n.block && n.block.flowChildren || [] ).length,
            theme: self.theme_,
            hasIn: hasIn,
            hasOut: hasOut
          });
          self.nodeViews_[n.name] = ccv;
          self.scene_.containers.add(ccv);
          // Its width/height are set once placeScope_ has measured its children.
        } else if ( hasChildren[n.name] ) {
          // A collapsed layout: its own card shape at card size, children hidden.
          var col = self.GraphContainerCView.create({
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
          self.nodeViews_[n.name] = col;
          self.scene_.nodes.add(col);
          self.sizes_[n.name] = [ self.NODE_W, self.COLLAPSED_H ];
        } else {
          var summary = self.summaryOf(n);
          var ncv = self.GraphNodeCView.create({
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
          self.nodeViews_[n.name] = ncv;
          self.scene_.nodes.add(ncv);
          self.sizes_[n.name] = [ self.NODE_W, self.GraphNodeCView.heightFor(summary.length) ];

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
        ( childrenByParent[p] = childrenByParent[p] || [] ).push(n.name);
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
        this.reveal_ = b.flowName;
        // A block outside the focused chain cannot be shown while focused.
        if ( this.focusRoot_ && ! this.blockOf_(b.flowName) ) {
          this.focusRoot_ = '';
          return;
        }
        if ( this.visible && this.nodeViews_[b.flowName] ) this.revealPending_();
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
          var text = await this.paste();
          var names = await this.pasteBlocks(text);
          var sel = {};
          names.forEach(function(n) {
            var b = self.findFlowChildByName(n);
            if ( b ) sel[n] = b;
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
            if ( b ) sel[n] = b;
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
        var self = this;
        var roots = this.selectedRoots_();
        if ( ! roots.length ) return false;

        var doDelete = function() {
          roots.forEach(function(n) { if ( n.block ) n.block.del(); });
        };

        var lockedRoots = roots.filter(function(n) { return n.block && n.block.locked; });
        if ( lockedRoots.length ) {
          var body = this.DELETE_LOCKED_BODY + lockedRoots.map(function(n) {
            return n.name + ' (' + ( n.block.dependencies || [] ).join(', ') + ')';
          }).join('; ');

          // Keyboard shortcuts bypass ActionView, so the confirmation is raised here.
          this.ctrl.add(this.ConfirmationModal.create({
            title: this.DELETE_LOCKED_TITLE,
            modalStyle: 'DESTRUCTIVE',
            primaryAction: foam.lang.Action.create({
              name: 'confirm', label: this.DELETE_CONFIRM, code: function() { doDelete(); }
            }),
            secondaryAction: foam.lang.Action.create({
              name: 'cancel', label: this.DELETE_CANCEL, code: function() {}
            })
          }).add(body));
        } else {
          doDelete();
        }
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
          if ( n.block ) sel[n.name] = n.block;
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
        var names = Object.keys(selection_ || {});
        return names.length === 1 && ! this.isContainer_(names[0]);
      },
      code: function() {
        var names = Object.keys(this.selection_ || {});
        if ( names.length !== 1 || this.isContainer_(names[0]) ) return false;
        this.focusRoot_ = names[0];
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
