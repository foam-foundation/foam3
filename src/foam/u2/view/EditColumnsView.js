/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'EditColumnsView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.DetailView',
    'foam.u2.view.ColumnConfigPropView',
    'foam.u2.view.SubColumnSelectConfig'
  ],

  imports: [
    'window',
    'table?'
  ],

  css: `
    ^drop-down-bg {
      font-size:        12px;
      position:         fixed;
      width:            100%;
      height:           100%;
      top:              0;
      left:             0;
      z-index:          100;
    }
    ^ .foam-u2-ActionView-closeButton {
      width: 24px;
      height: 35px;
      margin: 0;
      cursor: pointer;
      display: inline-block;
      float: right;
      outline: 0;
      border: none;
      background: transparent;
      box-shadow: none;
      padding-top: 15px;
      margin-right: 15px;
    }
    ^ .foam-u2-ActionView-closeButton:hover {
      outline: none;
      border: none;
      background: transparent;
    }
    ^container {
      align-items: flex-start;
      background-color: $backgroundDefault;
      border-radius: 5px;
      border: 1px solid $borderDefault;
      box-shadow: 0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      max-width: clamp(300px, 20vw, 600px);
      padding: 16px 8px;
      position: fixed;
      right: 60px;
      top: 120px;
    }
  `,

  constants: {
    DEFAULT_TOP_OFFSET: 120,
    DEFAULT_RIGHT_OFFSET: 60,
    BOTTOM_BUFFER: 30,
    MIN_HEIGHT: 250, 
    // MIN_HEIGHT, MINOR KNOW ISSUE: Based on trying multiple values, '250' seemed good. 
    // tldr; there's a certain vertical scroll position, if the BUTTON which opens Pop-up is below that vertical point
    // the pop-up overflows to below the fold(visible screen area)
    MAX_HEIGHT: 600,
    DROPDOWN_WIDTH: 300 // Approximate width from CSS max-width
  },

  properties: [
    {
      name: 'selectColumnsExpanded',
      class: 'Boolean'
    },
    'columnConfigPropView',
    'height',
    'rightOffset',
    'topOffset',
    { class: 'Int', name: 'refreshIdx', value: 0 }
  ],

  methods: [
    function init() {
      this.SUPER();
      if ( this.data?.selectedColumnNames$ ) {
        this.onDetach(this.data.selectedColumnNames$.sub(() => {
          this.refresh();
        }));
      }
      this.onDetach(this.selectColumnsExpanded$.sub(() => {
        if ( this.selectColumnsExpanded ) this.refresh();
      }));
    },
    function closeDropDown(e) {
      e.stopPropagation();
      this.columnConfigPropView?.onClose?.();
      this.selectColumnsExpanded = ! this.selectColumnsExpanded;
    },
    function render() {
      this.SUPER();
      var self = this;
      this.window.addEventListener('resize', this.updatePosition);
      this.onDetach(() => self.window.removeEventListener('resize', self.updatePosition));
      
      this.start()
      .addClass(this.myClass())
        .show(this.selectColumnsExpanded$)
        .addClass(this.myClass('drop-down-bg'))
        .add(this.dynamic(function(refreshIdx) {
          this.start(self.ColumnConfigPropView, { data: self.data }, self.columnConfigPropView$)
              .addClass(self.myClass('container'))
              .style({
                'max-height': self.height$,
                'right': self.rightOffset$,
                'top': self.topOffset$
              })
            .end();
        }))
      .on('click', this.closeDropDown.bind(this))
      .end();
    }
  ],
  listeners: [
    function refresh() { this.refreshIdx++; }, 
    function updatePosition() {
      var availableSpace;
      
      if ( this.table && this.table.tableEl_ ) {
        var tableRect = this.table.tableEl_.getBoundingClientRect();
        
        // Position relative to table's right edge, offset by dropdown width
        this.rightOffset = Math.max(10, this.window.innerWidth - tableRect.right - this.DROPDOWN_WIDTH) + 'px';
        this.topOffset = tableRect.top + 'px';

        // Calculate available space from dropdown top to viewport bottom
        availableSpace = this.window.innerHeight - tableRect.top - this.BOTTOM_BUFFER;
      } else {
        // Use default positioning when no table is present
        this.rightOffset = this.DEFAULT_RIGHT_OFFSET + 'px';
        this.topOffset = this.DEFAULT_TOP_OFFSET + 'px';
        
        // Calculate available space from default position to viewport bottom
        availableSpace = this.window.innerHeight -
            this.DEFAULT_TOP_OFFSET - this.BOTTOM_BUFFER;
      }
      
      // Clamp height between min and max, but don't exceed available space
      this.height = Math.max(this.MIN_HEIGHT,
          Math.min(this.MAX_HEIGHT, availableSpace)) + 'px';
    }
  ],
  actions: [
    {
      name: 'closeButton',
      label: '',
      icon: 'images/ic-cancelwhite.svg',
      code: function(X) {
        this.columnConfigPropView?.onClose?.();
        this.selectColumnsExpanded = ! this.selectColumnsExpanded;
      }
    }
  ]
});
