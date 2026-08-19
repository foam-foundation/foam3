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
    { name: 'TOOLTIP', message: 'Drag to Resize' }
  ],

  constants: [
    {
      type: 'Int',
      name: 'EDGE_AUTO_GROW_ZONE',
      value: 32
    },
    {
      type: 'Int',
      name: 'EDGE_AUTO_GROW_STEP',
      value: 6
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
    ['autoGrowExtra_', 0],
    ['autoGrowing_', false]
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
            .callIf(isFirstLevelProperty && prop.sortable, function() {
              var currArrow = view.restingIcon;
              this.on('click', function(e) {
                view.sortBy(prop);
              }).
              callIf(prop.label !== '', function() {
                this.start()
                  .start('img')
                    .style({ 'max-width': 'initial' })
                    .attr('src', this.slot(function(view$order) {
                      var order = view$order;
                      if ( prop === order ) {
                        currArrow = view.ascIcon;
                      } else {
                        if ( view.Desc.isInstance(order) && order.arg1 === prop )
                        currArrow = view.descIcon;
                      }
                      return currArrow;
                    }, view.order$))
                  .end()
                .end();
              });
            })
        .end()
        .startContext({data: this})
          .start(this.DRAG_TO_RESIZE, { buttonStyle: 'TERTIARY', themeIcon: 'drag', size: 'SMALL' })
            .addClass(this.data.myClass('resizeButton'))
            .enableClass(this.data.myClass('resizeCursor'), this.showResize$)
            .on('pointerdown', self.pointerDown)
            .on('pointermove', self.pointerMove)
            .on('pointerup', self.pointerUp)
            .on('pointercancel', self.pointerUp)
            .show(this.showResize$)
          .end()
        .endContext();

      // Keep the col-resize cursor for the whole table while a drag is live —
      // with pointer capture the cursor otherwise follows whatever element
      // the pointer happens to be over. Subscribed on this header's lifetime,
      // not the wrapper's, so recreated headers don't accumulate subs.
      if ( view.tableEl_ ) {
        this.onDetach(this.isDragging_$.sub(function() {
          view.tableEl_.enableClass(view.myClass('resizing'), self.isDragging_);
        }));
      }
    },

    function updateDragWidth() {
      var w = this.oldCW_ + ( this.lastPointerX_ - this.oldX_ ) + this.autoGrowExtra_;
      this.colWidth = Math.max(w, this.data.MIN_COLUMN_WIDTH_FALLBACK);
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
        if ( evt.button !== 0 ) return;
        this.isDragging_    = true;
        this.oldX_          = evt.clientX;
        this.lastPointerX_  = evt.clientX;
        this.oldCW_         = this.colWidth || this.data.MIN_COLUMN_WIDTH_FALLBACK;
        this.autoGrowExtra_ = 0;
        evt.currentTarget.setPointerCapture(evt.pointerId);
        // Also suppresses text selection while dragging.
        evt.preventDefault();
      }
    },
    {
      name: 'pointerMove',
      code: function(evt) {
        if ( ! this.isDragging_ ) return;
        this.lastPointerX_ = evt.clientX;
        this.updateDragWidth();
        // The pointer can't travel past the right edge of the table/window,
        // so a column ending near that edge (typically the last one) could
        // otherwise only be widened by a few pixels per drag. While the
        // pointer is parked in the edge zone, keep growing the column on a
        // frame timer and scroll the wrapper to keep the handle in view.
        if ( ! this.autoGrowing_ && this.inEdgeZone_() ) {
          this.autoGrowing_ = true;
          window.requestAnimationFrame(this.autoGrowTick);
        }
      }
    },
    {
      name: 'pointerUp',
      code: function(evt) {
        if ( ! this.isDragging_ ) return;
        this.isDragging_ = false;
        this.showResize = false;
      }
    },
    {
      name: 'autoGrowTick',
      code: function() {
        if ( ! this.isDragging_ || ! this.inEdgeZone_() ) {
          this.autoGrowing_ = false;
          return;
        }
        this.autoGrowExtra_ += this.EDGE_AUTO_GROW_STEP;
        this.updateDragWidth();
        var wrapper = this.data.tableEl_ && this.data.tableEl_.el_();
        if ( wrapper ) wrapper.scrollLeft += this.EDGE_AUTO_GROW_STEP;
        window.requestAnimationFrame(this.autoGrowTick);
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
