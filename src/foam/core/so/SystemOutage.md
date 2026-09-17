<flow name="SystemOutage" category="DOC/DEV" spid="foam"/>
# SystemOutage

SytemOutage is intended to model the actions taken when a system wide event has occured, or is occuring, such as maintenance event, or third party end-point failing.

## SystemNotification

A SytemOutage with a **task** of type **SystemNotificationTask** will display the **SystemNotification.message** via a **SystemNotificationBorder**.

SystemNotificationTasks can be filtered by theme/permission/CIDR Blocks. This filtering is done by the **SystemNotificationServiceServer**.

## SystemNotificationPredicate

SystemNotificationPredicate is a JS only predicate that can be used to check if there are any active SystemOutages with a SystemNotificationTask that matches the key.

## EventRecord Integration

If an EventRecord has a **SystemOutage** reference, then the **EventRecord** will **activate** and **deactivate** the **SystemOutage** as the **EventRecord** transitions from severity **INFO** to/from **WARN** or **ERROR**.
