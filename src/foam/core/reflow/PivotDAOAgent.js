/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PivotDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.Pivot' ],

  imports: [ 'eval_' ],

  properties: [
    {
      name: 'exprParser',
      transient: true,
      hidden: true,
      factory: function() {
        return foam.parse.Parsers.create().repeat(foam.ascript.AScriptParser.create({of: this.of}, this), ',', 1);
      }
    },
    {
      name: 'xs',
      view: function(_, X) {
        return {
          class: 'foam.parse.auto.SmartView',
          parser: X.data.exprParser
        };
      }
    },
    {
      name: 'ys',
      view: function(_, X) {
        return {
          class: 'foam.parse.auto.SmartView',
          parser: X.data.exprParser
        };
      }
    },
    { name: 'sink',
      view: {
        class: 'foam.core.reflow.SinkView',
        choice: 'foam.core.reflow.CountDAOAgent',
        disabledTypes: [ 'structure', 'format' ]
      }
    },
    {
      class: 'Boolean',
      name: 'stickyHeaders',
      label: 'Freeze Headers',
      view: { class: 'foam.u2.Switch' },
      value: true
    }
  ],

  methods: [
    function value(s) { return s; },
    function createSink() {
      let xProps = this.exprParser.parseString(this.xs), yProps = this.exprParser.parseString(this.ys);

//      var xProps = this.xProps; // this.xProps.length ? [...new Set(this.xProps.split(','))].map(p => this.of?.axiomMap_[p]) : null;
//      var yProps = this.yProps; // this.yProps.length ? [...new Set(this.yProps.split(','))].map(p => this.of?.axiomMap_[p]) : null;
      this.sink = this.sink || foam.core.reflow.CountDAOAgent.create();
      return this.Pivot.create({
        yFunc: yProps,
        xFunc: xProps,
        acc:   this.sink.createSink(),
        stickyHeaders: this.stickyHeaders
      });
    },
    function addToE(e) {
      e.startContext({data: this}).start().style({paddingLeft: '12px', display: 'flex'}).add(this.YS, this.XS, this.SINK, this.STICKY_HEADERS.__);
    }
  ],

  actions: [
    {
      name: 'browse',
      // isAvailable: function(browseEnabled) { return browseEnabled; },
      code: async function() {
        var block = this.block || this.__context__.currentBlock; // ??? Why needed?
        var cls   = block?.value?.value?.cls_;

        await block.value.waitForRun();
        this.eval_(`dao('${block.flowName}.valueDAO', '${block.flowName}Pivot')`);
      }
    }
  ]
});
