/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'JSONDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  requires: [ 'foam.core.reflow.JSONSink', 'foam.core.reflow.CopyFromBorder' ],

  methods: [
    function value(s) { return foam.lang.StringHolder.create({value: s.json}); },
    function getSink() { return this.JSONSink.create({of: this.of}); },
    function addSinkToE(e, s) {
      s = this.useProjection ? this.getSinkWithProjectionData(s) : s;
      e.start(this.CopyFromBorder).add(s);
    }
  ]
});
