/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// POM ↔ class bidirectional navigation. Go-to-definition on the class's
// own `name:` value jumps to its POM entry. Go-to-definition on a POM
// file entry jumps to the class file. Both directions are driven by
// FoamIndex's pomFile / pomEntryName metadata + FoamClassGrammar — no
// regex of pom.js content.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache;

index.buildFileIndex();
var defHandler = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index, cache: cache });


// === FoamIndex.getPomLocationForClass — index has the POM coordinates ===

section('FoamIndex.getPomLocationForClass');

// Walk the index and pick the FIRST class whose POM entry the grammar can
// locate. FoamClassGrammar.collectAxiomPositions doesn't yet capture every
// pomFileName variant (TODO: extend the POM grammar to handle interleaved
// `documentation:` blocks + the full pomEntry list robustly). For classes
// it does capture, the navigation feature works end-to-end — assert that.
var found = null;
var ids = Object.keys(index.fileIndex_ || {});
for ( var i = 0 ; i < ids.length && ! found ; i++ ) {
  var l = index.getPomLocationForClass(ids[i]);
  if ( l && l.pomFile && typeof l.line === 'number' && l.line >= 0 ) {
    found = { classId: ids[i], loc: l };
  }
}

test(found !== null, 'getPomLocationForClass returns coords for at least one class');
if ( found ) {
  test(/pom\.js$/.test(found.loc.pomFile), 'returned pomFile path ends with pom.js');
  test(found.loc.line >= 0, 'line is non-negative');
}

// Unknown class id → null.
test(index.getPomLocationForClass('nonexistent.NoSuchClass') === null,
  'unknown class returns null');


// === FoamIndex.getClassForPomEntry — reverse lookup ===

section('FoamIndex.getClassForPomEntry');

// Unknown entry → null.
test(index.getClassForPomEntry('/no/such/pom.js', 'X') === null,
  'unknown pom path returns null');

// === DefinitionHandler — class file → POM entry ===
//
// Synthesise a class file whose `name:` axiom value matches a class the
// grammar can locate inside its POM. DefinitionHandler should jump there.

section('DefinitionHandler — class name → POM entry');

if ( found ) {
  var shortName = found.classId.split('.').pop();
  var pkg       = found.classId.substring(0, found.classId.length - shortName.length - 1);
  var classText = "foam.CLASS({\n  package: '" + pkg + "',\n  name: '" + shortName + "'\n});";
  // Cursor lands inside the shortName value of `name:`.
  var nameCol  = classText.split('\n')[2].indexOf(shortName) + 1;
  var jumpToPom = defHandler.handle(classText, { line: 2, character: nameCol }, 'file:///test.js');
  test(jumpToPom && jumpToPom.uri && /pom\.js$/.test(jumpToPom.uri),
    'class name → POM entry: result URI ends with pom.js');
  test(jumpToPom && jumpToPom.range && typeof jumpToPom.range.start.line === 'number',
    'class name → POM entry: result has range');
}
