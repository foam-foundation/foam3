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
    { name: "Parser",                                             flags: "js|java" },
    { name: "PStream",                                            flags: "js|java" },
    { name: "BlobPStream",                                        flags: "js|java" },
    { name: "SymbolParser",                                       flags: "js|java" },
    { name: "Grammar",                                            flags: "js|java" },
  ],

  javaFiles: [
    { name: "Join" },
    { name: "Until" },
    { name: "Until0" },
    { name: "UntilLiteral" },
    { name: "UntilLiteral0" },
    { name: "CSVParser" },
    { name: "TracingPStream" },
    { name: "Fail" },
    { name: "ErrorReportingPStream" },
    { name: "NotChar" },
    { name: "ParserContext" },
    { name: "Alt" },
    { name: "Optional" },
    { name: "Seq" },
    { name: "Repeat" },
    { name: "Repeat0" },
    { name: "Seq0" },
    { name: "GreedyAlt" },
    { name: "EOF" },
    { name: "Seq1" },
    { name: "ErrorReportingPStreamFactory" },
    { name: "AnyChar" },
    { name: "Reference" },
    { name: "NotChars" },
    { name: "SeqI" },
    { name: "Quoted" },
    { name: "Seq2" },
    { name: "InvalidPStream" },
    { name: "StringPStream" },
    { name: "Literal" },
    { name: "ErrorReportingNodePStream" },
    { name: "CharLiteral" },
    { name: "AbstractLiteral" },
    { name: "LiteralIC" },
    { name: "Range" },
    { name: "Not" },
    { name: "TrapPStream" },
    { name: "Chars" },
    { name: "ParserContextImpl" },
    { name: "Substring" },
  ]
});
