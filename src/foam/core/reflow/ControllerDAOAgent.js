/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ControllerDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',

  imports: [ 'sinkDAO? as limitedDAO' ],

  methods: [
    function execute(e) {
      e.add(foam.core.reflow.FlowBrowserView.create({
        data: this.limitedDAO
      }, this));
    }
  ]
});
