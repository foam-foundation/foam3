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

section('I18nHandler — buildMessageMapEdit adversarial fixtures (depth/brace machinery)');

// (a) brace inside a message value, name AFTER message — this exact ordering
// is what the old backward-walk-from-name implementation got wrong: walking
// backward from 'GREET' hits the '{' inside "Hi {name}" before the entry's
// real opening '{'. The forward-from-array-start scan can't make that mistake.
var GREET_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'Greet',\n  messages: [\n" +
  "    { message: 'Hi {name}', name: 'GREET' }\n  ]\n});\n";
var mmGreet = i18nT.buildMessageMapEdit(GREET_SRC, 'GREET', { fr: 'Bonjour {nom}' }, 'file:///t/Greet.js');
test(!! mmGreet, 'brace-in-message-value + name-after-message: entry still located correctly');
var greetNew = mmGreet.changes['file:///t/Greet.js'][0].newText;
test(/messageMap: \{ en: 'Hi \{name\}', fr: 'Bonjour \{nom\}' \}/.test(greetNew),
  'seeded en literal keeps its brace verbatim');

// (b) brace inside a translation value, appended to an already-existing map
var mmBraceAppend = i18nT.buildMessageMapEdit(MSGS, 'PART', { fr: 'Une part {x}' }, 'file:///t/HasMsgs.js');
test(mmBraceAppend && /, fr: 'Une part \{x\}'/.test(mmBraceAppend.changes['file:///t/HasMsgs.js'][0].newText),
  'brace inside an appended translation value is kept verbatim; entry boundaries stay intact');

// (c) apostrophe in a translation — exercises escapeJsString_ through THIS
// path (buildAddExtractEdit's apostrophe test above covers a different path)
var mmApos = i18nT.buildMessageMapEdit(MSGS, 'DONE', { fr: "c'est fini" }, 'file:///t/HasMsgs.js');
test(mmApos && mmApos.changes['file:///t/HasMsgs.js'][0].newText.indexOf("c\\'est fini") !== -1,
  'apostrophe in a buildMessageMapEdit translation is escaped');

// (d) double-quoted message: "..." literal — quote style is preserved verbatim
var DQ_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'DQ',\n  messages: [\n" +
  "    { name: 'HELLO', message: \"Hello there\" }\n  ]\n});\n";
var mmDQ = i18nT.buildMessageMapEdit(DQ_SRC, 'HELLO', { fr: 'Bonjour' }, 'file:///t/DQ.js');
test(mmDQ && /messageMap: \{ en: "Hello there", fr: 'Bonjour' \}/.test(mmDQ.changes['file:///t/DQ.js'][0].newText),
  'double-quoted message: literal is reused verbatim for the seeded source key');

// (e) two languages requested in one call
var mmTwoLang = i18nT.buildMessageMapEdit(MSGS, 'DONE', { fr: 'Terminé', de: 'Fertig' }, 'file:///t/HasMsgs.js');
var twoLangNew = mmTwoLang && mmTwoLang.changes['file:///t/HasMsgs.js'][0].newText;
test(twoLangNew && /fr: 'Terminé'/.test(twoLangNew) && /de: 'Fertig'/.test(twoLangNew),
  'two languages requested in one call both land in the seeded map');

// (f) unbalanced brace inside a message value — must never corrupt the span
var UNBAL_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'Unbal',\n  messages: [\n" +
  "    { name: 'BAD', message: 'a { b' }\n  ]\n});\n";
var mmUnbal = i18nT.buildMessageMapEdit(UNBAL_SRC, 'BAD', { fr: 'x' }, 'file:///t/Unbal.js');
test(mmUnbal && /messageMap: \{ en: 'a \{ b', fr: 'x' \}/.test(mmUnbal.changes['file:///t/Unbal.js'][0].newText),
  'unbalanced brace inside a string value never corrupts entry-span detection — string content is skipped whole');

section('I18nHandler — buildMessageMapEdit reconciles against already-present keys');

// existing-map branch: language already present is skipped, not duplicated
test(i18nT.buildMessageMapEdit(MSGS, 'SAVED', { fr: 'Nouveau texte' }, 'file:///t/HasMsgs.js') === null,
  'existing-map branch: requested language already present → nothing to add → null (no no-op edit)');

var mmMixed = i18nT.buildMessageMapEdit(MSGS, 'SAVED', { fr: 'Nouveau', de: 'Neu' }, 'file:///t/HasMsgs.js');
var mixedNew = mmMixed && mmMixed.changes['file:///t/HasMsgs.js'][0].newText;
test(mixedNew && /de: 'Neu'/.test(mixedNew) && mixedNew.indexOf('Nouveau') === -1,
  'existing-map branch appends only the language not already present, ignoring the duplicate fr request');

// no-map branch: a translations.<sourceLanguage> entry never duplicates the seed
var mmSeedDup = i18nT.buildMessageMapEdit(MSGS, 'DONE', { en: 'Something else', fr: 'Terminé' }, 'file:///t/HasMsgs.js');
var seedDupNew = mmSeedDup.changes['file:///t/HasMsgs.js'][0].newText;
test(/messageMap: \{ en: 'Done', fr: 'Terminé' \}/.test(seedDupNew) && seedDupNew.indexOf('Something else') === -1,
  'no-map branch: a translations.en entry never duplicates/overrides the message-literal seed');

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

section('Integration — real DiagnosticsHandler HINT feeds real CodeActionHandler action D');
// Every other action-D test above hand-writes a fake diagnostic object that
// COPIES DiagnosticsHandler's message format. This test instead runs the
// real emitter and feeds its real output into the real consumer, proving
// the message ↔ regex contract holds end-to-end (not just against a
// hand-maintained copy of the format on each side).
var diagHReal = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index, cache: cache, i18nHandler: i18nT });
var realMissDiags = diagHReal.handle(MSGS, 'file:///t/HasMsgs.js').filter(function(d) {
  return d.code === 'i18n-missing-language';
});
test(realMissDiags.length === 2, 'real DiagnosticsHandler emits one HINT per missing-language entry');
var realDoneDiag = realMissDiags.filter(function(d) { return d.message.indexOf('"DONE"') !== -1; })[0];
test(!! realDoneDiag, 'a real DONE HINT is present among the emitted diagnostics');

var caReal = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, i18nHandler: i18nT });
var realActs = caReal.handle(MSGS, realDoneDiag.range, { diagnostics: [realDoneDiag] }, 'file:///t/HasMsgs.js');
test(realActs.length === 1, 'a real end-to-end HINT produces exactly one translate action (single missing language)');
test(realActs[0].command && realActs[0].command.command === 'foam.i18n.translateMessage' &&
  realActs[0].command.arguments[0].messageName === 'DONE' &&
  realActs[0].command.arguments[0].languages.length === 1 && realActs[0].command.arguments[0].languages[0] === 'fr',
  'the real end-to-end action carries the correct command payload');

section('I18nHandler — language derivation from locale journals');
var jrlLoader = foam.parse.lsp.JrlLoader.create();
var os = require('os'), fsMod = require('fs'), pathMod = require('path');
var tmpJrl = pathMod.join(os.tmpdir(), 'lsp-i18n-test-locales.jrl');
fsMod.writeFileSync(tmpJrl,
  'p({class:"foam.i18n.Locale",locale:"fr",source:"a.B.X",target:"y"})\n' +
  'p({class:"foam.i18n.Locale",locale:"fr",source:"a.B.Y",target:"z"})\n' +
  'p({class:"foam.i18n.Locale",locale:"en",variant:"US",source:"a.B.Z",target:"w"})\n' +
  'p({class:"foam.i18n.Locale",locale:"es",source:"a.B.W",target:"v"})\n');
var langs = i18nT.deriveLanguagesFromJournals(jrlLoader, [tmpJrl]);
test(langs.length === 2 && langs[0] === 'es' && langs[1] === 'fr',
  'derives distinct non-source locales sorted (es, fr), en/variant excluded');
fsMod.unlinkSync(tmpJrl);
