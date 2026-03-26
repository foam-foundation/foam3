/**
  * @license
  * Copyright 2022 The FOAM Authors. All Rights Reserved.
  * http://www.apache.org/licenses/LICENSE-2.0
  */

foam.CLASS({
  package: 'foam.u2',
  name: 'AbstractPropertyBorder',
  extends: 'foam.u2.Element',

  documentation: `
    This model is abstract. Add css: and implement layout() to complete.

    Wraps a Property's underlying View with extra functionality to:
      1. Display a Label from Property's label:
      2. Display Units, if set in Property's units:
      3. Show/Hide the View based on the Property's visibility:
      4. Change the underlying View's Visibility to RO/RW/etc based on visibility:
      5. Display error messages based on the Property's validateObj: & validationPredicates:
      6. Add Property's help
  `,

  requires: [
    'foam.lang.ArraySlot',
    'foam.lang.ConstantSlot',
    'foam.lang.SimpleSlot',
    'foam.u2.borders.ExpandableBorder',
    'foam.u2.DisplayMode',
    'foam.u2.tag.CircleIndicator'
  ],

  imports: [
    'theme?',
    'data'
  ],

  exports: [ 'data as objData' ],

  messages: [
    { name: 'HELP',       message: 'Help' },
    { name: 'LEARN_MORE', message: 'Click to learn more' }
  ],

  properties: [
    'prop',
    {
      class: 'Map',
      name: 'viewArgs',
      documentation: `Map prop that gets passed to the prop's view`
    },
    {
      class: 'Map',
      name: 'config',
      documentation: `
        Map of propertyProperty: value for configuring properties
        values include 'label', 'units', and 'view'.
        WARNING: Config accepts slots as key value pairs however config's slot does not update the prop. Eg:
          VALID: config: { label$: someLabelSlot$ }; --> Will update prop label
          INVALID: config$: someLabelSlot$.map(v => { return {label: v} }) --> Will not update prop label
      `
    },
    [ 'helpEnabled', false ],
    {
      name: 'optionalPropertyState',
      class: 'Boolean',
      value: true,
      documentation: `
        Tracks the state of the optional toggle if this property is optional.
        True means the property is defined, false means it is undefined.
      `,
      view: { class: 'foam.u2.Switch', switchSize: 'SMALL' },
      postSet: function(old, nu) {
        if ( old && ! nu ) {
          this.oldValue_ = this.data$?.dot(this.prop.name).get();
          this.data$.dot(this.prop.name).set(null);
        } else if ( nu && this.oldValue_ ) {
          this.data$.dot(this.prop.name).set(this.oldValue_);
        }
      }
    },
    'oldValue_'
  ],

  methods: [
    function layoutView(self, prop, viewSlot) {
      this.add(viewSlot);
    },

    function render() {
      var self    = this;
      var oldProp = this.prop;
      var prop    = this.prop = this.prop.clone(this.__subContext__).copyFrom(this.config);

      if ( ! prop.name ) {
        // Needed because some properties aren't bootstrapped properly and don't nave
        // 'name' in instance_.
        // Ex.: package, flags, extends, refines, javaExtends, order
        prop.name = oldProp.name;
      }

      this.addClass(this.myClass(prop.name));

      this.SUPER();

      if ( this.__context__.controllerMode$ )
        this.controllerMode$.follow(this.__context__.controllerMode$);

      var data = this.data;

      // TODO: Add simplified "required: true" UI
      // TODO: Required checks on props are ignored if validateObj returns undefined. Bug? - Sarthak
      /* Future Version:
      var errorSlot = prop.validators && prop.validationTextVisible ?
        foam.lang.Validation.orValidators(data, prop.validators) :
        this.ConstantSlot.create({ value: null });
      */

      var errorSlot;
      if ( prop.validationTextVisible && ( prop.validateObj || prop.internalValidateObj ) ) {
        errorSlot = this.SimpleSlot.create({ value: null });
        let linkErrorSlot = () => {
          if ( ! this.data ) return;
          // Re-find current prop when data changes since data might be a subclass of old data which might have different validation
          // requirements
          let currentProp = this.data.cls_.getAxiomByName(prop.name);
          if ( ! currentProp ) {
            console.log('**** PropertyBorder:', prop.name, 'not found in', this.data.cls_.id);
            return;
          }
          currentProp = currentProp.clone();
          var slot;

          // ???: Would it make more sense to combine these in Property as validateObj_?
          if ( currentProp.validateObj && currentProp.internalValidateObj ) {
            slot = foam.lang.ExpressionSlot.create({
              args: [ this.data.slot(currentProp.validateObj), this.data.slot(currentProp.internalValidateObj) ],
              // The commented out version will cause both internal and external errors to be displayed.
              // code: function (e1, e2) { return e1 ? e1 + ' ' + ( e2 || '' ) : e2; }
              // This version only displays internal errors or external errors if there are no internal.
              code: function (e1, e2) { return e2 || e1; }
            });
          } else {
            slot = currentProp.validateObj ?
              this.data.slot(currentProp.validateObj) :
              ( currentProp.internalValidateObj ? this.data.slot(currentProp.internalValidateObj) : this.SimpleSlot.create({ value: false }));
          }

          errorSlot.follow(slot);
        }
        this.onDetach(this.data$.sub(linkErrorSlot));
        linkErrorSlot();
      } else {
        errorSlot = this.ConstantSlot.create({ value: null });
      }


      var modeSlot = this.prop.createVisibilityFor(
        this.data$,
        this.controllerMode$);

      // Boolean version of modeSlot for use with show()
      var visibilitySlot = modeSlot.map(m => m != foam.u2.DisplayMode.HIDDEN);
      var colorSlot      = this.data$.dot(prop.name).map(v => ! prop.isDefaultValue(v));
      var labelSlot      = this.slot(function(prop$reserveLabelSpace, prop$label) {
        let el = this.E().addClass(this.myClass('label' + '-' + prop.name));
        return prop$label ?
          el.call(prop.labelFormatter, [data, prop]) :
          ( prop$reserveLabelSpace ? el : this.E().style({ display: 'contents' }) )
      });
      var supportingLabelSlot = this.slot(function(prop$supportingLabel) {
        let el = this.E().addClass(this.myClass('supportingLabel' + '-' + prop.name));
        return prop$supportingLabel ?
          el.call(prop.supportingLabel, [data, prop]) :
          this.E().style({ display: 'contents' })
      });

      var viewSlot = prop.view$.map(v => {
        // Add the Property's View
        var e = prop.toE({
          ...self.viewArgs,
          mode$: modeSlot
        }, this.__subContext__ );

        return this.E().addClass(self.myClass('view')).add(e).enableClass('error', errorSlot.and(colorSlot));
      });


      this.layout(prop, visibilitySlot, modeSlot, labelSlot, viewSlot, colorSlot, errorSlot, supportingLabelSlot);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'PropertyBorder',
  extends: 'foam.u2.AbstractPropertyBorder',

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 0.4rem;
      width: 100%;
    }
    ^view.error > span > input, ^view.error > span > input:focus {
      border-color: $destructive400!important;
    }
    ^colorText {
      color: $destructive400;
    }
    ^label {
      line-height: 1;
      min-height: 1em;
      width: 100%;
      color: $textSecondary;
    }
    ^supportingLabel {
      line-height: 1;
      min-height: 1em;
      width: 100%;
      color: $textTertiary;
    }
    ^errorText {
      display: flex;
      align-items: center;
      /*
        Have to use this style here since core uses CSS resets to
        set 1 rem = 10px instead of the default 16px
        May cause weird styling outside core
      */
      min-height: 1.25em;
      font-size: small;
      justify-content: flex-start;
      gap: 0.2rem;
    }
    ^errorText svg {
      width: 1rem;
      height: 1rem;
    }
    ^propHolder {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 0.2rem
    }
    ^propHolder > :first-child {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.4rem;
      width: 100%;
    }
    ^view {
      flex-grow: 1;
      max-width: 100%;
    }
    ^helper-icon svg {
      fill: currentColor;
    }
    ^labelHolder {
      width: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
    }
    ^labels {
      display: flex;
      flex-direction: column;
      gap: 0.2lh;
    }
  `,

  methods: [
    function layout(prop, visibilitySlot, modeSlot, labelSlot, viewSlot, colorSlot, errorSlot, supportingLabelSlot) {
      var self = this;

      this.
        addClass().
        show(visibilitySlot).
        start().
          addClass(this.myClass('labelHolder')).
          start().
          addClass(this.myClass('labels')).
          add(labelSlot.map(v => v.addClass(this.myClass('label'), 'p-light'))).
          add(supportingLabelSlot.map(v => v.addClass(this.myClass('supportingLabel'), 'p-legal'))).
          end().
        end().
        start().
          addClass(this.myClass('propHolder')).
          start('span').
            addClass(this.myClass('propHolderInner')).
            call(this.layoutView, [self, prop, viewSlot]).
          end().
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
              .start().addClass('p').add(prop.help).end()
            .end();
        });
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.',
  name: 'PropertyBorderPropertyRefinement',
  refines: 'foam.lang.Property',

  properties: [
    {
      name: 'optionalBorder',
      class: 'Boolean',
      documentation: `
        If true, the PropertyBorder will treat this property as optional.
        This is useful for properties that are not required to be set, shows a toggle next to the label by default.
      `,
      value: false
    }
  ]
})
