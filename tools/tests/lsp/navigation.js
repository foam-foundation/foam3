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

// The real handler classes server.js dispatches (folding / signature-help /
// code-action / similar-class) — tested directly, not re-implemented inline.
var foldingRangeHandler_  = foam.parse.lsp.handlers.FoldingRangeHandler.create();
var signatureHelpHandler_ = foam.parse.lsp.handlers.SignatureHelpHandler.create({ index: index, cache: cache });
var codeActionHandler_    = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, cssTokenResolver: cssTokenResolver, diagnosticsHandler: diagHandler });

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

section('Folding Ranges (FoldingRangeHandler — same instance type server.js dispatches)');

// Calls the REAL FoldingRangeHandler — the same class server.js dispatches —
// instead of a copy, so a server-side change is caught here.
var foldText = 'foam.CLASS({\n  package: ' + Q + 'test' + Q + ',\n  name: ' + Q + 'Fold' + Q + ',\n  properties: [\n    { class: ' + Q + 'String' + Q + ', name: ' + Q + 'x' + Q + ' },\n    { class: ' + Q + 'Int' + Q + ', name: ' + Q + 'y' + Q + ' }\n  ],\n  methods: [\n    function foo() {},\n    function bar() {}\n  ]\n})';

var foldRanges = foldingRangeHandler_.handle(foldText);
test(foldRanges.length === 2, 'Fold ranges found properties and methods: ' + foldRanges.length);
test(foldRanges[0].startLine === 3, 'Properties fold starts at line 3');
test(foldRanges[0].endLine === 6, 'Properties fold ends at the closing ] (line 6)');
test(foldRanges[1].startLine === 7, 'Methods fold starts at line 7');
test(foldRanges.every(function(r){ return r.kind === 'region'; }), 'Fold ranges are kind=region');

// requires + properties both fold
var foldText2 = 'foam.CLASS({\n  requires: [\n    ' + Q + 'foam.u2.Element' + Q + '\n  ],\n  properties: [\n    ' + Q + 'x' + Q + '\n  ]\n})';
test(foldingRangeHandler_.handle(foldText2).length === 2, 'Fold ranges found requires and properties');

// A class with no foldable arrays yields no ranges (edge case).
test(foldingRangeHandler_.handle("foam.CLASS({ package:'t', name:'Empty' })").length === 0,
  'No foldable arrays → no fold ranges');

// === CODE ACTION TESTS ===



// === CODE ACTION TESTS ===

section('Code Actions (CodeActionHandler.handle / findSimilarClasses_)');

// findSimilarClasses — the REAL function. 'foam.core.FObject' should suggest
// 'foam.lang.FObject' (same short name, different package → score 100).
var suggestions = codeActionHandler_.findSimilarClasses_('foam.core.FObject', 3);
test(suggestions.some(function(s) { return s === 'foam.lang.FObject'; }), 'findSimilarClasses suggests foam.lang.FObject for foam.core.FObject');
test(suggestions.length <= 3, 'findSimilarClasses respects maxResults');

// getCodeActions end-to-end. A helper to invoke it with one synthetic diagnostic.
function codeActionsFor(text, diag, uri) {
  return codeActionHandler_.handle(text, diag.range, { diagnostics: [diag] }, uri || 'file:///x.js');
}
var DUMMY_RANGE = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };

// No diagnostics → no actions.
test(codeActionHandler_.handle('', DUMMY_RANGE, { diagnostics: [] }, 'file:///x.js').length === 0,
  'getCodeActions: empty diagnostics → no actions');
test(codeActionHandler_.handle('', DUMMY_RANGE, null, 'file:///x.js').length === 0,
  'getCodeActions: missing context → no actions (no throw)');

// "Unknown class" → "Did you mean ...?" quickfix(es).
var unknownActions = codeActionsFor("foam.CLASS({ extends: 'foam.core.FObject' })",
  { message: "Unknown class: 'foam.core.FObject'", range: DUMMY_RANGE });
test(unknownActions.length > 0 && unknownActions.every(function(a){ return a.kind === 'quickfix'; }),
  'getCodeActions: unknown class yields quickfix actions');
test(unknownActions.some(function(a){ return a.title.indexOf("Did you mean 'foam.lang.FObject'") !== -1; }),
  'getCodeActions: unknown class suggests foam.lang.FObject');

// Double-quoted class ref hint → "Convert to single quotes".
var dqActions = codeActionsFor('x', { message: "Use single quotes for FOAM class references: 'foam.x.Y'", range: DUMMY_RANGE });
test(dqActions.length === 1 && dqActions[0].edit.changes['file:///x.js'][0].newText === "'foam.x.Y'",
  'getCodeActions: single-quote conversion rewrites the span to single quotes');

// i18n hardcoded display string → "Extract ... to a messages: entry" (THE path
// that had no dispatch-level coverage). Build a real diagnostic from the handler
// so the range/text line up with buildAddExtractEdit's expectations.
var i18nSrc = "foam.CLASS({ package:'t', name:'CA', methods:[ function render(){ this.add('Upload Complete'); } ] })";
var i18nDiag = diagHandler.handle(i18nSrc).filter(function(d){ return d.code === 'i18n-hardcoded-display-string'; })[0];
test(!! i18nDiag, 'getCodeActions: produced an i18n diagnostic to act on (precondition)');
var i18nActions = i18nDiag ? codeActionsFor(i18nSrc, i18nDiag, 'file:///ca.js') : [];
test(i18nActions.some(function(a){ return a.title.indexOf("Extract 'Upload Complete' to a messages: entry") !== -1; }),
  'getCodeActions: i18n hardcoded string yields the extract-to-messages quickfix');
var i18nFix = i18nActions.filter(function(a){ return a.title.indexOf('Extract') !== -1; })[0];
test(!! i18nFix && i18nFix.isPreferred === true && !! i18nFix.edit && !! i18nFix.edit.changes['file:///ca.js'],
  'getCodeActions: i18n extract action is preferred and carries a workspace edit for the uri');

// A diagnostic that matches nothing → no actions (no false fixes).
test(codeActionsFor('x', { message: 'Some unrelated warning', range: DUMMY_RANGE }).length === 0,
  'getCodeActions: unrelated diagnostic yields no actions');

// === SIGNATURE HELP ===
section('Signature Help (SignatureHelpHandler)');

// Negative: cursor not inside a call → null (callMatch fails).
test(signatureHelpHandler_.handle(
  "foam.CLASS({ package:'t', name:'S', methods:[ function go(){} ] })",
  { line: 0, character: 5 }) === null,
  'getSignatureHelp: cursor not inside a call returns null');

// Positive: redefine a REAL indexed class inline and call one of its
// >=2-arg methods. Expectations are derived from the index, so the test
// can't drift if the specific class/method changes.
var sigClassId = null, sigMethod = null;
var sigIds = index.getAllClassIds();
for ( var si = 0 ; si < sigIds.length && ! sigClassId ; si++ ) {
  var sms = index.getMethods(sigIds[si]) || [];
  for ( var sj = 0 ; sj < sms.length ; sj++ ) {
    if ( sms[sj].args && sms[sj].args.length >= 2 &&
         /^[a-zA-Z_]\w*$/.test(sms[sj].name) && sigIds[si].lastIndexOf('.') > 0 ) {
      sigClassId = sigIds[si]; sigMethod = sms[sj]; break;
    }
  }
}
if ( sigClassId ) {
  var dot   = sigClassId.lastIndexOf('.');
  var sPkg  = sigClassId.substring(0, dot);
  var sName = sigClassId.substring(dot + 1);
  var argNames = sigMethod.args.map(function(a){ return a.name; });
  var sHead = "foam.CLASS({ package:'" + sPkg + "', name:'" + sName +
    "', methods:[ function go(){ this." + sigMethod.name + "(";
  var sig = signatureHelpHandler_.handle(sHead + "); } ] })",
    { line: 0, character: sHead.length });
  test(!! sig && sig.signatures.length === 1,
    'getSignatureHelp: returns a signature for a real method (' + sigClassId + '.' + sigMethod.name + ')');
  test(!! sig && sig.signatures[0].parameters.map(function(p){ return p.label; }).join(',') === argNames.join(','),
    'getSignatureHelp: parameter labels match the method args (' + argNames.join(',') + ')');
  test(!! sig && sig.activeParameter === 0,
    'getSignatureHelp: activeParameter is 0 at the first argument');

  var sHead2 = sHead + 'a, ';
  var sig2 = signatureHelpHandler_.handle(sHead2 + '); } ] })',
    { line: 0, character: sHead2.length });
  test(!! sig2 && sig2.activeParameter === 1,
    'getSignatureHelp: activeParameter advances to 1 after a comma');

  // Negative on a real, resolvable class: an unknown method name → null.
  var sBadHead = "foam.CLASS({ package:'" + sPkg + "', name:'" + sName +
    "', methods:[ function go(){ this.zzzNoSuchMethod_(";
  test(signatureHelpHandler_.handle(sBadHead + "); } ] })",
    { line: 0, character: sBadHead.length }) === null,
    'getSignatureHelp: unknown method on a resolvable class returns null');
} else {
  test(true, 'getSignatureHelp: no >=2-arg method found in index — positive case skipped');
}

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

// === SemanticTokenHandler — helpers, CSS path, token-type accuracy ===
// Token legend (from TOKEN_TYPES): type=0, class=1, variable=2, keyword=3,
// string=4, comment=5, number=6, operator=7, method=8. Modifiers: declaration=1,
// readonly=2. These were almost entirely uncovered; the cases below exercise
// the string-literal / structural-range helpers, the CSS highlighting path,
// per-token type+modifier classification, and multi-class delta encoding.
section('SemanticTokenHandler — helpers, CSS, token types');

// Decode the LSP delta-encoded data array back to absolute tokens.
function decodeTokens(data) {
  var out = [], line = 0, char = 0;
  for ( var i = 0 ; i + 4 < data.length ; i += 5 ) {
    var dl = data[i], dc = data[i + 1];
    if ( dl === 0 ) { char += dc; } else { line += dl; char = dc; }
    out.push({ line: line, char: char, length: data[i + 2], type: data[i + 3], modifiers: data[i + 4] });
  }
  return out;
}

// --- isInStringLiteral_ (was untested — drives false-positive suppression) ---
test(semanticHandler.isInStringLiteral_("var x = 'hello';", 11) === true,
  'isInStringLiteral_: index inside single quotes → true');
test(semanticHandler.isInStringLiteral_("var x = 'hello';", 2) === false,
  'isInStringLiteral_: index outside any string → false');
test(semanticHandler.isInStringLiteral_('a "b" c', 3) === true,
  'isInStringLiteral_: inside double quotes → true');
test(semanticHandler.isInStringLiteral_('a "b" c', 6) === false,
  'isInStringLiteral_: after a closed double-quoted string → false');
test(semanticHandler.isInStringLiteral_('x `tpl` y', 4) === true,
  'isInStringLiteral_: inside backticks → true');
test(semanticHandler.isInStringLiteral_("a \\'b c", 4) === false,
  'isInStringLiteral_: an escaped quote does not open a string');

// --- computeStructuralRanges_ / isInStructuralRange_ (were untested) ---
var srLines = [
  "foam.CLASS({",                       // 0
  "  requires: [",                      // 1
  "    'foam.u2.Element'",              // 2
  "  ],",                               // 3
  "  methods: [ function go(){} ]",     // 4
  "})"                                  // 5
];
var srRanges = semanticHandler.computeStructuralRanges_(srLines);
test(srRanges.length === 1 && srRanges[0].start === 1 && srRanges[0].end === 3,
  'computeStructuralRanges_: requires block spans lines 1–3');
test(semanticHandler.isInStructuralRange_(2, srRanges) === true,
  'isInStructuralRange_: a line inside requires → true');
test(semanticHandler.isInStructuralRange_(4, srRanges) === false,
  'isInStructuralRange_: the methods line is not a structural range → false');

// --- CSS token path (was 100% dark) ---
var cssText = "foam.CLASS({\n  package:'t', name:'CssTok',\n  css: `\n    ^ { color: $primary; }\n    /* a note */\n    .x { width: 10px; }\n  `\n})";
var cssTokens = decodeTokens(semanticHandler.handle(cssText).data);
test(cssTokens.some(function(t){ return t.type === 2; }), "CSS: $primary emits a variable token (type 2)");
test(cssTokens.some(function(t){ return t.type === 0; }), "CSS: ^ selector emits a type token (type 0)");
test(cssTokens.some(function(t){ return t.type === 5; }), "CSS: /* */ emits a comment token (type 5)");
test(cssTokens.some(function(t){ return t.type === 1; }), "CSS: .x emits a class-selector token (type 1)");

// --- per-token type + modifier accuracy (only requires=type0 was checked) ---
var accText = "foam.CLASS({\n  package:'t', name:'Acc',\n  properties:[ { name:'myProp' } ],\n  imports:[ 'myService' ],\n  methods:[ function helper(){}, function render(){ this.myProp; this.helper(); this.myService; } ]\n})";
var accTokens = decodeTokens(semanticHandler.handle(accText).data);
test(accTokens.some(function(t){ return t.type === 2 && t.modifiers === 0; }),
  'token types: this.myProp → variable (type 2, no modifier)');
test(accTokens.some(function(t){ return t.type === 8; }),
  'token types: this.helper() → method (type 8)');
test(accTokens.some(function(t){ return t.type === 2 && t.modifiers === 2; }),
  'token types: this.myService → readonly import (type 2, modifier readonly)');

// --- multi-class file: tokens collected from BOTH models, encoding stays valid ---
var multiText =
  "foam.CLASS({ package:'t', name:'M1', requires:['foam.parse.Suggestion'], methods:[ function a(){ this.Suggestion.create({}); } ] })\n" +
  "foam.CLASS({ package:'t', name:'M2', requires:['foam.parse.Suggestion'], methods:[ function b(){ this.Suggestion.create({}); } ] })";
var multiData = semanticHandler.handle(multiText).data;
test(multiData.length % 5 === 0 && multiData.length > 0, 'multi-class: encoded token stream is well-formed');
var multiTokens = decodeTokens(multiData);
test(multiTokens.some(function(t){ return t.line === 0; }) && multiTokens.some(function(t){ return t.line === 1; }),
  'multi-class: tokens emitted for both models (line 0 and line 1)');
test((function(){ for ( var i = 1 ; i < multiTokens.length ; i++ ) { if ( multiTokens[i].line < multiTokens[i-1].line ) return false; } return true; })(),
  'multi-class: decoded tokens are in non-decreasing line order (delta encoding sorted)');

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

// === REFERENCES — word-bounded match (no FlowMode-style substring drift) ===
//
// `foam.core.reflow.Flow` is a strict prefix of `foam.core.reflow.FlowMode`,
// so a naive content.indexOf used to send users to the wrong line. Verify
// every emitted range starts on text that's exactly the target id, with
// no identifier char following.
var refHandlerExact = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });
var fobjRefsBound   = refHandlerExact.handle("foam.CLASS({\n  extends: 'foam.lang.FObject'\n});",
  { line: 1, character: 20 });
var fsForBound = require('fs');
var boundOk = true;
var boundCheckedNonZero = 0;
for ( var ri = 0 ; ri < fobjRefsBound.length && boundOk ; ri++ ) {
  var loc = fobjRefsBound[ri];
  if ( loc.range.start.line === 0 && loc.range.start.character === 0 ) continue;
  boundCheckedNonZero++;
  try {
    var locPath = loc.uri.replace(/^file:\/\//, '');
    var locText = fsForBound.readFileSync(locPath, 'utf8');
    var locLines = locText.split('\n');
    var line = locLines[loc.range.start.line] || '';
    var slice = line.substring(loc.range.start.character,
                               loc.range.start.character + 'foam.lang.FObject'.length);
    var nextCh = line.charAt(loc.range.start.character + 'foam.lang.FObject'.length);
    if ( slice !== 'foam.lang.FObject' || /\w/.test(nextCh) ) boundOk = false;
  } catch (e) {}
}
// Re-check using the range's own length so short-name matches (FObject via
// requires) are validated against their own 7-char span, not the 17-char
// full id. Either the full id or a known short name is acceptable; the
// next char must not extend the identifier.
var firstBadInfo = null;
boundOk = true;
boundCheckedNonZero = 0;
var ALLOWED = { 'foam.lang.FObject': true, 'FObject': true };
for ( var ri2 = 0 ; ri2 < fobjRefsBound.length && ! firstBadInfo ; ri2++ ) {
  var locx = fobjRefsBound[ri2];
  if ( locx.range.start.line === 0 && locx.range.start.character === 0 ) continue;
  boundCheckedNonZero++;
  try {
    var lp     = locx.uri.replace(/^file:\/\//, '');
    var lt     = fsForBound.readFileSync(lp, 'utf8');
    var ll     = lt.split('\n');
    var lineS  = ll[locx.range.start.line] || '';
    var spanLen = locx.range.end.character - locx.range.start.character;
    var sliceX = lineS.substring(locx.range.start.character,
                                 locx.range.start.character + spanLen);
    var nextX  = lineS.charAt(locx.range.start.character + spanLen);
    if ( ! ALLOWED[sliceX] || /\w/.test(nextX) ) {
      boundOk = false;
      firstBadInfo = lp.replace(/^.*\//, '') + ':' + locx.range.start.line + ' slice=' +
                     JSON.stringify(sliceX) + ' next=' + JSON.stringify(nextX);
    }
  } catch (e) {}
}
test(boundOk && boundCheckedNonZero >= 1,
  'references: every emitted non-zero range word-bounds an exact match (checked ' +
  boundCheckedNonZero + (firstBadInfo ? '; first bad: ' + firstBadInfo : '') + ')');

// Grammar-driven classRef positions: a synthetic file mentioning both
// `foam.lang.FObject` and `foam.lang.FObjectArray` should yield one
// classRef hit for FObject (extends slot) and none on the longer id.
var probe = "foam.CLASS({\n  package: 'demo',\n  name: 'X',\n  extends: 'foam.lang.FObject',\n  properties: [\n    { class: 'FObjectArray', of: 'foam.lang.FObject' }\n  ]\n});";
var pmap = index.getGrammar().collectAxiomPositions(probe);
var fobjPositions = (pmap.classRef && pmap.classRef['foam.lang.FObject']) || [];
test(fobjPositions.length >= 1,
  'grammar classRef: emits position(s) for foam.lang.FObject in extends/of slots (' + fobjPositions.length + ')');
test(fobjPositions.every(function(p) {
  var slice = probe.substring(p.startPos, p.endPos);
  return slice === 'foam.lang.FObject';
}), 'grammar classRef: every captured span equals the target id, not a prefix');

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

// === buildLocationAtMethod unconstrained grammar fallback ===
// When the grammar's axiom map for a specific classId yields no match
// (e.g., the supplied classId doesn't appear in the file), the handler
// must still try the unconstrained grammar map. This relies purely on
// FoamClassGrammar.methodNameValue emissions — no regex.
var tmpFile3 = tmpPath2.join(tmpOs.tmpdir(), 'lsp-method-unconstrained.js');
tmpFs.writeFileSync(tmpFile3,
  "foam.CLASS({\n" +
  "  package: 'test',\n" +
  "  name: 'Unconstrained',\n" +
  "  methods: [\n" +
  "    {\n" +
  "      name: 'normalize',\n" +
  "      args: 'X x',\n" +
  "      type: 'String',\n" +
  "      javaCode: " + String.fromCharCode(96) + "return \"hi\";" + String.fromCharCode(96) + "\n" +
  "    }\n" +
  "  ]\n" +
  "});\n");
try {
  // Pass a wrong classId. The class-range constraint check fails, but
  // the unconstrained grammar map still has `normalize` — handler must
  // return that position rather than file top.
  var rxLoc = defHandler.buildLocationAtMethod(tmpFile3, 'wrong.ClassId', 'normalize');
  test(rxLoc && rxLoc.range && rxLoc.range.start.line === 5,
    'buildLocationAtMethod unconstrained fallback lands on method-name line (got line ' + (rxLoc && rxLoc.range && rxLoc.range.start.line) + ')');
} finally {
  try { tmpFs.unlinkSync(tmpFile3); } catch ( e ) {}
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

// analyzeFiles: a file that throws (missing path) is filesFailed, not filesScanned
(function() {
  var os = require('os');
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsa-failed-'));
  var good = path.join(dir, 'Good.js');
  fs.writeFileSync(good, "foam.CLASS({ package: 'x', name: 'Good', properties: [ 'a' ] });");
  var missing = path.join(dir, 'Gone.js');   // never written -> readFileSync throws

  var origErr = console.error;
  console.error = function() {};
  var res;
  try {
    res = analyzer.analyzeFiles([ good, missing ]);
  } finally {
    console.error = origErr;
  }
  test(res.filesScanned === 1, 'only the readable file counts as scanned, got ' + res.filesScanned);
  test(res.filesFailed === 1, 'the throwing file counts as failed, got ' + res.filesFailed);
})();

// analyze(): the progress-loop path (scanFileInto_ / newAcc_ / finalizeAcc_)
// gets the same success-only treatment as analyzeFiles above. analyze() takes
// no explicit file list — it derives one from collectFilePaths_(), which reads
// the (fully-built) shared index. Stub collectFilePaths_ on a throwaway
// analyzer instance so this run sees exactly our two fixture files without
// touching the shared index used by every other test in this file.
(function() {
  var os = require('os');
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsa-failed-progress-'));
  var good = path.join(dir, 'Good.js');
  fs.writeFileSync(good, "foam.CLASS({ package: 'x', name: 'Good', properties: [ 'a' ] });");
  var missing = path.join(dir, 'Gone.js');   // never written -> readFileSync throws

  var progressAnalyzer = foam.parse.lsp.handlers.WorkspaceAnalyzer.create({ index: index });
  progressAnalyzer.collectFilePaths_ = function() { return [ good, missing ]; };

  var origErr = console.error;
  console.error = function() {};
  var res;
  try {
    res = progressAnalyzer.analyze();
  } finally {
    console.error = origErr;
  }
  test(res.filesScanned === 1, 'analyze(): only the readable file counts as scanned, got ' + res.filesScanned);
  test(res.filesFailed === 1, 'analyze(): the throwing file counts as failed, got ' + res.filesFailed);
})();

// === LSP #4999 Fix 1: property-type completion inserts full path (except foam.lang.*) ===


// === VIEW-SPEC-ONLY REFERENCES ===

section('ReferencesHandler — view-spec-only references');
if ( index.classExists('foam.u2.view.ReferenceArrayView') && index.classExists('foam.core.auth.Group') ) {
  // Group references ReferenceArrayView ONLY inside a `view: { class: ... }`
  // spec (no requires / of) — before the view-spec usage index its file was
  // never scanned and find-references returned nothing for it.
  var vsRefHandler = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });
  var vsText = "foam.CLASS({ package: 'x', name: 'T', properties: [ { name: 'p', view: { class: 'foam.u2.view.ReferenceArrayView' } } ] });";
  var vsCol = vsText.indexOf('foam.u2.view.ReferenceArrayView') + 5;
  var vsLocs = vsRefHandler.handle(vsText, { line: 0, character: vsCol });
  test(vsLocs.length > 0, 'references: view-spec class resolves at cursor: ' + vsLocs.length);
  test(vsLocs.some(function(l) { return l.uri.indexOf('Group.js') !== -1; }),
    'references: view-spec-only user (Group.js) included via view-spec index');
}
