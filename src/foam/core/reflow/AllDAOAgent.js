/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AllDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',
//  extends: 'foam.core.reflow.AbstractDAOAgent',

  requires: [ 'foam.u2.CitationView' ],

  imports: [ 'agentDAO?' ],

  methods: [
    function execute(e) {
      var exclude = 'All,GroupBy,GridBy,Pivot,Row,Column,Script'.split(',');
      e.select(this.agentDAO, a => {
        if ( exclude.indexOf(a.label) != -1 ) return;
        if ( a.type === 'chart' || a.type === 'calculation' ) return;
        var cls   = foam.lookup(a.value);
        var agent = cls.create({}, this);
        e.start('h2').add(a.label).end().start().call(function () { agent.execute(this); });
      });
    }
  ]
});
