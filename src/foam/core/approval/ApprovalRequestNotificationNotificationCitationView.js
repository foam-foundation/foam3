/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.approval',
  name: 'ApprovalRequestNotificationNotificationCitationView',
  extends: 'foam.core.notification.NotificationCitationView',

  requires: [
    'foam.comics.DAOUpdateControllerView',
    'foam.u2.stack.StackBlock'
  ],

  imports: [
    'DAO approvalRequestDAO',
    'DAO userDAO',
    'stack'
  ],

  exports: [
    'as data',
    'approvalRequestDAO as dao'
  ],

  properties: [
    'classification',
    {
      name: 'showClassification',
      class: 'Boolean',
      value: false
    },
    'monogram',
    'userSummary',
    {
      name: 'status',
      class: 'Enum',
      of: 'foam.core.approval.ApprovalStatus'
    },
    {
      name: 'hideStatus',
      class: 'Boolean',
      value: false
    },
  ],

  actions: [
    {
      name: 'viewMore',
      code: function() {
        this.stack.push(this.StackBlock.create({ view: { class: 'foam.comics.DAOUpdateControllerView', key: this.data.approvalRequest }, parent: this }));
      }
    }
  ],

  methods: [
    async function render() {
      //this.SUPER();
      var self = this;

      let approval = await self.approvalRequestDAO.find(this.data.approvalRequest);
      if ( approval ) {
        self.created = approval.created.toUTCString();
        self.classification = approval.classification;
        self.showClassification = !! self.classification;
        self.status = approval.status;

        let user = await self.userDAO.find(approval.createdBy);
          if ( user )
            this.userSummary = user.toSummary();
            // self.monogram = user.monogram;
      } else {
        this.created = self.data.created.toUTCString();
        this.showClassification = false;
        this.hideStatus = true;
      }

      this.description = this.data.body;

      this
        .addClass(this.myClass())
        .startContext({ mode: foam.u2.DisplayMode.RO, controllerMode: foam.u2.ControllerMode.VIEW })
            // .start().addClass('monogram')
            //   .add(this.monogram)
            // .end()
            .start().addClass(this.myClass('userSummaryDiv'))
              .callIf(this.userSummary, function() {
                this.start().addClass(this.myClass('userSummary'), 'p-label')
                  .add(this.userSummary$)
                .end();
              })
              .start().addClass(this.myClass('created'), 'p-legal-light')
                .add(this.created$)
              .end()
              .start().addClass(this.myClass('classification'), 'p-legal-light')
                .show(this.showClassification$).add(this.classification$)
              .end()
              .start().addClass(this.myClass('status'))
                .hide(this.hideStatus$)
                .add(this.STATUS)
              .end()
            .end()
            .start().addClass('p', this.myClass('description'))
              .add(this.description$)
            .end()
            // TODO: Enable when memento support and ability to jump to detail view
            // .start().addClass('viewMore')
            //   .add(this.VIEW_MORE)
            // .end()
        .endContext();
    }
  ],

  css: `
    ^ {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    ^userSummaryDiv {
      position: relative;
      display: flex;
      gap: 0.8rem;
      flex-wrap: wrap;
      align-items: center;
    }
    ^userSummary {
      color: $textDefault;
    }
    ^classification {
      background-color: $backgroundSecondary;
      color: $textSecondary;
      display: inline-block;
      min-width: 8.4rem;
      line-height: 2.1;
      padding: 0 0.8rem;
    }
    ^description {
      overflow: hidden;
      text-overflow: ellipsis;  
      white-space: nowrap;
    }
  `
});
