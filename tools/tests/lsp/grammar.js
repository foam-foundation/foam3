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

// === Method-body parsing must not disturb sibling axioms (Approach-A guard) ===
// The grammar consumes method bodies as opaque balancedBraces. Any change that
// teaches it to descend into bodies (e.g. an i18n .add() rule) MUST still
// consume each body exactly — leaving siblings (the next method, later props)
// findable. These lock that invariant: if a body change over- or under-consumes,
// the sibling axiom below it goes missing and a test here fails immediately.
section('Grammar: method bodies do not disturb sibling axioms (Approach-A guard)');

// Synthetic, full control. render()'s body packs every construct a body-descent
// could trip on: chained .add()/.start(), a nested callback with its own braces,
// a string literal containing { } and an .add( and an escaped quote, plus line
// and block comments that also contain .add( and braces. The sibling after() must
// still be located at its real line.
var bodyGuardSrc = [
  "foam.CLASS({",                                                       // 0
  "  package: 'g',",                                                    // 1
  "  name: 'BodyGuard',",                                               // 2
  "  properties: [",                                                    // 3
  "    { name: 'before' }",                                             // 4
  "  ],",                                                               // 5
  "  methods: [",                                                       // 6
  "    function render() {",                                            // 7
  "      // line comment with .add('Commented') and a } brace",         // 8
  "      this.start('div').add('Hello').start('span').add('World').end();", // 9
  "      var s = 'has } { braces and .add(\\'Nested\\') inside';",      // 10
  "      this.data.sub(function() { self.add('InCallback'); });",       // 11
  "      /* block } { .add('Blocked') comment */",                      // 12
  "    },",                                                             // 13
  "    function after() { return 1; }",                                 // 14
  "  ]",                                                                // 15
  "});"                                                                 // 16
].join('\n');
var bgMap = axiomGrammar.collectAxiomPositions(bodyGuardSrc);
test(bgMap.property && bgMap.property.before && bgMap.property.before.line === 4,
  'body-guard: property before the method is found at line 4');
test(bgMap.method && bgMap.method.render && bgMap.method.render.line === 7,
  'body-guard: render() method found at line 7');
test(bgMap.method && bgMap.method.after && bgMap.method.after.line === 14,
  'body-guard: sibling after() still found at line 14 AFTER a gnarly render body');

// Full no-throw parse of the same source — balancedBraces must not bail mid-class.
var bgPs = foam.parse.StringPStream.create({ str: bodyGuardSrc + String.fromCharCode(26) });
var bgRes; try { bgRes = grammar.parse(bgPs); } catch ( e ) { bgRes = undefined; }
test(bgRes !== undefined, 'body-guard: source with a complex method body parses without error');

// Real framework view: ActionView is dense with chained .add()/.addClass().add()
// in its render()/initCls() bodies. Both methods (which precede the listeners:
// block) are indexed, proving balancedBraces consumes those .add()-heavy bodies
// without losing the sibling method. NOTE: ActionView's click/debounce/setConfirm
// live in listeners:, which collectAxiomPositions does not index as methods (see
// the bare-function-listener limitation tests below) — so they are intentionally
// NOT asserted here.
var avPath = 'foam3/src/foam/u2/ActionView.js';
if ( fs.existsSync(avPath) ) {
  var avText = fs.readFileSync(avPath, 'utf8');
  var avMap  = axiomGrammar.collectAxiomPositions(avText);
  test(!! (avMap.method.render && avMap.method.initCls),
    'real view: render + initCls methods both found (sibling recovery across .add()-heavy bodies)');
  test(!! (avMap.property.label && avMap.property.data),
    'real view: label/data properties found');
  test(!! avMap.message.CONFIRM,
    'real view: CONFIRM message found');
  var avPs = foam.parse.StringPStream.create({ str: avText + String.fromCharCode(26) });
  var avRes; try { avRes = grammar.parse(avPs); } catch ( e ) { avRes = undefined; }
  test(avRes !== undefined, 'real view: ActionView.js parses without error');
} else {
  test(true, 'real view: ActionView.js not present — skipped');
}

// listenersEntry structures BOTH listener forms: the object form
// ([ { name, code } ]) and the bare named-function form
// ([ function click(e){...} ], a common FOAM idiom). Neither may derail the
// parse of axioms that follow, and a bare-function listener is itself indexed
// as a method position (so go-to-def / hover resolve on the listener name).
section('Grammar: listener forms — method-position indexing');
test(Object.keys(axiomGrammar.collectAxiomPositions(
  "foam.CLASS({ package:'t', name:'OBJL', listeners:[ { name:'deb', code: function(){ this.add('Z'); } } ], methods:[ function afterL(){ return 1; } ] })"
).method).indexOf('afterL') !== -1,
  'object-form listener does NOT break the following methods: block (afterL found)');
var bflMap = axiomGrammar.collectAxiomPositions(
  "foam.CLASS({ package:'t', name:'BFL', listeners:[ function click(e){ this.add('Z'); } ], methods:[ function afterL(){ return 1; } ] })"
);
test(Object.keys(bflMap.method).indexOf('afterL') !== -1,
  'bare-function listener does NOT break the following methods: block (afterL found)');
test(Object.keys(bflMap.method).indexOf('click') !== -1,
  'bare-function listener is itself indexed as a method position (click found)');

// === Regression: top-level/property keys with values must NOT abort the parse ===
// Earlier `topKey()` and `propKey()` only matched the key word, leaving
// the `: <value>` for the next iteration to choke on. Result: ANY class
// using `label:`, `plural:`, or per-property `label:`/`visibility:`/etc.
// silently dropped every downstream property/method position emission,
// so go-to-def fell through to file-top.
section('Grammar: top-level + property keys consume their values');

var noisySrc = [
  'foam.CLASS({',
  "  package: 'test',",
  "  name: 'Noisy',",
  "  label: 'Noisy Display',",                                    // L3
  "  plural: 'Noisys',",                                          // L4
  "  documentation: 'A docstring with spaces and \"quotes\"',",   // L5
  '  properties: [',
  "    { name: 'alpha', label: 'Alpha Display', visibility: 'RO' },",   // L7
  "    { name: 'beta', help: 'Type a beta value' },",                   // L8
  "    { name: 'gamma' }",                                              // L9
  '  ],',
  '  methods: [',
  '    function delta() {},',                                            // L12
  "    { name: 'epsilon', code: function() {} }",                        // L13
  '  ]',
  '});'
].join('\n');

var noisyPositions = axiomGrammar.collectAxiomPositions(noisySrc);
['alpha', 'beta', 'gamma'].forEach(function(p) {
  test(noisyPositions.property && noisyPositions.property[p],
    'Property "' + p + '" position emitted past noisy class-level + property-level slots');
});
['delta', 'epsilon'].forEach(function(m) {
  test(noisyPositions.method && noisyPositions.method[m],
    'Method "' + m + '" position emitted past noisy class-level + property-level slots');
});
test(noisyPositions.property && noisyPositions.property.alpha && noisyPositions.property.alpha.line === 7,
  'Property alpha is on line 7 (positions stay accurate)');
test(noisyPositions.method && noisyPositions.method.epsilon && noisyPositions.method.epsilon.line === 13,
  'Method epsilon is on line 13 (positions stay accurate)');

// === Regression: longest-first sort for property type alts ===
// The propTypeParser was matching `Double` before `DoubleUnitValue`, so
// `class: 'DoubleUnitValue'` consumed only `Double` and left `UnitValue`
// to choke the outer rule — silently bailing every downstream property
// emission. Sort propTypes longest-first.
section('Grammar: prop-type alt ordered longest-first');

var dblSrc =
  "foam.CLASS({\n" +
  "  package: 'test',\n" +
  "  name: 'D',\n" +
  "  properties: [\n" +
  "    { class: 'DoubleUnitValue', name: 'amount' },\n" +
  "    { class: 'String',          name: 'label' }\n" +
  "  ]\n" +
  "});";
var dblMap = axiomGrammar.collectAxiomPositions(dblSrc);
test(dblMap.property && dblMap.property.amount,
  'DoubleUnitValue property emits position (longer prop type not prefix-clobbered by Double)');
test(dblMap.property && dblMap.property.label,
  'Property after a long-type entry still emits — parse keeps progressing');

// === Regression: javaImports with `static ` prefix and wildcard `.*` ===
// Java static-method imports look like `'static foo.MLang.AND'`. Wildcard
// imports look like `'foo.bar.*'`. Both must parse without aborting the
// outer class body.
section('Grammar: javaImports static + wildcard tolerated');

var jiSrc =
  "foam.CLASS({\n" +
  "  package: 'test',\n" +
  "  name: 'JI',\n" +
  "  javaImports: [\n" +
  "    'java.util.List',\n" +
  "    'foo.bar.*',\n" +
  "    'static foo.MLang.AND',\n" +
  "    'static foo.MLang.EQ'\n" +
  "  ],\n" +
  "  properties: [{ name: 'marker' }]\n" +
  "});";
var jiMap = axiomGrammar.collectAxiomPositions(jiSrc);
test(jiMap.property && jiMap.property.marker,
  'Property after javaImports with static + wildcard still emits');

// === Regression: trailing commas in arrays / object literals must parse ===
// JS allows trailing commas; the FOAM JSON serializer emits them too.
// Without `repeatList` tolerating them, the parser bails on the trailing
// comma and silently drops every downstream property/method emission.
section('Grammar: trailing commas tolerated in lists');

[
  ['no trailing comma',     "foam.CLASS({ package: 'x', name: 'Y', requires: ['foam.u2.View'], properties: [{ name: 'a' }] });"],
  ['trailing in requires',  "foam.CLASS({ package: 'x', name: 'Y', requires: ['foam.u2.View',], properties: [{ name: 'a' }] });"],
  ['trailing in properties',"foam.CLASS({ package: 'x', name: 'Y', properties: [{ name: 'a' },] });"],
  ['trailing in methods',
    "foam.CLASS({ package: 'x', name: 'Y', methods: [function _ignored(){}, function _ignored2(){},], properties: [{ name: 'a' }] });"],
  ['trailing in implements',"foam.CLASS({ package: 'x', name: 'Y', implements: ['foam.u2.View',], properties: [{ name: 'a' }] });"],
  ['trailing in imports',   "foam.CLASS({ package: 'x', name: 'Y', imports: ['ctrl?', 'userDAO?',], properties: [{ name: 'a' }] });"],
  ['trailing in tableCols', "foam.CLASS({ package: 'x', name: 'Y', tableColumns: ['a', 'b',], properties: [{ name: 'a' }] });"],
  ['trailing in messages',  "foam.CLASS({ package: 'x', name: 'Y', messages: [{ name: 'M', message: 'hi' },], properties: [{ name: 'a' }] });"],
  ['trailing in sections',  "foam.CLASS({ package: 'x', name: 'Y', sections: [{ name: 's', title: 'S' },], properties: [{ name: 'a' }] });"],
  ['multi-line + trailing',
    "foam.CLASS({\n" +
    "  package: 'x',\n" +
    "  name: 'Y',\n" +
    "  requires: [\n" +
    "    'foam.u2.View',\n" +
    "    'foam.lang.X',\n" +    // ← trailing comma after this entry
    "  ],\n" +
    "  properties: [\n" +
    "    { name: 'a' },\n" +
    "    { name: 'b' },\n" +    // ← trailing comma in properties
    "  ],\n" +
    "  methods: [\n" +
    "    function m1() {},\n" +
    "    function m2() {},\n" + // ← trailing comma in methods
    "  ]\n" +
    "});"]
].forEach(function(row) {
  var label = row[0], src = row[1];
  var p = axiomGrammar.collectAxiomPositions(src);
  test(p.property && p.property.a,
    label + ': property "a" emits position (parse keeps progressing)');
});

// And the negative-direction check: a property declared AFTER a list
// with a trailing comma must still emit, not get swallowed by a parser
// that bailed out on the comma.
var afterTrail =
  "foam.CLASS({\n" +
  "  package: 'x',\n" +
  "  name: 'Y',\n" +
  "  requires: ['foam.u2.View',],\n" +    // trailing comma
  "  properties: [{ name: 'shouldEmit' }]\n" +
  "});";
var afterMap = axiomGrammar.collectAxiomPositions(afterTrail);
test(afterMap.property && afterMap.property.shouldEmit,
  'Property after a list with trailing comma still emits its position');

// === Generic foam.<X>(...) detection — covers FSM and any future model type ===
section('Grammar: generic foam.<X> top-level call');

[
  ['foam.FSM({ package: ' + Q + 'com.example.fsm' + Q + ', name: ' + Q + 'TrafficLight' + Q + ' });', 'FSM',          'com.example.fsm.TrafficLight'],
  ['foam.RELATIONSHIP({ sourceModel: ' + Q + 'foam.u2.View' + Q + ', targetModel: ' + Q + 'foam.lang.Property' + Q + ', forwardName: ' + Q + 'a' + Q + ', inverseName: ' + Q + 'b' + Q + ' });', 'RELATIONSHIP', null],
  ['foam.CLASS({ package: ' + Q + 'com.example' + Q + ', name: ' + Q + 'X' + Q + ' });', 'CLASS', 'com.example.X'],
  ['foam.ENUM({ package: ' + Q + 'com.example' + Q + ', name: ' + Q + 'E' + Q + ', values: [{name: ' + Q + 'A' + Q + '}] });', 'ENUM', 'com.example.E']
].forEach(function(row) {
  var src = row[0], expectedType = row[1], expectedClassId = row[2];
  test(analyzer.isFoamFile(src),
    'isFoamFile recognizes foam.' + expectedType + '(...)');
  var models = cache.parseFileModels(src);
  test(models.length === 1,
    'parseFileModels captures one model from foam.' + expectedType);
  test(models.length === 1 && models[0].type_ === expectedType,
    'Captured model has type_=' + expectedType);
  if ( expectedClassId ) {
    test(models.length === 1 && cache.getClassId(models[0]) === expectedClassId,
      'Captured classId for foam.' + expectedType + ' is ' + expectedClassId);
  }
});

// Hypothetical custom model type — proves the LSP doesn't need to know
// the call name to track the file. Use a name unlikely to clash.
var customSrc = "foam.NEWMODELTYPE_X9({ package: " + Q + "com.example.x9" + Q + ", name: " + Q + "Demo" + Q + " });";
test(analyzer.isFoamFile(customSrc),
  'isFoamFile recognizes any uppercase foam.<X> call');
var customModels = cache.parseFileModels(customSrc);
test(customModels.length === 1 && customModels[0].type_ === 'NEWMODELTYPE_X9',
  'Generic capture preserves the call name as type_');

// POM is excluded from default isFoamFile (different body shape, no diagnostics)
var pomSrc = "foam.POM({ name: " + Q + "test" + Q + ", projects: [] });";
test(! analyzer.isFoamFile(pomSrc),
  'isFoamFile() (default) excludes foam.POM');
test(analyzer.isFoamFile(pomSrc, true),
  'isFoamFile(text, true) includes foam.POM for completion paths');

// === Class-id slot recognition (axiom-driven) ===
section('Grammar: class-id slot recognition');

// refines: parses as a first-class entry, not just a topLevelKey suggestion
var refinesSrc = "foam.CLASS({ refines: " + Q + "foam.u2.View" + Q + ", properties: [] });";
var refinesDiags = diagHandler.handle(refinesSrc);
test(refinesDiags.filter(function(d) { return d.message.indexOf('Unknown') >= 0 }).length === 0,
  'refines: with known class produces no Unknown-class diagnostic');

var refinesBogus = "foam.CLASS({ refines: " + Q + "foo.bar.NoSuchClass" + Q + " });";
var refinesBogusDiags = diagHandler.handle(refinesBogus);
test(refinesBogusDiags.filter(function(d) { return d.message.indexOf('Unknown class') >= 0 }).length === 1,
  'refines: with unknown class produces exactly 1 Unknown-class diagnostic');

// sourceModel/targetModel — RELATIONSHIP class-id slots
var relSrc = "foam.RELATIONSHIP({ sourceModel: " + Q + "foam.u2.View" + Q + ", targetModel: " + Q + "foam.lang.Property" + Q + ", forwardName: " + Q + "a" + Q + ", inverseName: " + Q + "b" + Q + " });";
test(diagHandler.handle(relSrc).filter(function(d) { return d.message.indexOf('Unknown') >= 0 }).length === 0,
  'RELATIONSHIP with known sourceModel/targetModel: no diagnostics');

var relBogus = "foam.RELATIONSHIP({ sourceModel: " + Q + "foo.bar.None" + Q + ", targetModel: " + Q + "foam.lang.Property" + Q + ", forwardName: " + Q + "a" + Q + ", inverseName: " + Q + "b" + Q + " });";
test(diagHandler.handle(relBogus).filter(function(d) { return d.message.indexOf('Unknown class') >= 0 }).length === 1,
  'RELATIONSHIP with bogus sourceModel: 1 Unknown-class diagnostic');

// class: 'foam.x.Y' — dotted class id parses as classRef, not propType
var dottedClassSrc = "foam.CLASS({ package: " + Q + "com.example" + Q + ", name: " + Q + "X" + Q + ", properties: [{ class: " + Q + "foam.u2.view.RichChoiceView" + Q + ", name: " + Q + "v" + Q + " }] });";
var dottedDiags = diagHandler.handle(dottedClassSrc);
test(dottedDiags.filter(function(d) { return d.message.indexOf('Unknown') >= 0 }).length === 0,
  'class: with dotted real class produces no Unknown-class diagnostic');

// class: 'String' — short propType still works (no false positive)
var shortClassSrc = "foam.CLASS({ package: " + Q + "com.example" + Q + ", name: " + Q + "X" + Q + ", properties: [{ class: " + Q + "String" + Q + ", name: " + Q + "s" + Q + " }] });";
test(diagHandler.handle(shortClassSrc).filter(function(d) { return d.message.indexOf('Unknown') >= 0 }).length === 0,
  'class: with short propType String produces no diagnostic');

// === Double-quote tolerance + style hint ===
section('Grammar: double-quote tolerance for class refs');

var dqExtSrc = 'foam.CLASS({ refines: "foam.u2.View" });';
var dqDiags = diagHandler.handle(dqExtSrc);
var hints = dqDiags.filter(function(d) { return d.severity === 4 && d.message.indexOf('single quotes') >= 0 });
test(hints.length === 1,
  'Double-quoted refines: emits 1 hint diagnostic (severity 4)');
test(diagHandler.handle(dqExtSrc).filter(function(d) { return d.severity === 1 || d.severity === 2 }).length === 0,
  'Double-quoted real class: no error/warning, only the style hint');

// `name:` should NOT trigger the class-ref hint when double-quoted
var dqNameSrc = 'foam.CLASS({ package: "com.example", name: "MyClass" });';
test(diagHandler.handle(dqNameSrc).filter(function(d) { return d.message.indexOf('single quotes') >= 0 }).length === 0,
  'Double-quoted name:/package: emits NO class-ref style hint');

// Mismatched quotes (open " close ') still parse leniently
var mismatchSrc = 'foam.CLASS({ refines: "foam.u2.View' + Q + ' });';
test(diagHandler.handle(mismatchSrc).length >= 0,
  'Mismatched-quote refines: parses without throwing (lenient)');

// === Regression: plain-string slots must NOT be misparsed as class refs ===
// `label`, `documentation`, etc. carry human-readable strings that often
// start with a capitalized word ("Transaction Details"). An over-broad
// class-typed slot list would mis-flag these as Unknown-class diagnostics.
section('Grammar: plain-string slots stay plain');

[
  ['label',         "'Transaction Details'"],
  ['documentation', "'Reason Code on the Dispute Case'"],
  ['help',          "'Choose a Country to filter'"],
  ['placeholder',   "'Card Number'"]
].forEach(function(row) {
  var slotName = row[0], stringValue = row[1];
  var src = 'foam.CLASS({ package: ' + Q + 'com.example' + Q + ', name: ' + Q + 'X' + Q +
    ', properties: [{ class: ' + Q + 'String' + Q + ', name: ' + Q + 'p' + Q +
    ', ' + slotName + ': ' + stringValue + ' }] });';
  var diags = diagHandler.handle(src);
  var classDiags = diags.filter(function(d) { return d.message.indexOf('Unknown class') >= 0; });
  test(classDiags.length === 0,
    slotName + ': ' + stringValue + ' does NOT trigger Unknown-class diagnostic');
});

// === Generic class-typed slot detection ===
section('Grammar: generic class-typed property slots');

var classTypedNames = index.getClassTypedPropertyNames();
test(classTypedNames.indexOf('of') >= 0, 'getClassTypedPropertyNames includes "of"');
test(classTypedNames.indexOf('extends') >= 0, 'getClassTypedPropertyNames includes "extends"');
test(classTypedNames.indexOf('view') >= 0, 'getClassTypedPropertyNames includes "view"');
test(classTypedNames.indexOf('refines') >= 0, 'getClassTypedPropertyNames includes "refines"');
test(classTypedNames.indexOf('sourceModel') >= 0, 'getClassTypedPropertyNames includes "sourceModel"');
test(classTypedNames.indexOf('targetModel') >= 0, 'getClassTypedPropertyNames includes "targetModel"');
test(classTypedNames.length === 8,
  'getClassTypedPropertyNames returns the canonical 8 (no over-broad registry walk that would false-positive on `label`/`name`/etc.)');
['label', 'name', 'documentation'].forEach(function(n) {
  test(classTypedNames.indexOf(n) === -1,
    'getClassTypedPropertyNames does NOT include "' + n + '" (would mis-flag plain-string slots)');
});

// === topLevelKey / propKey / pomKey suggestions carry description hints ===
section('Grammar: completion suggestions carry hint text');

var hintGrammar = foam.parse.lsp.FoamClassGrammar.create({ index: index });
var hintSentinel = foam.parse.lsp.CursorSentinel.create();

// Top-level keys with hints — cursor at the start of an empty class body.
// At this position the explicit-entry suggestions (category='key') fire
// first; they go through key()/topKey() which both carry hints.
var topSrc = 'foam.CLASS({\n  \n});';
var topIns = hintSentinel.insertAt(topSrc, { line: 1, character: 2 });
var topSugs = hintGrammar.collectSuggestionsAt(topIns.text, topIns.offset);
var topHinted = topSugs.filter(function(s) {
  return (s.category === 'topKey' || s.category === 'key') && s.hint;
});
test(topHinted.length > 10,
  'class-body key suggestions ship with hint text (' + topHinted.length + ' have hints)');
var packageHint = topSugs.filter(function(s) { return s.text && s.text.indexOf('package') === 0; })[0];
test(packageHint && packageHint.hint && packageHint.hint.length > 0,
  'package: suggestion has a description hint');
var refinesHint = topSugs.filter(function(s) { return s.text && s.text.indexOf('refines') === 0; })[0];
test(refinesHint && refinesHint.hint && refinesHint.hint.toLowerCase().indexOf('refinement') >= 0,
  'refines: suggestion describes refinement target');

// New RELATIONSHIP-only keys (forwardName/inverseName/cardinality)
['forwardName', 'inverseName', 'cardinality', 'sourceProperty', 'targetProperty'].forEach(function(k) {
  var hit = topSugs.filter(function(s) { return s.text && s.text.indexOf(k) === 0; })[0];
  test(hit, 'topLevelKey alt includes "' + k + '"');
});

// Property keys carry hints too
var propSrc = "foam.CLASS({\n  properties: [\n    { \n  ]\n});";
var propIns = hintSentinel.insertAt(propSrc, { line: 2, character: 6 });
var propSugs = hintGrammar.collectSuggestionsAt(propIns.text, propIns.offset);
var propHinted = propSugs.filter(function(s) { return s.category === 'propKey' && s.hint; });
test(propHinted.length > 10,
  'propKey suggestions ship with hint text (' + propHinted.length + ' have hints)');
var classKeyHint = propSugs.filter(function(s) { return s.text && s.text.indexOf('class:') === 0 && s.category === 'propKey'; })[0];
test(classKeyHint && classKeyHint.hint && classKeyHint.hint.toLowerCase().indexOf('property type') >= 0,
  'class: prop-key hint mentions property type');

// POM keys carry hints
var pomSrc = "foam.POM({\n  \n});";
var pomIns = hintSentinel.insertAt(pomSrc, { line: 1, character: 2 });
var pomSugs = hintGrammar.collectSuggestionsAt(pomIns.text, pomIns.offset);
var filesHint = pomSugs.filter(function(s) { return s.text && s.text.indexOf('files:') === 0; })[0];
test(filesHint && filesHint.hint && filesHint.hint.length > 0,
  'POM files: suggestion has a description hint');
var projectsHint = pomSugs.filter(function(s) { return s.text && s.text.indexOf('projects:') === 0; })[0];
test(projectsHint && projectsHint.hint && projectsHint.hint.length > 0,
  'POM projects: suggestion has a description hint');

// === Tree-sitter grammar parity (VS Code TextMate + Zed scm) ===
// The LSP grammar handles foam.<X> generically AND treats refines /
// sourceModel / targetModel / view / class as class-id slots. The
// VS Code TextMate grammar and the Zed tree-sitter highlights MUST
// follow suit so syntax highlighting matches LSP behavior. These
// regex/text checks pin the grammar files so future grammar tweaks
// can't silently drop coverage.
section('Tree-sitter parity: foam.<X> highlight + class-id slots');

var fs_ts  = require('fs');
var path_ts = require('path');

// VS Code TextMate grammar
var vscodeJs = JSON.parse(fs_ts.readFileSync(
  path_ts.join(__dirname, '../../lsp/editors/vscode/syntaxes/foam-js.tmLanguage.json'),
  'utf8'));
var vscodePatterns = (vscodeJs.patterns || []).map(function(p) { return p.match || ''; }).join('\n');

test(/foam.+\[A-Z\].*A-Z0-9_/.test(vscodePatterns),
  'VS Code foam-js grammar matches generic foam.<UPPER>(...) call (not hardcoded names)');
test(! /CLASS\|ENUM\|INTERFACE\|RELATIONSHIP\)\\\\s\*\(\?=/.test(vscodePatterns) ||
     /\[A-Z\]\[A-Z0-9_\]\*/.test(vscodePatterns),
  'VS Code foam-js grammar no longer hardcodes the model-type list');

['refines', 'sourceModel', 'targetModel', 'view', 'class'].forEach(function(slot) {
  test(vscodePatterns.indexOf(slot) >= 0,
    'VS Code foam-js grammar lists "' + slot + '" as a class-id slot');
});

// Zed tree-sitter highlights
var zedHi = fs_ts.readFileSync(
  path_ts.join(__dirname, '../../lsp/editors/zed-foam3/languages/foam-javascript/highlights.scm'),
  'utf8');

test(/#match\?\s+@function\.macro\s+"\^\[A-Z\]\[A-Z0-9_\]\*\$"/.test(zedHi) ||
     /\[A-Z\]\[A-Z0-9_\]\*/.test(zedHi),
  'Zed foam-javascript highlights match generic foam.<UPPER> call');
test(/foam.*function\.macro/.test(zedHi.replace(/\s+/g, ' ')) ||
     /\(\#eq\?\s+@\S+\s+"foam"\)/.test(zedHi),
  'Zed foam-javascript highlights bind the receiver `foam` for the macro');
['refines', 'sourceModel', 'targetModel', 'view', 'class'].forEach(function(slot) {
  test(new RegExp('"' + slot + '"').test(zedHi),
    'Zed foam-javascript highlights list "' + slot + '" as a class-id slot');
});

// === Migration coverage: buildLocationAtProperty uses the grammar path ===

section('Grammar — collectRanges comments + documentation (F1)');
var crText = "foam.CLASS({\n" +
  "  documentation: 'Hello World',\n" +
  "  // a line comment FObject\n" +
  "  methods: [ function f() { /* block FObject */ return 1; } ]\n" +
  "})";
var ranges = grammar.collectRanges(crText);
test(ranges.comment.length >= 2, 'collectRanges finds the line + block comments');
test(ranges.documentation.length >= 1, 'collectRanges finds the documentation value');
var docSpan = ranges.documentation[0];
test(crText.substring(docSpan.startPos, docSpan.endPos).indexOf('Hello World') !== -1,
  'documentation span covers the value text');

section('Grammar — collectInstantiations (F3)');
var ciCreate = "foam.CLASS({ methods: [ function f() { " +
  "var x = this.Health.create({ status: 'UP', port: 8080 }); } ] })";
var insts = grammar.collectInstantiations(ciCreate);
test(insts.length >= 1, 'collectInstantiations finds the create call');
var call = insts.find(function(c) { return ! c.isTag; });
test(call && call.classText === 'Health', 'create receiver resolved to Health (this. stripped)');
var statusEntry = call && call.entries.find(function(e) { return e.key === 'status'; });
test(statusEntry && statusEntry.valueText.indexOf('UP') !== -1, 'status entry value captured');

var ciTag = "foam.CLASS({ methods: [ function f() { " +
  "this.tag(this.Health, { status: 'DOWN' }); } ] })";
var tagCall = grammar.collectInstantiations(ciTag).find(function(c) { return c.isTag; });
test(tagCall && tagCall.classText === 'Health', 'tag first-arg class resolved to Health');

var generic = "foam.CLASS({ methods: [ function f() { foo.bar({ a: 1 }); this.doThing(x); } ] })";
test(grammar.collectInstantiations(generic).length === 0,
  'generic calls produce no instantiation records (negative lookahead works)');


section('Grammar — chained .tag + call-expression values (F3 regression)');
// .tag chained off a method call (receiver before .tag is ')') with a slot
// value and a function-call value — must still detect every call + entry.
var chainSrc = "foam.CLASS({ methods: [ function f() {" +
  " this.start().addClass('m')" +
  "  .tag(this.MetricCard, { value$: this.totalCount$, variant: 'CRITICAL' })" +
  "  .tag(this.MetricCard, { subText$: this.slot(function(n){ return n + ''; }, this.x$), variant: 'WARN' })" +
  " .end(); } ] })";
var chainInsts = grammar.collectInstantiations(chainSrc);
test(chainInsts.length === 2, 'both chained .tag calls detected (got ' + chainInsts.length + ')');
var second = chainInsts[1];
var vEntry = second && second.entries.find(function(e){ return e.key === 'variant'; });
test(vEntry && vEntry.valueText.indexOf('WARN') !== -1, 'variant captured past a function-call value without desync');

section('Grammar — generic classRef + object detection (F3, not .tag-specific)');
// Any call passing a class ref followed by an object literal is detected,
// regardless of the method name.
var genHelper = grammar.collectInstantiations(
  "foam.CLASS({ methods: [ function f() { renderCard(this.MetricCard, { variant: 'WARN' }); } ] })");
test(genHelper.length === 1 && genHelper[0].classText === 'MetricCard',
  'arbitrary helper(classRef, {...}) is detected (not just .tag)');
var addForm = grammar.collectInstantiations(
  "foam.CLASS({ methods: [ function f() { this.add(this.MetricCard, { variant: 'X' }); } ] })");
test(addForm.length === 1, '.add(classRef, {...}) is detected');
// An object literal with no sibling class ref is NOT an instantiation.
var noClass = grammar.collectInstantiations(
  "foam.CLASS({ methods: [ function f() { foo.bar({ a: 1 }); } ] })");
test(noClass.length === 0, 'object-only call (no class arg) is not detected');

section('Grammar — inline ViewSpec { class: X, ... } detection (F3)');
var vsAdd = grammar.collectInstantiations(
  "foam.CLASS({ methods: [ function f() { this.add({ class: 'com.paytic.ui.MetricCard', variant: 'WARN' }); } ] })");
test(vsAdd.length === 1 && vsAdd[0].classText === 'com.paytic.ui.MetricCard',
  '{ class: X, ... } in code is detected with the class from the class: key');
var vsEntry = vsAdd.length === 1 && vsAdd[0].entries.find(function(e){ return e.key === 'variant'; });
test(vsEntry && vsEntry.valueText.indexOf('WARN') !== -1, 'sibling props captured (class: key excluded)');
// CRITICAL guard: a property DEFINITION is NOT a ViewSpec instantiation.
var propDef = grammar.collectInstantiations(
  "foam.CLASS({ properties: [ { class: 'String', name: 'x', documentation: 'd' } ] })");
test(propDef.length === 0, "property definition { class: 'String', name: 'x' } is NOT treated as an instantiation");
var plainObj = grammar.collectInstantiations(
  "foam.CLASS({ methods: [ function f() { var o = { a: 1, b: 2 }; } ] })");
test(plainObj.length === 0, 'plain object with no class: key is not an instantiation');

section('Grammar — this.Short member usages emit memberRef (references)');
var memSrc = "foam.CLASS({ methods: [ function render() {" +
  " this.add(this.MetricCard); this.tag(this.MetricCard, { a: 1 }); var x = this.Other.create({}); } ] })";
var memMap = grammar.collectAxiomPositions(memSrc);
test(!! (memMap.memberRef && memMap.memberRef['this.MetricCard']),
  'bare this.MetricCard (render add) emits a memberRef');
test(!! (memMap.instTagClass && memMap.instTagClass['this.MetricCard']),
  '.tag(this.MetricCard, {...}) still emits instTagClass');
test(!! (memMap.instCreateReceiver && memMap.instCreateReceiver['this.Other']),
  'this.Other.create({}) still emits instCreateReceiver');

// === VIEW-SPEC OBJECT FORM CLASSREF ===

section('FoamClassGrammar — view: { class: ... } object form');
// The object form must emit a classRef position for the class id, just like
// the string form `view: 'x.Y'` — find-references / definition / unknown-class
// diagnostics inside view specs depend on it.
var viewObjClsId = index.classExists('foam.u2.DetailView') ?
  'foam.u2.DetailView' : 'foam.lang.FObject';
var viewObjSrc = [
  "foam.CLASS({",
  "  package: 'test',",
  "  name: 'ViewObjOwner',",
  "  properties: [",
  "    {",
  "      class: 'String',",
  "      name: 'p1',",
  "      view: { class: '" + viewObjClsId + "', placeholder: 'x' }",   // L7
  "    }",
  "  ]",
  "});"
].join('\n');
var viewObjMap = axiomGrammar.collectAxiomPositions(viewObjSrc);
var viewObjHits = ( viewObjMap.classRef && viewObjMap.classRef[viewObjClsId] ) || [];
test(viewObjHits.length >= 1,
  'Grammar axiom-pos: view: { class: ... } object form emits classRef (' + viewObjClsId + ')');
test(viewObjHits.length >= 1 && viewObjHits[0].line === 7,
  'Grammar axiom-pos: view object classRef on line 7 (got: ' +
  ( viewObjHits[0] && viewObjHits[0].line ) + ')');
// String form still works alongside
var viewStrMap = axiomGrammar.collectAxiomPositions(
  "foam.CLASS({ package: 'test', name: 'VS', properties: [ { name: 'p', view: '" + viewObjClsId + "' } ] });"
);
test((( viewStrMap.classRef && viewStrMap.classRef[viewObjClsId] ) || []).length >= 1,
  'Grammar axiom-pos: view string form still emits classRef');
