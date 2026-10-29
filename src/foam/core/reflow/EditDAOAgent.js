/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'EditDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [ 'foam.core.reflow.EditSink' ],

  methods: [
    function createSink() { return this.EditSink.create(); }
  ]
});
