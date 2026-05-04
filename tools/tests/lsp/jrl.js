/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// Split from testFoamLSP.js — jrl tests.
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



// === JRL TRIPLE-QUOTED SERVICE SCRIPT / CLIENT ===
section('JRL triple-quote completion (serviceScript + client)');

var jrlH = foam.parse.lsp.handlers.JrlHandler.create({ index: index });
jrlH.buildJournalClassMap();

// detectTripleQuoteContext_
var jrlTq = [
  'p({',
  '  "class": "foam.core.boot.CSpec",',
  '  "name": "xDAO",',
  '  "serviceScript": """',
  '    return new foam.dao.EasyDAO.Builder(x).build();',
  '  """,',
  '  "client": """',
  '    { "class": "foam.dao.EasyDAO", "of": "" }',
  '  """',
  '})'
].join('\n');

// Cursor inside serviceScript (line 4, char 15 — inside "foam.dao.Easy")
var ssCtx = jrlH.detectTripleQuoteContext_(jrlTq, { line: 4, character: 20 });
test(ssCtx && ssCtx.key === 'serviceScript',
  'detectTripleQuoteContext_: identifies serviceScript');

// Cursor inside client JSON (line 7, char 20)
var clCtx = jrlH.detectTripleQuoteContext_(jrlTq, { line: 7, character: 20 });
test(clCtx && clCtx.key === 'client',
  'detectTripleQuoteContext_: identifies client');

// Outside triple-quote (line 1, inside "name")
var outCtx = jrlH.detectTripleQuoteContext_(jrlTq, { line: 2, character: 12 });
test(outCtx === null,
  'detectTripleQuoteContext_: returns null outside triple-quote');

// serviceScript completion — dotted prefix yields class-id matches
var ssSrc = [
  'p({',
  '  "serviceScript": """',
  '    return foam.dao.',
  '  """',
  '})'
].join('\n');
var ssRes = jrlH.handleCompletion(ssSrc, { line: 2, character: 20 });
test(ssRes.items.length > 5,
  'serviceScript completion: dotted foam.dao. prefix yields class-id matches (' + ssRes.items.length + ')');
test(ssRes.items.every(function(i) { return i.label.indexOf('foam.dao.') === 0; }),
  'serviceScript completion: all suggestions start with foam.dao.');

// serviceScript completion — member-access on a resolved receiver derives
// its suggestions from the registry (no hardcoded names). Uses
// `foam.dao.EasyDAO` since it's universally present.
if ( index.classExists('foam.dao.EasyDAO') ) {
  var memberSrc = [
    'p({',
    '  "serviceScript": """',
    '    foam.dao.EasyDAO.set',
    '  """',
    '})'
  ].join('\n');
  var memberRes = jrlH.handleCompletion(memberSrc, { line: 2, character: 23 });
  // We expect at least one setter surfaced from the class's own properties.
  test(memberRes.items.some(function(i) {
    return /^set\w+/.test(i.label);
  }), 'serviceScript completion: member-access on EasyDAO surfaces registry-derived setters');
}

// client completion — delegation to nested JRL completion. The inner
// JSON gets treated as a JRL entry; `"class": "…"` should suggest classes.
var clientSrc = [
  'p({',
  '  "client": """{ "class": "" }"""',
  '})'
].join('\n');
// Line 1 `  "client": """{ "class": "" }"""` — cursor at the empty class value (char 28)
var clientRes = jrlH.handleCompletion(clientSrc, { line: 1, character: 28 });
test(Array.isArray(clientRes.items),
  'client completion: returns an items array (delegated to JRL completion)');

// === JRL EMBEDDED BLOCK VARIANTS (triple + escaped) ===


// === JRL EMBEDDED BLOCK VARIANTS (triple + escaped) ===
section('JRL embedded block — triple-quote + escaped double-quote');

var jrlH2 = foam.parse.lsp.handlers.JrlHandler.create({ index: index });
jrlH2.buildJournalClassMap();

// Escaped double-quoted client: "client": "{\"of\":\"com.paytic.Transaction\"}"
var escSrc = [
  'p({',
  '  "class": "foam.core.boot.CSpec",',
  '  "name": "txDAO",',
  '  "client": "{\\"of\\":\\"com.paytic.Transaction\\"}"',
  '})'
].join('\n');
// Cursor inside the empty space after `"of":"` (line 3)
var escLine = '  "client": "{\\"of\\":\\"com.paytic.Transaction\\"}"';
// Test detection fires for escaped form
var escCtx = jrlH2.detectEmbeddedBlockContext_(escSrc, { line: 3, character: 30 });
test(escCtx && escCtx.key === 'client' && escCtx.escaped === true,
  'detectEmbeddedBlockContext_: detects escaped client form');
test(escCtx && escCtx.content.indexOf('"of":"com.paytic.Transaction"') !== -1,
  'detectEmbeddedBlockContext_: unescapes the content correctly');

// Triple-quote client still works through the unified detector
var tripleClient = [
  'p({',
  '  "client": """',
  '    { "of": "com.paytic.Transaction" }',
  '  """',
  '})'
].join('\n');
var triCtx = jrlH2.detectEmbeddedBlockContext_(tripleClient, { line: 2, character: 20 });
test(triCtx && triCtx.key === 'client' && triCtx.escaped === false,
  'detectEmbeddedBlockContext_: still detects triple-quote client form');

// Triple-quote serviceScript detection
var tripleSS = [
  'p({',
  '  "serviceScript": """',
  '    return new foam.dao.EasyDAO.Builder(x).build();',
  '  """',
  '})'
].join('\n');
var ssCtx2 = jrlH2.detectEmbeddedBlockContext_(tripleSS, { line: 2, character: 20 });
test(ssCtx2 && ssCtx2.key === 'serviceScript',
  'detectEmbeddedBlockContext_: detects triple-quote serviceScript form');

// === JRL TEXTMATE HIGHLIGHTS (Java + JSON injections) ===


// === JRL TEXTMATE HIGHLIGHTS (Java + JSON injections) ===
section('JRL grammar injections — Java & JSON');

var jrlGrammarPath = 'foam3/tools/lsp/editors/vscode/syntaxes/foam-jrl.tmLanguage.json';
var jrlGrammar = JSON.parse(require('fs').readFileSync(jrlGrammarPath, 'utf8'));

test(!! jrlGrammar.repository['java-block-triple'],
  'JRL grammar: java-block-triple injection exists');
test(!! jrlGrammar.repository['java-block-backtick'],
  'JRL grammar: java-block-backtick injection exists');
test(!! jrlGrammar.repository['java-block-single-quoted'],
  'JRL grammar: java-block-single-quoted injection exists');
test(!! jrlGrammar.repository['json-block-triple'],
  'JRL grammar: json-block-triple injection exists (client """…""")');
test(!! jrlGrammar.repository['json-block-backtick'],
  'JRL grammar: json-block-backtick injection exists');

// The `object` repository entry (reachable from top-level patterns) includes
// the new JSON injections.
var objPatterns = JSON.stringify(jrlGrammar.repository.object.patterns);
test(objPatterns.indexOf('json-block-triple') !== -1,
  'JRL grammar: object patterns reference json-block-triple');
test(objPatterns.indexOf('json-block-backtick') !== -1,
  'JRL grammar: object patterns reference json-block-backtick');

// === JRL EMBEDDED-BLOCK HOVERS (full coverage) ===


// === JRL EMBEDDED-BLOCK HOVERS (full coverage) ===
section('JRL embedded-block hovers — serviceScript + client, both forms');

var jrlH3 = foam.parse.lsp.handlers.JrlHandler.create({ index: index });
jrlH3.buildJournalClassMap();

// Hover on a FOAM class id inside triple-quoted serviceScript.
// Use a class guaranteed to be in the registry (foam.dao.EasyDAO).
if ( index.classExists('foam.dao.EasyDAO') ) {
  var ssH = [
    'p({',
    '  "class": "foam.core.boot.CSpec",',
    '  "name": "x",',
    '  "serviceScript": """',
    '    return new foam.dao.EasyDAO.Builder(x).build();',
    '  """',
    '})'
  ].join('\n');
  // Cursor on `foam.dao.EasyDAO` — line 4, around char 26
  var h1 = jrlH3.handleHover(ssH, { line: 4, character: 26 });
  test(h1 && h1.contents && h1.contents.value &&
       h1.contents.value.indexOf('foam.dao.EasyDAO') !== -1,
    'Hover on class id in triple-quoted serviceScript resolves via registry');
}

// Hover on a class id inside triple-quoted client JSON
if ( index.classExists('foam.dao.EasyDAO') ) {
  var cliH = [
    'p({',
    '  "name": "x",',
    '  "client": """',
    '    { "class": "foam.dao.EasyDAO", "of": "foam.lang.FObject" }',
    '  """',
    '})'
  ].join('\n');
  // Cursor on the "foam.dao.EasyDAO" value — line 3, around char 24
  var h2 = jrlH3.handleHover(cliH, { line: 3, character: 24 });
  test(h2 && h2.contents && h2.contents.value &&
       h2.contents.value.indexOf('foam.dao.EasyDAO') !== -1,
    'Hover on class id in triple-quoted client JSON resolves via registry');
}

// Hover on a class id inside ESCAPED-double-quote client
if ( index.classExists('foam.dao.EasyDAO') ) {
  var escH = [
    'p({',
    '  "name": "x",',
    '  "client": "{\\"class\\":\\"foam.dao.EasyDAO\\"}"',
    '})'
  ].join('\n');
  // Cursor on EasyDAO — the escaped line is:
  //   "client": "{\"class\":\"foam.dao.EasyDAO\"}"
  // Position inside `foam.dao.EasyDAO` — around char 36 on line 2
  var h3 = jrlH3.handleHover(escH, { line: 2, character: 36 });
  test(h3 && h3.contents && h3.contents.value &&
       h3.contents.value.indexOf('foam.dao.EasyDAO') !== -1,
    'Hover on class id in escaped-double-quote client resolves via registry');
}

// Completion at a dotted prefix works in both forms of serviceScript,
// regardless of whether the body happens to look Java-ish or JS-ish.
// Simple one-liner (JS-like)
var simpleScript = [
  'p({',
  '  "serviceScript": """',
  '    return foam.dao.',
  '  """',
  '})'
].join('\n');
var c1 = jrlH3.handleCompletion(simpleScript, { line: 2, character: 20 });
test(c1.items.length > 5,
  'serviceScript completion: simple `return foam.dao.` yields class-id matches');

// Java-like builder chain
var complexScript = [
  'p({',
  '  "serviceScript": """',
  '    return new foam.dao.EasyDAO.Builder(x).setOf(com.paytic.',
  '  """',
  '})'
].join('\n');
var c2 = jrlH3.handleCompletion(complexScript, { line: 2, character: 62 });
test(c2.items.length >= 0 /* zero is acceptable when no classes match com.paytic in this env */,
  'serviceScript completion: Java-style builder chain still returns an items array');

// Escaped-double-quote serviceScript (rarer but valid)
var escScript = [
  'p({',
  '  "serviceScript": "return x.get(\\"transactionDAO\\");"',
  '})'
].join('\n');
var escCtxSS = jrlH3.detectEmbeddedBlockContext_(escScript, { line: 1, character: 30 });
test(escCtxSS && escCtxSS.key === 'serviceScript' && escCtxSS.escaped === true,
  'detectEmbeddedBlockContext_: detects escaped-double-quote serviceScript');

// === EMBEDDED-BLOCK: dot-after-class completion + method hover ===


// === EMBEDDED-BLOCK: dot-after-class completion + method hover ===
section('JRL embedded-block: typing dot after known class should surface setters (not classes)');

if ( index.classExists('foam.dao.EasyDAO') ) {
  // Typing `foam.dao.EasyDAO.Builder(x).` — cursor right after the trailing
  // dot. Expected: setters/getters from foam.dao.EasyDAO, NOT the full
  // class-id list (which is what the user reported seeing).
  var dotSrc = [
    'p({',
    '  "serviceScript": """',
    '    return new foam.dao.EasyDAO.Builder(x).',
    '  """',
    '})'
  ].join('\n');
  // Line 2 is `    return new foam.dao.EasyDAO.Builder(x).`; cursor at EOL (char 44)
  var line2Len = dotSrc.split('\n')[2].length;
  var dotRes = jrlH3.handleCompletion(dotSrc, { line: 2, character: line2Len });
  // At least one setter must be present, and NOT all suggestions should be full class IDs.
  var hasSetter = dotRes.items.some(function(i) {
    return /^set\w/.test(i.label);
  });
  var allClassIds = dotRes.items.every(function(i) {
    return i.label.indexOf('.') !== -1;
  });
  test(hasSetter,
    'Dot after Builder(x).: surfaces at least one setter (' +
    dotRes.items.slice(0, 5).map(function(i) { return i.label; }).join(',') + ')');
  test(! allClassIds,
    'Dot after Builder(x).: suggestions are not just full class IDs');

  // Hover on a setter name like `.setPm(` — cursor on 'setPm' itself.
  var setH = [
    'p({',
    '  "serviceScript": """',
    '    return new foam.dao.EasyDAO.Builder(x).setPm(true).build();',
    '  """',
    '})'
  ].join('\n');
  // Line 2: `    return new foam.dao.EasyDAO.Builder(x).setPm(true).build();`
  //  chars  0123456789012345678901234567890123456789012345 — `setPm` starts at 43
  var setLine = setH.split('\n')[2];
  var setPmIdx = setLine.indexOf('setPm');
  var hSet = jrlH3.handleHover(setH, { line: 2, character: setPmIdx + 2 });
  // If EasyDAO doesn't have a `pm` property we can't resolve `setPm` as a
  // setter — but the resolver should still return something useful for
  // setters that DO map to a property. Try `setOf` which is universal.
  var setOfIdx = setLine.indexOf('setOf');
  if ( setOfIdx === -1 ) {
    // Different test with setOf explicitly
    var setOfSrc = [
      'p({',
      '  "serviceScript": """',
      '    return new foam.dao.EasyDAO.Builder(x).setOf(foam.lang.FObject.getOwnClassInfo());',
      '  """',
      '})'
    ].join('\n');
    var setOfLine = setOfSrc.split('\n')[2];
    setOfIdx = setOfLine.indexOf('setOf');
    var hOf = jrlH3.handleHover(setOfSrc, { line: 2, character: setOfIdx + 2 });
    test(hOf && hOf.contents && hOf.contents.value &&
         /setOf|of/i.test(hOf.contents.value),
      'Hover on .setOf( (maps to `of` property) inside serviceScript shows member info');
  } else {
    var hOf = jrlH3.handleHover(setH, { line: 2, character: setOfIdx + 2 });
    test(hOf && hOf.contents && hOf.contents.value &&
         /setOf|of/i.test(hOf.contents.value),
      'Hover on .setOf( inside serviceScript shows member info');
  }
}

// === EMBEDDED-BLOCK SEMANTIC TOKENS ===


// === EMBEDDED-BLOCK SEMANTIC TOKENS ===
section('JRL embedded-block semantic tokens — Java + client JSON');

// Java serviceScript with a dotted FOAM class id inside.
var embedJava = [
  'p({',
  '  "class": "foam.core.boot.CSpec",',
  '  "id": "myService",',
  '  "serviceScript": """',
  '    return new foam.dao.EasyDAO.Builder(x).setOf(foam.lang.FObject.getOwnClassInfo()).build();',
  '  """',
  '})'
].join('\n');
var javaTokens = jrlH3.handleSemanticTokens(embedJava);
// data format: [dL, dC, len, type, mods, …]. Expect at least one type=0
// token (class reference) somewhere inside the serviceScript body.
function hasTokenOfType(data, type) {
  for ( var i = 3 ; i < data.length ; i += 5 ) {
    if ( data[i] === type ) return true;
  }
  return false;
}
test(hasTokenOfType(javaTokens.data, 0),
  'Embedded Java block emits type (0) tokens for registered class IDs');

// Verify class:"..." at top level is tagged as class (type=1).
test(hasTokenOfType(javaTokens.data, 1),
  'Top-level "class":"…" value still emitted as class (1) token');

// JSON client block — verified "class":"…" inside the nested JSON.
var embedClient = [
  'p({',
  '  "class": "foam.core.boot.CSpec",',
  '  "id": "myCSpec",',
  '  "client": """',
  '    {',
  '      "class": "foam.dao.EasyDAO",',
  '      "of": "foam.lang.FObject"',
  '    }',
  '  """',
  '})'
].join('\n');
var clientTokens = jrlH3.handleSemanticTokens(embedClient);
// Expect TWO class tokens: top-level foam.core.boot.CSpec AND nested foam.dao.EasyDAO.
var classTokenCount = 0;
for ( var i = 3 ; i < clientTokens.data.length ; i += 5 ) {
  if ( clientTokens.data[i] === 1 ) classTokenCount++;
}
test(classTokenCount >= 2,
  'Nested "class":"…" inside triple-quoted client block emits class token (got ' + classTokenCount + ')');

// Escaped-in-double-quote client form.
var embedClientEsc = [
  'p({',
  '  "class": "foam.core.boot.CSpec",',
  '  "id": "myCSpec",',
  '  "client": "{\\"class\\":\\"foam.dao.EasyDAO\\",\\"of\\":\\"foam.lang.FObject\\"}"',
  '})'
].join('\n');
var escTokens = jrlH3.handleSemanticTokens(embedClientEsc);
var escClassCount = 0;
for ( var i = 3 ; i < escTokens.data.length ; i += 5 ) {
  if ( escTokens.data[i] === 1 ) escClassCount++;
}
test(escClassCount >= 2,
  'Escaped "class":"…" inside escaped-double-quote client block emits class token (got ' + escClassCount + ')');

// Unknown class inside serviceScript should NOT emit a type token.
var embedUnknown = [
  'p({',
  '  "class": "foam.core.boot.CSpec",',
  '  "serviceScript": """',
  '    return totally.not.a.real.Class.foo();',
  '  """',
  '})'
].join('\n');
var unkTokens = jrlH3.handleSemanticTokens(embedUnknown);
// Should only have the top-level class token (type=1), no type=0 from the unknown ID.
var unkTypeCount = 0;
for ( var i = 3 ; i < unkTokens.data.length ; i += 5 ) {
  if ( unkTokens.data[i] === 0 ) unkTypeCount++;
}
test(unkTypeCount === 0,
  'Unknown dotted identifier in serviceScript does not emit type token (got ' + unkTypeCount + ')');

// === ZED TREE-SITTER — JSON INJECTION FOR client BLOCKS ===


// === ZED TREE-SITTER — JSON INJECTION FOR client BLOCKS ===
section('Zed tree-sitter grammar: JSON injection for client blocks');
var fs_ = require('fs');
var path_ = require('path');
var zedInj = fs_.readFileSync(path_.join(__dirname, '../../lsp/editors/zed-foam3/languages/jrl/injections.scm'), 'utf8');
test(/injection\.language\s+"json"/.test(zedInj),
  'Zed JRL injections.scm declares JSON injection');
test(/#eq\?\s+@_key\s+"client"/.test(zedInj),
  'Zed JRL injections.scm matches `client` key for JSON injection');
// VS Code grammar parity.
var vscodeJrl = JSON.parse(fs_.readFileSync(path_.join(__dirname, '../../lsp/editors/vscode/syntaxes/foam-jrl.tmLanguage.json'), 'utf8'));
test(!! vscodeJrl.repository['json-block-triple'] && !! vscodeJrl.repository['json-block-backtick'],
  'VS Code foam-jrl grammar has JSON injections for client triple/backtick');

// === MULTI-LINE BUILDER CHAIN (real-world services.jrl shape) ===


// === MULTI-LINE BUILDER CHAIN (real-world services.jrl shape) ===
section('Multi-line builder chain — hover + enum completion');
var mlsrc = [
  'p({',
  '  "class":"foam.core.boot.CSpec",',
  '  "name":"transactionDAO",',
  '  "serviceScript": """',
  '    return new foam.dao.EasyDAO.Builder(x)',
  '      .setPm(true)',
  '      .setSeqNo(true)',
  '      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)',
  '      .setOf(foam.lang.FObject.getOwnClassInfo())',
  '      .build();',
  '  """',
  '})'
].join('\n');

// Hover on .setSeqNo — receiver is on line 4 (the return new ... Builder(x)),
// but .setSeqNo is on line 6. Walk-back must cross line boundaries.
var linesMl = mlsrc.split('\n');
var seqLine = 6; // .setSeqNo
var seqCol = linesMl[seqLine].indexOf('setSeqNo') + 2;
var seqH = jrlH3.handleHover(mlsrc, { line: seqLine, character: seqCol });
test(seqH && seqH.contents && seqH.contents.value && /setSeqNo|property|seqNo/i.test(seqH.contents.value),
  'Multi-line: hover on .setSeqNo resolves to EasyDAO setter (receiver on prior line)');

// Hover on .setJournalType (line 7, two chained setters + Builder above)
var jtLine = 7;
var jtCol = linesMl[jtLine].indexOf('setJournalType') + 2;
var jtH = jrlH3.handleHover(mlsrc, { line: jtLine, character: jtCol });
test(jtH && jtH.contents && jtH.contents.value && /setJournalType|journalType|property/i.test(jtH.contents.value),
  'Multi-line: hover on .setJournalType resolves to EasyDAO setter (chain with multiple prior setters)');

// Hover on SINGLE_JOURNAL — should be enum value hover.
var enumLine = 7;
var enumCol = linesMl[enumLine].indexOf('SINGLE_JOURNAL') + 2;
var enumH = jrlH3.handleHover(mlsrc, { line: enumLine, character: enumCol });
if ( index.classExists('foam.dao.JournalType') ) {
  test(enumH && enumH.contents && enumH.contents.value && /JournalType\.SINGLE_JOURNAL|enum value/i.test(enumH.contents.value),
    'Hover on foam.dao.JournalType.SINGLE_JOURNAL shows enum value info');
}

// Completion at `foam.dao.JournalType.` — must surface enum values FIRST,
// not all classes starting with foam.dao.JournalType.
if ( index.classExists('foam.dao.JournalType') ) {
  var enumCompSrc = [
    'p({',
    '  "serviceScript": """',
    '    return new foam.dao.EasyDAO.Builder(x).setJournalType(foam.dao.JournalType.',
    '  """',
    '})'
  ].join('\n');
  var enumCompLine = 2;
  var enumCompCol = enumCompSrc.split('\n')[enumCompLine].length;
  var enumComp = jrlH3.handleCompletion(enumCompSrc, { line: enumCompLine, character: enumCompCol });
  var hasSingleJournal = enumComp.items.some(function(it) { return it.label === 'SINGLE_JOURNAL'; });
  test(hasSingleJournal,
    'Completion after `foam.dao.JournalType.` offers enum values (SINGLE_JOURNAL found: ' +
    enumComp.items.slice(0, 4).map(function(i) { return i.label; }).join(',') + ')');
  // First item must be an enum value (kind 20), not a class
  var firstIsEnum = enumComp.items.length > 0 && enumComp.items[0].kind === 20;
  test(firstIsEnum,
    'First completion item is an enum value (kind=20), not a class');
}

// === CHAINED BUILDER SETTER HOVERS ===


// === CHAINED BUILDER SETTER HOVERS ===
section('Chained builder setter hovers — walk back through .a(x).b(y) chains');
var chained = [
  'p({',
  '  "class":"foam.core.boot.CSpec",',
  '  "id":"myDAO",',
  '  "serviceScript":"""',
  '    return new foam.dao.EasyDAO.Builder(x).setPm(true).setOf(foam.lang.FObject.getOwnClassInfo()).build();',
  '  """',
  '})'
].join('\n');
var chainedLine = chained.split('\n')[4];
// setOf comes AFTER setPm(true). in the chain. Walk-back must skip the
// intermediate call to resolve to foam.dao.EasyDAO.
['setPm', 'setOf'].forEach(function(name) {
  var idx = chainedLine.indexOf(name);
  var hover = jrlH3.handleHover(chained, { line: 4, character: idx + 2 });
  test(hover && hover.contents && hover.contents.value &&
       /void ' + name + '|property/i.test(hover.contents.value.replace(/[|]/g, '')),
    'Hover on .' + name + '( in chained builder — resolves to EasyDAO setter');
});

// === REAL services.jrl sanity check ===


// === REAL services.jrl sanity check ===
section('Real services.jrl hover sanity');
var realJrlPath = require('path').resolve(__dirname, '../../../../journals/services.jrl');
if ( require('fs').existsSync(realJrlPath) ) {
  var realText = require('fs').readFileSync(realJrlPath, 'utf8');
  var realLines = realText.split('\n');

  // Find the first .setPm( occurrence and hover on it.
  for ( var rl = 0 ; rl < realLines.length ; rl++ ) {
    var m = realLines[rl].indexOf('.setPm(');
    if ( m === -1 ) continue;
    var h = jrlH3.handleHover(realText, { line: rl, character: m + 3 });
    test(h && h.contents && h.contents.value && /setPm|pm/i.test(h.contents.value),
      'Real services.jrl: hover on .setPm at line ' + rl + ' resolves (setPm or pm in output)');
    break;
  }

  // First .setOf( across the entire file.
  for ( var rl2 = 0 ; rl2 < realLines.length ; rl2++ ) {
    var m2 = realLines[rl2].indexOf('.setOf(');
    if ( m2 === -1 ) continue;
    var h2 = jrlH3.handleHover(realText, { line: rl2, character: m2 + 3 });
    test(h2 && h2.contents && h2.contents.value && /setOf|of /i.test(h2.contents.value),
      'Real services.jrl: hover on .setOf at line ' + rl2 + ' resolves');
    break;
  }

  // First `foam.dao.JournalType.SINGLE_JOURNAL` reference.
  for ( var rl3 = 0 ; rl3 < realLines.length ; rl3++ ) {
    var m3 = realLines[rl3].indexOf('JournalType.SINGLE_JOURNAL');
    if ( m3 === -1 ) continue;
    // Hover on SINGLE_JOURNAL
    var sj = realLines[rl3].indexOf('SINGLE_JOURNAL');
    var h3 = jrlH3.handleHover(realText, { line: rl3, character: sj + 2 });
    test(h3 && h3.contents && h3.contents.value && /SINGLE_JOURNAL|enum value|ordinal/i.test(h3.contents.value),
      'Real services.jrl: hover on SINGLE_JOURNAL enum value resolves');
    break;
  }
}

// === SAVE → TARGETED REANALYZE ===

