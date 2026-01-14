/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "javet",

  projects: [
    { name: "test/pom",                              flags: "test" },
  ],

  files: [
    { name: "JavetShell",                            flags: "js|java"},
    { name: "JavetShellFactory",                     flags: "js|java"}
  ]
});
