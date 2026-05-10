/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Phase 4a: JS usage index. FoamIndex now walks every class's function-
// bearing axioms (methods, actions, listeners, property functions,
// init/initE, templates) and resolves `this.<ShortName>` patterns through
// the source class's requires axiom. The usage map answers
// "where in JavaScript is class X used?" beyond the requires-list itself.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index;

index.buildFileIndex();


// === Synthetic usage detection ===
//
// Building the workspace-wide usage index walks every class's function
// bodies (~thousands of fn.toString() calls). To stay within the 30s
// test watchdog, we use a small synthetic scanner that exercises the
// extraction logic without forcing a full registry walk.

section('FoamIndex JS usage detection — synthetic');

// Register synthetic Target + Source classes.
foam.CLASS({
  package: 'foam.parse.lsp.usagetest',
  name:    'UsageTestTarget'
});
foam.CLASS({
  package: 'foam.parse.lsp.usagetest',
  name:    'UsageTestSource',
  requires: [ 'foam.parse.lsp.usagetest.UsageTestTarget' ],
  methods: [
    function build() {
      return this.UsageTestTarget.create();
    }
  ]
});

// Exercise scanFunctions_ directly on the synthetic Source model — checks
// that we visit the methods array and emit the function body.
var src    = foam.maybeLookup('foam.parse.lsp.usagetest.UsageTestSource');
var seen   = [];
index.scanFunctions_(src.model_, function(text, axiomName) {
  seen.push({ axiomName: axiomName, hasTarget: text.indexOf('this.UsageTestTarget') !== -1 });
});
test(seen.length > 0, 'scanFunctions_: visits at least one function axiom on the synthetic source');
test(seen.some(function(s) { return s.axiomName.indexOf('methods.build') === 0; }),
  'scanFunctions_: emits the methods.build axiom name');
test(seen.some(function(s) { return s.hasTarget; }),
  'scanFunctions_: function body contains the this.UsageTestTarget reference');

// invalidateSymbolIndex_ is the public entry point that drops both the
// symbol cache and the usage cache. Just verify it doesn't crash.
index.invalidateSymbolIndex_();
test(true, 'invalidateSymbolIndex_ executes without throwing');

// NOTE: a workspace-wide getJsUsages call triggers buildUsageIndex_ which
// walks every registered class's function bodies via fn.toString(). On the
// full ptv3 workspace that's expensive enough to risk the 30s test
// watchdog — leave the workspace-build test to the integration runner
// (./build.sh client-tests:LSPIntegrationTest) and rely here on the
// scanFunctions_ unit assertions above.
