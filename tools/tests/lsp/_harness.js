/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Shared harness for the split LSP test suite. Boots pmake exactly once (via
// node's module cache), wires up the common handlers, and exposes counters +
// test()/section() helpers for every category file to share.
//
// Individual category files under foam3/tools/tests/lsp/*.js require this
// module and read the counters / shared instances from it. The entrypoint
// testFoamLSP.js reads `counters` at the end to drive its exit code.

console.log = function() { console.error.apply(console, arguments); };
console.warn = function() { console.error.apply(console, arguments); };
globalThis.SILENT = false; globalThis.VERBOSE = false;
globalThis.DRY_RUN = false; globalThis.HELP = false; globalThis.NOP = '';

process.on('unhandledRejection', function(e) {});
process.on('uncaughtException', function(e) {
  if ( e.message && ( e.message.includes('document') || e.message.includes('window') ) ) return;
  if ( e instanceof SyntaxError ) return;
});

var path = require('path');
var fs = require('fs');
var pmake = require(path.resolve(__dirname, '../../pmake'));
var buildlib = require(path.resolve(__dirname, '../../buildlib'));
buildlib.error = function() { /* suppress fatal errors during boot */ };

var pomPath = path.resolve(process.cwd(), 'pom');
pmake.bind(buildlib, '-makers=LSP -pom=' + pomPath)();

// Test counters + helpers
var counters = { passes: 0, failures: 0 };

function test(condition, message) {
  if ( condition ) {
    counters.passes++;
    console.error('  \x1b[32m✓\x1b[0m ' + message);
  } else {
    counters.failures++;
    console.error('  \x1b[31m✘ FAIL:\x1b[0m ' + message);
  }
}

function section(name) {
  console.error('\n\x1b[1m=== ' + name + ' ===\x1b[0m');
}

// Shared sample files used by several categories (grammar parse, real-file
// coverage, workspace analyzer).
var TEST_FILES = [
  'foam3/src/foam/lang/types.js',
  'foam3/src/foam/parse/parse.js',
  'foam3/src/foam/core/controller/ApplicationController.js',
  'foam3/src/foam/lang/Enum.js',
  'foam3/src/foam/parse/SimpleQueryParser.js'
];

// Shared FOAM LSP instances. The original monolithic testFoamLSP.js relied
// on vars like `cache`, `typeTracker`, `analyzer`, `defHandler` being
// declared in one section and referenced by tests 1000+ lines later. After
// the category split those tests live in different modules, so every
// shared instance must be instantiated once here and pulled from each
// category file.
var index             = foam.parse.lsp.FoamIndex.create();
var grammar           = foam.parse.lsp.FoamClassGrammar.create({ index: index });
var cache             = foam.parse.lsp.FileModelCache.create();
var typeTracker       = foam.parse.lsp.TypeTracker.create({ cache: cache });
var analyzer          = foam.parse.lsp.CursorAnalyzer.create();
var completionHandler = foam.parse.lsp.handlers.CompletionHandler.create({ index: index, grammar: grammar });
var memberHandler     = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index });
var cssTokenResolver  = foam.parse.lsp.CSSTokenResolver.create();
cssTokenResolver.loadFromRegistry();
var hoverHandler      = foam.parse.lsp.handlers.HoverHandler.create({ index: index, cssTokenResolver: cssTokenResolver });
var diagHandler       = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index });
var defHandler        = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index });
var semanticHandler   = foam.parse.lsp.handlers.SemanticTokenHandler.create({ index: index, cache: cache, typeTracker: typeTracker });

module.exports = {
  counters:          counters,
  test:              test,
  section:           section,
  path:              path,
  fs:                fs,
  Q:                 String.fromCharCode(39),
  TEST_FILES:        TEST_FILES,
  index:             index,
  grammar:           grammar,
  cache:             cache,
  typeTracker:       typeTracker,
  analyzer:          analyzer,
  completionHandler: completionHandler,
  memberHandler:     memberHandler,
  cssTokenResolver:  cssTokenResolver,
  hoverHandler:      hoverHandler,
  diagHandler:       diagHandler,
  defHandler:        defHandler,
  semanticHandler:   semanticHandler,

  // Class id constants referenced across multiple category files.
  SFV:               'foam.u2.filter.properties.StringFilterView'
};
