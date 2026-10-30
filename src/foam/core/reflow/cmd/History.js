/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'History',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'history_' ],

  properties: [
    [ 'description', 'History of executed commands' ]
  ],

  methods: [
    function execute(q) {
      if ( q ) q = q.toLowerCase();
      this.history_.forEach(h => {
        if ( q != undefined && h.toLowerCase().indexOf(q) == -1 ) return;
        this.out.tag('br');
        this.out.start(this.Link).add(h).on('click', () => this.eval_(h));
      });
    }
  ]
});
