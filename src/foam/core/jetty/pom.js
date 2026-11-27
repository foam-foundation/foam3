/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "jetty",

  files: [
    { name: "HttpServer",
      flags: "js|java" },
    { name: "IPAccess",
      flags: "js|java" },
    { name: "IPAccessSink",
      flags: "java" },
    { name: "IPAccessAddSink",
      flags: "java" },
    { name: "JettyThreadPoolConfig",
      flags: "js|java" },
    { name: "test/BindAddressTest",
      flags: "java&test" }
  ],
  journalFiles: [
    { name: "test/tests",
      flags: "test" }
  ]
})
