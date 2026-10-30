/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'RowDAOAgent',
  extends: 'foam.core.reflow.ColumnDAOAgent',

  methods: [
    function createSink() {
      return this.Sequence.create({
        horizontal: true,
        args: this.sinks.map(s => s.createSink())
      });
    }
  ]
});
