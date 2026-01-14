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
    'foam.log.LogLevel',
    'foam.u2.dialog.Popup',
    'foam.u2.filter.FilterController',
    'foam.u2.filter.properties.PropertyFilterView',
    'foam.u2.search.TextSearchView',
    'foam.parse.QueryParser',
    'foam.u2.filter.FilterConfigView'
  ],

  imports: [
    'auth',
    'notify',
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
      flex-direction: column;
      max-height: 0;
      overflow: hidden;
      padding: 0 24px;
      transition: all 0.24s linear;
      -webkit-transition: all 0.24s linear;
      -moz-transition: all 0.24s linear;
    }

    ^container-drawer-open {
      max-height: -webkit-fill-available;
      max-height: -moz-available;
      overflow: auto;
      padding: 24 0px;
      gap: 1.2rem;
    }

    ^container-filters {
      display: grid;
      grid-gap: 24px 16px;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      width: 100%;
    }

    ^general-field {
      margin: 0;
      flex: 0 0 85%;
    }

    ^general-field input {
      border: 1px solid $borderLight;
      height: 34px;
      width: 100%;
    }

    ^container-handle {
      display: flex;
      box-sizing: border-box;
      height: 34px;
      gap: 10px;
      align-items: center;
      justify-content: center;
    }

    ^container-handle:hover {
      cursor: pointer;
    }

    ^container-search {
      gap: 12px;
    }

    ^filter-button svg{
      fill: initial;
      transform: rotate(0deg);
      transition: all 0.5s ease;
      font-size: 0.6rem;
    }

    ^filter-button-active{
      color: $textBrand;
      background: $backgroundTertiary;
    }

    ^filter-search-active {
      border: 1px solid $borderBrand;
    }

    ^filter-button-active svg {
      fill: currentColor;
      transform: rotate(180deg);
    }

    ^link-mode {
      cursor: pointer;
    }

    ^settings-wrapper {
      display: flex;
      gap: 0.8rem;
      flex-shrink: 0;
    }
    /* tablet and desktop */
    @media only screen and (min-width: 768px) {
      ^container-search {
        gap: 24px;
      }
      ^container-drawer {
        flex-direction: row;
      }
      ^settings-wrapper {
        flex-direction: column;
      }
    }
  `,

  messages: [
    { name: 'LINK_ADVANCED',        message: 'Advanced filters' },
    { name: 'LINK_SIMPLE',          message: 'Switch to simple filters' },
    { name: 'MESSAGE_ADVANCEDMODE', message: 'Advanced filters are currently being used.' },
    { name: 'LABEL_FILTER',         message: 'Filters' }
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
      transient: true,
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
      name: 'iconPath',
      expression: function(isOpen) {
        return isOpen ? 'images/expand-less.svg' : 'images/expand-more.svg';
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
      this.onDetach(this.mementoString$.sub(this.getData));
      this.getData();
      this.onDetach(this.filterController.mementoPredicate$.sub(this.updateMementoString));

      await this.updateFilters();

      self.filtersContainer = this.E().addClass(self.myClass('container-drawer'))
      .enableClass(self.myClass('container-drawer-open'), self.isOpen$)
      .show(self.isOpen$)
      .tag(self.FilterConfigView, { dao$: self.dao$ })
      .add(self.dynamic(function (filters) {
        // This must be done as the predicate might change as the views are rendered;
        let currentPredicate = self.filterController.finalPredicate;
        if ( ! filters ) return;
        this
          .start().addClass(self.myClass('container-filters'))
            .forEach(filters, function(f) {
              var axiom = self.dao.of.getAxiomByName(f);
              if ( axiom ) {
                var propView = foam.u2.ViewSpec.createView(self.PropertyFilterView, {
                  criteria: 0,
                  searchView: axiom.searchView,
                  property: axiom,
                  dao: self.dao,
                  preSetPredicate: self.assignPredicate(axiom, currentPredicate)
                }, self, self.__subContext__);

                this.start()
                  .add(propView)
                .end();
              }
            })
          .end()
      }))
      .start()
        .addClass(self.myClass('settings-wrapper'))
        .start()
          .addClass(self.myClass('link-mode'))
          .addClass('clear')
          .startContext({ data: self })
            .tag(self.CLEAR_ALL, {
              isDestructive: true,
              buttonStyle: 'TERTIARY'
            })
          .endContext()
        .end()

      .end();

      this.addClass(self.myClass())
        .add(this.dynamic(function(filters) {
          var generalSearchField = foam.u2.ViewSpec.createView(self.TextSearchView, {
            of: self.dao.of.id,
            onKey: true,
            name: 'filterSearch',
            data$: self.searchData$
          }, self, self.__subContext__);

          var labelSlot = foam.lang.ExpressionSlot.create({ args: [self.filterController.activeFilterCount$],
            code: function(x) { return x > 0 ? `${self.LABEL_FILTER} (${x})` : self.LABEL_FILTER; }});

          this.start().addClass(self.myClass('container-search'))
            .start()
              .add(generalSearchField)
              .addClass(self.myClass('general-field'))
            .end()
            .start().addClass(self.myClass('container-handle'))
            .startContext({ data: self })
              .start(self.TOGGLE_DRAWER, { label$: labelSlot, isIconAfter: true, themeIcon: 'dropdown', size: 'SMALL' })
                .show(filters.length)
                .enableClass(self.myClass('filter-button-active'), self.isOpen$)
                .addClass(self.myClass('filter-button'))
              .end()
            .endContext()
            .end()
            .start()
            .style({ overflow: 'hidden', 'align-self': 'center' })
            .end()
          .end();
          //set here to avoid prematured finalPredicate override
          self.generalSearchField = generalSearchField;
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

      var permissionedProperties   = [];
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
      var grantedProperties   = permissionedProperties.filter((_v, index) => perms[index]);
      var unorderedProperties = grantedProperties.concat(unpermissionedProperties);
      return properties.filter(v => unorderedProperties.includes(v));
    },
    function assignPredicate(property, predicate) {
      predicate = predicate ?? this.filterController.finalPredicate;
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
          var pred = this.filterController.mementoPredicate;
          // TRUE doesn't have toMQL, so check if it exists
          var mem = pred.toMQL ? pred.toMQL() : '';
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
          if ( this.data && this.data !== this.TRUE ) return;
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

    async function updateFilters() {
      var of = this.dao && this.dao.of;

      if ( ! of ) this.filters = [];

      var searchColumns_ = await this.filterPropertiesByReadPermission(this.searchColumns, of.id);
      if ( searchColumns_?.length ) {
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
        this.filterController.clearAll();
        if ( this.generalSearchField ) this.generalSearchField.view.data = '';
        // Use undefined so hasDefaultValue() returns true and memento removes from URL
        this.mementoString = undefined;
      }
    },
    {
      name: 'toggleDrawer',
      label: 'Filters',
      icon: '/images/dropdown-icon.svg',
      code: function() {
        this.isOpen = ! this.isOpen;
      }
    }
  ]
});
