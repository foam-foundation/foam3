/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// Split from testFoamLSP.js — diagnostics tests.
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

// === DIAGNOSTICS TESTS ===

section('DiagnosticsHandler');
var diagHandler = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index });
// buildAddExtractEdit and friends moved to I18nHandler (foam3#5283) — construction
// mirrors diagHandler's above so behavior isn't affected by a different cache instance.
var i18nHandler = foam.parse.lsp.handlers.I18nHandler.create({ index: index });

// Valid file — no errors
var validText = "foam.CLASS({\n  package: 'test',\n  name: 'Valid',\n  extends: 'foam.lang.FObject'\n})";
var diags = diagHandler.handle(validText);
var errors = diags.filter(function(d) { return d.severity <= 2; });
test(errors.length === 0, 'Valid file has no errors/warnings');

// Invalid extends
var invalidText = "foam.CLASS({\n  extends: 'foo.bar.Missing'\n})";
var diags2 = diagHandler.handle(invalidText);
test(diags2.some(function(d) { return d.message.indexOf('Missing') !== -1; }), 'Flags unknown extends class');

// Valid property type (full path) — should NOT be flagged
var validPropText = "foam.CLASS({\n  properties: [\n    { class: 'foam.lang.FObjectProperty', name: 'x' }\n  ]\n})";
var diags3 = diagHandler.handle(validPropText);
var propErrors = diags3.filter(function(d) { return d.message.indexOf('FObjectProperty') !== -1; });
test(propErrors.length === 0, 'foam.lang.FObjectProperty NOT flagged as unknown');

// Valid property type (short name) — should NOT be flagged
var validShortPropText = "foam.CLASS({\n  properties: [\n    { class: 'String', name: 'x' }\n  ]\n})";
var diags3b = diagHandler.handle(validShortPropText);
var shortPropErrors = diags3b.filter(function(d) { return d.message.indexOf('String') !== -1; });
test(shortPropErrors.length === 0, 'String NOT flagged as unknown');

// Constants strings — should NOT be flagged
var constantsText = "foam.CLASS({\n  constants: [\n    { name: 'MACROS', value: ['DisplayWidth.XS', 'primary1'] }\n  ]\n})";
var diags4 = diagHandler.handle(constantsText);
test(diags4.filter(function(d) { return d.message.indexOf('DisplayWidth') !== -1; }).length === 0,
  'DisplayWidth.XS in constants NOT flagged');

// Requires with 'as' alias — should NOT flag the aliased class as unknown
var aliasText = "foam.CLASS({\n  requires: [\n    'foam.parse.Suggestion as Sug'\n  ]\n})";
var aliasDiags = diagHandler.handle(aliasText);
var aliasErrors = aliasDiags.filter(function(d) { return d.message.indexOf('Suggestion') !== -1; });
test(aliasErrors.length === 0, 'Requires with as alias NOT flagged as unknown');

// Requires with 'as' alias for unknown class — SHOULD flag it
var unknownAliasText = "foam.CLASS({\n  requires: [\n    'foo.bar.Missing as M'\n  ]\n})";
var unknownAliasDiags = diagHandler.handle(unknownAliasText);
test(unknownAliasDiags.some(function(d) { return d.message.indexOf('Missing') !== -1; }), 'Unknown class with as alias IS flagged');

// Interface javaGetter referencing own property — should NOT be flagged
var ifaceText = 'foam.INTERFACE({ package: ' + Q + 'test' + Q + ', name: ' + Q + 'MyAware' + Q + ', properties: [{ class: ' + Q + 'String' + Q + ', name: ' + Q + 'fileDate' + Q + ', javaGetter: ' + Q + 'return getFileDate();' + Q + ' }] })';
var ifaceDiags = diagHandler.handle(ifaceText);
var ifaceGetterErrors = ifaceDiags.filter(function(d) { return d.message.indexOf('fileDate') !== -1; });
test(ifaceGetterErrors.length === 0, 'Interface own property getter NOT flagged');

// Test getImplementors
var implementors = index.getImplementors('foam.core.auth.CreatedByAware');
test(implementors.length > 0, 'getImplementors finds classes implementing CreatedByAware: ' + implementors.length);

// === Per-class cssTokens loaded into the resolver (issue #5032) ===
section('CSSTokenResolver — per-class cssTokens (issue #5032)');

// Tabs.js defines its own ColorToken cssTokens — they should be in the
// resolver's map and report Tabs as their source.
test(cssTokenResolver.tokenExists('tabActiveColor'),
  'Per-class token `tabActiveColor` (Tabs.js) is loaded');
var tabInfo = cssTokenResolver.getTokenInfo('tabActiveColor');
test(tabInfo && tabInfo.source === 'foam.u2.Tabs',
  'Per-class token `tabActiveColor` source is foam.u2.Tabs');
test(tabInfo && tabInfo.type === 'ColorToken',
  'Per-class token `tabActiveColor` type is ColorToken');

// CheckBox.js defines `checkboxColor`.
test(cssTokenResolver.tokenExists('checkboxColor'),
  'Per-class token `checkboxColor` (CheckBox.js) is loaded');
var cbInfo = cssTokenResolver.getTokenInfo('checkboxColor');
test(cbInfo && cbInfo.source === 'foam.u2.CheckBox',
  'Per-class token `checkboxColor` source is foam.u2.CheckBox');

// Project-wide CSSTokens still wins over collisions.
var primaryInfo = cssTokenResolver.getTokenInfo('primary400');
test(primaryInfo && primaryInfo.source === 'foam.u2.CSSTokens',
  'Global token `primary400` still owned by foam.u2.CSSTokens');

// ColorToken suffix tokens — installInClass adds `$hover`, `$active`,
// `$disabled`, `$foreground` and combos via Object.defineProperty. The
// resolver picks them up by walking the class's own properties (rather
// than `getOwnAxiomsByClass`, which misses non-registered axioms) and
// delegates resolution to foam.CSS.returnTokenValue.
test(cssTokenResolver.tokenExists('primary400$hover'),
  'ColorToken suffix: $primary400$hover registered');
test(cssTokenResolver.tokenExists('primary400$foreground'),
  'ColorToken suffix: $primary400$foreground registered');
test(cssTokenResolver.tokenExists('primary400$disabled$foreground'),
  'ColorToken suffix: $primary400$disabled$foreground registered');

var fgVal = cssTokenResolver.resolveTokenValue('primary400$foreground');
test(fgVal && /^#[0-9A-Fa-f]+$/.test(fgVal),
  'ColorToken suffix: $primary400$foreground resolves to a hex color (got ' + fgVal + ')');

// Per-class ColorToken suffixes (Tabs.tabActiveColor) — same path through
// foam.CSS, so per-class works without any additional special-casing.
test(cssTokenResolver.tokenExists('tabActiveColor$foreground'),
  'ColorToken suffix: per-class $tabActiveColor$foreground registered');

// Diagnostic regex must match the full `$base$suffix` chain as ONE token,
// not split it into `$base` (known) and `$suffix` (unknown). Using a real
// per-class ColorToken (foam.u2.tag.Button — buttonPrimaryColor) so the
// scenario mirrors the editor case.
var compoundCssDiag = foam.parse.lsp.handlers.DiagnosticsHandler.create({
  index: index, cssTokenResolver: cssTokenResolver
});
var compoundSrc =
  "foam.CLASS({\n  package: 'test',\n  name: 'CompoundUser',\n" +
  "  css: `\n    ^ { color: $buttonPrimaryColor$foreground; }\n  `\n})";
var compoundDiags = compoundCssDiag.handle(compoundSrc);
test(compoundDiags.every(function(d) { return d.message.indexOf('$foreground') === -1; }),
  'CSS token diagnostic: $foreground suffix not flagged as standalone unknown token');
test(compoundDiags.every(function(d) { return d.message.indexOf('Unknown CSS token') === -1; }),
  'CSS token diagnostic: $buttonPrimaryColor$foreground recognized as a known compound token');

// === LSP #4993 Fix 3: user-defined cssTokens not flagged as unknown ===
section('DiagnosticsHandler — local cssTokens (issue #4993)');
var diagWithTokens = foam.parse.lsp.handlers.DiagnosticsHandler.create({
  index: index,
  cssTokenResolver: cssTokenResolver
});

var localTokenSrc =
  "foam.CLASS({\n" +
  "  package: 'test',\n  name: 'LocalTokenUser',\n" +
  "  cssTokens: [\n    { name: 'tooltipBackground', value: '#eeeeee' }\n  ],\n" +
  "  css: `\n    ^ { background: $tooltipBackground; color: $white; }\n  `\n" +
  "})";
var localDiags = diagWithTokens.handle(localTokenSrc);
test(localDiags.filter(function(d) { return d.message.indexOf('tooltipBackground') !== -1; }).length === 0,
  'Local cssTokens: $tooltipBackground NOT flagged as unknown');
test(localDiags.filter(function(d) { return d.message.indexOf('Unknown CSS token') !== -1 && d.message.indexOf('nonExistent') !== -1; }).length === 0,
  'Local cssTokens: unrelated tokens untouched');

var unknownTokenSrc =
  "foam.CLASS({\n  package: 'test',\n  name: 'UnknownTokenUser',\n" +
  "  cssTokens: [\n    { name: 'fooBg', value: '#ffffff' }\n  ],\n" +
  "  css: `\n    ^ { background: $nonExistent; }\n  `\n})";
var unknownDiags = diagWithTokens.handle(unknownTokenSrc);
test(unknownDiags.some(function(d) { return d.message.indexOf('nonExistent') !== -1 && d.message.indexOf('Unknown CSS token') !== -1; }),
  'Local cssTokens: $nonExistent still flagged');

// === LSP #4993 Fix 4: unused ^classname in css: ===


// === LSP #4993 Fix 4: unused ^classname in css: ===
section('DiagnosticsHandler — unused ^classname (issue #4993)');
var unusedSrc =
  "foam.CLASS({\n  package: 'test',\n  name: 'UnusedCss',\n" +
  "  css: `\n    ^foo { color: red; }\n    ^bar { color: blue; }\n  `,\n" +
  "  methods: [\n" +
  "    function render() { this.addClass(this.myClass('foo')); }\n" +
  "  ]\n})";
var unusedDiags = diagWithTokens.handle(unusedSrc);
var unusedWarns = unusedDiags.filter(function(d) { return /Unused CSS class/.test(d.message); });
test(unusedWarns.length === 1, 'Unused ^classname: exactly one unused class flagged');
test(unusedWarns.some(function(d) { return d.message.indexOf("'^bar'") !== -1; }),
  'Unused ^classname: ^bar (unused) is flagged');
test(! unusedWarns.some(function(d) { return d.message.indexOf("'^foo'") !== -1; }),
  'Unused ^classname: ^foo (applied via myClass) is NOT flagged');

// === issue #5092: pseudo-selector occurrences of an unused class ===
// Every occurrence of an unused ^name gets its own diagnostic — including
// ^name:hover / ^name p — not just the first selector it appears in.
var pseudoSrc =
  "foam.CLASS({\n  package: 'test',\n  name: 'PseudoCss',\n" +
  "  css: `\n    ^used { color: red; }\n    ^used:hover { color: pink; }\n" +
  "    ^dead { padding: 4px; }\n    ^dead:hover { background: blue; }\n    ^dead p { margin: 0; }\n  `,\n" +
  "  methods: [\n" +
  "    function render() { this.addClass(this.myClass('used')); }\n" +
  "  ]\n})";
var pseudoDiags = diagWithTokens.handle(pseudoSrc);
var pseudoWarns = pseudoDiags.filter(function(d) { return /Unused CSS class '\^dead'/.test(d.message); });
test(pseudoWarns.length === 3,
  'Unused ^classname #5092: all 3 occurrences of ^dead flagged (base, :hover, descendant)');
var pseudoLines = pseudoWarns.map(function(d) { return d.range.start.line; }).sort();
test(pseudoLines.length === 3 && pseudoLines[0] !== pseudoLines[1] && pseudoLines[1] !== pseudoLines[2],
  'Unused ^classname #5092: diagnostics land on 3 distinct selector lines');
test(! pseudoDiags.some(function(d) { return /Unused CSS class '\^used'/.test(d.message); }),
  'Unused ^classname #5092: ^used and ^used:hover NOT flagged (class is applied)');

// Dynamic myClass(var) → suppress unused-class diagnostics entirely
var dynamicSrc =
  "foam.CLASS({\n  package: 'test',\n  name: 'DynamicMyClass',\n" +
  "  css: `\n    ^alpha { color: red; }\n    ^beta { color: blue; }\n  `,\n" +
  "  methods: [\n" +
  "    function render(tag) { this.addClass(this.myClass(tag)); }\n" +
  "  ]\n})";
var dynamicDiags = diagWithTokens.handle(dynamicSrc);
test(dynamicDiags.filter(function(d) { return /Unused CSS class/.test(d.message); }).length === 0,
  'Unused ^classname: dynamic myClass(arg) suppresses all unused-class warnings');

// === LSP #4993 Fix 1: go-to-definition follows FObjectProperty of: ===


// === RAW CSS VALUE DIAGNOSTICS ===

section('Raw CSS Value Diagnostics');

// Hex color in css: template string — should warn
var hexCssText = "foam.CLASS({\n  package: 'test',\n  name: 'HexTest',\n  css: `\n    ^ { color: #FF0000; }\n  `\n})";
var hexDiags = diagHandler.handle(hexCssText);
test(hexDiags.some(function(d) { return /raw color/i.test(d.message) && d.message.indexOf('#FF0000') !== -1; }), 'Raw CSS: hex color in css: flagged');

// rgb() in css: — should warn
var rgbCssText = "foam.CLASS({\n  package: 'test',\n  name: 'RgbTest',\n  css: `\n    ^ { background-color: rgb(255, 0, 0); }\n  `\n})";
var rgbDiags = diagHandler.handle(rgbCssText);
test(rgbDiags.some(function(d) { return /raw color/i.test(d.message) && d.message.indexOf('rgb(') !== -1; }), 'Raw CSS: rgb() in css: flagged');

// $token reference — should NOT warn
var tokenCssText = "foam.CLASS({\n  package: 'test',\n  name: 'TokenTest',\n  css: `\n    ^ { color: $primary400; }\n  `\n})";
var tokenDiags = diagHandler.handle(tokenCssText);
var tokenRawWarns = tokenDiags.filter(function(d) { return /raw color/i.test(d.message); });
test(tokenRawWarns.length === 0, 'Raw CSS: $token NOT flagged');

// Non-color property — should NOT warn
var widthCssText = "foam.CLASS({\n  package: 'test',\n  name: 'WidthTest',\n  css: `\n    ^ { width: 100px; height: 50px; }\n  `\n})";
var widthDiags = diagHandler.handle(widthCssText);
var widthRawWarns = widthDiags.filter(function(d) { return /raw color/i.test(d.message); });
test(widthRawWarns.length === 0, 'Raw CSS: width/height NOT flagged');

// Hex color in enum property value — should warn
var enumCssText = "foam.ENUM({\n  package: 'test',\n  name: 'LogLevel',\n  values: [\n    { name: 'ERROR', color: '#FF0000' }\n  ]\n})";
var enumDiags = diagHandler.handle(enumCssText);
test(enumDiags.some(function(d) { return /raw color/i.test(d.message); }), 'Raw CSS: hex in enum color property flagged');

// 3-char hex — should warn
var hex3CssText = "foam.CLASS({\n  package: 'test',\n  name: 'Hex3Test',\n  css: `\n    ^ { border-color: #F00; }\n  `\n})";
var hex3Diags = diagHandler.handle(hex3CssText);
test(hex3Diags.some(function(d) { return /raw color/i.test(d.message); }), 'Raw CSS: 3-char hex flagged');

// === EXPRESSION PARAMETER VALIDATION ===



// === EXPRESSION PARAMETER VALIDATION ===

section('Expression Parameter Validation');

// Register test models for expression chain validation
foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'ExprParent',
  properties: [
    { class: 'String', name: 'title' },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.test.ExprChild',
      name: 'child'
    },
    { class: 'Boolean', name: 'isActive' }
  ]
});

foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'ExprChild',
  properties: [
    { class: 'String', name: 'label' },
    { class: 'Int', name: 'count' }
  ]
});

// Valid simple property — no warning
var exprValidText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ExprParent',\n  properties: [\n    { class: 'String', name: 'title' },\n    { class: 'FObjectProperty', of: 'foam.parse.lsp.test.ExprChild', name: 'child' },\n    { class: 'Boolean', name: 'isActive' },\n    { name: 'computed', expression: function(title, isActive) { return title + isActive; } }\n  ]\n})";
var exprValidDiags = diagHandler.handle(exprValidText);
var exprTitleWarns = exprValidDiags.filter(function(d) { return d.message.indexOf("'title'") !== -1 && d.message.indexOf('does not exist') !== -1; });
test(exprTitleWarns.length === 0, 'Expression: valid property title NOT flagged');

// Invalid property name — should warn
var exprInvalidText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ExprParent',\n  properties: [\n    { class: 'String', name: 'title' },\n    { name: 'computed', expression: function(title, nonExistent) { return title; } }\n  ]\n})";
var exprInvalidDiags = diagHandler.handle(exprInvalidText);
test(exprInvalidDiags.some(function(d) { return d.message.indexOf('nonExistent') !== -1 && d.message.indexOf('does not exist') !== -1; }), 'Expression: invalid property nonExistent IS flagged');

// Slot access suffix $ — should validate base name
var exprSlotText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ExprParent',\n  properties: [\n    { class: 'Boolean', name: 'isActive' },\n    { name: 'computed', expression: function(isActive$) { return isActive$; } }\n  ]\n})";
var exprSlotDiags = diagHandler.handle(exprSlotText);
var exprSlotWarns = exprSlotDiags.filter(function(d) { return d.message.indexOf('isActive') !== -1 && d.message.indexOf('does not exist') !== -1; });
test(exprSlotWarns.length === 0, 'Expression: isActive$ (slot suffix) NOT flagged');

// Deep $ chain — valid path
var exprChainText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ExprParent',\n  properties: [\n    { class: 'FObjectProperty', of: 'foam.parse.lsp.test.ExprChild', name: 'child' },\n    { name: 'computed', expression: function(child$label) { return child$label; } }\n  ]\n})";
var exprChainDiags = diagHandler.handle(exprChainText);
var exprChainWarns = exprChainDiags.filter(function(d) { return d.message.indexOf('does not exist') !== -1 && (d.message.indexOf('child') !== -1 || d.message.indexOf('label') !== -1); });
test(exprChainWarns.length === 0, 'Expression: valid chain child$label NOT flagged');

// Deep $ chain — invalid segment
var exprBadChainText = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'ExprParent',\n  properties: [\n    { class: 'FObjectProperty', of: 'foam.parse.lsp.test.ExprChild', name: 'child' },\n    { name: 'computed', expression: function(child$bogus) { return child$bogus; } }\n  ]\n})";
var exprBadChainDiags = diagHandler.handle(exprBadChainText);
test(exprBadChainDiags.some(function(d) { return d.message.indexOf('bogus') !== -1 && d.message.indexOf('does not exist') !== -1; }), 'Expression: invalid chain segment bogus IS flagged');

// Unresolvable type — should NOT flag further segments (no false positives)
var exprStringChainText = "foam.CLASS({\n  package: 'test',\n  name: 'StrChainTest',\n  properties: [\n    { class: 'String', name: 'title' },\n    { name: 'computed', expression: function(title$length) { return title$length; } }\n  ]\n})";
var exprStrDiags = diagHandler.handle(exprStringChainText);
var exprStrWarns = exprStrDiags.filter(function(d) { return d.message.indexOf('length') !== -1 && d.message.indexOf('does not exist') !== -1; });
test(exprStrWarns.length === 0, 'Expression: unresolvable chain stops validation (no false positive on String$length)');

// Multi-model file — expression params should NOT bleed across models
var multiModelText = "foam.CLASS({\n  package: 'test',\n  name: 'ModelA',\n  properties: [\n    { class: 'String', name: 'propA' },\n    { name: 'computed', expression: function(propA) { return propA; } }\n  ]\n})\n\nfoam.CLASS({\n  package: 'test',\n  name: 'ModelB',\n  properties: [\n    { class: 'String', name: 'propB' },\n    { name: 'computed', expression: function(propB) { return propB; } }\n  ]\n})";
var multiDiags = diagHandler.handle(multiModelText);
var multiWarns = multiDiags.filter(function(d) { return d.message.indexOf('does not exist') !== -1 && d.message.indexOf('expression') === -1; });
var propAOnB = multiWarns.filter(function(d) { return d.message.indexOf('propA') !== -1 && d.message.indexOf('ModelB') !== -1; });
var propBOnA = multiWarns.filter(function(d) { return d.message.indexOf('propB') !== -1 && d.message.indexOf('ModelA') !== -1; });
test(propAOnB.length === 0, 'Expression: propA NOT flagged against ModelB (multi-model scoping)');
test(propBOnA.length === 0, 'Expression: propB NOT flagged against ModelA (multi-model scoping)');

// === POM COMPLETIONS ===



// === MODELED TYPES ===
section('CompletionItem and Diagnostic models');

var CI = foam.parse.lsp.CompletionItem;
var item = CI.create({
  label: 'foo', kind: CI.KIND_CLASS, detail: 'a class',
  filterText: 'foo', sortText: '!foo'
});
var itemLSP = item.toLSP();
test(itemLSP.label === 'foo', 'CompletionItem.toLSP preserves label');
test(itemLSP.kind === 7, 'CompletionItem.toLSP uses class kind 7');
test(itemLSP['class'] === undefined, 'CompletionItem.toLSP strips FOAM class marker');
test(itemLSP.insertText === undefined, 'CompletionItem.toLSP omits unset optional fields');

var D = foam.parse.lsp.Diagnostic;
var diag = D.create({
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
  severity: D.WARNING,
  message: 'test',
  code: 'TEST-1',
  fix: { title: 'Fix it', edit: {} }
});
var diagLSP = diag.toLSP();
test(diagLSP.message === 'test', 'Diagnostic.toLSP preserves message');
test(diagLSP.severity === 2, 'Diagnostic.toLSP uses WARNING=2');
test(diagLSP.source === 'foam-lsp', 'Diagnostic.toLSP default source');
test(diagLSP.fix === undefined, 'Diagnostic.toLSP strips fix (code-action metadata)');
test(diagLSP['class'] === undefined, 'Diagnostic.toLSP strips FOAM class marker');

// === POM GRAMMAR CONTEXT ===


// === RAW COLOR MESSAGE + REPLACEMENT LOGIC ===
section('Raw color diagnostic — message + code-action replacement');

var diagHandler2 = foam.parse.lsp.handlers.DiagnosticsHandler.create({
  index: index,
  cssTokenResolver: cssTokenResolver
});

// Pick a ColorToken whose resolved value is a hex (so we can construct a
// source file that uses exactly that color and expect a matching-token msg).
var ctNames = cssTokenResolver.getAllTokenNames();
var hitToken = null, hitHex = null;
for ( var i = 0 ; i < ctNames.length ; i++ ) {
  var info = cssTokenResolver.getTokenInfo(ctNames[i]);
  if ( ! info || info.type !== 'ColorToken' ) continue;
  var v = cssTokenResolver.resolveTokenValue(ctNames[i]);
  if ( v && /^#[0-9a-fA-F]{6}$/.test(v) ) { hitToken = ctNames[i]; hitHex = v; break; }
}

if ( hitToken ) {
  var hitSrc = "foam.CLASS({\n  package: 'test',\n  name: 'HitColor',\n" +
               "  css: `\n    ^ { color: " + hitHex + "; }\n  `\n})";
  var hitDiags = diagHandler2.handle(hitSrc);
  var withMatch = hitDiags.filter(function(d) {
    return /raw color/i.test(d.message) && d.message.indexOf(hitHex) !== -1;
  });
  test(withMatch.length === 1, 'Raw color with matching token: diagnostic present');
  test(withMatch[0].message.indexOf("'$" + hitToken + "'") !== -1,
    'Matching token name appears in diagnostic message (not generic $primary400)');
}

// Raw color with NO matching token — different phrasing, no false recommendation
var missSrc = "foam.CLASS({\n  package: 'test',\n  name: 'MissColor',\n" +
              "  css: `\n    ^ { color: #deadbe; }\n  `\n})";
var missDiags = diagHandler2.handle(missSrc);
var missing = missDiags.filter(function(d) { return /raw color/i.test(d.message); });
test(missing.length === 1, 'Raw color without matching token: diagnostic present');
test(missing[0].message.indexOf('no matching') !== -1,
  'No-match message explicitly states there is no matching token');
test(missing[0].message.indexOf('$primary400') === -1,
  'No-match message does NOT include a misleading example token');

// === HOVER ON ^selector IN CSS BLOCK ===

// NOTE: declarative property/action `label:` strings are intentionally NOT flagged.
// They are auto-extracted + translated by foam/i18n/scripts.jrl (keyed by the
// property/action name, with the authored string as the default), so they are
// already i18n-ready. Only imperative render text (.add('...'), below) is invisible
// to that extraction and needs an explicit messages: entry.

// === i18n in-body .add() WARNING tests (Step 2) ===
section('DiagnosticsHandler i18n add() strings');

function addStrDiags(src) {
  return diagHandler.handle(src).filter(function(d) {
    return d.code === 'i18n-hardcoded-display-string';
  });
}

// .add('prose') in a method → one WARNING (severity 2)
var addProse = "foam.CLASS({\n  package:'test', name:'AP',\n  methods:[ function render(){ this.add('Upload Complete'); } ]\n})";
var apd = addStrDiags(addProse);
test(apd.length === 1, 'Hardcoded .add() string flagged once');
test(apd.length === 1 && apd[0].severity === 2, '.add() string diagnostic is WARNING severity (2)');

// .add(dynamic expression) → zero
var addDyn = "foam.CLASS({\n  package:'test', name:'AD',\n  methods:[ function render(){ this.add(this.data.name); } ]\n})";
test(addStrDiags(addDyn).length === 0, '.add(dynamic expression) not flagged');

// .addClass('container') → zero (not .add()
var addClass = "foam.CLASS({\n  package:'test', name:'AC',\n  methods:[ function render(){ this.addClass('container'); } ]\n})";
test(addStrDiags(addClass).length === 0, '.addClass() not flagged');

// .start('span').add('Hello World') → one (only the .add text; .start tag ignored)
var chained = "foam.CLASS({\n  package:'test', name:'CH',\n  methods:[ function render(){ this.start('span').add('Hello World').end(); } ]\n})";
test(addStrDiags(chained).length === 1, "chained .start('span').add('Hello World') flags only the add() text");

// template literal with interpolation → zero (dynamic)
var interp = "foam.CLASS({\n  package:'test', name:'IN',\n  methods:[ function render(){ this.add(`Total ${this.n}`); } ]\n})";
test(addStrDiags(interp).length === 0, '.add(`...${}...`) interpolated not flagged');

// all-caps code → zero
var addCode = "foam.CLASS({\n  package:'test', name:'ACd',\n  methods:[ function render(){ this.add('OK'); } ]\n})";
test(addStrDiags(addCode).length === 0, ".add('OK') all-caps not flagged");

// Real offender file: SmartUploadView has many in-body .add('...') strings
var supPath = 'src/com/paytic/flow/fileupload/SmartUploadView.js';
if ( fs.existsSync(supPath) ) {
  var supText = fs.readFileSync(supPath, 'utf8');
  var supDiags = diagHandler.handle(supText).filter(function(d) {
    return d.code === 'i18n-hardcoded-display-string';
  });
  test(supDiags.length >= 3, 'SmartUploadView.js produces multiple i18n-hardcoded-display-string WARNINGs');
} else {
  test(true, 'SmartUploadView.js not present — real-file smoke skipped');
}

// === issue #5135: literals inside conditional/concatenated .add() args ===
section('DiagnosticsHandler i18n add() conditional args (issue #5135)');

// Single-line ternary — both arms flagged
var ternSrc = "foam.CLASS({\n  package:'test', name:'TN',\n  methods:[ function render(items){\n" +
  "    this.add(items.length === 0 ? 'No matching items found.' : 'Refundable items found (' + items.length + ')');\n" +
  "  } ]\n})";
var ternDiags = addStrDiags(ternSrc);
test(ternDiags.length === 2, '#5135: both ternary arm literals flagged (got ' + ternDiags.length + ')');
test(ternDiags.some(function(d){ return d.message.indexOf('No matching items found.') !== -1; }) &&
     ternDiags.some(function(d){ return d.message.indexOf('Refundable items found (') !== -1; }),
  '#5135: diagnostics name both arm strings');

// Multi-line ternary — same result
var ternMultiSrc = "foam.CLASS({\n  package:'test', name:'TM',\n  methods:[ function render(items){\n" +
  "    this.add(items.length === 0\n" +
  "      ? 'No matching items found.'\n" +
  "      : 'Refundable items found (' + items.length + ')');\n" +
  "  } ]\n})";
test(addStrDiags(ternMultiSrc).length === 2, '#5135: multi-line ternary arms flagged');

// Concatenation — prose pieces flagged
var concatSrc = "foam.CLASS({\n  package:'test', name:'CC',\n  methods:[ function render(n){\n" +
  "    this.add('Found ' + n + ' items');\n  } ]\n})";
test(addStrDiags(concatSrc).length === 2, '#5135: both prose pieces of a concatenation flagged');

// Literals in NESTED calls/objects stay exempt — .create({label}) and .translate()
var nestedSrc = "foam.CLASS({\n  package:'test', name:'NS',\n  methods:[ function render(){\n" +
  "    this.add(this.Foo.create({ label: 'Nested Label Text' }));\n" +
  "    this.add(this.translate('some.key', 'Default Prose Text'));\n  } ]\n})";
test(addStrDiags(nestedSrc).length === 0, '#5135: literals nested in create()/translate() args NOT flagged');

// Interpolated template arm stays exempt; plain arm still flagged
var ternInterpSrc = "foam.CLASS({\n  package:'test', name:'TI',\n  methods:[ function render(n){\n" +
  "    this.add(n === 0 ? 'Nothing here' : `Total ${n}`);\n  } ]\n})";
var tiDiags = addStrDiags(ternInterpSrc);
test(tiDiags.length === 1 && tiDiags[0].message.indexOf('Nothing here') !== -1,
  '#5135: interpolated arm skipped, plain arm flagged');

// i18n-ignore still works per line inside a multi-line ternary
var ternIgnoreSrc = "foam.CLASS({\n  package:'test', name:'TG',\n  methods:[ function render(items){\n" +
  "    this.add(items.length === 0\n" +
  "      ? 'No matching items found.' // i18n-ignore\n" +
  "      : 'Refundable items found');\n  } ]\n})";
var tgDiags = addStrDiags(ternIgnoreSrc);
test(tgDiags.length === 1 && tgDiags[0].message.indexOf('Refundable items found') !== -1,
  '#5135: per-line i18n-ignore suppresses only its own arm');

// === Step 3: noise control ===
section('DiagnosticsHandler i18n noise control');

function anyI18nDiags(src, uri) {
  return diagHandler.handle(src, uri).filter(function(d) {
    return d.code === 'i18n-hardcoded-display-string';
  });
}

// CSS-ish values passed to .add() → not flagged (allowlist)
var cssUnit = "foam.CLASS({\n  package:'test', name:'CU',\n  methods:[ function render(){ this.add('10px'); this.add('100%'); this.add('#fff'); } ]\n})";
test(anyI18nDiags(cssUnit).length === 0, 'CSS units / hex values not flagged');

// Inline // i18n-ignore on the same line suppresses
var ignored = "foam.CLASS({\n  package:'test', name:'IG',\n  methods:[ function render(){ this.add('Real Text'); // i18n-ignore\n } ]\n})";
test(anyI18nDiags(ignored).length === 0, 'Inline // i18n-ignore suppresses the diagnostic');

// Same string WITHOUT the comment is still flagged (control)
var notIgnored = "foam.CLASS({\n  package:'test', name:'NIG',\n  methods:[ function render(){ this.add('Real Text'); } ]\n})";
test(anyI18nDiags(notIgnored).length === 1, 'Without i18n-ignore the string is still flagged');

// Test/demo files are exempt (by uri)
var exSrc = "foam.CLASS({\n  package:'test', name:'EX',\n  methods:[ function render(){ this.add('First Name'); } ]\n})";
test(anyI18nDiags(exSrc, 'file:///app/src/foo/FooTest.js').length === 0, 'Test file (uri) is exempt');
test(anyI18nDiags(exSrc, 'file:///app/src/foo/demos/Foo.js').length === 0, 'Demos file (uri) is exempt');
test(anyI18nDiags(exSrc, 'file:///app/src/foo/demo/Foo.js').length === 0,
  'Singular demo/ dir is exempt too (was a gap: demos matched, demo did not)');
test(anyI18nDiags(exSrc, 'file:///app/src/foo/Foo.js').length === 1, 'Non-test file still flagged (control)');

// === Step 5: WorkspaceAnalyzer groups i18n diagnostics by code ===
section('WorkspaceAnalyzer i18n grouping');
var wsa = foam.parse.lsp.handlers.WorkspaceAnalyzer.create({ index: index });
var p1 = wsa.patternFor({ code: 'i18n-hardcoded-display-string', message: 'Hardcoded display string "Upload Complete" — define it as a messages: entry.' });
var p2 = wsa.patternFor({ code: 'i18n-hardcoded-display-string', message: 'Hardcoded display string "Processing..." — define it as a messages: entry.' });
test(p1 === p2, 'Two different hardcoded strings collapse to one pattern (grouped by code)');
test(p1 === 'i18n-hardcoded-display-string', 'i18n pattern key is the diagnostic code');
var pu = wsa.patternFor({ message: "Unknown class in requires: 'foam.core.auth.User'" });
test(pu.indexOf('*') !== -1, 'Non-coded diagnostics still grouped by generalizeMessage (wildcarded)');

// === Regression: re-find must anchor to .add(, not match a same-text messages entry ===
section('DiagnosticsHandler i18n re-find precision');

// A messages entry and an .add() call share the exact same text. The WARNING must
// point at the .add( occurrence, NOT the (correct) messages entry above it — which
// is the case once "extract to messages" has already run on an identical string.
var dupSrc = "foam.CLASS({\n  package:'t', name:'DUP',\n" +
  "  messages:[ { name:'FORGOT_PASSWORD', message:'Forgot password?' } ],\n" +
  "  methods:[ function render(){ this.add('Forgot password?'); } ]\n})";
var dd = diagHandler.handle(dupSrc).filter(function(d){ return d.code === 'i18n-hardcoded-display-string'; });
test(dd.length === 1, 're-find: exactly one WARNING when text duplicates a messages entry');
var dOff = dd.length === 1 ? analyzer.positionToOffset(dupSrc, dd[0].range.start) : -1;
var addInner = dupSrc.indexOf("this.add('Forgot password?')") + "this.add('".length;
test(dOff === addInner, 're-find: WARNING lands on the .add() argument, not the messages entry');

// === Comments + multi-class scoping (review P2/P3) ===
section('DiagnosticsHandler i18n comments + multi-class');

// P2: commented-out .add() must NOT be flagged (line comment)
var lineCommented = "foam.CLASS({\n  package:'t', name:'CM',\n  methods:[ function render(){\n    // this.add('Commented Out Text');\n    this.add('Live Text');\n  } ]\n})";
var cmd = addStrDiags(lineCommented);
test(cmd.length === 1, 'P2: line-commented .add() not flagged; live one is');
test(cmd.length === 1 && cmd[0].message.indexOf('Live Text') !== -1, 'P2: only the live .add() string is flagged');

// P2: block-commented .add() must NOT be flagged
var blockCommented = "foam.CLASS({\n  package:'t', name:'BC',\n  methods:[ function render(){ /* this.add('Block Comment Text'); */ this.add('Real One'); } ]\n})";
var bcd = addStrDiags(blockCommented);
test(bcd.length === 1 && bcd[0].message.indexOf('Real One') !== -1, 'P2: block-commented .add() not flagged');

// P2: // inside a string is NOT treated as a comment
var urlish = "foam.CLASS({\n  package:'t', name:'URL',\n  methods:[ function render(){ this.add('Visit Our Site'); } ]\n})";
test(addStrDiags(urlish).length === 1, 'P2: control — non-commented .add() still flagged');

// P3: earlier class's i18n-ignore must NOT suppress a later class's identical string
var multiIgnore = "foam.CLASS({ package:'t', name:'A', methods:[ function render(){ this.add('Shared Phrase'); // i18n-ignore\n } ] })\n" +
  "foam.CLASS({ package:'t', name:'B', methods:[ function render(){ this.add('Shared Phrase'); } ] })";
var mid = addStrDiags(multiIgnore);
test(mid.length === 1, 'P3: ignored earlier occurrence does not suppress the later one');
test(mid.length === 1 && analyzer.positionToOffset(multiIgnore, mid[0].range.start) > multiIgnore.indexOf("name:'B'"), 'P3: surviving WARNING is the later (class B) occurrence');

// P3: same string in two classes (neither ignored) → flagged in BOTH, at distinct offsets
var multiBoth = "foam.CLASS({ package:'t', name:'A', methods:[ function render(){ this.add('Save Now'); } ] })\n" +
  "foam.CLASS({ package:'t', name:'B', methods:[ function render(){ this.add('Save Now'); } ] })";
var mbd = addStrDiags(multiBoth);
test(mbd.length === 2, 'P3: same string in two classes flagged in both');
test(mbd.length === 2 && analyzer.positionToOffset(multiBoth, mbd[0].range.start) !== analyzer.positionToOffset(multiBoth, mbd[1].range.start), 'P3: the two WARNINGs are at distinct offsets');

// === Non-UI .add() must not be flagged (collection adds + Java blocks) ===
section('DiagnosticsHandler i18n non-UI adds');

// JS collection/permission add with a dotted key → not display text
var permSrc = "foam.CLASS({\n  package:'t', name:'Perm',\n  methods:[ function init(){ this.permSet.add('superuser.enable'); } ]\n})";
test(addStrDiags(permSrc).length === 0, 'dotted key add(superuser.enable) not flagged');

// .add(...) inside a javaCode string block → not real JS render text
var javaSrc = "foam.CLASS({\n  package:'t', name:'JavaUser',\n  methods:[ { name:'foo', javaCode: 'list.add(\"Metric Type\");' } ]\n})";
test(addStrDiags(javaSrc).length === 0, '.add() inside a javaCode string not flagged');

// .add(...) inside a backtick template (e.g. embedded code) → not flagged
var tmplSrc = "foam.CLASS({\n  package:'t', name:'Tmpl',\n  properties:[ { name:'doc', value: `set.add('Some Backtick Text');` } ]\n})";
test(addStrDiags(tmplSrc).length === 0, '.add() inside a backtick string not flagged');

// Controls: real u2 display text still flagged, incl. ellipsis (dots but no identifier)
test(addStrDiags("foam.CLASS({ package:'t', name:'U2a', methods:[ function render(){ this.add('Upload Complete'); } ] })").length === 1, 'control: real .add() display string still flagged');
test(addStrDiags("foam.CLASS({ package:'t', name:'U2b', methods:[ function render(){ this.add('Processing...'); } ] })").length === 1, "control: ellipsis 'Processing...' still flagged");

// === Step 4: extract-to-message code action edit ===
section('DiagnosticsHandler i18n extract edit');

// New messages array path
var noMsgSrc = "foam.CLASS({\n  package:'test', name:'EX1',\n  methods:[ function render(){ this.add('Upload Complete'); } ]\n})";
var e1 = i18nHandler.buildAddExtractEdit(noMsgSrc, 'Upload Complete', 'file:///x.js');
test(!! e1, 'buildAddExtractEdit returns an edit for a single-class file');
var edits1 = e1 && e1.changes['file:///x.js'];
test(!!edits1 && edits1.length === 2, 'edit has two text edits (insert message + rewrite usage)');
test(!!edits1 && edits1.some(function(t){ return t.newText === 'this.UPLOAD_COMPLETE_MSG'; }), 'usage rewritten to this.UPLOAD_COMPLETE_MSG');
test(!!edits1 && edits1.some(function(t){ return t.newText.indexOf("name: 'UPLOAD_COMPLETE_MSG'") !== -1 && t.newText.indexOf("message: 'Upload Complete'") !== -1; }), 'inserts a messages entry with _MSG-suffixed name + original text');
test(!!edits1 && edits1.some(function(t){ return t.newText.indexOf('messages: [') !== -1; }), 'creates a new messages: array when none exists');

// Existing messages array path — entry inserted, no new messages: key
var withMsgSrc = "foam.CLASS({\n  package:'test', name:'EX2',\n  messages:[ { name:'FOO', message:'Foo' } ],\n  methods:[ function render(){ this.add('Upload Complete'); } ]\n})";
var e2 = i18nHandler.buildAddExtractEdit(withMsgSrc, 'Upload Complete', 'file:///y.js');
var edits2 = e2 && e2.changes['file:///y.js'];
test(!!edits2 && edits2.length === 2, 'existing-array path also produces two edits');
test(!!edits2 && edits2.every(function(t){ return t.newText.indexOf('messages:') === -1; }), 'does not inject a second messages: key when one exists');

// Multi-class file → null (avoid inserting into the wrong class)
var multiSrc = "foam.CLASS({ package:'test', name:'A' })\nfoam.CLASS({ package:'test', name:'B', methods:[ function render(){ this.add('Upload Complete'); } ] })";
test(i18nHandler.buildAddExtractEdit(multiSrc, 'Upload Complete', 'file:///z.js') === null, 'multi-class file returns null (no autofix)');

// Nested/inner class → ambiguous insertion scope → null (no autofix)
var nestedClassesSrc = "foam.CLASS({\n  package:'t', name:'Outer',\n  classes:[ { name:'Inner', messages:[ { name:'X', message:'x' } ], properties:[ { name:'y' } ] } ],\n  methods:[ function render(){ this.add('Outer Text'); } ]\n})";
test(i18nHandler.buildAddExtractEdit(nestedClassesSrc, 'Outer Text', 'file:///n.js') === null, 'inner classes: present → ambiguous → no autofix');
var twoPropSrc = "foam.CLASS({\n  package:'t', name:'TwoProp',\n  properties:[ { name:'a' } ],\n  sections:[ { name:'s' } ],\n  methods:[ function render(){ this.add('Some Text'); var v = { properties:[ {name:'b'} ] }; } ]\n})";
test(i18nHandler.buildAddExtractEdit(twoPropSrc, 'Some Text', 'file:///2p.js') === null, 'multiple properties: blocks → ambiguous → no autofix');

// Insertion placement: messages lands right before properties:, after header keys
function msgInsertOffset(edit, uri, src) {
  var t = edit.changes[uri].filter(function(e){ return e.newText.indexOf("name: 'UPLOAD_COMPLETE_MSG'") !== -1; })[0];
  return analyzer.positionToOffset(src, t.range.start);
}
var srcHP = "foam.CLASS({\n  package:'p',\n  name:'HP',\n  requires:['a.B'],\n  properties:[ { name:'x' } ],\n  methods:[ function render(){ this.add('Upload Complete'); } ]\n})";
var eHP = i18nHandler.buildAddExtractEdit(srcHP, 'Upload Complete', 'file:///hp.js');
var offHP = msgInsertOffset(eHP, 'file:///hp.js', srcHP);
test(offHP > srcHP.indexOf("requires:"), 'new messages inserted AFTER header keys (requires)');
test(offHP <= srcHP.indexOf('properties:'), 'new messages inserted right BEFORE properties:');

// No properties: inserted after the last header key, before methods
var srcNP = "foam.CLASS({\n  package:'p',\n  name:'NP',\n  requires:['a.B'],\n  methods:[ function render(){ this.add('Upload Complete'); } ]\n})";
var eNP = i18nHandler.buildAddExtractEdit(srcNP, 'Upload Complete', 'file:///np.js');
var offNP = msgInsertOffset(eNP, 'file:///np.js', srcNP);
test(offNP > srcNP.indexOf("requires:['a.B']") , 'no-properties: messages inserted after requires array');
test(offNP < srcNP.indexOf('methods:'), 'no-properties: messages inserted before methods:');

// P3: extract must edit the occurrence at the diagnostic range, not the first match
var twiceSrc = "foam.CLASS({\n  package:'t', name:'TWICE',\n  methods:[ function render(){ this.add('Repeat Me'); this.add('Repeat Me'); } ]\n})";
var firstIdx2 = twiceSrc.indexOf("this.add('Repeat Me')");
var secondIdx2 = twiceSrc.indexOf("this.add('Repeat Me')", firstIdx2 + 1);
var secondInner = secondIdx2 + "this.add('".length;
var secondRange = {
  start: analyzer.offsetToPosition(twiceSrc, secondInner),
  end:   analyzer.offsetToPosition(twiceSrc, secondInner + 'Repeat Me'.length)
};
var eTwice = i18nHandler.buildAddExtractEdit(twiceSrc, 'Repeat Me', 'file:///tw.js', secondRange);
var rwTwice = eTwice && eTwice.changes['file:///tw.js'].filter(function(t){ return t.newText === 'this.REPEAT_ME_MSG'; })[0];
var rwOff = rwTwice ? analyzer.positionToOffset(twiceSrc, rwTwice.range.start) : -1;
test(rwOff === secondInner - 1, 'P3: extract rewrites the occurrence at the diagnostic range (the 2nd), not the 1st');

// === _MSG suffix + axiom-collision uniqueness ===
section('DiagnosticsHandler i18n message-name uniqueness');

// A 'fileName' property installs a FILE_NAME constant; extracting the label
// 'File Name' must NOT reuse FILE_NAME — the _MSG suffix keeps them apart.
var collideSrc = "foam.CLASS({\n  package:'t', name:'TextSaveView',\n  properties:[ { name:'fileName' } ],\n  methods:[ function render(){ this.add('File Name'); } ]\n})";
var eCollide = i18nHandler.buildAddExtractEdit(collideSrc, 'File Name', 'file:///c.js');
var editsC = eCollide && eCollide.changes['file:///c.js'];
test(!!editsC && editsC.some(function(t){ return t.newText === 'this.FILE_NAME_MSG'; }), 'property constant FILE_NAME does not block the _MSG name; usage -> this.FILE_NAME_MSG');
test(!!editsC && editsC.every(function(t){ return t.newText.indexOf("name: 'FILE_NAME'") === -1 || t.newText.indexOf("name: 'FILE_NAME_MSG'") !== -1; }), 'extracted message is named FILE_NAME_MSG, not FILE_NAME');

// An existing FOO_MSG message forces a numeric suffix on a second 'Foo'.
var dupMsgSrc = "foam.CLASS({\n  package:'t', name:'DUP',\n  messages:[ { name:'FOO_MSG', message:'x' } ],\n  methods:[ function render(){ this.add('Foo'); } ]\n})";
var eDup = i18nHandler.buildAddExtractEdit(dupMsgSrc, 'Foo', 'file:///d.js');
var editsD = eDup && eDup.changes['file:///d.js'];
test(!!editsD && editsD.some(function(t){ return t.newText === 'this.FOO_MSG2'; }), 'taken FOO_MSG -> numeric suffix FOO_MSG2');

// === P2: WorkspaceAnalyzer threads the file URI (test/demo exemption) ===
section('WorkspaceAnalyzer i18n URI exemption');
var os = require('os');
var tmpExempt = path.join(os.tmpdir(), 'WidgetTest.js');
var tmpReal   = path.join(os.tmpdir(), 'Widget.js');
fs.writeFileSync(tmpExempt, "foam.CLASS({ package:'t', name:'WidgetTest', methods:[ function render(){ this.add('Should Be Exempt'); } ] })");
fs.writeFileSync(tmpReal,   "foam.CLASS({ package:'t', name:'Widget', methods:[ function render(){ this.add('Should Be Flagged'); } ] })");
function i18nOf(arr){ return (arr || []).filter(function(d){ return d.code === 'i18n-hardcoded-display-string'; }); }
test(i18nOf(wsa.analyzeSingleFile(tmpExempt)).length === 0, 'P2: analyzeSingleFile exempts *Test.js by URI');
test(i18nOf(wsa.analyzeSingleFile(tmpReal)).length === 1, 'P2: analyzeSingleFile flags a non-exempt file (control)');
test(i18nOf(wsa.analyzeFiles([tmpExempt]).fileResults['file://' + tmpExempt]).length === 0, 'P2: analyzeFiles exempts *Test.js by URI');
fs.unlinkSync(tmpExempt);
fs.unlinkSync(tmpReal);

// === Review round 4: insertion scope, escaping, string-literal scanning ===
section('DiagnosticsHandler i18n extract edit — robustness');

// F1: no properties:, but a method body has a line-start `name:` object literal.
// The messages: block must NOT be inserted inside the method/object.
var bodyObjSrc = "foam.CLASS({\n  package:'p',\n  name:'BodyObj',\n  methods:[\n    function render(){\n      var cfg = {\n        name: 'inner'\n      };\n      this.add('Body Object Text');\n    }\n  ]\n})";
var eBO = i18nHandler.buildAddExtractEdit(bodyObjSrc, 'Body Object Text', 'file:///bo.js');
var msgEditBO = eBO && eBO.changes['file:///bo.js'].filter(function(t){ return t.newText.indexOf("name: 'BODY_OBJECT_TEXT_MSG'") !== -1; })[0];
var insBO = msgEditBO ? analyzer.positionToOffset(bodyObjSrc, msgEditBO.range.start) : -1;
test(insBO !== -1 && insBO < bodyObjSrc.indexOf('methods:'), 'F1: messages inserted before methods:, not inside the body object');

// F2: an escaped apostrophe must produce a valid message: literal (no double-escaping).
var aposSrc = "foam.CLASS({\n  package:'p', name:'Apos',\n  methods:[ function render(){ this.add('Don\\'t save'); } ]\n})";
var eA = i18nHandler.buildAddExtractEdit(aposSrc, "Don\\'t save", 'file:///a.js');
var msgEditA = eA && eA.changes['file:///a.js'].filter(function(t){ return t.newText.indexOf("name: 'DON_T_SAVE_MSG'") !== -1; })[0];
test(!!msgEditA, 'F2: message entry generated for a string with an escaped apostrophe');
test(!!msgEditA && msgEditA.newText.indexOf("message: 'Don\\'t save'") !== -1, 'F2: message: literal preserves the original valid escaping');
test(!!msgEditA && msgEditA.newText.indexOf("Don\\\\'t") === -1, 'F2: no double-backslash escaping');

// F3 (already fixed last round): .add() inside a string literal must not be flagged.
var docStrSrc = "foam.CLASS({\n  package:'p', name:'Doc',\n  properties:[ { name:'x', documentation: \"see this.add('Upload Complete') in render\" } ],\n  methods:[ function render(){} ]\n})";
test(addStrDiags(docStrSrc).length === 0, 'F3: .add() inside a documentation string literal is not flagged');

// === Review round 5: single-word collection adds + double-quote literals ===
section('DiagnosticsHandler i18n round 5');

// P2: a Set/collection .add() (receiver paired with new Set + .delete) is not display text
var collSrc = "foam.CLASS({\n  package:'t', name:'Coll',\n  methods:[ { name:'ps', code: function(){ const set = new Set(); set.add('scheduled'); set.delete('scheduled'); } } ]\n})";
test(addStrDiags(collSrc).length === 0, "collection set.add('scheduled') (new Set + delete) not flagged");
// control: a capitalized single word is display text → still flagged
test(addStrDiags("foam.CLASS({ package:'t', name:'C2', methods:[ function render(){ this.add('Welcome'); } ] })").length === 1, 'control: capitalized single word still flagged');
// control: a multi-word lowercase phrase is still display text → flagged
test(addStrDiags("foam.CLASS({ package:'t', name:'C3', methods:[ function render(){ this.add('please wait'); } ] })").length === 1, 'control: multi-word lowercase phrase still flagged');

// Medium: a display string containing double quotes must extract without corruption.
var dqSrc = "foam.CLASS({\n  package:'t', name:'DQ',\n  methods:[ function render(){ this.add('Say \"Hi\"'); } ]\n})";
var dqDiags = diagHandler.handle(dqSrc).filter(function(d){ return d.code === 'i18n-hardcoded-display-string'; });
test(dqDiags.length === 1, 'double-quote-containing display string flagged once');
// Simulate the server passing a message-truncated text ('Say ') BUT the real diag range.
var eDQ = dqDiags.length === 1 ? i18nHandler.buildAddExtractEdit(dqSrc, 'Say ', 'file:///dq.js', dqDiags[0].range) : null;
var rwDQ = eDQ && eDQ.changes['file:///dq.js'].filter(function(t){ return t.newText.indexOf('this.') === 0; })[0];
var rwStr = rwDQ ? dqSrc.substring(analyzer.positionToOffset(dqSrc, rwDQ.range.start), analyzer.positionToOffset(dqSrc, rwDQ.range.end)) : '';
test(rwStr === "'Say \"Hi\"'", 'Medium: rewrite span covers the full literal incl. embedded double quotes');
var msgDQ = eDQ && eDQ.changes['file:///dq.js'].filter(function(t){ return t.newText.indexOf('message:') !== -1; })[0];
test(!!msgDQ && msgDQ.newText.indexOf("message: 'Say \"Hi\"'") !== -1, 'Medium: message entry uses the full source literal');

// === Review round 6: lowercase display copy must NOT be suppressed ===
section('DiagnosticsHandler i18n round 6');

// Real cases: chained .add() of lowercase UI copy (from:, to:, type) — must be flagged.
var lcChain = "foam.CLASS({\n  package:'t', name:'LC',\n  methods:[ function render(){ return this.E().start('strong').add('from:').end().start('td').add('type').end(); } ]\n})";
test(addStrDiags(lcChain).length === 2, "lowercase chained display copy ('from:', 'type') is flagged");

// Lowercase display on this.add (view receiver) — still flagged.
test(addStrDiags("foam.CLASS({ package:'t', name:'LC2', methods:[ function render(){ this.add('please'); } ] })").length === 1, "lowercase display on this.add('please') flagged");

// Lowercase add on an element var receiver (not a collection) — flagged.
test(addStrDiags("foam.CLASS({ package:'t', name:'LC3', methods:[ function render(){ var row = this.E(); row.add('total'); } ] })").length === 1, "lowercase .add('total') on an element var flagged");

section('Diagnostics — instantiation enum / primitive values (F3)');
var badSrc = "foam.CLASS({\n  requires: ['foam.core.app.Health'],\n  methods: [ function f() {\n" +
  "    this.Health.create({ status: 'BOGUS', port: 'abc', appName: 'ok' });\n  } ]\n})";
var badMsgs = diagHandler.handle(badSrc, '').map(function(d) { return d.message || ''; });
function has(arr, sub) { return arr.some(function(m) { return m.indexOf(sub) !== -1; }); }
test(has(badMsgs, "not a valid foam.core.app.HealthStatus"), 'bad enum value is flagged');
test(has(badMsgs, "expects a numeric"), 'string assigned to Int port is flagged');

var okSrc = "foam.CLASS({\n  requires: ['foam.core.app.Health'],\n  methods: [ function f() {\n" +
  "    this.Health.create({ status: 'UP', appName: 'svc' });\n  } ]\n})";
var okMsgs = diagHandler.handle(okSrc, '').map(function(d) { return d.message || ''; });
test(! has(okMsgs, 'HealthStatus'), 'valid enum value is not flagged');

var exprSrc = "foam.CLASS({\n  requires: ['foam.core.app.Health'],\n  methods: [ function f() {\n" +
  "    this.Health.create({ status: this.x, port: someVar });\n  } ]\n})";
var exprMsgs = diagHandler.handle(exprSrc, '').map(function(d) { return d.message || ''; });
test(! has(exprMsgs, 'HealthStatus') && ! has(exprMsgs, 'numeric'),
  'expression values are not flagged (literals only)');

// === i18n detection mechanics — characterization for the .add() finder ===
// These lock the CURRENT (regex) finding behavior so a future grammar-based
// rewrite (Approach A) that swaps the finder must reproduce it exactly. They
// pin the mechanics the existing semantic tests don't: range precision, the
// whitespace contract, look-alike method names, nested-body descent, quote
// flavors. Any drift here fails loudly.
section('DiagnosticsHandler i18n detection mechanics');

// 1. Range precision — the diagnostic range covers the inner content only,
//    bounded by (not including) the quote characters.
var rpSrc = "foam.CLASS({ package:'t', name:'RP', methods:[ function render(){ this.add('Upload Complete'); } ] })";
var rp = diagHandler.handle(rpSrc).filter(function(d){ return d.code === 'i18n-hardcoded-display-string'; });
test(rp.length === 1, 'range: exactly one diagnostic');
var rpS = rp.length === 1 ? analyzer.positionToOffset(rpSrc, rp[0].range.start) : -1;
var rpE = rp.length === 1 ? analyzer.positionToOffset(rpSrc, rp[0].range.end)   : -1;
test(rpS !== -1 && rpSrc.substring(rpS, rpE) === 'Upload Complete', 'range: spans the inner content exactly (no quotes)');
test(rpS !== -1 && rpSrc[rpS - 1] === "'" && rpSrc[rpE] === "'", 'range: bounded by the surrounding quote chars');

// 2. Whitespace contract. Spaces/newlines AFTER the ( are tolerated; a space
//    BETWEEN .add and ( is NOT matched (the scanner requires a contiguous '.add(').
test(addStrDiags("foam.CLASS({ package:'t', name:'WS1', methods:[ function render(){ this.add( 'Spaced Out' ); } ] })").length === 1, "whitespace: .add( 'x' ) with inner spaces flagged");
test(addStrDiags("foam.CLASS({ package:'t', name:'WS2', methods:[ function render(){ this.add(\n        'Newline Arg'); } ] })").length === 1, 'whitespace: .add( newline + string ) flagged');
test(addStrDiags("foam.CLASS({ package:'t', name:'WS3', methods:[ function render(){ this.add ('Not Matched'); } ] })").length === 0, 'whitespace: a space between .add and ( is NOT flagged (contiguous .add( required)');

// 3. Look-alike method names must NOT match — only an exact .add( call counts.
test(addStrDiags("foam.CLASS({ package:'t', name:'AA', methods:[ function render(){ this.addAll('Some Items'); } ] })").length === 0, "look-alike: .addAll('Some Items') not flagged");
test(addStrDiags("foam.CLASS({ package:'t', name:'RA', methods:[ function render(){ this.readd('Re Add'); } ] })").length === 0, "look-alike: .readd('Re Add') not flagged");

// 4. Nested-body descent — an .add() inside a callback within render is found.
test(addStrDiags("foam.CLASS({ package:'t', name:'NCB', methods:[ function render(){ this.data.sub(function(){ this.add('Deep Text'); }); } ] })").length === 1, 'nested: .add() inside a callback within render is flagged');

// 5. Double-quoted argument flavor flagged (parity with single-quoted).
test(addStrDiags("foam.CLASS({ package:'t', name:'DQ2', methods:[ function render(){ this.add(\"Hello World\"); } ] })").length === 1, 'double-quoted: this.add("Hello World") flagged once');

// 6. Escaped-quote argument flagged exactly once (detection, not just extract).
test(addStrDiags("foam.CLASS({ package:'t', name:'AP2', methods:[ function render(){ this.add('Don\\'t save'); } ] })").length === 1, "escaped quote: this.add('Don\\'t save') flagged once");



// === tableColumns accepts actions (#5169) ===
// foam.u2.table.UnstyledTableView renders actions listed in tableColumns as
// row buttons, so an action name there is valid. searchColumns filters on
// properties only, so an action name there is still flagged.
section('DiagnosticsHandler tableColumns actions (#5169)');

var colActSrc = "foam.CLASS({\n" +
  "  package: 'test',\n" +
  "  name: 'ColActDemo',\n" +
  "  tableColumns: [ 'name', 'reflow', 'bogusCol' ],\n" +
  "  searchColumns: [ 'name', 'reflow' ],\n" +
  "  properties: [ { class: 'String', name: 'name' } ],\n" +
  "  actions: [ { name: 'reflow', code: function() {} } ]\n" +
  "})";
var colActDiags = diagHandler.handle(colActSrc);
test(!colActDiags.some(function(d) { return d.message.indexOf("action 'reflow'") !== -1; }),
  'tableColumns: own action name NOT flagged');
test(colActDiags.some(function(d) { return d.message.indexOf("Property or action 'bogusCol'") !== -1; }),
  'tableColumns: unknown name still flagged (mentions actions)');
test(colActDiags.some(function(d) { return d.message.indexOf("Property 'reflow'") !== -1; }),
  'searchColumns: action name IS flagged (properties only)');
test(!colActDiags.some(function(d) { return d.message.indexOf("'name'") !== -1; }),
  'both arrays: property name not flagged');
