/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "parse",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "StringPStream",                                      flags: "js" },
    { name: "ErrorReportingPStream",                              flags: "js" },
    { name: "TrapPStream",                                        flags: "js" },
    { name: "InvalidPStream",                                     flags: "js" },
    { name: "parse",                                              flags: "js" },
    { name: "Span",                                               flags: "js" },
    { name: "JSPStream",                                          flags: "js" },
    //    { name: "TracingPStream",                               flags: "js" },
    { name: "json/String",                                        flags: "js" },
    { name: "json/Parsers",                                       flags: "js" },
    { name: "QueryParser",                                        flags: "js" },
    { name: "SimpleQueryParser",                                  flags: "js" },
    { name: "SimpleJavaScriptParser",                             flags: "js" },
    { name: "QueryRouter",                                        flags: "js" },
    { name: "DateGrammar",                                        flags: "js" },
    { name: "DateParser",                                         flags: "js" },
    { name: "NumberGrammar",                                      flags: "js" },
    { name: "NumberParser",                                       flags: "js" },
    { name: "auto/SmartView",                                     flags: "web" },
    { name: "auto/ReferenceSuggester",                            flags: "web" },
    { name: "auto/EnumSuggester",                                 flags: "web" },
    { name: "FScriptParser",                                      flags: "js" },
    { name: "lint/GrammarLintFinding",                            flags: "js&test|grammarlint" },
    { name: "lint/GrammarLint",                                   flags: "js&test|grammarlint" },
    { name: "test/FScriptParserTestUser",                         flags: "js&test|java&test" },
    { name: "test/FScriptParserTest",                             flags: "js&test|java&test" },
    { name: "test/QueryParserJSTest",                             flags: "js&test|java&test" },
    { name: "test/QueryParserUserTest",                           flags: "js&test|java&test" },
    { name: "test/SimpleQueryParserTest",                         flags: "js&test|java&test" },
    { name: "test/DateParserTest",                                flags: "js&test|java&test" },
    { name: "test/NumberParserTest",                              flags: "js&test|java&test" },
    { name: "test/DateParserJavaTest",                            flags: "js&test|java&test" },
    { name: "test/SimpleQueryParserJavaTest",                     flags: "js&test|java&test" },
    { name: "test/SimpleQueryParserMQLTest",                      flags: "js&test|java&test" },
    { name: "test/GrammarCombinatorsTest",                        flags: "js&test|java&test" },
    { name: "test/GrammarCombinatorsJavaTest",                    flags: "js&test|java&test" },
    { name: "test/NestedQueryTestLeaf",                           flags: "js&test|java&test" },
    { name: "test/NestedQueryTestMid",                            flags: "js&test|java&test" },
    { name: "test/NestedQueryTestRoot",                           flags: "js&test|java&test" },
    { name: "lint/test/GrammarLintFixtures",                      flags: "js&test" },
    { name: "lint/test/GrammarLintTest",                          flags: "js&test|java&test" },
  ],

  javaFiles: [
    { name: "TestRegion",                                         flags: "test" },
    { name: "SinkParser" },
    { name: "NewlineParser" },
    { name: "FScriptParser" },
    { name: "TestUser",                                           flags: "test" },
    { name: "QueryParser" },
    { name: "SimpleQueryParser" },
    { name: "DateParser" },
  ],

  journalFiles: [
    { name: "test/tests",                                         flags: "test" },
  ]
});
