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


// === DocumentSymbol extents ===
//
// The outline used to give every symbol a zero-width range at its name, so
// breadcrumbs and sticky scroll could not tell which member the cursor was in.
// `range` must now cover the whole definition, and `selectionRange` (the name)
// must sit inside it — the LSP spec's own requirement.

section('DocumentSymbol extents');
var symExtHandler = foam.parse.lsp.handlers.SymbolHandler.create({ cache: cache, grammar: h.grammar });
var extText =
  "// foam.CLASS({ name: 'InAComment' })\n" +               // line 0
  "foam.CLASS({\n" +                                         // line 1
  "  package: 'test.ext',\n" +                               // line 2
  "  name: 'Extents',\n" +                                   // line 3
  "  properties: [\n" +                                      // line 4
  "    'shorty',\n" +                                         // line 5
  "    {\n" +                                                 // line 6
  "      class: 'String',\n" +                                // line 7
  "      name: 'longer'\n" +                                  // line 8
  "    }\n" +                                                 // line 9
  "  ],\n" +                                                  // line 10
  "  methods: [\n" +                                         // line 11
  "    function go(a) {\n" +                                  // line 12
  "      return a;\n" +                                       // line 13
  "    },\n" +                                                // line 14
  "    { name: 'viaObject', code: function() {} }\n" +        // line 15
  "  ]\n" +                                                   // line 16
  "});\n" +                                                   // line 17
  "foam.CLASS({ refines: 'test.ext.Extents', properties: [ 'added' ] });\n"; // line 18
var extSyms = symExtHandler.handle(extText, 'file:///Extents.js');

function posLE(a, b) { return a.line < b.line || ( a.line === b.line && a.character <= b.character ); }
function contains(outer, inner) { return posLE(outer.start, inner.start) && posLE(inner.end, outer.end); }
function childNamed(sym, n) { return ( sym.children || [] ).filter(function(c) { return c.name === n; })[0]; }

test(extSyms.length === 2, 'two models, the commented foam.CLASS not among them: ' + extSyms.length);
var extCls = extSyms[0];
test(extCls && extCls.range.start.line === 1 && extCls.range.start.character === 0,
  'class range starts at foam.CLASS( on line 1: ' + JSON.stringify(extCls && extCls.range.start));
test(extCls && extCls.range.end.line === 17 && extCls.range.end.character === 2,
  'class range ends after the call\'s ")" on line 17: ' + JSON.stringify(extCls && extCls.range.end));
test(extCls && extCls.selectionRange.start.line === 3 && extCls.selectionRange.start.character === 9 &&
  extCls.selectionRange.end.character === 16,
  'class selectionRange is the name Extents: ' + JSON.stringify(extCls && extCls.selectionRange));
test(extCls && contains(extCls.range, extCls.selectionRange), 'class range contains its selectionRange');

var extLonger = extCls && childNamed(extCls, 'longer');
test(extLonger && extLonger.range.start.line === 6 && extLonger.range.end.line === 9,
  'object property range spans { on line 6 to } on line 9: ' + JSON.stringify(extLonger && extLonger.range));
test(extLonger && extLonger.selectionRange.start.line === 8 && extLonger.selectionRange.start.character === 13,
  'object property selectionRange is its name on line 8');
var extShort = extCls && childNamed(extCls, 'shorty');
test(extShort && extShort.range.start.character === 4 && extShort.range.end.character === 12 &&
  extShort.selectionRange.start.character === 5 && extShort.selectionRange.end.character === 11,
  'shorthand property: range is the quoted string, selection the bare name');
var extGo = extCls && childNamed(extCls, 'go');
test(extGo && extGo.range.start.line === 12 && extGo.range.end.line === 14 && extGo.range.end.character === 5,
  'function method range runs from `function` to its closing brace: ' + JSON.stringify(extGo && extGo.range));
var extObj = extCls && childNamed(extCls, 'viaObject');
test(extObj && extObj.range.start.line === 15 && extObj.range.start.character === 4 &&
  extObj.selectionRange.start.character === 13,
  'object-form method range is its {...}, selection its name');
test(extCls && extCls.children.every(function(c) { return contains(c.range, c.selectionRange); }) &&
  extCls.children.every(function(c) { return contains(extCls.range, c.range); }),
  'every member range contains its selectionRange and sits inside the class range');

var extRef = extSyms[1];
test(extRef && extRef.range.start.line === 18 && extRef.selectionRange.start.character === 0 &&
  extRef.selectionRange.end.character === 10,
  'a nameless refinement selects its foam.CLASS token: ' + JSON.stringify(extRef && extRef.selectionRange));
var extAdded = extRef && childNamed(extRef, 'added');
test(extAdded && extAdded.range.start.line === 18 && contains(extRef.range, extAdded.range),
  'the refinement\'s member resolves inside the refinement, not the first model');


// === InlayHintHandler ===
//
// Types and overrides are read from the booted registry, so the fixtures name
// real classes: foam.dao.EasyDAO extends foam.dao.ProxyDAO, whose `delegate`
// is a `class: 'Proxy'` property. The fixture redeclares it with no class of
// its own — exactly the case where the type is invisible in the source.

section('InlayHintHandler');
var inlayHandler = foam.parse.lsp.handlers.InlayHintHandler.create({ index: index, cache: cache, grammar: h.grammar });
var inlayText =
  "foam.CLASS({\n" +                                        // line 0
  "  package: 'foam.dao',\n" +                               // line 1
  "  name: 'EasyDAO',\n" +                                   // line 2
  "  extends: 'foam.dao.ProxyDAO',\n" +                      // line 3
  "  properties: [\n" +                                      // line 4
  "    { name: 'delegate' },\n" +                             // line 5
  "    { class: 'String', name: 'daoType' },\n" +             // line 6
  "    'notInTheRegistry'\n" +                                // line 7
  "  ]\n" +                                                   // line 8
  "});\n" +                                                   // line 9
  "foam.CLASS({ refines: 'foam.dao.EasyDAO', properties: [ { name: 'delegate' } ] });\n"; // line 10
var INLAY_URI = 'file:///nowhere/InlayProbe.js';
var inlay = inlayHandler.handle(inlayText, null, INLAY_URI);
function hintsOn(list, line) { return list.filter(function(x) { return x.position.line === line; }); }
function labels(list) { return list.map(function(x) { return x.label; }); }

var easyRefs = index.getRefinements('foam.dao.EasyDAO').length;
var onName = hintsOn(inlay, 2);
test(easyRefs > 0 && onName.length === 1 &&
  onName[0].label === '×' + easyRefs + ( easyRefs === 1 ? ' refinement' : ' refinements' ),
  'class name carries the refinement count from FoamIndex.getRefinements: ' + JSON.stringify(labels(onName)));
test(onName.length === 1 && onName[0].position.character === 17,
  'the refinement hint sits just past the name\'s closing quote');

var onDelegate = hintsOn(inlay, 5);
test(labels(onDelegate).indexOf(': Proxy') !== -1,
  'a property with no class: shows the type it inherits: ' + JSON.stringify(labels(onDelegate)));
var typeHint = onDelegate.filter(function(x) { return x.label === ': Proxy'; })[0];
test(typeHint && typeHint.kind === 1 && typeHint.position.character === 22,
  'the type hint is kind Type, placed after the closing quote of delegate');
test(labels(onDelegate).indexOf('overrides ProxyDAO') !== -1,
  'a property a superclass declares says which superclass it overrides');
var overHint = onDelegate.filter(function(x) { return x.label === 'overrides ProxyDAO'; })[0];
test(overHint && overHint.kind === undefined, 'the override hint carries no kind');

test(hintsOn(inlay, 6).length === 0, 'a property with its own class: and nothing to override gets no hint');
test(hintsOn(inlay, 7).length === 0, 'a property the registry does not know gets no hint, not a guess');

var onRefinement = labels(hintsOn(inlay, 10));
test(onRefinement.length === 1 && onRefinement[0] === ': Proxy',
  'a refinement notes types only: no refinement count, no "overrides": ' + JSON.stringify(onRefinement));

var inlayRanged = inlayHandler.handle(inlayText,
  { start: { line: 5, character: 0 }, end: { line: 5, character: 40 } }, INLAY_URI);
test(inlayRanged.length === onDelegate.length && inlayRanged.every(function(x) { return x.position.line === 5; }),
  'only hints inside the requested range are returned: ' + inlayRanged.length);
test(inlayHandler.handle(inlayText,
  { start: { line: 5, character: 0 }, end: { line: 5, character: 21 } }, INLAY_URI).length === 0,
  'a range ending before the hint position excludes it');

test(inlayHandler.handle(inlayText, null, 'file:///nowhere/journal.jrl').length === 0,
  'journals get no inlay hints');

var selfPath = index.getRefinements('foam.dao.EasyDAO')[0];
var inlaySelf = selfPath ? inlayHandler.handle(inlayText, null, 'file://' + selfPath.path) : [];
test(selfPath && labels(hintsOn(inlaySelf, 2)).join() !== labels(onName).join(),
  'refinements in the file being viewed are not counted: ' + JSON.stringify(labels(hintsOn(inlaySelf, 2))));

// Saving a refining file re-indexes it. Its refinement rows used to be pushed
// again on every save, so the count above grew by one per save.
var refBefore = index.getRefinements('foam.dao.EasyDAO').length;
if ( selfPath ) {
  index.reindexPath(selfPath.path, 'class');
  index.reindexPath(selfPath.path, 'class');
}
test(selfPath && index.getRefinements('foam.dao.EasyDAO').length === refBefore,
  'two saves of a refining file leave the refinement count unchanged: ' +
  refBefore + ' -> ' + index.getRefinements('foam.dao.EasyDAO').length);


// === DocumentSymbol: a parse that stops early is not a finished range ===
//
// The grammar's closing `}` / `)` are optional (completion needs that
// mid-edit), so a parse that gives up partway used to record a span ending
// wherever it stopped — a class "ending" halfway through its methods. `new
// Date(0)` is a value shape the grammar has no arm for: the property holding
// it and the class around it both stop there. Neither may claim an extent.

section('DocumentSymbol: early-stopping parses keep a point range');
var stopText =
  "foam.CLASS({\n" +                                         // line 0
  "  package: 'test.ext',\n" +                               // line 1
  "  name: 'Stops',\n" +                                     // line 2
  "  properties: [\n" +                                      // line 3
  "    { name: 'fine' },\n" +                                 // line 4
  "    { name: 'when', value: new Date(0) },\n" +             // line 5
  "    'after'\n" +                                           // line 6
  "  ],\n" +                                                  // line 7
  "  methods: [\n" +                                         // line 8
  "    function go() {}\n" +                                  // line 9
  "  ]\n" +                                                   // line 10
  "});\n" +                                                   // line 11
  "foam.CLASS({ name: 'Next', properties: [ 'n' ] });\n" +    // line 12
  "foam.CLASS({ name: 'Third', constants: { T: new Date(0) }, methods: [ function go() {} ] });\n"; // line 13
var stopSyms = symExtHandler.handle(stopText, 'file:///Stops.js');
function isPoint(r) { return r.start.line === r.end.line && r.start.character === r.end.character; }
var stopCls = stopSyms[0];
// With no closed extent the class range is synthesized — its call to the
// furthest member — rather than the partial span the grammar stopped at
// (0:0-5:31, which ended in the middle of `when`).
test(stopCls && stopCls.range.start.line === 0 && stopCls.range.start.character === 0 &&
  stopCls.range.end.line === 9 && stopCls.range.end.character === 4,
  'a class whose parse stopped before its closing }) spans its call to its last member, not the partial parse: ' +
  JSON.stringify(stopCls && stopCls.range));
var stopFine = stopCls && childNamed(stopCls, 'fine');
var stopGo   = stopCls && childNamed(stopCls, 'go');
test(stopFine && stopFine.range.start.line === 4 && stopFine.range.start.character === 13 &&
  stopGo && stopGo.range.start.line === 9 && stopGo.range.start.character === 4,
  'members of a class with no extent keep their own positions, not the class line: ' +
  JSON.stringify([ stopFine && stopFine.range.start, stopGo && stopGo.range.start ]));
var stopWhen = stopCls && childNamed(stopCls, 'when');
test(stopWhen && stopWhen.range.start.line === 5 && stopWhen.range.start.character === 13 &&
  stopWhen.range.end.line === 5 && stopWhen.range.end.character === 17,
  'a property whose parse stopped before its } gets just its name, not the partial span: ' +
  JSON.stringify(stopWhen && stopWhen.range));
test(stopSyms[1] && stopSyms[1].range.start.line === 12 && stopSyms[1].range.end.line === 12 &&
  ! isPoint(stopSyms[1].range),
  'the next, well-formed model in the same file still gets its full extent');

var third = stopSyms[2];
var thirdGo = third && childNamed(third, 'go');
var thirdGoCol = stopText.split('\n')[13].indexOf('function go');
test(thirdGo && thirdGo.range.start.line === 13 && thirdGo.range.start.character === thirdGoCol,
  'a no-extent member is searched for in its own model: Third.go is at 13:' + thirdGoCol +
  ', not Stops.go on line 9 nor Third\'s call: ' + JSON.stringify(thirdGo && thirdGo.range.start));

// An extent can "close" on a `}))` that belongs to one of its own methods:
// the arrow function below throws the grammar's brace matching off, and the
// class call appeared to end after send(), with resetIdle still to come
// (src/foam/box/KeepAliveBox.js, 86:8 against 88:4). Code after an extent's
// end is what gives that away, so such an extent is refused.
var arrowText =
  "foam.CLASS({\n" +                                                   // 0
  "  name: 'KA',\n" +                                                  // 1
  "  methods: [\n" +                                                   // 2
  "    function send(e) {\n" +                                         // 3
  "      this.delegate.send(foam.box.Envelope.create({\n" +             // 4
  "        replyBox: {\n" +                                            // 5
  "          send: (e) => {\n" +                                        // 6
  "            if ( a ) {\n" +                                          // 7
  "              b();\n" +                                              // 8
  "            }\n" +                                                   // 9
  "          }\n" +                                                     // 10
  "        }\n" +                                                       // 11
  "      }));\n" +                                                      // 12
  "    },\n" +                                                          // 13
  "    function resetIdle() {}\n" +                                     // 14
  "  ]\n" +                                                             // 15
  "});\n";                                                             // 16
var arrowSyms = symExtHandler.handle(arrowText, 'file:///KA.js');
var arrowReset = arrowSyms[0] && childNamed(arrowSyms[0], 'resetIdle');
test(arrowReset && arrowReset.range.start.line === 14 && arrowReset.range.start.character === 4,
  'a member after an extent that closed too early keeps its own position: ' +
  JSON.stringify(arrowReset && arrowReset.range.start));
test(arrowSyms[0] && arrowSyms[0].range.end.line >= 14,
  'and the class range reaches it: ' + JSON.stringify(arrowSyms[0] && arrowSyms[0].range));

// Models pair with extents by name, not by position. A foam.CLASS run inside
// a method is a top-level-looking call the model cache never captures (or
// captures out of order), which shifted every later model onto the call before
// it (src/foam/dao/Relationship.js:329, junctionDAO 517:6 -> 396:0).
var runtimeText =
  "foam.CLASS({\n" +                                                   // 0
  "  name: 'Maker',\n" +                                               // 1
  "  methods: [\n" +                                                   // 2
  "    function make() { foam.CLASS({ name: 'Made' }); }\n" +           // 3
  "  ]\n" +                                                             // 4
  "});\n" +                                                             // 5
  "foam.CLASS({\n" +                                                   // 6
  "  name: 'Later',\n" +                                               // 7
  "  properties: [ { name: 'deep' } ]\n" +                             // 8
  "});\n";                                                             // 9
var runtimeSyms = symExtHandler.handle(runtimeText, 'file:///Runtime.js');
var later = runtimeSyms.filter(function(x) { return x.name === 'Later'; })[0];
var deep  = later && childNamed(later, 'deep');
test(later && later.range.start.line === 6 && later.selectionRange.start.line === 7 &&
  deep && deep.selectionRange.start.line === 8 && deep.selectionRange.start.character === 25,
  'a class after a runtime foam.CLASS pairs with its own call: ' +
  JSON.stringify([ later && later.range, deep && deep.selectionRange ]));

// Shaped like src/foam/core/reflow/Mapping.js and src/foam/core/Boot.js: a
// model whose parse stopped early (no extent) and one of whose methods builds
// a class at runtime. That inner foam.CLASS( is a significant call, but it is
// the model's own code — ending the member search there put every later member
// on the model's own line (Mapping.js `process` at L136 instead of L415).
var nestedText =
  "foam.CLASS({\n" +                                                   // 0
  "  name: 'Mapping',\n" +                                             // 1
  "  constants: { T: new Date(0) },\n" +                               // 2
  "  methods: [\n" +                                                   // 3
  "    function install() {\n" +                                        // 4
  "      foam.CLASS({ name: 'Built', properties: [ 'x' ] });\n" +        // 5
  "    },\n" +                                                          // 6
  "    function process() {}\n" +                                       // 7
  "  ],\n" +                                                            // 8
  "  properties: [ { name: 'prop' } ]\n" +                              // 9
  "});\n" +                                                             // 10
  "foam.CLASS({ name: 'After', methods: [ function end() {} ] });\n";   // 11
var nestedSyms = symExtHandler.handle(nestedText, 'file:///Mapping.js');
var mapping = nestedSyms[0], process_ = mapping && childNamed(mapping, 'process'),
    prop = mapping && childNamed(mapping, 'prop');
test(process_ && process_.range.start.line === 7 && process_.range.start.character === 4,
  'a member after a runtime foam.CLASS in its own model keeps its line: ' +
  JSON.stringify(process_ && process_.range.start));
test(prop && prop.selectionRange.start.line === 9,
  'and so does a property declared after it: ' + JSON.stringify(prop && prop.selectionRange.start));
var afterEnd = nestedSyms[1] && childNamed(nestedSyms[1], 'end');
test(afterEnd && afterEnd.range.start.line === 11,
  'the next top-level model is still where the window ends');

// A class followed by ordinary script code is a finished class. Refusing its
// extent for the code after it cost 16 such models their extents and inlay
// hints (src/foam/lang/stdlib.js, most demos). Only a member of the model
// sitting past the extent's end (the KeepAliveBox shape above) refuses it.
var scriptText =
  "foam.CLASS({\n" +                                                   // 0
  "  name: 'Scripted',\n" +                                            // 1
  "  properties: [ 'a' ]\n" +                                          // 2
  "});\n" +                                                             // 3
  "var instance = Scripted.create();\n" +                               // 4
  "instance.a = 1;\n";                                                  // 5
var scriptSyms = symExtHandler.handle(scriptText, 'file:///Scripted.js');
test(scriptSyms[0] && scriptSyms[0].range.start.line === 0 && scriptSyms[0].range.end.line === 3 &&
  scriptSyms[0].range.end.character === 2,
  'a class followed by script code keeps its extent: ' + JSON.stringify(scriptSyms[0] && scriptSyms[0].range));

var allSyms = extSyms.concat(stopSyms, arrowSyms, runtimeSyms, nestedSyms, scriptSyms);
test(allSyms.every(function(s) {
  return ( s.children || [] ).every(function(c) {
    return contains(s.range, c.range) && contains(c.range, c.selectionRange);
  });
}), 'no child range falls outside its parent, and no selectionRange outside its range');

// A file whose ONLY model is a nameless refinement never gets a pathIndex_
// row. The drop used to be gated on that row, so this file's refinement was
// counted once more on every re-index: 1 -> 2 -> 4.
(function() {
  var os = require('os'), fsN = require('fs'), pathN = require('path');
  var dir  = fsN.mkdtempSync(pathN.join(os.tmpdir(), 'lsp-nameless-'));
  var file = pathN.join(dir, 'NamelessRefinement.js');
  fsN.writeFileSync(file, "foam.CLASS({ refines: 'foam.dao.EasyDAO', properties: [ 'zz' ] });\n");
  var base = index.getRefinements('foam.dao.EasyDAO').length;
  try {
    index.indexFileClasses_(file, ['js'], pathN.join(dir, 'pom.js'), 'NamelessRefinement', fsN);
    var once = index.getRefinements('foam.dao.EasyDAO').length;
    index.indexFileClasses_(file, ['js'], pathN.join(dir, 'pom.js'), 'NamelessRefinement', fsN);
    index.indexFileClasses_(file, ['js'], pathN.join(dir, 'pom.js'), 'NamelessRefinement', fsN);
    var thrice = index.getRefinements('foam.dao.EasyDAO').length;
    test(once === base + 1 && thrice === once,
      'a nameless-refinement file re-indexed three times counts once: ' + base + ' -> ' + once + ' -> ' + thrice);
  } finally {
    index.dropRefinementsFrom_(file);
    fsN.rmSync(dir, { recursive: true, force: true });
  }
})();
