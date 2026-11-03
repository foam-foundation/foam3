/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// One of n pom files controlling foam model load boot order.
//
// Attempt to add additional files to a package scoped pom file

foam.POM({
  name: "bootstrap-3",

  projects: [
    { name: "foam/swift/pom" },
    { name: "foam/java/pom" },
    { name: "foam/json2/pom" },
    { name: "foam/util/pom" },
    { name: "foam/log/pom" }
  ],

  files: [
    { name: "foam/lang/PropertyInfo",               flags: "js|java" },
    { name: "foam/lang/Fluent",                     flags: "js" },
    { name: "foam/memento/MementoMgr",              flags: "js" },
    { name: "foam/web/DetachedURLState",            flags: "web" },
    { name: "foam/web/URLState",                    flags: "web" },
    { name: "foam/input/TouchEvent",                flags: "web" },
    { name: "foam/input/Mouse",                     flags: "web" },
    { name: "foam/input/Touch",                     flags: "web" },
    { name: "foam/input/Pointer",                   flags: "web" }
  ]
});
