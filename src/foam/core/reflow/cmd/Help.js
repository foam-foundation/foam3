/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Help',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'commandDAO' ],

  properties: [
    { name: 'id', value: 'help' },
    [ 'description', 'Help for commands and shortcuts' ]
  ],

  methods: [
    function execute(q) {
      if ( q ) q = q.toLowerCase();

      var self = this;
      var shortcuts = [
        [ 'F1',      'Help' ],
        [ 'ESC',     'Toggle prompt display' ],
        [ 'Up',      'Previous from history' ],
        [ 'Down',    'Next from history' ],
        [ 'Shift-Up',  'Select next command' ],
        [ 'Shift-Down', 'Select previous command' ],
        [ 'CMD + k / CTRL + k',  'Clear console' ],
        [ 'CTRL + `', 'Focus input' ]
      ];

      this.out.start('h3').add('Commands').end().
      start('table').style({width: 'max-content'}).
        select(this.commandDAO, function(c) {
          if ( c.hidden ) return;
          if ( q && ( c.id + c.description ).toLowerCase().indexOf(q) == -1 ) return;

          this.start('tr').
            start('th').attr('width', '250').attr('align', 'left').call(function() {
              if ( c.linkable ) {
                this.start(self.Link).add(c.id).on('click', () => self.eval_(c.id));
              } else {
                this.add(c.id);
              }
            }).end().
            start('td').attr('align', 'left').add(c.description);
        }).
        end().
        br().
        start('h3').add('Keyboard Shortcuts').end().
        start('table').style({width: 'max-content'}).
          forEach(shortcuts, function(c) {
            this.start('tr').
              start('th').attr('width', '250').attr('align', 'left').add(c[0]).end().
              start('td').add(c[1]);
          }).
        end();
    }
  ]
});
