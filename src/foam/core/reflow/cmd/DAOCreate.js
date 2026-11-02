/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAOCreate',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [
    'foam.core.reflow.DAOCreate',
    'foam.core.reflow.parser.DAOTargetParser'
  ],

  imports: [ 'scope' ],

  properties: [
    [ 'description', 'Add a row to a DAO (requires a DAO name)' ],
    {
      name: 'parser',
      factory: function() { return this.DAOTargetParser.create(); }
    }
  ],

  methods: [
    function execute(daoKey) {
      var dao;
      if ( foam.String.isInstance(daoKey) && this.scope[daoKey] ) dao = this.scope[daoKey];
      if ( foam.String.isInstance(daoKey) && this.scope[daoKey + 'DAO'] ) dao = this.scope[daoKey + 'DAO'];
      var value = foam.dao.DAO.isInstance(dao) ? this.DAOCreate.create({dao: dao}) : this.DAOCreate.create({daoKey: daoKey});
      // this.currentBlock.value = foam.core.reflow.cmd.DAOCreateSave.create({daoCreate: value});
      this.out.tag(value);
    }
  ]
});
