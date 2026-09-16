<flow name="Notification" category="DOC/DEV" spid="foam"/>
<h1>Notification System</h1>

<h2>Documentation TODO</h2>
<ul>
  <li>Notifications and NotificationTemplates</li>
  <li>NotificationTemplates and EmailTemplates</li>
  <li>NotificationSettings</li>
  <li>NotificationSettingDefaultss</li>
  <li>Notification and EventRecords</li>
  <li>NotificationDAO vs Notifiable.doNotify</li>
</ul>

<h1>Notification Overview</h1>
A <b>Notification</b> is a message sent to a user, or group of users
over a number of different mediums such as email or sms.
A notification also appears as in-app message under the bell icon
or the notifications menu.
Notifications should not relay sensitive information, but rather
direct the user, via links, back into the application to see
the sensitive information, if required.

<h1>Notification Templates</h1>
Notifcations can be crafted and sent at runtime, but more
often they are designed along with other features and work
to report normal or abnormal operation.  In this context
templates are used to capture which predefined users or groups
are to messaged in different scenarios.

<h1>Notification Email Templates</h1>
A notification template can indicate an email template to be used
when the user has appropriate Email settings allowing notification
via email.  The notification and/or notification template carries
key-value arguments which are used to populate the email template.

<h1>services localNotifcationDAO vs notificationDAO</h1>
All DAO operations should be against the notificationDAO. The localNotificationDAO is only meant to be used by the Notification system itself.

<h1>GoogleChat</h1>
FOAM supports GoogleChat Cards V2 for notification. To enable, add your webhook url to notification template with templateName: foam-core-er-EventRecordNotificationTemplate.<br/>
Copy template from src/foam/core/er/notificationTemplates.jrl to a deployment specific to your production environment and add your webhook.
<code>
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
</code>

Additionally, a <b>GoogleChatSetting</b> configuration must exist for spid, group, or user. Generally a default is provided for a spid. For example:<br/>
<code>
deployment/some-production-environment/notificationSettingDefaults.jrl

p({
  class:"foam.core.notification.GoogleChatSetting",
  "id":"a-unique-id",
  "spid":"your-spid"
})
</code>
