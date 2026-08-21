/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Split from the spec: i18n extract variants, missing-language scan,
// translation providers, and command edit-building.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache;

section('I18nHandler — extract (moved from DiagnosticsHandler)');
var i18n = foam.parse.lsp.handlers.I18nHandler.create({ index: index, cache: cache });

var SRC = "foam.CLASS({\n  package: 'test',\n  name: 'ExtractMe',\n" +
  "  methods: [\n    function render() {\n      this.add('Upload complete');\n    }\n  ]\n});\n";

var edit = i18n.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/ExtractMe.js');
test(!! edit, 'extract returns an edit for a single-model file');
var edits = edit && edit.changes['file:///t/ExtractMe.js'];
test(edits && edits.length === 2, 'extract has usage rewrite + messages insertion');
test(edits && edits.some(function(e) { return e.newText === 'this.UPLOAD_COMPLETE_MSG'; }),
  'usage rewritten to this.UPLOAD_COMPLETE_MSG');
test(edits && edits.some(function(e) { return /messages: \[/.test(e.newText); }),
  'new messages: block inserted');

// Ambiguity bail-outs survive the move
test(i18n.buildAddExtractEdit(SRC + SRC, 'Upload complete', 'file:///t/Two.js') === null,
  'two foam.CLASS blocks → null (no autofix)');

section('I18nHandler — extract variant B (withMessageMap)');
var editB = i18n.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/E.js', null,
  { withMessageMap: true });
var editsB = editB && editB.changes['file:///t/E.js'];
var insB = editsB && editsB.filter(function(e) { return /messages/.test(e.newText); })[0];
test(insB && /messageMap: \{ en: 'Upload complete' \}/.test(insB.newText),
  'variant B entry carries messageMap: { en: ... }');

var editC = i18n.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/E.js', null,
  { translations: { fr: 'Téléversement terminé' } });
var insC = editC.changes['file:///t/E.js'].filter(function(e) { return /messages/.test(e.newText); })[0];
test(insC && /en: 'Upload complete'/.test(insC.newText) && /fr: 'Téléversement terminé'/.test(insC.newText),
  'translations option produces en + fr keys');

// Translation containing a single quote must be escaped, not break the entry
var editQ = i18n.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/E.js', null,
  { translations: { fr: "l'envoi terminé" } });
var insQ = editQ.changes['file:///t/E.js'].filter(function(e) { return /messages/.test(e.newText); })[0];
test(insQ && insQ.newText.indexOf("l\\'envoi termin") !== -1,
  'quote inside translation is escaped');

section('I18nHandler — scanMissingLanguages');
var i18nT = foam.parse.lsp.handlers.I18nHandler.create({
  index: index, cache: cache,
  targetLanguages: ['fr'], translationReady: true, activeModel: 'translategemma:4b'
});
var MSGS = "foam.CLASS({\n  package: 'test',\n  name: 'HasMsgs',\n  messages: [\n" +
  "    { name: 'DONE', message: 'Done' },\n" +
  "    { name: 'SAVED', message: 'Saved', messageMap: { en: 'Saved', fr: 'Enregistré' } },\n" +
  "    { name: 'PART', message: 'Part', messageMap: { en: 'Part' } }\n  ]\n});\n";
var scan = i18nT.scanMissingLanguages('file:///t/HasMsgs.js', MSGS);
test(scan.length === 2, 'flags DONE (no map) and PART (map missing fr), not SAVED');
test(scan.every(function(s) { return s.missing.length === 1 && s.missing[0] === 'fr'; }),
  'missing list is [fr]');
test(typeof scan[0].range.start.line === 'number', 'scan results carry a position range');

var i18nOff = foam.parse.lsp.handlers.I18nHandler.create({
  index: index, cache: cache, targetLanguages: ['fr'] });   // translationReady false
test(i18nOff.scanMissingLanguages('file:///t/HasMsgs.js', MSGS).length === 0,
  'no provider → no scan results (gating)');

section('I18nHandler — buildMessageMapEdit');
var mmEdit = i18nT.buildMessageMapEdit(MSGS, 'DONE', { fr: 'Terminé' }, 'file:///t/HasMsgs.js');
test(!! mmEdit, 'edit produced for entry without map');
var mmNew = mmEdit.changes['file:///t/HasMsgs.js'][0].newText;
test(/messageMap: \{ en: 'Done', fr: 'Terminé' \}/.test(mmNew),
  'inserted map seeds en from message and adds fr');

var mmEdit2 = i18nT.buildMessageMapEdit(MSGS, 'PART', { fr: 'Partie' }, 'file:///t/HasMsgs.js');
test(mmEdit2 && /, fr: 'Partie'/.test(mmEdit2.changes['file:///t/HasMsgs.js'][0].newText),
  'existing map gets fr appended');

test(i18nT.buildMessageMapEdit(MSGS + MSGS, 'DONE', { fr: 'x' }, 'file:///t/D.js') === null,
  'ambiguous file → null');

section('CodeActionHandler — action D (translate missing-language HINT)');
var caH = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, i18nHandler: i18nT });
var missDiagFr = {
  range:    { start: { line: 3, character: 12 }, end: { line: 3, character: 18 } },
  severity: 4,
  code:     'i18n-missing-language',
  message:  'Message "DONE" has no fr translation in its messageMap.'
};
var actsFr = caH.handle(MSGS, missDiagFr.range, { diagnostics: [missDiagFr] }, 'file:///t/HasMsgs.js');
test(actsFr.length === 1, 'single missing language → one translate action');
test(actsFr[0].title === "Translate 'DONE' to fr via translategemma:4b",
  'action title names the message, language, and active model');
test(actsFr[0].command && actsFr[0].command.command === 'foam.i18n.translateMessage',
  'action carries the translate command');
test(actsFr[0].command.arguments[0].messageName === 'DONE' &&
  actsFr[0].command.arguments[0].languages.length === 1 && actsFr[0].command.arguments[0].languages[0] === 'fr',
  'command payload carries messageName + languages');

var missDiagMulti = {
  range:    { start: { line: 3, character: 12 }, end: { line: 3, character: 18 } },
  severity: 4,
  code:     'i18n-missing-language',
  message:  'Message "DONE" has no fr, de translation in its messageMap.'
};
var actsMulti = caH.handle(MSGS, missDiagMulti.range, { diagnostics: [missDiagMulti] }, 'file:///t/HasMsgs.js');
test(actsMulti.length === 3, 'two missing languages → one action per language + one "all" action');
test(actsMulti[2].title === "Translate 'DONE' to all missing languages via translategemma:4b",
  '"all" action names every missing language via the active model');
test(actsMulti[2].command.arguments[0].languages.length === 2 &&
  actsMulti[2].command.arguments[0].languages[0] === 'fr' && actsMulti[2].command.arguments[0].languages[1] === 'de',
  '"all" action command carries every missing language');

var caOff = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, i18nHandler: i18nOff });
var actsOff = caOff.handle(MSGS, missDiagFr.range, { diagnostics: [missDiagFr] }, 'file:///t/HasMsgs.js');
test(actsOff.length === 0, 'translationReady false → zero translate actions');

section('DiagnosticsHandler — i18n-missing-language HINT emission');
var diagH = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index, cache: cache, i18nHandler: i18nT });
var missDiags = diagH.handle(MSGS, 'file:///t/HasMsgs.js').filter(function(d) {
  return d.code === 'i18n-missing-language';
});
test(missDiags.length === 2, 'DONE + PART flagged via the wired i18nHandler');
test(missDiags.every(function(d) { return d.severity === 4; }), 'severity is HINT (4)');
test(missDiags.some(function(d) { return d.message === 'Message "DONE" has no fr translation in its messageMap.'; }),
  'message names the message and the missing language');

var diagHNoI18n = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index, cache: cache });
var noMissDiags = diagHNoI18n.handle(MSGS, 'file:///t/HasMsgs.js').filter(function(d) {
  return d.code === 'i18n-missing-language';
});
test(noMissDiags.length === 0, 'no i18nHandler wired → no HINT diagnostics (null-safe)');
