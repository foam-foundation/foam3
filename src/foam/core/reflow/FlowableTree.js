/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowableTree',
  extends: 'foam.u2.View',

  imports: [ 'moveFlowChild', 'moveFlowChildAfter', 'copyChild' ],

  css: `
    ^ {
      width: 100%;
    }
    ^ table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      padding-top: 8px;
    }
    ^ table td {
      display: flex;
      justify-content: space-between;
      padding: 10px 8px;
      align-items: center;
      cursor: pointer;
      border: 1px solid $borderLight;
      border-radius: 4px;
      border-spacing: 0!important;
    }

    ^ table td .close button {
      padding: 4px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    ^selected {
      background: $backgroundTertiary;
      font-weight: $font-regular;
    }
    ^left-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid $borderLight;
      font-weight: bold;
      font-size: 16px;
    }

    ^icon-holder {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    ^element-row {
      padding: 10px;
    }
    ^element-row-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    ^element-row-icon {
      color: $textBrand;
    }
    td^moveTarget {
      background: $backgroundDefault;
      border: none!important;
      width: 100%;
      height: 8px;
      padding: 0!important;
      margin: 0!important;
    }
    ^activeTarget {
      background: $blue100!important;
    }
    ^context-menu {
      position: fixed;
      background: $backgroundDefault;
      border: 1px solid $borderLight;
      border-radius: 4px;
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
      class: 'Boolean',
      name: 'isMenuOpen',
      value: true
    },
    'contextMenuData',
    'contextMenuVisible'
  ],

  methods: [
    function renderClosed(e) {
      var self = this;
      e.start().addClass(this.myClass('icon-holder'))
        .startContext({ data: this })
          .tag(this.MENU_CONTROL)
        .endContext()
      .end();
    },

    function renderOpened(e) {
      e.start().addClass(this.myClass('left-container'))
        .start().addClass(this.myClass('left-header'))
          .start('span').add('Contents').end()
          .startContext({ data: this })
            .tag(this.MENU_CONTROL)
          .endContext()
        .end()
        .start('table')
          .attr('cellpadding', '0')
          .attr('cellspacing', '0')
          .call(this.branch, [this, this.data, 0])
        .end();
    },

    function render() {
      var self = this;
      this.addClass();
      this.add(this.dynamic(function(isMenuOpen) {
        if ( isMenuOpen ) {
          self.renderOpened(this);
        } else {
          self.renderClosed(this);
        }
      }));

      // Add context menu
      this.add(this.dynamic(function(contextMenuVisible, contextMenuData) {
        if ( contextMenuVisible && contextMenuData ) {
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

      // Hide context menu on click outside
      this.document.addEventListener('click', () => {
        this.contextMenuVisible = false;
      });
    },

    function branch(self, data, depth) {
      this.add(data.dynamic(function (flowName) {
        this.
        start('tr').
          on('click',    () => self.selected = data).
          on('dblclick', () => data.expanded = ! data.expanded).
          on('contextmenu', (e) => self.onContextMenu(e, data)).
          attrs({draggable: 'true'}).
          call(function() {
            this.
            on('dragstart', self.onDragStart.bind(self, data))
/*            on('dragenter', self.onDragOver.bind(self, data, this)).
            on('dragleave', self.onDragLeave.bind(self, this))*/;
              // on('dragover',  self.onDragOver.bind(self, data, this)).
            // on('drop',      self.onDrop.bind(self, data)).
          }).
          start('td').
            addClass(self.myClass('element-row')).
            style({'marginLeft': (depth * 12) + 'px'}).
            enableClass(self.myClass('selected'), self.selected$.map(s => s === data)).
            start().
              addClass(self.myClass('element-row-content')).
              // TODO: let the Flowable provide its own Image
              callIfElse(data.cmd && data?.cmd?.includes('dao'), function() {
                this.start(foam.u2.tag.Image, {
                  glyph: 'grid',
                  embedSVG: true
                }).addClass(self.myClass('element-row-icon')).end()
              }, function() {
                this.start(foam.u2.tag.Image, {
                  glyph: 'rectangle',
                  embedSVG: true
                }).addClass(self.myClass('element-row-icon')).end()
              }).
              call(function() {
                data.treeRowRenderer(this);
              }).
            end().
            add(data?.dynamic(function(value$loading) {
              if ( value$loading )
                this.start(foam.u2.LoadingSpinner, { size: '1.6rem' });
            })).
            callIf(data.flowParent, function() {
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
            call(function() {
              this.
              on('dragenter', self.onDragOver.bind(self, data, this)).
              on('dragover',  self.onDragOver.bind(self, data, this)).
              on('dragleave', self.onDragLeave.bind(self, this)).
              on('drop',      self.onMove.bind(self, data, this));
            }).
          end().
        end();
      }));

      this.add(data.dynamic(function (flowChildren) {
        this.forEach(flowChildren, d => {
          this.call(self.branch, [self, d, depth+1]);
        });
      }))
    },

    function onDragStart(row, e) {
      console.log('onDragStart', e);
      e.dataTransfer.setData('application/x-foam-obj-id', row.flowName);
      console.log('onDragStart', e, row.flowName);
      e.stopPropagation();
    },

    function onDragOver(row, el, e) {
      el.addClass(this.myClass('activeTarget'));
      // console.log('onDragOver', e);
      if ( ! e.dataTransfer.types.some(m => m === 'application/x-foam-obj-id') )
        return;

      var src = e.dataTransfer.getData('application/x-foam-obj-id');

      console.log('onDragOver', e);
      console.log('over', src, '->', row.flowName);

      // if ( src === row.flowName ) return;

      e.preventDefault();
      e.stopPropagation();
    },

    function onDragLeave(el) {
      el.removeClass(this.myClass('activeTarget'));
    },

    function onDrop(row, el, e) {
      /** Dropped on another row to cause a change of parent. **/
      el.removeClass(this.myClass('activeTarget'));
      console.log('onDrop', e, row.flowName);
      if ( ! e.dataTransfer.types.some(m => m === 'application/x-foam-obj-id') )
        return;

      var src = e.dataTransfer.getData('application/x-foam-obj-id');

      if ( src === row.flowName ) return;

      e.preventDefault();
      e.stopPropagation();

      console.log('drop', src, '->', row.flowName);

      this.moveFlowChild(src, row);
    },

    function onMove(row, el, e) {
      /** Dropped on a space after a row to cause a move. **/
      el.removeClass(this.myClass('activeTarget'));
      console.log('onMove', e, row.flowName);
      if ( ! e.dataTransfer.types.some(m => m === 'application/x-foam-obj-id') )
        return;

      var src = e.dataTransfer.getData('application/x-foam-obj-id');

      e.preventDefault();
      e.stopPropagation();

      console.log('move', src, '->', row.flowName);

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
      code: function() { this.flowParent.removeFlowChild(this); }
    },
    {
      name: 'menuControl',
      label: '',
      ariaLabel: 'Open/Close Menu',
      themeIcon: 'sidebar',
      buttonStyle: 'TERTIARY',
      size: 'SMALL',
      code: function() {
        this.isMenuOpen = ! this.isMenuOpen;
      }
    }
  ]
});
