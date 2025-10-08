/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'EmbeddedTableView',
  extends: 'foam.u2.View',

  requires: [
    'foam.comics.v2.DAOBrowseControllerView',
    'foam.comics.v3.DAOController',
    'foam.comics.v2.DAOControllerConfig',
    'foam.u2.borders.CardBorder',
    'foam.u2.stack.StackBlock',
    'foam.u2.table.TableView'
  ],

  imports: ['stack', 'detailView'],

  exports: [
    'click',
    'config'
  ],

  documentation: `A summary view for tables that shows the first n rows
  in a table with an action to expand the table to DAOBrowseControllerView`,

  css: `
    ^button{
      max-height: 56px;
      width: 100%;
    }
    ^wrapper.foam-u2-borders-CardBorder{
      box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
      padding: 0px;
    }
  `,

  messages: [
    { name: 'VIEW_MORE', message: 'View More' }
  ],

  properties: [
    {
      class: 'Int',
      name: 'rowsToDisplay',
      value: 2
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    'prop',
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.DAOControllerConfig',
      name: 'config',
      factory: function() {
        return this.DAOControllerConfig.create({ dao: this.data });
      }
    },
    'view_',
    {
      name: 'click',
      expression: function(config$click) {
        let self = this;
        var importedClick;
        if ( config$click && typeof config$click === 'function' ) {
          importedClick = config$click;
        } else {
          importedClick = function(obj, id) {
            self.openFullTable(id);
          };
        }
        return function(obj, id) {
          importedClick.call(this, obj, id);
        };
      }
    },
    {
      name: 'daoCount',
      expression: async function(data, rowsToDisplay) {
        // not selecting count because want num entries with limit and skip applied
        var daoCount = (await data.select()).array;
        return Math.max(daoCount.length - rowsToDisplay, 0);
      }
    },
    {
      class: 'Boolean',
      name: 'multiSelectEnabled',
      documentation: 'Set to true to support selecting multiple table rows.'
    },
    {
      class: 'Map',
      name: 'selectedObjects',
      documentation: `
        The objects selected by the user when multi-select support is enabled.
        It's a map where the key is the object id and the value is the object.
      `
    }
  ],

  methods: [
    function setConfigPredicates() {
      this.config.editPredicate =   foam.mlang.predicate.False.create();
      this.config.copyPredicate =   foam.mlang.predicate.False.create();
      this.config.createPredicate = foam.mlang.predicate.False.create();
      this.config.deletePredicate = foam.mlang.predicate.False.create();
    },
    async function render() {
      // Default controller config that would be used for nested tables if no menu config can be found.
      // Update this to be a fallback for menuKeys when we have menuKeys for references, DAOproperties and relationships
      this.setConfigPredicates();
      let self = this;
      this.detailView?.dynamic(function(route) {
        self.handlePropertyRouting();
      })
      let mem = foam.u2.memento.Memento.create({}, this);
      this.add(this.slot(async function(data, daoCount) {
        daoCount = await daoCount;
        return this.E().start(this.CardBorder).addClass(this.myClass('wrapper'))
            .startContext({ memento_: mem})
            .start(this.TableView, {
              data$: this.slot(function(rowsToDisplay) {return data.limit(rowsToDisplay)}),
              // editColumnsEnabled: false,
              multiSelectEnabled: self.multiSelectEnabled,
              selectedObjects$: self.selectedObjects$,
              showPagination: false
            })
              .addClass(this.myClass())
            .end()
            .endContext()
          .startContext({ data: this })
            .start(this.OPEN_TABLE, { label: `${this.VIEW_MORE} (${daoCount})`, buttonStyle: 'TERTIARY', themeIcon: 'plus' })
              .addClass(this.myClass('button'))
            .end()
          .endContext()
        .end();
      }));
    },
    function handlePropertyRouting() {
      if ( ! this.detailView?.route ) return;
      if ( this.detailView.route == this.prop?.name ) {
        if ( this.view_?.shown ) {
          return;
        }
        this.view_ = undefined;
        this.openFullTable();
      }
    },
    function fromProperty(p) {
      this.prop = p;
      this.SUPER(p);
    },
    function openFullTable(id) {
      this.view_ = this.stack.push({
        ...this.config.browseController,
        data: this.data,
        config: this.config,
        idOfRecord: id,
      }, this.detailView);
    }
  ],

  actions: [
    {
      name: 'openTable',
      isEnabled: async function(daoCount) {
        return ( await daoCount ) > 0;
      },
      code: function() {
        this.openFullTable();
      }
    }
  ]
});
