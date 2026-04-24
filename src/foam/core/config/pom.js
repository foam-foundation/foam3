/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.POM({
  name: "config",
  files: [
    { name: "GlobalConfigType",      flags: "js|java" },
    { name: "GlobalConfig",          flags: "js|java" },
    { name: "GlobalConfigValueView", flags: "js"      },
    { name: "GlobalConfigs",         flags: "js"      }
  ],
  javaFiles: [
    { name: "GlobalConfigs" }
  ]
});
