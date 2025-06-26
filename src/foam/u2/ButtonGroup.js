/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/


foam.CLASS({
  package: 'foam.u2',
  name: 'ButtonGroup',
  extends: 'foam.u2.Element',
  documentation: `Border to group number of buttons together
  TODO: Add auto-collapsing with ResizeObserver`,

  requires: [
    'foam.u2.ActionReference',
    'foam.u2.view.OverlayActionListView'
  ],

  css: `
    ^ { 
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
      flex: 2 0 fit-content;
    }
    ^vertical {
      flex-direction: column;
    }
    ^ .foam-u2-view-OverlayActionListView-iconOnly {
      padding: 6px;
    }
  `,
  enums: [
    {
      name: 'GroupDirection',
      values: ['HORIZONTAL', 'VERTICAL']
    }
  ],
  properties: [
    {
      name: 'direction',
      factory: function() {
        return this.GroupDirection.HORIZONTAL;
      }
    },
    {
      class: 'Boolean',
      name: 'overflowWrap',
      value: true
    },
    {
      class: 'Map',
      name: 'overrides',
      documentation: 'allows for group wide overrides like hiding labels and setting buttonstyle'
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.FObject',
      documentation: 'stores an array of buttons, menus or actionReferences',
      name: 'data'
    },
    {
      name: 'overlaySpec'
    },
    'notContent',
    'overlay_'
  ],
  methods: [
    function init() {
      this.SUPER();
      this
        .addClass()
        .enableClass(this.myClass('vertical'), this.direction$.map(v => v == 'VERTICAL'))
        .start('', {}, this.notContent$).style({ display:'contents'}).end()
        .tag(this.OverlayActionListView, { data$: this.data$, ...this.overlaySpec }, this.overlay_$)
      this.content = this.notContent;
    },
    function startOverlay() {
      this.__subSubContext__ = this.__subSubContext__.createSubContext({overlay: true});
      return this;
    },
    function endOverlay() {
      this.__subSubContext__ = this.__subSubContext__.createSubContext({overlay: false});
      return this;
    },
    function createChild_(spec, args) {
      if ( this.__subSubContext__.overlay ) {
        this.overlay_.data$push(spec);
        return;
      }
      args = {...args, ...this.overrides};
      let a = this.SUPER(spec, args);
      return a;
    },
    function addActionReference(action, data, opts = {}) {
      // Convienience method to add ActionReference
      let actRef = this.ActionReference.create({ action, ...( foam.lang.Slot.isInstance(data) ? {data$: data} : {data: data} ) });
      this.tag(actRef, opts);
      return this
    }
  ],
});
