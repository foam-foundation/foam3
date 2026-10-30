/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAOS',
  extends: 'foam.core.reflow.cmd.Command',

  mixins: [ 'foam.mlang.Expressions' ],

  requires: [ 'foam.core.boot.CSpec', 'foam.lang.Latch', 'foam.core.reflow.cmd.DAORowView' ],

  imports: [ 'AuthenticatedCSpecDAO as cSpecDAO', 'commandDAO', 'scope' ],

  properties: [
    [ 'description', 'DAOs available', 'uploadAvailable' ]
  ],

  methods: [
    function execute(opt_nameQuery) {
      var self = this;
      this.commandDAO.find('upload').then( r => this.uploadAvailable = !! r );
      var dao  = this.cSpecDAO?.where(this.CSpec.SERVED_DAOS);
      var count = foam.lang.SimpleSlot.create({value: 0});
      if ( opt_nameQuery ) dao = dao?.where(
        this.OR(
          this.CONTAINS_IC(this.CSpec.NAME,     opt_nameQuery),
          this.CONTAINS_IC(this.CSpec.KEYWORDS, opt_nameQuery)
        ));
      this.out.tag('br');
      this.out.start('table').attr('width', '100%').
        select(dao, function(n) {
          var sdao = self.__context__[n.name] || self.scope[n.name];
          if ( ! sdao ) {
            console.error('Uknown DAO:', n.name);
            return;
          }
          var of   = sdao.of;

          if ( ! of ) {
            console.log('Bad DAO:', n.name);
            return;
          }

          count.value++;
          var shortName = n.name;
          if ( shortName.endsWith('DAO') ) shortName = shortName.substring(0, shortName.length-3);

          this.tag(self.DAORowView, {
            name: n.name,
            shortName: shortName,
            description: n.description,
            ofId: of.id,
            uploadAvailable: self.uploadAvailable,
            data: self
          });
        }).
        end().
        start('b').add(count, ' selected').end();
    }
  ]
});
