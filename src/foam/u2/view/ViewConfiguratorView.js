/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.u2.view',
  name: 'ViewConfiguratorView',
  extends: 'foam.u2.Tabs',
  documentation: `Renders a detail view using a given element or id for a rendered view.
  Can be used to configure the view and return a ViewSpec.
  When using an id, slot the view id to traceId
  When using and element directly, slot the element to data_
  The resulting viewspec is stored in data.
  `,

  requires: [
    'foam.u2.wizard.internal.FObjectRecursionSlot',
    'foam.u2.Tab'
  ],

  exports: ['clsDAO'],

  TODO: "reactions_ dont currently work when set on view properties",

  constants: {
    ViewSpecOutputter: foam.json.Outputter.create({
      pretty: true,
      strict: true,
      outputDefaultValues: false,
      propertyPredicate: function(o, p) { return p.name === 'reactions_' || (! p.transient && p.name != 'id'); }
    })
  },

  css: `
    ^tabRow {
      padding: 12px 0;
      border-bottom: none;
    }
  `,

  properties: [
    'traceId',
    {
      class: 'foam.u2.ViewSpec',
      name: 'data',
      visibility: function() {
        return foam.u2.DisplayMode.RO;
      }
    },
    {
      class: 'Boolean',
      name: 'allowClassChange',
      value: true
    },
    {
      name: 'clsDAO',
      hidden: true,
      factory: function() {
        let a = foam.dao.MDAO.create({ of: foam.mlang.LabeledValue }, this);
        [...Object.keys(foam.USED), ...Object.keys(foam.UNUSED)].map(v => {
          a.put(foam.mlang.LabeledValue.create({ label: v }), this);
        });
        return a;
      }
    },
    {
      name: 'viewClass',
      section: 'viewSection',
      view: function(_,X) {
        return {
          class: 'foam.u2.view.RichChoiceView',
          of: foam.mlang.LabeledValue,
          search: true,
          sections: [
            {
              heading: 'Classes',
              dao: X.clsDAO
            }
          ]
        };
      },
      expression: function(data_) {
        return data_?.cls_.id ?? '';
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.u2.Element',
      name: 'data_',
      expression: function(traceId) {
        if ( traceId ) {
          return document.getElementById(traceId)?.u3 || null;
        }
        return null;
      }
    }
  ],

  methods: [
    function render() {
      let self = this;
      this.initSlots();
      this
        .addClass()
        .start(self.Tab, {label: 'Config'})
          .start(self.VIEW_CLASS, { data$: self.viewClass$ })
            .show(self.allowClassChange$)
          .end()
          .tag(foam.u2.detail.VerticalDetailView, {
            data$: self.data_$,
            propertyWhitelist$: self.viewClass$.map(cls => {
              if ( ! cls ) return [];
              let props = [];
              cls = self.__subContext__.maybeLookup(cls);
              props = cls?.getAxiomsByClass(foam.lang.Property)
                .filter(p => ! (p.hidden ||  p.transient));
              return props;
            })
          })
        .end()
        .start(self.Tab, { label: 'Code' })
          .startContext({ data: self, controllerMode: foam.u2.ControllerMode.VIEW })
            .tag(self.DATA)
          .endContext()
        .end()
        .add(this.dynamic(function(data_) {
          if ( ! data_ ) {
            this.add('Invalid trace Id for element');
            return;
          }
        }));
    }
  ],

  listeners: [
    {
      name: 'updateElement',
      on: [ 'this.propertyChange.viewClass' ],
      isFramed: true,
      code: function() {
        if ( ! this.allowClassChange || this.viewClass == this.data_?.cls_.id || ! this.data_ ) return;
        let cls = this.__subContext__.maybeLookup(this.viewClass);
        if ( cls ) {
          let el = cls.create({}, this);
          el.id = this.traceId;
          el.element_.u3 = el;
          let children = this.data_?.childNodes || [];
          el.replaceElement_(this.data_);
          this.data_.childNodes = [];
          children.forEach(v => {
            if ( v.moveTo ) v.moveTo(el);
          });
          this.data_ = el;
        }
      }
    },
    {
      name: 'initSlots',
      isFramed: true,
      on: [ 'this.propertyChange.data_' ],
      code: function () {
        if ( ! this.data_ ) return;
        let recursionSlot = this.FObjectRecursionSlot.create({
          obj: this.data_
        });
        this.data_.onDetach(recursionSlot.sub(this.updateViewSpec));
        this.updateViewSpec();
      }
    },
    {
      name: 'updateViewSpec',
      isFramed: true,
      code: function() {
        let c = this.VIEW_SPEC_OUTPUTTER.objectify(this.data_);
        if ( ! foam.Object.equals(this.data, c) )
          this.data = c;
      }
    }
  ]
});
