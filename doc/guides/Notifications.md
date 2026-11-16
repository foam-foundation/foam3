<flow name="Notifications" category="DOC/GUIDE" spid="foam" description="Overview of the notification system: notificationDAO, custom notification types, bell icon display, citation views." keywords="notifications,notificationdao,bell icon,citation view,knowledge"/>

# FOAM Notification System Overview

In FOAM, you can send notifications to individual users, groups of users, or broadcast them to all users in a system. The notification system is built around a core `Notification` class that can be extended for specialized use cases.

## Basic Notification Creation

You can create notifications programmatically using the `Notification.create()` method and persist them through the `notificationDAO`:

```javascript
let t1 = foam.core.notification.Notification.create({
  userId: x.subject.realUser.id,
  broadcasted: true,
  body: 'notification body',
  toastMessage: 'toast'
});
t1 = await x.notificationDAO.put(t1);
```

The base `Notification` class includes properties like `userId`, `groupId`, `broadcasted`, `body`, `toastMessage`, `severity`, and `notificationType`.

## Custom Notification Subclasses

You can extend the base `Notification` class to create specialized notification types with additional properties. For example, `TicketNotification` adds a `ticket` reference:

```javascript
foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketNotification',
  extends: 'foam.core.notification.Notification',
  properties: [
    {
      class: 'Reference',
      of: 'foam.core.ticket.Ticket',
      name: 'ticket'
    }
  ]
});
```

You can then create and send these custom notifications just like standard ones:

```javascript
let t2 = foam.core.ticket.TicketNotification.create({
  userId: x.subject.realUser.id,
  broadcasted: true,
  body: 'ticket body',
  ticket: ticketId
});
t2 = await x.notificationDAO.put(t2);
```

## Notification Display and Views

Users access notifications through the notifications bell icon, which displays notifications in a list format. Each notification is rendered using a `NotificationCitationView`.

### Custom Citation Views

For custom notification types, you can create specialized citation views by extending `NotificationCitationView` and following the naming convention `<ModelName>NotificationCitationView`. For example:

```javascript
foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketNotificationNotificationCitationView',
  extends: 'foam.core.notification.NotificationCitationView',
  methods: [
    function render() {
      // Custom rendering logic here
    }
  ]
});
```

This pattern is used in other parts of the system, such as `ApprovalRequestNotificationNotificationCitationView` and `BroadcastNotificationNotificationCitationView`.

## Notification DAO System

FOAM uses a sophisticated DAO system for managing notifications:

- `localNotificationDAO`: Internal storage for notifications
- `notificationDAO`: Main service DAO with authorization and decorators
- `myNotificationDAO`: User-specific notification DAO with polling and toast support

## Additional Features

### Notification Templates
Notifications can be created from templates that define default recipients and content.

### Broadcasting
The `broadcasted` property allows sending notifications to all users or entire groups.

### Integration Points
Notifications integrate with various FOAM systems:
- Scripts can send notifications upon completion
- Rules can trigger notifications through `SendNotification` actions
- Ticket system automatically creates notifications for comments

## Notes

- The notification system supports multiple delivery channels including in-app display, email, and Google Chat
- Notifications include authorization controls to ensure users can only access their own notifications
- Custom notification views can include interactive elements like buttons, links, and custom formatting for enhanced user experience.
