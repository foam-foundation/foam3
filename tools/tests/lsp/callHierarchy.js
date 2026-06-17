/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// textDocument/prepareCallHierarchy + callHierarchy/{incoming,outgoing}Calls.
// Backed by FoamIndex.getMemberUsages and a reverse pass over the cursor
// method's own this.X(...) calls.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache;

index.buildFileIndex();

var ch = foam.parse.lsp.handlers.CallHierarchyHandler.create({ index: index, cache: cache });


// Synthetic class: methodA calls methodB; methodC calls methodB.
foam.CLASS({
  package: 'foam.parse.lsp.callhtest',
  name:    'CallHierarchyFixture',
  methods: [
    function methodA() { return this.methodB(); },
    function methodB() { return 1; },
    function methodC() { return this.methodB() + 1; },
    function isolated() { return 0; }
  ]
});

// Force rebuild of caches that depend on the new class.
index.invalidateSymbolIndex_();


// === prepare ===

section('CallHierarchyHandler.prepare');

// Build text whose cursor lands on methodB inside the methods array.
var prepText = "foam.CLASS({\n  package: 'foam.parse.lsp.callhtest',\n  name: 'CallHierarchyFixture',\n  methods: [\n    function methodB() { return 1; }\n  ]\n});";
// Cursor lands somewhere inside the methodB identifier on line 4.
var preps = ch.prepare(prepText, { line: 4, character: 16 }, 'file:///synthetic');
test(Array.isArray(preps), 'prepare returns an array');
test(preps.length === 1 && preps[0].data.classId === 'foam.parse.lsp.callhtest.CallHierarchyFixture',
  'prepare resolves the cursor method to the synthetic class');
test(preps.length === 1 && preps[0].data.memberName === 'methodB',
  'prepare records the method name');

// Negative: cursor on a non-method identifier returns null.
var nonPrep = ch.prepare("var x = 1;", { line: 0, character: 4 }, '');
test(nonPrep === null, 'prepare returns null when the cursor is not on a method');


// === incomingCalls ===

section('CallHierarchyHandler.incomingCalls');

var item = {
  data: {
    classId:    'foam.parse.lsp.callhtest.CallHierarchyFixture',
    memberName: 'methodB'
  }
};
var incoming = ch.incomingCalls(item);
test(Array.isArray(incoming), 'incomingCalls returns array');
test(incoming.some(function(c) { return c.from.name === 'methodA'; }),
  'incomingCalls: methodA is recorded as caller of methodB');
test(incoming.some(function(c) { return c.from.name === 'methodC'; }),
  'incomingCalls: methodC is recorded as caller of methodB');
test(! incoming.some(function(c) { return c.from.name === 'isolated'; }),
  'incomingCalls: isolated() is NOT recorded as caller of methodB');


// === outgoingCalls ===

section('CallHierarchyHandler.outgoingCalls');

var methodAItem = {
  data: {
    classId:    'foam.parse.lsp.callhtest.CallHierarchyFixture',
    memberName: 'methodA'
  }
};
var outgoing = ch.outgoingCalls(methodAItem);
test(Array.isArray(outgoing), 'outgoingCalls returns array');
test(outgoing.some(function(c) { return c.to.name === 'methodB'; }),
  'outgoingCalls: methodA calls methodB');
test(! outgoing.some(function(c) { return c.to.name === 'methodA'; }),
  'outgoingCalls: self-recursion excluded');


// === Real method positions (itemFor_ via grammar position map) ===

section('CallHierarchy — real method positions');
var realCls = index.getClass('foam.core.controller.ApplicationController');
if ( realCls && index.getFilePath('foam.core.controller.ApplicationController') ) {
  var realMethods = realCls.getOwnAxiomsByClass(foam.lang.Method);
  var named = realMethods.filter(function(m) { return typeof m.name === 'string' && m.name; });
  if ( named.length ) {
    var mItem = ch.itemFor_('foam.core.controller.ApplicationController', named[0].name);
    test(mItem.range.start.line > 0,
      'itemFor_: real method ' + named[0].name + ' has a non-zero line (@' + mItem.range.start.line + ')');
  } else {
    test(true, 'method position test skipped (no named own methods)');
  }
} else {
  test(true, 'method position test skipped (ApplicationController not in file index)');
}
