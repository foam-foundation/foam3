/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "json2",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "Json2PropertyRefine",                                flags: "swift" },
    { name: "OutputterOutput",                                    flags: "swift" },
    { name: "ProxyOutputterOutput",                               flags: "swift" },
    { name: "SimpleOutputterOutput",                              flags: "swift" },
    { name: "PrettyOutputterOutput",                              flags: "swift" },
    { name: "Outputter",                                          flags: "swift" },
    { name: "Serializer",                                         flags: "swift" },
    { name: "Deserializer",                                       flags: "swift" },
  ]
});
