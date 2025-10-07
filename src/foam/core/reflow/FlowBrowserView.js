/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * browser/controllerview overrides for flows
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowBrowserView',
  extends: 'foam.comics.BrowserView',

  requires: [
    'foam.core.reflow.FlowDAOControllerView as DAOControllerView'
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowDAOControllerView',
  extends: 'foam.comics.DAOControllerView',

  requires: [
    'foam.comics.SearchMode',
    'foam.comics.DAOController',
    'foam.comics.DAOUpdateControllerView',
    'foam.core.controller.Memento',
    'foam.core.u2.navigation.IFrameTopNavigation',
    'foam.u2.dialog.Popup',
    'foam.u2.filter.FilterView',
    'foam.u2.table.TableView'
  ],

  exports: [
    'click',
    'click as dblclick'
  ],

  imports: [
    'stack',
    'block'
  ],

  css: `
    ^ .foam-u2-filter-FilterView-container-search {
      min-width: 100%;
      gap:8px;
    }
    ^ .foam-u2-filter-FilterView-general-field {
      min-width: 80%;
    }
    ^ {
      display: flex;
      flex-direction: column;
      width: 100%;
      padding: 0;
      margin: 0
    }
    ^top-bar {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
    }
    ^filters{
      padding: 0 24px;
      padding-bottom: 12px;
    }
    ^button-span {
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      gap: 4px;
    }

    .foam-core-u2-navigation-Stack-padding .foam-core-u2-navigation-Stack-content > * {
      padding: 0;
    }
  `,

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'defaultSummaryView_',
      value: {
        class: 'foam.core.reflow.FlowEmbeddedTableView',
        rowsToDisplay: 5
      }
    },
    {
      class: 'Class',
      name: 'createControllerViewCls',
      value: 'foam.core.reflow.FlowDAOCreateControllerView'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.currentMemento_ = this.memento;

      this.data.createEnabled = true;
      this.data.selectEnabled = false;
      this.data.editEnabled   = false;
      this.data.exportEnabled = true;

      var filterView = foam.u2.ViewSpec.createView(this.FilterView, {
        dao$:  this.data.data$,
        data$: this.data.predicate$,
      }, this, this.__subContext__.createSubContext({
        controllerMode: foam.u2.ControllerMode.EDIT
      }));

      this
        .start().addClass(this.myClass())
          .start().addClass(this.myClass('top-bar'))
            .start().style({ 'min-width' : '70%' })
              .add(filterView)
            .end()
            .start('span')
              .addClass(this.myClass('button-span'))
              .show(this.mode$.map(function(m) { return m == foam.u2.DisplayMode.RW; }))
              .add(this.cls.getAxiomsByClass(foam.lang.Action))
            .end()
          .end()
          .start().tag(filterView.filtersContainer$).addClass(self.myClass('filters')).end()
          .start()
            .tag(self.summaryView, {
              data$: self.data.filteredDAO$,
              multiSelectEnabled: self.data.relationship,
              selectedObjects$: self.data.selectedObjects$
            })
          .end()
        .end();
    }
  ],

  listeners: [
    {
      name: 'onCreate',
      on: [
        'data.action',
        'data.create'
      ],
      code: function() {
        if ( this.block.out.childNodes.length > 1 ) {
          this.block.out.childNodes[1].remove();
        }
        const view = this.createControllerViewCls.create({
          dao: this.data.data
        }, this.__subContext__);
        this.block.out.add(view);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowDAOCreateControllerView',
  extends: 'foam.comics.DAOCreateControllerView',
  imports: ['block'],

  css: `
    ^ {
      width: 100%;
    }
    ^action-container {
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      padding: 12px 0;
      gap: 4px;
    }
  `,

  messages: [
    { name: 'CREATED', message: ' created'}
  ],

  actions: [
    {
      name: 'cancel',
      code: function() {
        this.remove();
      }
    },
    {
      name: 'save',
      buttonStyle: 'PRIMARY',
      code: function() {
        this.data.save();
        this.remove();
      }
    }
  ],

  listeners: [
    {
      name: 'onFinished',
      on: [
        'data.finished'
      ],
      code: function() {
        this.notify(this.dao.of.name + this.CREATED, '', this.LogLevel.INFO, true);
        this.remove();
      }
    },
    {
      name: 'onThrowError',
      on: [ 'data.throwError' ],
      code: function() {
        var self = this;
        self.notify(self.data.exception.message, '', self.LogLevel.ERROR, true);
      }
    }
  ]
})


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowEmbeddedTableView',
  extends: 'foam.u2.view.EmbeddedTableView',
  imports: ['block', 'detailView'],

  properties: [
    {
      name: 'click',
      expression: function(config$click) {
        let self = this;
        var importedClick;
        if ( config$click && typeof config$click === 'function' ) {
          importedClick = config$click;
        } else {
          importedClick = function(obj, id) {
            self.onClick(id);
          };
        }
        return function(obj, id) {
          importedClick.call(this, obj, id);
        };
      }
    },
    'view'
  ],

  methods: [
    function render() {
      this.editColumns = true;
      this.SUPER();
    },
    function setConfigPredicates() {
      this.SUPER();
      this.config.editPredicate =   foam.mlang.predicate.True.create();
      this.config.deletePredicate = foam.mlang.predicate.True.create();
    },

    function onClick(id) {
      if ( this.block.out.childNodes.length > 1 ) {
        this.block.out.childNodes[1].remove();
      }
      var stack = foam.core.u2.navigation.Stack.create({pos:0}, this.__subContext__);
      var ctx = this.__subContext__.createSubContext({ stack: stack });
      var detailView = foam.comics.v3.DetailView.create({
        data: this.data,
        config$: this.config$,
        idOfRecord: id
      }, ctx);
      detailView.finished.sub(this.onFinished);

      this.view = foam.u2.Element.create().start(stack).style({top: '12px'}).add(detailView).end();
      this.block.out.add(this.view);
    },

    function openFullTable() {
      this.rowsToDisplay += 5;
    }
  ],


  listeners: [
    {
      name: 'onFinished',
      code: function() {
        this.view.remove();
      }
    }
  ]
})
