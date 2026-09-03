/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.POM({
  name: "app",

  projects: [
    { name: 'test/pom',                             flags: "test"}
  ],

  files: [
    { name: "AppBadgeView",                         flags: "web" },
    { name: "AppConfig",                            flags: "js|java" },
    { name: "AppConfigService",                     flags: "js|java" },
    { name: "AppDownloadBadgeService",              flags: "web" },
    { name: "ClientAppConfigService",               flags: "js" },
    { name: "ContextLookupAppConfigService",        flags: "js|java" },
    { name: "Health",                               flags: "js|java" },
    { name: "HealthFactory",                        flags: "js|java" },
    { name: "HealthHeartbeatMonitor",               flags: "js|java" },
    { name: "HealthHeartbeatService",               flags: "js|java" },
    { name: "HealthRemoveDAO",                      flags: "js|java" },
    { name: "HealthSupport",                        flags: "js|java" },
    { name: "HealthStatus",                         flags: "js|java" },
    { name: "LegalMenu",                            flags: "js|java" },
    { name: "Mode",                                 flags: "js|java" },
    { name: "ShutdownWatcher",                      flags: "js|java" },
    { name: "SupportConfig",                        flags: "js|java" },
    { name: "SupportMenu",                          flags: "js|java" }
  ],
  javaFiles: [
    { name: "HealthWebAgent" },
    { name: "VersionWebAgent" }
  ]
});
