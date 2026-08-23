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

// package/name deliberately match the REAL foam.u2.View class already
// loaded by this test run's pmake boot — getSubclasses/referencesForClassId
// read the live registry by classId, not this fixture's (empty) body, so
// the resolved classId must be a class the registry actually knows about.
var HIER_SRC = [
  "foam.CLASS({",
  "  package: 'foam.u2',",
  "  name: 'View'",
  "});",
  ""
].join('\n');
var hierUri = 'file:///t/View.js';

var offHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache,
  i18nHandler: i18nHandlerFor(['fr']),
  featureConfig: config({ 'codeLens.i18n': false })   // isolate: hierarchy left at its false default
});
test(offHandler.handle(HIER_SRC, hierUri).length === 0,
  'codeLens.hierarchy left at its default (false) -> no hierarchy lens even for a class with real subclasses');

section('CodeLensHandler — hierarchy lens: on -> N subclasses · M refs from real index counts');

var referencesHandler = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });
var onHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache, referencesHandler: referencesHandler,
  i18nHandler: i18nHandlerFor(['fr']),
  featureConfig: config({ 'codeLens.i18n': false, 'codeLens.hierarchy': true })
});
var hierLenses = onHandler.handle(HIER_SRC, hierUri);
test(hierLenses.length === 1, 'one hierarchy lens for the single class');

var expectedSubs = index.getSubclasses('foam.u2.View').length;
var expectedRefs = referencesHandler.referencesForClassId('foam.u2.View').length;
var expectedTitle = expectedSubs + ' subclass' + (expectedSubs === 1 ? '' : 'es') +
  ' · ' + expectedRefs + ' ref' + (expectedRefs === 1 ? '' : 's');
test(!! hierLenses[0] && hierLenses[0].command.title === expectedTitle,
  'title matches real index counts for foam.u2.View (' + expectedTitle + ')');
test(expectedSubs > 0, 'control: foam.u2.View actually has subclasses in the live index');

section('CodeLensHandler — multi-model file → no lenses');

var TWO_MODEL = MSGS_ONE + MSGS_ONE;
var bothOnHandler = foam.parse.lsp.handlers.CodeLensHandler.create({
  index: index, cache: cache, referencesHandler: referencesHandler,
  i18nHandler: i18nHandlerFor(['fr']),
  featureConfig: config({ 'codeLens.hierarchy': true })
});
test(bothOnHandler.handle(TWO_MODEL, uri).length === 0,
  'multi-model file suppresses both lens types (isMultiModelFile_ guard)');

module.exports = {};
