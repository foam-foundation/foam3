/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAOCreateSave',

  properties: [
    { name: 'daoCreate', hidden: true }
  ],

  actions: [
    function save() { return this.daoCreate.save(); }
  ]
});
