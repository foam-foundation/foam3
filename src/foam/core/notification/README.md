Notification

Updated : August 24, 2022



#### Notification


To support dynamic language translation depending on locale or language, use an extended notification model.

For example, check 'SendExpiryNotification.js' and 'SendExpiryNotificationRule.js'

Its model extends 'foam.core.notification.Notification'

The intention of this is to provide a body that responds on the fly.
So its 'body' property has javaGetter or getter with transient value true.
Inside javaGetter or getter, create a body by combining message with TranslationService.

This extended model will be used where its functionality is called such as service, rule.









