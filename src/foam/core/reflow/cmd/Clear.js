/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Clear',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'clearFlow as clear', 'block' ],

  properties: [
    [ 'description', 'Clear console output' ]
  ],

  methods: [
    function execute() {
      this.block?.del();
      this.clear();
    }
  ]
});
