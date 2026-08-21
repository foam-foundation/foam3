/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.support.view',
  name: 'TicketView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.Router'],

  requires: [
    'foam.support.view.CreateTicketView',
    'foam.support.view.TicketDetailView',
    'foam.u2.ListCreateController'
  ],

  imports: [
    'createLabel',
    'subject'
  ],

  exports: [ 'hideSummary' ],

  css:`
    ^ {
      width: 970px;
      margin: auto;
    }
    ^ .foam-support-view-SummaryCard{
      width: 15.8%;
    }
    ^ .foam-u2-ActionView-create {
      float: right;
      width: 135px;
      height: 40px;
      color: white;
      background-color: #59a5d5;
      border: none;
      margin: 0 20px 20px;
    }
    ^ .button-div{
      height: 40px;
    }
    ^ .foam-u2-ListCreateController{
      top: 30px;
      position: relative;
    }
  `,

  messages: [
    { name: 'TITLE', message: 'Support' }
  ],

  properties: [
    {
      class: 'String',
      name: 'viewTitle',
      factory: function() {
        return this.TITLE;
      }
    },
    {
      class: 'Boolean',
      name: 'hideSummary'
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.addCrumb();
      this.onDetach(this.stack?.setTitle(this.viewTitle$, this));
    },

    function render() {
      this.addClass()
      .start().hide(this.hideSummary$)
        .tag({ class: 'foam.support.view.TicketSummaryView' })
      .end()
      .tag({
        class: 'foam.u2.ListCreateController',
        dao: this.subject.user.tickets,
        detailView: this.TicketDetailView,
        summaryView: this.TicketTableView,
        createDetailView: this.CreateTicketView,
        createLabel:'New Ticket',
        showActions: false
      })
    }
  ],

  classes: [
    {
      name: 'TicketTableView',
      extends: 'foam.u2.View',

      requires: [
        'foam.u2.view.ScrollableTableView',
        'foam.support.model.Ticket',
      ],

      imports: [ 'user'],

      properties: [
        'selection'
      ],

      methods: [
        function render() {
          this
            .start({
              selection$: this.selection$,
              class: 'foam.u2.table.TableView',
              data: this.subject.user.tickets,
            }).addClass(this.myClass('table')).end();
        }
      ]
    }
  ]
});
