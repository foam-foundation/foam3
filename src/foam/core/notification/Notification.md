<flow name="Notification" category="DOC/DEV" spid="foam" description="Notification system overview: Notifications, NotificationTemplates, email templates, and GoogleChat webhook integration." keywords="notification,template,email,googlechat,knowledge"/>

# Notification System

## Documentation TODO

- Notifications and NotificationTemplates
- NotificationTemplates and EmailTemplates
- NotificationSettings
- NotificationSettingDefaultss
- Notification and EventRecords
- NotificationDAO vs Notifiable.doNotify

# Notification Overview

A **Notification** is a message sent to a user, or group of users
over a number of different mediums such as email or sms.
A notification also appears as in-app message under the bell icon
or the notifications menu.
Notifications should not relay sensitive information, but rather
direct the user, via links, back into the application to see
the sensitive information, if required.

# Notification Templates

Notifcations can be crafted and sent at runtime, but more
often they are designed along with other features and work
to report normal or abnormal operation.  In this context
templates are used to capture which predefined users or groups
are to messaged in different scenarios.

# Notification Email Templates

A notification template can indicate an email template to be used
when the user has appropriate Email settings allowing notification
via email.  The notification and/or notification template carries
key-value arguments which are used to populate the email template.

# services localNotifcationDAO vs notificationDAO

All DAO operations should be against the notificationDAO. The localNotificationDAO is only meant to be used by the Notification system itself.

# GoogleChat

FOAM supports GoogleChat Cards V2 for notification. To enable, add your webhook url to notification template with templateName: foam-core-er-EventRecordNotificationTemplate.**Copy template from src/foam/core/er/notificationTemplates.jrl to a deployment specific to your production environment and add your webhook.

```
deployment/some-production-environment/notificationTemplates.jrl

p({
  class:"foam.core.notification.Notification",
  id: 3,
  template: "foam-core-er-EventRecordNotificationTemplate",
  emailName:"foam-core-er-EventRecordEmailTemplate",
  groupId: "noc",
  notificationType: "NOC",
  googleChatWebhook: "https://chat.googleapis.com/v1/spaces/example/messages?key=example"
})
```

Additionally, a <b>GoogleChatSetting** configuration must exist for spid, group, or user. Generally a default is provided for a spid. For example:

```
deployment/some-production-environment/notificationSettingDefaults.jrl

p({
  class:"foam.core.notification.GoogleChatSetting",
  "id":"a-unique-id",
  "spid":"your-spid"
})
```
