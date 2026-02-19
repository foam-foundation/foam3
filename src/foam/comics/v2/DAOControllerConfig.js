/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.comics.v2',
  name: 'DAOControllerConfig',

  documentation: `
    A customizable model to configure any DAOController
  `,
  implements: [ 'foam.mlang.Expressions' ],

  requires: [
    'foam.comics.SearchMode',
    'foam.comics.v2.CannedQuery',
    'foam.comics.v2.namedViews.NamedViewCollection',
    'foam.mlang.order.Desc'
  ],

  messages: [
    { name: 'VIEW_ALL',   message: 'View all ' },
    { name: 'CREATE_NEW', message: 'Create a New ' }
  ],

  properties: [
    {
      class: 'StringArray',
      name: 'order'
    },
    {
      name: 'click',
      documentation: 'Used to override the default click listener exported by DAOController',
      adapt: function(_, n) {
        if ( typeof n === 'function' ) return n;
        // adapt a class method path
        var lastIndex = n.lastIndexOf('.');
        var classObj  = foam.lookup(n.substring(0, lastIndex));
        return classObj[n.substring(lastIndex + 1)];
      }
    },
    {
      name: 'disableSelection',
      class: 'Boolean'
    },
    {
      class: 'String',
      name: 'daoKey'
    },
    {
      class: 'Class',
      name: 'factory'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'predicate',
      view: { class: 'foam.u2.view.JSONTextView' }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      hidden: true,
      expression: function(daoKey, predicate) {
        var dao = this.__context__[daoKey];
        if ( ! dao ) {
          console.error('Missing DAO:', daoKey);
          dao = foam.dao.NullDAO.create({of: foam.lang.FObject});
        }
        if ( this.hasOwnProperty('of') ) {
          dao = foam.dao.ProxyDAO.create({
            of: this.of,
            delegate: dao
          });
        }
        if ( predicate ) {
          dao = dao.where(predicate);
        }
        dao = dao.orderBy.apply(dao, this.order.map(p => p.split('-').length > 1 ?
          this.DESC(this.of.getAxiomByName(p.split('-')[1])) : this.of.getAxiomByName(p.split('-')[0])));
        return dao;
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'unfilteredDAO',
      hidden: true,
      expression: function(dao) {
        var delegate = dao;
        while ( delegate && foam.dao.ProxyDAO.isInstance(delegate) ) {
          if ( foam.dao.FilteredDAO.isInstance(delegate) ) {
            return delegate.delegate;
          }
          delegate = delegate.delegate;
        }
        return dao;
      }
    },
    {
      class: 'Class',
      name: 'of',
      expression: function(dao$of) { return dao$of; }
    },
    {
      class: 'String',
      name: 'browseTitle',
      factory: function() { return this.of.model_.plural; }
    },
    {
      class: 'String',
      name: 'emptyLabel',
      factory: function() { return this.of.model_.plural; }
    },
    {
      class: 'FObjectProperty',
      name: 'primaryAction',
      documentation: `
        The most important action on the page. The view for this controller may
        choose to display this action prominently.
      `,
      value: null
    },
    {
      class: 'Reference',
      of: 'foam.core.menu.Menu',
      name: 'primaryMenu',
      documentation: `
        When provided overrides primary action to launch provided menu.
      `,
      postSet: function(_, n) {
        this.primaryMenu$find.then(v => this.primaryAction = v)
      },
      value: null
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'createView',
      factory: function() {
        return {
          class: 'foam.u2.view.FObjectView',
          detailView: { class: 'foam.u2.detail.SectionedDetailView' }
        };
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'browseController',
      factory: function() {
        return {
          class: 'foam.comics.v3.DAOController'
        };
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'summaryView',
      expression: function(tableColumns, selectMode) {
        return {
          class: 'foam.u2.table.TableView',
          editColumnsEnabled: true,
          multiSelectEnabled: selectMode,
          columns: tableColumns,
          css: {
            width: '100%'
          }
        };
      }
    },
    {
      class: 'String',
      name: 'createTitle',
      expression: function(of) { return this.CREATE_NEW + of.model_.label; }
    },
    {
      class: 'Array',
      name: 'tableColumns',
      factory: null,
      expression: function(of) {
        var tableColumns = of.getAxiomByName('tableColumns');

        return tableColumns
          ? tableColumns.columns
          : of.getAxiomsByClass(foam.lang.Property).filter(p => ! p.hidden).map(p => p.name);
      }
    },
    {
      class: 'StringArray',
      name: 'searchColumns',
      factory: null,
      expression: function(of, tableColumns) {
        var tableSearchColumns = of.getAxiomByName('searchColumns');
        return tableSearchColumns ? tableSearchColumns.columns : [];
      }
    },
    {
      class: 'Enum',
      of: 'foam.comics.SearchMode',
      name: 'searchMode',
      help: `
        The level of search capabilities that the controller should have.
      `,
      value: 'FULL'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'browseBorder',
      factory: function() {
        // Can't use a value here because java tries to generate a HasMap
        // for it which doesn't jive with the AbstractFObjectPropertyInfo.
        return { class: 'foam.u2.borders.CardBorder' };
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.comics.v2.namedViews.NamedViewCollection',
      name: 'browseViews',
      factory: null,
      expression: function(of) {
        return of && of.getAxiomsByClass(this.NamedViewCollection);
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.comics.v2.CannedQuery',
      name: 'cannedQueries',
      factory: null,
      expression: function(of) {
        return of && of.getAxiomsByClass(this.CannedQuery);
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'viewBorder',
      factory: function() {
        // Can't use a value here because java tries to generate a HasMap
        // for it which doesn't jive with the AbstractFObjectPropertyInfo.
        return { class: 'foam.u2.borders.NullBorder' };
      }
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'createPredicate',
      documentation: 'If set to false, the "Create" button will not be visible.',
      factory: function() {
        return foam.mlang.predicate.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'copyPredicate',
      documentation: 'If set to false, the "Copy" button will not be visible.',
      factory: function() {
        return this.createPredicate;
      },
      javaFactory: `
        return getCreatePredicate();
      `
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'editPredicate',
      documentation: 'True to enable the edit button.',
      factory: function() {
        return foam.mlang.predicate.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'deletePredicate',
      documentation: 'True to enable the delete button in the DAOSummaryView.',
      factory: function() {
        return foam.mlang.predicate.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'refreshPredicate',
      documentation: 'True to enable the refresh button.',
      factory: function() {
        return foam.mlang.predicate.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'exportPredicate',
      documentation: 'True to enable the export button.',
      factory: function() {
        return foam.mlang.predicate.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'importPredicate',
      documentation: 'True to enable the import button.',
      factory: function() {
        return foam.mlang.predicate.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `
    },
    {
      of: 'foam.mlang.predicate.Predicate',
      name: 'filterExportPredicate',
      documentation: 'Filtering the types of formats user is able to export from TableView'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.CRUDEnabledActionsAuth',
      name: 'CRUDEnabledActionsAuth'
    },
    {
      class: 'Boolean',
      name: 'hideQueryBar'
    },
    {
      class: 'Boolean',
      name: 'selectMode',
      documentation: 'Enables multi-select mode for choosing objects (e.g., for Many-to-Many relationships).'
    },
    {
      class: 'String',
      name: 'selectTitle',
      value: 'Select',
      documentation: 'Label for the select button when selectMode is true.'
    },
    {
      class: 'Int',
      name: 'minHeight',
      documentation: 'minimum height for the table',
      value: 424
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'createController',
      documentation: 'class of createController.',
      factory: function() {
        return { class: 'foam.comics.v3.CreateView' };
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'detailView',
      documentation: 'class of detailView.'
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.Action',
      name: 'DAOActions',
      documentation: `Array of actions rendered by the DAOBrowserView,
      meant to be used to replace/override export, import and refresh`,
      adaptArrayElement: function(o) {
        if ( foam.lang.Action.isInstance(o) ) return o;
        var lastIndex = o.lastIndexOf('.');
        var classObj = foam.lookup(o.substring(0, lastIndex));
        return classObj[o.substring(lastIndex + 1)];
      },
      cloneProperty: function() { }
    },
    {
      class: 'Map',
      name: 'selectedObjs'
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'searchPredicate'
    },
    {
      class: 'Int',
      name: 'preSelectedCannedQuery'
    },
    {
      class: 'Reference',
      of: 'foam.core.menu.Menu',
      name: 'createMenu',
      documentation: 'Used as the menu to create a new object for this DAO',
    },
    // Legacy support
    {
      class: 'String',
      name: 'redirectMenu',
      getter: function() { return this.createMenu; },
      setter: function(v) { this.createMenu = v; }
    }
  ]
});
