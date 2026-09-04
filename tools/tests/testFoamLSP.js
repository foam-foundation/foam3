#!/usr/bin/env node

/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Entrypoint for the FOAM LSP test suite. The actual tests live under
// foam3/tools/tests/lsp/<category>.js — this file just boots the shared
// harness and loads each category in order so the aggregate run produces a
// single pass/fail tally.
//
// Usage: cd <your-project> && node foam3/tools/tests/testFoamLSP.js

// Hard watchdog: fail fast if any single test infinite-loops. 240s covers the
// ~80s of sync categories (pmake boot + workspace-wide usageIndex and
// navigation full-workspace scans) PLUS the awaited async i18n categories
// (mock HTTP servers, provider timeouts, TTL waits) that now run after them
// via the Promise.all extension. Anything beyond this is a real bug.
//
// IMPORTANT: guard with `require.main === module` so the timer only arms when
// this file is run as the test entrypoint. The LSP server's FileModelCache
// evaluates arbitrary .js files to capture foam.CLASS calls — an unguarded
// top-level setTimeout here would kill the LSP process after any user
// opens this test file in their editor.
if ( require.main === module ) {
  setTimeout(function() {
    console.error('\n\x1b[31m✘ WATCHDOG: tests exceeded 240s — possible infinite loop. Aborting.\x1b[0m');
    process.exit(2);
  }, 240000).unref();
}

// Category files, "building blocks first" so a grammar failure surfaces before
// the handlers that depend on it. usageIndex (~79s) and navigation (~47s) do
// full-workspace scans and dominate the run; pass a category list to skip them
// while iterating on one area:
//   node foam3/tools/tests/testFoamLSP.js                  # all
//   node foam3/tools/tests/testFoamLSP.js diagnostics      # just diagnostics
//   node foam3/tools/tests/testFoamLSP.js hover,completion # comma- or space-separated
var CATEGORIES = [
  'config',
  'foamIndex', 'grammar', 'utilities', 'completion', 'hover', 'diagnostics',
  'i18n', 'codelens', 'scaffold', 'pom',
  'navigation', 'java', 'jrl', 'editorFeatures', 'typeHierarchy', 'usageIndex',
  'callHierarchy', 'pomValidation', 'pomNavigation', 'mcp', 'dispatch', 'classify'
];

// Resolve the category list BEFORE booting the harness so an unknown name fails
// instantly instead of after the ~2s pmake boot.
var requested = process.argv.slice(2).join(',').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
var unknown   = requested.filter(function(c){ return CATEGORIES.indexOf(c) === -1; });
if ( unknown.length ) {
  console.error('Unknown categor' + (unknown.length > 1 ? 'ies' : 'y') + ': ' + unknown.join(', '));
  console.error('Available: ' + CATEGORIES.join(', '));
  process.exit(2);
}
var toRun = requested.length ? CATEGORIES.filter(function(c){ return requested.indexOf(c) !== -1; }) : CATEGORIES;

var h = require('./lsp/_harness');

// Each require() runs its category's tests against the shared harness.
// Categories are synchronous by default; a category that needs async work
// (e.g. mock-http-server tests) exports { done: <promise> } — collected
// below so SUMMARY can't print/exit before that work finishes. Sync
// categories export no `done` (module.exports defaults to {}), so they're
// filtered out and change nothing about how they run.
var pending = [];
toRun.forEach(function(c){
  // A category that throws while loading is one failed category, not a failed
  // run. Without the catch the throw unwinds this forEach, every later
  // category goes unloaded, the Promise.all below is never reached, and the
  // process ends on an empty event loop — exit 0, no SUMMARY, and a run that
  // covered half the suite looks the same as a green one.
  var mod;
  try {
    mod = require('./lsp/' + c);
  } catch ( e ) {
    h.test(false, 'category ' + c + ' threw while loading — ' +
      ( e && e.stack ? e.stack : e ));
    return;
  }
  if ( mod && mod.done && typeof mod.done.then === 'function' ) pending.push(mod.done);
});

function printSummaryAndExit() {
  h.section('SUMMARY');
  console.error(h.counters.passes + ' passed, ' + h.counters.failures + ' failed');
  process.exit(h.counters.failures > 0 ? 1 : 0);
}

// .catch guard: a category whose own async code forgets to catch its
// rejection (unlike i18n.js, which never lets `done` reject) must not take
// the whole run down silently — record it as a failure via the harness
// counter and still print SUMMARY / exit non-zero, same as any other FAIL.
Promise.all(pending).then(printSummaryAndExit, function(err) {
  h.test(false, 'an async test category rejected — ' +
    ( err && err.stack ? err.stack : err ));
  printSummaryAndExit();
});
