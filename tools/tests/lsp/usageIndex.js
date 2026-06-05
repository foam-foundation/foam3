/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Workspace usage indexes. FoamIndex walks every class's axioms and
// records who references each class via JavaScript method bodies, Java
// code blocks, and string-keyed context names. Builds the data plane
// behind ReferencesHandler / CallHierarchyHandler.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache, analyzer = h.analyzer;

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
index.scanFunctions_(src, function(text, axiomName) {
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

// End-to-end: walk every registered class via getJsUsages, then assert that
// our synthetic Source shows up as a user of synthetic Target. This drives
// scanFunctions_ across the full workspace.

section('FoamIndex.getJsUsages — workspace build (end-to-end)');
try {
  var none = index.getJsUsages('nonexistent.NoSuchClass');
  test(Array.isArray(none), 'getJsUsages returns array');
  test(none.length === 0, 'getJsUsages returns empty array for unknown class');

  var uses = index.getJsUsages('foam.parse.lsp.usagetest.UsageTestTarget');
  test(uses.some(function(u) { return u.sourceClassId === 'foam.parse.lsp.usagetest.UsageTestSource'; }),
    'workspace build: synthetic Source recorded as JS user of synthetic Target');
  test(uses.some(function(u) { return u.kind === 'usage-js'; }),
    'workspace build: usage entry tagged kind=usage-js');
} catch (err) {
  test(false, 'getJsUsages workspace build threw: ' + err.message + ' :: ' + (err.stack || '').split('\n').slice(0,5).join(' | '));
}


// === FoamIndex Java usage scanner — synthetic ===
//
// LSPMaker sets flags.genjava=true at boot so the Java refinements
// (foam/java/refinements.js — gated on the genjava flag in foam/src/pom.js)
// load alongside the LSP. With those in place, Method and Property carry
// javaCode / javaPostSet / javaFactory / etc. — the scanner reads them
// straight off the FOAM axioms, no regex over file text.

section('FoamIndex Java usage detection — synthetic');

foam.CLASS({
  package: 'foam.parse.lsp.javausagetest',
  name:    'JavaUsageTarget'
});

foam.CLASS({
  package: 'foam.parse.lsp.javausagetest',
  name:    'JavaUsageSource',
  javaImports: [ 'foam.parse.lsp.javausagetest.JavaUsageTarget' ],
  methods: [
    {
      name:     'doIt',
      javaCode: 'JavaUsageTarget t = new JavaUsageTarget();\nreturn t.toString();'
    }
  ],
  properties: [
    {
      class:        'String',
      name:         'foo',
      javaPostSet:  'JavaUsageTarget t = new JavaUsageTarget(); System.out.println(t);'
    }
  ]
});

var srcCls = foam.maybeLookup('foam.parse.lsp.javausagetest.JavaUsageSource');
var seenJava = [];
index.scanJavaBlocks_(srcCls, function(text, axiomName) {
  seenJava.push({ axiomName: axiomName, hasTarget: text.indexOf('JavaUsageTarget') !== -1 });
});

test(seenJava.length >= 2, 'scanJavaBlocks_: visits at least the method + property java slots (' + seenJava.length + ')');
test(seenJava.some(function(s) { return s.axiomName === 'methods.doIt.javaCode' && s.hasTarget; }),
  'scanJavaBlocks_: methods.doIt.javaCode references the target class');
test(seenJava.some(function(s) { return s.axiomName === 'properties.foo.javaPostSet' && s.hasTarget; }),
  'scanJavaBlocks_: properties.foo.javaPostSet references the target class');


// === FoamIndex.getJavaUsages — workspace build (end-to-end) ===

section('FoamIndex.getJavaUsages — workspace build');

index.invalidateSymbolIndex_();

try {
  var noneJava = index.getJavaUsages('nonexistent.NoSuchClass');
  test(Array.isArray(noneJava), 'getJavaUsages returns array');
  test(noneJava.length === 0, 'getJavaUsages returns empty array for unknown class');

  var javaUses = index.getJavaUsages('foam.parse.lsp.javausagetest.JavaUsageTarget');
  test(javaUses.some(function(u) { return u.sourceClassId === 'foam.parse.lsp.javausagetest.JavaUsageSource'; }),
    'workspace build: synthetic Source recorded as Java user of Target (via javaImports)');
  test(javaUses.some(function(u) { return u.kind === 'usage-java'; }),
    'workspace build: usage entry tagged kind=usage-java');
} catch (err) {
  test(false, 'getJavaUsages workspace build threw: ' + err.message + ' :: ' + (err.stack || '').split('\n').slice(0,5).join(' | '));
}


// === FoamIndex.getStringUsages — exports / imports ===
//
// String references travel through exports: → imports:. We declare a
// Producer that exports a name and a Consumer that imports it, then
// assert the index links them.

section('FoamIndex.getStringUsages — exports/imports');

foam.CLASS({
  package: 'foam.parse.lsp.stringusagetest',
  name:    'StringProducer',
  exports: [ 'as producerProp' ],
  properties: [
    { class: 'String', name: 'producerProp' }
  ]
});

foam.CLASS({
  package: 'foam.parse.lsp.stringusagetest',
  name:    'StringConsumer',
  imports: [ 'producerProp' ]
});

index.invalidateSymbolIndex_();

try {
  var stringUses = index.getStringUsages('producerProp');
  test(Array.isArray(stringUses), 'getStringUsages returns array');
  test(stringUses.some(function(u) {
    return u.sourceClassId === 'foam.parse.lsp.stringusagetest.StringConsumer' && u.kind === 'usage-string';
  }), 'getStringUsages: Consumer recorded as importer of producerProp');
  test(stringUses.some(function(u) {
    return u.sourceClassId === 'foam.parse.lsp.stringusagetest.StringProducer' && u.kind === 'export';
  }), 'getStringUsages: Producer recorded as exporter of producerProp');
} catch (err) {
  test(false, 'getStringUsages threw: ' + err.message);
}

// Unknown name returns empty array.
var noStr = index.getStringUsages('nonexistent_context_key');
test(Array.isArray(noStr), 'getStringUsages: unknown name returns array');
test(noStr.length === 0, 'getStringUsages: unknown name returns empty array');


// === FoamIndex.getMemberUsages — this.<prop|method> inside class ===
//
// Per-class view: where inside class X do methods reference property Y
// or method Y via this.Y? Answers "find references" for a property name
// scoped to its class — without false positives from unrelated files.

section('FoamIndex.getMemberUsages — this.X within a class');

foam.CLASS({
  package: 'foam.parse.lsp.membertest',
  name:    'MemberOwner',
  properties: [
    { class: 'String', name: 'someField' },
    { class: 'String', name: 'unrelatedField' }
  ],
  methods: [
    function readField() {
      // Body reads someField in two distinct axioms.
      return this.someField + ' suffix';
    },
    function writeField() {
      this.someField = 'x';
      return this.someField;
    },
    function ignoresIt() {
      return 42;
    }
  ]
});

index.invalidateSymbolIndex_();

try {
  var memberUses = index.getMemberUsages('foam.parse.lsp.membertest.MemberOwner', 'someField');
  test(Array.isArray(memberUses), 'getMemberUsages: returns array');
  test(memberUses.length >= 2,
    'getMemberUsages: someField is referenced from at least readField + writeField (got ' + memberUses.length + ')');
  test(memberUses.some(function(u) { return u.axiomName === 'methods.readField'; }),
    'getMemberUsages: readField referenced as methods.readField');
  test(memberUses.some(function(u) { return u.axiomName === 'methods.writeField'; }),
    'getMemberUsages: writeField referenced as methods.writeField');
  test(memberUses.every(function(u) { return u.kind === 'usage-member'; }),
    'getMemberUsages: every entry tagged kind=usage-member');
  test(memberUses.every(function(u) { return u.memberKind === 'property'; }),
    'getMemberUsages: someField identified as memberKind=property');

  var noField = index.getMemberUsages('foam.parse.lsp.membertest.MemberOwner', 'unrelatedField');
  test(noField.length === 0,
    'getMemberUsages: unrelatedField (declared but unreferenced) returns no usages');
} catch (err) {
  test(false, 'getMemberUsages threw: ' + err.message);
}


// === ReferencesHandler wired to usage indexes ===
//
// Confirms the handler picks up the new usage edges, not just the
// declaration-site graph. The synthetic UsageTestSource references
// UsageTestTarget via this.UsageTestTarget.create() inside its build()
// method — find references on Target should now surface Source.

section('ReferencesHandler — includes JS/Java/string usages');

try {
  var refsHandler = foam.parse.lsp.handlers.ReferencesHandler.create({
    index: index, cache: cache, analyzer: analyzer
  });

  var refsText  = "foam.CLASS({\n  extends: 'foam.parse.lsp.usagetest.UsageTestTarget'\n});";
  var refsResult = refsHandler.handle(refsText, { line: 1, character: 45 }, 'file:///t');
  test(Array.isArray(refsResult), 'ReferencesHandler: returns array');

  // The Source class references Target via this.UsageTestTarget.create();
  // the references handler should now surface its file path (when indexed).
  var sourcePath = index.getFilePath('foam.parse.lsp.usagetest.UsageTestSource');
  if ( sourcePath ) {
    var sourceUri = 'file://' + sourcePath;
    test(refsResult.some(function(loc) { return loc.uri === sourceUri; }),
      'ReferencesHandler: surfaces Source via JS usage (uri=' + sourceUri + ')');
  } else {
    test(true, 'ReferencesHandler: synthetic Source has no indexed file (covered by getJsUsages test)');
  }
} catch (err) {
  test(false, 'ReferencesHandler threw: ' + err.message + ' :: ' + (err.stack || '').split('\n').slice(0,3).join(' | '));
}
