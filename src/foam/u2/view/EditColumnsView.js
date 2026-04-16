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
      overflow-y: auto;
    }
  `,

  constants: {
    DEFAULT_TOP_OFFSET: 120,
    DEFAULT_RIGHT_OFFSET: 60,
    BOTTOM_BUFFER: 30,
    TOP_BUFFER: 30,
    TABLE_HEADER_HEIGHT: 60,  // Approximate table header height
    MIN_HEIGHT: 250,
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
        if ( this.selectColumnsExpanded ) {
          this.updatePosition();
          this.refresh();
        }
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
        .add(this.dynamic(function(selectColumnsExpanded) {
          // Call updatePosition when popover becomes visible to ensure correct placement
          if ( selectColumnsExpanded ) {
            setTimeout(function() { self.updatePosition(); }, 0);
          }
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
      var availableBelow, availableAbove, topPos, headerBottomPos;

      if ( this.table && this.table.tableEl_ ) {
        var tableRect = this.table.tableEl_.getBoundingClientRect();

        // Position relative to table's right edge, offset by dropdown width
        this.rightOffset = Math.max(10, this.window.innerWidth - tableRect.right - this.DROPDOWN_WIDTH) + 'px';

        // Position below the table header
        headerBottomPos = tableRect.top + this.TABLE_HEADER_HEIGHT;

        // Calculate available space below header and above table top
        availableBelow = this.window.innerHeight - headerBottomPos - this.BOTTOM_BUFFER;
        availableAbove = tableRect.top - this.TOP_BUFFER;

        // Position below header if enough space, otherwise position above
        if ( availableBelow >= this.MIN_HEIGHT ) {
          topPos = headerBottomPos;
          this.topOffset = topPos + 'px';
          this.height = Math.max(this.MIN_HEIGHT,
              Math.min(this.MAX_HEIGHT, availableBelow)) + 'px';
        } else if ( availableAbove >= this.MIN_HEIGHT ) {
          topPos = Math.max(0, tableRect.top - this.MAX_HEIGHT - this.TOP_BUFFER);
          this.topOffset = topPos + 'px';
          this.height = Math.max(this.MIN_HEIGHT,
              Math.min(this.MAX_HEIGHT, availableAbove)) + 'px';
        } else {
          // Not enough space either way, position below header and rely on max-height + scroll
          topPos = headerBottomPos;
          this.topOffset = topPos + 'px';
          this.height = this.MAX_HEIGHT + 'px';
        }
      } else {
        // Use default positioning when no table is present
        this.rightOffset = this.DEFAULT_RIGHT_OFFSET + 'px';
        this.topOffset = this.DEFAULT_TOP_OFFSET + 'px';
        this.height = Math.max(this.MIN_HEIGHT,
            Math.min(this.MAX_HEIGHT, this.window.innerHeight - this.DEFAULT_TOP_OFFSET - this.BOTTOM_BUFFER)) + 'px';
      }
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
