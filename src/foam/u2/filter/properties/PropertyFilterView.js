/**
* @license
* Copyright 2019 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.filter.properties',
  name: 'PropertyFilterView',
  extends: 'foam.u2.View',

  documentation: `
    Property Filter View is in charge of displaying the correct Search View and
    restore the view's data if there is an existing predicate for the view that
    was selected by the user before.
  `,

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'filterController',
    'ctrl'
  ],

  requires: [
    'foam.parse.QueryParser',
    'foam.u2.md.OverlayDropdown'
  ],

  css: `
    ^container-property {
      display: flex;
      box-sizing: border-box;
      height: 32px;
      padding: 6px 8px;
      padding-right: 4px;
      border-radius: 3px;
      background: $backgroundSecondary;
    }

    ^container-property:hover {
      cursor: pointer;
    }

    ^container-property-filtering {
      background-color: $backgroundBrandTertiary;
      border: 1px solid $borderBrand;
    }

    ^container-property-filtering  ^label-property {
      color: $textBrand;
    }

    ^label-property {
      display: inline-block; 
      margin: 0;
      color: $textTertiary;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    ^container-filter {
      min-width: 216px;
      border-radius: 4px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 2px 8px 0 rgba(0, 0, 0, 0.16);
      border: solid 1px $borderLight;
      background-color: $backgroundDefault;
    }
    ^container-filter-header {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid $borderLight;
    }
  `,

  messages: [
    { name: 'LABEL_PROPERTY_ALL',    message: 'All' },
    { name: 'LABEL_PROPERTY_FILTER', message: 'Filtering' }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'activeFilterCheck_',
      value: true
    },
    {
      name: 'searchView',
      documentation: 'The FilterView to wrap. You must set this.',
      required: true
    },
    {
      class: 'Boolean',
      name: 'active',
      documentation: `
        Tracks if the property filter is currently being focused on or not. This
        affects UI and some logic.
      `
    },
    'container_',
    'property',
    'dao',
    {
      class: 'Boolean',
      name: 'firstTime_',
      value: true
    },
    'view_',
    {
      class: 'String',
      name: 'labelFiltering',
      factory: function() {
        return this.LABEL_PROPERTY_ALL;
      }
    },
    {
      class: 'String',
      name: 'iconPath',
      expression: function(active) {
        return active ? 'images/expand-less.svg' : 'images/expand-more.svg';
      }
    },
    {
      name: 'criteria'
      },
    'isInit',
    {
      name: 'queryParser',
      factory: function() {
        return this.QueryParser.create({ of: this.dao.of || this.__subContext__.lookup(this.property.forClass_) });
      }
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'preSetPredicate'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.u2.Element',
      name: 'overlay_',
      factory: function() {
        return this.OverlayDropdown.create({
          closeOnLeave: false,
          styled: false,
          parentEdgePadding: '4'
        });
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this.overlay_.parentEl = this.el_();
      this.onDetach(() => this.overlay_.remove());
      self.active$.follow(this.overlay_.opened$);
      if ( self.ctrl ) {
        self.ctrl.add(this.overlay_);
      } else {
        this.overlay_.write();
      }
      this.addClass()
        .start('div', {tooltip: this.property.label}).addClass(this.myClass('container-property'))
          .enableClass(this.myClass('container-property-active'), this.active$)
          .enableClass(this.myClass('container-property-filtering'), this.activeFilterCheck_$.not())
          .on('click', this.switchActive)
        .start('p').addClass('p-label-lg', this.myClass('label-property'))
          .add(`${this.property.label}: `)
          .start('span')
            .enableClass(this.myClass('placeholder-text'), this.activeFilterCheck_$)
            .add(this.labelFiltering$)
          .end()
        .end()
        .start()
          .addClass(this.myClass('dropdown-icon'))
          .start({ class: 'foam.u2.tag.Image', data$: this.iconPath$}).end()
        .end()
        .end();

      this.overlay_
        .start('div')
          .addClass(this.myClass('container-filter'))
          .start('div')
            .addClass(this.myClass('container-filter-header'))
            .startContext({ data: this })
              .tag(this.CLEAR_FILTER, { isDestructive: true })
            .endContext()
          .end()
          .start('div', null, this.container_$)
          .end()
        .end();

      this.isInit = true;
      // Load filters on render instead of open
      // Temp fix till filterController can be refactored to not depend on Search
      if ( this.firstTime_ )
        this.initView(false);
      this.isFiltering();
      this.isInit = false;
    }
  ],

  listeners: [
    function initView(addView = true) {
      // Restore the search view using an existing predicate for that view
      // This requires that every search view implements restoreFromPredicate
      var existingPredicate = this.filterController.getExistingPredicate(this.criteria, this.property);

      if ( ! existingPredicate && this.preSetPredicate != null ) {
        existingPredicate = this.preSetPredicate;
      }

      if ( this.firstTime_ && (addView || existingPredicate) ) {
        this.container_.tag(this.searchView, {
          property: this.property,
          dao$: this.dao$
        }, this.view_$);
      } else {
        return;
      }

      if ( existingPredicate ) {
        this.view_.restoreFromPredicate(existingPredicate);
      }

      // Add the view to be managed by the FilterController
      // This enables reciprocal search
      this.filterController.add(this.view_, this.property.name, this.criteria);

      // Prevents rerendering the view.
      this.firstTime_ = false;

      if ( this.preSetPredicate != null ) this.isFiltering();

      this.onDetach(this.view_$.dot('predicate').sub(this.isFiltering));
    },
    function switchActive(e) {
      this.active = ! this.active;

      // View is not active. Does not require creation
      if ( ! this.active ) return;
      // View has been instantiated before. Does not require creation
      if ( this.firstTime_ )
        this.initView();

      let x = e.clientX || this.getBoundingClientRect().x;
      let y = e.clientY || this.getBoundingClientRect().y;
      this.overlay_.open(x, y);
    },

    function isFiltering() {
      if ( ! this.isInit ) {
        if ( ! this.view_ )
          return;
      }

      // Since the existing predicates are lazy loaded (on opening the view),
      // check to see if there is an existing predicate to use the correct label
      if ( this.filterController.getExistingPredicate(this.criteria, this.property) && this.firstTime_ ) {
        this.labelFiltering = this.LABEL_PROPERTY_FILTER;
        this.activeFilterCheck_ = false;
        return;
      }
      if ( ! this.view_ ) return;
      // Displays the correct label depending on situation
        if ( this.view_.predicate !== this.TRUE && this.activeFilterCheck_ ) {
          this.labelFiltering = this.LABEL_PROPERTY_FILTER;
          this.activeFilterCheck_ = ! this.activeFilterCheck_;
        }
        else if ( this.view_.predicate === this.TRUE && ! this.activeFilterCheck_ ) {
          this.labelFiltering = this.LABEL_PROPERTY_ALL;
          this.activeFilterCheck_ = ! this.activeFilterCheck_;
        }
    }
  ],

  actions: [
    {
      name: 'clearFilter',
      label: 'Clear',
      buttonStyle: 'PRIMARY',
      size: 'SMALL',
      code: function() {
        this.filterController.clear(this.view_ || this.property.name, this.criteria, false);
        this.labelFiltering = this.LABEL_PROPERTY_ALL;
        this.activeFilterCheck_ = true;
      }
    }
  ]
});
