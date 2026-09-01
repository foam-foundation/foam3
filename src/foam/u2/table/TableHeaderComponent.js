/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.table',
  name: 'TableHeaderComponent',
  extends: 'foam.u2.table.TableComponentView',

  imports: [
    'colWidthUpdated?',
    'props',
    'selectedColumnsWidth?'
  ],

  messages: [
    { name: 'TOOLTIP', message: 'Drag to Resize' },
    { name: 'SORT_BY', message: 'Sort by' },
    { name: 'SORTED_ASCENDING', message: 'sorted ascending' },
    { name: 'SORTED_DESCENDING', message: 'sorted descending' }
  ],

  constants: [
    {
      type: 'Int',
      name: 'EDGE_AUTO_GROW_ZONE',
      value: 32
    },
    {
      type: 'Int',
      name: 'EDGE_AUTO_GROW_RATE',
      documentation: 'Auto-grow speed in px per second, independent of display refresh rate.',
      value: 360
    },
    {
      type: 'Int',
      name: 'MAX_TICK_MS',
      documentation: 'Upper bound on one auto-grow frame delta. rAF pauses while the tab is hidden, so an unclamped delta on refocus would apply seconds of growth in one tick.',
      value: 100
    },
    {
      type: 'Int',
      name: 'KEYBOARD_RESIZE_STEP',
      documentation: 'Width change in px per arrow-key press on a focused resize handle; shift multiplies by 5.',
      value: 10
    }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'showResize'
    },
    {
      class: 'Int',
      name: 'colWidth',
      factory: function() {
        return this.selectedColumnsWidth && this.selectedColumnsWidth[this.propName] ?
        this.selectedColumnsWidth[this.propName] :
        this.columnHandler.returnPropertyForColumn(this.props, this.data.of, [this.col, this.overrides], 'tableWidth');
      },
      postSet: function(o, n) {
        this.updateWidths(n);
      }
    },
    {
      name: 'col',
      documentation: 'column name for which header needs to be rendered'
    },
    {
      name: 'overrides',
      documentation: 'overrides to be applied on given column'
    },
    {
      class: 'Boolean',
      name: 'resizeable',
      value: true
    },
    // Used internally to control dragging funcitonality.
    // All these and the listeners can be removed in
    // favour of css `resize: horizontal` if flexbox support is added
    'propName',
    'oldX_',
    'oldCW_',
    ['isDragging_', false],
    'lastPointerX_',
    'lastTickTs_',
    ['autoGrowExtra_', 0],
    ['autoGrowing_', false],
    'pointerId_',
    'overlayEl_',
    'docKeyHandler_'
  ],

  methods: [
    function render() {
      var self = this;
      var view = this.data;
      this.propName = this.columnHandler.propertyNamesForColumnArray(this.col);
      var found = this.props.find(p => p.fullPropertyName === self.propName);
      var prop = found ? found.property : this.data.of.getAxiomByName(self.propName);
      var isFirstLevelProperty = this.columnHandler.canColumnBeTreatedAsAnAxiom(this.col) ? true : this.col.indexOf('.') === -1;
      
      if ( ! prop ) return;

      var colData = this.columnConfigToPropertyConverter.returnColumnHeader(this.data.of, this.col);
      var colHeader = ( colData.colPath.length > 1 ? '../'  : '' ) + ( colData.colLabel || colData.colPath.slice(-1)[0] );
      var colTooltip = colData.colPath.join( '/' );
      this
        .addClass(view.myClass('th'))
        .on('mouseenter', this.onMouseEnter)
        .on('mouseleave', this.onMouseLeave)
        .addClass(view.myClass('th-' + prop.name))
        .style({
          'align-items': 'center',
          display: 'flex',
          flex: this.slot(function(colWidth) {
            return colWidth ? `1 0 ${colWidth}px` : `1 0 ${this.data.MIN_COLUMN_WIDTH_FALLBACK}px`
          }),
          'justify-content': 'space-between',
          'word-wrap': 'break-word'
        })
        .start()
          .style({ display: 'flex',overflow: 'hidden', 'align-items': 'center' })
            .start('', { tooltip: colTooltip })
              .addClass('h600')
              .style({
                overflow: 'hidden',
                'text-overflow': 'ellipsis'
              })
              .add(colHeader)
            .end()
            .callIf(isFirstLevelProperty && prop.sortable, this.addSortAffordance_, [self, prop, colHeader])
        .end()
        .startContext({data: this})
          .start(this.DRAG_TO_RESIZE, { buttonStyle: 'TERTIARY', themeIcon: 'drag', size: 'SMALL' })
            .addClass(this.data.myClass('resizeButton'))
            .enableClass(this.data.myClass('resizeCursor'), this.showResize$)
            .on('pointerdown', self.pointerDown)
            .on('pointermove', self.pointerMove)
            .on('pointerup', self.pointerUp)
            .on('pointercancel', self.pointerUp)
            // Fires instead of pointerup when the capturing element is
            // removed mid-drag (header rebuild on a column change).
            .on('lostpointercapture', self.pointerUp)
            // Keyboard access: reveal on focus, ArrowLeft/ArrowRight resize.
            .on('focus', function() { self.showResize = true; })
            .on('blur', function() { if ( ! self.isDragging_ ) self.showResize = false; })
            .on('keydown', self.onHandleKeyDown)
            // Hidden via opacity, not display, so the handle stays in the
            // tab order and can be revealed by keyboard focus.
            .enableClass(view.myClass('resizeHidden'), this.showResize$, true)
          .end()
        .endContext();

      // A header can be torn down mid-drag (columns_ rebuild); release
      // everything the drag holds.
      this.onDetach(function() { self.endDrag_(); });
    },

    // Called with `this` bound to the element it builds into
    // (foam.lang.Fluent.call/callIf), so the header component arrives as
    // the `self` argument.
    function addSortAffordance_(self, prop, colHeader) {
      // `this`: the header's inner flex row - label and arrow together are
      // the click target.
      var view = self.data;
      // '' whenever another column (or nothing) holds the sort, so a column
      // that loses the sort falls back to the resting arrow instead of
      // keeping the direction it was last sorted by.
      //
      // Built with slot() rather than view.order$.map(): both make an
      // ExpressionSlot subscribed to order$, but slot() also registers it
      // for detach. order$ belongs to the table, which outlives this header,
      // so an unregistered subscription would keep the header and its
      // closures alive for as long as the table lives. The slots derived
      // from this one below need no such registration - they subscribe to
      // sortState$, not to anything the table holds.
      var sortState$ = this.slot(function(order) {
        if ( prop === order ) return 'asc';
        if ( view.Desc.isInstance(order) && order.arg1 === prop ) return 'desc';
        return '';
      }, view.order$);

      this
        .addClass(view.myClass('sortable'))
        // A div carries no semantics of its own: without these the column can
        // only be sorted with a mouse, and a screen reader is never told the
        // header does anything or which way the table is sorted.
        .attrs({ role: 'button', tabindex: 0 })
        .attr('aria-label', sortState$.map(function(s) {
          return self.SORT_BY + ' ' + colHeader +
            ( s === 'asc'  ? ', ' + self.SORTED_ASCENDING  :
              s === 'desc' ? ', ' + self.SORTED_DESCENDING : '' );
        }))
        .on('click', function(e) {
          view.sortBy(prop);
        })
        .on('keydown', function(e) {
          if ( e.key !== 'Enter' && e.key !== ' ' ) return;
          // Space would scroll the table; Enter would re-fire as a click.
          // Kept ahead of the repeat check so a held Space still cannot
          // scroll on the repeats it is about to be ignored for.
          e.preventDefault();
          // A held key auto-repeats keydown and preventDefault does not stop
          // the repeat, so without this, holding Space re-sorts continuously.
          if ( e.repeat ) return;
          view.sortBy(prop);
        })
        .callIf(prop.label !== '', function() {
          this.start()
            .addClass(view.myClass('sortIcon'))
            .enableClass(view.myClass('sortIconActive'), sortState$.map(function(s) { return !! s; }))
            .start('img')
              .style({ 'max-width': 'initial' })
              .attr('src', sortState$.map(function(s) {
                if ( s === 'asc' )  return view.ascIcon;
                if ( s === 'desc' ) return view.descIcon;
                return view.restingIcon;
              }))
            .end()
          .end();
        });
    },

    function updateDragWidth() {
      var w = Math.round(this.oldCW_ + ( this.lastPointerX_ - this.oldX_ ) + this.autoGrowExtra_);
      // Assign only above the fallback, never clamp to it: models configure
      // tableWidth below the fallback, and a clamp would snap those to the
      // fallback on the first pixel of drag and persist it to columnStorage.
      if ( w > this.data.MIN_COLUMN_WIDTH_FALLBACK ) this.colWidth = w;
    },

    function nudgeWidth_(delta) {
      var min  = this.data.MIN_COLUMN_WIDTH_FALLBACK;
      var base = this.colWidth || min;
      // A column configured narrower than the fallback keeps its own floor.
      this.colWidth = Math.max(base + delta, Math.min(base, min));
    },

    function endDrag_() {
      this.isDragging_ = false;
      this.autoGrowing_ = false;
      this.showResize = false;
      if ( this.overlayEl_ ) {
        this.overlayEl_.remove();
        this.overlayEl_ = null;
      }
      if ( this.docKeyHandler_ ) {
        document.removeEventListener('keydown', this.docKeyHandler_);
        this.docKeyHandler_ = null;
      }
    },

    function inEdgeZone_() {
      var limit   = window.innerWidth;
      var wrapper = this.data.tableEl_ && this.data.tableEl_.el_();
      if ( wrapper ) limit = Math.min(limit, wrapper.getBoundingClientRect().right);
      return this.lastPointerX_ >= limit - this.EDGE_AUTO_GROW_ZONE;
    }
  ],

  listeners: [
    {
      name: 'pointerDown',
      code: function(evt) {
        // isDragging_ guard: a second (touch) pointer must not reset the
        // baselines of a drag in progress.
        if ( evt.button !== 0 || this.isDragging_ ) return;
        this.isDragging_    = true;
        this.pointerId_     = evt.pointerId;
        this.oldX_          = evt.clientX;
        this.lastPointerX_  = evt.clientX;
        this.oldCW_         = this.colWidth || this.data.MIN_COLUMN_WIDTH_FALLBACK;
        this.autoGrowExtra_ = 0;
        evt.currentTarget.setPointerCapture(evt.pointerId);
        // Also suppresses text selection while dragging.
        evt.preventDefault();

        // Full-viewport overlay carries the col-resize cursor for the drag's
        // duration: with pointer capture the visible cursor follows the
        // hovered element, and a drag roams outside the table.
        var overlay = document.createElement('div');
        overlay.className = this.data.myClass('drag-overlay');
        document.body.appendChild(overlay);
        this.overlayEl_ = overlay;

        // Escape cancels the drag and restores the width it started with.
        this.docKeyHandler_ = this.onDocKeyDown;
        document.addEventListener('keydown', this.docKeyHandler_);
      }
    },
    {
      name: 'pointerMove',
      code: function(evt) {
        if ( ! this.isDragging_ || evt.pointerId !== this.pointerId_ ) return;
        var dx = evt.clientX - this.lastPointerX_;
        this.lastPointerX_ = evt.clientX;
        this.updateDragWidth();
        // Leftward movement means the user is shrinking — never auto-grow
        // against that, even inside the edge zone (a column straddling the
        // wrapper's right edge STARTS its drag in the zone).
        if ( dx < 0 ) {
          this.autoGrowing_ = false;
          return;
        }
        // The pointer can't travel past the right edge of the table/window,
        // so a column ending near that edge (typically the last one) could
        // otherwise only be widened by a few pixels per drag. While the
        // pointer is parked in the edge zone, keep growing the column on a
        // frame timer and scroll the wrapper to keep the handle in view.
        if ( ! this.autoGrowing_ && dx > 0 && this.inEdgeZone_() ) {
          this.autoGrowing_ = true;
          this.lastTickTs_ = null;
          window.requestAnimationFrame(this.autoGrowTick);
        }
      }
    },
    {
      name: 'pointerUp',
      code: function(evt) {
        if ( ! this.isDragging_ || evt.pointerId !== this.pointerId_ ) return;
        this.endDrag_();
      }
    },
    {
      name: 'autoGrowTick',
      code: function(ts) {
        if ( ! this.isDragging_ || ! this.autoGrowing_ || ! this.inEdgeZone_() ) {
          this.autoGrowing_ = false;
          return;
        }
        // Growth is time-based (px/s scaled by the frame delta), so the
        // speed is the same on any display refresh rate.
        if ( this.lastTickTs_ != null ) {
          var dt   = Math.min(ts - this.lastTickTs_, this.MAX_TICK_MS);
          var grow = this.EDGE_AUTO_GROW_RATE * dt / 1000;
          this.autoGrowExtra_ += grow;
          this.updateDragWidth();
          var wrapper = this.data.tableEl_ && this.data.tableEl_.el_();
          // 'instant' sidesteps the wrapper's scroll-behavior: smooth, which
          // would restart a smooth-scroll animation on every frame's write
          // and rubber-band behind the growth.
          if ( wrapper ) wrapper.scrollBy({ left: grow, behavior: 'instant' });
        }
        this.lastTickTs_ = ts;
        window.requestAnimationFrame(this.autoGrowTick);
      }
    },
    {
      name: 'onDocKeyDown',
      code: function(evt) {
        if ( evt.key !== 'Escape' || ! this.isDragging_ ) return;
        this.colWidth = this.oldCW_;
        this.endDrag_();
      }
    },
    {
      name: 'onHandleKeyDown',
      code: function(evt) {
        if ( this.isDragging_ ) return;
        var step = this.KEYBOARD_RESIZE_STEP * ( evt.shiftKey ? 5 : 1 );
        if ( evt.key === 'ArrowRight' ) {
          this.nudgeWidth_(step);
          evt.preventDefault();
        } else if ( evt.key === 'ArrowLeft' ) {
          this.nudgeWidth_(-step);
          evt.preventDefault();
        } else if ( evt.key === 'Escape' ) {
          evt.target.blur();
        }
      }
    },
    function onMouseEnter() {
      this.showResize = true;
    },
    function onMouseLeave() {
      if ( this.isDragging_ ) return;
      this.showResize = false;
    },
    {
      name: 'updateWidths',
      isFramed: true,
      code: function(width) {
        if ( ! this.selectedColumnsWidth$ || ! this.colWidthUpdated$ ) return;
        this.selectedColumnsWidth[this.propName] = width;
        this.colWidthUpdated = ! this.colWidthUpdated;
      }
    }
  ],
  actions: [
    {
      name: 'DragToResize',
      label: '',
      toolTip: 'Drag to resize',
      isAvailable: function(resizeable) { return resizeable; },
      code: function() {}
    }
  ]
});
