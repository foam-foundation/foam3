<flow name="Notifications" category="DOC/GUIDE" spid="foam" description="Overview of the notification system: notificationDAO, templates, locale templates, email, bell icon display, citation views." keywords="notifications,notificationdao,locale template,emailargs,bell icon,citation view,knowledge"/>

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

## How a Notification Reaches a User

Every notification is put to `notificationDAO`, whose decorators turn it into one notification per user (`services.jrl`):

1. **`NotificationTemplateDAO`** merges in the notification template named by `template`, when there is one (see Notification Templates below).
2. **`NotificationExpansionDAO`** picks the recipients:
   - `broadcasted: true` sends to every active user, limited to `broadcastSpid` when it is set.
   - `groupId` sends to every active user whose group is that group. A missing group logs `Notification group not found` and sends nothing.
   - `userId` sends to that user.
3. **`predicate`**, when set, is tested against each user of a broadcast or group, and a user it rejects gets nothing. It is transient: it is read once while expanding and never stored.
4. **For each user,** the notification is copied, its locale template is applied in that user's language (see Locale Templates below), and it is put to `userNotificationDAO`.
5. **`User.doNotify`** runs each `NotificationSetting` that applies to the user: system defaults (spid `*`), then the user's spid, then the user's own settings. The in-app setting stores the notification for the bell icon; `EmailSetting` sends an email when the notification has an `emailName`. Other settings send to Google Chat, Slack, SMS or push.

Because the text is filled in per user at step 4, two users can receive the same notification in two languages.

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

Values that only fill in text do not need a subclass: put them in `emailArgs`, which both the locale template and the email template read.

## Notification Templates

A notification template is a `Notification` row in `notificationTemplateDAO` (journal `notificationTemplates`) that carries default recipients and content. A notification names it in `template`. `NotificationTemplateDAO` starts from the template and keeps the notification's own `body`, `toastMessage`, `toastSubMessage`, `emailName`, `spid` and a few other fields when they are set. The notification's `userId`, `groupId` and `broadcasted` are used only where the template leaves them unset. When both carry `emailArgs`, the notification's keys are added where the template does not already have them; when the template has no `emailArgs`, the notification's are dropped, so give such a template an empty `emailArgs: {}`.

A deployment can change a template's recipients by replaying a row with the same `id` that sets only `groupId`, for example to send EventRecord alerts to an operations group.

## Locale Templates

A locale template writes a notification's text in the reader's language. The sender puts the values in `emailArgs` and names the template in `localeTemplateName`; each user's copy is filled in their own language before it is stored.

```
// notificationLocaleTemplates.jrl
c({
  name:"MyFeatureDone",
  language:{class:"foam.core.auth.LanguageId",code:"en"},
  toastMessage:"{{actor}} finished {{task}}",
  body:"{{count}} rows updated.\\nNo action needed."
})
c({
  name:"MyFeatureDone",
  language:{class:"foam.core.auth.LanguageId",code:"fr"},
  toastMessage:"{{actor}} a terminé {{task}}",
  body:"{{count}} lignes mises à jour.\\nAucune action requise."
})
```

```java
Notification n = new Notification();
n.setBroadcasted(true);
n.setLocaleTemplateName("MyFeatureDone");
n.getEmailArgs().put("actor", actor.toSummary());
n.getEmailArgs().put("task",  "Import");
n.getEmailArgs().put("count", 42L);
((DAO) x.get("notificationDAO")).put(n);
```

- **Lookup.** `notificationLocaleTemplateDAO` (journal `notificationLocaleTemplates`) is keyed by `name` and `language`. `NotificationLocaleTemplateSupport.applyLocaleTemplate` tries the user's language with its variant, then the language code alone, then English. When none exists it logs `NotificationLocaleTemplate not found` and the notification keeps whatever text it had.
- **Only empty fields are filled.** `NotificationLocaleTemplate.apply` renders `body`, `toastMessage` and `toastSubMessage` only when the notification's own value is empty. A sender that sets `body` itself gets that body in every language.
- **The result is also put in `emailArgs`:** `body`, `toastMessage`, and `title` (the toast message), so the email template can print the same text.
- **Placeholders** are rendered by `EmailTemplateEngine`: `{{key}}` prints an `emailArgs` value (a number or date is printed with `toString`, an FObject with `toSummary`). `{% if key %}…{% else %}…{% endif %}` shows a block when the key is present in `emailArgs`. Blocks can follow one another but cannot be nested, and the engine cannot choose a singular or plural word, so put the count after a label ("Due within 5 days: 3").
- **Line breaks** are written as `\\n` in the journal, which stores the two characters `\n`. The popup shows them as a line break and `EmailSetting` turns them into `<br>` for the email. The bell row prints the body as stored.
- **`localeTemplateName` and `localeTranslationMappings` are storage-transient:** they steer the expansion and are not saved with the notification.

### Translating Values

A value such as a status label can be translated per reader too. `localeTranslationMappings` maps an `emailArgs` key to a translation id, and the value is replaced with `TranslationService.getTranslation(locale, id, value)` before the template is rendered, keeping the English value when there is no translation:

```java
n.getEmailArgs().put("status", txn.getStatus().getLabel());
Map mappings = new HashMap();
mappings.put("status", txn.getStatus().getClass().getName() + "." + txn.getStatus().getName() + ".label");
n.setLocaleTranslationMappings(mappings);
```

Mapping a key to `CURRENCY_TYPE` formats it as money instead: the currency is read from the `emailArgs` key with `Currency` appended (`amount` and `amountCurrency`), and the amount, in minor units or as a decimal, is formatted for the reader's language.

## Notification Emails

A notification sends an email when it has an `emailName`, the id or name of an `EmailTemplate`, and the user's `EmailSetting` is enabled. `EmailSetting` copies the notification's `body` into `emailArgs` under `body`, so an email template prints `{{body}}` and `{{title}}` and any other `emailArgs` key.

The email template is chosen in the reader's language. `EmailTemplateSupport.findTemplate` looks a non-English template up only in the reader's group and its parent groups; group `*` is tried with English only. A French email template must therefore name a group the readers belong to, such as their common parent group, or French readers receive the English one:

```
p({
  class: "foam.core.notification.email.EmailTemplate",
  id: "my-feature-done-fr",
  name: "my-feature-done",
  locale: "fr",
  group: "basicUser",
  subject: "Tâche terminée",
  body: "..."
})
```

## Google Chat

`GoogleChatSetting` posts a notification to a Google Chat space as a Cards V2 card when the notification has a `googleChatWebhook`. The card's title is the first line of `googleChatMessage`, or of the `body` when there is no message, and its subtitle is the server's host name. Posts go through the `googleChatNotificationThrottler`.

To send EventRecord alerts to a space, copy the EventRecord notification template (id 3 in `src/foam/core/er/notificationTemplates.jrl`) into the production deployment and add the space's webhook URL:

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

The user must also have a `GoogleChatSetting`. foam3's `notificationSettingDefaults.jrl` enables one for every spid (`*`); a deployment that does not keep that default can add one for its own spid:

```
deployment/some-production-environment/notificationSettingDefaults.jrl

p({
  class:"foam.core.notification.GoogleChatSetting",
  "id":"a-unique-id",
  "spid":"your-spid"
})
```

## Notification Display and Views

Users access notifications through the notifications bell icon, which displays notifications in a list format. Each row is rendered by `NotificationCitationView`, which shows the date and the body, or the toast message when there is no body. Clicking a row opens `NotificationMessageModal`, which shows the `body` from `emailArgs` as plain text with its line breaks, falling back to the notification's own `body` and toast messages.

### Custom Citation Views

Both views are `Faceted`: for a notification of class `<package>.<ModelName>`, the row uses `<package>.<ModelName>NotificationCitationView` and the popup uses `<package>.<ModelName>NotificationMessageModal` when those classes exist. For example:

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

This pattern is used in other parts of the system, such as `ApprovalRequestNotificationNotificationCitationView` and `BroadcastNotificationNotificationCitationView`. The views are found by name only, so nothing in the code refers to them: a search for references finds none, and they are not unused. When a locale template fills the text, show `toastMessage` or `body` in a custom view, since those are the fields filled in the reader's language.

## Notification DAO System

FOAM uses a DAO system for managing notifications:

- `localNotificationDAO`: Internal storage for notifications
- `notificationDAO`: Main service DAO with authorization and the template and expansion decorators; send every notification through it
- `userNotificationDAO`: Stores each user's copy and calls `User.doNotify`
- `myNotificationDAO`: User-specific notification DAO with polling and toast support
- `notificationTemplateDAO` and `notificationLocaleTemplateDAO`: Notification templates and locale templates

## Integration Points

Notifications integrate with various FOAM systems:
- Scripts can send notifications upon completion (`ScriptRunNotification`)
- Rules can trigger notifications through `SendNotification` actions
- The ticket system creates notifications for comments and status changes (`TicketNotificationRuleAction`)

## Notes

- The notification system supports multiple delivery channels including in-app display, email, Google Chat, Slack, SMS and push
- Notifications include authorization controls to ensure users can only access their own notifications
- Custom notification views can include interactive elements like buttons, links, and custom formatting for enhanced user experience.
