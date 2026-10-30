/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'GroupByDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [
    'foam.core.reflow.parse.GroupByParser',
    'foam.mlang.sink.GroupBySortOrder',
    'foam.mlang.sink.TopNGroupBy'
  ],

  imports: [ 'eval_' ],

  properties: [
    {
      name: 'prop',
      label: 'Property',
      validateObj: function(prop) { if ( ! prop ) return 'Required'; },
      xxxview: function(_, X) {
        return {
          class: 'foam.parse.auto.SmartView',
          parser: foam.ascript.AScriptParser.create({of: X.data.of}, X)
        };
      },
      view: function(_, X) {
        return { class: 'foam.core.reflow.PropertyExprView', forCls: X.data.of };
      }
    },
    {
      name: 'parser',
      transient: true,
      factory: function() { return this.GroupByParser.create(); }
    },
    {
      name: 'sink',
      label: 'Operation',
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
    // TODO: not needed anymore, remove
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
      //      var expr = foam.ascript.AScriptParser.PARSE(this.__context__.dao.of, this.prop);
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
          add(this.PROP.__).
          add(this.SINK.__).
          add(this.TOP_N.__).
          add(this.SORT_ORDER.__).
          add(this.INCLUDE_OTHERS.__).
          add(this.OTHERS_LABEL.__).
        end().
      endContext();
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
