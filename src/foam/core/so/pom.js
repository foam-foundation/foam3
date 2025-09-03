/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "so",
  projects: [
    { name: "test/pom", flags: "test" }
  ],
  files: [
    { name: "MessageTask",                                            flags: "js|java" },
    { name: "OrphanedTaskDeactivateRuleAction",                       flags: "js|java" },
    { name: "Relationships",                                          flags: "js|java" },
    { name: "SystemOutage",                                           flags: "js|java" },
    { name: "SystemOutageAgent",                                      flags: "js|java" },
    { name: "SystemOutageOnActivateRuleAction",                       flags: "js|java" },
    { name: "SystemOutageOnDeactivateRuleAction",                     flags: "js|java" },
    { name: "SystemOutageRemoveRuleAction",                           flags: "js|java" },
    { name: "SystemOutageTask",                                       flags: "js|java" },
    { name: "SystemNotification",                                     flags: "java|js" },
    { name: "SystemNotificationBorder",                               flags: "web" },
    { name: "SystemNotificationService",                              flags: "js|java" },
    { name: "SystemNotificationPredicate",                            flags: "js|java" },
    { name: "SystemNotificationServiceClient",                        flags: "js" },
    { name: "SystemNotificationServiceServer",                        flags: "js|java" },
    { name: "SystemNotificationTask",                                 flags: "java|js" },
    { name: "TaskCleanUpRuleAction",                                  flags: "js|java" }
  ]
});
