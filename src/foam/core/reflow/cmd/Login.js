/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Login',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.auth.login.LoginView' ],

  properties: [
    [ 'description', 'Login from flow' ]
  ],

  methods: [
    function execute() {
      var p = this.LoginView.create({mode_: 0});

      this.out.tag(p);
      this.currentBlock.value = p;
    }
  ]
});
