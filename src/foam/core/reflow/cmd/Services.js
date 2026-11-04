/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Services',
  extends: 'foam.core.reflow.cmd.Command',

  mixins: [ 'foam.mlang.Expressions' ],

  requires: [ 'foam.core.boot.CSpec' ],

  imports: [ 'AuthenticatedCSpecDAO as cSpecDAO' ],

  properties: [
    [ 'description', 'Services available' ]
  ],

  methods: [
    function execute(opt_nameQuery) {
      var self = this;
      var dao  = this.cSpecDAO?.where(this.CSpec.SERVED_SERVICES);
      if ( opt_nameQuery ) dao = dao?.where(
        this.OR(
          this.CONTAINS_IC(this.CSpec.NAME,     opt_nameQuery),
          this.CONTAINS_IC(this.CSpec.KEYWORDS, opt_nameQuery)
        ));
      this.out.tag('br');
      this.out.start('table').attr('width', '100%').
        select(dao, function(n) {
          var sdao = self.__context__[n.name];
          this.start('tr').
            start('th').attr('align', 'left').call(function() {
              this.add(n.name);
            }).end().
            start('td').attr('align', 'left').add(n.description);
        });
    }
  ]
});
