/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.comics.v2',
  name: 'DAOBrowserView',
  extends: 'foam.u2.View',

  documentation: `
    A scrolling table view customized for the inline DAOController
    with canned queries and a searchbar
  `,

  requires: [
    'foam.comics.SearchMode',
    'foam.comics.v2.DAOControllerConfig',
    'foam.log.LogLevel',
    'foam.u2.ActionView',
    'foam.u2.dialog.Popup',
    'foam.u2.dialog.StyledModal',
    'foam.u2.filter.FilterView',
    'foam.u2.layout.Cols',
    'foam.u2.layout.DisplayWidth',
    'foam.u2.layout.Rows',
    'foam.u2.stack.StackBlock',
    'foam.u2.view.OverlayActionListView',
    'foam.u2.view.SimpleSearch',
    'foam.u2.view.TabChoiceView'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  cssTokens: [
    {
      name: 'borderSize',
      value: '1px solid'
    }
  ],

  css: `
    ^wrapper {
      box-sizing: border-box;
      height: 100%;
      justify-content: flex-start;
    }

    ^top-bar {
      border-bottom: solid 1px $borderLight;
      align-items: center;
      padding-top: 16px;
    }

    ^toolbar {
      flex-grow: 1;
    }

    ^query-bar {
      padding: 6px 8px 6px 0;
      gap: 10px;
    }

    ^buttons.foam-u2-ButtonGroup{
      justify-content: flex-end;
      flex: 2 0 30%;
    }

    ^filters{
      padding: 0 24px;
      padding-bottom: 12px;
    }

    ^browse-view-container {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    ^actions svg {
      height: 1em;
      width: 1em;
    }

    /*
      Scroll is handled here to ensure summaryView always has a scroll
      even if it is not configured in the summaryView.
      This is the generalised way to do this but should be removed
      if double scroll bars start appearing
    */
    ^browse-view-container > * {
      height: 100%;
      overflow: auto;
    }

    ^canned-queries {
      padding: 0 16px;
    }

    ^ .foam-u2-view-SimpleSearch {
      flex-grow: 1;
    }

    ^ .foam-u2-view-SimpleSearch input {
      width: 100%;
      height: 34px;
      border-radius: 0 5px 5px 0;
      border: $borderSize;
    }
    @media only screen and (min-width:  /*%DISPLAYWIDTH.MD%*/ 768px) {
      ^query-bar {
        padding: 6px 8px 6px 0;
      }
    }
  `,

  messages: [
    { name: 'LAST_REFRESHED', message: 'Last refreshed' },
    { name: 'REFRESH_MSG',    message: 'Refresh Requested... ' },
    { name: 'ACTIONS',        message: 'Actions' }
  ],

  imports: [
    'auth',
    'ctrl',
    'displayWidth?',
    'exportDriverRegistryDAO?',
    'stack?'
  ],

  exports: [
    'config',
    'data as dao',
    'filteredTableColumns',
    'searchColumns',
    'serviceName'
  ],

  properties: [
    {
      name: 'lastRefresh',
      factory: function() { return new Date(); }
    },
    {
      class: 'StringArray',
      name: 'filteredTableColumns'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.DAOControllerConfig',
      name: 'config',
      factory: function() {
        return this.onDetach(this.DAOControllerConfig.create({dao: this.data}));

      }
    },
    {
      class: 'StringArray',
      name: 'searchColumns',
      factory: null,
      expression: function(config$searchColumns) {
        return config$searchColumns;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'summaryView',
      expression: function(config$summaryView) {
        return config$summaryView;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'cannedQueriesView',
      factory: function() {
        return {
          class: 'foam.u2.view.TabChoiceView'
        };
      }
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'cannedPredicate',
      expression: function(config$cannedQueries, config$preSelectedCannedQuery) {
        return config$cannedQueries && config$cannedQueries.length
          ? config$preSelectedCannedQuery != null
            ? config$cannedQueries[config$preSelectedCannedQuery].predicate
              : config$cannedQueries[1].predicate
                : foam.mlang.predicate.True.create();
      }
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'searchPredicate',
      expression: function(config$searchPredicate) {
        return config$searchPredicate ? config$searchPredicate : foam.mlang.predicate.True.create();
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'predicatedDAO',
      expression: function(config, cannedPredicate, searchPredicate) {
        var predicate = this.AND(cannedPredicate, searchPredicate);
        return config.dao$proxy.where(predicate);
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'searchFilterDAO',
      expression: function(config, cannedPredicate) {
        return config.dao$proxy.where(cannedPredicate);
      }
    },
    {
      name: 'serviceName',
      class: 'String',
      factory: function() {
        return this.data && this.data.serviceName ? this.data.serviceName : this.config.daoKey;
      }
    },
    {
      name: 'importModal',
      factory: function() {
        // Find DAO key from various sources:
        // - serviceName: set for normal menus via config.daoKey
        // - data.delegate.delegate.serviceName: set for Data Management menus (deeper nesting)
        var dao = this.serviceName ||
                  this.data?.delegate?.delegate?.serviceName ||
                  this.data?.delegate?.serviceName ||
                  this.config?.daoKey;
        // Remove 'service/' prefix if present
        if ( dao && dao.startsWith('service/') ) dao = dao.substring(8);
        return {
          class: 'foam.core.google.api.sheets.views.modal.ImportFromGoogleSheetsForm',
          of: this.config.of,
          dao: dao
        };
      }
    }
  ],

  methods: [
    function init() {
      // Reset the search filters when a different canned query is selected
      this.onDetach(this.cannedPredicate$.sub(() => {
        this.searchPredicate = foam.mlang.predicate.True.create();
      }));
      if ( this.config?.dao ) {
        this.data$ = this.config.dao$;
      }
    },
    function render() {
      [ this.EXPORT, this.IMPORT, this.REFRESH_TABLE ].forEach(action => {
        if ( this.config.DAOActions.indexOf(action) === -1 )
          this.config.DAOActions$push(action);
      });

      if ( ! foam.dao.QueryCachingDAO.isInstance(this.data) ) {
        this.data = this.onDetach(foam.dao.QueryCachingDAO.create({ delegate: this.data }, this));
      } else {
        this.data.cache = {};
      }

      var self = this;
      var filterView, cannedView, summaryView;
      var simpleSearch;

      this.addClass();
      this.SUPER();
      this
        .add(this.slot(function(config$cannedQueries, config$hideQueryBar) {
          // to manage memento imports for filter view (if any)
          if ( self.config.searchMode === self.SearchMode.SIMPLE ) {
            var simpleSearch = foam.u2.ViewSpec.createView(self.SimpleSearch, {
              showCount: false,
              data$: self.searchPredicate$
            }, this, self.__subSubContext__.createSubContext({
              controllerMode: foam.u2.ControllerMode.EDIT
            }));

            var filterView = foam.u2.ViewSpec.createView(self.FilterView, {
              dao$: self.searchFilterDAO$,
              data$: self.searchPredicate$
            }, this, self.__subContext__.createSubContext({
              controllerMode: foam.u2.ControllerMode.EDIT
            }));
          } else {
            var filterView = foam.u2.ViewSpec.createView(self.FilterView, {
              dao$: self.searchFilterDAO$,
              data$: self.searchPredicate$
            }, this, self.__subContext__.createSubContext({
              controllerMode: foam.u2.ControllerMode.EDIT
            }));
          }

          this.onDetach(this.cannedPredicate$.sub(() => {
            filterView?.clearAll();
          }));

          if ( config$cannedQueries.length >= 1 ) {
            cannedView = foam.u2.ViewSpec.createView(self.cannedQueriesView, {
              choices: config$cannedQueries.map((o) => [o.predicate, o.label]),
              data$: self.cannedPredicate$
            }, this, filterView.__subContext__);
          }

          var summaryContext = cannedView ? cannedView.__subContext__ : filterView.__subContext__;

          summaryView = foam.u2.ViewSpec.createView(self.summaryView ,{
            data: self.predicatedDAO$proxy,
            config: self.config
          }, this, summaryContext);

          if ( summaryView.selectedObjects )
            self.config.selectedObjs$ = summaryView.selectedObjects$;

          var buttonStyle = { size: 'SMALL', isIconAfter: true };

          return self.E()
            .start(self.Rows)
            .addClass(this.myClass('wrapper'))
              .callIf(config$cannedQueries.length >= 1, function() {
                this
                  .start(self.Cols)
                    .addClass(self.myClass('top-bar'))
                    .start(self.Cols)
                      .callIf(config$cannedQueries.length > 1, function() {
                        this
                          .start(cannedView)
                            .addClass(self.myClass('canned-queries'))
                          .end();
                      })
                    .end()
                  .end();
              })
              .callIf( ! config$hideQueryBar, function() {
                this
                  .start(self.Cols).addClass(self.myClass('query-bar'))
                    .startContext({
                      dao: self.searchFilterDAO
                    })
                    .call(function() {
                      if (self.config.searchMode === self.SearchMode.NONE) return;
                      if (self.config.searchMode === self.SearchMode.SIMPLE)
                        this.add(simpleSearch);
                      else
                      this.add(filterView);
                    })
                    .endContext()
                    .add(self.dynamic(function(config$DAOActions) {
                      this
                        .startContext({ data: self })
                          .start(foam.u2.ButtonGroup, { 
                            overlaySpec: { 
                              obj: self,
                              label: 'Actions', size: 'SMALL'
                            }
                          })
                            .addClass(self.myClass('buttons'))
                            .forEach(config$DAOActions, function(v) {
                              this.start(v, { size: 'SMALL' })
                                .callIf(v === self.REFRESH_TABLE, function() {
                                  this.tooltip$ = self.lastRefresh$.map(l => self.LAST_REFRESHED + ' ' + l.toLocaleString());
                                }).end()
                            })
                          .end()
                        .endContext();
                    }))
                  .end()
                  .start().tag(filterView.filtersContainer$).addClass(self.myClass('filters')).end();
              })
              .start()
                .add(summaryView)
                .addClass(self.myClass('browse-view-container'))
              .end()
            .end();
        }));
    }
  ],

  actions: [
    {
      name: 'export',
      label: 'Export',
      buttonStyle: 'PRIMARY',
      toolTip: 'Export Table Data',
      icon: 'images/export-arrow-icon.svg',
      isAvailable: async function(config) {
        if ( ! config.exportPredicate.f() ) return false;
        var records = this.exportDriverRegistryDAO && await this.exportDriverRegistryDAO.select();
        return records && records.array && records.array.length != 0;
      },
      code: function(X) {
        var adao;
        if ( this.config?.summaryView?.selectedObjects && ! foam.Object.equals(this.config.summaryView.selectedObjects, {}) ) {
          adao = foam.dao.ArrayDAO.create({ of: this.data.of });
          foam.Object.forEach(this.config.summaryView.selectedObjects, function(y) { adao.put(y) })
        }

        this.StyledModal.create({ title: 'Export', maxWidth: '90vw'}, X).tag({
          class: 'foam.u2.ExportModal',
          exportData: adao ? adao : this.predicatedDAO$proxy,
          predicate: this.config.filterExportPredicate
        }).open();
      }
    },
    {
      name: 'refreshTable',
      label: 'Refresh',
      toolTip: 'Refresh Table',
      icon: 'images/refresh-icon-black.svg',
      isAvailable: function(config) {
        return config.refreshPredicate.f();
      },
      code: function(X) {
        this.lastRefresh = new Date();
        this.config.dao.cmd_(X, foam.dao.DAO.PURGE_CMD);
        this.config.dao.cmd_(X, foam.dao.DAO.RESET_CMD);
        this.ctrl.notify(this.REFRESH_MSG, '', this.LogLevel.INFO, true, '/images/Progress.svg');
      }
    },
    {
      name: 'import',
      label: 'Import',
      icon: 'images/import-arrow-icon.svg',
      availablePermissions: [ "data.import.googleSheets" ],
      toolTip: 'Import From Google Sheet',
      isAvailable: function(config) {
        return config.importPredicate.f();
      },
      code: function(X) {
        this.StyledModal.create({ title: 'Import', maxWidth: '90vw'}, X).tag(this.importModal).open();
      }
    }
  ]
});
