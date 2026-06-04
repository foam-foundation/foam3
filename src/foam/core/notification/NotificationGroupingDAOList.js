/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationGroupingDAOList',
  extends: 'foam.u2.GroupingDAOList',

  documentation: 'An extension of GroupingDAOList that adds additional actions for Notifications.',

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'stack',
    'myNotificationDAO',
    'subject',
    'group'
  ],

  requires: [
    'foam.core.notification.Notification',
    'foam.dao.ArraySink'
  ],

  exports: [
    'notificationDAO'
  ],

  css: `
    ^button {
      margin-left: auto;
    }
  `,

  methods: [
    function render() {
      this.onDetach(this.stack.setTrailingContainer(
        this.E()
          .startContext({data: this})
            .tag(this.MARK_ALL_AS_READ).addClass(this.myClass('button'))
          .endContext()
      ));
      this.SUPER();
    }
  ],

  actions: [
    {
      name: 'markAllAsRead',
      code: function(X) {
        //this.myNotificationDAO
      }
    }
  ]
});