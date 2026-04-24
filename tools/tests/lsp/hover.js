/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// Split from testFoamLSP.js — hover tests.
// Shared harness (test/section + boot-time handlers) is required once
// by the entrypoint; this module reads its own copy.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, grammar = h.grammar;
var cache = h.cache, typeTracker = h.typeTracker, analyzer = h.analyzer;
var completionHandler = h.completionHandler, memberHandler = h.memberHandler;
var hoverHandler = h.hoverHandler, diagHandler = h.diagHandler;
var defHandler = h.defHandler, semanticHandler = h.semanticHandler;
var cssTokenResolver = h.cssTokenResolver;
var path = h.path, fs = h.fs, Q = h.Q;
var TEST_FILES = h.TEST_FILES;
var passes = h.counters.passes, failures = h.counters.failures;  // legacy references; counters live on h.counters
var SFV = h.SFV;


section('HoverHandler — class hover');
var hoverHandler = foam.parse.lsp.handlers.HoverHandler.create({ index: index, cssTokenResolver: cssTokenResolver });

var hoverText = "foam.CLASS({\n  requires: ['foam.parse.Suggestion']\n})";
var hoverResult = hoverHandler.handle(hoverText, { line: 1, character: 20 });
test(hoverResult != null, 'Hover returns result for class name');
test(hoverResult && hoverResult.contents.value.indexOf('foam.parse.Suggestion') !== -1, 'Hover contains class name');

// Hover on property type
var propTypeHover = hoverHandler.handle("foam.CLASS({\n  properties: [\n    { class: 'FObjectProperty' }\n  ]\n})", { line: 2, character: 18 });
test(propTypeHover != null, 'Hover returns result for property type');

// Hover on short name from requires (e.g., 'Suggestion' resolves to foam.parse.Suggestion)
var requiresHoverText = 'foam.CLASS({\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  methods: [\n    function go() {\n      this.Suggestion.create();\n    }\n  ]\n})';
var shortNameHover = hoverHandler.handle(requiresHoverText, { line: 6, character: 12 });
test(shortNameHover != null, 'Hover on required short name resolves');
test(shortNameHover && shortNameHover.contents.value.indexOf('foam.parse.Suggestion') !== -1, 'Short name hover shows full class info');

// Hover on 'create' shows class properties
var createHover = hoverHandler.handle(requiresHoverText, { line: 6, character: 22 });
test(createHover != null, 'Hover on create shows class info');
test(createHover && createHover.contents.value.indexOf('create') !== -1, 'Create hover mentions create');

// Hover on method name in synthetic text (avoids file line number issues)
var methodHoverText2 = 'foam.CLASS({\n  package: ' + Q + 'foam.parse' + Q + ',\n  name: ' + Q + 'Suggestion' + Q + ',\n  methods: [\n    function matches() {}\n  ]\n})';
var methodHover2 = hoverHandler.handle(methodHoverText2, { line: 4, character: 15 });
test(methodHover2 != null, 'Hover on method name shows info');

// === DIAGNOSTICS TESTS ===



// ========== Hover UI Format ==========
section('Hover UI Format');

// Class hover should use code block
var classHover = hoverHandler.handle(requiresHoverText, { line: 2, character: 20 });
test(classHover != null && classHover.contents.value.indexOf('```foam') !== -1, 'Hover UI: class hover uses code block');
test(classHover != null && classHover.contents.value.indexOf('| Property') !== -1, 'Hover UI: class hover has property table');

// Method hover format check — buildMethodHover_ should use JS code block
var fakeMethod = { name: 'testMethod', args: ['x', 'y'], documentation: 'A test method.' };
var methodMd = hoverHandler.buildMethodHover_(fakeMethod, 'foam.test.FakeClass');
test(methodMd.indexOf('```javascript') !== -1, 'Hover UI: method hover uses JS code block');
test(methodMd.indexOf('foam.test.FakeClass') !== -1, 'Hover UI: method hover shows class name');

// Create hover should use code block with .create()
var createHover = hoverHandler.handle(requiresHoverText, { line: 6, character: 22 });
test(createHover != null && createHover.contents.value.indexOf('.create()') !== -1, 'Hover UI: create hover shows .create()');

// ========== this.RequiredClass.create() Completion ==========


// ========== Documentation Formatting in Hover ==========
section('Hover Doc Formatting');

var multiParagraphDoc = '\n    First paragraph line.\n    Continues here.\n\n    Entry points:\n      - one\n      - two\n\n    Final paragraph.\n  ';
var formatted = hoverHandler.formatDocumentation_(multiParagraphDoc);
test(formatted.indexOf('First paragraph line.') === 0, 'Doc format: dedents leading indent');
test(formatted.indexOf('\n\nEntry points:') !== -1, 'Doc format: preserves paragraph breaks');
test(formatted.indexOf('  - one  ') !== -1 || formatted.indexOf('- one  ') !== -1, 'Doc format: indented list items get hard break');
test(formatted.indexOf('Final paragraph.') !== -1, 'Doc format: keeps last paragraph');

// Class hover should wrap docs in blockquote
var docHoverClassId = 'foam.parse.lsp.JavaGrammar';
if ( index.classExists(docHoverClassId) ) {
  var docClassHover = hoverHandler.buildClassHover(docHoverClassId);
  test(docClassHover != null, 'Doc hover: class hover returned');
  test(docClassHover && docClassHover.contents.value.indexOf('> ') !== -1, 'Doc hover: documentation rendered as quoted block');
  test(docClassHover && docClassHover.contents.value.indexOf('> ') !== -1, 'Doc hover: blockquote for docs');
}

// ========== Class Signature Multi-line Format ==========


// ========== Class Signature Multi-line Format ==========
section('Hover Signature Format');

// Inline test class with multiple implements
foam.INTERFACE({ package: 'foam.parse.lsp.test', name: 'IFoo' });
foam.INTERFACE({ package: 'foam.parse.lsp.test', name: 'IBar' });
foam.INTERFACE({ package: 'foam.parse.lsp.test', name: 'IBaz' });
foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'MultiImplTest',
  implements: ['foam.parse.lsp.test.IFoo', 'foam.parse.lsp.test.IBar', 'foam.parse.lsp.test.IBaz']
});

var multiImplHover = hoverHandler.buildClassHover('foam.parse.lsp.test.MultiImplTest');
test(multiImplHover != null, 'Sig format: hover returned');
test(multiImplHover && multiImplHover.contents.value.indexOf('implements foam.parse.lsp.test.IFoo, foam.parse.lsp.test.IBar') !== -1,
  'Sig format: multiple implements on same line, comma-separated');

// Single implement stays on one line
foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'SingleImplTest',
  implements: ['foam.parse.lsp.test.IFoo']
});
var singleImplHover = hoverHandler.buildClassHover('foam.parse.lsp.test.SingleImplTest');
test(singleImplHover && singleImplHover.contents.value.indexOf('implements foam.parse.lsp.test.IFoo') !== -1, 'Sig format: single implement inline');

// === JRL LOADER ===



// === HOVER ON ^selector IN CSS BLOCK ===
section('Hover — CSS ^selector vs same-named property');

var selSrc = [
  "foam.CLASS({",
  "  package: 'test',",
  "  name: 'SelTest',",
  "  properties: [ { class: 'Boolean', name: 'centered' } ],",
  "  css: `",
  "    ^centered > * { align-self: center; }",
  "  `",
  "})"
].join('\n');
// Line 5: `    ^centered > * { align-self: center; }`, cursor on `centered`
var selHover = hoverHandler.handle(selSrc, { line: 5, character: 8 });
test(selHover != null, 'CSS ^centered: hover returned');
test(selHover && selHover.contents.value.indexOf('Expands to') !== -1,
  'CSS ^centered: hover explains selector expansion');
test(selHover && selHover.contents.value.indexOf('Boolean') === -1,
  'CSS ^centered: hover does NOT confuse it with the Boolean property');
test(selHover && selHover.contents.value.indexOf('Not a reference') !== -1,
  'CSS ^centered: hover clarifies it is not a property reference');

// === DOCUMENT HIGHLIGHT ===


// === MESSAGE AXIOM: hover + go-to-definition ===
section('Message axiom hover + go-to-definition');

if ( index.classExists(SFV) ) {
  var sfvFs2 = require('fs');
  var sfvFile = 'foam3/src/foam/u2/filter/properties/StringFilterView.js';
  var sfvTxt  = sfvFs2.readFileSync(sfvFile, 'utf8');

  // FoamIndex layer
  var allMsgs = index.getMessages(SFV);
  test(allMsgs.length >= 7,
    'getMessages returns StringFilterView messages (' + allMsgs.length + ')');
  var lm = index.findMessage(SFV, 'LABEL_PLACEHOLDER');
  test(lm && lm.message === 'Search', 'findMessage returns LABEL_PLACEHOLDER with its text');
  test(index.findMessage(SFV, 'NOT_A_MESSAGE') === null,
    'findMessage returns null for unknown names');

  // Hover — cursor on `this.LABEL_PLACEHOLDER` inside render()
  var hIdx = sfvTxt.indexOf('this.LABEL_PLACEHOLDER');
  var hLine = 0, hCol = 0;
  for ( var i = 0 ; i < hIdx ; i++ ) {
    if ( sfvTxt.charCodeAt(i) === 10 ) { hLine++; hCol = 0; } else hCol++;
  }
  // land cursor inside LABEL_PLACEHOLDER (pos = after `this.`)
  var msgHover = hoverHandler.handle(sfvTxt,
    { line: hLine, character: hCol + 'this.'.length + 5 }, 'file://' + sfvFile);
  var mv = msgHover && msgHover.contents && msgHover.contents.value || '';
  test(mv.indexOf('LABEL_PLACEHOLDER') !== -1,
    'Message hover: includes the message name');
  test(mv.indexOf('Search') !== -1,
    'Message hover: includes the message text');

  // Definition — same cursor jumps to the `{ name: 'LABEL_PLACEHOLDER', … }` entry
  var defHandler = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index });
  var msgDef = defHandler.handle(sfvTxt,
    { line: hLine, character: hCol + 'this.'.length + 5 }, 'file://' + sfvFile);
  test(msgDef && msgDef.uri && msgDef.uri.indexOf('StringFilterView.js') !== -1,
    'Message go-to-def: lands in StringFilterView.js');
  test(msgDef && msgDef.range && typeof msgDef.range.start.line === 'number',
    'Message go-to-def: has a valid range');
}

// === GRAMMAR-DRIVEN AXIOM POSITIONS ===

