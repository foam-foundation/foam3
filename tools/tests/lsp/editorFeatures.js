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


// === DocumentColorHandler ===

section('DocumentColorHandler');
var colorHandler = foam.parse.lsp.handlers.DocumentColorHandler.create({
  index: index, cssTokenResolver: cssTokenResolver, cache: cache
});
var COLOR_URI = 'file:///tmp/lsp-color/Swatch.js';

// A token whose resolved value is a hex colour, picked from the live resolver
// so the test does not pin a design-system value.
var hexToken = cssTokenResolver.getAllTokenNames().filter(function(n) {
  return n.indexOf('$') === -1 && /^#[0-9a-fA-F]{6}$/.test(cssTokenResolver.resolveTokenValue(n) || '');
})[0];
test(!! hexToken, 'DocumentColor: the resolver has a token resolving to a 6-digit hex');

var colorText = "foam.CLASS({\n" +                         // 0
  "  package: 'test.color',\n" +                           // 1
  "  name: 'Swatch',\n" +                                  // 2
  "  css: `\n" +                                           // 3
  "    ^ { color: $" + hexToken + "; }\n" +                // 4
  "    ^x { background: $noSuchTokenZq9; }\n" +            // 5
  "    ^y { border-color: #ff0000; }\n" +                  // 6
  "    #add { display: block; }\n" +                       // 7
  "    /* color: $" + hexToken + " */\n" +                 // 8
  "    ^z { fill: url(#abc); }\n" +                       // 9
  "    ^w::after { content: '#fff'; }\n" +                // 10
  "    ^v { color: hsl(120, 100%, 50%); }\n" +            // 11
  "  `\n" +
  "});\n";
var swatches = colorHandler.handle(colorText, COLOR_URI);
var onLine = function(l) { return swatches.filter(function(s) { return s.range.start.line === l; }); };

var tokSw = onLine(4);
var tokCol = colorText.split('\n')[4].indexOf('$' + hexToken);
test(tokSw.length === 1 && tokSw[0].range.start.character === tokCol &&
     tokSw[0].range.end.character === tokCol + hexToken.length + 1,
  'DocumentColor: a resolving $token gets one swatch spanning the token text');
var expectHex = cssTokenResolver.resolveTokenValue(hexToken).toLowerCase();
test(tokSw.length === 1 && colorHandler.toHex_(tokSw[0].color) === expectHex,
  'DocumentColor: the swatch colour is the token\'s resolved value (' + expectHex + ')');
test(onLine(5).length === 0, 'DocumentColor: an unresolved $token gets no swatch');
var litSw = onLine(6);
test(litSw.length === 1 && litSw[0].color.red === 1 && litSw[0].color.green === 0 && litSw[0].color.alpha === 1,
  'DocumentColor: a raw #ff0000 declaration value gets a red swatch');
test(onLine(7).length === 0, 'DocumentColor: an id selector (#add) is not a colour');
test(onLine(8).length === 0, 'DocumentColor: a $token inside a css comment gets no swatch');
test(onLine(9).length === 0, 'DocumentColor: a #id inside url(...) is not a colour');
var aposText = "foam.CLASS({\n  package: 'test.color',\n  name: 'Apos',\n  css: `\n" +
  "    ^a { /* don't */ color: #ff0000; /* it's */ }\n" +               // 4
  "    ^b::after { content: '\\''; } ^c { color: #00ff00; } ^d::after { content: 'x'; }\n" + // 5
  "  `\n});\n";
var aposSw = colorHandler.handle(aposText, 'file:///tmp/lsp-color/Apos.js');
test(aposSw.filter(function(s) { return s.range.start.line === 4; }).length === 1,
  'DocumentColor: an apostrophe inside a comment does not hide the real swatch after it');
test(aposSw.filter(function(s) { return s.range.start.line === 5; }).length === 1,
  'DocumentColor: an escaped quote inside a string does not hide the swatch after it');
test(onLine(10).length === 0, 'DocumentColor: a #fff inside a quoted string is not a colour');
test(colorHandler.handle('var x = "#ff0000";', 'file:///tmp/plain.js').length === 0,
  'DocumentColor: a non-FOAM file answers []');

// colorPresentation: never replace a token with a literal.
var tokPres = colorHandler.presentations(colorText,
  { color: { red: 0, green: 1, blue: 0, alpha: 1 }, range: tokSw[0] && tokSw[0].range });
test(tokPres.length === 1 && tokPres[0].label === '$' + hexToken && ! tokPres[0].textEdit,
  'ColorPresentation: on a $token the only presentation is the token text itself');
var litPres = colorHandler.presentations(colorText,
  { color: { red: 0, green: 1, blue: 0, alpha: 1 }, range: litSw[0] && litSw[0].range });
test(litPres.length === 3 && litPres[0].label === '#00ff00' && litPres[1].label === 'rgb(0, 255, 0)' &&
     litPres[2].label === 'hsl(120, 100%, 50%)',
  'ColorPresentation: a hex literal is offered hex first, then rgb, then hsl');
var hslSw = onLine(11);
var hslPres = colorHandler.presentations(colorText,
  { color: { red: 1, green: 0, blue: 0, alpha: 0.5 }, range: hslSw[0] && hslSw[0].range });
test(colorHandler.toHsl_({ red: 1, green: 0, blue: 0.001, alpha: 1 }) === 'hsl(0, 100%, 50%)',
  'ColorPresentation: a hue that rounds to 360 is written as 0');
test(hslSw.length === 1 && hslPres.length === 3 && hslPres[0].label === 'hsla(0, 100%, 50%, 0.5)',
  'ColorPresentation: an hsl literal is offered hsl first (hsla when alpha < 1)');
var hsl = colorHandler.parseColor('hsla(0 0% 100% / 0.9)');
test(hsl && hsl.red === 1 && hsl.blue === 1 && Math.abs(hsl.alpha - 0.9) < 1e-9,
  'DocumentColor: parses the modern hsla(h s% l% / a) form tokens resolve to');
// Tabs and SegmentedTabs both declare tabActiveColor with different values;
// each css: block's swatch must show its own class's value, as the page does.
var tabsPath = require('path').join(__dirname, '../../../src/foam/u2/Tabs.js');
var tabsText = require('fs').readFileSync(tabsPath, 'utf8');
var tabsLines = tabsText.split('\n');
var tabsSw = colorHandler.handle(tabsText, 'file://' + tabsPath).filter(function(s) {
  return tabsLines[s.range.start.line].indexOf('$tabActiveColor') !== -1;
});
var segLine = tabsText.substring(0, tabsText.indexOf("name: 'SegmentedTabs'")).split('\n').length - 1;
var hexIn = function(id) {
  return foam.CSS.returnTokenValue('$tabActiveColor', foam.lookup(id), foam.__context__).toLowerCase();
};
test(hexIn('foam.u2.Tabs') !== hexIn('foam.u2.SegmentedTabs'),
  'DocumentColor: Tabs and SegmentedTabs declare different tabActiveColor values');
test(tabsSw.length >= 2 && tabsSw.every(function(s) {
    var id = s.range.start.line > segLine ? 'foam.u2.SegmentedTabs' : 'foam.u2.Tabs';
    return colorHandler.toHex_(s.color) === hexIn(id);
  }),
  'DocumentColor: a token two classes declare resolves against the class whose css: block uses it');
test(colorHandler.parseColor('2px solid') === null && colorHandler.parseColor('function(...)') === null,
  'DocumentColor: non-colour token values parse to null');


// === DocumentLinkHandler ===

section('DocumentLinkHandler');
var linkHandler = foam.parse.lsp.handlers.DocumentLinkHandler.create({ index: index });
var linkTarget = function(id) {
  return require('url').pathToFileURL(index.getFilePath(id)).href + '#L' + ( index.getClassLine(id) + 1 );
};
test(!! index.getFilePath('foam.dao.MDAO') && !! index.getFilePath('foam.u2.View'),
  'DocumentLink: fixture classes foam.dao.MDAO and foam.u2.View have files on record');

var linkText = "foam.CLASS({\n" +                          // 0
  "  package: 'test.link',\n" +                            // 1
  "  name: 'Linked',\n" +                                  // 2
  "  extends: 'foam.u2.View',\n" +                         // 3
  "  requires: [\n" +                                      // 4
  "    'foam.dao.MDAO',\n" +                               // 5
  "    'foam.u2.ViewNoSuchZq9'\n" +                        // 6
  "  ]\n" +
  "});\n";
var links = linkHandler.handle(linkText, 'file:///tmp/lsp-link/Linked.js');
var linkOn = function(ls, l) { return ls.filter(function(k) { return k.range.start.line === l; }); };
var reqLink = linkOn(links, 5);
test(reqLink.length === 1 && reqLink[0].target === linkTarget('foam.dao.MDAO') &&
     reqLink[0].range.start.character === 5 && reqLink[0].range.end.character === 5 + 'foam.dao.MDAO'.length,
  'DocumentLink: a requires: string links to the class file at its declaration line');
var extLink = linkOn(links, 3);
test(extLink.length === 1 && extLink[0].target === linkTarget('foam.u2.View'),
  'DocumentLink: an extends: string links to the class file');
test(linkOn(links, 6).length === 0,
  'DocumentLink: an unknown id gets no link — not even one for its registered prefix foam.u2.View');

var jrlText = 'p({"class":"foam.dao.MDAO","of":"foam.u2.View"})\n' +
              'p({"class":"no.such.ClazzZq9"})\n';
var jrlLinks = linkHandler.handle(jrlText, 'file:///tmp/lsp-link/x.jrl');
var jrlLine0 = linkOn(jrlLinks, 0);
test(jrlLine0.some(function(k) { return k.target === linkTarget('foam.dao.MDAO') && k.range.start.character === 12; }),
  'DocumentLink: a jrl "class" value links to the class file');
test(jrlLine0.some(function(k) { return k.target === linkTarget('foam.u2.View'); }),
  'DocumentLink: a jrl "of" value naming a class links too');
test(jrlLine0.length === 2, 'DocumentLink: one link per span even though two harvests find the "class" value');
test(linkOn(jrlLinks, 1).length === 0, 'DocumentLink: an unknown jrl class id gets no link');
// Size limit: over maxJrlGrammarSize the JrlGrammar pass is skipped, so the
// "of" string ref disappears while the scanJrlClassRefs "class" link stays.
var smallCapLinks = foam.parse.lsp.handlers.DocumentLinkHandler.create({
  index: index, maxJrlGrammarSize: 10 }).handle(jrlText, 'file:///tmp/lsp-link/big.jrl');
var capLine0 = linkOn(smallCapLinks, 0);
test(capLine0.length === 1 && capLine0[0].target === linkTarget('foam.dao.MDAO'),
  'DocumentLink: over the size limit only the cheap "class" link is kept');
var capHandler = foam.parse.lsp.handlers.DocumentLinkHandler.create({ index: index, maxJrlGrammarSize: 10 });
var capLogs = 0, realErr = console.error;
console.error = function(s) { if ( String(s).indexOf('journal string refs skipped') !== -1 ) capLogs++; };
try {
  capHandler.handle(jrlText, 'file:///tmp/lsp-link/a.jrl');
  capHandler.handle(jrlText, 'file:///tmp/lsp-link/a.jrl');
  capHandler.handle(jrlText, 'file:///tmp/lsp-link/b.jrl');
} finally { console.error = realErr; }
test(capLogs === 2, 'DocumentLink: the size-cap skip is logged once per URI (got ' + capLogs + ')');
test(linkHandler.handle('var x = "foam.dao.MDAO";', 'file:///tmp/plain.js').length === 0,
  'DocumentLink: a non-FOAM, non-journal file answers []');
