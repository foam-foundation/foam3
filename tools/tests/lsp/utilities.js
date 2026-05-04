/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// Split from testFoamLSP.js — utilities tests.
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

// === CURSOR ANALYZER TESTS ===

section('CursorAnalyzer');
var analyzer = foam.parse.lsp.CursorAnalyzer.create();

// offsetToPosition
var testText = 'line0\nline1\nline2';
var pos = analyzer.offsetToPosition(testText, 6); // start of line1
test(pos.line === 1 && pos.character === 0, 'offsetToPosition: line 1 start');

// positionToOffset
var offset = analyzer.positionToOffset(testText, { line: 1, character: 3 });
test(offset === 9, 'positionToOffset: line1 char3 = offset 9, got: ' + offset);

// resolveClassId
var classText = 'foam.CLASS({ package: ' + Q + 'foam.parse' + Q + ', name: ' + Q + 'Suggestion' + Q + ' })';
test(analyzer.resolveClassId(classText) === 'foam.parse.Suggestion', 'resolveClassId extracts class ID');

// parseRequires
var reqText = 'foam.CLASS({ requires: [' + Q + 'foam.u2.DetailView' + Q + ', ' + Q + 'foam.u2.Element as El' + Q + '] })';
var reqMap = analyzer.parseRequires(reqText);
test(reqMap['DetailView'] === 'foam.u2.DetailView', 'parseRequires: DetailView');
test(reqMap['El'] === 'foam.u2.Element', 'parseRequires: alias El');

// getMethodSignature
var mockMethod = { name: 'start', code: function start(spec, args) {} };
test(analyzer.getMethodSignature(mockMethod) === 'start(spec, args)', 'getMethodSignature from code');

// getAllPropertiesForFile — includes implements interfaces
// FOAM JS doesn't merge interface props into class — we need to check separately
var implText = 'foam.CLASS({ package: ' + Q + 'foam.core.auth' + Q + ', name: ' + Q + 'User' + Q + ', implements: [' + Q + 'foam.core.auth.CreatedByAware' + Q + '] })';
var allProps = index.getAllPropertiesForFile('foam.core.auth.User', implText);
test(allProps['createdby'] != null, 'getAllPropertiesForFile includes createdBy from interface');

// === REAL FILE COVERAGE ===



// === REAL FILE COVERAGE ===

section('Real file coverage');

// Go-to-definition on real file
var defHandler2 = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index });
index.buildFileIndex();
var defText2 = 'foam.CLASS({ extends: ' + Q + 'foam.core.auth.User' + Q + ' })';
var defResult2 = defHandler2.handle(defText2, { line: 0, character: 25 });
test(defResult2 != null && defResult2.uri.indexOf('User.js') !== -1, 'Go-to-definition finds User.js');

// this. on real class shows 200+ items
var realMemberText = fs.readFileSync(path.resolve(process.cwd(), 'foam3/src/foam/u2/CitationView.js'), 'utf8');
var realMemberHandler = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index });
var realMemberResult = realMemberHandler.handle(realMemberText, { line: 79, character: 11 });
test(realMemberResult.items.length > 100, 'this. on real file: ' + realMemberResult.items.length + ' items');

// === FLAG-AWARE FILE INDEX TESTS ===



// === TYPE TRACKER TESTS ===

section('TypeTracker');
var typeTracker = foam.parse.lsp.TypeTracker.create({ cache: cache });

// var sug = this.Suggestion.create() → sug has type foam.parse.Suggestion
var typeText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'TypeTest' + Q + ',\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  methods: [\n    function go() {\n      var sug = this.Suggestion.create({});\n      sug.text;\n    }\n  ]\n})';
var typeModel = cache.getModelAt('', typeText, 9);
var varTypes = typeTracker.getVariableTypes(typeText, { line: 9, character: 10 }, typeModel, index);
test(varTypes['sug'] === 'foam.parse.Suggestion', 'TypeTracker: sug resolved to foam.parse.Suggestion');

// Unknown variable — not tracked
test(varTypes['unknown'] === undefined, 'TypeTracker: unknown variable returns undefined');

// Variable type completion: sug. suggests Suggestion properties
var typeMemberHandler = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index, cache: cache, typeTracker: typeTracker });
var typeCompText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'TypeTest2' + Q + ',\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  methods: [\n    function go() {\n      var sug = this.Suggestion.create({});\n      sug.text;\n    }\n  ]\n})';
var typeCompResult = typeMemberHandler.handle(typeCompText, { line: 9, character: 10 });
test(typeCompResult.items.length > 0, 'Variable type completion: sug. returns items: ' + typeCompResult.items.length);
test(typeCompResult.items.some(function(i) { return i.label === 'text'; }), 'Variable type completion includes text property');

// Hover on variable.property — sug.text should show property info from Suggestion
var typeHoverHandler = foam.parse.lsp.handlers.HoverHandler.create({ index: index, cache: cache, typeTracker: typeTracker });
var typeHoverText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'HoverTest' + Q + ',\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  methods: [\n    function go() {\n      var sug = this.Suggestion.create({});\n      sug.text;\n    }\n  ]\n})';
var varPropHover = typeHoverHandler.handle(typeHoverText, { line: 9, character: 10 });
test(varPropHover != null, 'Hover on variable.property resolves: ' + (varPropHover ? 'yes' : 'null'));
test(varPropHover && varPropHover.contents.value.indexOf('text') !== -1, 'variable.property hover shows property name');

// === SEMANTIC TOKEN HANDLER TESTS ===



// === CSS TOKEN RESOLUTION ===

section('CSSTokenResolver — value resolution');
// cssTokenResolver is declared earlier (before HoverHandler init).

// Test resolveTokenValue on base tokens
var resolvedPrimary = cssTokenResolver.resolveTokenValue('primary400');
test(resolvedPrimary != null && resolvedPrimary !== '', 'resolveTokenValue: primary400 resolves to a value');
test(resolvedPrimary && resolvedPrimary.charAt(0) === '#', 'resolveTokenValue: primary400 resolves to hex color');

// Test resolveTokenValue on unknown token
var resolvedUnknown = cssTokenResolver.resolveTokenValue('totallyFakeToken');
test(resolvedUnknown === null, 'resolveTokenValue: unknown token returns null');

// Test resolveTokenValue on recursive $-references
var resolvedBg = cssTokenResolver.resolveTokenValue('backgroundDefault');
test(resolvedBg != null && resolvedBg.charAt(0) === '#', 'resolveTokenValue: backgroundDefault resolves through $white to hex');

// Test that loadFromJournals still works (uses JrlLoader internally now)
var resolver2 = foam.parse.lsp.CSSTokenResolver.create();
resolver2.loadFromRegistry();
resolver2.loadFromJournals();
test(Object.keys(resolver2.themeNames_).length >= 0, 'loadFromJournals: runs without error using JrlLoader');

// === TABLE COLUMNS / SEARCH COLUMNS ===



// === TABLE COLUMNS / SEARCH COLUMNS ===

section('tableColumns / searchColumns');

// Register a test model for column validation
foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'ColumnTestModel',
  extends: 'foam.lang.FObject',
  properties: [
    { class: 'Long', name: 'id' },
    { class: 'String', name: 'firstName' },
    { class: 'String', name: 'lastName' },
    { class: 'Boolean', name: 'active' }
  ]
});

// Completion: cursor inside tableColumns array with partial 'fi' should filter matches
var colCompText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ColumnTestModel',\n  extends: 'foam.lang.FObject',\n  properties: [\n    { class: 'Long', name: 'id' },\n    { class: 'String', name: 'firstName' },\n    { class: 'String', name: 'lastName' },\n    { class: 'Boolean', name: 'active' }\n  ],\n  tableColumns: ['fi']\n})";
var colCompResult = completionHandler.handle(colCompText, { line: 10, character: 20 });
var colItems = colCompResult.items || [];
test(colItems.some(function(it) { return it.label === 'firstName'; }), 'tableColumns: partial "fi" suggests firstName');

// Completion: empty partial should suggest all own properties
var colCompText2 = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ColumnTestModel',\n  extends: 'foam.lang.FObject',\n  properties: [\n    { class: 'Long', name: 'id' },\n    { class: 'String', name: 'firstName' },\n    { class: 'String', name: 'lastName' },\n    { class: 'Boolean', name: 'active' }\n  ],\n  tableColumns: ['']\n})";
var colCompResult2 = completionHandler.handle(colCompText2, { line: 10, character: 19 });
var colItems2 = colCompResult2.items || [];
test(colItems2.some(function(it) { return it.label === 'firstName'; }), 'tableColumns: suggests firstName');
test(colItems2.some(function(it) { return it.label === 'lastName'; }), 'tableColumns: suggests lastName');
test(colItems2.some(function(it) { return it.label === 'id'; }), 'tableColumns: suggests id');

// Completion: searchColumns too
var searchCompText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ColumnTestModel',\n  extends: 'foam.lang.FObject',\n  properties: [\n    { class: 'Long', name: 'id' },\n    { class: 'String', name: 'firstName' }\n  ],\n  searchColumns: ['']\n})";
var searchCompResult = completionHandler.handle(searchCompText, { line: 8, character: 19 });
var searchItems = searchCompResult.items || [];
test(searchItems.some(function(it) { return it.label === 'firstName'; }), 'searchColumns: suggests firstName');

// tableColumns with requires above — should suggest props, not classes
var colWithReqText = "foam.CLASS({\n  package: 'test',\n  name: 'ColReqTest',\n  requires: ['foam.u2.DetailView'],\n  properties: [\n    { class: 'String', name: 'myProp' }\n  ],\n  tableColumns: ['']\n})";
var colWithReqResult = completionHandler.handle(colWithReqText, { line: 7, character: 19 });
var colWithReqItems = colWithReqResult.items || [];
test(colWithReqItems.some(function(it) { return it.label === 'myProp'; }), 'tableColumns: suggests props not classes when requires is above');
test( ! colWithReqItems.some(function(it) { return it.label === 'foam.u2.DetailView'; }), 'tableColumns: does NOT suggest class names');

// Diagnostics: valid column name — no warning
var validColText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ColDiagTest',\n  extends: 'foam.lang.FObject',\n  properties: [\n    { class: 'String', name: 'firstName' }\n  ],\n  tableColumns: ['firstName']\n})";
var validColDiags = diagHandler.handle(validColText);
var colWarns = validColDiags.filter(function(d) { return d.message.indexOf('firstName') !== -1 && d.message.indexOf('does not exist') !== -1; });
test(colWarns.length === 0, 'tableColumns: valid property NOT flagged');

// Diagnostics: invalid column name — should warn
var invalidColText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ColDiagTest2',\n  extends: 'foam.lang.FObject',\n  properties: [\n    { class: 'String', name: 'firstName' }\n  ],\n  tableColumns: ['nonExistent']\n})";
var invalidColDiags = diagHandler.handle(invalidColText);
test(invalidColDiags.some(function(d) { return d.message.indexOf('nonExistent') !== -1 && d.message.indexOf('does not exist') !== -1; }), 'tableColumns: invalid property IS flagged');

// Diagnostics: inherited property — should NOT warn
var inheritedColText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ColDiagTest3',\n  extends: 'foam.parse.lsp.test.ColumnTestModel',\n  tableColumns: ['firstName']\n})";
var inheritedColDiags = diagHandler.handle(inheritedColText);
var inheritedWarns = inheritedColDiags.filter(function(d) { return d.message.indexOf('firstName') !== -1 && d.message.indexOf('does not exist') !== -1; });
test(inheritedWarns.length === 0, 'tableColumns: inherited property NOT flagged');

// Diagnostics: searchColumns works too
var invalidSearchText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ColDiagTest4',\n  extends: 'foam.lang.FObject',\n  properties: [\n    { class: 'String', name: 'x' }\n  ],\n  searchColumns: ['bogus']\n})";
var invalidSearchDiags = diagHandler.handle(invalidSearchText);
test(invalidSearchDiags.some(function(d) { return d.message.indexOf('bogus') !== -1; }), 'searchColumns: invalid property IS flagged');

// === RAW CSS VALUE DIAGNOSTICS ===



// === CSS TOKEN RESOLVER — REVERSE LOOKUP ===
section('CSSTokenResolver.findTokenForValue');

var resolver = foam.parse.lsp.CSSTokenResolver.create();
resolver.loadFromRegistry();
resolver.loadFromJournals();

// Pick a known ColorToken and verify round-trip
var allNames = resolver.getAllTokenNames();
var colorName = null;
for ( var i = 0 ; i < allNames.length ; i++ ) {
  var info = resolver.getTokenInfo(allNames[i]);
  if ( info && info.type === 'ColorToken' ) {
    var val = resolver.resolveTokenValue(allNames[i]);
    if ( val && val.charAt(0) === '#' ) { colorName = allNames[i]; break; }
  }
}
if ( colorName ) {
  var colorVal = resolver.resolveTokenValue(colorName);
  test(resolver.findTokenForValue(colorVal) === colorName,
    'findTokenForValue: exact-hex match returns token name (' + colorName + ')');
  test(resolver.findTokenForValue(colorVal.toUpperCase()) === colorName,
    'findTokenForValue: case-insensitive');
}
test(resolver.findTokenForValue('#deadbeef') === null,
  'findTokenForValue: unknown color returns null');
test(resolver.findTokenForValue(null) === null,
  'findTokenForValue: null input returns null');

// 3-char hex normalization: '#f00' → '#ff0000'
var f00 = resolver.findTokenForValue('#ff0000');
var f00Short = resolver.findTokenForValue('#f00');
test(f00 === f00Short, 'findTokenForValue: 3-char hex normalizes to 6-char');

// === CREATE CONTEXT (DEEP + STRINGS + COMMENTS) ===

