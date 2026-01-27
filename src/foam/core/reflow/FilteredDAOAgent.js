/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FilteredDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  documentation: 'A DAO agent that filters data using a predicate before passing to a delegate sink',

  requires: [
    'foam.mlang.sink.FilteredSink',
    'foam.parse.SimpleQueryParser',
    'foam.parse.QueryParser'
  ],

  properties: [
    {
      class: 'String',
      name: 'where',
      section: 'filter',
      displayWidth: 60,
      postSet: function(o, n) { this.enableAQL_ = ! n; },
      visibility: function(enableAQL_) { return enableAQL_ ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW; },
      view: { class: 'foam.core.reflow.PredicateSuggestedField' },
      documentation: 'Predicate expression to filter objects before putting them in the sink'
    },
    {
      class: 'Boolean',
      name: 'enableAQL_',
      transient: true,
      hidden: true,
      value: true,
      documentation: 'Temporary flag to determine if AQL is available.'
    },
    {
      class: 'String',
      name: 'aql',
      label: 'Where (autocomplete)',
      displayWidth: 60,
      visibility: function(enableAQL_) { return enableAQL_ ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN; },
      view: function(_, X) {
        var data = X.data;
        return {
          class: 'foam.parse.auto.SmartView',
          parser: data.SimpleQueryParser.create({of: data.of}, X)
        };
      }
    },
    {
      name: 'sink',
      view: 'foam.core.reflow.SinkView',
      documentation: 'The sink to delegate filtered objects to'
    }
  ],

  methods: [
    function value(s) {
      return this.sink ? this.sink.value(s.delegate) : s;
    },

    function createSink() {
      var predicate = null;
      if ( this.enableAQL_ ) {
        if ( this.aql ) {
          predicate = this.SimpleQueryParser.create({of: this.of}).parseString(this.aql);
        }
      } else {
        if ( this.where ) {
          try {
            predicate = this.QueryParser.create({of: this.of}).parseString(this.where);
          } catch (x) {
            console.warn('FilteredDAOAgent: Failed to parse predicate:', this.where, x);
          }
        }
      }

      if ( predicate ) {
        dao = dao.where(predicate);
      }

      var delegateSink = this.sink ? this.sink.createSink() : this.ArraySink.create();

      return this.FilteredSink.create({
        predicate: predicate,
        delegate: delegateSink
      });
    },

    function addToE(e) {
      e.startContext({data: this}).
        start().
          style({display: 'flex', paddingLeft: '12px'}).
          add(this.WHERE.__).
          add(this.AQL.__).
          add(this.SINK).
        end().
      endContext();
    }
  ]
});
