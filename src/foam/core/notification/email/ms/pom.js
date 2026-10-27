/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "ms",
  version: 3,
  licenses: [
    `
    Copyright 2025 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],
  files: [
    { name: "EmailServiceConfig",             flags: "js|java" },
    { name: "MicrosoftGraphEmailAgent",       flags: "js|java" },
    { name: "test/MicrosoftGraphEmailAgentTest", flags: "js&test|java&test" }
  ],
  journalFiles: [
    { name: "test/tests",                     flags: "test" }
  ],
  javaDependencies: [
    'com.azure:azure-identity:1.15.4 -io.netty:netty-resolver-dns-native-macos -io.netty:netty-transport-native-epoll -io.netty:netty-transport-native-kqueue'
  ]
});