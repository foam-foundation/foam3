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
    'memento_'
  ],

  requires: [
    'foam.core.notification.Notification',
    'foam.dao.ArraySink',
    'foam.u2.memento.WindowHashMemento'
  ],

  exports: [
    'notificationDAO'
  ],

  properties: [
    {
      class: 'String',
      name: 'query_',
      // Pre-set the value because the query property is only set after the user
      // clicks a tab for the first time BUT the 'Unread' tab will be the first
      // tab the user sees, so the button should be visible immediately.
      value: 'Unread'
    }
  ],

  css: `
    ^button {
      margin-left: auto;
    }
  `,

  methods: [
    // Walk the memento hierarchy to find the WindowHashMemento
    function topMemento_() {
      var m = this.memento_;
      while ( ! this.WindowHashMemento.isInstance(m) && m.parent ) m = m.parent;
      return m;
    },

    // Init the memento-related things we need
    function init() {
      var self = this, top = this.topMemento_();
      function refresh() {
        // Check the memento's usedStr for the query parameter
        var hit = /[?&]query=([^&]*)/.exec(top.usedStr || '');
        // Return the value from the query parameter
        self.query_ = hit ? decodeURIComponent(hit[1]) : '';
      }
      // Call refresh() everytime the memento's usedStr updates
      this.onDetach(top.usedStr$.sub(refresh));
    },

    // Render the action at the top of the page
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
      isAvailable: function(query_) {
        // Only show the button when we're on the 'Unread' tab
        return query_ === 'Unread';
      },
      code: async function(X) {
        try {
          // Clone the unread notifications in myNotificationDAO
          var unreadNotifs = await this.myNotificationDAO.where(this.EQ(this.Notification.READ, false)).select();

          // Update the read property for all of 'em
          for ( var notif of unreadNotifs.array ) {
            var clone = notif.clone();
            clone.read = true;
            await this.myNotificationDAO.put(clone);
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
  ]
});