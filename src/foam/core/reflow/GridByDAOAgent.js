/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'GridByDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.GridBy' ],

  properties: [
    {
      name: 'prop1',
      label: 'Property 1',
      validateObj: function(prop1) { if ( ! prop1 ) return 'Required'; },
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyExprView', forCls: X.data.of };
      }
    },
    {
      name: 'prop2',
      label: 'Property 2',
      validateObj: function(prop2) { if ( ! prop2 ) return 'Required'; },
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
      e.startContext({data: this}).start().style({paddingLeft: '12px', display: 'flex'}).add(this.PROP1.__, this.PROP2.__, this.SINK);
    }
  ]
});
