/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'HelpFunctions',
  extends: 'foam.core.reflow.cmd.Command',

  properties: [
    { name: 'id', value: 'helpFunctions' },
    [ 'description', 'Help fn for built-in functions' ]
  ],

  methods: [
    function execute(q) {
      if ( q ) q = q.toLowerCase();

      var self = this;
      var fns  = Object.keys(foam.core.reflow.lib).sort();

      this.out.start('h3').add('Functions').end().
      start('table').style({width: 'max-content'}).
        forEach(fns, function(f) {
          if ( q && f.toLowerCase().indexOf(q) == -1 ) return;

          var comment = foam.Function.functionComment(foam.core.reflow.lib[f]);

          this.start('tr').
            start('th').attr('width', '250').attr('align', 'left').call(function() {
              this.add(f);
            }).end().
            start('td').attr('align', 'left').add(comment);
        }).
        end();
    }
  ]
});
