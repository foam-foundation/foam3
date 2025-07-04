/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FObjectReactiveDetailViewRefinement',
  refines: 'FObject',

  properties: [
    {
      class: 'Map',
      generateJava: false,
      name: 'reactions_',
      searchable: false,
      hidden: true,
      shortName: 'r_',
      transient: true,
      factory: function() { return {}; },
      postSet: function(_, rs) {
        // Only start reactions if in the proper context
        if ( this.__context__.scope ) {
          for ( var key in rs ) {
            this.startReaction_(key, rs[key]);
          }
        }
        return rs;
      },
      isDefaultValue: function(v) {
        return Object.keys(v).length == 0;
      },
      toJSON: function(v) {
        var m = {};
        for ( key in v ) { m[key] = v[key].toString(); }

        return m;
      }
    }
  ],

  methods: [
    function addReaction(name, formula) {
      // TODO: stop any previous reaction
      this.reactions_[name] = formula;
      this.startReaction_(name, formula);
    },
    function startReaction_(name, formula) {
      // HACK: delay starting reaction in case we're loading a file
      // and dependent variables haven't loaded yet.
      window.setTimeout(function() {
        var self = this;
        var f;

        with ( this.__context__.scope ) {
          f = eval('(function() { return ' + formula + '})');
        }
        f.toString = function() { return formula; };

        var detached = false;
        self.onDetach(function() { detached = true; });
        var timer = function() {
          if ( detached ) return;
          if ( self.reactions_[name] !== f ) return;
          self[name] = f.call(self);
          self.__context__.requestAnimationFrame(timer);
        };

        this.reactions_[name] = f;
        timer();
      }.bind(this), 10);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyBorder',
  extends: 'foam.u2.PropertyBorder',

  imports: [ 'scope' ],

  css: `
    ^{
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: flex-start;
      gap: 8px;
    }
    ^ ^label {
      color: $black;
      width: 90%;
    }
    ^view: {
      min-height: 0px;
    }
    ^view > div > span {
      align-items: center;
      gap: 5px;
    }
    ^select, ^select1, ^select2 {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      background-color: $grey100;
      border-radius: 5px;
      border: 1px solid $grey200;
    }
    ^switch { color: #ccc; width: 12px !important; }
    ^switch.reactive {
      font-weight: 600;
      color: $primary500!important;
    }
    ^formulaInput input:focus {
      outline: 1px solid $primary500 !important;
    }
    ^element-icon {
      width: 14px;
      height: 14px;
    }
    ^ .foam-core-reflow-SinkView {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 5px;
    }
    ^ .foam-core-reflow-SinkView > div > div {
      width: 100%;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'reactive',
      postSet: function(_, r) {
        if ( ! r && this.data ) {
          delete this.data.reactions_[this.prop.name];
        }
      }
    },
    {
      class: 'String',
      name: 'formula',
      displayWidth: 50,
      factory: function() {
        return this.data && this.data.reactions_[this.prop.name];
      },
      postSet: function(_, f) {
        if ( f ) this.setFormula(f);
      }
    }
  ],

  methods: [
    function init() {
      // Reset context property border to the default border
      // This is done to prevent setting reactions on nested FObject props
      const x = this.__context__.createSubContext();
      x.register(foam.u2.PropertyBorder, 'foam.u2.PropertyBorder');
      this.__context__ = x;
    },

    function render() {
      this.data$.sub(this.onDataChange);
      this.onDataChange();

      this.SUPER();
    },

    function layout(prop, visibilitySlot, modeSlot, labelSlot, viewSlot, colorSlot, errorSlot, supportingLabelSlot) {
      var self = this;

      this.
        enableClass(this.myClass('u2'), ! this.U3).
        addClass().
        show(visibilitySlot).
        add(labelSlot).
        add(supportingLabelSlot).
        call(this.layoutView, [self, prop, viewSlot]).
        start().
          addClass(this.myClass('propHolder')).
          callIf(prop.help, function() {
            this.start().addClass(self.myClass('helper-icon'))
              .start('', { tooltip: prop.help.length < 60 ? prop.help : self.LEARN_MORE })
                .start(self.CircleIndicator, {
                  glyph: 'helpIcon',
                  icon: '/images/question-icon.svg',
                  size: 20
                })
                  .on('click', () => { self.helpEnabled = ! self.helpEnabled; })
                .end()
              .end()
            .end();
          }).
        end().
        start().
          /**
           * ERROR BEHAVIOUR:
           * - data == nullish, error == true: Show error in default text color, hide icon
           * - data == ! null, error == true: Show error and icon in destructive, highlight field border
           * Allows for errors to act as suggestions until the user enters a value
           * Potential improvement area: this approach makes it slightly harder to understand why
           * submit action may be unavilable for long/tabbed  forms
           */
          addClass('p-legal-light', this.myClass('errorText')).
          enableClass(this.myClass('colorText'), colorSlot).
          show(errorSlot.and(modeSlot.map(m => m == foam.u2.DisplayMode.RW))).
          // Using the line below we can reserve error text space instead of shifting layouts
          // show(modeSlot.map(m => m == foam.u2.DisplayMode.RW)).
          start({
            class: 'foam.u2.tag.Image',
            data: '/images/inline-error-icon.svg',
            embedSVG: true
          }).show(errorSlot.and(colorSlot)).end().
          add(' ', errorSlot).
        end().
        callIf(prop.help, function() {
          this
            .start(self.ExpandableBorder, { expanded$: self.helpEnabled$, title: self.HELP })
              .style({ 'flex-basis': '100%', width: '100%' })
              .start('p').add(prop.help).end()
            .end();
        });
    },

    function layoutView(self, prop, viewSlot) {
      this.start().
        addClass(self.myClass('switch')).
        enableClass('reactive', self.reactive$).
        on('click', self.toggleMode).
        add(self.dynamic(function(reactive) {
          if ( reactive ) {
            this.start(foam.u2.tag.Image, {
              glyph: 'functionSign',
              embedSVG: true
            }).addClass(self.myClass('element-icon')).end()
          } else {
            this.start(foam.u2.tag.Image, {
              glyph: 'equalSign',
              embedSVG: true
            }).addClass(self.myClass('element-icon')).end()
          }
        })).
      end().
      add(
        self.dynamic(function(reactive) {
          if ( reactive ) {
            this.start().
              start(self.FORMULA, {data$: self.formula$}).
                addClass(self.myClass('formulaInput')).
                on('blur', function() { self.reactive = !! self.formula; }).
                focus().
              end().add(self.data.slot(self.prop.name)).
            end();
          } else {
            this.add(viewSlot);
          }
        })
      );
    },

    function setFormula(formula) {
      this.data.startReaction_(this.prop.name, formula);
    }
  ],

  listeners: [
    function toggleMode() {
      this.reactive = ! this.reactive;
    },

    function onDataChange() {
      if ( this.data ) {
        var f = this.data.reactions_[this.prop.name];
        this.formula  = f ? f.toString() : '';
        this.reactive = !! f;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ReactiveDetailView',
  extends: 'foam.u2.DetailView',

  requires: [ 'foam.core.reflow.PropertyBorder' ],

  css: `
   // ^ { margin: inherit !important; }
   // ^ table { width: auto !important; }
   ^title input { font-size: large; }
   ^title { font-size: large; }
   ^collapsePropertyViews .com-google-flow-PropertyBorder-propHolder { width: auto; display: inline-flex; }
   ^ .foam.core.reflow-PropertyBorder-propHolder > :first-child { width: auto; }
  `,

  properties: [
    [ 'showActions', true ],
    [ 'expandPropertyViews', false ],
  ],

  methods: [
    function renderTitle(self) {
      // NOP
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyRefinement',
  refines: 'Property',

  properties: [
    {
      class: 'Boolean',
      name: 'reactive',
      value: true
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FObjectPropertyRefinement',
  refines: 'FObjectProperty',
  properties: [ [ 'reactive', false ] ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FObjectArrayRefinement',
  refines: 'FObjectArray',
  properties: [ [ 'reactive', false ] ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ReactiveSectionedDetailView',
  extends: 'foam.u2.detail.VerticalDetailView',

  requires: [
    'foam.u2.PropertyBorder',
    'foam.core.reflow.PropertyBorder as ReactivePropertyBorder',
  ],


  css: `
    ^ > div > .foam-u2-layout-Rows {
      gap: 10px;
    }
    ^ .foam-u2-detail-SectionView-actionDiv {
      flex-direction: column;
    }
    ^ .foam-u2-detail-SectionView-section-title {
      padding-inline: 24px;
      padding-block: 16px;
      font-size: 16px;
    }
    ^ .foam-u2-detail-SectionView {
      border-bottom: 1px solid $grey200;
    }
    ^ .foam-u2-detail-SectionView-grid {
      padding-inline: 24px;
    }
  `,

  properties: [
    [ 'showActions', true ]
  ],

  methods: [
    function init() {
      const self = this;
      const x    = this.__context__.createSubContext();
      const PropertyBorder = this.PropertyBorder;
      const ReactivePropertyBorder = this.ReactivePropertyBorder;

      // If a property has reactive: false then use the regular PropertyBorder, otherwise use a ReactivePropertyBorder
      var cls = {
        package: 'foam.u2',
        id: 'foam.u2.PropertyBorder',
        create: function(args, x) {
          return (args.prop.reactive && args.prop.visibility != foam.u2.DisplayMode.RO ? ReactivePropertyBorder : PropertyBorder).create(args, x);
        }
      };
      x.register(cls, 'foam.u2.PropertyBorder');
      this.__context__ = x;
      this.SUPER();
    }
  ]
});
