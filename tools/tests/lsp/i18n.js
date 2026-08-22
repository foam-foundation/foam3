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

// Variant A (no options) must stay the plain { name, message } shape — the
// messageMap belongs to variant B/C only.
test(edits && edits.every(function(e) { return e.newText.indexOf('messageMap') === -1; }),
  'variant A entry carries no messageMap');

// A backslash in a model translation ('C:\chemin') must be DOUBLED, or the
// emitted literal reads as an escape sequence in the generated source.
var editBS = i18n.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/E.js', null,
  { translations: { fr: 'C:\\chemin' } });
var insBS = editBS.changes['file:///t/E.js'].filter(function(e) { return /messages/.test(e.newText); })[0];
test(insBS && insBS.newText.indexOf("fr: 'C:\\\\chemin'") !== -1,
  'backslash inside a translation is doubled');

// A carriage return needs escaping for the same reason a newline does — a raw
// CR inside a single-quoted literal is a syntax error.
var editCR = i18n.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/E.js', null,
  { translations: { fr: 'a\r\nb' } });
var insCR = editCR.changes['file:///t/E.js'].filter(function(e) { return /messages/.test(e.newText); })[0];
test(insCR && insCR.newText.indexOf("fr: 'a\\r\\nb'") !== -1,
  'carriage return inside a translation is escaped');

// A regional code ('fr-CA') is not a valid JS identifier — it must be emitted
// as a quoted key or the generated messageMap does not parse.
var editRegion = i18n.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/E.js', null,
  { translations: { 'fr-CA': 'Téléversement terminé' } });
var insRegion = editRegion.changes['file:///t/E.js'].filter(function(e) { return /messages/.test(e.newText); })[0];
test(insRegion && insRegion.newText.indexOf("'fr-CA': 'Téléversement terminé'") !== -1,
  'variant C/B key for a regional code is quoted');

// The seeded key follows sourceLanguage, not a literal 'en' — otherwise a
// French-source workspace seeds a wrong `en` key AND drops the real English
// translation as a duplicate of the seed.
var i18nFrSrc = foam.parse.lsp.handlers.I18nHandler.create({ index: index, cache: cache, sourceLanguage: 'fr' });
var editFrSrc = i18nFrSrc.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/E.js', null,
  { translations: { en: 'Upload done', fr: 'ignored — fr is the seeded source' } });
var insFrSrc = editFrSrc.changes['file:///t/E.js'].filter(function(e) { return /messages/.test(e.newText); })[0];
test(insFrSrc && /messageMap: \{ fr: 'Upload complete', en: 'Upload done' \}/.test(insFrSrc.newText),
  'seeded key follows sourceLanguage; the non-source translation is kept, the source-language one dropped');

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

section('I18nHandler — scanMissingLanguages_ whole-file guard (finding B)');
// Two foam.CLASS blocks / two messages: arrays — findEntrySpan_ and
// buildAddExtractEdit already refuse this shape (ambiguous insertion
// target). Before the fix, scanMissingLanguages_ had no matching guard, so
// it happily surfaced HINTs (editor lane) / dry-run strings (MCP lane) for
// entries the builders would then refuse to write an edit for — a dead end
// either way.
var TWO_MODEL_MSGS = MSGS + MSGS;
test(i18nT.scanMissingLanguages_('file:///t/TwoMsgs.js', TWO_MODEL_MSGS).length === 0,
  'multi-model file: scanMissingLanguages_ returns [] instead of offering dead-end HINTs');
test(i18nT.scanMissingLanguages('file:///t/TwoMsgs.js', TWO_MODEL_MSGS).length === 0,
  'multi-model file: the gated public scanMissingLanguages also returns []');
var diagMultiModel = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index, cache: cache, i18nHandler: i18nT })
  .handle(TWO_MODEL_MSGS, 'file:///t/TwoMsgs.js').filter(function(d) { return d.code === 'i18n-missing-language'; });
test(diagMultiModel.length === 0, 'multi-model file: end-to-end, no i18n-missing-language HINT diagnostics are emitted at all');
// The dry-run MCP lane's guard (dryRunTranslateStrings, via
// resolveTranslateTargets_ -> scanMissingLanguages_ directly, not the gated
// scanMissingLanguages) is exercised in the async 'srvDone' block below,
// alongside the rest of the dryRunTranslateStrings coverage.

section('I18nHandler — scanMissingLanguages_ HINT anchor scoping (finding F)');
// A property sharing a message's name, declared BEFORE the messages: array,
// used to win the unscoped whole-file "first match" search for `name: 'DONE'`
// — misplacing the HINT squiggle on the property instead of the message
// entry. Scoping the search to start at `messages: [` fixes it.
var SHADOW_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'Shadow',\n  properties: [\n" +
  "    { class: 'String', name: 'DONE', value: 'not the message' }\n  ],\n  messages: [\n" +
  "    { name: 'DONE', message: 'Done' }\n  ]\n});\n";
var scanShadow = i18nT.scanMissingLanguages_('file:///t/Shadow.js', SHADOW_SRC);
test(scanShadow.length === 1, 'shadow fixture: exactly one missing-language hit (the DONE message entry)');
var msgsArrOffset   = SHADOW_SRC.indexOf('messages: [');
var expectedNameIdx = SHADOW_SRC.indexOf("name: 'DONE'", msgsArrOffset);
var propNameIdx     = SHADOW_SRC.indexOf("name: 'DONE'");
test(expectedNameIdx > propNameIdx, 'sanity: the fixture\'s decoy property name: comes before the real messages: entry');
var expectedPos = h.analyzer.offsetToPosition(SHADOW_SRC, expectedNameIdx);
test(scanShadow.length === 1 && scanShadow[0].range.start.line === expectedPos.line &&
  scanShadow[0].range.start.character === expectedPos.character,
  'HINT anchor points at the messages: entry\'s own name:, not the earlier decoy property');

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

// no-map branch, symmetric with the existing-map branch above: translations
// holding ONLY the source language leaves nothing to add, so seeding an
// en-only map would be a pointless edit.
test(i18nT.buildMessageMapEdit(MSGS, 'DONE', { en: 'Something else' }, 'file:///t/HasMsgs.js') === null,
  'no-map branch: only-sourceLanguage translations → nothing to add → null (no en-only map edit)');

// Regional codes round-trip: emitted quoted, and recognized as already
// present on the next call so they are never appended twice.
var mmRegion = i18nT.buildMessageMapEdit(MSGS, 'DONE', { 'fr-CA': 'Terminé' }, 'file:///t/HasMsgs.js');
var regionNew = mmRegion && mmRegion.changes['file:///t/HasMsgs.js'][0].newText;
test(regionNew && regionNew.indexOf("'fr-CA': 'Terminé'") !== -1,
  'regional code is emitted as a quoted messageMap key');

var REGION_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'Region',\n  messages: [\n" +
  "    { name: 'HI', message: 'Hi', messageMap: { en: 'Hi', 'fr-CA': 'Salut' } }\n  ]\n});\n";
test(i18nT.buildMessageMapEdit(REGION_SRC, 'HI', { 'fr-CA': 'Allo' }, 'file:///t/Region.js') === null,
  'an already-present quoted key is recognized → no duplicate key appended');

section('I18nHandler — buildMessageMapEdit existing-map edge cases (finding A)');

// Merge a single-edit WorkspaceEdit into its source text via the same
// position->offset math the real client/MCP applier uses, so these tests
// assert against the ACTUAL resulting source, not just the raw newText.
function applyOneEdit_(text, editObj, uri) {
  var e = editObj.changes[uri][0];
  var start = h.analyzer.positionToOffset(text, e.range.start);
  var end   = h.analyzer.positionToOffset(text, e.range.end);
  return text.slice(0, start) + e.newText + text.slice(end);
}

// (a) empty map — `messageMap: {}`. Before the fix this produced
// `{ , fr: 'y' }` (leading comma with nothing before it): a syntax error.
var EMPTY_MAP_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'EmptyMap',\n  messages: [\n" +
  "    { name: 'EMP', message: 'x', messageMap: {} }\n  ]\n});\n";
var mmEmpty = i18nT.buildMessageMapEdit(EMPTY_MAP_SRC, 'EMP', { fr: 'y' }, 'file:///t/EmptyMap.js');
test(!! mmEmpty, 'empty messageMap: {} still produces an edit');
test(mmEmpty && mmEmpty.changes['file:///t/EmptyMap.js'][0].newText === " fr: 'y' ",
  'empty map: inserted text is space-padded on both sides, no leading comma');
var emptyMerged = mmEmpty && applyOneEdit_(EMPTY_MAP_SRC, mmEmpty, 'file:///t/EmptyMap.js');
test(!! emptyMerged && emptyMerged.indexOf("messageMap: { fr: 'y' }") !== -1,
  'empty map: merged source reads exactly messageMap: { fr: \'y\' } — valid JS, {} becomes a single-entry map');
var emptyMMMatch = emptyMerged && /messageMap:\s*(\{[^}]*\})/.exec(emptyMerged);
var emptyMMObj   = emptyMMMatch && new Function('return ' + emptyMMMatch[1])();
test(!! emptyMMObj && emptyMMObj.fr === 'y',
  'empty map: the rewritten messageMap literal is syntactically valid JS (eval-checked), fr present');

// (b) trailing comma — `messageMap: { en: 'x', }`. Before the fix this
// produced `{ en: 'x', , fr: 'y' }` (double comma): also a syntax error.
var TRAIL_COMMA_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'TrailComma',\n  messages: [\n" +
  "    { name: 'TC', message: 'x', messageMap: { en: 'x', } }\n  ]\n});\n";
var mmTrail = i18nT.buildMessageMapEdit(TRAIL_COMMA_SRC, 'TC', { fr: 'y' }, 'file:///t/TrailComma.js');
test(!! mmTrail, 'trailing-comma messageMap still produces an edit');
test(mmTrail && mmTrail.changes['file:///t/TrailComma.js'][0].newText === " fr: 'y'",
  'trailing-comma map: inserted text has a single leading space, no leading comma (the existing comma already separates)');
var trailMerged = mmTrail && applyOneEdit_(TRAIL_COMMA_SRC, mmTrail, 'file:///t/TrailComma.js');
test(!! trailMerged && trailMerged.indexOf("messageMap: { en: 'x', fr: 'y' }") !== -1,
  'trailing-comma map: merged source reads exactly messageMap: { en: \'x\', fr: \'y\' } — no double comma');
var trailMMMatch = trailMerged && /messageMap:\s*(\{[^}]*\})/.exec(trailMerged);
var trailMMObj   = trailMMMatch && new Function('return ' + trailMMMatch[1])();
test(!! trailMMObj && trailMMObj.en === 'x' && trailMMObj.fr === 'y',
  'trailing-comma map: the rewritten messageMap literal is syntactically valid JS (eval-checked), en+fr present');

// (c) regression guard: the ordinary append case (no trailing comma, real
// content already present) must be untouched by the new branching.
var mmNormalStillWorks = i18nT.buildMessageMapEdit(MSGS, 'PART', { fr: 'Partie' }, 'file:///t/HasMsgs.js');
test(mmNormalStillWorks && /, fr: 'Partie'/.test(mmNormalStillWorks.changes['file:///t/HasMsgs.js'][0].newText),
  'ordinary existing-map append (no trailing comma) is unaffected by the edge-case fix');

section('I18nHandler — messageMapKey_ sanitizes quoted-form language codes (finding D)');
test(i18nT.messageMapKey_('fr') === 'fr', 'a plain identifier language code stays bare');
test(i18nT.messageMapKey_('fr-CA') === "'fr-CA'", 'a regional code still quotes normally');
var badKeyErr = null;
try { i18nT.messageMapKey_("fr'); alert(1); //"); } catch (e) { badKeyErr = e; }
test(!! badKeyErr && badKeyErr.message.indexOf("fr'); alert(1); //") !== -1,
  'a language code with characters unsafe inside a quoted key throws, naming the offending code');
var badKeyErr2 = null;
try { i18nT.buildMessageMapEdit(MSGS, 'DONE', { "x\" + evil + \"": 'y' }, 'file:///t/HasMsgs.js'); }
catch (e) { badKeyErr2 = e; }
test(!! badKeyErr2, 'an unsafe language code reaching buildMessageMapEdit through a translations payload throws too');

section('I18nHandler — applyTranslations (placeholder validation)');

// A ${...} sentinel (not the bare {name} FOAM already uses elsewhere in this
// file) — the one PLACEHOLDER_PATTERN (shared with HttpChatProvider) actually
// protects.
var PH_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'Greet2',\n  messages: [\n" +
  "    { name: 'HI_NAME', message: 'Hi ${name}' }\n  ]\n});\n";

var lostErr = null;
try {
  i18nT.applyTranslations(PH_SRC, 'file:///t/Greet2.js', { HI_NAME: { fr: 'Bonjour' } });
} catch (e) { lostErr = e; }
test(lostErr && lostErr.message.indexOf('HI_NAME') !== -1,
  'applyTranslations: translation missing ${name} throws, listing the offending message name');

var okEdit = i18nT.applyTranslations(PH_SRC, 'file:///t/Greet2.js', { HI_NAME: { fr: 'Bonjour ${name}' } });
test(!! okEdit && okEdit.changes['file:///t/Greet2.js'].length === 1,
  'applyTranslations: a translation that preserves the placeholder builds an edit');
var okNew = okEdit.changes['file:///t/Greet2.js'][0].newText;
test(/messageMap: \{ en: 'Hi \$\{name\}', fr: 'Bonjour \$\{name\}' \}/.test(okNew),
  'applyTranslations: edit shape matches buildMessageMapEdit (seeds en, adds fr)');

// Multi-message payload: both entries validate (neither has a placeholder),
// both edits must merge into ONE WorkspaceEdit for the file.
var multiApply = i18nT.applyTranslations(MSGS, 'file:///t/HasMsgs.js',
  { DONE: { fr: 'Terminé' }, PART: { fr: 'Partie' } });
test(multiApply.changes['file:///t/HasMsgs.js'].length === 2,
  'applyTranslations: two validated message names merge into ONE WorkspaceEdit (two edits, one file)');

// A message name that can no longer be located can't be validated, so it is
// treated as an offender too — never silently skipped into a partial apply.
var unknownNameErr = null;
try {
  i18nT.applyTranslations(MSGS, 'file:///t/HasMsgs.js', { NOPE: { fr: 'x' } });
} catch (e) { unknownNameErr = e; }
test(unknownNameErr && unknownNameErr.message.indexOf('NOPE') !== -1,
  'applyTranslations: an unknown message name is an offender (cannot validate placeholders)');

// All-or-nothing: ONE offending name among several rejects the WHOLE call —
// the good entry (DONE) gets no edit either.
var mixedErr = null;
try {
  i18nT.applyTranslations(PH_SRC + "\n" + MSGS, 'file:///t/Mixed.js',
    { HI_NAME: { fr: 'Bonjour' }, DONE: { fr: 'Terminé' } });
} catch (e) { mixedErr = e; }
test(mixedErr && mixedErr.message.indexOf('HI_NAME') !== -1,
  'applyTranslations: all-or-nothing — one offending name rejects the whole payload, listing it');

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

// finding G2: action D's gate was translationReady-only — languages come
// from the diagnostic message text, not targetLanguages, so nothing stopped
// it offering a "translate" action against a hand-built (or stale, editor-
// cached) diagnostic even once targetLanguages had been reconfigured to
// empty. Mirrors variant C's existing targetLanguages gate below.
var i18nDNoLangs = foam.parse.lsp.handlers.I18nHandler.create({
  index: index, cache: cache, translationReady: true, activeModel: 'translategemma:4b' });   // targetLanguages empty
var caDNoLangs = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, i18nHandler: i18nDNoLangs });
var actsDNoLangs = caDNoLangs.handle(MSGS, missDiagFr.range, { diagnostics: [missDiagFr] }, 'file:///t/HasMsgs.js');
test(actsDNoLangs.length === 0,
  'action D: no target languages configured → zero translate actions even with a ready provider');

section('CodeActionHandler — variant C (extract + translate)');
// Drive variant C off a REAL hardcoded-display-string diagnostic so the
// action's range lines up with the literal the same way it does in an editor.
var diagHC = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index, cache: cache, i18nHandler: i18nT });
var hardDiag = diagHC.handle(SRC, 'file:///t/ExtractMe.js').filter(function(d) {
  return d.code === 'i18n-hardcoded-display-string';
})[0];
test(!! hardDiag, 'a real hardcoded-display-string diagnostic is emitted for the fixture');

var caC   = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, i18nHandler: i18nT });
var actsC = caC.handle(SRC, hardDiag.range, { diagnostics: [hardDiag] }, 'file:///t/ExtractMe.js');
var cAct  = actsC.filter(function(a) { return a.command && a.command.command === 'foam.i18n.extractAndTranslate'; })[0];
test(actsC.length === 3, 'hardcoded string offers three actions: A (plain), B (messageMap), C (translate)');
test(cAct && cAct.title === "Extract 'Upload complete' + translate to fr via translategemma:4b",
  'variant C title names the string, the target languages, and the active model');
test(cAct && ! cAct.edit, 'variant C carries no precomputed edit — the command re-anchors at execution time');
var cArgs = cAct && cAct.command.arguments[0];
test(cArgs && cArgs.messageText === 'Upload complete' && cArgs.uri === 'file:///t/ExtractMe.js' &&
  cArgs.languages.length === 1 && cArgs.languages[0] === 'fr' &&
  cArgs.diagnosticRange && typeof cArgs.diagnosticRange.start.line === 'number',
  'variant C command payload carries uri, messageText, languages, and the diagnostic range');

var caCOff   = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, i18nHandler: i18nOff });
var actsCOff = caCOff.handle(SRC, hardDiag.range, { diagnostics: [hardDiag] }, 'file:///t/ExtractMe.js');
test(actsCOff.every(function(a) { return ! a.command; }),
  'translationReady false → variant C is not listed');
test(actsCOff.length === 2, 'variants A and B still list without a translation provider');

// Ambiguity: two models in one file suppress A and B (buildAddExtractEdit
// returns null), so C — which runs the same builder after a network round
// trip — must not be offered either. A listed action that is guaranteed to
// fail once clicked is worse than no action.
var TWO_MODEL_SRC = SRC + SRC;
var ambigDiag = diagHC.handle(TWO_MODEL_SRC, 'file:///t/Two.js').filter(function(d) {
  return d.code === 'i18n-hardcoded-display-string';
})[0];
var actsAmbig = caC.handle(TWO_MODEL_SRC, ambigDiag.range, { diagnostics: [ambigDiag] }, 'file:///t/Two.js');
test(actsAmbig.length === 0,
  'ambiguous file: A/B unbuildable → variant C is not offered either (no dead-end action)');

var i18nNoLangs = foam.parse.lsp.handlers.I18nHandler.create({
  index: index, cache: cache, translationReady: true, activeModel: 'stub' });   // targetLanguages empty
var actsCNoLangs = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, i18nHandler: i18nNoLangs })
  .handle(SRC, hardDiag.range, { diagnostics: [hardDiag] }, 'file:///t/ExtractMe.js');
test(actsCNoLangs.every(function(a) { return ! a.command; }),
  'no target languages → variant C is not listed even with a ready provider');

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
try {
  var langs = i18nT.deriveLanguagesFromJournals(jrlLoader, [tmpJrl]);
  test(langs.length === 2 && langs[0] === 'es' && langs[1] === 'fr',
    'derives distinct non-source locales sorted (es, fr), en/variant excluded');

  // Exclusion must follow the instance's sourceLanguage, not a hardcoded 'en' —
  // i18nT above uses the default ('en'), which can't tell the two apart.
  var frSrc = foam.parse.lsp.handlers.I18nHandler.create({ index: index, cache: cache, sourceLanguage: 'fr' });
  var frLangs = frSrc.deriveLanguagesFromJournals(jrlLoader, [tmpJrl]);
  test(frLangs.length === 2 && frLangs[0] === 'en' && frLangs[1] === 'es',
    'exclusion follows sourceLanguage, not a hardcoded en');
} finally {
  fsMod.unlinkSync(tmpJrl);
}

section('HttpChatProvider — detection + translation (mock server)');
var http = require('http');

// Main mock: lists the exact configured model id. Counts /v1/models hits so
// the positive-cache test (below) can prove a cached detect() makes zero
// new requests.
var modelsRequestCount = 0;
var mock = http.createServer(function(req, res) {
  var body = '';
  req.on('data', function(c) { body += c; });
  req.on('end', function() {
    if ( req.url === '/v1/models' ) {
      modelsRequestCount++;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: [{ id: 'translategemma:4b' }] }));
    } else if ( req.url === '/v1/chat/completions' ) {
      var prompt = JSON.parse(body).messages[0].content;
      // Echo the source text back wrapped, proving placeholder sentinels round-trip.
      var src = prompt.split('\n\n').pop();
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: 'FR<' + src + '>' } }] }));
    } else { res.statusCode = 404; res.end(); }
  });
});

// Tag-suffix mock: lists a TAGGED variant of the configured model
// ('translategemma:4b-q4_0' vs configured 'translategemma:4b') — Ollama
// resolves chat requests by exact id, so detect() must resolve and
// translate() must POST the listed id, not the configured prefix.
var lastChatModel = null;
var tagMock = http.createServer(function(req, res) {
  var body = '';
  req.on('data', function(c) { body += c; });
  req.on('end', function() {
    if ( req.url === '/v1/models' ) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: [{ id: 'translategemma:4b-q4_0' }] }));
    } else if ( req.url === '/v1/chat/completions' ) {
      var reqBody = JSON.parse(body);
      lastChatModel = reqBody.model;
      var src = reqBody.messages[0].content.split('\n\n').pop();
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: 'FR<' + src + '>' } }] }));
    } else { res.statusCode = 404; res.end(); }
  });
});

// Negative-cache mock: does NOT list the configured model on its first
// /v1/models hit (server reachable, model legitimately absent — simulates
// "still starting up"), then lists it from the second hit on. Proves both
// halves of the negative-cache contract: an immediate re-detect() inside
// the TTL window makes no new request, and a re-detect() after the TTL
// re-probes (and this time finds the now-present model).
var negRequestCount = 0;
var negMock = http.createServer(function(req, res) {
  req.on('data', function() {});
  req.on('end', function() {
    if ( req.url === '/v1/models' ) {
      negRequestCount++;
      res.setHeader('content-type', 'application/json');
      var id = negRequestCount === 1 ? 'some-other-model' : 'translategemma:4b';
      res.end(JSON.stringify({ data: [{ id: id }] }));
    } else { res.statusCode = 404; res.end(); }
  });
});

// Provider-death mock: a perfectly healthy server that the test CLOSES mid-way,
// so a later translate() hits a dead endpoint (connection refused) with a
// positive detect() result already cached.
var dieMock = http.createServer(function(req, res) {
  req.on('data', function() {});
  req.on('end', function() {
    res.setHeader('content-type', 'application/json');
    if ( req.url === '/v1/models' ) res.end(JSON.stringify({ data: [{ id: 'translategemma:4b' }] }));
    else                            res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
  });
});

// Model-error mock: server reachable and listing the model, but every
// chat-completions call answers 500. The server is UP — a failure here must
// NOT invalidate the cached positive detection.
var errMock = http.createServer(function(req, res) {
  req.on('data', function() {});
  req.on('end', function() {
    if ( req.url === '/v1/models' ) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: [{ id: 'translategemma:4b' }] }));
    } else { res.statusCode = 500; res.end('model exploded'); }
  });
});

// The harness runs categories synchronously, so this category exports its
// async work as `done` — see testFoamLSP.js, which Promise.all()s every
// category's `done` (undefined for the sync ones) before printing SUMMARY.
// try/finally guarantees every mock server is closed even if an assertion
// throws (it shouldn't — test() records rather than throws — but detect()/
// translate() bugs could), and the outer catch keeps `done` resolving even
// on an unexpected throw so one broken test can't hang the whole suite.
var done = (async function() {
  try {
    await new Promise(function(res) { mock.listen(0, '127.0.0.1', res); });
    await new Promise(function(res) { tagMock.listen(0, '127.0.0.1', res); });
    await new Promise(function(res) { negMock.listen(0, '127.0.0.1', res); });
    var base    = 'http://127.0.0.1:' + mock.address().port;
    var tagBase = 'http://127.0.0.1:' + tagMock.address().port;
    var negBase = 'http://127.0.0.1:' + negMock.address().port;

    var prov = foam.parse.lsp.HttpChatProvider.create({ endpoints: [base], model: 'translategemma:4b' });

    var det = await prov.detect();
    test(det.available === true && det.model === 'translategemma:4b', 'detect finds model via /v1/models');

    var prov404 = foam.parse.lsp.HttpChatProvider.create({ endpoints: ['http://127.0.0.1:1'], model: 'x' });
    var det404 = await prov404.detect();
    test(det404.available === false, 'unreachable endpoint → available:false (no throw)');

    var r = await prov.translate(['Hello ${name}, save?'], 'fr', 'test UI');
    test(r.length === 1 && r[0].translation.indexOf('${name}') !== -1,
      'placeholder ${name} survives the round trip');
    test(r[0].translation.indexOf('FR<') !== -1, 'translation came from the mock model');

    // Endpoint normalization (Important 2): scheme-less host + trailing slash.
    var normProv = foam.parse.lsp.HttpChatProvider.create({
      endpoints: [ base.replace(/^http:\/\//, '') + '/' ], model: 'translategemma:4b'
    });
    var normDet = await normProv.detect();
    test(normDet.available === true,
      'scheme-less endpoint (bare host:port, Ollama\'s own OLLAMA_HOST format) + trailing slash both normalize and detect works');

    // (a) Positive cache: a second detect() after a positive makes zero new requests.
    var countAfterFirst = modelsRequestCount;
    await prov.detect();
    test(modelsRequestCount === countAfterFirst,
      'positive cache: second detect() makes zero new /v1/models requests');

    // (b) Negative cache + TTL re-probe, without a real 60s sleep — the
    // provider's negativeCacheTtlMs is a property just for this.
    var TTL = 200;
    var negProv = foam.parse.lsp.HttpChatProvider.create({
      endpoints: [ negBase ], model: 'translategemma:4b', negativeCacheTtlMs: TTL
    });
    var negDet1 = await negProv.detect();
    test(negDet1.available === false && negRequestCount === 1,
      'negative cache: first detect() probes once, model not yet listed → available:false');
    var negDet2 = await negProv.detect();
    test(negDet2.available === false && negRequestCount === 1,
      'negative cache: re-detect() inside the TTL window makes zero new requests');
    await new Promise(function(res) { setTimeout(res, TTL + 100); });
    var negDet3 = await negProv.detect();
    test(negDet3.available === true && negRequestCount === 2,
      'negative cache: re-detect() after the TTL window re-probes and picks up the now-listed model');

    // (c) Tag-suffix resolution (Important 1): detect() resolves the listed
    // id, and translate() POSTs that resolved id — not the configured prefix.
    var tagProv = foam.parse.lsp.HttpChatProvider.create({ endpoints: [tagBase], model: 'translategemma:4b' });
    var tagDet = await tagProv.detect();
    test(tagDet.available === true && tagDet.model === 'translategemma:4b-q4_0',
      'tag-suffix: detect() resolves the listed tagged id, not the configured prefix');
    await tagProv.translate(['hi'], 'fr', 'test UI');
    test(lastChatModel === 'translategemma:4b-q4_0',
      'tag-suffix: translate() POSTs the resolved tagged id (locks Important 1)');

    // (5) Reconfiguration clears the cache — a stale result from the OLD
    // endpoints/model must not survive a live config change.
    var reconfProv = foam.parse.lsp.HttpChatProvider.create({ endpoints: [base], model: 'translategemma:4b' });
    await reconfProv.detect();
    reconfProv.endpoints = [ 'http://127.0.0.1:1' ];
    var reconfDet = await reconfProv.detect();
    test(reconfDet.available === false,
      'reassigning endpoints clears the cached positive result (no stale availability)');

    // (6) Provider death mid-session. The positive detect() cache has no TTL,
    // so nothing else would ever notice: foam/i18nStatus keeps reporting
    // available, foam_i18n_translate keeps taking the one-call path, and every
    // translate() throws instead of degrading to a needs-translations payload
    // — until the LSP restarts. A network-level fetch rejection now clears it.
    await new Promise(function(res) { dieMock.listen(0, '127.0.0.1', res); });
    var dieBase = 'http://127.0.0.1:' + dieMock.address().port;
    var dieProv = foam.parse.lsp.HttpChatProvider.create({
      endpoints: [ dieBase ], model: 'translategemma:4b', timeoutMs: 2000 });
    var dieDet1 = await dieProv.detect();
    test(dieDet1.available === true, 'provider death: detect() is positive while the server is up');
    if ( dieMock.closeAllConnections ) dieMock.closeAllConnections();
    await new Promise(function(res) { dieMock.close(res); });
    var dieErr = null;
    try { await dieProv.translate(['hi'], 'fr', 'test UI'); } catch (e) { dieErr = e; }
    test(!! dieErr, 'provider death: translate() against the now-dead endpoint rejects');
    test(dieProv.lastResult_ === undefined,
      'provider death: the network-level failure cleared the cached positive detect() result');
    var dieDet2 = await dieProv.detect();
    test(dieDet2.available === false,
      'provider death: the next detect() re-probes for real and reports available:false');

    // (7) The complement: a server that ANSWERS (500 from chat/completions) is
    // still up, so the failure is the model's, not the endpoint's — the cached
    // positive detection must survive, or every model hiccup would cost a
    // pointless re-probe of a server known to be alive.
    await new Promise(function(res) { errMock.listen(0, '127.0.0.1', res); });
    var errProv = foam.parse.lsp.HttpChatProvider.create({
      endpoints: [ 'http://127.0.0.1:' + errMock.address().port ], model: 'translategemma:4b', timeoutMs: 2000 });
    await errProv.detect();
    var errErr = null;
    try { await errProv.translate(['hi'], 'fr', 'test UI'); } catch (e) { errErr = e; }
    test(errErr && /500/.test(errErr.message), 'model error: a non-2xx chat response throws');
    test(errProv.lastResult_ && errProv.lastResult_.available === true,
      'model error: a non-2xx response leaves the cached positive detection intact (the server is up)');
  } catch (e) {
    test(false, 'HttpChatProvider mock-server test threw: ' + e.message);
  } finally {
    mock.close();
    tagMock.close();
    negMock.close();
    if ( dieMock.listening ) dieMock.close();
    if ( errMock.listening ) errMock.close();
  }
})();

// executeCommand is async but needs NO network — it runs against a stub
// provider. It gets its own async block (and its own catch) rather than
// riding along in the mock-server one above: sharing that try means any
// mock-server hiccup collapses into a single generic assertion and silently
// skips every command-contract test after it.
var cmdDone = (async function() {
  try {
    section('I18nHandler — executeCommand');
    var stubProvider = {
      detect: async function() { return { available: true, model: 'stub' }; },
      translate: async function(texts, lang) {
        return texts.map(function(t) { return { input: t, translation: '[' + lang + ']' + t, warnings: [] }; });
      }
    };
    var i18nCmd = foam.parse.lsp.handlers.I18nHandler.create({
      index: index, cache: cache, targetLanguages: ['fr'], translationReady: true, activeModel: 'stub' });
    i18nCmd.provider = stubProvider;

    var r1 = await i18nCmd.executeCommand('foam.i18n.extractAndTranslate',
      { uri: 'file:///t/E.js', text: SRC, messageText: 'Upload complete', languages: ['fr'] });
    var ins1 = r1.edit.changes['file:///t/E.js'].filter(function(e) { return /messages/.test(e.newText); })[0];
    test(/fr: '\[fr\]Upload complete'/.test(ins1.newText), 'extractAndTranslate builds translated messageMap');
    test(r1.warnings.length === 0, 'a clean translation reports no warnings');

    // A literal containing a double quote: the diagnostic message embeds the
    // string in double quotes, so CodeActionHandler's
    // /Hardcoded display string "([^"]+)"/ re-parse TRUNCATES it at the
    // embedded quote ('Say ' for 'Say "Hi" now'). Variants A/B are immune —
    // buildAddExtractEdit re-reads the literal from the diagnostic range —
    // but variant C used to translate the truncated text, pairing a correct
    // `en:` seed with a French translation of half the string.
    var DQ_INNER_SRC = "foam.CLASS({\n  package: 'test',\n  name: 'DqInner',\n" +
      "  methods: [\n    function render() {\n      this.add('Say \"Hi\" now');\n    }\n  ]\n});\n";
    var dqUri  = 'file:///t/DqInner.js';
    var dqDiag = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index, cache: cache, i18nHandler: i18nCmd })
      .handle(DQ_INNER_SRC, dqUri).filter(function(d) { return d.code === 'i18n-hardcoded-display-string'; })[0];
    test(!! dqDiag, 'embedded-quote fixture emits a hardcoded-display-string diagnostic');
    var dqActs = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, i18nHandler: i18nCmd })
      .handle(DQ_INNER_SRC, dqDiag.range, { diagnostics: [dqDiag] }, dqUri);
    var dqAct  = dqActs.filter(function(a) { return a.command && a.command.command === 'foam.i18n.extractAndTranslate'; })[0];
    test(!! dqAct && dqAct.command.arguments[0].messageText === 'Say ',
      'variant C payload carries the TRUNCATED messageText (the diagnostic-message re-parse stops at the embedded quote)');
    var rDq = await i18nCmd.executeCommand('foam.i18n.extractAndTranslate', {
      uri: dqUri, text: DQ_INNER_SRC,
      messageText:     dqAct.command.arguments[0].messageText,
      diagnosticRange: dqAct.command.arguments[0].diagnosticRange,
      languages:       ['fr']
    });
    var insDq = rDq.edit.changes[dqUri].filter(function(e) { return /messages/.test(e.newText); })[0].newText;
    test(insDq.indexOf('fr: \'[fr]Say "Hi" now\'') !== -1,
      'extractAndTranslate translates the FULL literal read back from the range, not the truncated messageText');
    test(insDq.indexOf("fr: '[fr]Say '") === -1,
      'the truncated half-string is never what gets translated');
    test(insDq.indexOf('en: \'Say "Hi" now\'') !== -1,
      'the en: seed still reuses the verbatim source literal (en and fr describe the same string)');

    var r2 = await i18nCmd.executeCommand('foam.i18n.translateMessage',
      { uri: 'file:///t/M.js', text: MSGS, messageName: 'DONE', languages: ['fr'] });
    test(/fr: '\[fr\]Done'/.test(r2.edit.changes['file:///t/M.js'][0].newText),
      'translateMessage translates the entry message text');

    var threw = false;
    try {
      await i18nCmd.executeCommand('foam.i18n.translateMessage',
        { uri: 'file:///t/M.js', text: MSGS, messageName: 'NOPE', languages: ['fr'] });
    } catch (e) { threw = true; }
    test(threw, 'unknown message name → throws (surfaced as showMessage, no edit)');

    // Re-anchoring: the command re-runs the builder against the CURRENT text,
    // so a string that has since been edited away must fail loudly rather
    // than write an edit at the wrong offset.
    var reanchorErr = null;
    try {
      await i18nCmd.executeCommand('foam.i18n.extractAndTranslate',
        { uri: 'file:///t/E.js', text: SRC.replace('Upload complete', 'Something else'),
          messageText: 'Upload complete', languages: ['fr'] });
    } catch (e) { reanchorErr = e; }
    test(reanchorErr && reanchorErr.message ===
      'The string could not be re-located — the file changed since the action was offered.',
      're-anchor failure throws the file-changed error, no edit');

    // All-or-nothing: a provider failure must propagate, never yield a
    // partial edit built from the languages that did succeed.
    var partialProvider = {
      detect: async function() { return { available: true, model: 'stub' }; },
      translate: async function(texts, lang) {
        if ( lang === 'de' ) throw new Error('model exploded');
        return texts.map(function(t) { return { input: t, translation: '[' + lang + ']' + t, warnings: [] }; });
      }
    };
    var i18nFail = foam.parse.lsp.handlers.I18nHandler.create({
      index: index, cache: cache, targetLanguages: ['fr', 'de'], translationReady: true, activeModel: 'stub' });
    i18nFail.provider = partialProvider;
    var failErr = null, failResult = null;
    try {
      failResult = await i18nFail.executeCommand('foam.i18n.translateMessage',
        { uri: 'file:///t/M.js', text: MSGS, messageName: 'DONE', languages: ['fr', 'de'] });
    } catch (e) { failErr = e; }
    test(failErr && failErr.message === 'model exploded' && failResult === null,
      'a translate() rejection propagates — no partial edit from the languages that succeeded');

    // Provider warnings (e.g. a dropped placeholder) reach the caller so the
    // server can surface them alongside the applied edit.
    var warnProvider = {
      detect: async function() { return { available: true, model: 'stub' }; },
      translate: async function(texts, lang) {
        return texts.map(function(t) { return { input: t, translation: 'x', warnings: ['placeholder ${n} lost'] }; });
      }
    };
    var i18nWarn = foam.parse.lsp.handlers.I18nHandler.create({
      index: index, cache: cache, targetLanguages: ['fr'], translationReady: true, activeModel: 'stub' });
    i18nWarn.provider = warnProvider;
    var rw = await i18nWarn.executeCommand('foam.i18n.translateMessage',
      { uri: 'file:///t/M.js', text: MSGS, messageName: 'DONE', languages: ['fr'] });
    test(rw.warnings.length === 1 && rw.warnings[0].indexOf('placeholder ${n} lost') !== -1,
      'provider warnings are returned alongside the edit');

    var unknownErr = null;
    try {
      await i18nCmd.executeCommand('foam.i18n.nope', { uri: 'file:///t/E.js', text: SRC, languages: ['fr'] });
    } catch (e) { unknownErr = e; }
    test(unknownErr && /Unknown command/.test(unknownErr.message), 'an unknown command throws');

    var noProv = foam.parse.lsp.handlers.I18nHandler.create({ index: index, cache: cache });
    var noProvErr = null;
    try {
      await noProv.executeCommand('foam.i18n.translateMessage',
        { uri: 'file:///t/M.js', text: MSGS, messageName: 'DONE', languages: ['fr'] });
    } catch (e) { noProvErr = e; }
    test(noProvErr && /provider/.test(noProvErr.message), 'no provider wired → throws instead of building an edit');
  } catch (e) {
    test(false, 'I18nHandler executeCommand test threw: ' + e.message);
  }
})();

// foam/i18nTranslate's server-side builders (dryRunTranslateStrings,
// translateMessages) — own async block/catch, same reasoning as cmdDone:
// isolate this from the mock-HTTP-server block above so one hiccup there
// can't silently skip every assertion here.
var srvDone = (async function() {
  try {
    section('I18nHandler — dryRunTranslateStrings + translateMessages (foam/i18nTranslate builders)');
    var stubProvider2 = {
      detect: async function() { return { available: true, model: 'stub' }; },
      translate: async function(texts, lang) {
        return texts.map(function(t) { return { input: t, translation: '[' + lang + ']' + t, warnings: [] }; });
      }
    };
    var i18nSrv = foam.parse.lsp.handlers.I18nHandler.create({
      index: index, cache: cache, targetLanguages: ['fr'], translationReady: true, activeModel: 'stub' });
    i18nSrv.provider = stubProvider2;

    // dryRun, messageName omitted: scans ALL missing (DONE, PART; SAVED
    // already has fr) — no translate() call, no provider network activity.
    var dry = await i18nSrv.dryRunTranslateStrings('file:///t/HasMsgs.js', MSGS, undefined, undefined);
    test(dry.strings.DONE === 'Done' && dry.strings.PART === 'Part' && dry.strings.SAVED === undefined,
      'dryRunTranslateStrings: messageName omitted collects every scanMissingLanguages source string');
    test(dry.targetLanguages.length === 1 && dry.targetLanguages[0] === 'fr',
      'dryRunTranslateStrings: falls back to targetLanguages when languages arg is omitted');

    var dryOne = await i18nSrv.dryRunTranslateStrings('file:///t/HasMsgs.js', MSGS, 'DONE', ['de']);
    test(Object.keys(dryOne.strings).length === 1 && dryOne.strings.DONE === 'Done' &&
      dryOne.targetLanguages[0] === 'de',
      'dryRunTranslateStrings: explicit messageName + languages override the scan/targetLanguages defaults');

    // finding B: the multi-model whole-file guard applies to the dry-run MCP
    // lane too (resolveTranslateTargets_ -> scanMissingLanguages_ directly),
    // not just the gated diagnostic-facing scanMissingLanguages.
    var dryMultiModel = await i18nSrv.dryRunTranslateStrings('file:///t/TwoMsgs.js', MSGS + MSGS, undefined, undefined);
    test(Object.keys(dryMultiModel.strings).length === 0,
      'dryRunTranslateStrings: multi-model file surfaces nothing to translate, not a dead-end payload');

    // CRITICAL regression: the MCP wrapper's foam_i18n_translate hits the
    // dryRun branch EXACTLY WHEN foam/i18nStatus said translationReady is
    // false (no local model reachable) — that is the one situation dryRun
    // exists to handle. If messageName-omitted dryRun routed through the
    // translationReady-gated scanMissingLanguages, this would always return
    // an empty strings object in exactly the case that matters, silently
    // breaking the whole needs-translations payload.
    var i18nOffline = foam.parse.lsp.handlers.I18nHandler.create({
      index: index, cache: cache, targetLanguages: ['fr'], translationReady: false });
    var dryOffline = await i18nOffline.dryRunTranslateStrings('file:///t/HasMsgs.js', MSGS, undefined, undefined);
    test(dryOffline.strings.DONE === 'Done' && dryOffline.strings.PART === 'Part',
      'dryRunTranslateStrings: messageName omitted works with translationReady FALSE — not gated like scanMissingLanguages');

    // translateMessages, messageName omitted: loops ALL scan results and
    // merges every message's edit into ONE WorkspaceEdit for the file.
    var multi = await i18nSrv.translateMessages('file:///t/HasMsgs.js', MSGS, undefined, undefined);
    test(multi.edit.changes['file:///t/HasMsgs.js'].length === 2,
      'translateMessages: messageName omitted merges both missing-language messages into ONE WorkspaceEdit');
    test(multi.translated.DONE && multi.translated.DONE.fr === '[fr]Done' &&
      multi.translated.PART && multi.translated.PART.fr === '[fr]Part',
      "translateMessages: translated carries every requested message name's result");

    // Single messageName still works the same way (no scan involved).
    var single = await i18nSrv.translateMessages('file:///t/HasMsgs.js', MSGS, 'DONE', ['fr']);
    test(single.edit.changes['file:///t/HasMsgs.js'].length === 1,
      'translateMessages: explicit messageName translates just that one entry');
  } catch (e) {
    test(false, 'I18nHandler server-method test threw: ' + e.message);
  }
})();

// MCP wrapper's two-phase i18n tools — requires editors/mcp/server.js the
// same way tools/tests/lsp/mcp.js does: loading the module never spawns the
// LSP (main() is guarded by require.main === module), so these run against
// hand-written `lsp` stubs instead of a real child process.
var mcpDone = (async function() {
  try {
    section('MCP — foam_i18n two-phase');
    var mcp = require('../../lsp/editors/mcp/server');
    var os2 = require('os');
    // pid-suffixed so a concurrent run never collides on the same tmp path.
    var tmpFile = h.path.join(os2.tmpdir(), 'I18nMcpTarget-' + process.pid + '.js');
    h.fs.writeFileSync(tmpFile, MSGS);

    try {
      // Phase-1 fallback: provider down → needs-translations payload.
      var lspDown = { ensureOpen: async function() {},
        request: async function(method, params) {
          if ( method === 'foam/i18nStatus' )    return { available: false, targetLanguages: ['fr'] };
          if ( method === 'foam/i18nTranslate' ) return { strings: { DONE: 'Done', PART: 'Part' }, targetLanguages: ['fr'] };
          throw new Error('unexpected: ' + method);
        } };
      var out1 = await mcp.callTool(lspDown, os2.tmpdir(), 'foam_i18n_translate', { file: tmpFile });
      var payload = JSON.parse(out1);
      test(payload.status === 'needs-translations' && payload.strings.DONE === 'Done',
        'no provider → needs-translations payload with source strings');
      test(payload.instructions && payload.instructions.indexOf('foam_i18n_apply') !== -1,
        'needs-translations payload carries the instructions string verbatim');
      test(payload.targetLanguages.length === 1 && payload.targetLanguages[0] === 'fr',
        'needs-translations payload carries targetLanguages');

      // finding E: provider down AND nothing actually needs translating
      // (e.g. messageName pinned to an already-fully-translated entry) must
      // not return an empty needs-translations payload with the full
      // boilerplate instructions — there is nothing for the agent to do
      // with that. A dedicated status says so instead.
      var lspDownEmpty = { ensureOpen: async function() {},
        request: async function(method) {
          if ( method === 'foam/i18nStatus' )    return { available: false, targetLanguages: ['fr'] };
          if ( method === 'foam/i18nTranslate' ) return { strings: {}, targetLanguages: ['fr'] };
          throw new Error('unexpected: ' + method);
        } };
      var outEmpty = await mcp.callTool(lspDownEmpty, os2.tmpdir(), 'foam_i18n_translate',
        { file: tmpFile, messageName: 'SAVED' });
      var payloadEmpty = JSON.parse(outEmpty);
      test(payloadEmpty.status === 'nothing-to-translate',
        'provider down + nothing to translate → nothing-to-translate status, not an empty needs-translations payload');
      test(Object.keys(payloadEmpty).length === 1,
        'nothing-to-translate payload carries no leftover empty strings/instructions fields');

      // Phase 2: apply writes disk via the returned edit. The insertion
      // position is computed programmatically (right after `message: 'Done'`
      // in MSGS) rather than a hand-counted line/character literal.
      var marker = "message: 'Done'";
      var markerIdx = MSGS.indexOf(marker);
      test(markerIdx !== -1, 'sanity: MSGS fixture still contains the DONE message literal');
      var beforeLines = MSGS.slice(0, markerIdx + marker.length).split('\n');
      var insertPos = { line: beforeLines.length - 1, character: beforeLines[beforeLines.length - 1].length };

      var editForApply = { changes: {} };
      editForApply.changes['file://' + tmpFile] = [
        { range: { start: insertPos, end: insertPos },
          newText: ", messageMap: { en: 'Done', fr: 'Terminé' }" } ];
      var lspApply = { ensureOpen: async function() {},
        request: async function(method) {
          if ( method === 'foam/i18nApply' ) return { edit: editForApply, warnings: [] };
          throw new Error('unexpected: ' + method);
        } };
      var out2 = await mcp.callTool(lspApply, os2.tmpdir(), 'foam_i18n_apply',
        { file: tmpFile, translations: { DONE: { fr: 'Terminé' } } });
      test(typeof out2 === 'string' && out2.indexOf('Warnings: none') !== -1,
        'apply tool returns a text summary');
      test(h.fs.readFileSync(tmpFile, 'utf8').indexOf("fr: 'Terminé'") !== -1,
        'apply tool wrote the edit to disk');

      // finding C: applyTranslations can legally produce zero edits (every
      // requested language already present for every message name in the
      // payload) — the apply tool must say so and NOT write to disk, rather
      // than unconditionally claiming "translations applied".
      var editForApplyEmpty = { changes: {} };
      editForApplyEmpty.changes['file://' + tmpFile] = [];
      var lspApplyEmpty = { ensureOpen: async function() {},
        request: async function(method) {
          if ( method === 'foam/i18nApply' ) return { edit: editForApplyEmpty, warnings: [] };
          throw new Error('unexpected: ' + method);
        } };
      var beforeApplyEmpty = h.fs.readFileSync(tmpFile, 'utf8');
      var out3 = await mcp.callTool(lspApplyEmpty, os2.tmpdir(), 'foam_i18n_apply',
        { file: tmpFile, translations: { SAVED: { fr: 'Enregistré' } } });
      test(typeof out3 === 'string' && out3.indexOf('nothing to apply') !== -1,
        'apply tool: zero edits → nothing-to-apply message, not a false "applied" success claim');
      test(h.fs.readFileSync(tmpFile, 'utf8') === beforeApplyEmpty,
        'apply tool: zero-edit response never writes to disk');
    } finally {
      h.fs.unlinkSync(tmpFile);
    }
  } catch (e) {
    test(false, 'MCP i18n two-phase test threw: ' + e.message);
  }
})();

// All async blocks are independent; the entrypoint awaits this one promise.
module.exports = { done: Promise.all([ done, cmdDone, srvDone, mcpDone ]) };
