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

  exports: ['storeAction'],

  css: `
    << {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: nowrap;
      flex: 1 0 0;
      min-width: 0;
    }
    <<vertical {
      flex-direction: column;
    }
    << .foam-u2-view-OverlayActionListView-iconOnly {
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
    'overlay_',
    {
      class: 'Map',
      name: 'childWidths'
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.FObject',
      name: 'currentOverflow'
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.FObject',
      name: 'otherActions'
    }
  ],
  methods: [
    function init() {
      this.SUPER();
      this.__subSubContext__.register(foam.u2.ButtonGroupActionView,'foam.u2.ActionView');
      this.__subSubContext__.register(foam.u2.ButtonGroupActionReferenceView,'foam.u2.ActionReferenceView');
      this
        .addClass()
        .enableClass(this.myClass('vertical'), this.direction$.map(v => v == 'VERTICAL'))
        .tag(foam.u2.WrapperNode, { parentNode: this }, this.notContent$)
        .tag(this.OverlayActionListView, {
          data$: this.slot(function(data, currentOverflow) {
            return [...currentOverflow, ...data]
          }),
          shown$: this.slot(function(data, currentOverflow) {
            return data.length > 0 || currentOverflow.length > 0;
          }),
          ...this.overlaySpec
        }, this.overlay_$)
      this.content = this.notContent;
      // Start observing the container
      this.resizeObserver(this.onResize);
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
        this.data$push(spec);
        return;
      }
      args = {...args, ...this.overrides};
      let child = this.SUPER(spec, args);
      return child;
    },
    function addActionReference(action, data, opts = {}) {
      // Convienience method to add ActionReference
      let actRef = this.ActionReference.create({ action, ...( foam.lang.Slot.isInstance(data) ? {data$: data} : {data: data} ) });
      this.tag(actRef, opts);
      return this
    },
    function storeAction(el) {
      // Expects an action view that it can extract the action and data from
      if ( el.__subSubContext__.overlay ) return;
      let uid = el.$UID;
      // This is a quirk of u3 and how content works, seemingly children added to content still have the top level element as parent
      // This does not apply to slots as functionNode is created in the context of the content element
      // This code can be deleted if this is fixed
      if ( el.parentNode !== this ) {
        let e = el;
        while ( e.parentNode !== this.notContent ) {
          e = e.parentNode;
          // This happens for overlay actions
          if ( ! e ) return;
        }
        uid = e.$UID;
      }
      el.resizeObserver(this.buttonObserver.bind(this, el, uid));
      this.buttonObserver(el, uid);
      // An action that becomes unavailable or available again only changes its
      // class, and a button this group already hid has no size to report, so a
      // resize never fires for it. Re-fit on every class change instead.
      let target = el.el_();
      if ( target && globalThis.MutationObserver ) {
        let classObserver = new MutationObserver(() => this.onResize());
        classObserver.observe(target, { attributes: true, attributeFilter: [ 'class' ] });
        el.onDetach(() => classObserver.disconnect());
      }
      this.onResize();
    },
    function isAction(a) {
      return foam.lang.Action.isInstance(a) || this.ActionReference.isInstance(a);
    },
    function isUnavailable_(el) {
      // ActionView marks an action whose isAvailable is false with its
      // 'unavailable' class, which hides it with display: none
      let element = el && el.el_ && el.el_();
      return !! ( element && element.classList && element.classList.contains(el.myClass('unavailable')) );
    }
  ],
   listeners: [
    {
      name: 'buttonObserver',
      code: function(el, id) {
        let width = el.el_().offsetWidth;
        if ( width === 0 || ! el.shown ) return;
        this.childWidths[id] = { el: el, width: width };
        el.onDetach(() => {
          this.childWidths$remove[id];
        });
      }
    },
    {
      name: 'onResize',
      isFramed: true,
      code: function() {
        if ( ! this.el_() ) return;

        const containerWidth = this.el_().offsetWidth;
        const overlayWidth = this.overlay_?.el_()?.offsetWidth || 40;
        let available = containerWidth - overlayWidth;
        let visibleCount = 0;
        let currentWidth = 24; // 24px as padding width for either side
        // An unavailable action is still a child, hidden by its own 'unavailable'
        // class, and its width was recorded while its availability was loading.
        // Counting it pushed the available actions out: on a record with a dozen
        // state-specific actions, the invisible ones filled the group and every
        // action that applied went to the overflow. It takes no room and must not
        // reach the overflow, so it is left out of both.
        const children = this.notContent.children.filter(child => {
          let value = this.childWidths[child.$UID];
          return ! ( value && this.isUnavailable_(value.el) );
        });
        // Determine how many fit
        for ( let i = 0; i < children.length; i++ ) {
          let child = children[i];
          let value = this.childWidths[child.$UID];
          currentWidth += (value?.width ?? 0) + 16; // 16px for gap
          if ( currentWidth < available ) {
            visibleCount++;
          } else {
            if ( i + 1 == children.length && currentWidth - 16 <= containerWidth )
              visibleCount++;
            break;
          }
        }

        // Toggle visibility and update overlay data
        const overflowItems = [];
        let visibilityChanged = false;

        children.forEach((child, idx) => {
          if ( ! this.childWidths[child.$UID] ) return;
          let el = this.childWidths[child.$UID]?.el;
          if ( idx < visibleCount ) {
            if ( ! el.shown ) { el.show(); visibilityChanged = true; }
          } else {
            if ( el.shown ) { el.hide(); visibilityChanged = true; }
            // Logic to map the hidden child back to an action/spec for the overlay
            overflowItems.push(this.ActionReference.create({ action$: el.action$, data$: el.data$ }));
          }
        });

        if ( visibilityChanged ) this.overlay_.overlay_.close();
        this.currentOverflow = overflowItems;
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'ButtonGroupActionView',
  extends: 'foam.u2.ActionView',

  imports: ['storeAction'],

  methods: [
    function render() {
      this.SUPER();
      this.storeAction(this);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ButtonGroupActionReferenceView',
  extends: 'foam.u2.ActionReferenceView',

  imports: ['storeAction'],

  methods: [
    function render() {
      this.SUPER();
      this.storeAction(this);
    }
  ]
});
