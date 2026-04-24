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

// Hard watchdog: fail fast if any single test infinite-loops. 30s is generous
// given the whole suite normally completes in ~2s after pmake boot.
//
// IMPORTANT: guard with `require.main === module` so the timer only arms when
// this file is run as the test entrypoint. The LSP server's FileModelCache
// evaluates arbitrary .js files to capture foam.CLASS calls — an unguarded
// top-level setTimeout here would kill the LSP process 30s after any user
// opens this test file in their editor.
if ( require.main === module ) {
  setTimeout(function() {
    console.error('\n\x1b[31m✘ WATCHDOG: tests exceeded 30s — possible infinite loop. Aborting.\x1b[0m');
    process.exit(2);
  }, 30000).unref();
}

var h = require('./lsp/_harness');

// Each require() runs its category's tests against the shared harness. Order
// is roughly "building blocks first" so a failure in the grammar surfaces
// before the downstream handlers that depend on it.
require('./lsp/foamIndex');
require('./lsp/grammar');
require('./lsp/utilities');
require('./lsp/completion');
require('./lsp/hover');
require('./lsp/diagnostics');
require('./lsp/navigation');
require('./lsp/java');
require('./lsp/jrl');

h.section('SUMMARY');
console.error(h.counters.passes + ' passed, ' + h.counters.failures + ' failed');
process.exit(h.counters.failures > 0 ? 1 : 0);
