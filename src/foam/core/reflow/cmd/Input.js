/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Input',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.Prompt' ],

  methods: [
    function execute(prompt, type) {
      var p = this.Prompt.create({ type: type });

      if ( prompt ) p.label = prompt;

      this.currentBlock.value = p;
      this.out.add(p);
    }
  ]
});
