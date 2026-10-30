/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAOFilter',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.DAOFilterPrompt' ],

  imports: [ 'createFlowChildName' ],

  properties: [
    [ 'description', 'DAO filter for a service' ],
    [ 'parserClass', 'foam.core.reflow.parser.DAOTargetParser' ]
  ],

  methods: [
    function execute(dao, opt_label) {
      var p = this.DAOFilterPrompt.create({dao: dao, label: opt_label});

      p.addToE(this.out);
      this.currentBlock.flowName = this.createFlowChildName(p.label.replaceAll(' ', '').toLowerCase());
      this.currentBlock.obj    = p;
      this.currentBlock.value  = p;
    }
  ]
});
