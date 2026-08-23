/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// CodeLensHandler: missing-translations lens (codeLens.i18n) and
// class-hierarchy lens (codeLens.hierarchy). Handler-level only — the "both
// flags off omits the capability" case borrows config.js's existing server
// lane instead of adding a second boot here.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache;

var FeatureConfig = require('../../lsp/FeatureConfig');

// Real, top-level foam.CLASS() registrations (this file is a plain Node
// module, not a sandboxed fixture eval, so these actually register in the
// shared runtime the harness booted) — gives the hierarchy lens tests a
// KNOWN subclass count to assert on, instead of a real-but-unpinned class
// like foam.u2.View whose count only proves the code against itself.
foam.CLASS({ package: 'test.codelens.hier', name: 'HierBase' });
foam.CLASS({ package: 'test.codelens.hier', name: 'HierSubA', extends: 'test.codelens.hier.HierBase' });
foam.CLASS({ package: 'test.codelens.hier', name: 'HierSubB', extends: 'test.codelens.hier.HierBase' });

function config(overrides) {
  return FeatureConfig.load({ initOptions: { features: overrides || {} } });
}

function i18nHandlerFor(langs) {
  return foam.parse.lsp.handlers.I18nHandler.create({
    index: index, cache: cache,
    targetLanguages: langs, translationReady: true, activeModel: 'stub-model'
  });
}

var uri = 'file:///t/CodeLensMsgs.js';

section('CodeLensHandler — i18n lens: single missing language');

// Same MSGS fixture shape as i18n.js:98 — one messages: entry with no
// messageMap at all, so it's missing every target language.
var MSGS_ONE = [
  "foam.CLASS({",
  "  package: 'test.codelens',",
  "  name: 'HasMsgs',",
  "  messages: [",
  "    { name: 'DONE', message: 'Done' }",
  "  ]",
  "});",
  ""
].join('\n');

var lensHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  i18nHandler: i18nHandlerFor(['fr']),
  featureConfig: config()   // real defaults: codeLens.i18n on, codeLens.hierarchy off
});
var lenses = lensHandler.handle(MSGS_ONE, uri);
test(lenses.length === 1, 'one lens for one entry missing one language');
test(!! lenses[0] && lenses[0].command.title === '1 translation missing', 'singular title');
test(!! lenses[0] && lenses[0].command.command === 'foam.i18n.translateMessage',
  'command id matches the executeCommand lane');
test(!! lenses[0] && JSON.stringify(lenses[0].command.arguments) ===
  JSON.stringify([{ uri: uri, messageName: 'DONE', languages: ['fr'] }]),
  'command arguments match the shape I18nHandler.executeCommand accepts');
// Line 4 (0-based) of MSGS_ONE is `    { name: 'DONE', message: 'Done' }` —
// the entry inside the messages: block whose name literal anchors the range.
test(!! lenses[0] && lenses[0].range.start.line === 4,
  'range anchored at the entry\'s line inside messages: (exact line)');

section('CodeLensHandler — i18n lens: pluralization');

var lensHandler2 = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  i18nHandler: i18nHandlerFor(['fr', 'es']),
  featureConfig: config()
});
var lenses2 = lensHandler2.handle(MSGS_ONE, uri);
test(lenses2.length === 1, 'still one lens — one entry, two missing languages');
test(!! lenses2[0] && lenses2[0].command.title === '2 translations missing', 'plural title');
test(!! lenses2[0] && JSON.stringify(lenses2[0].command.arguments[0].languages) ===
  JSON.stringify(['fr', 'es']), 'both missing languages carried in the command');

section('CodeLensHandler — i18n lens: provider not ready → no lenses');

var notReadyHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  i18nHandler: foam.parse.lsp.handlers.I18nHandler.create({
    index: index, cache: cache, targetLanguages: ['fr'] }),   // translationReady false
  featureConfig: config()
});
test(notReadyHandler.handle(MSGS_ONE, uri).length === 0,
  'translationReady false -> no i18n lens');

section('CodeLensHandler — hierarchy lens: off by default');

// package/name match REAL classes registered at the top of this file
// (test.codelens.hier.HierBase + two subclasses) — getSubclasses reads the
// live registry by classId, not this fixture's (empty) body.
var HIER_SRC = [
  "foam.CLASS({",
  "  package: 'test.codelens.hier',",
  "  name: 'HierBase'",
  "});",
  ""
].join('\n');
var hierUri = 'file:///t/HierBase.js';

var offHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  i18nHandler: i18nHandlerFor(['fr']),
  featureConfig: config({ 'codeLens.i18n': false })   // isolate: hierarchy left at its false default
});
test(offHandler.handle(HIER_SRC, hierUri).length === 0,
  'codeLens.hierarchy left at its default (false) -> no hierarchy lens even for a class with real subclasses');

section('CodeLensHandler — hierarchy lens: on -> "N subclasses" from a controlled fixture');

var onHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  i18nHandler: i18nHandlerFor(['fr']),
  featureConfig: config({ 'codeLens.i18n': false, 'codeLens.hierarchy': true })
});
var hierLenses = onHandler.handle(HIER_SRC, hierUri);
test(hierLenses.length === 1, 'one hierarchy lens for the single class');
test(!! hierLenses[0] && hierLenses[0].command.title === '2 subclasses',
  'title is the literal, known subclass count (HierSubA + HierSubB) — no reference count');
test(!! hierLenses[0] && hierLenses[0].command.command === '',
  'hierarchy lens is informational by design — empty command, no navigation yet');
// HIER_SRC's single foam.CLASS() call is the first (and only) call in the
// text, so FileModelCache.findCallLine always resolves it to line 0 — see
// FileModelCache.js:315 ("For single-class files sourceLine_ is always 0").
test(!! hierLenses[0] && hierLenses[0].range.start.line === 0 && hierLenses[0].range.end.line === 0,
  'range anchored at the class\'s own foam.CLASS() line (exact line, model.sourceLine_)');

section('CodeLensHandler — hierarchy lens: pluralization (zero subclasses)');

var singleSubHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  featureConfig: config({ 'codeLens.hierarchy': true })
});
var SUB_A_SRC = [
  "foam.CLASS({",
  "  package: 'test.codelens.hier',",
  "  name: 'HierSubA'",
  "});",
  ""
].join('\n');
var singleSubLenses = singleSubHandler.handle(SUB_A_SRC, 'file:///t/HierSubA.js');
test(!! singleSubLenses[0] && singleSubLenses[0].command.title === '0 subclasses',
  'a leaf class (no subclasses of its own) reads "0 subclasses", not "0 subclass"');

section('CodeLensHandler — multi-model file → no lenses');

var TWO_MODEL = MSGS_ONE + MSGS_ONE;
var bothOnHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  i18nHandler: i18nHandlerFor(['fr']),
  featureConfig: config({ 'codeLens.hierarchy': true })
});
test(bothOnHandler.handle(TWO_MODEL, uri).length === 0,
  'multi-model file suppresses both lens types (models.length > 1 guard)');

section('CodeLensHandler — multi-model guard is independent of i18nHandler');

// No i18nHandler wired at all (undefined) — only the hierarchy lens is even
// requested — proves the guard reads the file shape itself (cache.getModels)
// rather than delegating to i18nHandler.isMultiModelFile_, which would have
// silently let an ambiguous file through with no i18nHandler to ask.
var noI18nHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  featureConfig: config({ 'codeLens.hierarchy': true })
});
test(noI18nHandler.i18nHandler == null, 'control: this handler has no i18nHandler wired');
test(noI18nHandler.handle(TWO_MODEL, uri).length === 0,
  'i18nHandler null + hierarchy on + two-class file -> no lenses (guard does not depend on i18nHandler)');

module.exports = {};
