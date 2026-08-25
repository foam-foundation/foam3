/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketCitationView',
  extends: 'foam.dashboard.view.DashboardCitationView',

  properties: [
    {
      class: 'Class',
      of: 'foam.core.ticket.Ticket'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      value: 'ticketDAO'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this
        .on('click', function() {
          self.openFilteredListView(self);
        });
      this.addClass(this.myClass());
      this.startContext({ data: this.data, controllerMode: foam.u2.ControllerMode.VIEW })
        .start().addClass(this.myClass('wrapper'))
          .start().addClass(this.myClass('myline'))
            .start().addClass('float-left')
              .add(this.data.STATUS)
            .end()
            .start().addClass('float-right')
              .add(this.data.TITLE)
            .end()
          .end()
        .end()
      .endContext();
    }
  ]
});
