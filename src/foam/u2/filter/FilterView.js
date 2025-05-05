/**
* @license
* Copyright 2020 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.filter',
  name: 'FilterView',
  extends: 'foam.u2.View',
  mixins: [
    'foam.u2.memento.Memorable',
    'foam.util.DeFeedback'
  ],

  documentation: `
    Filter View takes the properties defined in 'searchColumns' and creates
    a filter option which allows a user to filter the DAO by.
  `,

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.u2.memento.Memento',
    'foam.lang.SimpleSlot',
    'foam.u2.dialog.Popup',
    'foam.u2.filter.FilterController',
    'foam.u2.filter.properties.PropertyFilterView',
    'foam.u2.search.TextSearchView',
    'foam.parse.QueryParser'
  ],

  imports: [
    'auth',
    'searchColumns'
  ],

  exports: [
    'as data',
    'filterController'
  ],

  css: `
    ^ {
      flex: 1;
      position: relative;
    }

    ^container-search {
      display: flex;
    }

    ^container-drawer {
      border-color: transparent;
      border-radius: 5px;
      display: flex;
      max-height: 0;
      overflow: hidden;
      padding: 0 24px;
      transition: all 0.24s linear;
      -webkit-transition: all 0.24s linear;
      -moz-transition: all 0.24s linear;
    }

    ^container-drawer-open {
      align-items: center;
      max-height: -webkit-fill-available;
      max-height: -moz-available;
      overflow: auto;
      padding: 24 0px;
    }

    ^container-filters {
      display: grid;
      grid-gap: 24px 16px;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      width: 100%;
    }

    ^general-field {
      margin: 0;
      flex: 0 0 60%;
    }

    ^general-field input {
      border: 1px solid $grey200;
      height: 34px;
      width: 100%;
    }

    ^container-handle {
      box-sizing: border-box;
      height: 34px;

      align-items: center;
      justify-content: center;
    }

    ^container-handle:hover {
      cursor: pointer;
    }

    ^filter-button svg{
      fill: initial;
      transform: rotate(0deg);
      transition: all 0.5s ease;
      font-size: 0.6rem;
    }

    ^filter-button-active{
      color: $primary400;
      background: $grey100;
    }

    ^filter-button-active svg {
      fill: $primary400;
      transform: rotate(180deg);
    }

    ^link-mode {
      margin-left: 16px;
      cursor: pointer;
    }

    ^link-mode.advanced {
      color: #9ba1a6;
      text-decoration: underline;
    }

    ^link-mode.advanced:hover {
      color: #5e6061;
    }

    ^link-mode.clear {
      align-self: center;
      color: $destructive400;
      flex-shrink: 0;
      margin-right: 0;
    }

    ^link-mode.clear:hover {
      color: $destructive700;
    }

    ^message-advanced {
      margin: 16px;
    }

    ^message-view {
      margin: 16px;
      margin-left: auto;
      color: #4D7AF7;
    }

    ^message-view:hover {
      cursor: pointer;
      color: #233E8B;
    }

    ^ .foam-u2-dialog-Popup-inner {
      width: 75%;
      height: 80%;
      border-radius: 5px;
    }
    /* tablet and desktop */
    @media only screen and (min-width: 768px) {
      ^container-search {
        gap: 24px;
      }
    }
  `,

  messages: [
    { name: 'LINK_ADVANCED', message: 'Advanced filters' },
    { name: 'LINK_SIMPLE', message: 'Switch to simple filters' },
    { name: 'MESSAGE_ADVANCEDMODE', message: 'Advanced filters are currently being used.' },
    { name: 'LABEL_FILTER', message: 'Filters' }
  ],

  properties: [
    {
      name: 'filtersContainer'
    },
    {
      class: 'Class',
      name: 'of'
    },
    {
      name: 'dao'
    },
    {
      name: 'data'
    },
    {
      class: 'Array',
      name: 'filters',
      factory: null
    },
    {
      name: 'generalSearchField',
      postSet: function(o, n) {
        this.filterController.add(n, n.name, 0, false);
      }
    },
    {
      name: 'filterController',
      factory: function() {
        return this.FilterController.create({
          dao$: this.dao$,
          finalPredicate$: this.data$
        });
      }
    },
    {
      class: 'Boolean',
      name: 'isOpen'
    },
    {
      class: 'Boolean',
      name: 'isFiltering',
      expression: function(data) {
        if ( ! data ) return false;
        return Object.keys(data.instance_).length > 0;
      }
    },
    {
      class: 'String',
      name: 'resultLabel',
      expression: function(isFiltering, filterController$totalCount, filterController$resultsCount ) {
        if ( ! isFiltering ) return '';
        return `${this.LABEL_RESULTS}${filterController$resultsCount} of ${filterController$totalCount}`;
      }
    },
    {
      class: 'String',
      name: 'iconPath',
      expression: function(isOpen) {
        return isOpen ? 'images/expand-less.svg' : 'images/expand-more.svg';
      }
    },
    {
      class: 'String',
      name: 'modeLabel',
      expression: function(filterController$isAdvanced) {
        return filterController$isAdvanced ? this.LINK_SIMPLE : this.LINK_ADVANCED;
      }
    },
    {
      name: 'mementoString',
      shortName: 'filters',
      memorable: true
    },
    {
      name: 'searchData',
      shortName: 'search',
      memorable: true
    }
  ],

  methods: [
    function init() {
      this.onDetach(this.searchColumns$.sub(this.updateFilters));
      this.onDetach(this.dao.of$.sub(this.updateFilters));
    },
    async function render() {
      var self = this;
      this.mementoString$.sub(this.getData);
      this.getData();
      this.filterController.mementoPredicate$.sub(this.updateMementoString);

      await this.updateFilters();

      this.onDetach(this.filterController$.dot('isAdvanced').sub(this.isAdvancedChanged));
      var selectedLabel = ctrl.__subContext__.translationService.getTranslation(foam.locale, 'foam.u2.filter.FilterView.SELECTED', this.SELECTED);
      this.addClass(self.myClass())
        .add(this.slot(function(filters) {

          var generalSearchField = foam.u2.ViewSpec.createView(self.TextSearchView, {
            of: self.dao.of.id,
            onKey: true,
            name: 'filterSearch',
            searchData$: self.searchData$
          }, this, self.__subContext__);


          var e = this.E();
          var labelSlot = foam.lang.ExpressionSlot.create({ args: [this.filterController.activeFilterCount$],
            code: function(x) { return x > 0 ? `${self.LABEL_FILTER} (${x})` : self.LABEL_FILTER; }});
          e.onDetach(self.filterController);
          e.start().addClass(self.myClass('container-search'))
            .start()
              .add(generalSearchField)
              .addClass(self.myClass('general-field'))
            .end()
            .start().addClass(self.myClass('container-handle'))
            .startContext({ data: self })
              .start(self.TOGGLE_DRAWER, { label$: labelSlot, isIconAfter: true, themeIcon: 'dropdown', size: 'SMALL' })
                .show(filters && filters.length)
                .enableClass(this.myClass('filter-button-active'), this.isOpen$)
                .addClass(this.myClass('filter-button'))
              .end()
            .endContext()
            .end()
            .start()
            .style({ overflow: 'hidden', 'align-self': 'center' })
            .end()
          .end();
          self.filtersContainer = this.E().add(self.filterController.slot(function (criterias) {
            if ( ! filters ) return self.E();
            return self.E().start().addClass(self.myClass('container-drawer'))
              .enableClass(self.myClass('container-drawer-open'), self.isOpen$)
                .start().addClass(self.myClass('container-filters'))
                  .show(self.isOpen$)
                  .forEach(filters, function(f) {
                    var axiom = self.dao.of.getAxiomByName(f);
                    if ( axiom ) {
                      var propView = foam.u2.ViewSpec.createView(self.PropertyFilterView, {
                        criteria: 0,
                        searchView: axiom.searchView,
                        property: axiom,
                        dao: self.dao,
                        preSetPredicate: self.assignPredicate(axiom)
                      }, self, self.__subContext__);

                      this.start()
                        .add(propView)
                        .hide(self.filterController$.dot('isAdvanced'))
                      .end();
                    }
                  })
                  .start('p')
                    .show(self.filterController$.dot('isAdvanced'))
                    .addClass(self.myClass('message-advanced'))
                    .add(self.MESSAGE_ADVANCEDMODE)
                  .end()
                  .start('p')
                    .show(self.filterController$.dot('isAdvanced'))
                    .addClass(self.myClass('message-view'))
                    .startContext({ data: self })
                      .tag(self.OPEN_ADVANCED, { buttonStyle: 'TERTIARY' })
                    .endContext()
                  .end()
                .end()
                .start()
                  .hide(self.filterController$.dot('isAdvanced'))
                  .addClass(self.myClass('link-mode'))
                  .addClass('clear')
                  .show(self.isOpen$)
                  .startContext({ data: self })
                    .tag(self.CLEAR_ALL, {
                      isDestructive: true,
                      buttonStyle: 'TERTIARY'
                    })
                  .endContext()
                .end()
            .end();
          }));
          //set here to avoid prematured finalPredicate override
          self.generalSearchField = generalSearchField;

          return e;
        }, this.filters$));
    },

    function addFilter(key) {
      this.filters = this.filters.concat(key);
    },

    function removeFilter(key) {
      this.filters = this.filters.filter(function(k) {
        return key !== k;
      });
    },

    //TODO: Move this to a tool? Would be useful for any large number
    function formatLargeValue(num) {
      var symbols = ['K', 'M', 'B', 'T'];
      var range = '';
      if ( num < 1000 ) return num;
      symbols.forEach((symbol, index) => {
        var lowerBound = Math.pow(10, (index + 1) * 3);
        var upperBound = lowerBound * 1000;
        if ( num >= lowerBound && num < upperBound ) {
          range = `~ ${Math.round(num/lowerBound)}${symbol}`;
        }
      });

      return range? range : 'Value too large';
    },
    async function filterPropertiesByReadPermission(properties, of) {
      if ( ! properties || ! of ) return [];
      var split = of.split('.');
      var modelName = split[split.length - 1].toLowerCase();

      var permissionedProperties = [];
      var unpermissionedProperties = [];

      var classProperties = foam.lookup(of).getAxiomsByClass(foam.lang.Property);
      for ( prop of classProperties ) {
        if ( properties.includes(prop.name) && ! prop.hidden ) {
          prop.readPermissionRequired ? permissionedProperties.push(prop.name) : unpermissionedProperties.push(prop.name);
        }
      }

      var perms =  await Promise.all(permissionedProperties.map( async p =>
        await this.auth.check(ctrl.__subContext__, modelName + '.rw.' + p) ||
        await this.auth.check(ctrl.__subContext__, modelName + '.ro.' + p)
      ));
      var grantedProperties =  permissionedProperties.filter((_v, index) => perms[index]);
      var unorderedProperties = grantedProperties.concat(unpermissionedProperties);
      return properties.filter(v => unorderedProperties.includes(v));
    },
    function assignPredicate(property) {
      var predicate = this.filterController.finalPredicate;
      var retPred = null;
      if ( predicate ) {
        if ( foam.mlang.predicate.And.isInstance(predicate) ) {
          var subPredicates = predicate.args;
          for ( subPredicate of subPredicates ) {
            let ret = this.unwrapPredicate(subPredicate, property);
            if ( ! ret ) continue;
            if ( retPred != null ) {
              retPred = this.AND(retPred, ret);
            } else {
              retPred = ret;
            }
          }
        } else {
          return this.unwrapPredicate(predicate, property);
        }
      }
      return retPred;
    },
    function unwrapPredicate(pred, prop) {
      if ( foam.mlang.predicate.Or.isInstance(pred) ) {
        var subPredicates = pred.args;
        for ( subPredicate of subPredicates ) {
          if ( subPredicate.arg1 && subPredicate.arg1.name == prop.name ) {
            // Replace OR with IN since the PropFilterViews expect IN
            let p = this.IN(subPredicate.arg1, subPredicates.map(s => {
              if ( s.arg1 && s.arg1.name == prop.name ) {
                return s.arg2.value;
              }
            }));
            return p;
          }
        }
      } else {
        if ( pred.arg1 && pred.arg1.name == prop.name ) return pred;
      }
    }
  ],

  listeners: [
    {
      name: 'updateMementoString',
      code: function() {
        this.deFeedback(() => {
          var mem = this.filterController.mementoPredicate.toMQL();
          if ( mem ) {
            this.mementoString = '{' + mem + '}';
          } else {
            this.mementoString = undefined;
          }
        });
      }
    },
    {
      name: 'getData',
      code: function() {
        this.deFeedback(() => {
          var queryParser = foam.parse.QueryParser.create({ of: this.dao.of }, this);
          var value = this.mementoString;
          if ( value && value.indexOf('{') != -1 && value.indexOf('}') != -1 ) {
            value = value.substr(value.indexOf('{') + 1, value.indexOf('}') - 1);
          }
          if ( value ) {
            var mementoPredicate = queryParser.parseString(value);
            this.data = (this.data != this.TRUE) ? this.AND(mementoPredicate, this.data) : mementoPredicate;
          }
        });
      }
    },
    {
      name: 'toggleMode',
      code: function() {
        if ( this.filterController.isAdvanced ) {
          // Switch back to simple mode
          this.filterController.switchToSimple();
          return;
        }
        this.filterController.switchToPreview();
        this.openAdvanced();
      }
    },
    {
      name: 'isAdvancedChanged',
      code: function() {
        if ( ! this.filterController.isAdvanced ) {
          this.filterController.add(this.generalSearchField, 'generalSearchField', 0);
          this.generalSearchField.mode = foam.u2.DisplayMode.RW;
        } else {
          this.generalSearchField.data = '';
          this.generalSearchField.mode = foam.u2.DisplayMode.DISABLED;
        }
      }
    },

    async function updateFilters() {
      var of = this.dao && this.dao.of;

      if ( ! of ) this.filters = [];

      var searchColumns_ = await this.filterPropertiesByReadPermission(this.searchColumns, of.id);
      if ( searchColumns_ ) {
        this.filters =  searchColumns_;
        return;
      }

      var columns = of.getAxiomByName('searchColumns');
      columns = columns && columns.columns;
      columns = await this.filterPropertiesByReadPermission(columns, of.id);
      if ( columns ) {
        this.filters = columns;
        return;
      }
    }
  ],

  actions: [
    {
      name: 'clearAll',
      label: 'Clear all',
      code: function() {
        // clear all filters
        if ( this.filterController.isAdvanced ) return;
        this.filterController.clearAll();
        if ( this.generalSearchField ) this.generalSearchField.view.data = '';
        this.mementoString = '';
      }
    },
    {
      name: 'toggleDrawer',
      label: 'Filters',
      icon: '/images/dropdown-icon.svg',
      code: function() {
        this.isOpen = ! this.isOpen;
      }
    },
    {
      name: 'openAdvanced',
      label: 'View filters',
      code: function() {
        this.add(this.Popup.create().tag({
          class: 'foam.u2.filter.advanced.AdvancedFilterView',
          dao$: this.dao$
        }));
      }
    }
  ]
});
