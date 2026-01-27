/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'SetDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  documentation: 'DAO Agent that collects unique values from a property into a set/list.',

  properties: [
    {
      name: 'prop',
      view: function(_, X) {
        return { class: 'foam.core.reflow.PropertyChoiceView', forCls: X.data.of };
      }
    }
  ],

  methods: [
    function value(s) {
      if ( this.block.value && s.cls_ === this.block.value.cls_ ) {
        this.block.value.copyFrom(s);
        return this.block.value;
      }
      return s;
    },
    function createSink() {
      return this.SET(this.prop);
    },
    function addToE(e) {
      e.startContext({data: this}).start().
        style({display: 'flex'}).
        add(this.PROP);
    }
  ]
});
