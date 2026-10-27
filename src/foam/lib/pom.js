/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "lib",

  files: [
    { name: "AndPropertyPredicate",                 flags: "js|java" },
    { name: "ClusterPropertyPredicate",             flags: "js|java" },
    { name: "ExternalPropertyPredicate",            flags: "js|java" },
    { name: "NetworkPropertyPredicate",             flags: "js|java" },
    { name: "Outputter",                            flags: "js|java" },
    { name: "PermissionedPropertyPredicate",        flags: "js|java" },
    { name: "PropertyPredicate",                    flags: "js|java" },
    { name: "StorageOptionalPropertyPredicate",     flags: "js|java" },
    { name: "StoragePropertyPredicate",             flags: "js|java" },
    { name: "StorageTransientPropertyPredicate",    flags: "js|java" },
    { name: "formatter/test/JSONFObjectFormatterParserTest", flags: "js&test|java&test"},
    { name: "xml/OutputXML",                        flags: "js|java" }
  ],

  postProjects: [
    { name: "json/pom" },
    { name: "parse/pom" },
    { name: "query/pom" }
  ],

  journalFiles: [
    { name: "formatter/test/tests",                 flags: "test" },
  ],

  javaFiles: [
    { name: "csv/CSVEscapeStringParser" },
    { name: "csv/CSVNewlineParser" },
    { name: "csv/CSVNormalStringParser" },
    { name: "csv/CSVStringParser" },
    { name: "csv/CSVSupport" },
    { name: "csv/YYMMDDParser" },
    { name: "formatter/AbstractFObjectFormatter" },
    { name: "formatter/FObjectFormatter" },
    { name: "formatter/JSONFObjectFormatter" },
    { name: "html/Outputter" },
    { name: "xml/Outputter" }
  ]
});
