/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.control',
  name: 'HelpControl',
  extends: 'foam.u2.Element',

  requires: [ 'foam.u2.Link' ],

  imports: [ 'eval_' ],

  methods: [
    function render() {
      this.start(this.Link).add('help').on('click', () => this.eval_('help')).end();
    }
  ]
});
