/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationGroupingDAOList',
  extends: 'foam.u2.GroupingDAOList',

  documentation: 'An extension of GroupingDAOList that adds a MARK_ALL_AS_READ action',

  imports: [
    'stack',
    'myNotificationDAO',
    'notificationDAO',
  ],

  requires: [
    'foam.core.notification.Notification',
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'readTabIsOpen',
    }
  ],

  css: `
    ^button {
      margin-left: auto;
    }
  `,

  methods: [
    function render() {
      // Subscribe to dao changes
      this.data$proxy.sub('on', this.onDAOUpdate);
      this.onDAOUpdate();

      // Render the action at the top of the page
      this.onDetach(this.stack.setTrailingContainer(
        this.E()
          .startContext({data: this})
            .tag(this.MARK_ALL_AS_READ).addClass(this.myClass('button'))
          .endContext()
      ));
      
      this.SUPER();
    }
  ],

    listeners: [
    {
      name: 'onDAOUpdate',
      isFramed: true,
      code: async function() {
        // Look for the dao (this will have only the current tab's records)
        var dao = this.data;
        if ( ! dao ) return;

        // Get the first record
        var result = await dao.limit(1).select();
        if ( result?.array?.length > 0 ) {
          // Check if the first record is read or not
          this.readTabIsOpen = result.array[0].read;
        }

        // If there are no notifications
        if ( result?.array?.length == 0 ) {
          // Hide the button
          this.readTabIsOpen = true;
        }
      }
    }
  ],

  actions: [
    {
      name: 'markAllAsRead',
      isAvailable: function(readTabIsOpen) {
        // Only show the button when we're on the 'Unread' tab
        return ! readTabIsOpen;
      },
      code: async function(X) {
        try {
          // Clone the unread notifications in myNotificationDAO
          var unreadNotifs = await this.myNotificationDAO.where(this.EQ(this.Notification.READ, false)).select();
          // Update the read property for all of 'em
          for ( var notif of unreadNotifs.array ) {
            var clone = notif.clone();
            clone.read = true;
            // We need to put to notificationDAO NOT myNotificationDAO
            // because of how the permissions are set up
            await this.notificationDAO.put(clone);
          }
          // Purge the cache to trigger a refresh
          this.myNotificationDAO.cmd(foam.dao.DAO.PURGE_CMD);
        } catch (e) {
          console.log(e);
        }
      }
    }
  ]
});