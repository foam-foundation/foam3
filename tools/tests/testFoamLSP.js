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

// Hard watchdog: fail fast if any single test infinite-loops. 90s comfortably
// covers pmake boot (~15s) + workspace-wide usage-index builds that the
// end-to-end usage tests now exercise. Anything beyond this is a real bug.
//
// IMPORTANT: guard with `require.main === module` so the timer only arms when
// this file is run as the test entrypoint. The LSP server's FileModelCache
// evaluates arbitrary .js files to capture foam.CLASS calls — an unguarded
// top-level setTimeout here would kill the LSP process after any user
// opens this test file in their editor.
if ( require.main === module ) {
  setTimeout(function() {
    console.error('\n\x1b[31m✘ WATCHDOG: tests exceeded 90s — possible infinite loop. Aborting.\x1b[0m');
    process.exit(2);
  }, 90000).unref();
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
require('./lsp/editorFeatures');
require('./lsp/typeHierarchy');
require('./lsp/usageIndex');
require('./lsp/callHierarchy');
require('./lsp/pomValidation');
require('./lsp/pomNavigation');

h.section('SUMMARY');
console.error(h.counters.passes + ' passed, ' + h.counters.failures + ' failed');
process.exit(h.counters.failures > 0 ? 1 : 0);
