/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'TableDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',

  requires: [
    'foam.u2.memento.Memento',
    'foam.comics.v2.DAOControllerConfig',
    'foam.u2.table.TableView'
  ],

  imports: [ 'columnStorage' ],

  properties: [
    {
      class: 'StringArray',
      name: 'columns'
    },
    {
      name: 'selection', hidden: true
    },
    {
      class: 'Map',
      name: 'selectedObjects'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Property',
      generateJava: false,
      name: 'groupBy',
      view: function(_, X) {
        return {
          class: 'foam.core.reflow.PropertyChoiceView',
          forCls: X.dao ? X.dao.of : X.of,
          allowClearingSelection: true
        };
      }
    },
    {
      name: 'tableEl',
      transient: true
    }
  ],

  methods: [
    // Temporary code needed to reset tableEl on saved flows
    function init() {
      this.tableEl = undefined;
    },
    function execute(e) {
      let self = this;
      // On re-execute (e.g. the source DAO rebuilt after a filter change) detach the
      // previous shown-dynamic and drop the cached table, so we rebind to the new `e`
      // and the current data. A pure `shown` toggle does not re-run execute(), so the
      // tableEl cache below still prevents flicker there, and hidden blocks still don't build.
      if ( this.shownDynamic_ ) this.shownDynamic_.detach();
      this.tableEl = undefined;
      this.shownDynamic_ = this.block.dynamic(function (shown) {
        if ( shown )
          self.execute_(e);
      });
      e.add(this.shownDynamic_);
    },
    function execute_(e) {
      // TODO: prevent table updates when block is hidden
      var self = this;
      // Tables already listen to underlying daos and are completely reactive by themselves as
      // opposed to other sinks, this means rendering the tables twice is just causing unecessary flickering that we can
      // avoid by returning the same table back
      if ( this.tableEl ) {
        this.tableEl.moveTo(e);
        return;
      }

      this.columns$.follow(this.block.value.columns$.map(
        c => c.trim().split(',').map(c => c.trim()).filter(c => c)
      ));
      this.block.value.value = this;

      var config = {
        data: self.unlimitedDAO,
        config: self.DAOControllerConfig.create({
          dao: self.unlimitedDAO,
          disableSelection: false
        }),
        groupBy$: self.groupBy$.map(v => v || null)
      };

      if ( this.columns.length ) {
//        var cs = JSON.parse(this.columnStorage.getItem(this.of.id));
//        if ( cs )
        //          config.selectedColumnNames = cs;
        config.selectedColumnNames$ = this.columns$;
      }

      var multiSelectActions = this.of.getAxiomsByClass(foam.lang.Action)?.filter(a => a.multiSelect)

      if ( multiSelectActions?.length ) {
        config.multiSelectEnabled = true;
        config.selectedObjects$ = this.selectedObjects$;
      }
      this.tableEl = foam.u2.WrapperNode.create({}, this);
      e.add(this.tableEl);
      this.tableEl
      .startContext({click: self.click, columnStorage: this.columnStorage})
        .callIf(config.multiSelectEnabled, function() {
          this.startContext({data: self})
            .start()
              .show(self.selectedObjects$.map(o => Object.keys(o).length > 0 ))
              .style({
                'display':'flex',
                'justify-content':'flex-end',
                'padding':'12px 0'
              })
              .add(multiSelectActions)
            .end()
          .endContext();
        })
        // Remove memento linking for this table so it doesnt conflict with
        // other tables in the flow
        .startContext({ memento_: this.Memento.create({obj: this}, this) })
          .start(self.TableView, config)
            .style({height: '600px'})
          .end()
        .endContext()
      .endContext();
    },
    function addToE(e) {
      var self = this;
      e.startContext({data: this})
        .start()
          .style({paddingLeft: '12px'})
        .tag(this.GROUP_BY.__, { data: this })
        .end();
    }
  ],

  listeners: [
    function click(_, id) {
      this.selection = id;
    }
  ]
});

/*
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'TableDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  methods: [
    function getSinkWithProjectionData(s) {
      s.columns = this.props;
      return s;
    },
    function getProjectionSink() { return foam.u2.mlang.Table.create({ columns: this.props }, this); },
    function getSink() { return foam.u2.mlang.Table.create({}, this); },
    function value(s) { return s; }
  ]
});
*/
