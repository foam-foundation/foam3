# FOAM Notification System Overview

In FOAM, you can send notifications to individual users, groups of users, or broadcast them to all users in a system. The notification system is built around a core `Notification` class that can be extended for specialized use cases.

## Basic Notification Creation

You can create notifications programmatically using the `Notification.create()` method and persist them through the `notificationDAO`:

```javascript
let t1 = foam.core.notification.Notification.create({
  userId: x.subject.realUser.id,
  broadcasted: true,
  body: 'notification body',
  message: 'message',
  toastMessage: 'toast'
});
t1 = await x.notificationDAO.put(t1);
```

The base `Notification` class includes properties like `userId`, `groupId`, `broadcasted`, `body`, `toastMessage`, `severity`, and `notificationType` [1](#0-0) .

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
``` [2](#0-1)

You can then create and send these custom notifications just like standard ones:

```javascript
let t2 = foam.core.ticket.TicketNotification.create({
  userId: x.subject.realUser.id,
  broadcasted: true,
  body: 'ticket body',
  message: 'message',
  ticket: ticketId
});
t2 = await x.notificationDAO.put(t2);
```

## Notification Display and Views

Users access notifications through the notifications bell icon, which displays notifications in a list format. Each notification is rendered using a `NotificationCitationView` [3](#0-2) .

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

This pattern is used in other parts of the system, such as `ApprovalRequestNotificationNotificationCitationView` [4](#0-3)  and `BroadcastNotificationNotificationCitationView` [5](#0-4) .

## Notification DAO System

FOAM uses a sophisticated DAO system for managing notifications:

- `localNotificationDAO`: Internal storage for notifications [6](#0-5)
- `notificationDAO`: Main service DAO with authorization and decorators [7](#0-6)
- `myNotificationDAO`: User-specific notification DAO with polling and toast support [8](#0-7)

## Additional Features

### Notification Templates
Notifications can be created from templates that define default recipients and content [9](#0-8) .

### Broadcasting
The `broadcasted` property allows sending notifications to all users or entire groups [10](#0-9) .

### Integration Points
Notifications integrate with various FOAM systems:
- Scripts can send notifications upon completion [11](#0-10)
- Rules can trigger notifications through `SendNotification` actions [12](#0-11)
- Ticket system automatically creates notifications for comments [13](#0-12)

## Notes

- The notification system supports multiple delivery channels including in-app display, email, and Google Chat [14](#0-13)
- Notifications include authorization controls to ensure users can only access their own notifications [15](#0-14)
- Custom notification views can include interactive elements like buttons, links, and custom formatting for enhanced user experience.
