/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RichChoiceViewI18NComparator',

  imports: [
    'translationService?'
  ],

  constants: {
    CACHE: {}
  },

  methods: [
    function compare(o1, o2) {
      var k1 = this.key(o1);
      var k2 = this.key(o2);
      return foam.util.compare(k1, k2);
    },
    function key(o) {
      if ( this.CACHE[o.id] ) return this.CACHE[o.id];
      var k = o.toSummary ? o.toSummary() : o.id;
      if ( this.translationService ) {
        k = this.translationService.getTranslation(foam.locale, k, k);
      }
      this.CACHE[o.id] = k;
      return k;
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'RichChoiceViewSection',

  documentation: 'Models one section of the dropdown for a RichChoiceView.',

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      documentation: 'The DAO that will be used to populate the options in this section.'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'filteredDAO',
      documentation: 'A filtered version of the underlying DAO, depending on the search term the user has typed in.',
      expression: function(dao) { return dao; }
    },
    {
      class: 'Array',
      name: 'searchBy',
      documentation: 'An array of PropertyInfos to reduce the filter scope by. If empty or not set, revert to KEYWORD lookup.'
    },
    {
      class: 'Boolean',
      name: 'hideIfEmpty',
      value: true,
      documentation: 'This section will be hidden if there are no items in it if this is set to true.'
    },
    {
      class: 'Boolean',
      name: 'disabled',
      documentation: 'Rows in this section will not be selectable if this is set to true.'
    },
    {
      class: 'String',
      name: 'heading',
      documentation: 'The heading text for this section.'
    },
    {
      class: 'Int',
      name: 'choicesLimit'
    },
    {
      class: 'Boolean',
      name: 'refineInput_',
      value: true,
      documentation: 'If choicesLimit set, the flag is an indicator to show that more items could be populated.'
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'RichChoiceView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.CitationView',
    'foam.u2.view.RichChoiceViewI18NComparator',
    'foam.u2.md.OverlayDropdown'
  ],

  documentation: `
    This is similar to foam.u2.view.ChoiceView, but lets you provide views for
    the selection and options instead of strings. This allows you to create
    dropdowns with rich content like images and formatting using CSS.

    Example usage for a Reference property on a model:

      {
        class: 'Reference',
        of: 'foam.core.auth.User',
        name: 'exampleProperty',
        view: function(_, X) {
          return {
            class: 'foam.u2.view.RichChoiceView',
            selectionView: { class: 'a.b.c.MyCustomSelectionView' }, // Optional
            rowView: { class: 'a.b.c.MyCustomCitationView' }, // Optional
            sections: [
              {
                heading: 'Users',
                dao: X.userDAO.orderBy(foam.core.auth.User.LEGAL_NAME)
              },
              // Set "disabled: true" to render each object as non-selectable row
              // Set hideIfEmpty: true" to hide headers if not objects are present in dao provided.
              {
                disabled: true,
                heading: 'Disabled users',
                hideIfEmpty: true,
                dao: X.userDAO.where(this.EQ(foam.core.auth.User.LIFECYCLE_STATE, this.LifecycleState.DISABLED)),
              },
            ]
          };
        }
      }
  `,

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'window', 'ctrl?'
  ],

  exports: [
    'of', 'rowView'
  ],

  messages: [
    {
      name: 'CHOOSE_FROM',
      message: 'Choose from'
    },
    {
      name: 'CLEAR_SELECTION',
      message: 'Clear'
    },
    {
      name: 'MORE_CHOICES',
      message: 'Refine search to see more results'
    }
  ],

  css: `
    ^ {
      display: flex;
      position: relative;
    }

    ^setAbove {
      z-index: 1;
    }

    ^container {
      background: $white;
      border: 1px solid $grey400;
      max-height: min(400px, 40vh);
      overflow-y: auto;
      box-sizing: border-box;
      width: 100%;
      border-radius: 4px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 2px 8px 0 rgba(0, 0, 0, 0.16);
      z-index: 1000;
    }

    ^heading {
      color: $grey700;
      padding: 8px 4px;
    }

    ^selection-view {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      position: relative;
      min-height: $inputHeight;
      border: 1px solid $grey400;
      color: $black;
      background-color: $white;
      min-width: 120px;

      width: 100%;
      border-radius: 4px;
      -webkit-appearance: none;
      cursor: pointer;
    }
    ^dropdown {
      padding: 0 0.8rem;
    }
    ^dropdown svg {
      height: 1em;
      fill: currentColor;
      aspect-ratio: 1;
    }

    ^selection-view:hover,
    ^selection-view:hover ^clear-btn {
      border-color: $grey500;
      background: $grey50;
    }

    ^:focus {
      outline: none;
    }

    ^:focus ^selection-view,
    ^:focus ^selection-view ^clear-btn {
      border-color: $primary400;
    }

    ^custom-selection-view {
      flex-grow: 1;
      overflow: hidden;
    }

    ^search .property-filter_ {
      width: 100%;
    }

    ^search input {
      border: none;
      width: 100%;
      border: none;
      padding-left: $inputHorizontalPadding;
      padding-right: $inputHorizontalPadding;
      height: $inputHeight;
    }

    ^search input:focus-visible {
      border: none;
      outline: none;
    }

    ^search img {
      padding: 0 10px;
    }

    ^search {
      border-bottom: 1px solid #f4f4f9;
      display: flex;
    }

    ^container .disabled {
      filter: grayscale(100%) opacity(70%);
    }

    ^container .disabled:hover {
      cursor: default;
    }

    ^clear-btn {
      display: flex;
      align-items: center;
      border-left: 1px;
      padding-left: $inputHorizontalPadding;
      padding-right: $inputHorizontalPadding;
      height: $inputHeight;
      border-left: 1px solid;
      border-color: $grey400;
      margin-left: 12px;
      padding-left: 16px;
    }

    ^clear-btn:hover {
      color: $destructive400;
      cursor: pointer;
    }

    ^moreChoices {
      padding: 8px 16px;
    }
    
    ^section {
      border-bottom: 1px solid #f4f4f9;
    }
  `,

  properties: [
    'prop',
    {
      class: 'String',
      name: 'name',
      expression: function(prop) { return prop.name || 'select'; }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'rowView',
      documentation: `
        Set this to override the default view used for each row. It will be
        instantiated with an object from the DAO as the 'data' property.
      `,
      factory: function() {
        return this.CitationView;
      }
    },
    {
      name: 'data',
      documentation: `
        The value that gets chosen. This is set whenever a user makes a choice.
      `
    },
    {
      class: 'Boolean',
      name: 'clearOnReopen',
      documentation: 'clear filter on dropdown reopen if set to true',
      value: true
    },
    {
      class: 'Boolean',
      name: 'isOpen_',
      documentation: `
        An internal property used to determine whether the options list is
        visible or not.
      `,
      postSet: function(_, nv) {
        if ( nv && ! this.hasBeenOpenedYet_ ) this.hasBeenOpenedYet_ = true;
        if ( ! nv && this.clearOnReopen ) {
          this.clearProperty('filter_');
          this.sections.forEach((section) => {
            section.clearProperty('filteredDAO');
          });
        }
      }
    },
    {
      class: 'Boolean',
      name: 'hasBeenOpenedYet_',
      documentation: `
        Used internally to keep track of whether the dropdown has been opened
        yet or not. We don't want to waste resources pulling from the DAO until
        we know the user is going to interact with this dropdown.
      `
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'selectionView',
      documentation: `
        Set this to override the default view used for the input content. It
        will be instantiated with an object from the DAO as the 'fullObject'
        property and that object's id as the 'data' property.
      `,
      factory: function() {
        return this.DefaultSelectionView;
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.u2.view.RichChoiceViewSection',
      name: 'sections',
      documentation: `
        This lets you pass different predicated versions of a dao in different
        sections, which can be used to do things like grouping by some property
        for each section.
      `,
    },
    {
      class: 'Class',
      name: 'of',
      documentation: 'The model stored in the DAO. Used intenrally.',
      expression: function(sections) {
        return sections[0].dao.of;
      }
    },
    {
      class: 'FObjectProperty',
      name: 'fullObject_',
      documentation: `
        The full object from the DAO. This property is only used internally, you
        do not need to set it as a consumer of this view.
      `
    },
    {
      class: 'Boolean',
      name: 'search',
      documentation: 'Set to true to enable searching.'
    },
    {
      class: 'String',
      name: 'filter_',
      documentation: 'The text that the user typed in to search by.',
      postSet: function(oldValue, newValue) {
        this.sections.forEach((section) => {
          if ( newValue ) {
            if ( section.searchBy.length > 0 ) {
              var arrOfExpressions = section.searchBy.map((prop) => this.CONTAINS_IC(prop, newValue));
              var pred = this.Or.create({ args: arrOfExpressions });
            }
            else {
              var pred = this.KEYWORD(newValue);
            }
            section.filteredDAO = section.dao.where(pred);
          }
          else {
            section.filteredDAO = section.dao;
          }
          if ( section.choicesLimit )
            section.filteredDAO.select(this.COUNT()).then( v => {
                section.refineInput_ = v.value > section.choicesLimit;
            });
        });
      }
    },
    {
      class: 'String',
      name: 'searchPlaceholder',
      documentation: 'Replaces search box placeholder with passed in string.',
      value: 'Search...'
    },
    {
      class: 'String',
      name: 'choosePlaceholder',
      documentation: 'Replaces choose from placeholder with passed in string.',
      expression: function(of) {
        var plural = of.model_.plural.toLowerCase();
        return this.CHOOSE_FROM + ' ' + plural + '...';
      }
    },
    {
      type: 'Action',
      name: 'action',
      documentation: `
        Optional. If this is provided, an action will be included at the bottom
        of the dropdown.
      `
    },
    {
      class: 'FObjectProperty',
      name: 'actionData',
      documentation: `
        Optional. If this is provided alongside an action, the action will be executed
        with this data in the context.
      `
    },
    {
      class: 'Boolean',
      name: 'allowClearingSelection',
      documentation: `
        Set to true if you want the user to be able to clear their selection.
      `
    },
    {
      name: 'comparator',
      documentation: 'Optional comparator for ordering choices.',
      factory: function() {
        return this.RichChoiceViewI18NComparator.create();
      }
    },
    {
      name: 'idProperty',
      class: 'String',
      value: 'id'
    },
    'inputField',
    {
      class: 'FObjectProperty',
      of: 'foam.u2.Element',
      name: 'dropdown_',
      factory: function() {
        return this.OverlayDropdown.create({
          closeOnLeave: false,
          styled: false,
          parentEdgePadding: '4',
          lockToParentWidth: true
        });
      }
    },
    'selectionEl_'
  ],

  methods: [
    function render() {
      this.SUPER();

      var self = this;

      if ( ! Array.isArray(this.sections) || this.sections.length === 0 ) {
        throw new Error(`You must provide an array of sections. See documentation on the 'sections' property in RichTextView.js.`);
      }

      // If the property that this view is for already has a value when being
      // rendered, the 'data' property on this model will be set to an id for
      // the object being referenced by the Reference property being rendered.
      // Custom views might need the full object to render though, not just the
      // id, so we do a lookup here for the full object here. This then gets
      // passed to the selectionView to use it if it wants to.
      this.onDetach(this.data$.sub(this.onDataUpdate));
      this.onDataUpdate();

      this.onDetach(() => this.dropdown_.remove());
      this.attrs({
        name: self.prop$.map(v => v?.name),
        'data-value': self.data$,
        'role': 'combobox',
        'aria-controls': 'listbox',
        'aria-haspopup': 'listbox',
        'aria-expanded': self.isOpen_$.map(v => v ? 'true' : 'false')
      });
      self.isOpen_$.follow(this.dropdown_.opened$);
      self.dropdown_.add(self.slot(function(hasBeenOpenedYet_) {
        if ( ! hasBeenOpenedYet_ ) return this.E();
        return this.E()
          .addClass(self.myClass('container'))
          .add(self.search$.map(searchEnabled => {
            if ( ! searchEnabled ) return null;
            return this.E()
              .start()
                .start('img')
                  .attrs({ src: '/images/ic-search.svg' })
                .end()
                .startContext({ data: self })
                  .addClass(self.myClass('search'))
                  .tag(self.FILTER_.clone().copyFrom({ view: {
                    class: 'foam.u2.TextField',
                    placeholder: this.searchPlaceholder || 'Search... ',
                    focused: true,
                    onKey: true
                  } }), {}, self.inputField$)
                .endContext()
              .end();
          }))
          .add(self.slot(function(sections) {
            var promiseArray = [];
            sections.forEach(function(section) {
              promiseArray.push(section.dao.select(self.COUNT()));
            });
            return Promise.all(promiseArray).then(resp => {
              var index = 0;
              return this.E().forEach(sections, function(section) {
                section.refineInput_ = resp[index].value > section.choicesLimit;
                this.addClass(self.myClass('setAbove'))
                  .start().addClass(self.myClass('section'))
                  .start().hide(!! section.hideIfEmpty && resp[index].value <= 0 || ! section.heading)
                    .addClass('h600', self.myClass('heading'))
                    .translate(section.heading$)
                  .end()
                  .start()
                    .select( section.choicesLimit ? section.filteredDAO$proxy.limit(section.choicesLimit) : section.filteredDAO$proxy, obj => {
                      return this.E()
                        .start(self.rowView, { data: obj })
                          .attr('disabled', section.disabled)
                          .attr('role', 'option')
                          .enableClass('disabled', section.disabled)
                          .callIf(! section.disabled, function() {
                            this.on('click', () => {
                              self.onSelect(obj);
                              self.dropdown_.close();
                            });
                          })
                        .end();
                    }, false, self.comparator)
                  .end()
                  .callIf(section.choicesLimit, function() {
                    this.start()
                      .addClass(self.myClass('moreChoices'))
                      .add(section.refineInput_$.map(v => v ? self.MORE_CHOICES : ''))
                    .end();
                  })
                  .end();
                  index++;
              });
            });
          }))
          .add(this.slot(self.addAction));
      }));

      this
        .add(this.slot(function(mode) {
          if ( mode !== foam.u2.DisplayMode.RO && mode !== foam.u2.DisplayMode.HIDDEN ) {
            if ( self.ctrl ) {
              self.ctrl.add(this.dropdown_);
            } else {
              this.dropdown_.write();
            }
            return self.E()
              .attrs({ tabindex: 0 })
              .addClass(this.myClass())
              .start('', {}, this.selectionEl_$)
                .addClass(this.myClass('selection-view'))
                .enableClass('disabled', this.mode$.map((mode) => mode === foam.u2.DisplayMode.DISABLED))
                .on('click', function(e) {
                  var x = e.clientX || this.getBoundingClientRect().x;
                  var y = e.clientY || this.getBoundingClientRect().y;
                  if ( self.mode === foam.u2.DisplayMode.RW ) {
                    self.dropdown_.parentEl = self.selectionEl_.el_();
                    self.dropdown_.open(x, y);
                    if ( self.inputField ) self.inputField.focused = true;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                })
                .start()
                  .addClass(this.myClass('custom-selection-view'))
                  .tag(self.selectionView, {
                      data$: self.data$,
                      fullObject$: self.fullObject_$,
                      defaultSelectionPrompt$: this.choosePlaceholder$
                    })
                .end()
                .start({ class: 'foam.u2.tag.Image', glyph: 'dropdown' })
                  .addClass(self.myClass('dropdown'))
                .end()
                .add(this.slot(function(allowClearingSelection) {
                  if ( ! allowClearingSelection ) return null;
                  return this.E()
                    .addClass(self.myClass('clear-btn'))
                    .on('click', self.clearSelection)
                    .add(self.CLEAR_SELECTION);
                }))
              .end();
          } else {
            return self.E()
              .addClass(this.myClass())
                .start()
                  .addClass(this.myClass('custom-selection-view'))
                  .tag(self.selectionView, {
                    mode$: self.mode$,
                    fullObject$: self.fullObject_$,
                    defaultSelectionPrompt$: self.choosePlaceholder$
                  })
                .end();
          }
        }));
    },

    function onSelect(obj) {
      this.fullObject_ = obj;
      this.data = obj[this.idProperty];
      this.isOpen_ = false;
    },

    function addAction(action, actionData) {
      var self = this;
      if ( action && actionData ) {
        return this.E()
          .start(self.DefaultActionView, { action: action, data: actionData })
          .on('click', () => {
            self.dropdown_.close();
          })
          .addClass(self.myClass('action'))
          .end();
      }
      if ( action ) {
        return this.E()
          .start(self.DefaultActionView, { action: action })
          .on('click', () => {
                self.dropdown_.close();
              })
          .addClass(self.myClass('action'))
          .end();
      }
    },
    function updateMode_(mode) {
      if ( mode !== foam.u2.DisplayMode.RW ) {
        this.isOpen_ = false;
      }
    },

    function fromProperty(property) {
      this.SUPER(property);
      this.prop = property;
      if ( ! this.choosePlaceholder && prop.placeholder ) {
        this.choosePlaceholder = prop.placeholder;
      }
    }
  ],

  listeners: [
    {
      name: 'onDataUpdate',
      code: function() {
        if ( ! this.data ) {
          this.clearSelection();
          return;
        }
        this.sections.forEach(section => {
          if ( this.of ) {
            section.dao.where(
              this.EQ(this.of.getAxiomByName(this.idProperty), this.data)
            ).select().then(result => {
              if ( result.array.length > 0 ) {
                if ( section.disabled ) return this.clearSelection(); 
                this.fullObject_ = result.array[0];
              }
            }).catch( e => console.warn(e));
            return;
          }
          // majority of cases will fall into above code,
          // but incase a section is defined without a proper dao
          section.dao.find(this.data).then(result => {
            if ( result ) this.fullObject_ = result;
          }).catch( e => console.warn(e));
        });
      }
    },
    function clearSelection(evt) {
      evt && evt.stopImmediatePropagation();
      this.fullObject_ = undefined;

      // If this view is being used for a property, then when the user clears
      // their selection we set the value back to the default value for that
      // property type. We can't simply set it to undefined because that
      // introduces a bug where it's impossible to update an object to set a
      // Reference property back to a default value, since a value of undefined
      // will cause the JSON outputter to ignore that property when performing
      // the put. Instead, we need to explicitly set the value to the default
      // value.
      this.data = this.prop ? this.prop.value : undefined;
    }
  ],

  classes: [
    {
      name: 'DefaultSelectionView',
      extends: 'foam.u2.Element',

      documentation: `
        This is the view that gets rendered inside the select input. It is put
        to the left of the chevron (the triangle at the far right side of the
        select input). This is an Element instead of a simple string, meaning
        the select input can contain "rich" content like images and make use of
        CSS for styling and layout.
        As an example of why this is useful, imagine you wanted to show a
        dropdown to select a country. You could choose to display the flag of
        the selected country alongside its name after the user makes a
        selection by creating that custom view and providing it in place of this
        one by setting the selectionView property on RichChoiceView.
      `,

      requires: ['foam.u2.CitationView'],
      imports: [
        'of', 'rowView'
      ],

      css:`
        ^paddingWrapper {
          padding-left: $inputHorizontalPadding;
          padding-right: $inputHorizontalPadding;
        }
        ^customSelectView > div {
          padding: 4px 8px;
        }
      `,
      properties: [
        {
          name: 'data',
          documentation: 'The id of the selected object.',
        },
        {
          class: 'String',
          name: 'defaultSelectionPrompt'
        },
        {
          name: 'fullObject',
          documentation: `
            The full object. It's not used here in the default selection view,
            but this property is included to let you know that if you create a
            custom selection view, it will be passed the id of the object (data)
            as well as the full object.
          `
        }
      ],

      methods: [
        function render() {
          let self = this;
          this.style({
            'overflow': 'hidden',
            'white-space': 'nowrap',
            'text-overflow': 'ellipsis',
            'border-radius': '4px'
          });

          this.add(this.dynamic(function(fullObject) {
            if ( fullObject ) {
              this.addClass(self.myClass('customSelectView')).tag((self.rowView || self.CitationView), { data: fullObject });
            } else {
              this.start().addClass(self.myClass('paddingWrapper')).add(self.defaultSelectionPrompt).end();
            }
          }));
        }
      ]
    },
    {
      name: 'DefaultActionView',
      extends: 'foam.u2.ActionView',

      documentation: `
        This is the view that gets rendered at the bottom of the dropdown if an
        action is provided.
      `,

      css: `
        ^ {
          border: 0;
          border-top: 1px solid #f4f4f9;
          color: $primary400;
          display: flex;
          justify-content: flex-start;
          text-align: left;
          width: 100%;
        }

        ^:hover {
          color: $primary500;
          cursor: pointer;
        }

        ^ img + span {
          margin-left: 6px;
        }
      `
    }
  ]
});
