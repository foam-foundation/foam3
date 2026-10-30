/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CSVDAOAgent',
  extends: 'foam.core.reflow.AbstractColumnAwareDAOAgent',

  requires: [ 'foam.dao.CSVSink', 'foam.core.reflow.CopyFromBorder' ],

  methods: [
    function value(s) { return foam.lang.StringHolder.create({value: s.csv}); },
    function getSinkWithProjectionData(s) { return s; },
    function getProjectionSink() { return this.CSVSink.create({ of: this.of, props: this.props }); },
    function getSink() { return this.CSVSink.create({of: this.of}); },
    function addSinkToE(e, s) { e.start(this.CopyFromBorder).add(s); }
  ]
});
