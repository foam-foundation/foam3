/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Checks every foam.parse grammar in a project for mistakes the parser only
// shows at run time. See foam.parse.lint.GrammarLint for the checks and what
// they do not cover, or "Checking a Grammar" in doc/guides/foam_parsers_doc.md.
//
// Usage, from the project root:  node foam3/tools/lintGrammars.js [pom-path]
// (from foam3 itself:            node tools/lintGrammars.js)
//
// Output: one line per finding, "file: class: rule: severity check: message",
// then a summary. Exit code 1 when any error was found.

// Web-only code can reference document or window while loading under node;
// that is not a grammar problem, so it does not stop the run.
process.on('unhandledRejection', function() {});
process.on('uncaughtException', function(e) {
  if ( e && e.message && ( e.message.includes('document') || e.message.includes('window') ) ) return;
  throw e;
});

// Loading every model logs warnings that are not about grammars; the report
// is written by GrammarLintMaker straight to stdout.
console.log = console.warn = console.error = console.info = function() {};

// Globals buildlib expects (normally set by build.js).
globalThis.SILENT  = true;
globalThis.VERBOSE = false;
globalThis.DRY_RUN = false;
globalThis.HELP    = false;
globalThis.NOP     = '';

var path_    = require('path');
var pmake    = require('./pmake');
var buildlib = require('./buildlib');

var pomPath = process.argv[2] || path_.join(process.cwd(), 'pom');

pmake.bind(buildlib, '-makers=GrammarLint -pom=' + pomPath)();
