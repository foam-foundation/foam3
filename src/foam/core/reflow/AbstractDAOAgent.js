/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AbstractDAOAgent',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.dao.ArraySink',
    'foam.core.reflow.ErrorView'
  ],

  imports: [ 'block', 'dao as referenceDAO', 'sinkDAO as dao', 'sinkUnlimitedDAO as unlimitedDAO' ],

  exports: [ 'dao' ],

  properties: [
    {
      name: 'of',
      transient: true,
      hidden: true,
      factory: function() { return this.referenceDAO?.of; }
    }
  ],

  methods: [
    function value(s) { return null; },
    function createSink() { return this.ArraySink.create(); },
    async function execute(e) {
      var sink = this.createSink();
      let self = this;
      return this.dao.select(sink).then(s => {
        if ( this.block.value && this.block.value.VALUE ) {
          this.block.value.value = this.value(s);
        } else {
          this.block.value = this.value(s);
        }

        // This is needed in case the Sink traveled across the network but needs values
        // (like 'block') from the current context.
        s = s.clone(this.__subContext__);

        e.startContext({dao: this.dao})
          .start()
            .call(function() {
              self.addSinkToE(this, s);
            })
          .end()
        .endContext();
      }).catch(error => {
        console.error('AbstractDAOAgent execution error:', error);
        e.tag(self.ErrorView, { error: error });
        // Don't re-throw the error to allow other blocks to continue loading
      });
    },
    function addSinkToE(e, s) {
      e.add(s);
    },
    function addToE() {}
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AbstractSinkDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',

  properties: [
    {
      name: 'sink',
      preSet: function(o, n) {
        // Temporary fix to recontextualize the object after load.
        // TODO: remove once JSON parsing/loading is fixed
        if ( n && n.__context__ != this.__subContext__ ) {
          return n.clone(this.__subContext__);
        }
        return n;
      }
    }
  ],

});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AbstractColumnAwareDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  imports: [
    'block',
    'dao as referenceDAO',
    'sinkDAO as dao',
    'sinkUnlimitedDAO as unlimitedDAO',
    'columns?'
  ],

  properties: [
    'props',
    [ 'useProjection', false ]
  ],

  methods: [
    function createSink() {
      return this.useProjection ? this.getProjectionSink() : this.getSink();
    },
    function addSinkToE(e, s) {
      s = this.useProjection ? this.getSinkWithProjectionData(s) : s;
      e.add(s);
    },
    async function execute(e) {
      var SUPER = this.SUPER.bind(this);
      if ( this.columns?.length ) {
        this.props = this.columns.split(',');
        this.useProjection = true;
      } else {
        this.props = null;
        this.useProjection = false;
      }
      return SUPER(e);
    },
    function getProjectionSink() {
      var exprArray = [];
      for ( var propName of this.props ) {
        var expr = this.of.getAxiomByName(propName) || foam.core.column.NestedPropertiesExpression.create({ objClass: this.of, nestedProperty: propName });
        if ( foam.dao.DAOProperty.isInstance(expr) ||
            foam.dao.OneToManyRelationshipProperty.isInstance(expr) ||
            foam.dao.ManyToManyRelationshipProperty.isInstance(expr) )
          continue
        if ( expr )
          exprArray.push(expr);
      }

      return this.Projection.create({ exprs: exprArray, useProjection: true });
    },
    function getSinkWithProjectionData(s) {
      if ( this.Projection.isInstance(s) ) {
        var data = [];
        var of = { __proto__: this.of };
        of.private_ = { axiomCache: {'foam.lang.Property': s.exprs} }
        s.projection.forEach(p => {
          var objSpec = {};
          var i = 0;
          s.exprs.forEach(e => {
            objSpec[e.name] = p[i++];
          });
          data.push(of.create(objSpec));
        })
        var sink = this.getSink();
        sink.of = of;
        sink.array = data;
        return sink;
      }
      return s;
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ScriptDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  properties: [
    {
      class: 'String',
      name: 'code',
      value: '// var o is the current object\nlog(o.id);\n',
      view: { class: 'foam.u2.tag.TextArea', rows: 6 },
      displayWidth: 60
    }
  ],

  methods: [
    function execute(e) {
      return this.dao.select(this.createSink()).then(s => {
        var a = s.array;
        for ( var i = 0 ; i < a.length ; i++ ) {
          var o = a[i];
          // TODO: get a better scope from Console
          with ( { o: o, log: this.__context__.log } ) {
            eval(this.code);
          }
        }
      });
    },
    function createSink() { return this.ArraySink.create(); },
    function addToE(e) {
      e.startContext({data: this}).start().style({display: 'flex'}).
        add(this.CODE);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CountDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  methods: [
    function value(s) {
      if ( this.block.value && s.cls_ === this.block.value.cls_ ) {
        this.block.value.copyFrom(s);
        return this.block.value;
      }
      return s;
    },
    function createSink() { return this.COUNT(); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'MinDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  properties: [
    {
      name: 'prop',
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyChoiceView', forCls: X.data.of };
      }
    }
  ],

  methods: [
    function value(s) { return s; },
    function createSink() { return this.MIN(this.prop); },
    function addToE(e) {
      e.startContext({data: this}).start().
        style({display: 'flex'}).
        add(this.PROP);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'MaxDAOAgent',
  extends: 'foam.core.reflow.MinDAOAgent',
  methods: [
    function createSink() { return this.MAX(this.prop); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AvgDAOAgent',
  extends: 'foam.core.reflow.MinDAOAgent',

  properties: [
    {
      name: 'prop',
      view: function(_, X) {
        return {
          class: 'foam.core.reflow.PropertyChoiceView',
          forCls: X.data.of,
          predicate: function(p) {
            // Other number types are all descendents of Int
            return foam.lang.Int.isInstance(p);
          }
        };
      }
    }
  ],

  methods: [
    function createSink() { return this.AVG(this.prop); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'SumDAOAgent',
  extends: 'foam.core.reflow.AvgDAOAgent',
  methods: [
    function createSink() { return this.SUM(this.prop); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'TableDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',

  requires: [
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
    }
  ],

  methods: [
    function execute(e) {
      var self = this;

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

      e.startContext({click: self.click, columnStorage: this.columnStorage}).
        callIf(config.multiSelectEnabled, function() {
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
          }).
        start(self.TableView, config).
          style({height: '600px'});

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


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CSVDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  requires: [ 'foam.dao.CSVSink', 'foam.core.reflow.CopyFromBorder' ],

  methods: [
    function value(s) { return foam.lang.StringHolder.create({value: s.csv}); },
    function getSinkWithProjectionData(s) { return s; },
    function getProjectionSink() { return this.CSVSink.create({ of: this.of, props: this.props }); },
    function getSink() { return this.CSVSink.create({of: this.of}); },
    function addSinkToE(e, s) { e.start(this.CopyFromBorder).add(s); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'XMLDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  requires: [ 'foam.core.reflow.XMLSink', 'foam.core.reflow.CopyFromBorder' ],

  methods: [
    function value(s) { return foam.lang.StringHolder.create({value: s.xml}); },
    function getSink() { return this.XMLSink.create({of: this.of}); },
    function addSinkToE(e, s) {
      s = this.useProjection ? this.getSinkWithProjectionData(s) : s;
      e.start(this.CopyFromBorder).add(s);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'JSONDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  requires: [ 'foam.core.reflow.JSONSink', 'foam.core.reflow.CopyFromBorder' ],

  methods: [
    function value(s) { return foam.lang.StringHolder.create({value: s.json}); },
    function getSink() { return this.JSONSink.create({of: this.of}); },
    function addSinkToE(e, s) {
      s = this.useProjection ? this.getSinkWithProjectionData(s) : s;
      e.start(this.CopyFromBorder).add(s);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'GroupByDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  imports: [ 'eval_' ],

  requires: [
    'foam.mlang.sink.GroupBySortOrder',
    'foam.mlang.sink.TopNGroupBy'
  ],

  properties: [
    {
      name: 'prop',
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyExprView', forCls: X.data.of };
      }
    },
    {
      name: 'sink',
      view: { class: 'foam.core.reflow.SinkView', choice: 'foam.core.reflow.CountDAOAgent' }
    },
    {
      class: 'Int',
      name: 'topN',
      label: 'Top N',
      value: 0,
      help: 'Keep top N groups by value (0 = disabled). Remaining groups can be merged into "Others".',
      visibility: function(sink) {
        if ( ! sink ) return foam.u2.DisplayMode.HIDDEN;
        try {
          return this.TopNGroupBy.isSupported(sink.createSink()) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
        } catch (e) {
          return foam.u2.DisplayMode.HIDDEN;
        }
      }
    },
    {
      class: 'Boolean',
      name: 'includeOthers',
      label: 'Include Others',
      value: true,
      help: 'Include "Others" group for remaining items when using Top N',
      visibility: function(topN, sink) {
        if ( topN <= 0 || ! sink ) return foam.u2.DisplayMode.HIDDEN;
        try {
          return this.TopNGroupBy.isSupported(sink.createSink()) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
        } catch (e) {
          return foam.u2.DisplayMode.HIDDEN;
        }
      }
    },
    {
      class: 'Enum',
      of: 'foam.mlang.sink.GroupBySortOrder',
      name: 'sortOrder',
      label: 'Sort Order',
      value: 'DESC',
      help: 'Sort order for value-based limiting',
      visibility: function(topN, sink) {
        if ( topN <= 0 || ! sink ) return foam.u2.DisplayMode.HIDDEN;
        try {
          return this.TopNGroupBy.isSupported(sink.createSink()) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
        } catch (e) {
          return foam.u2.DisplayMode.HIDDEN;
        }
      }
    },
    {
      class: 'String',
      name: 'othersLabel',
      label: 'Others Label',
      value: 'Others',
      help: 'Label for the aggregated "Others" category',
      visibility: function(topN, sink) {
        if ( topN <= 0 || ! sink ) return foam.u2.DisplayMode.HIDDEN;
        try {
          return this.TopNGroupBy.isSupported(sink.createSink()) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
        } catch (e) {
          return foam.u2.DisplayMode.HIDDEN;
        }
      }
    },
    {
      class: 'Int',
      name: 'groupLimit',
      label: 'Group Limit',
      value: 0,
      help: 'Limit total number of groups returned (0 for no limit).',
      hidden: true,
      documentation: `groupLimit is hidden to avoid confusion with topN.
        groupLimit cuts off data collection early (during put), while topN properly
        aggregates all data first then limits groups (during eof). Use topN instead.`
    },
    {
      name: 'browseEnabled',
      hidden: true,
      // Only enable Browse action if this is the top-level DAOAgent
      factory: function() { return this.block.value.select === this; }
    }
  ],

  methods: [
    function init() {
      /// due to grouplimit breaking the nested logic we will reset it to -1 in here to avoid saved scripts from using it
      this.groupLimit = -1;
    },
    function value(s) { return s; },
    function createSink() {
      var expr = this.prop;
      var innerSink = this.sink.createSink();

      // Use TopNGroupBy if topN > 0 and sink type is supported
      if ( this.topN > 0 && this.TopNGroupBy.isSupported(innerSink) ) {
        return this.TopNGroupBy.create({
          arg1: expr,
          arg2: innerSink,
          topN: this.topN,
          sortOrder: this.sortOrder,
          othersLabel: this.othersLabel,
          includeOthers: this.includeOthers,
        });
      }

      // Fall back to regular GroupBy
      var groupBySink = this.GROUP_BY(expr, innerSink, undefined);

      // Apply legacy group limit if specified
      if ( this.groupLimit > 0 ) {
        groupBySink.groupLimit = this.groupLimit;
      }

      return groupBySink;
    },
    function addToE(e) {
      var self = this;
      // TODO: figure out why BROWSE doesn't work after reloading
      e.startContext({data: this}).
        start().
          style({paddingLeft: '12px'}).
          add(this.PROP).
          add(this.SINK).
          add(this.TOP_N.__).
          add(this.SORT_ORDER.__).
          add(this.INCLUDE_OTHERS.__).
          add(this.OTHERS_LABEL.__).
          callIf(this.block, function() { this.add(self.BROWSE); });
    }
  ],

  actions: [
    {
      name: 'browse',
      isAvailable: function(browseEnabled) { return browseEnabled; },
      code: async function() {
        var block = this.block || this.__context__.currentBlock; // ??? Why needed?
        var cls   = block?.value?.value?.cls_;

        await block.value.waitForRun();
        this.eval_(`dao('${block.flowName}.valueDAO', '${block.flowName}GroupBy')`);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DuplicateDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.DuplicateSink' ],

  properties: [
    {
      name: 'prop',
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyChoiceView', forCls: X.data.of };
      }
    },
    { name: 'sink', view: 'foam.core.reflow.SinkView' }
  ],

  methods: [
    function value(s) { return this.sink.value(s.sink); },
    function createSink() { return this.DuplicateSink.create({expr: this.prop, sink: this.sink.createSink()}); },
    function addToE(e) {
      e.startContext({data: this}).start().style({display: 'flex'}).add(this.PROP, this.SINK);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'GridByDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.GridBy' ],

  properties: [
    {
      name: 'prop1',
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyExprView', forCls: X.data.of };
      }
    },
    {
      name: 'prop2',
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyExprView', forCls: X.data.of };
      }
    },
    { name: 'sink', view: { class: 'foam.core.reflow.SinkView', choice: 'foam.core.reflow.CountDAOAgent' } }
  ],

  methods: [
    function value(s) { return s; },
    function createSink() { return this.GridBy.create({
      yFunc: this.prop1,
      xFunc: this.prop2,
      acc:   this.sink.createSink()
    }); },
    function addToE(e) {
      e.startContext({data: this}).start().style({paddingLeft: '12px', display: 'flex'}).add(this.PROP1, this.PROP2, this.SINK);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PivotDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.Pivot' ],

  properties: [
    {
      name: 'xProps',
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyListView', forCls$: X.data.of$ };
      }
    },
    {
      name: 'yProps',
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyListView', forCls$: X.data.of$ };
      }
    },
    { name: 'sink',
      view: {
        class: 'foam.core.reflow.SinkView',
        choice: 'foam.core.reflow.CountDAOAgent',
        disabledTypes: [ 'structure', 'format' ]
      }
    }
  ],

  methods: [
    function value(s) { return s; },
    function createSink() {
      var xProps = this.xProps.length ? [...new Set(this.xProps.split(','))].map(p => this.of?.axiomMap_[p]) : null;
      var yProps = this.yProps.length ? [...new Set(this.yProps.split(','))].map(p => this.of?.axiomMap_[p]) : null;
      this.sink = this.sink || foam.core.reflow.CountDAOAgent.create();
      return this.Pivot.create({
        yFunc: xProps,
        xFunc: yProps,
        acc:   this.sink.createSink()
      });
    },
    function addToE(e) {
      e.startContext({data: this}).start().style({paddingLeft: '12px', display: 'flex'}).add(this.X_PROPS, this.Y_PROPS, this.SINK);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ColumnDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.mlang.sink.Sequence' ],

  properties: [
    /*
    {
      name: 'orientation',
      view: { class: 'foam.u2.view.ChoiceView', choices: [ 'Row', 'Column' ] }
      },
      */
    {
      name: 'sinks',
      factory: function() { return []; },
      preSet: function(o, n) {
        if ( foam.Array.isInstance(n) ) {
          n = n.map(o => o && o.__context__ != this.__subContext__ ? o.clone(this.__subContext__) : o);
        }
        return n;
      },
      view: {
        class: 'foam.u2.view.ArrayView',
        valueView: {
          class: 'foam.core.reflow.SinkView',
          sinksOnly: true
        }
      }
    }
  ],

  methods: [
    function createSink() {
      return this.Sequence.create({
        args: this.sinks.map(s => s.createSink())
      });
    },
    function addToE(e) {
      e.startContext({data: this}).
        start().
          style({display: 'flex', paddingLeft: '8px'}).
          add(this.ORIENTATION, this.SINKS);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'RowDAOAgent',
  extends: 'foam.core.reflow.ColumnDAOAgent',

  methods: [
    function createSink() {
      return this.Sequence.create({
        horizontal: true,
        args: this.sinks.map(s => s.createSink())
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PieDAOAgent',
  extends: 'foam.core.reflow.GroupByDAOAgent',

  requires: [ 'foam.u2.mlang.Pie' ],

  properties: [ { class: 'Int', name: 'radius', value: 50 } ],

  methods: [
    function createSink() {
      return this.Pie.create({arg1: this.prop, radius: this.radius});
    },
    function addToE(e) {
      e.startContext({data: this}).start().style({display: 'flex'}).
        add(' r:', this.RADIUS,' ', this.PROP);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ViewDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.ViewSink' ],

  methods: [
    function createSink() { return this.ViewSink.create(); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'EditDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.EditSink' ],

  methods: [
    function createSink() { return this.EditSink.create(); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ControllerDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',

  imports: [ 'sinkDAO as limitedDAO' ],

  methods: [
    function execute(e) {
      e.add(foam.core.reflow.FlowBrowserView.create({
        data: this.limitedDAO
      }, this));
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ObjectSelectDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',
  documentation: 'Allows selecting an object from a dao that can then be accessed using selectedObj',

  imports: [ 'sinkDAO as limitedDAO', 'block'],

  exports: ['as data'],
  properties: [
    {
      name: 'selectedObj',
      transient: true
    }
  ],
  methods: [
    function value(s) {
      return this.selectedObj;
    },
    function execute(e) {
      if ( this.block.value && this.block.value.VALUE ) {
        this.onDetach(this.block.value.value$.follow(this.selectedObj$));
      } else {
        this.onDetach(this.block.value$.follow(this.selectedObj$));
      }
      e.tag(foam.u2.view.RichChoiceReferenceView, {
        placeholder: '--',
        fullObject_$: this.selectedObj$,
        sections: [
          {
            name: 'Objects',
            dao$: this.limitedDAO$
          }
        ]
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CitationDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.CitationSink' ],

  methods: [
    function createSink() { return this.CitationSink.create({of: this.of}); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AllDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',
//  extends: 'foam.core.reflow.AbstractDAOAgent',

  requires: [ 'foam.u2.CitationView' ],

  imports: [ 'agentDAO' ],

  methods: [
    function execute(e) {
      var exclude = 'All,GroupBy,GridBy,Pivot,Row,Column,Script'.split(',');
      e.select(this.agentDAO, a => {
        if ( exclude.indexOf(a.label) != -1 ) return;
        if ( a.type === 'chart' || a.type === 'calculation' ) return;
        var cls   = foam.lookup(a.value);
        var agent = cls.create({}, this);
        e.start('h2').add(a.label).end().start().call(function () { agent.execute(this); });
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DownloadView',
  extends: 'foam.u2.Controller',

  imports: [ 'block', 'sessionID', 'window' ],

  requires: [
    'foam.core.export.CSVTableExportDriver',
    'foam.core.export.JSONDriver',
    'foam.core.export.JSONJDriver',
    'foam.core.export.XMLDriver'
  ],

  properties: [
    {
      name: 'formats',
      factory: function() {
        return [
          { label: 'CSV',    extension: '.csv',  format: 'csv',   driver: this.CSVTableExportDriver },
          { label: 'JSON',   extension: '.json', format: 'json',  driver: this.JSONDriver },
          { label: 'JSON/J', extension: '.jrl',  format: 'jsonj', driver: this.JSONJDriver },
          { label: 'XML',    extension: '.xml',  format: 'xml',   driver: this.XMLDriver }
        ];
      }
    }
  ],

  methods: [
    async function render() {
      var dao         = this.block.value.filteredDAO;
      var serviceName = dao.cmd('serviceName?');
      var isLocal     = ! serviceName;

      if ( isLocal ) {
        this.renderLocalDownloads(dao);
      } else {
        await this.renderServiceDownloads(dao, serviceName);
      }

      return this;
    },

    function renderLocalDownloads(dao) {
      var self      = this;
      var modelName = dao.of?.name || 'data';

      this.add('Download As: ');
      this.formats.forEach((fmt, idx) => {
        if ( idx > 0 ) this.add(', ');
        this.start('a').
          style({ cursor: 'pointer', color: '#0066cc', 'text-decoration': 'underline' }).
          on('click', async function() {
            await self.downloadLocal(dao, modelName, fmt);
          }).
          add(fmt.label).
        end();
      });
    },

    async function renderServiceDownloads(dao, serviceName) {
      var location = this.window.location.origin;
      var daoKey   = serviceName.substring(8);
      var url      = `${location}/service/dig?dao=${daoKey}&cmd=select&sessionId=${this.sessionID}&limit=${this.block.value.limit}`;

      // Probe DAO to find the actual full query being used
      try {
        var sink = foam.dao.ArraySink.create();
        sink.setPredicate = function(p) {
          url = url + '&q=' + encodeURIComponent(p.toMQL());
          throw "just probing";
        };
        await dao.select(sink);
      } catch (x) {
      }

      if ( this.block.value.columns ) {
        url = url + '&columns=' + encodeURIComponent(this.block.value.columns);
      }

      this.add('Download As: ');
      this.formats.forEach((fmt, idx) => {
        if ( idx > 0 ) this.add(', ');
        this.
          start('a').
            attrs({
              href: url + '&format=' + fmt.format,
              rel: 'noopener noreferrer',
              download: daoKey + fmt.extension,
              target: '_blank'
            }).
            add(fmt.label).
          end();
      });
    },

    async function downloadLocal(dao, modelName, format) {
      try {
        var driver = format.driver.create({}, this);
        var result = await driver.exportDAO(this.__context__, dao);

        const mime =
          format.mimeType ||
          (format.extension === '.csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8');

        var blob = result instanceof Blob ? result : new Blob([result], { type: mime });
        var url = URL.createObjectURL(blob);

        var link = document.createElement('a');
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

        link.setAttribute('href', url);
        link.setAttribute('download', `${modelName}_Export_${timestamp}${format.extension}`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        // Give the browser time to start the download before cleanup
        setTimeout(() => {
          URL.revokeObjectURL(url);
          link.remove();
        }, 60_000); // 1 minute is safe; you can shorten to e.g. 2–5s and test
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + (error?.message ?? error));
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DownloadDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',

  requires: [ 'foam.core.reflow.DownloadView' ],

  methods: [
    function execute(e) {
      e.tag(this.DownloadView);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'LabeledDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.mlang.sink.LabeledSink' ],

  properties: [
    {
      class: 'String',
      name: 'label',
      documentation: 'Label to identify this sink result for retrieval in genModel',
      validateObj: function(label) {
        // has to be valid JavaScript variable name
        // start with letter, underscore, or dollar sign
        if ( ! label.match(/^[a-zA-Z_$]/) ) return 'Label must start with a letter, underscore';
        // then only letters, numbers, underscores, or dollar signs (no dashes)
        if ( ! label.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) ) return 'Label can only contain letters, numbers, underscores';

        // check for JavaScript reserved words
        var reservedWords = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'enum', 'implements', 'package', 'protected', 'interface', 'private', 'public'];
        if ( reservedWords.indexOf(label.toLowerCase()) !== -1 ) return 'Label cannot be a JavaScript reserved word';
      }
    },
    {
      name: 'sink',
      view: 'foam.core.reflow.SinkView',
      documentation: 'The sink to delegate to'
    }
  ],

  methods: [
    function value(s) {
      return s;
    },
    function createSink() {
      return this.LabeledSink.create({
        label: this.label,
        delegate: this.sink ? this.sink.createSink() : null
      });
    },
        function addToE(e) {
      var self = this;
      // TODO: figure out why BROWSE doesn't work after reloading
      e.startContext({data: this}).
        start().
        add(this.LABEL.__)
          .add(this.SINK).
          end();
    }
  ]
});
