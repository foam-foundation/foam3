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

// === LSP #4993 Fix 3: user-defined cssTokens not flagged as unknown ===


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

