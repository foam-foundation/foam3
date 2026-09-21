/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Tests for editor-shaped handlers extracted out of server.js:
// SignatureHelpHandler, FoldingRangeHandler, CodeActionHandler,
// WorkspaceSymbolHandler. Each previously lived as an inline function
// in server.js.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache, cssTokenResolver = h.cssTokenResolver;
var semanticHandler = h.semanticHandler;

// === FoldingRangeHandler ===

section('FoldingRangeHandler');
var foldingHandler = foam.parse.lsp.handlers.FoldingRangeHandler.create();

var foldText = "foam.CLASS({\n  properties: [\n    { name: 'a' },\n    { name: 'b' }\n  ]\n});";
var ranges = foldingHandler.handle(foldText);
test(ranges.length === 1, 'FoldingRange: one fold for a single properties:[]');
test(ranges.length === 1 && ranges[0].startLine === 1, 'FoldingRange: starts on properties: line');
test(ranges.length === 1 && ranges[0].endLine === 4, 'FoldingRange: ends on closing ]');

// Both arrays span multiple lines — single-line arrays are intentionally NOT folded.
var foldText2 = "foam.CLASS({\n  requires: [\n    'foo'\n  ],\n  methods: [\n    function a() {}\n  ]\n});";
var ranges2 = foldingHandler.handle(foldText2);
test(ranges2.length >= 2, 'FoldingRange: multiple folds for multiple multi-line array axioms');

var ranges3 = foldingHandler.handle('function foo() { return 1; }');
test(ranges3.length === 0, 'FoldingRange: returns empty for plain JS');


// === CodeActionHandler ===

section('CodeActionHandler');
var codeActionHandler = foam.parse.lsp.handlers.CodeActionHandler.create({
  index:            index,
  cssTokenResolver: cssTokenResolver
});

var emptyRange = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

var noActions = codeActionHandler.handle('', emptyRange, { diagnostics: [] }, 'file:///x');
test(noActions.length === 0, 'CodeAction: returns empty when no diagnostics');

var nullCtx = codeActionHandler.handle('', emptyRange, null, 'file:///x');
test(nullCtx.length === 0, 'CodeAction: returns empty when context is null');

var dqDiag = {
  range:   { start: { line: 0, character: 0 }, end: { line: 0, character: 7 } },
  message: 'Use single quotes for FOAM class references: ' + h.Q + 'foo.X' + h.Q
};
var dqActions = codeActionHandler.handle('"foo.X"', dqDiag.range, { diagnostics: [dqDiag] }, 'file:///x');
test(
  dqActions.some(function(a) { return a.title.indexOf('Convert to single quotes') === 0; }),
  'CodeAction: offers single-quote conversion for double-quoted class ref'
);

var wrongPkgDiag = {
  range:   { start: { line: 0, character: 0 }, end: { line: 0, character: 20 } },
  message: 'Wrong Java package: ' + h.Q + 'foam.nanos.auth.User' + h.Q
};
var wpActions = codeActionHandler.handle('foam.nanos.auth.User', wrongPkgDiag.range,
  { diagnostics: [wrongPkgDiag] }, 'file:///x');
test(
  Array.isArray(wpActions),
  'CodeAction: handles wrong-Java-package diagnostic without crashing'
);


// === SignatureHelpHandler ===

section('SignatureHelpHandler');
var sigHandler = foam.parse.lsp.handlers.SignatureHelpHandler.create({ index: index, cache: cache });

var sigNoCall = sigHandler.handle('var x = 1;', { line: 0, character: 5 }, '');
test(sigNoCall === null, 'SignatureHelp: returns null when not inside a method call');

// Cursor inside parens — handler walks back, attempts to resolve method via cache.getModelAt.
// With an empty URI / no model, expected null (never throw).
var sigText = "foam.CLASS({\n  package: 'x',\n  name: 'Y',\n  methods: [ function foo(a, b) {} ]\n});\nfoo(";
var sigInCall = sigHandler.handle(sigText, { line: 5, character: 4 }, '');
test(sigInCall === null || (sigInCall.signatures && sigInCall.signatures.length > 0),
  'SignatureHelp: returns null or a signature shape, never throws');


// === WorkspaceSymbolHandler (backed by FoamIndex.searchSymbols) ===

section('WorkspaceSymbolHandler');
var wsSymbolHandler = foam.parse.lsp.handlers.WorkspaceSymbolHandler.create({ index: index });

var anySymbols = wsSymbolHandler.handle('FObject');
test(Array.isArray(anySymbols), 'WorkspaceSymbol: always returns an array');
test(anySymbols.length === 0 || anySymbols[0].location.uri.indexOf('file://') === 0,
  'WorkspaceSymbol: locations use file:// URIs');

// Cap lifted to 500 (was 100).
var capped = wsSymbolHandler.handle('');
test(capped.length <= 500, 'WorkspaceSymbol: respects new 500-symbol cap');

// Search by property name (previously class-only).
var propHits = wsSymbolHandler.handle('id');
test(Array.isArray(propHits), 'WorkspaceSymbol: property search returns array');
test(propHits.some(function(s) { return s.kind === 7; }) || propHits.length === 0,
  'WorkspaceSymbol: property search surfaces property kind (7) when matches exist');

// Search by method name.
var methodHits = wsSymbolHandler.handle('toSummary');
test(Array.isArray(methodHits), 'WorkspaceSymbol: method search returns array');

// A member's location must use the position's OWN uri. Pairing the line with
// the class's file puts a line number in a file that may not have one — 34
// workspace symbols pointed past the end of the file they named.
var twoFactorHits = wsSymbolHandler.handle('twoFactorEnabled').filter(function(sym) {
  return sym.name === 'twoFactorEnabled' && sym.containerName === 'foam.core.auth.User';
});
test(twoFactorHits.length > 0 && twoFactorHits[0].location.uri.indexOf('UserRefinements.js') !== -1
  && twoFactorHits[0].location.range.start.line === 14,
  'WorkspaceSymbol: a member declared in a refinement points at the refining file'
  + ' (got ' + ( twoFactorHits.length ? twoFactorHits[0].location.uri.split('/').pop() + ':'
    + twoFactorHits[0].location.range.start.line : 'no hit' ) + ')');

// The same discard broke the Java side long before refinements existed:
// fclone has no JS axiom on foam.core.partition.All and resolves to FObject.java.
var fcloneHits = wsSymbolHandler.handle('fclone').filter(function(sym) {
  return sym.name === 'fclone' && sym.containerName === 'foam.core.partition.All';
});
test(fcloneHits.length > 0 && fcloneHits[0].location.uri.endsWith('.java'),
  'WorkspaceSymbol: a Java-resolved member points at the .java file, not the .js'
  + ' (got ' + ( fcloneHits.length ? fcloneHits[0].location.uri.split('/').pop() : 'no hit' ) + ')');

// Empty index → empty results (no crash).
var emptyIndex = foam.parse.lsp.FoamIndex.create();
var emptyHandler = foam.parse.lsp.handlers.WorkspaceSymbolHandler.create({ index: emptyIndex });
var none = emptyHandler.handle('Anything');
test(Array.isArray(none), 'WorkspaceSymbol: empty index returns empty array');


// === Semantic tokens — none inside comments / docs (F1) ===

section('Semantic tokens — none inside comments / docs (F1)');
var stText = "foam.CLASS({\n" +                                  // line 0
  "  requires: ['foam.parse.Suggestion'],\n" +                    // line 1
  "  documentation: 'this.Suggestion note',\n" +                  // line 2
  "  methods: [\n" +                                              // line 3
  "    function f() {\n" +                                        // line 4
  "      // this.Suggestion in comment\n" +                       // line 5
  "      return this.Suggestion;\n" +                             // line 6
  "    }\n  ]\n})";                                               // lines 7-9
var st = semanticHandler.handle(stText, '');
function tokenLines(data) {
  var lines = [], line = 0;
  for ( var i = 0 ; i < data.length ; i += 5 ) { line += data[i]; lines.push(line); }
  return lines;
}
var lns = tokenLines(st.data);
test(lns.indexOf(2) === -1, 'no semantic token on the documentation line (2)');
test(lns.indexOf(5) === -1, 'no semantic token on the comment line (5)');
test(lns.indexOf(6) !== -1, 'the real this.Suggestion on line 6 is still tokenized');
