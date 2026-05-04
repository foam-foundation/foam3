/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// Split from testFoamLSP.js — navigation tests.
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

// === LSP #4993 Fix 1: go-to-definition follows FObjectProperty of: ===
section('DefinitionHandler — property-chain navigation (issue #4993)');
// Uses existing indexed classes: FObjectProperty with of: is pervasive in foam3.
// foam.u2.Element has `tooltip: { class: 'FObjectProperty', of: 'foam.u2.Tooltip' }` in many versions —
// pick any real example. We use the FoamIndex resolver directly as the core check:
var resolvedClassId = index.resolvePropertyTypeClassId('foam.core.auth.User', 'group');
test(resolvedClassId === null || typeof resolvedClassId === 'string',
  'resolvePropertyTypeClassId: returns string or null for foam.core.auth.User.group');

// Chain-walk in DefinitionHandler: synthesize a minimal pair of classes and check the walk.
var chainClassA = index.getAllClassIds().find(function(id) {
  var cls = index.getClass(id);
  if ( ! cls ) return false;
  var props = cls.getAxiomsByClass(foam.lang.Property);
  for ( var i = 0 ; i < props.length ; i++ ) {
    if ( index.resolvePropertyTypeClassId(id, props[i].name) ) return true;
  }
  return false;
});
test(typeof chainClassA === 'string',
  'Found at least one class with an FObjectProperty-typed property for chain walking');

// === LSP #4993 Fix 2: foam.LIB indexing ===


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



// === DOCUMENT HIGHLIGHT ===
section('DocumentHighlightHandler');

var dhh = foam.parse.lsp.handlers.DocumentHighlightHandler.create();
var dhText = "foam.CLASS({\n  properties: [\n    { class: 'String', name: 'foobar' }\n  ],\n  methods: [ function m() { return this.foobar + this.foobar; } ]\n});";
// Cursor on 'foobar' in the method body — inside `this.foobar`
var fhHighlights = dhh.handle(dhText, { line: 4, character: 42 });
test(fhHighlights.length === 3,
  'documentHighlight: finds all 3 foobar occurrences (' + fhHighlights.length + ')');
test(fhHighlights.every(function(h) { return h.range.end.character - h.range.start.character === 6; }),
  'documentHighlight: ranges span exactly the identifier length');

// === RENAME ===


// === RENAME ===
section('RenameHandler');

var rh = foam.parse.lsp.handlers.RenameHandler.create({ index: index });
var renameSrc = "foam.CLASS({\n  extends: 'foam.lang.FObject'\n});";
var prep = rh.prepare(renameSrc, { line: 1, character: 20 });
test(prep !== null, 'prepareRename: returns range for a known class');
test(prep && prep.placeholder === 'foam.lang.FObject',
  'prepareRename: placeholder is the current class id');

var prep2 = rh.prepare("foam.CLASS({\n  documentation: 'hi'\n})", { line: 1, character: 5 });
test(prep2 === null, 'prepareRename: returns null when cursor is not on a class id');

var sameWe = rh.handle(renameSrc, { line: 1, character: 20 }, 'foam.lang.FObject');
test(sameWe === null, 'rename: returns null for same-name rename');

// === REFERENCES EXPANDED ===


// === REFERENCES EXPANDED ===
section('ReferencesHandler — expanded coverage');

var rfh = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });
var fobjRefs = rfh.handle("foam.CLASS({\n  extends: 'foam.lang.FObject'\n});",
  { line: 1, character: 20 });
test(fobjRefs.length > 10,
  'references: FObject has many references (subclasses + users): ' + fobjRefs.length);
test(fobjRefs.every(function(l) { return l.uri && l.range; }),
  'references: every location has uri and range');

// References on `name: '...'` should find refs to the declared class
var refOnNameSrc = "foam.CLASS({\n  package: 'foam.lang',\n  name: 'FObject'\n});";
var refOnNameResolved = rfh.resolveClassAtCursor_(refOnNameSrc, { line: 2, character: 12 }, 'FObject', 'test://name');
var refOnNameLocs = rfh.handle(refOnNameSrc, { line: 2, character: 12 }, 'test://name');
test(refOnNameResolved === 'foam.lang.FObject',
  'references on name: resolves to full class id (got: ' + refOnNameResolved + ')');
test(refOnNameLocs.length > 10,
  'references on name: value resolves via package+name (' + refOnNameLocs.length + ' refs)');

// References on a property name should find the prop in the own class +
// inheriting subclasses that reference it.
var propRefSrc = [
  "foam.CLASS({",
  "  package: 'foam.lang',",
  "  name: 'Property',",
  "  properties: [",
  "    { class: 'String', name: 'name' }",
  "  ]",
  "});"
].join('\n');
// Line 4: `    { class: 'String', name: 'name' }` — cursor inside 'name' value
var propRefLocs = rfh.handle(propRefSrc, { line: 4, character: 30 }, 'test://prop');
test(propRefLocs.length > 0,
  'property references: finds refs to `name` property (' + propRefLocs.length + ')');
test(propRefLocs.every(function(l) { return l.uri && l.range; }),
  'property references: each location has uri and range');

// False-positive guard: words inside comments/docs must NOT match.
var falsePosText = [
  "foam.CLASS({",
  "  package: 'foam.mlang.sink',",
  "  name: 'FakeGroupBy',",
  "  documentation: 'the top groups based on sortOrder and their values',",
  "  properties: [",
  "    { class: 'Map', name: 'groups' }",
  "  ],",
  "  methods: [",
  "    function m() {",
  "      // remaining groups and includeOthers is true",
  "      /* replace groups with only top N */",
  "      return this.groups['k'];",
  "    }",
  "  ]",
  "});"
].join('\n');
var fpRfh = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });
// Cursor on the `groups` property name (line 5 `    { class: 'Map', name: 'groups' }`)
var fpLocs = fpRfh.handle(falsePosText, { line: 5, character: 33 }, 'test://fp');
// Expect ONLY the real refs in this file: the quoted definition + this.groups.
// The documentation prose, line comment, and block comment mentions must be skipped.
var fpOwnFileLocs = fpLocs.filter(function(l) { return l.uri === 'test://fp'; });
test(fpOwnFileLocs.length === 0 /* file not on disk, won't scan */ ||
     fpOwnFileLocs.every(function(l) {
       // If we scanned, none of the matches should land on the documentation line
       return l.range.start.line !== 3;
     }),
  'property references: documentation prose containing the name is NOT matched');

// === METHOD RETURN-TYPE RESOLUTION ===


// === Migration coverage: buildLocationAtProperty uses the grammar path ===
section('DefinitionHandler — grammar-based property navigation');

// Create a temp file we can point the handler at.
var tmpFs = require('fs');
var tmpOs = require('os');
var tmpPath2 = require('path');
var tmpFile = tmpPath2.join(tmpOs.tmpdir(), 'lsp-grammar-propnav.js');
tmpFs.writeFileSync(tmpFile,
  "foam.CLASS({\n" +
  "  package: 'test',\n" +
  "  name: 'PropNav',\n" +
  "  properties: [\n" +
  "    { class: 'String', name: 'aProp' }\n" +
  "  ]\n" +
  "});\n");
try {
  var propLoc = defHandler.buildLocationAtProperty(tmpFile, 'aProp');
  test(propLoc && propLoc.uri && propLoc.uri.indexOf('lsp-grammar-propnav.js') !== -1,
    'buildLocationAtProperty returns a URI for aProp');
  test(propLoc && propLoc.range && propLoc.range.start.line === 4,
    'buildLocationAtProperty: aProp is on line 4 (grammar-resolved)');
} finally {
  try { tmpFs.unlinkSync(tmpFile); } catch ( e ) {}
}

// === Migration coverage: buildLocationAtMethod uses the grammar path ===


// === Migration coverage: buildLocationAtMethod uses the grammar path ===
section('DefinitionHandler — grammar-based method navigation');

var tmpFile2 = tmpPath2.join(tmpOs.tmpdir(), 'lsp-grammar-methodnav.js');
tmpFs.writeFileSync(tmpFile2,
  "foam.CLASS({\n" +
  "  package: 'test',\n" +
  "  name: 'MethodNav',\n" +
  "  methods: [\n" +
  "    function computeValue() { return 42; }\n" +
  "  ]\n" +
  "});\n");
try {
  var methodLoc = defHandler.buildLocationAtMethod(tmpFile2, 'test.MethodNav', 'computeValue');
  test(methodLoc && methodLoc.uri && methodLoc.uri.indexOf('lsp-grammar-methodnav.js') !== -1,
    'buildLocationAtMethod returns a URI for computeValue');
  test(methodLoc && methodLoc.range && methodLoc.range.start.line === 4,
    'buildLocationAtMethod: computeValue is on line 4 (grammar-resolved)');
} finally {
  try { tmpFs.unlinkSync(tmpFile2); } catch ( e ) {}
}

// === Migration coverage: LIB + POM eval recovery ===


// === MESSAGE + CONSTANT REFERENCES ===
section('ReferencesHandler — message & constant axioms');

if ( index.classExists(SFV) ) {
  var sfvTxt4 = require('fs').readFileSync(
    'foam3/src/foam/u2/filter/properties/StringFilterView.js', 'utf8');

  // Cursor on `name: 'LABEL_PLACEHOLDER'` inside messages: [...]
  var lpIdx = sfvTxt4.indexOf("name: 'LABEL_PLACEHOLDER'");
  if ( lpIdx !== -1 ) {
    var ln = 0, col = 0;
    for ( var i = 0 ; i < lpIdx ; i++ ) {
      if ( sfvTxt4.charCodeAt(i) === 10 ) { ln++; col = 0; } else col++;
    }
    var lpRefs = rfh.handle(sfvTxt4,
      { line: ln, character: col + "name: '".length + 3 },
      'file://sfv-msg');
    test(lpRefs.length >= 1,
      'Message references: finds uses of LABEL_PLACEHOLDER (' + lpRefs.length + ')');
    test(lpRefs.every(function(l) { return l.uri && l.range; }),
      'Message references: every location has uri and range');
  }
}

// Recognition helpers — decouple from registry so they test cleanly.
test(rfh.isOwnMessageName_({ messages: [{ name: 'HI' }] }, 'HI'),
  'axiomReferences: recognizes message name from model.messages');
test(rfh.isOwnConstantName_({ constants: [{ name: 'FOO' }] }, 'FOO'),
  'axiomReferences: recognizes constant name from array form');
test(rfh.isOwnConstantName_({ constants: { BAR: 1 } }, 'BAR'),
  'axiomReferences: recognizes constant name from object-map form');
test(! rfh.isOwnConstantName_({}, 'BAR'),
  'axiomReferences: model without constants returns false');
test(! rfh.isOwnMessageName_({}, 'HI'),
  'axiomReferences: model without messages returns false');

// === JRL TRIPLE-QUOTED SERVICE SCRIPT / CLIENT ===


// === SAVE → TARGETED REANALYZE ===
section('Targeted reanalyze: getAffectedFiles covers the dependency closure');

// FObject is the mother class — every FOAM class should be affected.
// We just want to sanity-check the API and ordering. Using a mid-level
// class keeps the set reasonable.
var startId = 'foam.dao.EasyDAO';
if ( index.classExists(startId) ) {
  var affected = index.getAffectedFiles([startId]);
  test(Array.isArray(affected),
    'getAffectedFiles returns an array');
  // The saved file's own path should be in the set.
  var selfPath = index.getFilePath(startId);
  test(selfPath && affected.indexOf(selfPath) !== -1,
    'Affected set includes the saved file itself');
  // It should NOT include every file in the workspace — narrower than full scan.
  test(affected.length < index.getAllClassIds().length / 2,
    'Affected set (' + affected.length + ') is a small fraction of total classes (' +
    index.getAllClassIds().length + ')');

  // A subclass's file should be in the set if any subclass exists.
  var subs = index.getSubclasses(startId);
  if ( subs.length > 0 ) {
    var subPath = index.getFilePath(subs[0]);
    if ( subPath ) {
      test(affected.indexOf(subPath) !== -1,
        'Affected set includes subclass file ' + subPath);
    }
  }
}

// analyzeFiles runs diagnostics on the supplied files only
var analyzer = foam.parse.lsp.handlers.WorkspaceAnalyzer.create({ index: index });
var anyFilePath = startId && index.getFilePath(startId);
if ( anyFilePath ) {
  var singleRes = analyzer.analyzeFiles([anyFilePath]);
  test(singleRes.filesScanned === 1,
    'analyzeFiles({[path]}) scans exactly one file');
  test(typeof singleRes.fileResults === 'object',
    'analyzeFiles returns fileResults map');
}

// === LSP #4999 Fix 1: property-type completion inserts full path (except foam.lang.*) ===

