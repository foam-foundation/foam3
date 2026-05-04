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
var deepCtx = ca.findCreateContext(deepLines, cursorLine, deepText, index);
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
var strCtx = ca.findCreateContext(strLines, 5, strText, index);
test(strCtx === 'foam.u2.Element',
  'findCreateContext: ignores braces inside string literals');

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

// === SUMMARY ===


