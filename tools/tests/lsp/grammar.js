/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// Split from testFoamLSP.js — grammar tests.
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



// === CURSOR SENTINEL ===
section('CursorSentinel');

var sentinelCS = foam.parse.lsp.CursorSentinel.create();

var ins1 = sentinelCS.insertAt('hello world', { line: 0, character: 4 });
test(ins1.text.indexOf(sentinelCS.CHAR) === 0, 'Sentinel replaces word under cursor at start');
test(ins1.offset === 0, 'Sentinel offset reported correctly (word replaced)');

var ins1b = sentinelCS.insertAt('hello  world', { line: 0, character: 6 });
test(ins1b.text === 'hello ' + sentinelCS.CHAR + ' world',
  'Sentinel inserts at whitespace-only position');
test(ins1b.offset === 6, 'Sentinel offset at whitespace-only position is correct');

var ins1c = sentinelCS.insertAt('hello world', { line: 0, character: 5 });
test(ins1c.text === sentinelCS.CHAR + ' world',
  'Sentinel replaces preceding word when cursor is right after it');

var ins2 = sentinelCS.insertAt('foo bar baz', { line: 0, character: 5 });
test(ins2.text === 'foo ' + sentinelCS.CHAR + ' baz', 'Sentinel replaces identifier under cursor');

var ins3 = sentinelCS.insertAt('line1\nline2\nline3', { line: 1, character: 3 });
test(ins3.text.split('\n')[1].indexOf(sentinelCS.CHAR) === 0, 'Sentinel replaces word at line+column');

test(sentinelCS.CHAR.charCodeAt(0) < 32 || sentinelCS.CHAR.charCodeAt(0) > 126,
  'Sentinel char is non-ASCII-printable so no terminal matches');

test(sentinelCS.removeFrom('ab' + sentinelCS.CHAR + 'cd') === 'abcd', 'removeFrom strips sentinel');

// === GRAMMAR COLLECT SUGGESTIONS AT ===


// === GRAMMAR COLLECT SUGGESTIONS AT ===
section('FoamClassGrammar.collectSuggestionsAt');

var grammarC = foam.parse.lsp.FoamClassGrammar.create({ index: index });
var sentinelC = foam.parse.lsp.CursorSentinel.create();

var srcExt = "foam.CLASS({\n  package: 'test',\n  name: 'X',\n  extends: ''\n});";
var insExt = sentinelC.insertAt(srcExt, { line: 3, character: 12 });
var sugsExt = grammarC.collectSuggestionsAt(insExt.text, insExt.offset);
test(sugsExt.length > 100, 'extends: suggests many class IDs (' + sugsExt.length + ')');
test(sugsExt.some(function(s) { return s.text === 'foam.lang.FObject'; }),
  'extends: suggests FObject');

var srcReq = "foam.CLASS({\n  package: 'test',\n  name: 'X',\n  requires: ['']\n});";
var insReq = sentinelC.insertAt(srcReq, { line: 3, character: 14 });
var sugsReq = grammarC.collectSuggestionsAt(insReq.text, insReq.offset);
test(sugsReq.length > 100, 'requires: suggests many class IDs (' + sugsReq.length + ')');

var srcOf = "foam.CLASS({\n  name: 'X',\n  properties: [\n    { class: 'FObjectProperty', of: '' }\n  ]\n});";
// Line 3: `    { class: 'FObjectProperty', of: '' }` — opening of-quote is at index 37
var insOf = sentinelC.insertAt(srcOf, { line: 3, character: 38 });
var sugsOf = grammarC.collectSuggestionsAt(insOf.text, insOf.offset);
test(sugsOf.length > 100, 'of: suggests many class IDs (' + sugsOf.length + ')');

var srcCls = "foam.CLASS({\n  package: 'test',\n  name: 'X',\n  properties: [{ class: '' }]\n});";
var insCls = sentinelC.insertAt(srcCls, { line: 3, character: 25 });
var sugsCls = grammarC.collectSuggestionsAt(insCls.text, insCls.offset);
test(sugsCls.some(function(s) { return s.text === 'String'; }),
  'class: suggests String property type');
test(sugsCls.some(function(s) { return s.text === 'FObjectProperty'; }),
  'class: suggests FObjectProperty');

// Valid entry — sentinel forces failure, suggestions still come back
var srcValid = "foam.CLASS({\n  package: 'test',\n  name: 'X',\n  requires: ['foam.u2.Element']\n});";
var insValid = sentinelC.insertAt(srcValid, { line: 3, character: 14 });
var sugsValid = grammarC.collectSuggestionsAt(insValid.text, insValid.offset);
test(sugsValid.length > 100,
  'requires: with already-valid entry still returns suggestions via sentinel');

// === COMPLETION (GRAMMAR-DRIVEN CONTEXT) ===


// === GRAMMAR CONTEXT DETECTION ===
section('Grammar context detection (detectContext_)');

var ctxHandler = foam.parse.lsp.handlers.CompletionHandler.create({ index: index });

var extCtx = ctxHandler.detectContext_(
  "foam.CLASS({\n  name: 'X',\n  extends: ''\n});",
  { line: 2, character: 12 });
test(extCtx.classRef, 'detectContext_: extends → classRef');
test( ! extCtx.propKey, 'detectContext_: extends is not propKey');

var propObjCtx = ctxHandler.detectContext_(
  "foam.CLASS({ name: 'X', properties: [{  }] });",
  { line: 0, character: 39 });
test(propObjCtx.propKey, 'detectContext_: inside property object → propKey');
test( ! propObjCtx.classRef, 'detectContext_: property object is not classRef');

var tableCtx = ctxHandler.detectContext_(
  "foam.CLASS({\n  name: 'X',\n  tableColumns: ['']\n});",
  { line: 2, character: 18 });
test(tableCtx.columnName, 'detectContext_: tableColumns value → columnName');

var searchCtx = ctxHandler.detectContext_(
  "foam.CLASS({\n  name: 'X',\n  searchColumns: ['']\n});",
  { line: 2, character: 19 });
test(searchCtx.columnName, 'detectContext_: searchColumns value → columnName');

var docCtx = ctxHandler.detectContext_(
  "foam.CLASS({\n  name: 'X',\n  documentation: ''\n});",
  { line: 2, character: 18 });
test( ! docCtx.classRef && ! docCtx.propKey && ! docCtx.columnName,
  'detectContext_: documentation is not a structural context');

// === MODELED TYPES ===


// === POM GRAMMAR CONTEXT ===
section('POM grammar context detection');

var pomHandler = foam.parse.lsp.handlers.CompletionHandler.create({ index: index });

var pomFlags = pomHandler.detectContext_(
  "foam.POM({\n  files: [\n    { name: 'X', flags: '' }\n  ]\n});",
  { line: 2, character: 25 });
test(pomFlags.pomFlagValue, 'POM flags: detects pomFlagValue');

var pomFileNameCtx = pomHandler.detectContext_(
  "foam.POM({\n  files: [\n    { name: '' }\n  ]\n});",
  { line: 2, character: 13 });
test(pomFileNameCtx.pomFileName, 'POM files.name: detects pomFileName');

var pomJavaFileCtx = pomHandler.detectContext_(
  "foam.POM({\n  javaFiles: [\n    { name: '' }\n  ]\n});",
  { line: 2, character: 13 });
test(pomJavaFileCtx.pomJavaFileName, 'POM javaFiles.name: detects pomJavaFileName');

var pomProjCtx = pomHandler.detectContext_(
  "foam.POM({\n  projects: [\n    { name: '' }\n  ]\n});",
  { line: 2, character: 13 });
test(pomProjCtx.pomProjectPath, 'POM projects.name: detects pomProjectPath');

var pomDepCtx = pomHandler.detectContext_(
  "foam.POM({\n  javaDependencies: [\n    ''\n  ]\n});",
  { line: 2, character: 5 });
test(pomDepCtx.pomJavaDep, 'POM javaDependencies: detects pomJavaDep');

// === HANDLER OUTPUT SHAPE ===


// === GRAMMAR-DRIVEN AXIOM POSITIONS ===
section('FoamClassGrammar.collectAxiomPositions');

var axiomGrammar = foam.parse.lsp.FoamClassGrammar.create({ index: index });

var axSrc = [
  "foam.CLASS({",
  "  package: 'test',",
  "  name: 'Ax',",
  "  documentation: 'messages: [ fake ]',",         // must NOT be picked up
  "  messages: [",                                  // L4
  "    { name: 'GREETING', message: 'hi' },",       // L5
  "    { name: 'FAREWELL', message: 'bye' }",       // L6
  "  ]",
  "});"
].join('\n');

var axMap = axiomGrammar.collectAxiomPositions(axSrc);
test(axMap.message.GREETING && axMap.message.GREETING.line === 5,
  'Grammar axiom-pos: GREETING message at line 5');
test(axMap.message.FAREWELL && axMap.message.FAREWELL.line === 6,
  'Grammar axiom-pos: FAREWELL message at line 6');
test(! axMap.message.fake,
  'Grammar axiom-pos: docstring containing messages: [ fake ] is NOT indexed');

// Caching
var m1 = axiomGrammar.collectAxiomPositions(axSrc);
var m2 = axiomGrammar.collectAxiomPositions(axSrc);
test(m1 === m2, 'Grammar axiom-pos: cache hit on identical text');

// Enum values container
var enumSrc = [
  "foam.ENUM({",
  "  package: 'test',",
  "  name: 'Color',",
  "  values: [",                                 // L3
  "    { name: 'RED', label: 'Red' },",          // L4
  "    { name: 'GREEN', label: 'Green' }",       // L5
  "  ]",
  "});"
].join('\n');
var enumMap = axiomGrammar.collectAxiomPositions(enumSrc);
test(enumMap.value.RED && enumMap.value.RED.line === 4,
  'Grammar axiom-pos: enum value RED at line 4');
test(enumMap.value.GREEN && enumMap.value.GREEN.line === 5,
  'Grammar axiom-pos: enum value GREEN at line 5');

// Regression: `foam.mlang.Expressions` was greedy-matched by `foam.mlang.Expr`
// before we started sorting class-ref sugs by length-descending. Guard that
// here so the bug can't come back silently.
var exprCheck = axiomGrammar.collectAxiomPositions(
  "foam.CLASS({ implements: [ 'foam.mlang.Expressions' ], messages: [ { name: 'FOO', message: 'hi' } ] });"
);
test(Object.keys(exprCheck.message).length === 1,
  'Grammar parses implements: [ foam.mlang.Expressions ] without prefix-match regression');

// StringFilterView cross-check — grammar MUST resolve axiom positions
// on real files.
if ( index.classExists(SFV) ) {
  var sfvFs3 = require('fs');
  var sfvTxt3 = sfvFs3.readFileSync('foam3/src/foam/u2/filter/properties/StringFilterView.js', 'utf8');
  var sfvAxMap = axiomGrammar.collectAxiomPositions(sfvTxt3);

  // Progressive isolation: test increasingly minimal versions of SFV until
  // grammar produces results — identifies which construct breaks it.

  var msgKeys = Object.keys(sfvAxMap.message);
  test(msgKeys.length >= 7,
    'Grammar axiom-pos on StringFilterView: all 7 messages indexed (got ' + msgKeys.length + ')');
  test(sfvAxMap.message.LABEL_PLACEHOLDER && sfvAxMap.message.LABEL_PLACEHOLDER.line > 90,
    'Grammar axiom-pos: LABEL_PLACEHOLDER at expected line');
}

// === POM completion: grammar-driven key + value suggestions ===


// === Migration coverage: grammar emits 'property' and 'method' positions ===
section('Grammar: property / method axiom positions');

var propMethodSrc = [
  "foam.CLASS({",
  "  package: 'test',",                              // L1
  "  name: 'PM',",                                   // L2
  "  properties: [",                                 // L3
  "    { class: 'String', name: 'firstName' },",     // L4
  "    { class: 'Int',    name: 'age' }",            // L5
  "  ],",
  "  methods: [",                                    // L7
  "    function greet() { return 'hi'; },",          // L8
  "    { name: 'farewell', code: function() { return 'bye'; } }",  // L9
  "  ]",
  "});"
].join('\n');
var pmMap = axiomGrammar.collectAxiomPositions(propMethodSrc);
test(pmMap.property && pmMap.property.firstName && pmMap.property.firstName.line === 4,
  'Grammar axiom-pos: property firstName at line 4');
test(pmMap.property && pmMap.property.age && pmMap.property.age.line === 5,
  'Grammar axiom-pos: property age at line 5');
test(pmMap.method && pmMap.method.greet && pmMap.method.greet.line === 8,
  'Grammar axiom-pos: method greet at line 8 (bare function form)');
test(pmMap.method && pmMap.method.farewell && pmMap.method.farewell.line === 9,
  'Grammar axiom-pos: method farewell at line 9 (object form)');

// === Migration coverage: buildLocationAtProperty uses the grammar path ===

