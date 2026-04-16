/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAO',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [
    'foam.core.reflow.DAOPrompt'
  ],

  imports: [ 'createFlowChildName' ],

  properties: [
    [ 'description', 'Perform DAO operation' ],
  ],

  methods: [
    function execute(dao, opt_label) {
      let args  = {dao: dao, label: opt_label};
      let p     = this.DAOPrompt.create(args);
      let label = p.dao.of.model_.plural;

      p.addToE(this.out);
      this.currentBlock.flowName = opt_label || this.createFlowChildName(label.replaceAll(' ', '').toLowerCase());
      this.currentBlock.obj    = p; // ???: Needed
      this.currentBlock.value  = p;
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'From',
  extends: 'foam.core.reflow.cmd.DAO',

  requires: [
    'foam.core.reflow.parse.FromParser'
  ],

  properties: [
    {
      name: 'parser',
      factory: function() { return this.FromParser.create(); }
    }
  ],

  methods: [
    function aInit() {
      this.parser.aInit();
    },

    function execute(dao, opt_label) {
      let args;

      if ( foam.String.isInstance(dao) ) {
        let res = this.parser.parseString(' ' + dao);
        if ( res ) {
          args = res;
        }
      }
      if ( ! args ) args = {dao: dao, label: opt_label};
      let p     = this.DAOPrompt.create(args);
      let label = p.dao.of.model_.plural;

      p.addToE(this.out);
      this.currentBlock.flowName = opt_label || args.label || this.createFlowChildName(label.replaceAll(' ', '').toLowerCase());
      this.currentBlock.obj    = p; // ???: Needed
      this.currentBlock.value  = p;
    }
  ]
});
