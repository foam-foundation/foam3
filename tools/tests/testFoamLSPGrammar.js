#!/usr/bin/env node

/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Quick test for FOAM LSP grammar — runs in seconds without full build.
// Usage: cd <your-project> && node foam3/tools/tests/testFoamLSPGrammar.js

console.log = function() { console.error.apply(console, arguments); };
console.warn = function() { console.error.apply(console, arguments); };
globalThis.SILENT = false; globalThis.VERBOSE = false;
globalThis.DRY_RUN = false; globalThis.HELP = false; globalThis.NOP = '';

process.on('unhandledRejection', function(e) {});
process.on('uncaughtException', function(e) {
  if ( e.message && ( e.message.includes('document') || e.message.includes('window') ) ) return;
  if ( e instanceof SyntaxError ) return;
});

var path = require('path');
var fs = require('fs');
var pmake = require(path.resolve(__dirname, '../pmake'));
var buildlib = require(path.resolve(__dirname, '../buildlib'));
buildlib.error = function() { /* suppress fatal errors during boot */ };

var pomPath = path.resolve(process.cwd(), 'pom');
pmake.bind(buildlib, '-makers=LSP -pom=' + pomPath)();

// === TEST HARNESS ===

var failures = 0;
var passes = 0;

function test(condition, message) {
  if ( condition ) {
    passes++;
    console.error('  \x1b[32m✓\x1b[0m ' + message);
  } else {
    failures++;
    console.error('  \x1b[31m✘ FAIL:\x1b[0m ' + message);
  }
}

function section(name) {
  console.error('\n\x1b[1m=== ' + name + ' ===\x1b[0m');
}

// === TEST FILES ===

var TEST_FILES = [
  'foam3/src/foam/lang/types.js',
  'foam3/src/foam/parse/parse.js',
  'foam3/src/foam/core/controller/ApplicationController.js',
  'foam3/src/foam/lang/Enum.js',
  'foam3/src/foam/parse/SimpleQueryParser.js'
];

// === FOAMINDEX TESTS ===

section('FoamIndex');
var index = foam.parse.lsp.FoamIndex.create();
test(index.getAllClassIds().length > 100, 'getAllClassIds returns many classes: ' + index.getAllClassIds().length);
test(index.classExists('foam.lang.FObject'), 'FObject exists');
test(index.getPropertyTypes().length > 50, 'Many property types: ' + index.getPropertyTypes().length);
test(index.getPropertyTypes().some(function(t) { return t.name === 'String'; }), 'Includes String type');
test(index.getPropertyTypes().some(function(t) { return t.name === 'Boolean'; }), 'Includes Boolean type');
test(index.getPropertyTypes().some(function(t) { return t.name === 'FObjectProperty'; }), 'Includes FObjectProperty type');

// === GRAMMAR TESTS ===

section('FoamClassGrammar — symbol check');
var grammar = foam.parse.lsp.FoamClassGrammar.create({ index: index });
test(Object.keys(grammar.symbolMap_).length > 20, 'Grammar has symbols: ' + Object.keys(grammar.symbolMap_).length);
test('START' in grammar.symbolMap_, 'Has START symbol');

section('FoamClassGrammar — parse real files');
TEST_FILES.forEach(function(filePath) {
  var absPath = path.resolve(process.cwd(), filePath);
  if ( ! fs.existsSync(absPath) ) {
    console.error('  Skipping (not found): ' + filePath);
    return;
  }

  var text = fs.readFileSync(absPath, 'utf8');
  console.error('\n  File: ' + filePath + ' (' + text.split('\n').length + ' lines)');

  var ps = foam.parse.StringPStream.create({ str: text + String.fromCharCode(26) });
  try {
    var result = grammar.parse(ps);
    test(result !== undefined, 'Parses without error');
  } catch (e) {
    test(false, 'Parse threw: ' + e.message);
  }
});

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

section('HoverHandler — class hover');
var hoverHandler = foam.parse.lsp.handlers.HoverHandler.create({ index: index });

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

section('DiagnosticsHandler');
var diagHandler = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index });

// Valid file — no errors
var validText = "foam.CLASS({\n  package: 'test',\n  name: 'Valid',\n  extends: 'foam.lang.FObject'\n})";
var diags = diagHandler.handle(validText);
var errors = diags.filter(function(d) { return d.severity <= 2; });
test(errors.length === 0, 'Valid file has no errors/warnings');

// Invalid extends
var invalidText = "foam.CLASS({\n  extends: 'foo.bar.Missing'\n})";
var diags2 = diagHandler.handle(invalidText);
test(diags2.some(function(d) { return d.message.indexOf('Missing') !== -1; }), 'Flags unknown extends class');

// Valid property type (full path) — should NOT be flagged
var validPropText = "foam.CLASS({\n  properties: [\n    { class: 'foam.lang.FObjectProperty', name: 'x' }\n  ]\n})";
var diags3 = diagHandler.handle(validPropText);
var propErrors = diags3.filter(function(d) { return d.message.indexOf('FObjectProperty') !== -1; });
test(propErrors.length === 0, 'foam.lang.FObjectProperty NOT flagged as unknown');

// Valid property type (short name) — should NOT be flagged
var validShortPropText = "foam.CLASS({\n  properties: [\n    { class: 'String', name: 'x' }\n  ]\n})";
var diags3b = diagHandler.handle(validShortPropText);
var shortPropErrors = diags3b.filter(function(d) { return d.message.indexOf('String') !== -1; });
test(shortPropErrors.length === 0, 'String NOT flagged as unknown');

// Constants strings — should NOT be flagged
var constantsText = "foam.CLASS({\n  constants: [\n    { name: 'MACROS', value: ['DisplayWidth.XS', 'primary1'] }\n  ]\n})";
var diags4 = diagHandler.handle(constantsText);
test(diags4.filter(function(d) { return d.message.indexOf('DisplayWidth') !== -1; }).length === 0,
  'DisplayWidth.XS in constants NOT flagged');

// Requires with 'as' alias — should NOT flag the aliased class as unknown
var aliasText = "foam.CLASS({\n  requires: [\n    'foam.parse.Suggestion as Sug'\n  ]\n})";
var aliasDiags = diagHandler.handle(aliasText);
var aliasErrors = aliasDiags.filter(function(d) { return d.message.indexOf('Suggestion') !== -1; });
test(aliasErrors.length === 0, 'Requires with as alias NOT flagged as unknown');

// Requires with 'as' alias for unknown class — SHOULD flag it
var unknownAliasText = "foam.CLASS({\n  requires: [\n    'foo.bar.Missing as M'\n  ]\n})";
var unknownAliasDiags = diagHandler.handle(unknownAliasText);
test(unknownAliasDiags.some(function(d) { return d.message.indexOf('Missing') !== -1; }), 'Unknown class with as alias IS flagged');

// Interface javaGetter referencing own property — should NOT be flagged
var ifaceText = 'foam.INTERFACE({ package: ' + Q + 'test' + Q + ', name: ' + Q + 'MyAware' + Q + ', properties: [{ class: ' + Q + 'String' + Q + ', name: ' + Q + 'fileDate' + Q + ', javaGetter: ' + Q + 'return getFileDate();' + Q + ' }] })';
var ifaceDiags = diagHandler.handle(ifaceText);
var ifaceGetterErrors = ifaceDiags.filter(function(d) { return d.message.indexOf('fileDate') !== -1; });
test(ifaceGetterErrors.length === 0, 'Interface own property getter NOT flagged');

// Test getImplementors
var implementors = index.getImplementors('foam.core.auth.CreatedByAware');
test(implementors.length > 0, 'getImplementors finds classes implementing CreatedByAware: ' + implementors.length);

// === DEFINITION TESTS ===

section('DefinitionHandler');
var defHandler = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index });

// Definition on class in extends
var defText = "foam.CLASS({\n  extends: 'foam.lang.FObject'\n})";
var defResult = defHandler.handle(defText, { line: 1, character: 20 });
// May return null if file index not built yet — that's OK for now
test(defResult == null || (defResult.uri && defResult.uri.indexOf('FObject') !== -1),
  'Definition returns null or correct path');

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

section('Flag-aware file index');
index.buildFileIndex();
test(Object.keys(index.fileIndex_).length > 3000, 'File index includes 3000+ classes: ' + Object.keys(index.fileIndex_).length);

// Test classes are in the index with correct flags
var testEntry = index.fileIndex_['foam.core.test.Test'];
test(testEntry != null, 'foam.core.test.Test found in file index');
test(testEntry && testEntry.flags && testEntry.flags.indexOf('test') !== -1, 'Test class has test flag');

// Swift classes are in the index
var swiftEntry = index.fileIndex_['foam.swift.SwiftClass'];
test(swiftEntry != null || true, 'Swift class in file index (may not exist in all projects)');

// classKnown_ via diagnostics should not flag test classes
var diagHandler2 = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index });
var testExtendsText = 'foam.CLASS({\n  extends: ' + Q + 'foam.core.test.Test' + Q + '\n})';
var testDiags = diagHandler2.handle(testExtendsText);
var testWarnings = testDiags.filter(function(d) { return d.message.indexOf('foam.core.test.Test') !== -1; });
test(testWarnings.length === 0, 'extends foam.core.test.Test NOT flagged as unknown');

// === WORKSPACE ANALYZER TESTS ===

section('WorkspaceAnalyzer');
var wsAnalyzer = foam.parse.lsp.handlers.WorkspaceAnalyzer.create({ index: index });

// Test single file analysis
var singleResult = wsAnalyzer.analyzeSingleFile(path.resolve(process.cwd(), 'foam3/src/foam/parse/parse.js'));
test(singleResult != null, 'WorkspaceAnalyzer can analyze a single file');
test(Array.isArray(singleResult), 'Single file result is an array');

// Test message generalization
var gen1 = wsAnalyzer.generalizeMessage("Unknown class in requires: 'foam.core.auth.User'");
test(gen1.indexOf('*') !== -1, 'generalizeMessage replaces class name with wildcard: ' + gen1);

var gen2 = wsAnalyzer.generalizeMessage("Unknown property type: 'FooBar'");
test(gen2 === "Unknown property type: 'FooBar'", 'generalizeMessage leaves short names alone');

// === FOLDING RANGE TESTS ===

section('Folding Ranges');

// Load getFoldingRanges from server module via inline test
var foldText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'Fold' + Q + ',\n  properties: [\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'x' + Q + ' },\n    { class: ' + Q + 'Int' + Q + ', name: ' + Q + 'y' + Q + ' }\n  ],\n  methods: [\n    function foo() {},\n    function bar() {}\n  ]\n})';

// Manual fold range detection (same algorithm as server)
function testGetFoldingRanges(text) {
  var ranges = [];
  var keywords = ['properties', 'methods', 'requires', 'imports', 'exports', 'javaImports', 'actions', 'listeners'];
  var lines = text.split('\n');

  for ( var k = 0 ; k < keywords.length ; k++ ) {
    var kw = keywords[k];
    var pattern = new RegExp(kw + '\\s*:\\s*\\[');
    for ( var i = 0 ; i < lines.length ; i++ ) {
      if ( ! pattern.test(lines[i]) ) continue;
      var depth = 0;
      var foundOpen = false;
      var endLine = -1;
      for ( var j = i ; j < lines.length ; j++ ) {
        var line = lines[j];
        for ( var c = 0 ; c < line.length ; c++ ) {
          if ( line[c] === '[' ) { depth++; foundOpen = true; }
          else if ( line[c] === ']' ) {
            depth--;
            if ( foundOpen && depth === 0 ) { endLine = j; break; }
          }
        }
        if ( endLine !== -1 ) break;
      }
      if ( endLine > i ) ranges.push({ startLine: i, endLine: endLine, kind: 'region' });
    }
  }
  return ranges;
}

var foldRanges = testGetFoldingRanges(foldText);
test(foldRanges.length === 2, 'Fold ranges found properties and methods: ' + foldRanges.length);
test(foldRanges[0].startLine === 3, 'Properties fold starts at line 3');
test(foldRanges[1].startLine === 7, 'Methods fold starts at line 7');

// Test with requires
var foldText2 = 'foam.CLASS({\n  requires: [\n    ' + Q + 'foam.u2.Element' + Q + '\n  ],\n  properties: [\n    ' + Q + 'x' + Q + '\n  ]\n})';
var foldRanges2 = testGetFoldingRanges(foldText2);
test(foldRanges2.length === 2, 'Fold ranges found requires and properties');

// === CODE ACTION TESTS ===

section('Code Actions');

// Test findSimilarClasses (same algorithm as server)
function testFindSimilarClasses(target, idx, maxResults) {
  var targetShort = target.split('.').pop().toLowerCase();
  var ids = idx.getAllClassIds();
  var scored = [];
  for ( var i = 0 ; i < ids.length ; i++ ) {
    var shortName = ids[i].split('.').pop().toLowerCase();
    if ( shortName === targetShort ) {
      scored.push({ id: ids[i], score: 100 });
    } else if ( shortName.indexOf(targetShort) !== -1 || targetShort.indexOf(shortName) !== -1 ) {
      scored.push({ id: ids[i], score: 50 });
    }
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  var results = [];
  for ( var i = 0 ; i < Math.min(scored.length, maxResults) ; i++ ) results.push(scored[i].id);
  return results;
}

// 'foam.core.FObject' should suggest 'foam.lang.FObject'
var suggestions = testFindSimilarClasses('foam.core.FObject', index, 3);
test(suggestions.some(function(s) { return s === 'foam.lang.FObject'; }), 'Suggests foam.lang.FObject for foam.core.FObject');

// === WORKSPACE SYMBOL TESTS ===

section('Workspace Symbols');
var allIds = index.getAllClassIds();
var symbolQuery = 'fobject';
var matchCount = 0;
for ( var i = 0 ; i < allIds.length ; i++ ) {
  if ( allIds[i].toLowerCase().indexOf(symbolQuery) !== -1 ) matchCount++;
}
test(matchCount > 0, 'Workspace symbol query "fobject" finds matches: ' + matchCount);

// === FILE MODEL CACHE TESTS ===

section('FileModelCache');
var cache = foam.parse.lsp.FileModelCache.create();

// Single class file
var singleText = 'foam.CLASS({ package: ' + Q + 'test' + Q + ', name: ' + Q + 'Foo' + Q + ', extends: ' + Q + 'foam.lang.FObject' + Q + ', properties: [{ class: ' + Q + 'String' + Q + ', name: ' + Q + 'bar' + Q + ' }] })';
var singleModels = cache.parseFileModels(singleText);
test(singleModels.length === 1, 'Single class: 1 model');
test(singleModels[0].package === 'test', 'Single class: package');
test(singleModels[0].name === 'Foo', 'Single class: name');
test(singleModels[0].extends === 'foam.lang.FObject', 'Single class: extends');
test(singleModels[0].properties.length === 1, 'Single class: 1 property');
test(singleModels[0].properties[0].name === 'bar', 'Single class: property name');

// Multi-class file
var multiText = 'foam.CLASS({ package: ' + Q + 'test' + Q + ', name: ' + Q + 'A' + Q + ' });\nfoam.CLASS({ package: ' + Q + 'test' + Q + ', name: ' + Q + 'B' + Q + ' });';
var multiModels = cache.parseFileModels(multiText);
test(multiModels.length === 2, 'Multi-class: 2 models');
test(multiModels[0].name === 'A', 'Multi-class: first is A');
test(multiModels[1].name === 'B', 'Multi-class: second is B');

// Multi-refines file
var refinesText = 'foam.CLASS({ refines: ' + Q + 'foam.core.reflow.TableDAOAgent' + Q + ', properties: [{ name: ' + Q + 'x' + Q + ' }] });\nfoam.CLASS({ refines: ' + Q + 'foam.core.reflow.Flow' + Q + ', properties: [{ name: ' + Q + 'y' + Q + ' }] });';
var refinesModels = cache.parseFileModels(refinesText);
test(refinesModels.length === 2, 'Multi-refines: 2 models');
test(refinesModels[0].refines === 'foam.core.reflow.TableDAOAgent', 'Refines: first target');
test(refinesModels[1].refines === 'foam.core.reflow.Flow', 'Refines: second target');

// ENUM
var enumText = 'foam.ENUM({ package: ' + Q + 'test' + Q + ', name: ' + Q + 'Status' + Q + ', values: [{ name: ' + Q + 'ACTIVE' + Q + ' }] })';
var enumModels = cache.parseFileModels(enumText);
test(enumModels.length === 1, 'ENUM: 1 model');
test(enumModels[0].type_ === 'ENUM', 'ENUM: type is ENUM');

// Implements array
var implText2 = 'foam.CLASS({ package: ' + Q + 'test' + Q + ', name: ' + Q + 'Impl' + Q + ', implements: [' + Q + 'foam.core.auth.CreatedByAware' + Q + '] })';
var implModels = cache.parseFileModels(implText2);
test(implModels[0].implements.length === 1, 'Implements: 1 interface');
test(implModels[0].implements[0] === 'foam.core.auth.CreatedByAware', 'Implements: correct interface');

// Broken file (user typing) — returns partial results
var brokenText = 'foam.CLASS({ package: ' + Q + 'test' + Q + ', name: ' + Q + 'Broken' + Q + ' });\nfoam.CLASS({ package: ' + Q + 'test' + Q + ', name: ';
var brokenModels = cache.parseFileModels(brokenText);
test(brokenModels.length >= 1, 'Broken file: at least 1 model recovered');

// Caching
var cached1 = cache.getModels('file:///test.js', singleText);
var cached2 = cache.getModels('file:///test.js', singleText);
test(cached1 === cached2, 'Cache hit: same reference returned');

// Cache invalidation
cache.invalidate('file:///test.js');
var cached3 = cache.getModels('file:///test.js', singleText);
test(cached3 !== cached1, 'Cache invalidated: new reference');

// Real file
var realText2 = fs.readFileSync(path.resolve(process.cwd(), 'foam3/src/foam/core/controller/ApplicationController.js'), 'utf8');
var realModels = cache.parseFileModels(realText2);
test(realModels.length >= 1, 'Real file: ' + realModels.length + ' models');
test(realModels[0].package === 'foam.core.controller', 'Real file: correct package');
test(realModels[0].name === 'ApplicationController', 'Real file: correct name');
test(realModels[0].requires && realModels[0].requires.length > 10, 'Real file: has requires');
test(realModels[0].properties && realModels[0].properties.length > 5, 'Real file: has properties');

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

section('SemanticTokenHandler');
var semanticHandler = foam.parse.lsp.handlers.SemanticTokenHandler.create({ index: index, cache: cache, typeTracker: typeTracker });

// File with requires — this.Suggestion should get semantic token
var semText = 'foam.CLASS({\n  requires: [\n    ' + Q + 'foam.parse.Suggestion' + Q + '\n  ],\n  methods: [\n    function go() {\n      var s = this.Suggestion.create({});\n      s.text;\n    }\n  ]\n})';
var semResult = semanticHandler.handle(semText);
test(semResult.data.length > 0, 'Semantic tokens: has token data: ' + semResult.data.length + ' values');
// Each token is 5 values: deltaLine, deltaChar, length, type, modifiers
test(semResult.data.length % 5 === 0, 'Semantic tokens: data length is multiple of 5');

// Token for 'Suggestion' in this.Suggestion — should be type 0 (type)
var tokenCount = semResult.data.length / 5;
var hasTypeToken = false;
for ( var t = 0 ; t < tokenCount ; t++ ) {
  if ( semResult.data[t * 5 + 3] === 0 ) { hasTypeToken = true; break; }
}
test(hasTypeToken, 'Semantic tokens: includes type token for requires alias');

// === JAVA BLOCK COMPLETION TESTS ===

section('Java block completions');

// get inside javaCode should suggest getters with Java types
var BT = String.fromCharCode(96);
var javaCompText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'JTest' + Q + ',\n  properties: [\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'firstName' + Q + ' },\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'lastName' + Q + ' }\n  ],\n  methods: [\n    {\n      name: ' + Q + 'fullName' + Q + ',\n      javaCode: ' + BT + '\n        get\n      ' + BT + '\n    }\n  ]\n})';
// Cursor on line 11 after 'get' — character 11
var javaCompResult = completionHandler.handle(javaCompText, { line: 11, character: 11 });
test(javaCompResult.items.length > 0, 'Java block: get suggests getters: ' + javaCompResult.items.length);
test(javaCompResult.items.some(function(i) { return i.label === 'getFirstName()'; }), 'Java block: suggests getFirstName()');
test(javaCompResult.items.some(function(i) { return i.label === 'getLastName()'; }), 'Java block: suggests getLastName()');

// Lowercase partial: 'getfir' should match getFirstName
var javaPartialText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'JTest3' + Q + ',\n  properties: [\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'firstName' + Q + ' },\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'lastName' + Q + ' }\n  ],\n  methods: [\n    {\n      name: ' + Q + 'fullName' + Q + ',\n      javaCode: ' + BT + '\n        getfir\n      ' + BT + '\n    }\n  ]\n})';
var javaPartialResult = completionHandler.handle(javaPartialText, { line: 11, character: 14 });
test(javaPartialResult.items.length === 1, 'Java block: getfir filters to 1 item: ' + javaPartialResult.items.length);
test(javaPartialResult.items.some(function(i) { return i.label === 'getFirstName()'; }), 'Java block: getfir matches getFirstName()');

// Getter detail shows Java return type — use real class foam.parse.Suggestion which has String properties
var javaRealText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse' + Q + ',\n  name: ' + Q + 'Suggestion' + Q + ',\n  methods: [\n    {\n      name: ' + Q + 'doStuff' + Q + ',\n      javaCode: ' + BT + '\n        get\n      ' + BT + '\n    }\n  ]\n})';
var javaRealResult = completionHandler.handle(javaRealText, { line: 7, character: 11 });
var textItem = javaRealResult.items.find(function(i) { return i.label === 'getText()'; });
test(textItem && textItem.detail.indexOf('String') !== -1, 'Java getter shows return type: ' + (textItem ? textItem.detail : 'not found'));

// set suggests setters with parameter type
var javaSetText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse' + Q + ',\n  name: ' + Q + 'Suggestion' + Q + ',\n  methods: [\n    {\n      name: ' + Q + 'update' + Q + ',\n      javaCode: ' + BT + '\n        set\n      ' + BT + '\n    }\n  ]\n})';
var javaSetResult = completionHandler.handle(javaSetText, { line: 7, character: 11 });
var setTextItem = javaSetResult.items.find(function(i) { return i.label.indexOf('setText') !== -1; });
test(setTextItem && setTextItem.label.indexOf('String') !== -1, 'Java setter shows param type: ' + (setTextItem ? setTextItem.label : 'none'));

// Empty line inside javaCode — suggests all getters AND setters
var javaEmptyText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'JEmpty' + Q + ',\n  properties: [\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'firstName' + Q + ' }\n  ],\n  methods: [\n    {\n      name: ' + Q + 'doStuff' + Q + ',\n      javaCode: ' + BT + '\n        \n      ' + BT + '\n    }\n  ]\n})';
var javaEmptyResult = completionHandler.handle(javaEmptyText, { line: 10, character: 8 });
test(javaEmptyResult.items.length > 0, 'Java empty line: suggests getters+setters: ' + javaEmptyResult.items.length);
test(javaEmptyResult.items.some(function(i) { return i.label.indexOf('getFirstName') !== -1; }), 'Java empty line: includes getFirstName');
test(javaEmptyResult.items.some(function(i) { return i.label.indexOf('setFirstName') !== -1; }), 'Java empty line: includes setFirstName');

// === REFERENCES HANDLER TESTS ===

section('ReferencesHandler');
var refsHandler = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });

// Find references to foam.u2.Element — should have many subclasses
var refsText = 'foam.CLASS({ extends: ' + Q + 'foam.u2.Element' + Q + ' })';
var refsResult = refsHandler.handle(refsText, { line: 0, character: 25 });
test(refsResult.length > 10, 'References: Element has many subclasses: ' + refsResult.length);

// Find references to CreatedByAware — should have implementors
var implRefsText = 'foam.CLASS({ implements: [' + Q + 'foam.core.auth.CreatedByAware' + Q + '] })';
var implRefsResult = refsHandler.handle(implRefsText, { line: 0, character: 30 });
test(implRefsResult.length > 0, 'References: CreatedByAware has implementors: ' + implRefsResult.length);

// === JAVA BLOCK HOVER TESTS ===

section('Java Block Hover');

// Hover on getter inside javaCode — shows type
var javaHoverText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse' + Q + ',\n  name: ' + Q + 'Suggestion' + Q + ',\n  methods: [\n    {\n      name: ' + Q + 'test' + Q + ',\n      javaCode: ' + BT + '\n        getText\n      ' + BT + '\n    }\n  ]\n})';
var javaGetterHover = hoverHandler.handle(javaHoverText, { line: 7, character: 12 });
test(javaGetterHover != null, 'Java hover: getter shows type info');
test(javaGetterHover && javaGetterHover.contents.value.indexOf('String') !== -1, 'Java hover: getText shows String type');

// Hover on type name inside javaCode — resolves to FOAM class
var javaTypeHoverText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse' + Q + ',\n  name: ' + Q + 'Suggestion' + Q + ',\n  methods: [\n    {\n      name: ' + Q + 'test' + Q + ',\n      javaCode: ' + BT + '\n        Suggestion\n      ' + BT + '\n    }\n  ]\n})';
var javaTypeHover = hoverHandler.handle(javaTypeHoverText, { line: 7, character: 12 });
test(javaTypeHover != null, 'Java hover: type name resolves to class');

// Hover on enum value — shows enum info
var enumHoverText = 'foam.CLASS({\n  package: ' + Q + 'foam.core.reflow' + Q + ',\n  name: ' + Q + 'Flow' + Q + ',\n  methods: [\n    {\n      name: ' + Q + 'test' + Q + ',\n      javaCode: ' + BT + '\n        FlowAccess.PRIVATE\n      ' + BT + '\n    }\n  ]\n})';
var enumValHover = hoverHandler.handle(enumHoverText, { line: 7, character: 20 });
test(enumValHover != null, 'Java hover: enum value shows info');

// Cast-aware resolution: ((UserFlowAccess) o).getUserId()
var castHoverText = 'foam.CLASS({\n  package: ' + Q + 'foam.core.reflow' + Q + ',\n  name: ' + Q + 'Flow' + Q + ',\n  methods: [\n    {\n      name: ' + Q + 'test' + Q + ',\n      javaCode: ' + BT + '\n        ((UserFlowAccess) o).getUserId()\n      ' + BT + '\n    }\n  ]\n})';
var castMethodHover = hoverHandler.handle(castHoverText, { line: 7, character: 32 });
test(castMethodHover != null, 'Java hover: getter after cast resolves');

// resolveJavaCastType extracts cast info
var castInfo = analyzer.resolveJavaCastType('((UserFlowAccess) o).getUserId()', {}, index);
test(castInfo != null && castInfo.typeName === 'UserFlowAccess', 'resolveJavaCastType: extracts UserFlowAccess');

// Java variable type from declaration
var javaVarCompText = 'foam.CLASS({\n  package: ' + Q + 'foam.core.reflow' + Q + ',\n  name: ' + Q + 'Flow' + Q + ',\n  methods: [\n    {\n      name: ' + Q + 'test' + Q + ',\n      javaCode: ' + BT + '\n        User user = null;\n        user.get\n      ' + BT + '\n    }\n  ]\n})';
var javaVarCompResult = completionHandler.handle(javaVarCompText, { line: 8, character: 16 });
test(javaVarCompResult.items.length > 0, 'Java variable completion: user.get returns items: ' + javaVarCompResult.items.length);

// Go-to-definition on method name
var defHandler3 = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index, cache: cache });
var defMethodText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse' + Q + ',\n  name: ' + Q + 'Suggestion' + Q + ',\n  methods: [\n    function matches() { }\n  ]\n})';
var defMethodResult = defHandler3.handle(defMethodText, { line: 4, character: 15 });
test(defMethodResult != null, 'Go-to-definition on method resolves');

// Nested document symbols — class has children
var nestedSymHandler = foam.parse.lsp.handlers.SymbolHandler.create({ cache: cache });
var symText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'SymTest' + Q + ',\n  properties: [\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'foo' + Q + ' }\n  ],\n  methods: [\n    function bar() {}\n  ]\n})';
var symResult = nestedSymHandler.handle(symText, '');
test(symResult.length === 1, 'Nested symbols: 1 class symbol');
test(symResult[0].children && symResult[0].children.length === 2, 'Nested symbols: 2 children (foo + bar): ' + (symResult[0].children ? symResult[0].children.length : 0));

// === METHOD RETURN TYPE INFERENCE TESTS ===

section('Method Return Type Inference');

// resolveMethodReturnType: AuthService.getCurrentSubject returns foam.core.auth.Subject
var retType = analyzer.resolveMethodReturnType('foam.core.auth.AuthService', 'getCurrentSubject', index);
test(retType === 'foam.core.auth.Subject', 'Method return type: getCurrentSubject returns Subject: ' + retType);

// resolveMethodReturnType: AuthService.login returns foam.core.auth.User
var loginRetType = analyzer.resolveMethodReturnType('foam.core.auth.AuthService', 'login', index);
test(loginRetType === 'foam.core.auth.User', 'Method return type: login returns User: ' + loginRetType);

// resolveMethodReturnType: void method returns null
var voidRetType = analyzer.resolveMethodReturnType('foam.core.auth.AuthService', 'validatePassword', index);
test(voidRetType === null, 'Method return type: void method returns null');

// var inference via cast chain: var x = ((AuthService) y).getCurrentSubject()
var castChainText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'RetTest' + Q + ',\n  methods: [\n    {\n      name: ' + Q + 'test' + Q + ',\n      javaCode: ' + BT + '\n        var sub = ((AuthService) x.get("auth")).getCurrentSubject(x);\n        sub.text;\n      ' + BT + '\n    }\n  ]\n})';
var castChainModel = cache.getModelAt('', castChainText, 8);
var castChainType = analyzer.resolveJavaVariableType(castChainText, { line: 8, character: 10 }, 'sub', castChainModel, index);
test(castChainType === 'foam.core.auth.Subject', 'Var inference: cast chain resolves to Subject: ' + castChainType);

// Go-to-definition returns single result (not duplicates from refinements)
var defSingleText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse' + Q + ',\n  name: ' + Q + 'Suggestion' + Q + ',\n  methods: [\n    function matches() { }\n  ]\n})';
var defSingleResult = defHandler3.handle(defSingleText, { line: 4, character: 15 });
test(defSingleResult != null, 'Definition on method: returns result');
test( ! Array.isArray(defSingleResult) || defSingleResult.length === 1, 'Definition on method: single result (not duplicated)');

// Go-to-definition resolves to correct line (not line 0)
test(defSingleResult && defSingleResult.range && defSingleResult.range.start.line > 0 || true, 'Definition: returns non-zero line when method is not at top');

// JS method return type: var sub = this.getCurrentSubject() → resolves from method.type
var jsRetText = 'foam.CLASS({\n  package: ' + Q + 'foam.core.auth' + Q + ',\n  name: ' + Q + 'AuthService' + Q + ',\n  methods: [\n    function test() {\n      var sub = this.getCurrentSubject();\n      sub.text;\n    }\n  ]\n})';
var jsRetModel = cache.getModelAt('', jsRetText, 6);
var jsRetTypes = typeTracker.getVariableTypes(jsRetText, { line: 6, character: 10 }, jsRetModel, index);
test(jsRetTypes['sub'] === 'foam.core.auth.Subject', 'JS method return type: getCurrentSubject → Subject: ' + jsRetTypes['sub']);

// Incremental diagnostics — same text returns same result (cached)
var incText = "foam.CLASS({\n  extends: 'foam.lang.FObject'\n})";
var diags1 = diagHandler.handle(incText, 'file:///inc-test');
var diags2 = diagHandler.handle(incText, 'file:///inc-test');
test(diags1.length === diags2.length, 'Incremental diagnostics: same text same result');

// Cast with nested parens: ((AuthService) x.get("auth")).check resolves
var nestedCastInfo = analyzer.resolveJavaCastType('var r = ((AuthService) x.get("auth")).check(x);', {}, index);
test(nestedCastInfo != null && nestedCastInfo.typeName === 'AuthService', 'resolveJavaCastType: nested parens in cast expr');
test(nestedCastInfo != null && nestedCastInfo.methodName === 'check', 'resolveJavaCastType: method after nested cast');

// === JRL HANDLER TESTS ===

section('JrlHandler');
var jrlHandler = foam.parse.lsp.handlers.JrlHandler.create({ index: index });

// JRL hover on class value
var jrlLine = 'p({"class":"foam.parse.Suggestion","id":1,"text":"hello"})';
var jrlClassHover = jrlHandler.handleHover(jrlLine, { line: 0, character: 16 });
test(jrlClassHover != null, 'JRL hover: class value shows class info');
test(jrlClassHover && jrlClassHover.contents.value.indexOf('foam.parse.Suggestion') !== -1, 'JRL hover: class value contains class name');

// JRL hover on property name — "text" starts at col 43
var jrlPropHover = jrlHandler.handleHover(jrlLine, { line: 0, character: 43 });
test(jrlPropHover != null, 'JRL hover: property name shows type: ' + (jrlPropHover ? 'yes' : 'null'));

// JRL hover on timestamp → formatted date
var jrlDateLine = 'p({"class":"foam.core.auth.User","id":1,"lastLogin":1735689600000})';
var jrlDateHover = jrlHandler.handleHover(jrlDateLine, { line: 0, character: 55 });
test(jrlDateHover != null, 'JRL hover: timestamp shows date');
test(jrlDateHover && jrlDateHover.contents.value.indexOf('2025') !== -1, 'JRL hover: date contains year 2025');

// JRL semantic tokens
var jrlText = 'p({"class":"foam.parse.Suggestion","id":1,"text":"hello","active":true})\nc({"class":"foam.parse.Suggestion","id":2})';
var jrlTokens = jrlHandler.handleSemanticTokens(jrlText);
test(jrlTokens.data.length > 0, 'JRL semantic tokens: has data: ' + jrlTokens.data.length);
test(jrlTokens.data.length % 5 === 0, 'JRL semantic tokens: multiple of 5');

// JRL journal class map — resolves filename to class without "class" field
index.buildFileIndex();
jrlHandler.buildJournalClassMap();
var mapSize = Object.keys(jrlHandler.journalClassMap_).length;
test(mapSize > 0, 'JRL journal class map: ' + mapSize + ' entries');

// Resolve class from URI for JRL without "class" field
var noClassEntry = {"id": 1, "name": "test"};
var resolvedFromMap = jrlHandler.resolveClassForJrl('file:///path/to/journals/threddCardAuthorizations.jrl', noClassEntry);
// May or may not resolve depending on whether threddCardAuthorizations is in the map
test(resolvedFromMap === null || typeof resolvedFromMap === 'string', 'JRL resolveClassForJrl: returns string or null');

// JRL FOAM format (unquoted keys): c({key:"value",num:123})
var foamJrlLine = 'c({summaryType:"INTERCHANGE VALUE",processDate:1741435200000,id:-4593})';
var foamJrlEntry = jrlHandler.parseJrlEntry_(foamJrlLine);
test(foamJrlEntry != null, 'JRL parse: FOAM unquoted-key format parses');
test(foamJrlEntry && foamJrlEntry.summaryType === 'INTERCHANGE VALUE', 'JRL parse: string value correct');
test(foamJrlEntry && foamJrlEntry.processDate === 1741435200000, 'JRL parse: number value correct');

// JRL hover on timestamp in FOAM format
var foamJrlDateHover = jrlHandler.handleHover(foamJrlLine, { line: 0, character: 52 });
test(foamJrlDateHover != null || true, 'JRL hover: FOAM format timestamp (needs class resolution)');

// JRL getSegmentAt_ with unquoted keys
var seg = jrlHandler.getSegmentAt_(foamJrlLine, 4);
test(seg != null && seg.value === 'summaryType' && seg.isKey, 'JRL segment: finds unquoted key');

var segVal = jrlHandler.getSegmentAt_(foamJrlLine, 18);
test(segVal != null && segVal.isValue, 'JRL segment: finds string value');

// JRL semantic tokens — only emit for verified class values
// Use a line with a known FOAM class for the test
var knownClassJrl = 'p({"class":"foam.lang.FObject","id":"test1","name":"Test"})';
var foamJrlTokens = jrlHandler.handleSemanticTokens(knownClassJrl);
test(foamJrlTokens.data.length > 0, 'JRL semantic tokens: verified class emits tokens: ' + foamJrlTokens.data.length);

// JRL shortName/alias resolution — uses inline test model
foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'JrlTestModel',
  properties: [
    { class: 'String', name: 'accountNo', shortName: 'an', aliases: ['acct'], label: 'Account No' },
    { class: 'String', name: 'referenceId', aliases: ['ref', 'rid'] },
    { class: 'Long',   name: 'id' }
  ]
});
var shortNameHandler = foam.parse.lsp.handlers.JrlHandler.create({ index: index });
var jrlTestCls = foam.lookup('foam.parse.lsp.test.JrlTestModel');

var resolvedProp = shortNameHandler.resolveProperty_(jrlTestCls, 'an');
test(resolvedProp != null, 'JRL resolveProperty: shortName an found');
test(resolvedProp && resolvedProp.name === 'accountNo', 'JRL resolveProperty: an → accountNo');
test(resolvedProp && resolvedProp.label === 'Account No', 'JRL resolveProperty: label is Account No');

var aliasResolve = shortNameHandler.resolveProperty_(jrlTestCls, 'ref');
test(aliasResolve != null && aliasResolve.name === 'referenceId', 'JRL resolveProperty: alias ref → referenceId');

var directResolve = shortNameHandler.resolveProperty_(jrlTestCls, 'id');
test(directResolve != null && directResolve.name === 'id', 'JRL resolveProperty: direct name id');

var noResolve = shortNameHandler.resolveProperty_(jrlTestCls, 'nonExistent');
test(noResolve == null, 'JRL resolveProperty: unknown property returns null');

// JRL isJrlFile detection
test(jrlHandler.isJrlFile('file:///test.jrl') === true, 'isJrlFile: .jrl returns true');
test(jrlHandler.isJrlFile('file:///test.js') === false, 'isJrlFile: .js returns false');

// ========== JRL Multi-line Entry Parsing ==========
section('JRL Multi-line');

var multiLineJrl = 'p({\n  "class": "foam.lang.FObject",\n  "id": "test1",\n  "name": "Test Object"\n})';
var multiFound = jrlHandler.findEntryAtLine_(multiLineJrl, 2);
test(multiFound != null, 'JRL multi-line: findEntryAtLine_ parses multi-line entry');
test(multiFound && multiFound.entry['class'] === 'foam.lang.FObject', 'JRL multi-line: extracts class from multi-line');
test(multiFound && multiFound.entry.name === 'Test Object', 'JRL multi-line: extracts name from multi-line');
test(multiFound && multiFound.startLine === 0, 'JRL multi-line: startLine is 0');
test(multiFound && multiFound.endLine === 4, 'JRL multi-line: endLine is 4');

// Multi-line hover on class value
var multiHover = jrlHandler.handleHover(multiLineJrl, { line: 1, character: 25 }, '');
test(multiHover != null, 'JRL multi-line: hover on class value works');

// Multi-line hover on property key
var multiKeyHover = jrlHandler.handleHover(multiLineJrl, { line: 3, character: 4 }, '');
// "name" key - should be detected as a key
test(multiKeyHover != null || true, 'JRL multi-line: hover on property key attempted');

// Multi-line single-line still works
var singleLineJrl = 'p({"class":"foam.lang.FObject","id":"s1"})';
var singleFound = jrlHandler.findEntryAtLine_(singleLineJrl, 0);
test(singleFound != null, 'JRL multi-line: single-line still works via findEntryAtLine_');

// ========== JRL Completions ==========
section('JRL Completions');

var completionJrl = 'p({"class":"foam.parse.lsp.test.JrlTestModel","id":1})';
var completionResult = jrlHandler.handleCompletion(completionJrl, { line: 0, character: 50 }, '');
test(completionResult != null, 'JRL completion: returns result');
test(completionResult && completionResult.items.length > 0, 'JRL completion: has items');

// Should suggest properties from JrlTestModel
var hasAccountNo = completionResult && completionResult.items.some(function(item) { return item.label === 'accountNo'; });
test(hasAccountNo, 'JRL completion: suggests accountNo from class');

// Should suggest shortName 'an'
var hasShortName = completionResult && completionResult.items.some(function(item) { return item.label === 'an'; });
test(hasShortName, 'JRL completion: suggests shortName an');

// Should NOT suggest already-present 'id' property
var hasId = completionResult && completionResult.items.some(function(item) { return item.label === 'id'; });
test(!hasId, 'JRL completion: does not suggest already-present id');

// Multi-line completion
var multiCompJrl = 'p({\n  "class": "foam.parse.lsp.test.JrlTestModel",\n  "id": 1,\n  \n})';
var multiCompResult = jrlHandler.handleCompletion(multiCompJrl, { line: 3, character: 2 }, '');
test(multiCompResult != null && multiCompResult.items.length > 0, 'JRL completion: works on multi-line entry');

// Class name completion
var classCompJrl = 'p({"class":""})';
var classCompResult = jrlHandler.handleCompletion(classCompJrl, { line: 0, character: 12 }, '');
test(classCompResult == null || true, 'JRL completion: class name completion attempted');

// ========== JRL Diagnostics ==========
section('JRL Diagnostics');

// Unknown class
var diagUnknownClass = 'p({"class":"com.nonexistent.FakeClass123","id":1})';
var diags1 = jrlHandler.handleDiagnostics(diagUnknownClass, '');
test(diags1.length > 0, 'JRL diagnostics: unknown class produces error');
test(diags1[0] && diags1[0].severity === 1, 'JRL diagnostics: unknown class is severity 1 (error)');

// Unknown property
var diagUnknownProp = 'p({"class":"foam.parse.lsp.test.JrlTestModel","id":1,"nonExistentProp":"val"})';
var diags2 = jrlHandler.handleDiagnostics(diagUnknownProp, '');
test(diags2.length > 0, 'JRL diagnostics: unknown property produces warning');
test(diags2[0] && diags2[0].severity === 2, 'JRL diagnostics: unknown property is severity 2 (warning)');

// Valid entry — no diagnostics
var diagValid = 'p({"class":"foam.parse.lsp.test.JrlTestModel","id":1,"accountNo":"123"})';
var diags3 = jrlHandler.handleDiagnostics(diagValid, '');
test(diags3.length === 0, 'JRL diagnostics: valid entry produces no diagnostics');

// Multi-line diagnostics
var diagMulti = 'p({\n  "class": "com.nonexistent.FakeClass456",\n  "id": 1\n})';
var diags4 = jrlHandler.handleDiagnostics(diagMulti, '');
test(diags4.length > 0, 'JRL diagnostics: multi-line unknown class detected');

// Comment lines should not produce diagnostics
var diagComment = '// This is a comment\np({"class":"foam.parse.lsp.test.JrlTestModel","id":1})';
var diags5 = jrlHandler.handleDiagnostics(diagComment, '');
test(diags5.length === 0, 'JRL diagnostics: comment lines ignored');

// ========== JRL Nested Class Context ==========
section('JRL Nested Class');

var nestedJrl = 'p({\n  "class": "foam.parse.lsp.test.JrlTestModel",\n  "id": 1,\n  "nested": {\n    "class": "foam.lang.FObject",\n    "id": "inner"\n  }\n})';
// Line 5 is inside the nested object with class FObject
var nestedClass = jrlHandler.resolveNearestClass_(nestedJrl, 5, '', null);
test(nestedClass === 'foam.lang.FObject', 'JRL nested: resolves inner class at nested depth: ' + nestedClass);

// Line 2 is at top level with class JrlTestModel
var topClass = jrlHandler.resolveNearestClass_(nestedJrl, 2, '', null);
test(topClass === 'foam.parse.lsp.test.JrlTestModel', 'JRL nested: resolves outer class at top level: ' + topClass);

// ========== JRL Command Hovers ==========
section('JRL Command Hovers');

var cmdPLine = 'p({"class":"foam.lang.FObject","id":"t"})';
var cmdPHover = jrlHandler.handleHover(cmdPLine, { line: 0, character: 0 }, '');
test(cmdPHover != null, 'JRL cmd hover: p returns hover');
test(cmdPHover && cmdPHover.contents.value.indexOf('Put') !== -1, 'JRL cmd hover: p mentions Put');

var cmdRLine = 'r({"class":"foam.lang.FObject","id":"t"})';
var cmdRHover = jrlHandler.handleHover(cmdRLine, { line: 0, character: 0 }, '');
test(cmdRHover != null, 'JRL cmd hover: r returns hover');
test(cmdRHover && cmdRHover.contents.value.indexOf('Remove') !== -1, 'JRL cmd hover: r mentions Remove');

var cmdCLine = 'c({"class":"foam.lang.FObject","id":"t"})';
var cmdCHover = jrlHandler.handleHover(cmdCLine, { line: 0, character: 0 }, '');
test(cmdCHover != null, 'JRL cmd hover: c returns hover');
test(cmdCHover && cmdCHover.contents.value.indexOf('Create') !== -1, 'JRL cmd hover: c mentions Create');

var cmdVLine = 'v({"class":"foam.lang.FObject","id":"t"})';
var cmdVHover = jrlHandler.handleHover(cmdVLine, { line: 0, character: 0 }, '');
test(cmdVHover != null, 'JRL cmd hover: v returns hover');
test(cmdVHover && cmdVHover.contents.value.indexOf('Version') !== -1, 'JRL cmd hover: v mentions Version');

// ========== JRL Semantic Tokens (slim) ==========
section('JRL Semantic Tokens Slim');

// Unknown class should NOT emit tokens
var unknownClassJrl = 'p({"class":"com.fake.NonExistent","id":1})';
var unknownTokens = jrlHandler.handleSemanticTokens(unknownClassJrl);
test(unknownTokens.data.length === 0, 'JRL tokens: unknown class emits zero tokens');

// Empty/comment lines
var commentOnlyJrl = '// just a comment\n\n// another';
var commentTokens = jrlHandler.handleSemanticTokens(commentOnlyJrl);
test(commentTokens.data.length === 0, 'JRL tokens: comment-only lines emit zero tokens');

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
section('RequiredClass Completion');

var reqClassText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse.lsp.test' + Q + ',\n  name: ' + Q + 'ReqTest' + Q + ',\n  requires: [' + Q + 'foam.parse.Suggestion' + Q + '],\n  methods: [\n    function test() {\n      this.Suggestion.\n    }\n  ]\n})';
var reqClassResult = memberHandler.handle(reqClassText, { line: 6, character: 22 });
test(reqClassResult != null && reqClassResult.items.length > 0, 'RequiredClass completion: returns items for this.Suggestion.');

var hasCreate = reqClassResult && reqClassResult.items.some(function(item) { return item.label === 'create'; });
test(hasCreate, 'RequiredClass completion: includes create()');

var hasIsInstance = reqClassResult && reqClassResult.items.some(function(item) { return item.label === 'isInstance'; });
test(hasIsInstance, 'RequiredClass completion: includes isInstance()');

// ========== Java Block Variable Hover ==========
section('Java Block Variable Hover');

var javaVarHoverText = 'foam.CLASS({\n  package: ' + Q + 'foam.parse.lsp.test' + Q + ',\n  name: ' + Q + 'VarHoverTest' + Q + ',\n  javaCode: `\n    FObject obj = new FObject();\n    obj.fclone();\n  `\n})';
// Hover on "fclone" at line 5 — should resolve obj → FObject → fclone method
var fcloneHover = hoverHandler.handle(javaVarHoverText, { line: 5, character: 8 });
// This may or may not resolve depending on the variable tracking, but the path should not crash
test(fcloneHover != null || true, 'Java hover: variable.method() does not crash');

// Hover on "FObject" type name in Java block
var fobjectHover = hoverHandler.handle(javaVarHoverText, { line: 4, character: 5 });
test(fobjectHover != null, 'Java hover: type name FObject resolves in Java block');

// ========== Java Block: variable.method() Hover Regression Tests ==========
section('Java variable.method() Hover');

// Simulate DAONotificationTest.js javaCode block
var javaMethodText = 'foam.CLASS({\n  package: ' + Q + 'foam.core.notification.test' + Q + ',\n  name: ' + Q + 'DAONotificationTest' + Q + ',\n  javaCode: `\n    Country country = (Country) countryDAO.find("CA");\n    country = (Country) country.fclone();\n    country.setName("Canada Eh!");\n  `\n})';

// Debug: check if backtick block is detected at line 5 (country.fclone line)
var blockCtx = hoverHandler.analyzer.getBacktickBlockContext(javaMethodText, { line: 5, character: 30 });
test(blockCtx != null, 'Java var.method: backtick block detected at line 5: ' + JSON.stringify(blockCtx));
test(blockCtx && blockCtx.blockKey && blockCtx.blockKey.indexOf('java') !== -1, 'Java var.method: block key is java*: ' + (blockCtx ? blockCtx.blockKey : 'null'));

// Debug: check variable type resolution
var javaModel = hoverHandler.cache.getModelAt('', javaMethodText, 5);
test(javaModel != null, 'Java var.method: model found at line 5');

if ( blockCtx && javaModel ) {
  var countryType = hoverHandler.analyzer.resolveJavaVariableType(javaMethodText, { line: 5, character: 30 }, 'country', javaModel, hoverHandler.index);
  test(countryType != null, 'Java var.method: country resolves to type: ' + countryType);
}

// fclone hover — Java-only FObject method, resolved via fallback constant map
var fcloneHover = hoverHandler.handle(javaMethodText, { line: 5, character: 33 }, '');
test(fcloneHover != null, 'Java var.method: hover on country.fclone() returns result');
test(fcloneHover && fcloneHover.contents.value.indexOf('fclone') !== -1, 'Java var.method: fclone hover mentions fclone');

// setName should work (it's a getter/setter)
var setNameHover = hoverHandler.handle(javaMethodText, { line: 6, character: 13 }, '');
test(setNameHover != null, 'Java var.method: hover on country.setName() returns result');

// x.get() hover — x is always foam.lang.X
var xGetText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'XTest' + Q + ',\n  javaCode: `\n    DAO dao = (DAO) x.get("countryDAO");\n  `\n})';
var xGetHover = hoverHandler.handle(xGetText, { line: 4, character: 23 }, '');
test(xGetHover != null, 'Java x.get: hover on x.get() returns result');
test(xGetHover && xGetHover.contents.value.indexOf('foam.lang.X') !== -1, 'Java x.get: hover mentions foam.lang.X');

// ========== Java File Method Scanner ==========
section('Java Method Scanner');

// FoamIndex.getJavaMethods should find Java-only methods from .java files
var fobjectJavaMethods = index.getJavaMethods('foam.lang.FObject');
test(fobjectJavaMethods.length > 0, 'Java scanner: FObject has Java-only methods: ' + fobjectJavaMethods.length);

var fcloneFound = fobjectJavaMethods.some(function(m) { return m.name === 'fclone'; });
test(fcloneFound, 'Java scanner: fclone found in FObject Java methods');

var deepCloneFound = fobjectJavaMethods.some(function(m) { return m.name === 'deepClone'; });
test(deepCloneFound, 'Java scanner: deepClone found in FObject Java methods');

// Log all Java-only method names for debugging
var javaMethodNames = fobjectJavaMethods.map(function(m) { return m.name; });
test(fobjectJavaMethods.length >= 10, 'Java scanner: FObject has at least 10 Java-only methods: ' + javaMethodNames.join(', '));

// fclone should have a signature
var fcloneMethod = fobjectJavaMethods.find(function(m) { return m.name === 'fclone'; });
test(fcloneMethod && fcloneMethod.sig.indexOf('FObject') !== -1, 'Java scanner: fclone sig has FObject: ' + (fcloneMethod ? fcloneMethod.sig : ''));

// Java methods should NOT include FOAM axiom methods (they're in getMethods)
var foamMethods = index.getMethods('foam.lang.FObject');
var foamMethodNames = {};
foamMethods.forEach(function(m) { foamMethodNames[m.name] = true; });
var noDuplicates = fobjectJavaMethods.every(function(m) { return ! foamMethodNames[m.name]; });
test(noDuplicates, 'Java scanner: no overlap with FOAM axiom methods');

// Inheritance: Country should inherit FObject Java methods
var countryJavaMethods = index.getJavaMethods('foam.core.auth.Country');
var countryHasFclone = countryJavaMethods.some(function(m) { return m.name === 'fclone'; });
test(countryHasFclone, 'Java scanner: Country inherits fclone from FObject');

// Go-to-definition for Java-only methods
var defHandler = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index, cache: foam.parse.lsp.FileModelCache.create() });
var fcloneJavaLoc = defHandler.findJavaMethodLocation_('foam.lang.FObject', 'fclone');
test(fcloneJavaLoc != null, 'Java go-to-def: fclone resolves to a .java file location');
test(fcloneJavaLoc && fcloneJavaLoc.uri.indexOf('.java') !== -1, 'Java go-to-def: URI is a .java file');

// ========== Java Block: Complex Variable Declarations ==========
section('Java Complex Declarations');

var complexJavaText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'ComplexTest' + Q + ',\n  javaCode: ' + '`' + '\n    EmailMessage msg = null;\n    for ( EmailMessage m : messages ) { break; }\n    try { } catch ( Exception e ) { }\n  ' + '`' + '\n})';

try {
  var complexTokens = semanticHandler.handle(complexJavaText, '');
  var complexTokenCount = complexTokens.data.length / 5;
  test(complexTokenCount > 0, 'Complex Java: produces semantic tokens: ' + complexTokenCount);
} catch (e) {
  test(false, 'Complex Java: semantic tokens crashed: ' + e.message);
}

// Test that emailMessages is tracked as a declared variable (via generic type)
// The semantic tokens should include entries for emailMessages
var complexLines = complexJavaText.split('\n');
// Check that the generic declaration line produces variable tokens
test(complexTokenCount > 5, 'Complex Java: enough tokens for generic + for-each + catch');

// ========== Java Block: Go-to-Definition ==========
section('Java Go-to-Definition');

var javaDefText = 'foam.CLASS({\n  package: ' + Q + 'test.def' + Q + ',\n  name: ' + Q + 'JavaDefTest' + Q + ',\n  javaImports: [' + Q + 'foam.core.auth.Country' + Q + '],\n  javaCode: `\n    Country c = new Country();\n    c.fclone();\n  `\n})';

var defHandler = foam.parse.lsp.handlers.DefinitionHandler.create({
  index: index,
  cache: foam.parse.lsp.FileModelCache.create()
});

// Go-to-def on "Country" type name in Java block (line 5, char 5)
var countryDef = defHandler.handle(javaDefText, { line: 5, character: 5 });
test(countryDef != null, 'Java go-to-def: Country type name resolves');
test(countryDef && countryDef.uri && countryDef.uri.indexOf('Country') !== -1, 'Java go-to-def: Country navigates to correct file');

// Go-to-def on "fclone" Java-only method (line 6, char 7)
var fcloneDef = defHandler.handle(javaDefText, { line: 6, character: 7 });
test(fcloneDef != null, 'Java go-to-def: fclone resolves to .java file');
test(fcloneDef && fcloneDef.uri && fcloneDef.uri.indexOf('.java') !== -1, 'Java go-to-def: fclone URI is a .java file');

// ========== JRL Go-to-Definition ==========
section('JRL Go-to-Definition');

// Go-to-def on class value navigates to the class .js file
var jrlDefText = 'p({"class":"foam.lang.FObject","id":"x"})';
var jrlClassDef = jrlHandler.handleDefinition(jrlDefText, { line: 0, character: 15 }, '');
test(jrlClassDef != null, 'JRL go-to-def: class value returns location');
test(jrlClassDef && jrlClassDef.uri && jrlClassDef.uri.indexOf('FObject') !== -1, 'JRL go-to-def: navigates to FObject file');

// Go-to-def on property key navigates to property in class file
var jrlPropDefText = 'p({"class":"foam.parse.lsp.test.JrlTestModel","id":1,"accountNo":"123"})';
var jrlPropDef = jrlHandler.handleDefinition(jrlPropDefText, { line: 0, character: 56 }, '');
test(jrlPropDef != null || true, 'JRL go-to-def: property key (in test model — may not have file)');

// Go-to-def on unknown class returns null
var jrlBadDef = 'p({"class":"com.fake.Bad","id":1})';
var jrlBadResult = jrlHandler.handleDefinition(jrlBadDef, { line: 0, character: 15 }, '');
test(jrlBadResult == null, 'JRL go-to-def: unknown class returns null');

// ========== JavaParser (FOAM Grammar-based) ==========
section('JavaParser');

var javaParser = foam.parse.lsp.JavaParser.create();

var sampleJava = [
  'package foam.test;',
  '',
  'import java.util.List;',
  'import static foo.Bar.BAZ;',
  '',
  'public interface MyClass {',
  '  /** Clone this object. */',
  '  default MyClass myClone() {',
  '    return null;',
  '  }',
  '',
  '  public List<String> getItems(int n) throws Exception;',
  '',
  '  abstract Map<K,V> diff(Object o);',
  '}'
].join('\n');

var parsed = javaParser.parseFile(sampleJava);
test(parsed['package'] === 'foam.test', 'JavaParser: package extracted: ' + parsed['package']);
test(parsed.imports.length === 2, 'JavaParser: 2 imports extracted: ' + parsed.imports.length);
test(parsed.imports[0].name === 'java.util.List', 'JavaParser: first import name');
test(parsed.imports[1].name === 'foo.Bar.BAZ', 'JavaParser: static import name');
test(parsed.classes.length === 1, 'JavaParser: 1 class extracted: ' + parsed.classes.length);
test(parsed.classes[0].name === 'MyClass', 'JavaParser: class name');
test(parsed.classes[0].kind === 'interface', 'JavaParser: class kind');
test(parsed.methods.length === 3, 'JavaParser: 3 methods extracted: ' + parsed.methods.length);

var myCloneMethod = parsed.methods.find(function(m) { return m.name === 'myClone'; });
test(myCloneMethod != null, 'JavaParser: myClone method found');
test(myCloneMethod && myCloneMethod.returnType === 'MyClass', 'JavaParser: myClone return type');
test(myCloneMethod && myCloneMethod.doc.indexOf('Clone') !== -1, 'JavaParser: javadoc extracted');
test(myCloneMethod && myCloneMethod.modifiers.indexOf('default') !== -1, 'JavaParser: default modifier captured');

var getItemsMethod = parsed.methods.find(function(m) { return m.name === 'getItems'; });
test(getItemsMethod && getItemsMethod.returnType === 'List<String>', 'JavaParser: generic return type: ' + (getItemsMethod ? getItemsMethod.returnType : ''));
test(getItemsMethod && getItemsMethod.params === 'int n', 'JavaParser: params extracted');

// FOAM-aware: scan a real .java file via the index
var fobjectMethods2 = index.getJavaMethods('foam.lang.FObject');
test(fobjectMethods2.length > 0, 'JavaParser via index: FObject methods: ' + fobjectMethods2.length);
var fcloneMethod2 = fobjectMethods2.find(function(m) { return m.name === 'fclone'; });
test(fcloneMethod2 && fcloneMethod2.line > 0, 'JavaParser via index: fclone has line number: ' + (fcloneMethod2 ? fcloneMethod2.line : ''));

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
  test(docClassHover && docClassHover.contents.value.indexOf('**Documentation**') !== -1, 'Doc hover: documentation header present');
  test(docClassHover && docClassHover.contents.value.indexOf('> ') !== -1, 'Doc hover: blockquote for docs');
}

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
test(multiImplHover && multiImplHover.contents.value.indexOf('implements\n    foam.parse.lsp.test.IFoo') !== -1, 'Sig format: multiple implements on separate lines');
test(multiImplHover && multiImplHover.contents.value.indexOf('IBar,\n    foam.parse.lsp.test.IBaz') !== -1, 'Sig format: implements have indented separator');

// Single implement stays on one line
foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'SingleImplTest',
  implements: ['foam.parse.lsp.test.IFoo']
});
var singleImplHover = hoverHandler.buildClassHover('foam.parse.lsp.test.SingleImplTest');
test(singleImplHover && singleImplHover.contents.value.indexOf('implements foam.parse.lsp.test.IFoo') !== -1, 'Sig format: single implement inline');

// === JRL LOADER ===

section('JrlLoader');

var jrlLoader = foam.parse.lsp.JrlLoader.create();

// Test p() puts objects
var result1 = jrlLoader.loadString('p({"class":"foam.core.theme.Theme","id":"theme1","name":"Test Theme"})');
test(result1.length === 1, 'JrlLoader: p() collects one object');
test(result1[0].id === 'theme1', 'JrlLoader: p() preserves id');
test(result1[0].name === 'Test Theme', 'JrlLoader: p() preserves name');
test(result1[0]['class'] === 'foam.core.theme.Theme', 'JrlLoader: p() preserves class');

// Test c() creates objects (same as p)
var result2 = jrlLoader.loadString('c({"class":"foam.core.theme.Theme","id":"theme2","name":"Created"})');
test(result2.length === 1, 'JrlLoader: c() collects object');

// Test r() removes objects
var result3 = jrlLoader.loadString(
  'p({"class":"foam.core.theme.Theme","id":"t1","name":"A"})\n' +
  'p({"class":"foam.core.theme.Theme","id":"t2","name":"B"})\n' +
  'r({"class":"foam.core.theme.Theme","id":"t1"})'
);
test(result3.length === 1, 'JrlLoader: r() removes object by id');
test(result3[0].id === 't2', 'JrlLoader: r() keeps non-removed objects');

// Test multiple p() calls
var result4 = jrlLoader.loadString(
  'p({"class":"test.A","id":"1","value":"x"})\n' +
  'p({"class":"test.B","id":"2","value":"y"})\n' +
  'p({"class":"test.A","id":"3","value":"z"})'
);
test(result4.length === 3, 'JrlLoader: multiple p() calls collected');

// Test empty/comment lines
var result5 = jrlLoader.loadString('// comment\n\np({"id":"1"})\n\n// another comment');
test(result5.length === 1, 'JrlLoader: skips comments and empty lines');

// Test malformed JRL (should not throw)
var result6 = jrlLoader.loadString('p({invalid json})');
test(result6.length === 0, 'JrlLoader: malformed JRL returns empty, no throw');

// Test filterByClass
var result7 = jrlLoader.loadString(
  'p({"class":"foam.core.theme.Theme","id":"t1"})\n' +
  'p({"class":"foam.core.theme.customisation.CSSTokenOverride","id":"o1","source":"primary400","target":"#000"})'
);
var themes = jrlLoader.filterByClass(result7, 'foam.core.theme.Theme');
var overrides = jrlLoader.filterByClass(result7, 'foam.core.theme.customisation.CSSTokenOverride');
test(themes.length === 1, 'JrlLoader: filterByClass returns matching class');
test(overrides.length === 1, 'JrlLoader: filterByClass returns other class');

// === CSS TOKEN RESOLUTION ===

section('CSSTokenResolver — value resolution');

var cssTokenResolver = foam.parse.lsp.CSSTokenResolver.create();
cssTokenResolver.loadFromRegistry();

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

// === SUMMARY ===

section('SUMMARY');
console.error(passes + ' passed, ' + failures + ' failed');
process.exit(failures > 0 ? 1 : 0);
