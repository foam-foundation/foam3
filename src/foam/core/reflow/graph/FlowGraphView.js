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

    Not a Controller: Controller exports 'as data', which would shadow the
    Console's own 'data' import used elsewhere in the Reflow Blocks.
  `,

  requires: [
    'foam.graph.Graph',
    'foam.graph.GraphNode',
    'foam.graph.map2d.LayeredGridPlacementStrategy',
    'foam.u2.svg.Position',
    'foam.u2.svg.RelativePosition',
    'foam.u2.svg.arrow.BezierArrowLine',
    'foam.u2.svg.interactive.Draggable',
    'foam.u2.svg.interactive.PanZoomViewport',
    'foam.core.reflow.graph.GraphNodeView',
    'foam.core.reflow.graph.GraphContainerView',
    'foam.u2.dialog.ConfirmationModal'
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
      --fg-canvas: $backgroundSecondary;
      --fg-grid-dot: $grey300;
      --fg-node-bg: $backgroundDefault;
      --fg-node-border: $borderDefault;
      --fg-text: $textDefault;
      --fg-text-muted: $textSecondary;
      --fg-edge: $grey500;
      --fg-edge-active: $primary500;
      --fg-selected: $primary400;
      --fg-dependent: $orange400;
      --fg-error: $destructive400;
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      min-height: 0;
      background: var(--fg-canvas);
      outline: none;
      user-select: none;
    }
    ^:focus-visible { outline: 2px solid var(--fg-selected); outline-offset: -2px; }
    ^toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      color: var(--fg-text-muted);
    }
    ^preview-toggle { margin-left: auto; }
    ^viewport { flex: 1; min-height: 0; }
    ^grid-dot { fill: var(--fg-grid-dot); }
    ^edge path, ^edge line { stroke: var(--fg-edge); stroke-width: 2; }
    ^edge.foam-u2-svg-arrow-BezierArrowLine-reaction path { stroke-dasharray: 6 4; }
    ^edge.foam-u2-svg-arrow-BezierArrowLine-script path { stroke-dasharray: 2 3; }
    ^edge-active path, ^edge-active line { stroke: var(--fg-edge-active); stroke-width: 3; }
    ^edge-selected path, ^edge-selected line { stroke: var(--fg-selected); stroke-width: 3; }
    ^port { fill: var(--fg-node-border); }
    ^port-active { fill: var(--fg-edge); }
    ^marquee { fill: $primary400; fill-opacity: 0.15; stroke: $primary400; }
    ^node, ^edge { transition: opacity 150ms; }
    ^dimmed { opacity: 0.2; }
    ^edge-dimmed { opacity: 0.15; }
    ^band-line { stroke: var(--fg-node-border); stroke-dasharray: 6 6; }
    ^band-label { fill: var(--fg-text-muted); }
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
    { name: 'viewport_', hidden: true, transient: true },
    { name: 'containersLayer_', hidden: true, transient: true },
    { name: 'edgesLayer_', hidden: true, transient: true },
    { name: 'nodesLayer_', hidden: true, transient: true },
    { name: 'marqueeLayer_', hidden: true, transient: true },
    { name: 'draggables_', hidden: true, transient: true, factory: function() { return {}; } },
    { name: 'nodeViews_', hidden: true, transient: true, factory: function() { return {}; } },
    { name: 'containerViews_', hidden: true, transient: true, factory: function() { return {}; } },
    { name: 'sizes_', hidden: true, transient: true, factory: function() { return {}; } },
    { class: 'String', name: 'signature_', hidden: true, transient: true },
    { name: 'marquee_', hidden: true, transient: true },
    { name: 'dragOrigins_', hidden: true, transient: true, factory: function() { return {}; } },
    {
      name: 'gridPatternId_',
      hidden: true,
      transient: true,
      factory: function() { return 'fg-dots-' + foam.next$UID(); }
    },
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
        .start('span').add(this.slot(function(viewport_$zoom) {
          return Math.round(( viewport_$zoom || 1 ) * 100) + '%';
        })).end()
        .start('span').add(this.ZOOM_HINT).end()
        .startContext({ data: this }).tag(this.FOCUS_SELECTION).tag(this.UNFOCUS).tag(this.EXPAND_ALL).tag(this.COLLAPSE_ALL).endContext()
        .start(foam.u2.CheckBox, { data$: this.preview$, label: this.PREVIEW_LABEL }).addClass(this.myClass('preview-toggle')).end()
        .start('span').add(this.focusRoot_$.map(function(r) { return r ? self.FOCUS_PREFIX + r : ''; })).end()
      .end();

      this.viewport_ = this.start(this.PanZoomViewport).addClass(this.myClass('viewport'));

      var defs = this.viewport_.start('defs');
      var pattern = defs.start('pattern').attrs({
        id: this.gridPatternId_,
        patternUnits: 'userSpaceOnUse',
        width: 24,
        height: 24
      });
      pattern.start('circle').addClass(this.myClass('grid-dot')).attrs({ cx: 12, cy: 12, r: 1 }).end();

      this.viewport_.start('rect')
        .addClass(this.myClass('grid'))
        .attrs({ x: -1e5, y: -1e5, width: 2e5, height: 2e5, fill: 'url(#' + this.gridPatternId_ + ')' })
        .attr('pointer-events', 'none')
      .end();

      this.containersLayer_ = this.viewport_.start('g');
      this.edgesLayer_      = this.viewport_.start('g');
      this.nodesLayer_      = this.viewport_.start('g');
      this.marqueeLayer_    = this.viewport_.start('g');

      this.setupMarquee_();

      if ( this.graph ) this.rebuild();
    },

    function setupMarquee_() {
      // Plain DOM listeners via .on(): these die with the viewport element
      // itself (a child of this view), same as PanZoomViewport's and
      // Draggable's own un-wrapped .on() calls in their render() -- no
      // onDetach needed here. onDetach is reserved below for the actual
      // FOAM Slot .sub() topic subscriptions (dragStart/drag/dragEnd),
      // which do not have any DOM lifecycle of their own.
      var self = this;
      var vp = this.viewport_;
      var marqueeEl = null;
      var start = null;

      vp.on('pointerdown', function(evt) {
        if ( ! evt.shiftKey || evt.button !== 0 ) return;
        if ( evt.target !== vp.background_.el_() ) return;
        evt.preventDefault();
        vp.el_().setPointerCapture(evt.pointerId);
        start = vp.clientToUser(evt.clientX, evt.clientY);
        self.marquee_ = { x: start.x, y: start.y, width: 0, height: 0 };
        marqueeEl = self.marqueeLayer_.start('rect')
          .addClass(self.myClass('marquee'))
          .attrs({ x: start.x, y: start.y, width: 0, height: 0 });
      });

      vp.on('pointermove', function(evt) {
        if ( ! marqueeEl || ! start ) return;
        var p = vp.clientToUser(evt.clientX, evt.clientY);
        var box = {
          x: Math.min(start.x, p.x),
          y: Math.min(start.y, p.y),
          width: Math.abs(p.x - start.x),
          height: Math.abs(p.y - start.y)
        };
        self.marquee_ = box;
        marqueeEl.attrs({ x: box.x, y: box.y, width: box.width, height: box.height });
      });

      vp.on('pointerup', function(evt) {
        if ( ! marqueeEl ) return;
        var box = self.marquee_;
        marqueeEl.remove();
        marqueeEl = null;
        start = null;
        self.marquee_ = null;
        if ( ! box || ( box.width < 2 && box.height < 2 ) ) return;

        var hits = {};
        Object.keys(self.draggables_).forEach(function(name) {
          var d = self.draggables_[name];
          var s = self.sizes_[name] || [ self.NODE_W, 40 ];
          var nx0 = d.pos.x, ny0 = d.pos.y, nx1 = nx0 + s[0], ny1 = ny0 + s[1];
          var intersects = nx0 < box.x + box.width && nx1 > box.x &&
                           ny0 < box.y + box.height && ny1 > box.y;
          if ( ! intersects ) return;
          var b = self.blockOf_(name);
          if ( b ) hits[name] = b;
        });

        self.selection_ = ( evt.ctrlKey || evt.metaKey ) ?
          Object.assign({}, self.selection_, hits) :
          hits;
      });
    },

    function decorateNode_(dragEl, name) {
      dragEl.addClass(this.myClass('node'));
      dragEl.enableClass(this.myClass('dimmed'), this.focusSet_$.map(function(f) { return !! f && ! f[name]; }));
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
        var d = self.draggables_[name];
        if ( d && ! result[name] ) result[name] = { x: d.pos.x, y: d.pos.y };
        ( self.nodes_ || [] ).forEach(function(n) {
          if ( n.parent === name ) addWithDescendants(n.name);
        });
      }
      names.forEach(addWithDescendants);
      return result;
    },

    function wireDrag_(dragEl, node) {
      var self = this;

      dragEl.on('pointerenter', function() { self.softSelected = node.block; });
      dragEl.on('pointerleave', function() { self.softSelected = null; });
      dragEl.on('dblclick', function() {
        self.data.graphMode = false;
        self.selectFromTree(node.block);
      });
      dragEl.on('pointerdown', function(evt) {
        self.lastModifier_ = evt.shiftKey || evt.ctrlKey || evt.metaKey;
      });

      dragEl.onDetach(dragEl.dragStart.sub(function() {
        if ( ! self.selection_[node.name] && ! self.lastModifier_ ) {
          var sel = {};
          if ( node.block ) sel[node.name] = node.block;
          self.selection_ = sel;
        }
        self.dragOrigins_ = self.snapshotOrigins_(node.name);
      }));

      dragEl.onDetach(dragEl.drag.sub(function(_, __, dx, dy) {
        var origins = self.dragOrigins_;
        Object.keys(origins).forEach(function(name) {
          var d = self.draggables_[name];
          if ( ! d ) return;
          d.pos.x = origins[name].x + dx;
          d.pos.y = origins[name].y + dy;
        });
      }));

      dragEl.onDetach(dragEl.dragEnd.sub(function(_, __, moved) {
        if ( ! moved ) {
          if ( self.lastModifier_ ) {
            var sel = Object.assign({}, self.selection_);
            if ( sel[node.name] ) {
              delete sel[node.name];
            } else if ( node.block ) {
              sel[node.name] = node.block;
            }
            self.selection_ = sel;
          } else {
            var sel2 = {};
            if ( node.block ) sel2[node.name] = node.block;
            self.selection_ = sel2;
          }
        }
        self.selectingFromGraph_ = true;
        self.selected = node.block;
        self.selectingFromGraph_ = false;
      }));
    },

    function revealPending_() {
      var name = this.reveal_;
      if ( ! name ) return;
      var block = this.blockOf_(name);
      var d = this.draggables_[name];
      var s = this.sizes_[name];
      if ( ! block || ! d || ! s ) return;
      this.reveal_ = '';
      var sel = {};
      sel[name] = block;
      this.selection_ = sel;
      // Focused: the rebuild already framed the chain. Otherwise bring the block to the middle.
      if ( ! this.focusRoot_ ) this.viewport_.centerOn(d.pos.x + s[0] / 2, d.pos.y + s[1] / 2, 1);
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
        var d = self.draggables_[n.name];
        var s = self.sizes_[n.name];
        if ( ! d || ! s ) return;
        var x0 = d.pos.x, y0 = d.pos.y, x1 = x0 + s[0], y1 = y0 + s[1];
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
      this.viewport_.fit({
        x: bounds.x0, y: bounds.y0,
        width: bounds.x1 - bounds.x0, height: bounds.y1 - bounds.y0
      });
      // Fitting a small graph must not blow the cards up past their natural size.
      if ( this.viewport_.zoom > 1 ) {
        this.viewport_.centerOn(( bounds.x0 + bounds.x1 ) / 2, ( bounds.y0 + bounds.y1 ) / 2, 1);
      }
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
          innerBbox.height + 2 * self.CONTAINER_PAD + self.GraphContainerView.HEADER_HEIGHT
        ];
        self.sizes_[name] = size;
        var cv = self.containerViews_[name];
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
          var drag = self.draggables_[m.name];
          drag.pos.x = colX[L3];
          drag.pos.y = y;
          if ( containerNames[m.name] ) {
            self.placeScope_(m.name, plan, childrenByParent, containerNames, {
              x: colX[L3] + self.CONTAINER_PAD,
              y: y + self.CONTAINER_PAD + self.GraphContainerView.HEADER_HEIGHT
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
        var drag = self.draggables_[name];
        drag.pos.x = bx;
        drag.pos.y = by;
        if ( containerNames[name] ) {
          self.placeScope_(name, plan, childrenByParent, containerNames, {
            x: bx + self.CONTAINER_PAD,
            y: by + self.CONTAINER_PAD + self.GraphContainerView.HEADER_HEIGHT
          });
        }
        bx += size[0] + self.GAP_X;
        rowH = Math.max(rowH, size[1]);
        bandWidth = Math.max(bandWidth, bx - self.GAP_X - origin.x);
      });
      var width = Math.max(gridWidth, bandWidth);

      if ( scopeId === null && members.length ) {
        var lineY = bandTop - self.BAND_GAP / 2;
        self.containersLayer_.start('g')
          .start('line').addClass(self.myClass('band-line'))
            .attrs({ x1: origin.x, y1: lineY, x2: origin.x + width, y2: lineY })
          .end()
          .start('text').addClass(self.myClass('band-label'), 'p-xs')
            .attrs({ x: origin.x, y: lineY - 8 })
            .add(self.UNLINKED_LABEL)
          .end()
        .end();
      }

      return { x: origin.x, y: origin.y, width: width, height: by + rowH - origin.y };
    },

    async function rebuild() {
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
          if ( nv ) nv.summary_ = self.summaryOf(n);
        });
        return;
      }
      this.signature_ = sig;

      this.containersLayer_.removeAllChildren();
      this.edgesLayer_.removeAllChildren();
      this.nodesLayer_.removeAllChildren();
      this.draggables_ = {};
      this.nodeViews_ = {};
      this.containerViews_ = {};
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

      // Create a Draggable + view for every node.
      nodes.forEach(function(n) {
        var isContainer = !! containerNames[n.name];
        if ( isContainer ) {
          var cdrag = self.containersLayer_.start(self.Draggable, { pos: self.Position.create() });
          self.decorateNode_(cdrag, n.name);
          self.draggables_[n.name] = cdrag;
          self.containerViews_[n.name] = cdrag.start(self.GraphContainerView, {
            data: n.block,
            childCount: ( n.block && n.block.flowChildren || [] ).length,
            isSelected$: self.selection_$.map(function(m) { return !! m[n.name]; }),
            isDependent$: self.softSelected$.map(function(s) {
              return !! s && s !== n.block && ( s.dependencies || [] ).indexOf(n.name) !== -1;
            })
          });
          self.wireDrag_(cdrag, n);
          var cv = self.containerViews_[n.name];
          cv.onDetach(cv.toggle.sub(function() {
            var next = Object.assign({}, self.expanded_);
            delete next[n.name];
            self.expanded_ = next;
          }));
        } else {
          var drag = self.nodesLayer_.start(self.Draggable, { pos: self.Position.create() });
          self.decorateNode_(drag, n.name);
          self.draggables_[n.name] = drag;
          var isSelected$ = self.selection_$.map(function(m) { return !! m[n.name]; });
          var isDependent$ = self.softSelected$.map(function(s) {
            return !! s && s !== n.block && ( s.dependencies || [] ).indexOf(n.name) !== -1;
          });
          if ( hasChildren[n.name] ) {
            // A collapsed layout: its own box shape at card size, children hidden.
            self.containerViews_[n.name] = drag.start(self.GraphContainerView, {
              data: n.block,
              collapsed: true,
              width: self.NODE_W,
              height: self.COLLAPSED_H,
              childCount: ( n.block && n.block.flowChildren || [] ).length,
              isSelected$: isSelected$,
              isDependent$: isDependent$
            });
            self.sizes_[n.name] = [ self.NODE_W, self.COLLAPSED_H ];
          } else {
            self.nodeViews_[n.name] = drag.start(self.GraphNodeView, {
              data: n.block,
              summary_: self.summaryOf(n),
              kind: self.kindOf(n),
              isSelected$: isSelected$,
              isDependent$: isDependent$
            });
          }
          drag.start('circle')
            .addClass(self.myClass('port'))
            .enableClass(self.myClass('port-active'), graphModel.data[n.name].inverseLinks.length > 0)
            .attrs({ cx: 0, cy: self.PORT_Y, r: 5 })
          .end();
          drag.start('circle')
            .addClass(self.myClass('port'))
            .enableClass(self.myClass('port-active'), graphModel.data[n.name].forwardLinks.length > 0)
            .attrs({ cx: self.NODE_W, cy: self.PORT_Y, r: 5 })
          .end();
          self.wireDrag_(drag, n);
          if ( hasChildren[n.name] ) {
            var ccv = self.containerViews_[n.name];
            ccv.onDetach(ccv.toggle.sub(function() {
              self.expanded_ = Object.assign({}, self.expanded_, { [n.name]: true });
            }));
          }
        }
      });

      // Measure leaf node heights once the DOM has painted.
      await new Promise(function(r) { requestAnimationFrame(r); });
      nodes.forEach(function(n) {
        if ( containerNames[n.name] ) return;
        var nv = self.nodeViews_[n.name];
        if ( ! nv ) return;
        var el = nv.bodyEl_();
        var h = el ? el.offsetHeight : 40;
        self.sizes_[n.name] = [ self.NODE_W, h ];
        nv.el_().setAttribute('height', h);
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

      // Edges, following the drags automatically via RelativePosition.
      edgeList.forEach(function(e) {
        if ( ! self.draggables_[e.source] || ! self.draggables_[e.target] ) return;
        var srcSize = self.sizes_[e.source] || [ self.NODE_W, 0 ];
        var srcBlock = self.blockOf_(e.source);
        var dstBlock = self.blockOf_(e.target);

        var edgeEl = self.edgesLayer_.start(self.BezierArrowLine, {
          kind: e.kind,
          arrowHead: true,
          startPos: self.RelativePosition.create({
            reference: self.draggables_[e.source].pos,
            amount: self.Position.create({ x: srcSize[0], y: self.PORT_Y })
          }),
          endPos: self.RelativePosition.create({
            reference: self.draggables_[e.target].pos,
            amount: self.Position.create({ x: 0, y: self.PORT_Y })
          })
        });
        edgeEl.addClass(self.myClass('edge'));
        edgeEl.enableClass(self.myClass('edge-selected'), self.selection_$.map(function(m) {
          return !! ( m && ( m[e.source] || m[e.target] ) );
        }));
        edgeEl.enableClass(self.myClass('edge-dimmed'), self.focusSet_$.map(function(f) {
          return !! f && ! ( f[e.source] && f[e.target] );
        }));
        edgeEl.enableClass(self.myClass('edge-active'), self.softSelected$.map(function(s) {
          return !! s && ( s === srcBlock || s === dstBlock );
        }));
        if ( e.fields.length ) edgeEl.start('title').add(e.fields.join(', ')).end();
      });

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
        if ( this.visible && this.draggables_[b.flowName] ) this.revealPending_();
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
