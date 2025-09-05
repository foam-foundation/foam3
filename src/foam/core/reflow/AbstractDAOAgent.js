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

  requires: [ 'foam.dao.ArraySink' ],

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
//        s = s.clone({columnStorage: sink.__context__.columnStorage});

        e.startContext({dao: this.dao/*, columnStorage: sink.__context__.columnStorage*/})
          .start()
            .call(function() {
              self.addSinkToE(this, s);
            })
          .end()
        .endContext();
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
  extends: 'foam.core.reflow.AbstractDAOAgent'
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
//          console.log(i);
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
      e.startContext({data: this}).start().style({display: 'flex'}).add(this.PROP);
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
            return foam.lang.Int.isInstance(p) || foam.lang.Float.isInstance(p);
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

  imports: ['columnStorage'],

  properties: [
    {
      class: 'StringArray',
      name: 'columns'
    },
    {
      name: 'selection', hidden: true
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
        })
      };

      if ( this.columns.length ) {
        var cs = JSON.parse(this.columnStorage.getItem(this.of.id));
        if ( cs )
          config.selectedColumnNames = cs;
      }

      e.startContext({click: self.click}).
        start(self.TableView.create({}, this.__subContext__), config).
          style({height: '600px'});

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
      view: { class: 'foam.core.reflow.SinkView', choice: 'foam.core.reflow.CountDAOAgent' },
      preSet: function(o, n) {
        // Temporary fix to recontextualize the object after load.
        // TODO: remove once JSON parsing/loading is fixed
        if ( n && n.__context__ != this.__subContext__ ) {
          return n.clone(this.__subContext__);
        }
        return n;
      }
    },
    {
      class: 'Int',
      name: 'topN',
      label: 'Top N',
      value: 0,
      help: 'Keep top N groups by value (0 = disabled). Remaining groups can be merged into "Others".',
      visibility: function(sink) {
        return sink && this.TopNGroupBy.isSupported(sink.createSink()) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'Boolean',
      name: 'includeOthers',
      label: 'Include Others',
      value: true,
      help: 'Include "Others" group for remaining items when using Top N',
      visibility: function(topN, sink) {
        return topN > 0 && sink && this.TopNGroupBy.isSupported(sink.createSink()) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
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
        return topN > 0 && sink && this.TopNGroupBy.isSupported(sink.createSink()) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'othersLabel',
      label: 'Others Label',
      value: 'Others',
      help: 'Label for the aggregated "Others" category',
      visibility: function(topN, sink) {
        return topN > 0 && sink && this.TopNGroupBy.isSupported(sink.createSink()) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
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
          includeOthers: this.includeOthers
        });
      }

      // Fall back to regular GroupBy
      var groupBySink = this.GROUP_BY(expr, innerSink);

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
        this.eval_(`dao(${block.flowName}.value.asDAO(), '${block.flowName}GroupBy')`);
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
  name: 'CitationDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.CitationSink' ],

  methods: [
    function createSink() { return this.CitationSink.create({of: this.of}); }
  ]
});



foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CellsDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  requires: [ 'foam.core.reflow.CellsSink' ],

  methods: [
    function getSink() { return this.CellsSink.create({of: this.of}); }
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

  // TODO: support columns=
  // TODO: detect local DAOs and disable

  imports: [ 'block', 'sessionID', 'window' ],

  methods: [
    async function render() {
      var location = this.window.location.origin;
      var dao      = this.block.value.filteredDAO;
      var daoKey   = dao.cmd('serviceName?').substring(8);
      var url      = `${location}/service/dig?dao=${daoKey}&cmd=select&sessionId=${this.sessionID}`;

      // We can't just use the DAOPrompt.where because if the DAO is decorated with
      // something like ProgramAwareDAO, then the query added there won't appear.
      // So instead we probe th DAO to find out the actual full query being used.

      try {
        var sink = foam.dao.ArraySink.create();
        sink.setPredicate = function(p) {
          debugger;
          var mql = p.toMQL();
          url = url + '&q=' + encodeURIComponent(mql);
          throw "just probing";
        };
        await dao.select(sink);
      } catch (x) {
      }

      var addFormat = (label, extension, format) => {
        this.start('a').
          attrs({
            href: url + '&format=' + format,
            rel: 'noopener noreferrer',
            download: daoKey + extension,
            target: '_blank'
          }).
          add(label);
        return this;
      };

      this.add('Download As: ');
      addFormat('CSV',    '.csv',  'csv'  ).add(', ');
      addFormat('JSON',   '.json', 'json' ).add(', ');
      addFormat('JSON/J', '.jrl',  'jsonj').add(', ');
      addFormat('XML',    '.xml',  'xml'  );
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
