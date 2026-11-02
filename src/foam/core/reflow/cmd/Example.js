/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Example',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'block', 'currentBlock' ],

  requires: ['foam.core.reflow.example.Example'],

  methods: [
    function execute(code) {
      let example = this.Example.create({ code: code });
      this.currentBlock.value = example;
    // this.currentBlock.configViewSpec = {
    //   propertyWhitelist: {'innerText': { label: 'Code' }}
    // }
      this.out.tag(example);
    }
  ]
});
