/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowableTree',
  extends: 'foam.u2.View',


  requires: ['foam.u2.CSSTokens'],

  imports: ['moveFlowChild', 'moveFlowChildAfter', 'copyChild', 'selectFromTree'],

  css: `
    ^ {
      width: 100%;
    }
    ^ table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      padding-top: 4px;
    }
    ^ table td {
      display: flex;
      justify-content: space-between;
      padding: 6px 4px 6px 8px;
      align-items: center;
      cursor: pointer;
      border: 1px solid transparent;
      border-radius: $inputBorderRadius;
      transition: all 0.15s ease;
      position: relative;
    }

    ^ table td:hover {
      background: $backgroundSecondary;
    }

    ^ table td .close {
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    ^ table td:hover .close {
      opacity: 1;
    }

    ^ table td .close button {
      padding: 2px;
      border-radius: 2px;
    }

    ^ table td .close button:hover {
      background: $backgroundTertiary;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    ^ table td^selected {
      background: $backgroundBrand !important;
      border-left: 3px solid $borderBrand !important;
      padding-left: 5px !important;
      font-weight: $font-medium;
    }

    ^ table td^selected:hover {
      background: $backgroundBrandSecondary !important;
      color: $textOnBrand !important;
    }

    ^left-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid $borderLight;
      font-weight: $font-medium;
      font-size: 14px;
      background: $backgroundDefault;
    }
    ^header-hint {
      font-size: 11px;
      color: $textSecondary;
      font-weight: normal;
      margin-left: 8px;
    }

    ^icon-holder {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    ^element-row {
      padding: 0;
    }
    ^element-row-content {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    ^element-row-icon {
      color: $textSecondary;
      font-size: 14px;
    }
    ^leaf-node ^element-row-icon {
      opacity: 0.6;
    }
    ^chevron {
      color: $textSecondary;
      font-size: 10px;
      transition: transform 0.15s ease,
                  background 0.15s ease;
      cursor: pointer;
      padding: 2px;
      margin-right: 2px;
      border-radius: 2px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    ^chevron:hover {
      background: $backgroundTertiary;
      color: $textDefault;
    }
    ^chevron-expanded {
      transform: rotate(90deg);
    }
    ^collapsed-children {
      height: 0;
      overflow: hidden;
      opacity: 0;
      transition: all 0.2s ease;
    }
    ^expanded-children {
      height: auto;
      opacity: 1;
      transition: all 0.2s ease;
    }
    ^ table td^moveTarget {
      background: transparent;
      border: 1px solid transparent;
      width: 100%;
      height: 8px;  /* Increased from 4px for easier targeting */
      padding: 0;
      margin: 2px 0;  /* Add some spacing */
      transition: all 0.15s ease;
      position: relative;
    }
    /* Simpler drag/drop visual feedback */
    ^ table td^moveTarget:hover {
      background: $primary50 !important;
      border: 1px solid $borderBrand !important;
    }
    ^ table td.dragging {
      opacity: 0.5;
    }
    ^ table td.dragOver {
      background: $warn50 !important;
      border: 1px solid $warn400 !important;
    }
    ^context-menu {
      position: fixed;
      background: $backgroundDefault;
      border: 1px solid $borderLight;
      border-radius: $inputBorderRadius;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      padding: 4px 0;
      min-width: 120px;
    }
    ^context-menu-item {
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    ^context-menu-item:hover {
      background: $backgroundSecondary;
    }
  `,

  properties: [
    'selected',
    {
      name: 'softSelected'
    },
    {
      class: 'Boolean',
      name: 'isMenuOpen',
      value: true
    },
    'contextMenuData',
    'contextMenuVisible',
    {
      class: 'Map',
      name: 'expandedState',
      factory: function () { return {}; }
    },

    {
      name: 'dragOverElement'
    },
    {
      name: 'dragOverType'
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      // Initialize expanded state for all items (default to true)
      this.initExpandedState(this.data);
    },

    function initExpandedState(node) {
      // Root node is always expanded and cannot be collapsed
      if (!node.flowParent) {
        this.expandedState[node.flowName] = true;
      } else if (this.expandedState[node.flowName] === undefined) {
        // Default to expanded for all other nodes
        this.expandedState[node.flowName] = true;
      }

      // Initialize children
      if (node.flowChildren) {
        node.flowChildren.forEach(child => this.initExpandedState(child));
      }
    },

    function isExpanded(node) {
      // Root node is always expanded
      if (!node.flowParent) return true;
      return this.expandedState[node.flowName] !== false;
    },

    function toggleExpanded(node) {
      // Cannot collapse root node
      if (!node.flowParent) return;

      var currentState = this.expandedState[node.flowName];
      this.expandedState[node.flowName] = currentState === false;
      this.expandedState = { ...this.expandedState }; // Trigger update
    },

    function expandAll() {
      this.setExpandedStateRecursive(this.data, true);
    },

    function collapseAll() {
      this.setExpandedStateRecursive(this.data, false);
    },

    function setExpandedStateRecursive(node, expanded) {
      // Skip root node for collapse
      if (node.flowParent || expanded) {
        this.expandedState[node.flowName] = expanded;
      }

      if (node.flowChildren) {
        node.flowChildren.forEach(child =>
          this.setExpandedStateRecursive(child, expanded));
      }

      this.expandedState = { ...this.expandedState }; // Trigger update
    },

    function renderClosed(e) {
      var self = this;
      e.start().addClass(this.myClass('icon-holder'))
        .startContext({ data: this })
        .tag(this.MENU_CONTROL)
        .endContext()
        .end();
    },

    function renderOpened(e) {
      var self = this;
      e.start().addClass(this.myClass('left-container'))
        .start().addClass(this.myClass('left-header'))
        .start('div').style({ display: 'flex', alignItems: 'center', gap: '8px' })
        .start('span').add('Contents').end()
        .start('span').addClass(this.myClass('header-hint'))
        .add('(click ▶ to expand)')
        .end()
        .end()
        .start('div').style({ display: 'flex', gap: '4px' })
        .startContext({ data: this })
        .tag(this.EXPAND_ALL)
        .tag(this.COLLAPSE_ALL)
        .tag(this.MENU_CONTROL)
        .endContext()
        .end()
        .end()
        .start('table')
        .attr('cellpadding', '0')
        .attr('cellspacing', '0')
        .call(this.branch, [this, this.data, 0])
        .end();
    },

    function render() {
      var self = this;
      this.addClass()
        .attr('tabindex', 0)
        .on('click', () => { this.focus(); });

      // Add keyboard navigation
      this.on('keydown', (e) => {
        if (!self.selected) return;

        switch (e.key) {
          case 'ArrowRight':
            // Expand selected item
            if (self.selected.flowChildren && self.selected.flowChildren.length > 0) {
              if (!self.isExpanded(self.selected)) {
                self.toggleExpanded(self.selected);
              }
            }
            e.preventDefault();
            break;
          case 'ArrowLeft':
            // Collapse selected item
            if (self.selected.flowChildren && self.selected.flowChildren.length > 0) {
              if (self.isExpanded(self.selected)) {
                self.toggleExpanded(self.selected);
              }
            }
            e.preventDefault();
            break;
          case ' ':
          case 'Enter':
            // Toggle expand/collapse
            if (self.selected.flowChildren && self.selected.flowChildren.length > 0) {
              self.toggleExpanded(self.selected);
            }
            e.preventDefault();
            break;
        }
      });

      this.add(this.dynamic(function (isMenuOpen) {
        if (isMenuOpen) {
          self.renderOpened(this);
        } else {
          self.renderClosed(this);
        }
      }));

      // Add context menu
      this.add(this.dynamic(function (contextMenuVisible, contextMenuData) {
        if (contextMenuVisible && contextMenuData) {
          this.start('div')
            .addClass(self.myClass('context-menu'))
            .style({
              left: contextMenuData.x + 'px',
              top: contextMenuData.y + 'px'
            })
            .start('div')
            .addClass(self.myClass('context-menu-item'))
            .on('click', () => {
              self.copyChild(contextMenuData.item.flowName);
              self.contextMenuVisible = false;
            })
            .add('Duplicate')
            .end()
            .end();
        }
      }));

      // Hide context menu on click outside (with cleanup)
      var docClick = () => { this.contextMenuVisible = false; };
      this.document.addEventListener('click', docClick);
      this.onDetach(() => this.document.removeEventListener('click', docClick));
    },

    function branch(self, data, depth) {
      this.add(data.dynamic(function (flowName) {
        this.
          start('tr').
          on('mouseover', () => self.softSelected = data).
          on('mouseout', () => self.softSelected = null).
          on('click', () => self.selectFromTree(data)).
          on('dblclick', () => self.toggleExpanded(data)).
          on('contextmenu', (e) => self.onContextMenu(e, data)).
          start('td').
          attrs({ draggable: 'true' }).
          call(function () {
            // Get element reference for event handlers only (don't store on data)
            var tdElement = this;

            this.
              on('dragstart', self.onDragStart.bind(self, data, tdElement)).
              on('dragend', self.onDragEnd.bind(self, tdElement)).
              on('dragenter', self.onDragOver.bind(self, data, tdElement)).
              on('dragleave', self.onDragLeave.bind(self, tdElement)).
              on('dragover', self.onDragOver.bind(self, data, tdElement)).
              on('drop', self.onDrop.bind(self, data, tdElement));
          }).
          addClass(self.myClass('element-row')).
          style({ 'marginLeft': (depth * 12) + 'px' }).
          enableClass(self.myClass('selected'),
            self.selected$.map(s => s === data)).
          enableClass(self.myClass('leaf-node'),
            !data.flowChildren || data.flowChildren.length === 0).
          start().
          addClass(self.myClass('element-row-content')).
          // Add functional chevron for expandable items
          // (skip for root node)
          callIf(data.flowChildren &&
            data.flowChildren.length > 0 &&
            data.flowParent, function () {
              this.add(self.dynamic(function (expandedState) {
                var isExpanded = self.isExpanded(data);
                this.start(foam.u2.tag.Image, {
                  glyph: 'rightChevron',
                  embedSVG: true
                })
                  .addClass(self.myClass('chevron'))
                  .enableClass(self.myClass('chevron-expanded'), isExpanded)
                  .on('click', function (e) {
                    e.stopPropagation();
                    self.toggleExpanded(data);
                  })
                  .end();
              }));
            }).
          // Show spacer for root node to align with other items
          callIf(data.flowChildren &&
            data.flowChildren.length > 0 &&
            !data.flowParent, function () {
              this.start('span')
                .style({ width: '14px', display: 'inline-block' })
                .end();
            }).
          // Icon based on block type
          callIfElse(data.cmd && data?.cmd?.includes('dao'),
            function () {
              this.start(foam.u2.tag.Image, {
                glyph: 'grid',
                embedSVG: true
              }).addClass(self.myClass('element-row-icon')).end()
            }, function () {
              // Default rectangle for other types
              this.start(foam.u2.tag.Image, {
                glyph: 'rectangle',
                embedSVG: true
              }).addClass(self.myClass('element-row-icon')).end()
            }).
          call(function () {
            data.treeRowRenderer(this);
          }).
          end().
          add(data?.dynamic(function (value$loading) {
            if (value$loading)
              this.start(foam.u2.LoadingSpinner, { size: '1.6rem' });
          })).
          callIf(data.flowParent, function () {
            this.start().
              addClass('close').
              startContext({ data: data }).tag(self.CLOSE).endContext().
              end();
          }).
          end().
          end().
          start('tr').
          start('td').
          addClass(self.myClass('moveTarget')).
          call(function () {
            var moveElement = this;
            this.
              on('dragenter', self.onDragOverMove.bind(self, data, moveElement)).
              on('dragover', self.onDragOverMove.bind(self, data, moveElement)).
              on('dragleave', self.onDragLeave.bind(self, moveElement)).
              on('drop', self.onMove.bind(self, data, moveElement));
          }).
          end().
          end();
      }));

      // Render children - they will be hidden/shown based on expanded state
      this.add(self.dynamic(function (expandedState) {
        // Only render children if the parent is expanded
        if (self.isExpanded(data)) {
          this.add(data.dynamic(function (flowChildren) {
            this.forEach(flowChildren, d => {
              this.call(self.branch, [self, d, depth + 1]);
            });
          }));
        }
      }))
    },

    function onDragStart(row, el, e) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-foam-obj-id', row.flowName);
      this.selected = row;
      // Visual feedback for source element
      el.addClass('dragging');
      e.stopPropagation();
    },

    function onDragEnd(el, e) {
      // Remove visual feedback
      el.removeClass('dragging');
      if (this.dragOverElement) {
        this.dragOverElement.removeClass('dragOver');
        this.dragOverElement = null;
        this.dragOverType = null;
      }
      e && e.stopPropagation && e.stopPropagation();
    },

    function onDragOver(_row, el, e) {
      if (!e.dataTransfer.types.some(m => m === 'application/x-foam-obj-id'))
        return;

      // Visual feedback: highlight potential drop target (row)
      if (this.dragOverElement && this.dragOverElement !== el) {
        this.dragOverElement.removeClass('dragOver');
      }
      el.addClass('dragOver');
      this.dragOverElement = el;
      this.dragOverType = 'row';

      e.preventDefault();
      e.stopPropagation();
    },

    function onDragOverMove(_row, el, e) {
      if (!e.dataTransfer.types.some(m => m === 'application/x-foam-obj-id'))
        return;


      // Visual feedback: highlight 'move after' drop zone
      if (this.dragOverElement && this.dragOverElement !== el) {
        this.dragOverElement.removeClass('dragOver');
      }
      el.addClass('dragOver');
      this.dragOverElement = el;
      this.dragOverType = 'move';

      e.preventDefault();
      e.stopPropagation();
    },

    function onDragLeave(el, e) {

      // Clear highlight when leaving a target
      if (this.dragOverElement === el) {
        el.removeClass('dragOver');
        this.dragOverElement = null;
        this.dragOverType = null;
      }
      e && e.stopPropagation && e.stopPropagation();
    },

    function onDrop(row, el, e) {
      /** Dropped on another row to cause a change of parent. **/


      if (!e.dataTransfer.types.some(m => m === 'application/x-foam-obj-id'))
        return;

      var src = e.dataTransfer.getData('application/x-foam-obj-id');


      // Can't drop on itself
      if (src === row.flowName) {

        if (this.dragOverElement) {
          this.dragOverElement.removeClass('dragOver');
          this.dragOverElement = null;
          this.dragOverType = null;
        }
        return;
      }

      // Prevent cycles: don't move a node under any of its descendants
      var p = row;
      while (p) {
        if (p.flowName == src) {

          if (this.dragOverElement) {
            this.dragOverElement.removeClass('dragOver');
            this.dragOverElement = null;
            this.dragOverType = null;
          }
          return;
        }
        p = p.flowParent;
      }

      e.preventDefault();
      e.stopPropagation();

      // Clear highlight
      if (this.dragOverElement) {
        this.dragOverElement.removeClass('dragOver');
        this.dragOverElement = null;
        this.dragOverType = null;
      }


      this.moveFlowChild(src, row);
    },

    function onMove(row, el, e) {
      /** Dropped on a space after a row to cause a move. **/


      if (!e.dataTransfer.types.some(m => m === 'application/x-foam-obj-id'))
        return;

      var src = e.dataTransfer.getData('application/x-foam-obj-id');


      // Do not allow moving "after" root (no parent to insert into)
      if (!row.flowParent) {

        if (this.dragOverElement) {
          this.dragOverElement.removeClass('dragOver');
          this.dragOverElement = null;
          this.dragOverType = null;
        }
        return;
      }

      // Prevent cycles: don't move a node under any of its descendants
      var p = row.flowParent;
      while (p) {
        if (p.flowName == src) {

          if (this.dragOverElement) {
            this.dragOverElement.removeClass('dragOver');
            this.dragOverElement = null;
            this.dragOverType = null;
          }
          return;
        }
        p = p.flowParent;
      }

      e.preventDefault();
      e.stopPropagation();

      // Clear highlight
      if (this.dragOverElement) {
        this.dragOverElement.removeClass('dragOver');
        this.dragOverElement = null;
        this.dragOverType = null;
      }

      this.moveFlowChildAfter(src, row);
    },

    function onContextMenu(e, data) {
      e.preventDefault();
      e.stopPropagation();

      this.contextMenuData = {
        x: e.clientX,
        y: e.clientY,
        item: data
      };
      this.contextMenuVisible = true;
    }
  ],

  actions: [
    {
      name: 'close',
      label: '',
      themeIcon: 'close',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function () { this.flowParent.removeFlowChild(this); }
    },
    {
      name: 'expandAll',
      label: '',
      toolTip: 'Expand All',
      themeIcon: 'expandMore',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function () {
        this.expandAll();
      }
    },
    {
      name: 'collapseAll',
      label: '',
      toolTip: 'Collapse All',
      themeIcon: 'expandLess',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function () {
        this.collapseAll();
      }
    },
    {
      name: 'menuControl',
      label: '',
      ariaLabel: 'Open/Close Menu',
      themeIcon: 'sidebar',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function () {
        this.isMenuOpen = !this.isMenuOpen;
      }
    }
  ]
});
