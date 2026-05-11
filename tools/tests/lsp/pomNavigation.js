/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// POM ↔ class bidirectional navigation. Go-to-definition on a class's
// own `name:` axiom value jumps to its pom.js entry. Go-to-definition
// on a pom.js file entry jumps to the class file. Both directions are
// driven by FoamIndex's pomFile / pomEntryName metadata + FoamClassGrammar.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache;

index.buildFileIndex();
var defHandler = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index, cache: cache });


// === FoamIndex.getPomLocationForClass — index has the POM coordinates ===

section('FoamIndex.getPomLocationForClass');

// foam.lang.FObject is registered by the root foam3 pom — always present.
var loc = index.getPomLocationForClass('foam.lang.FObject');
test(loc !== null, 'getPomLocationForClass returns coords for foam.lang.FObject');
test(loc && typeof loc.pomFile === 'string', 'returns pomFile path');
test(loc && /pom\.js$/.test(loc.pomFile), 'pomFile path ends with pom.js');
test(loc && typeof loc.line === 'number' && loc.line >= 0, 'line is non-negative number');

// Unknown class id → null.
test(index.getPomLocationForClass('nonexistent.NoSuchClass') === null,
  'unknown class returns null');


// === FoamIndex.getClassForPomEntry — reverse lookup ===

section('FoamIndex.getClassForPomEntry');

if ( loc ) {
  // Root poms use slashed paths ('foam/lang/FObject'); nested poms use bare
  // names ('FObject'). Try both shapes — at least one must resolve.
  var resolvedFull  = index.getClassForPomEntry(loc.pomFile, 'foam/lang/FObject');
  var resolvedShort = index.getClassForPomEntry(loc.pomFile, 'FObject');
  test(resolvedFull === 'foam.lang.FObject' || resolvedShort === 'foam.lang.FObject',
    'reverse lookup returns foam.lang.FObject for the FObject entry');
}

// Unknown entry → null.
test(index.getClassForPomEntry('/no/such/pom.js', 'X') === null,
  'unknown pom path returns null');


// === DefinitionHandler — class file → POM entry ===

section('DefinitionHandler — class name → POM entry');

// Synthetic class text with cursor inside the 'FObject' name value.
var classText = "foam.CLASS({\n  package: 'foam.lang',\n  name: 'FObject'\n});";
var nameCol   = classText.split('\n')[2].indexOf('FObject') + 1;
var jumpToPom = defHandler.handle(classText, { line: 2, character: nameCol }, 'file:///foam.lang.FObject.js');
test(jumpToPom !== null && jumpToPom !== undefined,
  'class name → POM entry: jump returned');
test(jumpToPom && jumpToPom.uri && /pom\.js$/.test(jumpToPom.uri),
  'class name → POM entry: result URI ends with pom.js');
test(jumpToPom && jumpToPom.range && typeof jumpToPom.range.start.line === 'number',
  'class name → POM entry: result has range');


// === DefinitionHandler — POM entry → class file ===

section('DefinitionHandler — POM entry → class file');

if ( loc ) {
  var fs = require('fs');
  var pomText = fs.readFileSync(loc.pomFile, 'utf8');
  // FObject's POM entry position — captured by the grammar at boot.
  var fobjPos = index.findPomEntryLocation_(loc.pomFile, 'foam/lang/FObject') ||
                index.findPomEntryLocation_(loc.pomFile, 'FObject');
  test(fobjPos !== null && fobjPos !== undefined,
    'findPomEntryLocation_: FObject entry has a cached position');
  if ( fobjPos ) {
    var pomUri  = 'file://' + loc.pomFile;
    var jumpToClass = defHandler.handle(pomText, { line: fobjPos.line, character: fobjPos.character + 2 }, pomUri);
    test(jumpToClass && jumpToClass.uri && /FObject\.js$/.test(jumpToClass.uri),
      'POM entry → class file: jumps to FObject.js');
  }
}


// === FoamIndex.invalidatePomCache — pom edits must drop cached entry positions ===

section('FoamIndex.invalidatePomCache');

if ( loc ) {
  // Prime the cache.
  index.findPomEntryLocation_(loc.pomFile, 'FObject');
  test(!! (index.pomEntryLineCache_ && index.pomEntryLineCache_[loc.pomFile]),
    'pomEntryLineCache_ is populated after a lookup');

  // Surgical invalidation — only this pom file should be dropped.
  index.invalidatePomCache(loc.pomFile);
  test(! (index.pomEntryLineCache_ && index.pomEntryLineCache_[loc.pomFile]),
    'invalidatePomCache(pomFile) drops the cached entry');

  // Full reset — passing no path nukes the whole map.
  index.findPomEntryLocation_(loc.pomFile, 'FObject');
  index.invalidatePomCache();
  test(index.pomEntryLineCache_ === null,
    'invalidatePomCache() with no arg clears the entire cache');
}
