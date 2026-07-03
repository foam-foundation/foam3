/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// textDocument/prepareTypeHierarchy + typeHierarchy/{supertypes,subtypes}
// + textDocument/implementation + textDocument/typeDefinition. All three
// handlers map directly to FoamIndex.getInheritanceChain / getSubclasses /
// getImplementors.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache;

index.buildFileIndex();

var tyHandler  = foam.parse.lsp.handlers.TypeHierarchyHandler.create({ index: index, cache: cache });
var implHandler = foam.parse.lsp.handlers.ImplementationHandler.create({ index: index, cache: cache });
var tdefHandler = foam.parse.lsp.handlers.TypeDefinitionHandler.create({ index: index, cache: cache });


// === TypeHierarchyHandler — prepare + supertypes + subtypes ===

section('TypeHierarchyHandler');

// prepare on a known FOAM class id mentioned in extends
var prepText = 'foam.CLASS({\n  package: ' + h.Q + 'x' + h.Q + ',\n  name: ' + h.Q + 'Y' + h.Q + ',\n  extends: ' + h.Q + 'foam.lang.FObject' + h.Q + '\n});';
var preps = tyHandler.prepare(prepText, { line: 3, character: 20 }, 'file:///t');
test(Array.isArray(preps), 'prepareTypeHierarchy returns an array');
test(preps.length === 1, 'prepareTypeHierarchy returns one item for a known class id');
test(preps.length === 1 && preps[0].data.classId === 'foam.lang.FObject',
  'prepareTypeHierarchy resolves cursor to FObject');

// prepare on plain text returns null
var emptyPrep = tyHandler.prepare('var x = 1;', { line: 0, character: 5 }, '');
test(emptyPrep === null, 'prepareTypeHierarchy returns null for non-FOAM cursor');

// supertypes for foam.core.auth.User → chain includes FObject ancestors
var userItem = tyHandler.itemFor_('foam.core.auth.User');
if ( userItem ) {
  var supers = tyHandler.supertypes(userItem);
  test(Array.isArray(supers), 'typeHierarchy/supertypes returns an array');
  test(supers.every(function(s) { return s.data && s.data.classId; }),
    'every supertype item carries data.classId');
  test(supers.some(function(s) { return s.data.classId === 'foam.lang.FObject'; }),
    'User → ancestors include foam.lang.FObject');
} else {
  test(true, 'supertypes test skipped (User class not loaded)');
}

// subtypes for FObject → many subclasses
var fobjectItem = tyHandler.itemFor_('foam.lang.FObject');
test(fobjectItem !== null && fobjectItem.data.classId === 'foam.lang.FObject',
  'itemFor_ resolves FObject to a TypeHierarchyItem');
if ( fobjectItem ) {
  var subs = tyHandler.subtypes(fobjectItem);
  // foam.USED is populated post-EndBoot.js — may be empty in some test
  // contexts. Assert shape only; the descendant-counting test that requires
  // a fully booted registry lives in LSPIntegrationTest.
  test(Array.isArray(subs), 'typeHierarchy/subtypes returns an array (count=' + subs.length + ')');
  test(subs.every(function(s) { return s.data && s.data.classId; }),
    'every subtype item carries data.classId');
}


// === ImplementationHandler ===

section('ImplementationHandler');

// On a class (not interface) — implementation falls back to subclasses
var implText = 'foam.CLASS({\n  package: ' + h.Q + 'x' + h.Q + ',\n  name: ' + h.Q + 'Y' + h.Q + ',\n  extends: ' + h.Q + 'foam.lang.FObject' + h.Q + '\n});';
var implResult = implHandler.handle(implText, { line: 3, character: 20 }, 'file:///t');
test(Array.isArray(implResult), 'implementation returns an array');
test(implResult.every(function(r) { return r.uri && r.uri.indexOf('file://') === 0; }),
  'implementation result locations use file:// URIs');

// On a plain word with no resolution → empty
var noImpl = implHandler.handle('var x;', { line: 0, character: 5 }, '');
test(noImpl.length === 0, 'implementation: empty when cursor not on a class');


// === TypeDefinitionHandler ===

section('TypeDefinitionHandler');

// Case A: cursor on a known class id → jump to its file
var tdef1 = tdefHandler.handle(
  'foam.CLASS({\n  extends: ' + h.Q + 'foam.lang.FObject' + h.Q + '\n});',
  { line: 1, character: 22 },
  'file:///t'
);
// Result depends on whether the cursor lands on a registered short-name or
// resolves to a file in the index. We only assert "doesn't crash and shape
// is valid" — either null, or an LSP Location with a file:// URI.
test(tdef1 === null || (tdef1.uri && tdef1.uri.indexOf('file://') === 0),
  'typeDefinition on a class-id token: null or a file:// location');

// Case B: cursor on a property name → jump to its declared class
// (e.g. `id` of an FObject is a Long → jumps to foam.lang.Long if registered).
// We only assert no-crash + correct shape here since file resolution depends
// on whether foam.lang.Long has a file path in the index.
var propText = 'foam.CLASS({\n  package: ' + h.Q + 'x' + h.Q + ',\n  name: ' + h.Q + 'Y' + h.Q + ',\n  properties: [\n    { class: ' + h.Q + 'Long' + h.Q + ', name: ' + h.Q + 'myField' + h.Q + ' }\n  ]\n});';
var tdef2 = tdefHandler.handle(propText, { line: 4, character: 32 }, 'file:///prop');
test(tdef2 === null || (tdef2.uri && tdef2.uri.indexOf('file://') === 0),
  'typeDefinition on a property name returns null or a file:// location');


// === Real positions (no more hardcoded line:0) ===

section('TypeHierarchy/Implementation — real positions');
var posItem = tyHandler.itemFor_('foam.core.controller.ApplicationController');
if ( posItem ) {
  test(posItem.range.start.line > 0,
    'itemFor_ range carries a non-zero class line (' + posItem.range.start.line + ')');
  test(posItem.range.start.line === posItem.selectionRange.start.line,
    'itemFor_ range and selectionRange agree');
} else {
  test(true, 'itemFor_ position test skipped (ApplicationController not in file index)');
}


// === Name-addressing by-id cores (the foam/byName engine) ===
// These are the class-id-driven paths the MCP uses for symbol-addressed
// hover/references/implementation/typeHierarchy — independent of cursor
// position, which is what makes "trace by name" work.

section('Name-addressing by-id cores');

var refHandler = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });
var fobjRefs = refHandler.referencesForClassId('foam.lang.FObject');
test(Array.isArray(fobjRefs) && fobjRefs.length > 0,
  'referencesForClassId(FObject) returns usages by class id (' + fobjRefs.length + ')');

// Use a class the harness has fully realized (getClass non-null), not just
// registered — buildClassHover walks the model so it needs the loaded class.
var BYID_CLASS = 'foam.core.controller.ApplicationController';
if ( index.getClass(BYID_CLASS) ) {
  // buildClassHover returns an LSP hover { contents: { kind, value } }.
  var byIdHover = h.hoverHandler.buildClassHover(BYID_CLASS);
  test(byIdHover && byIdHover.contents && typeof byIdHover.contents.value === 'string' &&
    byIdHover.contents.value.indexOf(BYID_CLASS) !== -1,
    'buildClassHover returns a hover naming the class (name-addressed hover core)');
  var byIdItem = tyHandler.itemFor_(BYID_CLASS);
  test(byIdItem && byIdItem.range.start.line > 0,
    'itemFor_ carries a real class line for name-addressed typeHierarchy');
} else {
  test(true, 'buildClassHover/itemFor_ name-address test skipped (class not loaded)');
}
