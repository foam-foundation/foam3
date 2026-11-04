/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DuplicateDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.DuplicateSink' ],

  properties: [
    {
      name: 'prop',
      label: 'Property',
      validateObj: function(prop) { if ( ! prop ) return 'Required'; },
      view: function(_, X) {
        return { class: 'foam.core.reflow.PropertyChoiceView', placeholder: '---', forCls: X.data.of };
      }
    },
    { name: 'sink', label: 'Operation', view: 'foam.core.reflow.SinkView' }
  ],

  methods: [
    function value(s) { return this.sink.value(s.sink); },
    function createSink() { return this.DuplicateSink.create({expr: this.prop, sink: this.sink.createSink()}); },
    function addToE(e) {
      e.startContext({data: this}).start().style({display: 'flex'}).add(this.PROP.__, this.SINK.__);
    }
  ]
});
