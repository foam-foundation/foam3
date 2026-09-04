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

// Test counters. Declared above the uncaughtException handler because that
// handler records into them.
var counters = { passes: 0, failures: 0 };

process.on('unhandledRejection', function(e) {});
process.on('uncaughtException', function(e) {
  // FileModelCache evaluates arbitrary workspace .js files to capture their
  // foam.CLASS calls, so browser-global and syntax errors from that eval are
  // expected noise and stay swallowed.
  if ( e.message && ( e.message.includes('document') || e.message.includes('window') ) ) return;
  if ( e instanceof SyntaxError ) return;
  // Anything else is a real defect. Installing a listener at all suppresses
  // node's default crash, so without this an escaping error left no trace:
  // the run carried on with whatever work was already scheduled and could
  // still finish 0.
  counters.failures++;
  console.error('  \x1b[31m✘ FAIL:\x1b[0m uncaught exception — ' +
    ( e && e.stack ? e.stack : e ));
});

var path = require('path');
var fs = require('fs');
var pmake = require(path.resolve(__dirname, '../../pmake'));
var buildlib = require(path.resolve(__dirname, '../../buildlib'));
buildlib.error = function() { /* suppress fatal errors during boot */ };

var pomPath = path.resolve(process.cwd(), 'pom');
pmake.bind(buildlib, '-makers=LSP -pom=' + pomPath)();

// The LSP maker's end() hook (LSPMaker.js) calls server.js's start() as a
// side effect of loading the LSP source files for class registration —
// start() wires process.stdin.on('end', ...) -> process.exit(0), correct
// for a real LSP process (exit when the client's pipe closes) but fatal
// here: this harness's stdin is never an attached client, so it hits EOF
// on the very first event-loop turn once anything yields to it (an
// `await`), and process.exit(0) fires before the awaited work — e.g. a
// fetch in the i18n category's mock-server tests — gets a chance to
// finish. Every purely-synchronous category finishes (and calls its own
// process.exit via testFoamLSP.js) before the loop ever turns, so this
// went unnoticed until an async category existed. Strip the listeners
// server.js installed so this process's stdin is inert.
process.stdin.removeAllListeners('data');
process.stdin.removeAllListeners('end');
process.stdin.pause();

// Test helpers. `counters` is declared at the top of the file, above the
// uncaughtException handler that writes to it.
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

// Serializes the "server lane" test blocks — the ones that boot server.js
// in-process and talk to it over real JSON-RPC framing. Such a block owns two
// process-wide singletons for its duration: the process.stdin 'data' listener
// (which is how messages reach the server) and the process.stdout.write patch
// (which is how replies are captured). Two lanes running concurrently would
// cross-talk — each server would see the OTHER lane's messages — and their
// finally-blocks would restore each other's stdout patch instead of the real
// write. Categories run their lane through here so only one is ever live.
var laneQueue_ = Promise.resolve();

function withServerLane(fn) {
  var run = laneQueue_.then(function() { return fn(); });
  // Chain on a settled-either-way copy: one lane's failure must not skip the
  // lanes queued behind it.
  laneQueue_ = run.then(function() {}, function() {});
  return run;
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
var i18nHandler       = foam.parse.lsp.handlers.I18nHandler.create({ index: index, cache: cache });
var defHandler        = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index });
var semanticHandler   = foam.parse.lsp.handlers.SemanticTokenHandler.create({ index: index, cache: cache, typeTracker: typeTracker });

module.exports = {
  counters:          counters,
  test:              test,
  section:           section,
  withServerLane:    withServerLane,
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
  i18nHandler:       i18nHandler,
  defHandler:        defHandler,
  semanticHandler:   semanticHandler,

  // Class id constants referenced across multiple category files.
  SFV:               'foam.u2.filter.properties.StringFilterView'
};
