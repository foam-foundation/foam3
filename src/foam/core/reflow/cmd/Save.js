/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Save',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [  'flow', 'flowDAO?', 'save', 'notify' ],

  properties: [
    [ 'description', 'Save the current flow to a specified name' ]
  ],

  methods: [
    function execute(opt_flowName) {
      if ( opt_flowName ) {
        this.flow.name = opt_flowName;
      }

      // Don't save the 'save' command
      this.currentBlock.del();

      return this.save().then(ret => {
        if ( ret ) this.notify('Flow saved');
      }).catch(err => {
        this.notify('Error saving flow: ' + err.message);
      });
    }
  ]
});
