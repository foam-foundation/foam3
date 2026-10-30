/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'SumDAOAgent',
  extends: 'foam.core.reflow.AvgDAOAgent',
  methods: [
    function createSink() {
      var sink = this.SUM(this.prop);
      sink.precision = this.precision;
      return sink;
    }
  ]
});
