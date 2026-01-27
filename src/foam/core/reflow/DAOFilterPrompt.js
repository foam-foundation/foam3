/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DAOFilterPromptView',
  extends: 'foam.u2.View',

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    ^filters-container {
      padding: 0;
    }
    ^filters-container .foam-u2-filter-FilterView-container-drawer-open {
      padding: 10px 0 0;
    }
  `,

  methods: [
    function render() {
      var self = this;

      this
        .addClass()
        .show(this.data.visible$)
        .start('h3')
          .show(this.data.labelVisible$)
          .add(self.data.label$)
        .end()
        .start()
          .show(self.data.showSearch$)
          .add(self.data.filterView$)
        .end()
        .start()
          .addClass(self.myClass('filters-container'))
          .tag(self.data.filterView$.map(function(fv) {
            return fv ? fv.filtersContainer$ : null;
          }))
        .end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DAOFilterPrompt',

  requires: [
    'foam.dao.ProxyDAO',
    'foam.u2.filter.FilterView',
    'foam.core.reflow.DAOFilterPromptView',
    'foam.mlang.predicate.True'
  ],

  imports: [ 'block', 'scope', 'eval_' ],

  exports: [ 'dao', 'filteredDAO', 'searchColumns' ],

  properties: [
    {
      class: 'String',
      name: 'label',
      factory: function() {
        return this.dao ? this.dao.of.model_.plural + ' Filter' : 'DAO Filter';
      }
    },
    {
      class: 'Boolean',
      name: 'labelVisible',
      section: 'general',
      label: 'Show Name',
      value: true,
      view: { class: 'foam.u2.Switch' }
    },
    {
      class: 'Boolean',
      name: 'visible',
      value: true
    },
    {
      class: 'Boolean',
      name: 'showSearch',
      value: true
    },
    {
      class: 'String',
      name: 'query'
    },
    {
      name: 'filtersContainer',
      hidden: true
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      adapt: function(o, n, p) {
        let oldAdapt = foam.dao.DAOProperty.ADAPT;
        if ( foam.String.isInstance(n) ) {
          if ( this.scope[n] ) {
            this.daoKey = n;
            n = this.scope[n];
          } else if ( this.scope[n + 'DAO'] ) {
            this.daoKey = n + 'DAO';
            n = this.scope[n + 'DAO'];
          } else if ( this.__context__[n + 'DAO'] ) {
            n =  n + 'DAO';
          } else if ( n.endsWith('s') ) {
            this.daoKey = n;
            n = n.substring(0, n.length-1) + 'DAO';
          }
        }
        return oldAdapt.value.call(this, o, n, p);
      }
    },
    {
      name: 'predicate',
      hidden: true,
      factory: function() {
        return this.True.create();
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'filteredDAO_',
      hidden: true,
      transient: true,
      expression: function(dao, predicate) {
        if ( ! dao ) return null;
        return predicate ? dao.where(predicate) : dao;
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'filteredDAO',
      factory: function() { return this.ProxyDAO.create({delegate$: this.filteredDAO_$}); }
    },
    {
      name: 'filterView',
      hidden: true,
      expression: function(dao, showSearch) {
        if ( ! dao ) return null;
        var fv = this.FilterView.create({
          dao: dao,
          searchMode: foam.comics.SearchMode.MQL,
          data$: this.predicate$,
          searchData$: this.query$,
          isOpen: ! showSearch  // When search is hidden, filters should be open
        }, this.__subContext__.createSubContext({
          controllerMode: foam.u2.ControllerMode.EDIT,
          config: { searchMode: foam.comics.SearchMode.MQL }
        }));

        // Store reference to filtersContainer
        if ( fv.filtersContainer$ ) {
          this.filtersContainer = fv.filtersContainer$;
        }

        return fv;
      }
    },
    {
      class: 'StringArray',
      name: 'searchColumns',
      hidden: true,
      factory: null,
      expression: function(dao) {
        if ( ! dao || ! dao.of ) return [];
        var searchColumnsAxiom = dao.of.getAxiomByName('searchColumns');
        return searchColumnsAxiom ? searchColumnsAxiom.columns : [];
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.tag(this.DAOFilterPromptView, {data: this, label: this.label});
    }
  ],

  actions: [
    {
      name: 'viewFilteredDAO',
      label: 'View Filtered Data',
      documentation: 'View the filtered data based on current filter criteria',
      buttonStyle: 'PRIMARY',
      code: function() {
        this.eval_(`dao("${this.block.flowName}.filteredDAO")`);
      }
    }
  ]
});
