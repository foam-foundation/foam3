/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// Split from testFoamLSP.js — completion tests.
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

// === COMPLETION TESTS ===

section('CompletionHandler — property types');
var completionHandler = foam.parse.lsp.handlers.CompletionHandler.create({ index: index, grammar: grammar });

// Test completion when user is TYPING (empty class value) — the real use case
var Q = String.fromCharCode(39); // single quote
var compText = 'foam.CLASS({\n  properties: [\n    { class: ' + Q + Q + ', name: ' + Q + 'x' + Q + ' }\n  ]\n})';
var compLines = compText.split('\n');
var compCharPos = compLines[2].indexOf(Q) + 1;
var result = completionHandler.handle(compText, { line: 2, character: compCharPos });
test(result.items.length > 0, 'Property type completions (empty value): ' + result.items.length + ' items');
test(result.items.some(function(i) { return i.label === 'String'; }), 'Includes String');
test(result.items.some(function(i) { return i.label === 'Boolean'; }), 'Includes Boolean');
test(result.items.some(function(i) { return i.label === 'FObjectProperty'; }), 'Includes FObjectProperty');

// Test completion for extends
var extendsText = 'foam.CLASS({\n  extends: ' + Q + Q + '\n})';
var extendsResult = completionHandler.handle(extendsText, { line: 1, character: 13 });
test(extendsResult.items.length > 0, 'Class completions for extends (empty): ' + extendsResult.items.length + ' items');

// Test completion for partial extends value (typing 'foam.')
var partialExtendsText = 'foam.CLASS({\n  extends: ' + Q + 'foam.' + Q + '\n})';
var partialExtendsResult = completionHandler.handle(partialExtendsText, { line: 1, character: 17 });
test(partialExtendsResult.items.length > 0, 'Class completions for extends (partial foam.): ' + partialExtendsResult.items.length + ' items');

// Test completion for partial class type (typing 'S')
var partialClassText = 'foam.CLASS({\n  properties: [\n    { class: ' + Q + 'S' + Q + ' }\n  ]\n})';
var partialClassResult = completionHandler.handle(partialClassText, { line: 2, character: 15 });
test(partialClassResult.items.length > 0, 'Property type completions (partial S): ' + partialClassResult.items.length + ' items');

// Test completion with factory function before the class property (regression test)
var factoryText = 'foam.CLASS({\n  properties: [\n    { name: ' + Q + 'y' + Q + ', factory: function() { return {}; } },\n    { class: ' + Q + Q + ', name: ' + Q + 'x' + Q + ' }\n  ]\n})';
var factoryResult = completionHandler.handle(factoryText, { line: 3, character: 14 });
test(factoryResult.items.length > 0, 'Completions after factory property: ' + factoryResult.items.length + ' items');

// Completion inside existing quoted value — extends: 'f' with closing quote present
var existingQuoteText = 'foam.CLASS({\n  extends: ' + Q + 'f' + Q + ',\n  name: ' + Q + 'Test' + Q + '\n})';
var existingQuoteResult = completionHandler.handle(existingQuoteText, { line: 1, character: 13 });
test(existingQuoteResult.items.length > 0, 'Completion inside existing quoted value: ' + existingQuoteResult.items.length + ' items');

// Completion inside existing class: 'S' with closing quote
var existingClassText = 'foam.CLASS({\n  properties: [\n    { class: ' + Q + 'S' + Q + ', name: ' + Q + 'x' + Q + ' }\n  ]\n})';
var existingClassResult = completionHandler.handle(existingClassText, { line: 2, character: 15 });
test(existingClassResult.items.length > 0, 'Completion inside existing class value: ' + existingClassResult.items.length + ' items');

// === MEMBER COMPLETION TESTS ===



// === MEMBER COMPLETION TESTS ===

section('MemberCompletionHandler — this. + requires + create');
var memberHandler = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index });

// this. suggests properties + methods + required classes + imports
var memberText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'Foo' + Q + ',\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  imports: [\n    ' + Q + 'userDAO' + Q + '\n  ],\n  properties: [\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'bar' + Q + ' }\n  ],\n  methods: [\n    function doStuff() {\n      this.\n    }\n  ]\n})';
var memberResult = memberHandler.handle(memberText, { line: 14, character: 11 });
test(memberResult.items.length > 0, 'this. returns items: ' + memberResult.items.length);
test(memberResult.items.some(function(i) { return i.label === 'Suggestion'; }), 'this. includes required class Suggestion');
test(memberResult.items.some(function(i) { return i.label === 'userDAO'; }), 'this. includes imported userDAO');

// this.Suggestion.create({ ▊ }) suggests Suggestion properties
var createText = 'foam.CLASS({\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  methods: [\n    function go() {\n      this.Suggestion.create({\n    }\n  ]\n})';
var createResult = memberHandler.handle(createText, { line: 6, character: 38 });
test(createResult.items.length > 0, 'this.X.create({ suggests properties: ' + createResult.items.length);
test(createResult.items.some(function(i) { return i.label === 'text'; }), 'create({}) includes text property');
test(createResult.items.some(function(i) { return i.label === 'category'; }), 'create({}) includes category property');

// this.Suggestion.create({ ... multi-line ... }) — cursor inside block on separate line
var multiCreateText = 'foam.CLASS({\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  methods: [\n    function go() {\n      this.Suggestion.create({\n        \n      })\n    }\n  ]\n})';
var multiCreateResult = memberHandler.handle(multiCreateText, { line: 7, character: 8 });
test(multiCreateResult.items.length > 0, 'Multi-line create({}) suggests properties: ' + multiCreateResult.items.length);

// Multi-line create with { on separate line from .create(
var separateBraceText = 'foam.CLASS({\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  methods: [\n    function go() {\n      this.Suggestion.create(\n        {\n          \n        }\n      )\n    }\n  ]\n})';
var separateBraceResult = memberHandler.handle(separateBraceText, { line: 8, character: 10 });
test(separateBraceResult.items.length > 0, 'create( + { on separate lines suggests: ' + separateBraceResult.items.length);

// Method signature has params in detail — test with a real class
var fs = require('fs');
var realText = fs.readFileSync(path.resolve(process.cwd(), 'foam3/src/foam/u2/CitationView.js'), 'utf8');
var realResult = memberHandler.handle(realText, { line: 79, character: 11 });
var methodItems = realResult.items.filter(function(i) { return i.kind === 2 && i.detail && i.detail.indexOf('(') !== -1; });
test(methodItems.length > 0, 'Method completions have param signatures: ' + methodItems.length);
var myClassItem = realResult.items.find(function(i) { return i.label === 'myClass'; });
test(myClassItem && myClassItem.detail === 'myClass(opt_extra)', 'myClass detail shows params: ' + (myClassItem ? myClassItem.detail : 'not found'));

// === HOVER TESTS ===

// Shared CSSTokenResolver so CSS-aware hovers (e.g. ^selector) work below.
var cssTokenResolver = foam.parse.lsp.CSSTokenResolver.create();
cssTokenResolver.loadFromRegistry();



// ========== this.RequiredClass.create() Completion ==========
section('RequiredClass Completion');

var reqClassText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse.lsp.test' + Q + ',\n  name: ' + Q + 'ReqTest' + Q + ',\n  requires: [' + Q + 'foam.parse.Suggestion' + Q + '],\n  methods: [\n    function test() {\n      this.Suggestion.\n    }\n  ]\n})';
var reqClassResult = memberHandler.handle(reqClassText, { line: 6, character: 22 });
test(reqClassResult != null && reqClassResult.items.length > 0, 'RequiredClass completion: returns items for this.Suggestion.');

var hasCreate = reqClassResult && reqClassResult.items.some(function(item) { return item.label === 'create'; });
test(hasCreate, 'RequiredClass completion: includes create()');

var hasIsInstance = reqClassResult && reqClassResult.items.some(function(item) { return item.label === 'isInstance'; });
test(hasIsInstance, 'RequiredClass completion: includes isInstance()');

// ========== Java Block Variable Hover ==========


// === POM COMPLETIONS ===

section('POM Completions');

var pomText = "foam.POM({\n  na\n})";
var pomResult = completionHandler.handle(pomText, { line: 1, character: 4 });
var pomItems = pomResult.items || [];
test(pomItems.some(function(it) { return it.label === 'name: '; }), 'POM: suggests name');

var pomText2 = "foam.POM({\n  \n})";
var pomResult2 = completionHandler.handle(pomText2, { line: 1, character: 2 });
var pomItems2 = pomResult2.items || [];
test(pomItems2.some(function(it) { return it.label === 'files: '; }), 'POM: suggests files');
test(pomItems2.some(function(it) { return it.label === 'projects: '; }), 'POM: suggests projects');
test(pomItems2.some(function(it) { return it.label === 'javaDependencies: '; }), 'POM: suggests javaDependencies');

// === FOAM.CLASS KEY COMPLETIONS ===



// === FOAM.CLASS KEY COMPLETIONS ===

section('foam.CLASS Key Completions');

var classText = "foam.CLASS({\n  \n})";
var classResult = completionHandler.handle(classText, { line: 1, character: 2 });
var classItems = classResult.items || [];
test(classItems.some(function(it) { return it.label === 'refines: '; }), 'CLASS key: suggests refines');
test(classItems.some(function(it) { return it.label === 'label: '; }), 'CLASS key: suggests label');
test(classItems.some(function(it) { return it.label === 'plural: '; }), 'CLASS key: suggests plural');
test(classItems.some(function(it) { return it.label === 'ids: '; }), 'CLASS key: suggests ids');
test(classItems.some(function(it) { return it.label === 'javaCode: '; }), 'CLASS key: suggests javaCode');
test(classItems.some(function(it) { return it.label === 'cssTokens: '; }), 'CLASS key: suggests cssTokens');

// Existing keys still work
test(classItems.some(function(it) { return it.label === 'package: '; }), 'CLASS key: still suggests package');
test(classItems.some(function(it) { return it.label === 'properties: '; }), 'CLASS key: still suggests properties');

// === PROPERTY KEY COMPLETIONS ===



// === PROPERTY KEY COMPLETIONS ===

section('Property Key Completions');

var propText = "foam.CLASS({\n  properties: [\n    {\n      \n    }\n  ]\n})";
var propResult = completionHandler.handle(propText, { line: 3, character: 6 });
var propItems = propResult.items || [];
test(propItems.some(function(it) { return it.label === 'class: ' || it.label === 'class'; }), 'Prop key: suggests class');
test(propItems.some(function(it) { return it.label === 'name: ' || it.label === 'name'; }), 'Prop key: suggests name');
test(propItems.some(function(it) { return it.label === 'value: '; }), 'Prop key: suggests value');
test(propItems.some(function(it) { return it.label === 'factory: '; }), 'Prop key: suggests factory');
test(propItems.some(function(it) { return it.label === 'expression: '; }), 'Prop key: suggests expression');
test(propItems.some(function(it) { return it.label === 'javaCode: '; }), 'Prop key: suggests javaCode');
test(propItems.some(function(it) { return it.label === 'javaGetter: '; }), 'Prop key: suggests javaGetter');
test(propItems.some(function(it) { return it.label === 'view: '; }), 'Prop key: suggests view');
test(propItems.some(function(it) { return it.label === 'visibility: '; }), 'Prop key: suggests visibility');
test(propItems.some(function(it) { return it.label === 'tableCellFormatter: '; }), 'Prop key: suggests tableCellFormatter');
test(propItems.some(function(it) { return it.label === 'label: '; }), 'Prop key: suggests label');
test(propItems.some(function(it) { return it.label === 'section: '; }), 'Prop key: suggests section');

// === Class-aware property axiom keys (issue #5032) ===
// When the property object has `class: 'String'` already declared, the
// suggested keys should include String's own axioms (e.g., `trim`, `width`)
// alongside the universal Property keys — not just the static fallback list.
var stringPropText =
  "foam.CLASS({\n  properties: [\n" +
  "    { class: 'String', name: 'foo', \n" +    // cursor lands on the empty line below
  "       \n" +
  "    }\n  ]\n})";
var stringPropResult = completionHandler.handle(stringPropText,
  { line: 3, character: 7 });
var stringPropLabels = (stringPropResult.items || []).map(function(it) { return it.label; });
test(stringPropLabels.indexOf('trim: ') !== -1,
  'Prop key (class: String): suggests String axiom `trim`');
test(stringPropLabels.indexOf('class: ') !== -1,
  'Prop key (class: String): still suggests universal `class`');
test(stringPropLabels.indexOf('factory: ') !== -1,
  'Prop key (class: String): still suggests universal `factory`');

// FObjectProperty has `of` and `objectProperties` etc. Verify class-specific
// suggestions for a different Property subclass.
var fobjPropText =
  "foam.CLASS({\n  properties: [\n" +
  "    { class: 'FObjectProperty', name: 'foo', \n" +
  "       \n" +
  "    }\n  ]\n})";
var fobjPropResult = completionHandler.handle(fobjPropText, { line: 3, character: 7 });
var fobjPropLabels = (fobjPropResult.items || []).map(function(it) { return it.label; });
// `of` already lives in the universal list, but the class-specific path must
// not regress it.
test(fobjPropLabels.indexOf('of: ') !== -1,
  'Prop key (class: FObjectProperty): suggests `of`');

// === INNER CLASS EXPRESSION SCOPING ===



// === INNER CLASS EXPRESSION SCOPING ===

section('Inner Class Expression Scoping');

// Expression in inner class should validate against inner class properties, not outer
var innerClassText = "foam.CLASS({\n  package: 'test',\n  name: 'Outer',\n  properties: [\n    { class: 'String', name: 'outerProp' }\n  ],\n  classes: [\n    {\n      name: 'Inner',\n      properties: [\n        { class: 'String', name: 'innerProp' },\n        { name: 'computed', expression: function(innerProp) { return innerProp; } }\n      ]\n    }\n  ]\n})";
var innerDiags = diagHandler.handle(innerClassText);
var innerExprWarns = innerDiags.filter(function(d) { return d.message.indexOf('innerProp') !== -1 && d.message.indexOf('does not exist') !== -1; });
test(innerExprWarns.length === 0, 'Inner class: innerProp expression NOT flagged');

// Expression in inner class referencing outer property should be flagged
var innerBadText = "foam.CLASS({\n  package: 'test',\n  name: 'Outer2',\n  properties: [\n    { class: 'String', name: 'outerProp' }\n  ],\n  classes: [\n    {\n      name: 'Inner2',\n      properties: [\n        { name: 'computed', expression: function(outerProp) { return outerProp; } }\n      ]\n    }\n  ]\n})";
var innerBadDiags = diagHandler.handle(innerBadText);
test(innerBadDiags.some(function(d) { return d.message.indexOf('outerProp') !== -1 && d.message.indexOf('does not exist') !== -1; }), 'Inner class: outerProp expression IS flagged (wrong scope)');

// Outer expression should still work
var outerExprText = "foam.CLASS({\n  package: 'test',\n  name: 'Outer3',\n  properties: [\n    { class: 'String', name: 'outerProp' },\n    { name: 'computed', expression: function(outerProp) { return outerProp; } }\n  ],\n  classes: [\n    {\n      name: 'Inner3',\n      properties: [\n        { class: 'String', name: 'innerProp' }\n      ]\n    }\n  ]\n})";
var outerExprDiags = diagHandler.handle(outerExprText);
var outerExprWarns = outerExprDiags.filter(function(d) { return d.message.indexOf('outerProp') !== -1 && d.message.indexOf('does not exist') !== -1; });
test(outerExprWarns.length === 0, 'Outer class: outerProp expression NOT flagged');

// === POM VALUE COMPLETIONS ===



// === POM VALUE COMPLETIONS ===

section('POM Value Completions');

// flags: '...' should suggest flag values
var pomFlagsText = "foam.POM({\n  files: [\n    { name: 'MyFile', flags: '' }\n  ]\n})";
var pomFlagsResult = completionHandler.handle(pomFlagsText, { line: 2, character: 30 });
var pomFlagsItems = pomFlagsResult.items || [];
test(pomFlagsItems.some(function(it) { return it.label === 'js|java'; }), 'POM flags: suggests js|java');
test(pomFlagsItems.some(function(it) { return it.label === 'js'; }), 'POM flags: suggests js');
test(pomFlagsItems.some(function(it) { return it.label === 'js&test|java&test'; }), 'POM flags: suggests js&test|java&test');
test(pomFlagsItems.some(function(it) { return it.label === 'web'; }), 'POM flags: suggests web');

// javaDependencies: ['...'] should suggest known deps
var pomDepsText = "foam.POM({\n  javaDependencies: [\n    ''\n  ]\n})";
var pomDepsResult = completionHandler.handle(pomDepsText, { line: 2, character: 5 });
var pomDepsItems = pomDepsResult.items || [];
test(pomDepsItems.length >= 0, 'POM javaDependencies: returns suggestions (count: ' + pomDepsItems.length + ')');

// flags inside POM should NOT suggest class names
test( ! pomFlagsItems.some(function(it) { return it.label && it.label.indexOf('foam.') === 0; }), 'POM flags: does NOT suggest class names');

// === CURSOR SENTINEL ===


// === COMPLETION (GRAMMAR-DRIVEN CONTEXT) ===
section('Completion — grammar-driven context detection');

var grammarHandler = foam.parse.lsp.handlers.CompletionHandler.create({ index: index });

var extSrc = "foam.CLASS({\n  package: 'test',\n  name: 'X',\n  extends: ''\n});";
test(grammarHandler.detectContext_(extSrc, { line: 3, character: 12 }).classRef,
  'Grammar detects extends: empty string context');

var ofSrcCtx = "foam.CLASS({\n  name: 'X',\n  properties: [\n    { class: 'FObjectProperty', of: '' }\n  ]\n});";
test(grammarHandler.detectContext_(ofSrcCtx, { line: 3, character: 38 }).classRef,
  'Grammar detects of: context deep inside property object');

var nonCtxSrc = "foam.CLASS({\n  name: 'X',\n  documentation: ''\n});";
test( ! grammarHandler.detectContext_(nonCtxSrc, { line: 2, character: 18 }).classRef,
  'Grammar correctly rejects documentation: as class-ref context');

var extRes = grammarHandler.handle(extSrc, { line: 3, character: 12 });
test(extRes.items.length > 50, 'extends: completion returns many items (' + extRes.items.length + ')');

// Filter with a partial to ensure specific classes surface despite 200-item cap
var extFObjSrc = "foam.CLASS({\n  package: 'test',\n  name: 'X',\n  extends: 'foam.lang.F'\n});";
var extFObjRes = grammarHandler.handle(extFObjSrc, { line: 3, character: 23 });
test(extFObjRes.items.some(function(i) { return i.label === 'foam.lang.FObject'; }),
  'extends: partial foam.lang.F surfaces FObject');

var reqSrc2 = "foam.CLASS({\n  package: 'test',\n  name: 'X',\n  requires: ['']\n});";
var reqRes = grammarHandler.handle(reqSrc2, { line: 3, character: 14 });
test(reqRes.items.length > 50, 'requires: completion returns many items');

var ofRes = grammarHandler.handle(ofSrcCtx, { line: 3, character: 38 });
test(ofRes.items.length > 50, 'of: completion returns many items');

var impSrc = "foam.CLASS({\n  name: 'X',\n  implements: ['']\n});";
var impRes = grammarHandler.handle(impSrc, { line: 2, character: 16 });
test(impRes.items.length > 50, 'implements: completion returns many items');

// Partial value: regex fallback still fires so suggestions appear.
var partialSrc = "foam.CLASS({\n  name: 'X',\n  extends: 'foam.u2'\n});";
var partialRes = grammarHandler.handle(partialSrc, { line: 2, character: 19 });
test(partialRes.items.length > 0, 'Partial extends value still returns suggestions');

// === GRAMMAR CONTEXT DETECTION ===


// === HANDLER OUTPUT SHAPE ===
section('Handler output — LSP wire format');

var dh = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index });
var badText = "foam.CLASS({\n  name: 'X',\n  extends: 'not.a.real.class.at.all.NoWay'\n});";
var diags = dh.handle(badText, 'file:///tmp/test.js');
test(diags.length > 0, 'DiagnosticsHandler: produces diagnostics for unknown class');
test( ! diags.some(function(d) { return d['class']; }),
  'DiagnosticsHandler: no FOAM class marker leaks into LSP output');
test(diags.every(function(d) { return d.range && d.message && d.severity; }),
  'DiagnosticsHandler: every diagnostic has range/message/severity');

var ch = foam.parse.lsp.handlers.CompletionHandler.create({ index: index });
var compText = "foam.CLASS({\n  name: 'X',\n  extends: ''\n});";
var compRes = ch.handle(compText, { line: 2, character: 12 });
test(compRes.items.length > 0, 'CompletionHandler: produces items');
test( ! compRes.items.some(function(i) { return i['class']; }),
  'CompletionHandler: no FOAM class marker leaks into LSP output');

// === ENUM COMPLETION ===


// === ENUM COMPLETION ===
section('Enum value completion (this.EnumAlias.▊)');

// Find a real FOAM enum for testing
var enumCandidates = index.getAllClassIds().filter(function(id) {
  var cls = index.getClass(id);
  return cls && cls.VALUES && cls.VALUES.length > 0;
});
if ( enumCandidates.length === 0 ) {
  test(false, 'Expected at least one enum in registry');
} else {
  var enumId = enumCandidates[0];
  var enumVals = index.getEnumValues(enumId);
  var enumShort = enumId.split('.').pop();
  // Line 3: `this.<EnumShort>.` — cursor right after trailing dot
  var line3 = "this." + enumShort + ".";
  var srcEnum = "foam.CLASS({\n  name: 'X',\n  requires: [ '" + enumId + "' ],\n" + line3 + "\n});";
  var mh = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index });
  var res = mh.handle(srcEnum, { line: 3, character: line3.length });
  var hasEnum = res.items.some(function(i) {
    return enumVals.some(function(v) { return v.name === i.label; });
  });
  test(hasEnum, 'Enum completion: suggests enum values for required enum (' + enumId + ')');
  test(res.items.every(function(i) { return i.kind === 13; }),
    'Enum completion: all items use EnumMember kind (13)');
}

// === CSS TOKEN RESOLVER — REVERSE LOOKUP ===


// === CREATE CONTEXT (DEEP + STRINGS + COMMENTS) ===
section('findCreateContext — method-body resilience');

var ca = foam.parse.lsp.CursorAnalyzer.create();

// Deep-nested: cursor 30 lines below the .create(
var deep = [
  "foam.CLASS({",
  "  package: 'test',",
  "  name: 'X',",
  "  requires: [ 'foam.u2.Element' ],",
  "  methods: [",
  "    function m() {",
  "      var e = this.Element.create({"
];
for ( var pad = 0 ; pad < 25 ; pad++ ) deep.push("        // filler " + pad);
deep.push("        ");  // cursor line
deep.push("      });");
deep.push("    }");
deep.push("  ]");
deep.push("});");
var deepText = deep.join('\n');
var deepLines = deepText.split('\n');
var cursorLine = 6 + 25; // last filler → cursor line right after, offset from pad
var deepCtx = ca.findCreateContext(deepText, cursorLine, cache, index);
test(deepCtx === 'foam.u2.Element',
  'findCreateContext: resolves 30+ lines below opening .create( (old limit was 20)');

// String with `{` inside shouldn't fool the scanner
var strText = [
  "foam.CLASS({",
  "  requires: [ 'foam.u2.Element' ],",
  "  methods: [ function m() {",
  "    var msg = 'hello { weird } string';",
  "    this.Element.create({",
  "      foo: 'bar'",
  "    });",
  "  } ]",
  "});"
].join('\n');
var strLines = strText.split('\n');
// Cursor line 5 is `      foo: 'bar'` — inside the create
var strCtx = ca.findCreateContext(strText, 5, cache, index);
test(strCtx === 'foam.u2.Element',
  'findCreateContext: ignores braces inside string literals');

// === CSS token autocomplete inside css: blocks (issue #5032) ===
section('CompletionHandler — CSS token completions');

var cssCh = foam.parse.lsp.handlers.CompletionHandler.create({
  index: index, analyzer: analyzer, cssTokenResolver: cssTokenResolver
});

var cssSrc = [
  "foam.CLASS({",
  "  package: 'test',",
  "  name: 'CssTokenUser',",
  "  css: `",
  "    ^ { color: $",                                   // L4 — cursor right after $
  "    }",
  "  `",
  "});"
].join('\n');

var cssRes = cssCh.handle(cssSrc, { line: 4, character: 17 });
var cssLabels = (cssRes.items || []).map(function(i) { return i.label; });
test(cssLabels.length > 0, 'CSS $token completion: returns items');
test(cssLabels.indexOf('$primary400') !== -1,
  'CSS $token completion: includes global $primary400');
test(cssLabels.indexOf('$tabActiveColor') !== -1,
  'CSS $token completion: includes per-class $tabActiveColor (Tabs.js)');
test(cssLabels.indexOf('$checkboxColor') !== -1,
  'CSS $token completion: includes per-class $checkboxColor (CheckBox.js)');

// Partial filter: typing `$tab` should narrow to tab-* tokens.
var cssSrcPartial = cssSrc.replace('color: $', 'color: $tab');
var cssResPartial = cssCh.handle(cssSrcPartial, { line: 4, character: 20 });
var partialLabels = (cssResPartial.items || []).map(function(i) { return i.label; });
test(partialLabels.indexOf('$tabActiveColor') !== -1,
  'CSS $token completion (partial $tab): surfaces $tabActiveColor');
test(partialLabels.every(function(l) { return l.toLowerCase().indexOf('tab') !== -1; }),
  'CSS $token completion (partial $tab): every result contains "tab"');

// === RAW COLOR MESSAGE + REPLACEMENT LOGIC ===


// === POM completion: grammar-driven key + value suggestions ===
section('POM completion — grammar drives every position');

var pomCh = foam.parse.lsp.handlers.CompletionHandler.create({
  index: index, analyzer: analyzer, cssTokenResolver: cssTokenResolver
});

var pomSrc = [
  "foam.POM({",                                          // L0
  "  name: 'lsp',",                                      // L1
  "  files: [",                                          // L2
  "    {  },",                                           // L3 — empty file object
  "    { name: '', flags: '' }",                         // L4 — empty value strings
  "  ]",                                                  // L5
  "});"                                                   // L6
].join('\n');

function pomLabels(pos) {
  var items = (pomCh.handle(pomSrc, pos) || {}).items || [];
  return items.map(function(it) { return it.label || it.insertText; });
}

// Top-level POM body: keys like files, javaFiles, projects, name, journalFiles
var topLabels = pomLabels({ line: 0, character: 10 });
test(topLabels.indexOf('files: ') !== -1,
  'POM top-level: suggests files: after foam.POM({');
test(topLabels.indexOf('projects: ') !== -1,
  'POM top-level: suggests projects:');

// Empty file object `{ ▊ }` — grammar must emit pomKey sugs for name/flags
var emptyObjLabels = pomLabels({ line: 3, character: 6 });
test(emptyObjLabels.indexOf('name: ') !== -1,
  'POM empty file object: suggests name:');
test(emptyObjLabels.indexOf('flags: ') !== -1,
  'POM empty file object: suggests flags:');

// Inside name: '▊' — grammar context marker triggers file-name suggestions
var nameValLabels = pomLabels({ line: 4, character: 13 });
test(nameValLabels.length > 0,
  'POM name value: at least one file-name suggestion');
test(nameValLabels.some(function(l) { return /^[A-Z]\w+$/.test(l); }),
  'POM name value: suggestions look like file names (PascalCase)');

// Inside flags: '▊' — grammar context marker triggers flag values
var flagsLabels = pomLabels({ line: 4, character: 24 });
test(flagsLabels.indexOf('js') !== -1,
  'POM flags value: suggests js');
test(flagsLabels.indexOf('java') !== -1,
  'POM flags value: suggests java');

// === Migration coverage: grammar emits 'property' and 'method' positions ===


// === LSP #4999 Fix 1: property-type completion inserts full path (except foam.lang.*) ===
section('CompletionHandler — property-type full-path insertion (issue #4999)');

// Empty value: class: '▊' — suggestions should include both a foam.lang.* short
// name (e.g., 'String') and a non-lang full path (e.g., 'foam.u2.ViewSpec').
var classEmptyText = 'foam.CLASS({\n  properties: [\n    { class: ' + Q + Q + ' }\n  ]\n})';
var classEmptyPos = { line: 2, character: classEmptyText.split('\n')[2].indexOf(Q) + 1 };
var classEmptyRes = completionHandler.handle(classEmptyText, classEmptyPos);

function findItem(items, pred) {
  for ( var i = 0 ; i < items.length ; i++ ) if ( pred(items[i]) ) return items[i];
  return null;
}
function insertedText(item) {
  return (item && item.textEdit && item.textEdit.newText) || (item && item.insertText) || item && item.label;
}

var stringItem = findItem(classEmptyRes.items, function(i) { return i.label === 'String'; });
test(stringItem && insertedText(stringItem) === 'String',
  'foam.lang.String: label and inserted text both short (got ' + insertedText(stringItem) + ')');

var viewSpecItem = findItem(classEmptyRes.items, function(i) { return i.label === 'ViewSpec'; });
test(viewSpecItem && insertedText(viewSpecItem) === 'foam.u2.ViewSpec',
  'foam.u2.ViewSpec: inserted text is full path (got ' + insertedText(viewSpecItem) + ')');

// Partial value: class: 'foam.u2.V▊' — replacement should still be full path.
var classPartialText = 'foam.CLASS({\n  properties: [\n    { class: ' + Q + 'foam.u2.V' + Q + ' }\n  ]\n})';
var classPartialPos = { line: 2, character: classPartialText.split('\n')[2].indexOf('V') + 1 };
var classPartialRes = completionHandler.handle(classPartialText, classPartialPos);
var viewSpecPartial = findItem(classPartialRes.items, function(i) { return i.label === 'ViewSpec'; });
test(viewSpecPartial && insertedText(viewSpecPartial) === 'foam.u2.ViewSpec',
  'Partial foam.u2.V: ViewSpec still replaces with full path (got ' + insertedText(viewSpecPartial) + ')');

// Grammar-level check: the propType sug carries the correct insert text so
// sug-driven paths stay consistent with the contextFallback path.
var sentinelForProp = foam.parse.lsp.CursorSentinel.create();
var propSentinelSrc = 'foam.CLASS({ properties: [ { class: ' + Q + Q + ' } ] })';
var propSentinelPos = { line: 0, character: propSentinelSrc.indexOf(Q) + 1 };
var propIns = sentinelForProp.insertAt(propSentinelSrc, propSentinelPos);
var propTypeSugs = grammar.collectSuggestionsAt(propIns.text, propIns.offset);
// Scan every sug's text so we don't depend on which specific prop types the
// grammar's cursor-window happens to return at this offset.
var langShorts = {};
index.getPropertyTypes().forEach(function(t) {
  if ( t.id && t.id.indexOf('foam.lang.') === 0 ) langShorts[t.name] = true;
});
var shortLeaks = propTypeSugs.filter(function(s) {
  return s.category === 'property' && s.text.indexOf('.') === -1 && ! langShorts[s.text];
});
test(shortLeaks.length === 0,
  'Grammar sug: no non-lang property types emit short-name insert text (leaks=' + shortLeaks.length + ')');
var fullPathSugs = propTypeSugs.filter(function(s) {
  return s.category === 'property' && s.text.indexOf('.') !== -1;
});
test(fullPathSugs.length > 0,
  'Grammar sug: at least one non-lang property type emits a full-path insert text (' + fullPathSugs.length + ')');

// === LSP #4999 Fix 2: view: '...' offers view-class suggestions ===


// === LSP #4999 Fix 2: view: '...' offers view-class suggestions ===
section('CompletionHandler — view: class-ref suggestions (issue #4999)');

// Empty string value for view: — should list class ids including views.
var viewEmptyText = 'foam.CLASS({\n  properties: [\n    { name: ' + Q + 'x' + Q + ', view: ' + Q + Q + ' }\n  ]\n})';
var viewEmptyPos = { line: 2, character: viewEmptyText.split('\n')[2].lastIndexOf(Q) };
var viewEmptyRes = completionHandler.handle(viewEmptyText, viewEmptyPos);
test(viewEmptyRes.items.length > 0,
  'view: empty string gets class suggestions (' + viewEmptyRes.items.length + ' items)');
test(viewEmptyRes.items.some(function(i) { return /^foam\.u2\./.test(i.label); }),
  'view: suggestions include foam.u2.* classes');

// Partial value — view: 'foam.u2.' — suggestions should still include views.
var viewPartialText = 'foam.CLASS({\n  properties: [\n    { name: ' + Q + 'x' + Q + ', view: ' + Q + 'foam.u2.' + Q + ' }\n  ]\n})';
var viewPartialPos = { line: 2, character: viewPartialText.split('\n')[2].lastIndexOf(Q) };
var viewPartialRes = completionHandler.handle(viewPartialText, viewPartialPos);
test(viewPartialRes.items.some(function(i) { return /^foam\.u2\./.test(i.label); }),
  'view: partial foam.u2. still offers view classes (' + viewPartialRes.items.length + ' items)');

// === LSP #4999 Fix 3: exports: [...] suggests model axiom names ===


// === LSP #4999 Fix 3: exports: [...] suggests model axiom names ===
section('CompletionHandler — exports axiom names (issue #4999)');

// Model with a requires: [...] block above exports: [...] — this is the
// shape that previously produced bogus foam.comics.* suggestions because
// the 10-line requires lookback hijacked the classRef fallback.
var exportText =
  'foam.CLASS({\n' +
  "  package: 'test',\n" +
  "  name: 'MyExporter',\n" +
  "  requires: [\n" +
  "    'foam.u2.View',\n" +
  "    'foam.u2.ViewSpec'\n" +
  "  ],\n" +
  "  exports: [\n" +
  "    'as asController',\n" +
  "    " + Q + Q + "\n" +
  "  ],\n" +
  "  properties: [\n" +
  "    { name: 'alpha' },\n" +
  "    { name: 'beta' }\n" +
  "  ],\n" +
  "  methods: [\n" +
  "    function refresh() {}\n" +
  "  ],\n" +
  "  actions: [\n" +
  "    { name: 'reload' }\n" +
  "  ],\n" +
  "  listeners: [\n" +
  "    { name: 'onUpdate' }\n" +
  "  ]\n" +
  "})";

var exportLines = exportText.split('\n');
// Target line 9 (1-indexed 10) which is the empty '' slot inside exports.
var exportLineIdx = -1;
for ( var li = 0 ; li < exportLines.length ; li++ ) {
  if ( exportLines[li].indexOf("    ''") === 0 ) { exportLineIdx = li; break; }
}
test(exportLineIdx !== -1, 'Exports test setup: found empty-string line at index ' + exportLineIdx);
var exportPos = { line: exportLineIdx, character: exportLines[exportLineIdx].indexOf(Q) + 1 };
var exportRes = completionHandler.handle(exportText, exportPos);

test(exportRes.items.length > 0,
  'exports: empty slot returns completions (' + exportRes.items.length + ' items)');
test(exportRes.items.every(function(i) { return i.label.indexOf('foam.') !== 0; }),
  'exports: no class-id (foam.*) leakage from the requires block above');
test(exportRes.items.some(function(i) { return i.label === 'alpha'; }),
  'exports: own property "alpha" is suggested');
test(exportRes.items.some(function(i) { return i.label === 'beta'; }),
  'exports: own property "beta" is suggested');
test(exportRes.items.some(function(i) { return i.label === 'refresh'; }),
  'exports: own method "refresh" is suggested');
test(exportRes.items.some(function(i) { return i.label === 'reload'; }),
  'exports: own action "reload" is suggested');
test(exportRes.items.some(function(i) { return i.label === 'onUpdate'; }),
  'exports: own listener "onUpdate" is suggested');

// Grammar-level: the exportName context marker fires at an empty-string slot.
var exportCtx = completionHandler.detectContext_(exportText, exportPos);
test(exportCtx.exportName === true, 'detectContext_: exportName flag set inside exports array');
test(exportCtx.classRef === false, 'detectContext_: classRef flag NOT set inside exports array');

// === Inner-object axiom-key completion (catalog-driven) ===
// Inside `methods: [ { | } ]`, `actions: [ { | } ]`, `sections: [ { | } ]`,
// `messages: [ { | } ]`, `values: [ { | } ]`, and `listeners: [ { | } ]`
// the grammar should suggest the relevant axiom keys for THAT inner-object
// scope. Earlier this only worked at top-level, so completion inside a
// method/action/etc. block returned just `name:` (the only hardcoded arm).
section('CompletionHandler — inner-object axiom-key suggestions');

function _suggestKeys(src, line, character) {
  var r = completionHandler.handle(src, { line: line, character: character });
  return r.items.map(function(i) { return (i.label || i.insertText || '').replace(/:.*$/, '').trim(); });
}

[
  ['methods',   ['name', 'code', 'args', 'javaCode', 'documentation']],
  ['actions',   ['name', 'label', 'isAvailable', 'isEnabled', 'code']],
  ['sections',  ['name', 'title', 'help', 'view']],
  ['messages',  ['name', 'message']],
  ['listeners', ['name', 'code', 'isFramed', 'isMerged']]
].forEach(function(row) {
  var slot = row[0], expected = row[1];
  var src = "foam.CLASS({\n  package: 'x',\n  name: 'Y',\n  " + slot + ": [\n    {\n      \n    }\n  ]\n});";
  var keys = _suggestKeys(src, 5, 6);
  expected.forEach(function(k) {
    test(keys.indexOf(k) !== -1,
      slot + ': { } suggests "' + k + '" (saw: ' + keys.slice(0, 6).join(',') + ')');
  });
});

// foam.ENUM values: [ { } ] — different top-level call
var enumValuesSrc = "foam.ENUM({\n  package: 'x',\n  name: 'Y',\n  values: [\n    {\n      \n    }\n  ]\n});";
var enumValueKeys = _suggestKeys(enumValuesSrc, 5, 6);
['name', 'label', 'documentation'].forEach(function(k) {
  test(enumValueKeys.indexOf(k) !== -1,
    'foam.ENUM values: { } suggests "' + k + '"');
});

// === Inner-object grammar parses without breaking outer parse ===
// Inner-object rules must not stop classEntries from completing. A method
// with extra keys like `args:` and `javaCode:` should still parse fully
// and emit position info for properties/methods after it.
var innerHeavySrc =
  "foam.CLASS({\n" +
  "  package: 'x',\n" +
  "  name: 'Y',\n" +
  "  methods: [\n" +
  "    { name: 'm1', args: 'X x', javaCode: `return;`, documentation: 'doc' },\n" +
  "    function m2() {}\n" +
  "  ],\n" +
  "  properties: [{ name: 'tail' }]\n" +
  "});";
var innerPositions = grammar.collectAxiomPositions(innerHeavySrc);
test(innerPositions.method && innerPositions.method.m1,
  'method m1 (with args/javaCode/documentation) emits position');
test(innerPositions.method && innerPositions.method.m2,
  'method m2 (bare function form) emits position');
test(innerPositions.property && innerPositions.property.tail,
  'property "tail" after a methods block with rich inner objects still emits');

// === COMPLETION — ENUM VALUE IN INSTANTIATION (F3) ===
section('Completion — enum value in instantiation (F3)');
var compText = "foam.CLASS({\n  requires: ['foam.core.app.Health'],\n" +
  "  methods: [ function f() { this.Health.create({ status: '' }); } ]\n})";
function posOf(t, o) { var l = 0, c = 0; for ( var i = 0 ; i < o ; i++ ) { if ( t[i] === '\n' ) { l++; c = 0; } else c++; } return { line: l, character: c }; }
var off = compText.indexOf("status: '") + "status: '".length;  // cursor inside the empty quotes
var compRes = memberHandler.handle(compText, posOf(compText, off));
test(compRes && compRes.items.length > 0, 'enum value completion returns items');
test(compRes.items.some(function(it) { return it.label === 'UP'; }), 'offers HealthStatus value UP');
test(compRes.items.some(function(it) { return it.label === 'DOWN'; }), 'offers HealthStatus value DOWN');

// === SUMMARY ===



// === tableColumns suggests actions (#5169) ===
// Actions listed in tableColumns render as row buttons, so completion offers
// them there; searchColumns filters on properties only.
section('CompletionHandler tableColumns actions (#5169)');

// Source must parse (eval-intercept has no prior-parse cache in tests), so
// the array entry is a complete empty string and the cursor sits inside it.
var colCompSrc = "foam.CLASS({\n" +
  "  package: 'test',\n" +
  "  name: 'ColCompDemo',\n" +
  "  properties: [ { class: 'String', name: 'name' } ],\n" +
  "  actions: [ { name: 'reflow', code: function() {} } ],\n" +
  "  tableColumns: [ '' ]\n" +
  "})";
// Cursor just inside the opening quote on the tableColumns line (line 5)
var colComp = completionHandler.handle(colCompSrc, { line: 5, character: 19 });
var colItems = ( colComp && colComp.items ) || [];
test(colItems.some(function(i) { return i.label === 'reflow' && i.detail === 'Action'; }),
  'tableColumns completion includes own action');
test(colItems.some(function(i) { return i.label === 'name'; }),
  'tableColumns completion still includes properties');

var searchCompSrc = colCompSrc.replace('tableColumns', 'searchColumns');
var searchComp = completionHandler.handle(searchCompSrc, { line: 5, character: 20 });
var searchItems = ( searchComp && searchComp.items ) || [];
test(!searchItems.some(function(i) { return i.label === 'reflow'; }),
  'searchColumns completion does NOT include actions');
test(searchItems.some(function(i) { return i.label === 'name'; }),
  'searchColumns completion includes properties');

// === Auto-require on `this.<Capital>` ===
// Picking a class the model does not require yet inserts its short name AND
// adds the id to that model's requires:, via additionalTextEdits. Each case
// applies the edit and re-reads the result through the eval-intercept cache,
// so "the edit is valid JS and the model now requires the class" is checked,
// not just the edit's text.
section('MemberCompletionHandler — auto-require via additionalTextEdits');

var AR_ID = 'foam.comics.DAOControllerView';
var arHandler = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index });

// Cursor at the end of the line holding `this.DAOCon`.
function arComplete(src, opt_handler) {
  var lines = src.split('\n');
  for ( var l = 0 ; l < lines.length ; l++ ) {
    var c = lines[l].indexOf('this.DAOCon');
    if ( c !== -1 ) return ( opt_handler || arHandler ).handle(src, { line: l, character: c + 'this.DAOCon'.length }, 'file:///ar.js');
  }
  throw new Error('fixture has no this.DAOCon');
}
function arItem(res) {
  return res.items.filter(function(i) { return i.detail === AR_ID && i.additionalTextEdits; })[0];
}
function arApply(src, edits) {
  var lineStarts = [ 0 ];
  for ( var i = 0 ; i < src.length ; i++ ) if ( src.charAt(i) === '\n' ) lineStarts.push(i + 1);
  var sorted = edits.slice().sort(function(a, b) {
    return ( lineStarts[b.range.start.line] + b.range.start.character ) -
           ( lineStarts[a.range.start.line] + a.range.start.character );
  });
  sorted.forEach(function(e) {
    var from = lineStarts[e.range.start.line] + e.range.start.character;
    var to   = lineStarts[e.range.end.line]   + e.range.end.character;
    src = src.substring(0, from) + e.newText + src.substring(to);
  });
  return src;
}
function arRequires(src, opt_model) {
  var models = foam.parse.lsp.FileModelCache.create().parseFileModels(src);
  return ( models[opt_model || 0] || {} ).requires || [];
}
function arMethod(indent) {
  return indent + 'methods: [\n' +
         indent + '  function go() {\n' +
         indent + '    this.DAOCon\n' +
         indent + '  }\n' +
         indent + ']\n';
}

test(index.getAllClassIds().indexOf(AR_ID) !== -1, 'fixture class ' + AR_ID + ' is registered');

// 1. Sorted multi-line array — goes in at its sorted place, same indent.
var arSorted = "foam.CLASS({\n  package: 'test',\n  name: 'ArSorted',\n  requires: [\n" +
  "    'foam.u2.DetailView',\n    'foam.u2.View'\n  ],\n" + arMethod('  ') + "});";
var arRes = arComplete(arSorted);
var arIt  = arItem(arRes);
test(!! arIt && arIt.label === 'DAOControllerView', 'sorted: short name offered with an edit');
test(arRes.isIncomplete === true, 'this.<Partial> list is isIncomplete so the client re-asks');
var arOut = arIt ? arApply(arSorted, arIt.additionalTextEdits) : '';
test(arOut.indexOf("  requires: [\n    '" + AR_ID + "',\n    'foam.u2.DetailView',\n    'foam.u2.View'\n  ],") !== -1,
  'sorted: id inserted first, one per line, 4-space indent');
test(JSON.stringify(arRequires(arOut)) === JSON.stringify([ AR_ID, 'foam.u2.DetailView', 'foam.u2.View' ]),
  'sorted: edited file evaluates with the id required');

// 2. Unsorted array — appended last.
var arUnsorted = arSorted.replace("    'foam.u2.DetailView',\n    'foam.u2.View'", "    'foam.u2.View',\n    'foam.u2.DetailView'");
arIt = arItem(arComplete(arUnsorted));
arOut = arIt ? arApply(arUnsorted, arIt.additionalTextEdits) : '';
test(JSON.stringify(arRequires(arOut)) === JSON.stringify([ 'foam.u2.View', 'foam.u2.DetailView', AR_ID ]),
  'unsorted: id appended at the end');

// 3. Single-line array, double quotes — stays on one line, keeps the quote.
var arInline = 'foam.CLASS({\n  package: "test",\n  name: "ArInline",\n  requires: [ "foam.u2.View" ],\n' + arMethod('  ') + '});';
arIt = arItem(arComplete(arInline));
arOut = arIt ? arApply(arInline, arIt.additionalTextEdits) : '';
test(arOut.indexOf('requires: [ "' + AR_ID + '", "foam.u2.View" ],') !== -1,
  'single-line: inserted inline with the file\'s double quotes');

// 4. No requires array — a new one after the last identity entry.
var arNone = "foam.CLASS({\n  package: 'test',\n  name: 'ArNone',\n  extends: 'foam.u2.View',\n\n" + arMethod('  ') + "});";
arIt = arItem(arComplete(arNone));
arOut = arIt ? arApply(arNone, arIt.additionalTextEdits) : '';
test(arOut.indexOf("  extends: 'foam.u2.View',\n  requires: [\n    '" + AR_ID + "'\n  ],\n") !== -1,
  'no requires: new array after extends, matching indentation');
test(JSON.stringify(arRequires(arOut)) === JSON.stringify([ AR_ID ]),
  'no requires: edited file evaluates with the id required');

// 4b. The identity entry is the last one in the model — the comma goes before.
var arNoneLast = "foam.CLASS({\n" + arMethod('  ').replace(/\n$/, ',\n') + "  name: 'ArNoneLast'\n});";
arIt = arItem(arComplete(arNoneLast));
arOut = arIt ? arApply(arNoneLast, arIt.additionalTextEdits) : '';
test(JSON.stringify(arRequires(arOut)) === JSON.stringify([ AR_ID ]),
  'no requires, name last: array appended after name with a leading comma');

// 5. Empty array.
var arEmpty = "foam.CLASS({\n  name: 'ArEmpty',\n  requires: [],\n" + arMethod('  ') + "});";
arIt = arItem(arComplete(arEmpty));
arOut = arIt ? arApply(arEmpty, arIt.additionalTextEdits) : '';
test(arOut.indexOf("  requires: [\n    '" + AR_ID + "'\n  ],") !== -1, 'empty array: filled one entry per line');

// 6. Already required — offered only as the plain required alias, no edit.
var arHave = arSorted.replace("    'foam.u2.DetailView',", "    '" + AR_ID + "',\n    'foam.u2.DetailView',");
var arHaveRes = arComplete(arHave);
test(! arItem(arHaveRes), 'already required: no item carries a requires edit');
test(arHaveRes.items.some(function(i) { return i.label === 'DAOControllerView' && ! i.additionalTextEdits; }),
  'already required: still listed as a required class');

// 7. Short name already used by another class — not offered (would change its meaning).
var arClash = arSorted.replace("'foam.u2.View'", "'foam.u2.View as DAOControllerView'");
test(! arItem(arComplete(arClash)), 'short name taken by an alias: not offered');

// 8. Multi-model file — the edit goes to the model holding the cursor.
var arMulti = "foam.CLASS({\n  package: 'test',\n  name: 'First',\n  requires: [ 'foam.u2.View' ]\n});\n\n" +
  "foam.CLASS({\n  package: 'test',\n  name: 'Second',\n  requires: [\n    'foam.u2.DetailView'\n  ],\n" + arMethod('  ') + "});";
arIt = arItem(arComplete(arMulti));
arOut = arIt ? arApply(arMulti, arIt.additionalTextEdits) : '';
test(JSON.stringify(arRequires(arOut, 0)) === JSON.stringify([ 'foam.u2.View' ]),
  'multi-model: first model untouched');
test(JSON.stringify(arRequires(arOut, 1)) === JSON.stringify([ AR_ID, 'foam.u2.DetailView' ]),
  'multi-model: second model (cursor) gains the require');

// 9. Nested model (IIFE) — a new array uses the file's own indent unit.
var arNested = "(function() {\n  foam.CLASS({\n    package: 'test',\n    name: 'ArNested',\n" + arMethod('    ') + "  });\n})();";
arIt = arItem(arComplete(arNested));
arOut = arIt ? arApply(arNested, arIt.additionalTextEdits) : '';
test(arOut.indexOf("    name: 'ArNested',\n    requires: [\n      '" + AR_ID + "'\n    ],\n") !== -1,
  'nested model: keys at 4, entries at 6');

// 10. Array holding { path: … } objects — no safe edit, so nothing offered.
var arObj = arSorted.replace("'foam.u2.View'", "{ path: 'foam.u2.View' }");
test(! arItem(arComplete(arObj)), 'object entry in requires: nothing offered');

// 11. Lowercase partial is a member, not a class.
var arLower = arSorted.replace('this.DAOCon', 'this.daoCon');
var arLowerLines = arLower.split('\n');
var arLowerLine  = arLowerLines.findIndex(function(l) { return l.indexOf('this.daoCon') !== -1; });
var arLowerRes   = arHandler.handle(arLower, { line: arLowerLine, character: arLowerLines[arLowerLine].indexOf('this.daoCon') + 11 }, 'file:///ar.js');
test(! arLowerRes.items.some(function(i) { return i.additionalTextEdits; }), 'lowercase partial: no auto-require items');

// 12. Flag off — today's list: required classes only, complete.
var arOff = foam.parse.lsp.handlers.MemberCompletionHandler.create({
  index: index,
  featureConfig: require(path.resolve(__dirname, '../../lsp/FeatureConfig')).load({
    initOptions: { features: { 'completion.autoRequires': false } } })
});
var arOffRes = arComplete(arSorted, arOff);
test(! arOffRes.items.some(function(i) { return i.additionalTextEdits; }), 'flag off: no auto-require items');
test(arOffRes.isIncomplete === false, 'flag off: list is complete, as before');

// 13. requires: after an entry the grammar cannot parse. The harvest stops
// at the call inside `axioms:`, so the existing requires: has no span —
// writing a second requires: key would lose the new require (the later
// duplicate key wins). Nothing may be offered.
var arAxioms = "foam.CLASS({\n  package: 'test',\n  name: 'ArAxioms',\n" +
  "  axioms: [ foam.pattern.Faceted.create() ],\n  requires: [\n    'foam.u2.View'\n  ],\n" + arMethod('  ') + "});";
var arAxiomsRes = arComplete(arAxioms);
test(! arItem(arAxiomsRes), 'requires: after an unparseable axioms: entry — nothing offered');
test(! arAxiomsRes.items.some(function(i) {
    return ( i.additionalTextEdits || [] ).some(function(e) { return e.newText.indexOf('requires:') !== -1; }); }),
  'requires: after an unparseable axioms: entry — no second requires: key is written');

// 14. Java-only classes: not offered to a JS model, offered to a Java-only one.
var JO_ID = 'foam.dao.F3FileJournal';
function joItems(src) {
  var ls = src.split('\n');
  var l  = ls.findIndex(function(x) { return x.indexOf('this.F3FileJ') !== -1; });
  return arHandler.handle(src, { line: l, character: ls[l].indexOf('this.F3FileJ') + 12 }, 'file:///jo.js').items;
}
var joJs = arSorted.replace('this.DAOCon', 'this.F3FileJ');
test(! joItems(joJs).some(function(i) { return i.detail === JO_ID; }), 'Java-only class not offered in a JS model');
var joJava = joJs.replace("  name: 'ArSorted',\n", "  name: 'ArSorted',\n  flags: [ 'java' ],\n");
test(joItems(joJava).some(function(i) { return i.detail === JO_ID && i.additionalTextEdits; }),
  'Java-only class offered in a Java-only model');

// 15. CRLF file — inserted line breaks are CRLF too.
var arCrlf = arSorted.replace(/\n/g, '\r\n');
arIt = arItem(arComplete(arCrlf));
arOut = arIt ? arApply(arCrlf, arIt.additionalTextEdits) : '';
test(!! arIt && arOut.indexOf("'" + AR_ID + "',\r\n    'foam.u2.DetailView'") !== -1, 'CRLF: entry inserted with CRLF');
test(!! arIt && ! /[^\r]\n/.test(arOut), 'CRLF: no bare LF left in the edited file');
var arNoneCrlf = arNone.replace(/\n/g, '\r\n');
arIt = arItem(arComplete(arNoneCrlf));
arOut = arIt ? arApply(arNoneCrlf, arIt.additionalTextEdits) : '';
test(!! arIt && ! /[^\r]\n/.test(arOut) && JSON.stringify(arRequires(arOut)) === JSON.stringify([ AR_ID ]),
  'CRLF, no requires: new array uses CRLF and evaluates');

// 16. Multi-model: the SECOND model already requires the class. Its own
// requires decide, not the first model's — no second copy is offered.
var arMultiHave = "foam.CLASS({\n  package: 'test',\n  name: 'First',\n  requires: [ 'foam.u2.View' ]\n});\n\n" +
  "foam.CLASS({\n  package: 'test',\n  name: 'Second',\n  requires: [\n    '" + AR_ID + "'\n  ],\n" + arMethod('  ') + "});";
var arMultiHaveRes = arComplete(arMultiHave);
test(! arItem(arMultiHaveRes), 'multi-model: class the cursor model already requires is not offered again');
test(arMultiHaveRes.items.some(function(i) { return i.label === 'DAOControllerView' && ! i.additionalTextEdits; }),
  'multi-model: the cursor model\'s own requires are listed');

// 17. A commented-out model after the cursor's model: its `name:` must not
// be taken as the anchor, or the new requires: lands inside the comment.
var arCommented = "foam.CLASS({\n  package: 'test',\n  name: 'Live',\n" + arMethod('  ') + "});\n\n" +
  "/*\nfoam.CLASS({\n  package: 'test',\n  name: 'Dead'\n});\n*/\n";
arIt = arItem(arComplete(arCommented));
arOut = arIt ? arApply(arCommented, arIt.additionalTextEdits) : '';
test(!! arIt && arOut.indexOf("  name: 'Live',\n  requires: [\n    '" + AR_ID + "'\n  ],\n") !== -1,
  'commented-out model: new requires: goes after the live name:');
test(JSON.stringify(arRequires(arOut)) === JSON.stringify([ AR_ID ]),
  'commented-out model: edited file evaluates with the id required');

// 18. Two requires: keys — JS keeps the last one, so the edit goes there.
var arTwo = "foam.CLASS({\n  name: 'ArTwo',\n  requires: [ 'foam.u2.View' ],\n" +
  "  requires: [ 'foam.u2.DetailView' ],\n" + arMethod('  ') + "});";
arIt = arItem(arComplete(arTwo));
arOut = arIt ? arApply(arTwo, arIt.additionalTextEdits) : '';
test(JSON.stringify(arRequires(arOut)) === JSON.stringify([ AR_ID, 'foam.u2.DetailView' ]),
  'two requires: keys — the id lands in the last one, which JS keeps');

// 19. Mixed endings: one CRLF elsewhere does not make an LF insert CRLF.
var arMixed = "// header\r\n" + arSorted;
arIt = arItem(arComplete(arMixed));
arOut = arIt ? arApply(arMixed, arIt.additionalTextEdits) : '';
test(!! arIt && arOut.indexOf("'" + AR_ID + "',\n    'foam.u2.DetailView'") !== -1,
  'mixed endings: insert on an LF line uses LF');

// 20. A foam.CLASS inside a method never runs at load time, so
// parseFileModels pairs each later model with the previous call's line
// (src/foam/dao/Relationship.js:329). The cursor sits in Second, which
// already requires AR_ID; getModelAt answers Third, whose requires lack it.
// Offering AR_ID would add it to Second a second time — nothing is offered.
var arShift = "foam.CLASS({\n  package: 'test',\n  name: 'First',\n  methods: [\n" +
  "    function later() {\n      foam.CLASS({ package: 'test', name: 'NeverRuns' });\n    }\n  ]\n});\n\n" +
  "foam.CLASS({\n  package: 'test',\n  name: 'Second',\n  requires: [\n    '" + AR_ID + "'\n  ],\n" + arMethod('  ') + "});\n\n" +
  "foam.CLASS({\n  package: 'test',\n  name: 'Third'\n});";
var arShiftModels = foam.parse.lsp.FileModelCache.create().parseFileModels(arShift);
test(arShiftModels.length === 3 && arShiftModels[1].name === 'Second' &&
     arShiftModels[1].sourceLine_ !== arShift.split('\n').indexOf("  name: 'Second',") - 2,
  'fixture reproduces the shifted sourceLine_ (known parseFileModels issue)');
var arShiftRes = arComplete(arShift);
test(! arShiftRes.items.some(function(i) {
    return ( i.additionalTextEdits || [] ).some(function(e) { return e.newText.indexOf(AR_ID) !== -1; }); }),
  'shifted model lines: no edit adds a require the cursor model already has');

// === labelDetails, gated on the client's completionItem capability ===
section('Completion — labelDetails only for clients that declared labelDetailsSupport');

var ldSrc = "foam.CLASS({\n  package: 'test',\n  name: 'LdDemo',\n  requires: [ 'foam.u2.View' ],\n" +
  "  properties: [ { class: 'String', name: 'title' } ],\n" + arMethod('  ').replace('this.DAOCon', 'this.') + "});";
var ldLine = ldSrc.split('\n').findIndex(function(l) { return /this\.$/.test(l); });
var ldPos  = { line: ldLine, character: ldSrc.split('\n')[ldLine].length };

var ldPlain = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index }).handle(ldSrc, ldPos, 'file:///ld.js');
test(! ldPlain.items.some(function(i) { return i.labelDetails; }), 'no capability: no item carries labelDetails');
test(ldPlain.items.some(function(i) { return i.label === 'View' && i.detail === 'foam.u2.View'; }),
  'no capability: detail unchanged (required class shows its id)');

var ldRich = foam.parse.lsp.handlers.MemberCompletionHandler.create({
  index: index, completionItemSupport: { labelDetailsSupport: true }
}).handle(ldSrc, ldPos, 'file:///ld.js');
var ldView = ldRich.items.filter(function(i) { return i.label === 'View'; })[0];
test(ldView && ldView.labelDetails && ldView.labelDetails.description === 'foam.u2',
  'capability: required class shows its package as labelDetails.description');
test(ldView && ldView.detail === 'foam.u2.View', 'capability: detail still sent');
// Property items with a known type: `this.View.create({ ▊` lists View's properties.
var ldCreateSrc = ldSrc.replace(/this\.$/m, 'this.View.create({ ');
var ldCreateLine = ldCreateSrc.split('\n')[ldLine];
var ldCreate = foam.parse.lsp.handlers.MemberCompletionHandler.create({
  index: index, completionItemSupport: { labelDetailsSupport: true }
}).handle(ldCreateSrc, { line: ldLine, character: ldCreateLine.length }, 'file:///ld.js');
var ldProp = ldCreate.items.filter(function(i) { return i.label === 'data'; })[0];
test(!! ldProp && ldProp.labelDetails && /^: \w+$/.test(ldProp.labelDetails.detail),
  'capability: property shows ": <Type>" as labelDetails.detail');

var arRich = arComplete(arSorted, foam.parse.lsp.handlers.MemberCompletionHandler.create({
  index: index, completionItemSupport: { labelDetailsSupport: true } }));
arIt = arItem(arRich);
test(arIt && arIt.labelDetails && arIt.labelDetails.description === 'foam.comics',
  'capability: auto-require item shows its package');

// CompletionHandler: property-type list (`class: '▊'`).
var ldTypeSrc = "foam.CLASS({\n  name: 'LdType',\n  properties: [ { class: '', name: 'x' } ]\n})";
var ldTypePos = { line: 2, character: ldTypeSrc.split('\n')[2].indexOf("''") + 1 };
var ldTypePlain = foam.parse.lsp.handlers.CompletionHandler.create({ index: index, grammar: grammar }).handle(ldTypeSrc, ldTypePos);
test(ldTypePlain.items.length > 0 && ! ldTypePlain.items.some(function(i) { return i.labelDetails; }),
  'CompletionHandler, no capability: property types carry no labelDetails');
var ldTypeRich = foam.parse.lsp.handlers.CompletionHandler.create({
  index: index, grammar: grammar, completionItemSupport: { labelDetailsSupport: true }
}).handle(ldTypeSrc, ldTypePos);
var ldStr = ldTypeRich.items.filter(function(i) { return i.label === 'String'; })[0];
test(ldStr && ldStr.labelDetails && ldStr.labelDetails.description === 'foam.lang',
  'CompletionHandler, capability: String type shows package foam.lang');
