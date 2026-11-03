/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Quote',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ ],

  properties: [
    [ 'description', 'Quote block' ]
  ],

  methods: [
    function execute(t) { this.out.start('blockquote').add(t); }
  ]
});
