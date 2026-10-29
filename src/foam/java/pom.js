/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "java",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "Argument",                                           flags: "genjava" },
    { name: "ClassInfo",                                          flags: "genjava" },
    { name: "Interface",                                          flags: "genjava" },
    { name: "Class",                                              flags: "genjava" },
    { name: "Code",                                               flags: "genjava" },
    { name: "CodeProperty",                                       flags: "genjava" },
    { name: "Field",                                              flags: "genjava" },
    { name: "JavaImplements",                                     flags: "genjava" },
    { name: "InterfaceMethod",                                    flags: "genjava" },
    { name: "Method",                                             flags: "genjava" },
    { name: "Constant",                                           flags: "genjava" },
    { name: "Enum",                                               flags: "genjava" },
    { name: "Outputter",                                          flags: "genjava" },
    { name: "PropertyInfo",                                       flags: "genjava" },
    { name: "Skeleton",                                           flags: "genjava" },
    { name: "JavaImport",                                         flags: "genjava" },
    { name: "Builder",                                            flags: "genjava" },
    { name: "refinements",                                        flags: "genjava" },
    { name: "Util",                                               flags: "js|java" },
    { name: "ParseTemplateTest",                                  flags: "js&test|java&test" },
  ]
});
