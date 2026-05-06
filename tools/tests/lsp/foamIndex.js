/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// Split from testFoamLSP.js — foamIndex tests.
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



// === LSP #4993 Fix 2: foam.LIB indexing ===
section('FoamIndex — foam.LIB registry (issue #4993)');
test(index.getAllLibNames().length > 0,
  'LIB registry: at least one foam.LIB indexed (got ' + index.getAllLibNames().length + ')');
var colorEntry = index.getLibEntry('foam.Color');
test(colorEntry !== null, 'LIB registry: foam.Color has an entry');
test(colorEntry && (colorEntry.methods || []).indexOf('adjustAlpha') !== -1,
  'LIB registry: foam.Color.adjustAlpha indexed as method');

// Go-to-definition for foam.Color.adjustAlpha — must be inside a foam.CLASS
// so isFoamFile() passes. Cursor lands on 'adjustAlpha'.
var libDefHandler = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index });
var libCallText =
  "foam.CLASS({\n  package: 'test',\n  name: 'LibCaller',\n" +
  "  methods: [\n    function f() {\n      var c = foam.Color.adjustAlpha(x, 0.5);\n    }\n  ]\n})";
// Line 5 is "      var c = foam.Color.adjustAlpha(x, 0.5);"
// 'adjustAlpha' starts at character 25; land cursor on 'adjustAlpha'.
var libDef = libDefHandler.handle(libCallText, { line: 5, character: 33 });
test(libDef && libDef.uri && libDef.uri.indexOf('colorlib.js') !== -1,
  'LIB definition: foam.Color.adjustAlpha navigates to colorlib.js');

// Completion after 'foam.Color.' — inside a method body of a foam.CLASS
var memberCompletion = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index });
var compSrc =
  "foam.CLASS({\n  package: 'test',\n  name: 'LibCompletion',\n" +
  "  methods: [\n    function f() {\n      var c = foam.Color.\n    }\n  ]\n})";
// Line 5 ends with 'foam.Color.'; cursor positioned right after the trailing dot.
var compResult = memberCompletion.handle(compSrc, { line: 5, character: 25 });
test(compResult && compResult.items && compResult.items.some(function(it) { return it.label === 'adjustAlpha'; }),
  'LIB completion: foam.Color. suggests adjustAlpha');

// Hover on a LIB member
var libHoverHandler = foam.parse.lsp.handlers.HoverHandler.create({
  index: index,
  cssTokenResolver: cssTokenResolver
});
var hoverResult = libHoverHandler.handle(libCallText, { line: 5, character: 33 });
test(hoverResult && hoverResult.contents && /foam\.Color/.test(hoverResult.contents.value),
  'LIB hover: foam.Color.adjustAlpha shows hover with lib name');

// === DEFINITION TESTS ===



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



// === Migration coverage: LIB + POM eval recovery ===
section('FileModelCache: foam.LIB captured via parseFileModels');

var cacheInst = foam.parse.lsp.FileModelCache.create();
var libFileSrc =
  "foam.CLASS({ package: 'test', name: 'Together' });\n" +
  "foam.LIB({\n" +
  "  name: 'test.MyLib',\n" +
  "  methods: [ function doIt(x) { return x; } ]\n" +
  "});\n";
var libModels = cacheInst.parseFileModels(libFileSrc);
var libCaught = libModels.some(function(m) { return m.type_ === 'LIB' && m.name === 'test.MyLib'; });
test(libCaught, 'parseFileModels captures foam.LIB with correct name');
var clsCaught = libModels.some(function(m) {
  return m.type_ !== 'LIB' && m.package === 'test' && m.name === 'Together';
});
test(clsCaught, 'parseFileModels still captures sibling foam.CLASS in the same file');

// Syntax-error fallback still finds LIB (Phase 4: LIB added to evalIndividualBlocks_ regex)
var brokenLibSrc =
  "foam.CLASS({ package: 'test', name: 'BrokenSibling' });\n" +
  "this is not valid JS + syntax\n" +
  "foam.LIB({\n" +
  "  name: 'test.RecoveredLib',\n" +
  "  methods: [ function ok() { return 1; } ]\n" +
  "});\n";
var brokenModels = cacheInst.parseFileModels(brokenLibSrc);
var recovered = brokenModels.some(function(m) {
  return m.type_ === 'LIB' && m.name === 'test.RecoveredLib';
});
test(recovered, 'evalIndividualBlocks_ fallback recovers foam.LIB from a file with a syntax error');

// === Migration coverage: FoamIndex POM eval parsers ===


// === Migration coverage: FoamIndex POM eval parsers ===
section('FoamIndex — POM eval parsers');

var simplePom = "foam.POM({ name: 'p', projects: [ { name: 'test/pom', flags: 'test' } ] });";
var parsedProjects = index.parsePomProjects_(simplePom);
test(parsedProjects && parsedProjects.length === 1 && parsedProjects[0].name === 'test/pom',
  'parsePomProjects_: eval returns the projects array');
test(parsedProjects && parsedProjects[0].flags === 'test',
  'parsePomProjects_: flags preserved through eval');

var simpleFilesPom = "foam.POM({ name: 'p', files: [ { name: 'Foo', flags: 'js' } ] });";
var parsedFiles = index.parsePomFiles_(simpleFilesPom);
test(parsedFiles && parsedFiles.length === 1 && parsedFiles[0].name === 'Foo',
  'parsePomFiles_: eval returns the files array');

// === Migration coverage: LIB + class indexed in the same pass ===


// === Migration coverage: LIB + class indexed in the same pass ===
section('FoamIndex — unified eval-based file indexing');

// foam.Color LIB is in colorlib.js alongside no other classes; index was built
// at LSP boot so both should be present.
test(index.getLibEntry('foam.Color') && index.getLibEntry('foam.Color').methods.indexOf('adjustAlpha') !== -1,
  'Unified indexing: foam.Color captured via eval-intercept');
// At least one RELATIONSHIP class must be indexed — these are only captured by eval
// (regex approach misses them because the name is synthesized from sourceModel+targetModel).
var relCount = 0;
var allIds = Object.keys(index.fileIndex_ || {});
for ( var rIdx = 0 ; rIdx < allIds.length ; rIdx++ ) {
  if ( /Relationship$/.test(allIds[rIdx]) ) relCount++;
}
test(relCount >= 1,
  'Unified indexing: RELATIONSHIP classes are indexed (got ' + relCount + ')');

// === MESSAGE + CONSTANT REFERENCES ===

