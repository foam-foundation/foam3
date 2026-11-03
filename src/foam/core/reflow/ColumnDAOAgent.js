/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

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
      class: 'FObjectArray',
      name: 'sinks',
      of: 'foam.core.reflow.AbstractDAOAgent',
      autoValidate: true,
      factory: function() { return []; },
      preSet: function(o, n) {
        // TODO:
        // - this is needed because parsing doesn't put objects in the correct context,
        // - but then it breaks nested validation because nested objects aren't the correct ones
        // - remove once parsing contextualizes correctly

        // Don't clone if not necessary. Only necessary if the dao is different.
        let count = n.filter(o => o && o.dao != this.__subContext__.dao ).length;
        if ( count == 0 ) {
          return n;
        }

        if ( foam.Array.isInstance(n) ) {
          n = n.map(o => o && o.__context__ != this.__subContext__ ? o.clone(this.__subContext__) : o);
        }
        return n;
      },
      view: {
        class: 'foam.u2.view.ArrayView',
        valueView: {
          class: 'foam.core.reflow.SinkView',
          sinksOnly: true,
          choice: 'foam.core.reflow.CountDAOAgent'
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
