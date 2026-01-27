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
      /**
       * Starts a reactive formula evaluation that re-runs whenever dependencies change.
       * Supports synchronous values, Promises, and async/await.
       *
       * Examples:
       *   Sync:    "service.name"
       *   Promise: "serviceDAO.find(this.serviceId).then(s => s.name)"
       *   Await:   "await serviceDAO.find(this.serviceId)"
       */
      // HACK: delay starting reaction in case we're loading a file
      // and dependent variables haven't loaded yet.
      window.setTimeout(function() {
        var self = this;
        var f;

        with ( this.__context__.scope ) {
          // Create function - can be sync or return a Promise
          // The timer will handle both cases by checking if result is a Promise
          f = eval('(function() { return ' + formula + '})');
        }
        f.toString = function() { return formula; };

        var detached = false;
        self.onDetach(function() { detached = true; });
        var timer = async function() {
          if ( detached ) return;
          if ( self.reactions_[name] !== f ) return;
          // Await handles both Promises and non-Promises
          self[name] = await f.call(self);
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
      background-color: $backgroundTertiary;
      border-radius: 5px;
      border: 1px solid $borderLight;
    }
    ^switch {
      color: $textTertiary;
      line-height: 1;
    }
    ^switch:hover {
      padding-inline: 5px;
      border-radius: 2px;
      background-color: $backgroundSecondary;
    }
    ^switch.reactive {
      color: $textBrand!important;
    }
    ^formulaInput input:focus {
      outline: 1px solid $backgroundBrand!important;
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
    ^labelHolder {
      border-radius: 4px;
      padding-block: 2px;
      cursor: pointer;
      width: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
    }
    ^layoutView {
      width: 100%;
    }
    ^ .property-skip .foam-u2-view-DualView-wrapper {
      flex-direction: column;
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
      view: {
        class: 'foam.u2.tag.TextArea',
        rows: 1,
        cols: undefined,
        wrap: 'hard'
      },
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
        addClass().
        show(visibilitySlot).
        start().
          addClass(this.myClass('propHolder')).addClass(this.myClass('labelHolder')).
          add(labelSlot).
          start().on('click', this.toggleMode).
            addClass(this.myClass('switch')).
            show(self.optionalPropertyState$).
            enableClass('reactive', this.reactive$).
            add(this.dynamic(function(reactive) {
              if ( reactive ) {
                this.start().
                  add('Dynamic').
                end()
              } else {
                this.start().
                  add('Static').
                end()
              }
            })).
          end().
          callIf(prop.optionalBorder, function() {
            this.start().
              startContext({ data: self }).
              addClass(self.myClass('optionalHolder')).
              add(self.OPTIONAL_PROPERTY_STATE).
              endContext().
            end();
          }).
        end().
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
        addClass(self.myClass('layoutView')).
        show(self.optionalPropertyState$).
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
        ).
      end();
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
  name: 'CollapsedByDefaultSectionView',
  extends: 'foam.u2.detail.SectionView',

  css:`
    ^actionDiv {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    ^ {
      padding: 8px 0;
    }
  `,

  properties: [ [ 'collapsed', true ] ]
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
    ^ {
      padding: 8px 16px;
    }
    ^ > .foam-u2-layout-Rows > div:not(:last-child) > * {
      border-bottom: 1px solid $borderLight;
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
      x.register(foam.core.reflow.CollapsedByDefaultSectionView, 'foam.u2.detail.SectionView');
      this.__context__ = x;
      this.SUPER();
    }
  ]
});
