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
    'foam.u2.view.SubColumnSelectConfig',
    'foam.u2.md.OverlayDropdown'
  ],

  imports: [
    'ctrl?'
  ],

  css: `
    ^container {
      display: flex;
      flex-direction: column;
      max-width: clamp(300px, 20vw, 600px);
      padding: 16px 8px;
    }
  `,

  properties: [
    {
      name: 'selectColumnsExpanded',
      class: 'Boolean'
    },
    'columnConfigPropView',
    'triggerEl',
    'dropdownX',
    'dropdownY',
    {
      class: 'FObjectProperty',
      of: 'foam.u2.md.OverlayDropdown',
      name: 'dropdown_',
      factory: function() {
        return this.OverlayDropdown.create({
          closeOnLeave: true,
          styled: true,
          parentEdgePadding: -1
        });
      }
    },
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
    },
    function render() {
      this.SUPER();
      var self = this;

      this.onDetach(() => this.dropdown_.remove());
      if ( this.ctrl ) {
        this.ctrl.add(this.dropdown_);
      } else {
        this.dropdown_.write();
      }

      this.onDetach(this.selectColumnsExpanded$.sub(function(expanded) {
        if ( expanded && self.triggerEl ) {
          self.dropdown_.parentEl = self.triggerEl;
          self.dropdown_.open(self.dropdownX || 0, self.dropdownY || 0);
          self.refresh();
        } else if ( ! expanded ) {
          self.dropdown_.close();
        }
      }));

      this.onDetach(this.dropdown_.opened$.sub(function(opened) {
        if ( ! opened && self.selectColumnsExpanded ) {
          self.selectColumnsExpanded = false;
        }
      }));

      this.dropdown_.add(
        this.start(self.ColumnConfigPropView, { data: self.data }, self.columnConfigPropView$)
          .addClass(self.myClass('container'))
      );
    }
  ],
  listeners: [
    function refresh() { this.refreshIdx++; }
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
