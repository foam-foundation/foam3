/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'MinDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  properties: [
    {
      name: 'prop',
      label: 'Property',
      validateObj: function(prop) { if ( ! prop ) return 'Required'; },
      view: function(_, X) {
       return { class: 'foam.core.reflow.PropertyChoiceView', forCls: X.data.of };
      }
    },
    {
      class: 'Int',
      name: 'precision',
      value: -1,
      help: 'Number of decimal places for numeric results. -1 means no rounding.'
    }
  ],

  methods: [
    function value(s) { return s; },
    function createSink() {
      var sink = this.MIN(this.prop);
      sink.precision = this.precision;
      return sink;
    },
    function addToE(e) {
      e.startContext({data: this}).start().
        style({display: 'flex'}).
        add(this.PROP.__).
        add(this.PRECISION.__);
    }
  ]
});
