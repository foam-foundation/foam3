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

// ========== Property types carry their of: target ==========
section('Hover Property Of');

foam.ENUM({
  package: 'foam.parse.lsp.test',
  name: 'OfEnum',
  values: [ { name: 'ONE' }, { name: 'TWO' } ]
});
foam.CLASS({ package: 'foam.parse.lsp.test', name: 'OfTarget' });
foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'OfCarrier',
  properties: [
    { class: 'Enum', of: 'foam.parse.lsp.test.OfEnum', name: 'mood' },
    { class: 'FObjectProperty', of: 'foam.parse.lsp.test.OfTarget', name: 'target' },
    { class: 'StringArray', name: 'tags' },
    { class: 'String', name: 'label' }
  ]
});

var ofHover = hoverHandler.buildClassHover('foam.parse.lsp.test.OfCarrier');
var ofMd = ofHover ? ofHover.contents.value : '';

test(ofMd.indexOf('Enum<OfEnum>') !== -1,
  'Hover: an Enum property names the enum it is of, not just "Enum"');
test(ofMd.indexOf('FObjectProperty<OfTarget>') !== -1,
  'Hover: an FObjectProperty names the class it holds');
test(ofMd.indexOf('StringArray<String>') === -1 && ofMd.indexOf('`StringArray`') !== -1,
  'Hover: StringArray drops its redundant of: String');
test(ofMd.indexOf('`String`') !== -1,
  'Hover: a property with no of: still prints its bare type');

// The case the bench asks about: buttonStyle is declared in a refinement in
// ActionView.js as `class: 'Enum', of: 'foam.u2.ButtonStyle'`.
if ( index.classExists('foam.lang.Action') ) {
  var actionHover = hoverHandler.buildClassHover('foam.lang.Action');
  var actionMd = actionHover ? actionHover.contents.value : '';
  test(actionMd.indexOf('Enum<ButtonStyle>') !== -1,
    'Hover: Action.buttonStyle reads Enum<ButtonStyle>, the refinement\'s of:');
}

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

// === Axiom-key hover from AxiomCatalog ===
// Single source of truth: HoverHandler reads from AxiomCatalog, the
// same place FoamClassGrammar pulls suggestion hints from. So hovering
// an axiom key (`requires:`, `sections:`, `messages:`, `searchColumns:`,
// `properties:`, etc.) shows the same text the completion popup would.
section('HoverHandler — axiom-key hover from AxiomCatalog');

var axiomSrc =
  "foam.CLASS({\n" +
  "  package: 'test',\n" +
  "  name: 'A',\n" +
  "  extends: 'foam.lang.FObject',\n" +
  "  requires: [],\n" +
  "  imports: [],\n" +
  "  properties: [],\n" +
  "  methods: [],\n" +
  "  actions: [],\n" +
  "  listeners: [],\n" +
  "  messages: [],\n" +
  "  sections: [],\n" +
  "  tableColumns: [],\n" +
  "  searchColumns: [],\n" +
  "  javaImports: [],\n" +
  "  documentation: 'doc'\n" +
  "});";

[
  'package', 'name', 'extends', 'requires', 'imports', 'properties',
  'methods', 'actions', 'listeners', 'messages', 'sections',
  'tableColumns', 'searchColumns', 'javaImports', 'documentation'
].forEach(function(slot) {
  var aLines = axiomSrc.split('\n');
  var ln = -1, cl = -1;
  for ( var i = 0 ; i < aLines.length ; i++ ) {
    var idx = aLines[i].indexOf(slot + ':');
    if ( idx !== -1 ) { ln = i; cl = idx; break; }
  }
  if ( ln === -1 ) {
    test(false, 'fixture missing slot ' + slot);
    return;
  }
  // Cursor in the middle of the axiom key
  var h = hoverHandler.handle(axiomSrc, { line: ln, character: cl + 2 });
  test(h && h.contents && typeof h.contents.value === 'string' && h.contents.value.indexOf(slot) !== -1,
    'Hover on `' + slot + ':` returns axiom description');
});

// Negative case: cursor on a value (not a key) should not show axiom hover
var noKeySrc = "foam.CLASS({ package: 'x', name: 'Y' });";
var nameValueHover = hoverHandler.handle(noKeySrc, { line: 0, character: noKeySrc.indexOf("'Y'") + 2 });
// This should not be the axiom-key hover ("**name** — Class name (CamelCase)")
var noKeyOk = ! nameValueHover || ! (nameValueHover.contents && nameValueHover.contents.value && nameValueHover.contents.value.indexOf('Class name (CamelCase)') !== -1);
test(noKeyOk, 'Cursor on a string value does NOT trigger axiom-key hover');

// === Scope-aware axiom hover ===
// The same key (e.g. `javaCode`, `name`) appears at multiple scopes:
// top-level, per-property, per-method, per-action, etc. The hover
// must use the scope that matches the cursor's container, not the
// first scope alphabetically. Otherwise hovering `javaCode:` inside a
// methods: [{ }] block would wrongly say "Class-level Java code".
section('HoverHandler — scope-aware axiom hover');

var BTQ = String.fromCharCode(96);
var scopeCases = [
  // [label, src, line, col, expected substring in hover]
  ['javaCode @ top-level',
   "foam.CLASS({\n  javaCode: " + BTQ + "static {}" + BTQ + "\n});",
   1, 4, 'Class-level'],
  ['javaCode @ method',
   "foam.CLASS({\n  methods: [\n    {\n      javaCode: " + BTQ + "x" + BTQ + "\n    }\n  ]\n});",
   3, 8, 'Java implementation body'],
  ['javaCode @ property',
   "foam.CLASS({\n  properties: [\n    { javaCode: " + BTQ + "x" + BTQ + " }\n  ]\n});",
   2, 8, 'Java statement'],
  ['name @ section',
   "foam.CLASS({\n  sections: [\n    { name: 's' }\n  ]\n});",
   2, 8, 'Section identifier'],
  ['label @ action',
   "foam.CLASS({\n  actions: [\n    { label: 'L' }\n  ]\n});",
   2, 8, 'action button'],
  ['name @ message',
   "foam.CLASS({\n  messages: [\n    { name: 'M' }\n  ]\n});",
   2, 8, 'Message identifier'],
  ['name @ enum value',
   "foam.ENUM({\n  values: [\n    { name: 'V' }\n  ]\n});",
   2, 8, 'Enum value identifier'],
  ['code @ listener',
   "foam.CLASS({\n  listeners: [\n    { code: function() {} }\n  ]\n});",
   2, 8, 'listener body']
];

scopeCases.forEach(function(c) {
  var label = c[0], src = c[1], ln = c[2], col = c[3], needle = c[4];
  var h = hoverHandler.handle(src, { line: ln, character: col });
  var got = h && h.contents && h.contents.value || '';
  test(got.indexOf(needle) !== -1,
    label + ' hover mentions "' + needle + '" (got: ' + got.slice(0, 90) + ')');
});

section('Hover — relationships section (#5091)');
if ( index.classExists('foam.core.demo.relationship.Professor') ) {
  var relSrc = "foam.CLASS({\n  requires: ['foam.core.demo.relationship.Professor']\n})";
  // char 40 lands inside the class id string on line 1
  var relHover = hoverHandler.handle(relSrc, { line: 1, character: 40 });
  var relText = ( relHover && relHover.contents && relHover.contents.value ) || '';
  test(relText.indexOf('Relationship') !== -1, 'Professor hover shows a Relationships section');
  test(relText.indexOf('courses') !== -1, 'Professor hover lists the forward relationship courses');
} else {
  test(true, 'demo relationship classes not loaded — relationship hover fixture skipped');
}

section('Hover — suppressed in comments + documentation (F1)');
var docText = "foam.CLASS({\n  documentation: 'see FObject for details'\n})";
// line 1: "  documentation: 'see FObject..." — 'FObject' begins at char 22
var docHover = hoverHandler.handle(docText, { line: 1, character: 24 });
test(docHover == null, 'no hover inside a documentation value');
// the documentation KEY itself still hovers (char 5 is inside 'documentation')
var keyHover = hoverHandler.handle(docText, { line: 1, character: 5 });
test(keyHover != null, 'documentation key still hovers');
var cmtText = "foam.CLASS({\n  methods: [\n    function f() {\n" +
  "      // uses FObject here\n      return 1;\n    }\n  ]\n})";
// line 3: "      // uses FObject here" — 'FObject' begins at char 14
var cmtHover = hoverHandler.handle(cmtText, { line: 3, character: 16 });
test(cmtHover == null, 'no hover inside a line comment');

// === GRAMMAR-DRIVEN AXIOM POSITIONS ===


section('Hover — class own name value shows class info');
var ownNameText = "foam.CLASS({\n  package: 'foam.parse',\n  name: 'Suggestion'\n})";
// line 2: "  name: 'Suggestion'" — 'Suggestion' value begins at char 9
var ownHover = hoverHandler.handle(ownNameText, { line: 2, character: 12 });
test(ownHover != null, 'hovering the class own name value shows class info');
test(ownHover && ownHover.contents.value.indexOf('foam.parse.Suggestion') !== -1,
  'own-name hover shows the full class id');

section('Hover — string-literal sub-word does not resolve (label vs reference)');
// 'Reset Password' is a label; 'Password' is a property type but only a sub-word
var labelText = "foam.CLASS({\n  package: 'x',\n  name: 'Y',\n  methods: [ function f(e) { e.add('Reset Password'); } ]\n})";
var pwOff = labelText.indexOf('Reset Password') + 'Reset '.length + 2; // inside 'Password'
function posOfH(t, o) { var l = 0, c = 0; for ( var i = 0 ; i < o ; i++ ) { if ( t[i] === '\n' ) { l++; c = 0; } else c++; } return { line: l, character: c }; }
var labelHover = hoverHandler.handle(labelText, posOfH(labelText, pwOff));
test(labelHover == null, "no hover on a sub-word ('Password') of a label string");
// control: a class id that IS the whole string still hovers
var idStrText = "foam.CLASS({\n  requires: ['foam.parse.Suggestion']\n})";
var idStrHover = hoverHandler.handle(idStrText, { line: 1, character: 20 });
test(idStrHover != null, 'whole-string class reference still hovers');

section('Hover — relationship cardinality renders literally');
if ( index.classExists('foam.core.auth.Group') ) {
  var grpSrc = "foam.CLASS({\n  requires: ['foam.core.auth.Group']\n})";
  var grpHover = hoverHandler.handle(grpSrc, { line: 1, character: 30 });
  var grpText = ( grpHover && grpHover.contents && grpHover.contents.value ) || '';
  test(grpText.indexOf('*:*') !== -1 || grpText.indexOf('1:*') !== -1,
    'cardinality (*:* or 1:*) appears verbatim in relationship hover');
}
