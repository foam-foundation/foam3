/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "ascript",

  javaFiles: [
    { name: "Lib" },
  ],

  files: [
    { name: "AScriptParser",                             flags: "js" },
    { name: "Lib",                                       flags: "js" },
    { name: "ALang",                                     flags: "js" },
    { name: "AScriptDemo",                               flags: "js&demo" },
    { name: "AScriptPropertyFilterTest",                 flags: "js&test|java&test" }
  ]
});
