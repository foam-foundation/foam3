/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

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
