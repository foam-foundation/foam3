/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "security",
  projects: [
    { name: "test/pom",                            flags: "test"}
  ],
  files: [
    { name: "KeyStoreManager",                     flags: "js|java" },
    { name: "KeyStoreAware",                       flags: "js|java" },
    { name: "EmptyKeyStoreManager",                flags: "js|java" },
    { name: "StorageKeyStoreManager",              flags: "js|java" }
  ]
});
