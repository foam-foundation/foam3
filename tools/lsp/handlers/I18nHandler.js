/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'I18nHandler',

  documentation: 'i18n logic for the LSP: extract-to-messages edit building, missing-language scanning, messageMap edits, and translate-command execution. Extracted from DiagnosticsHandler (2026-08); see docs for foam3#5283.',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.HttpChatProvider'
  ],

  properties: [
    { class: 'FObjectProperty', of: 'foam.parse.lsp.FoamIndex',       name: 'index',    factory: function() { return this.FoamIndex.create(); } },
    { class: 'FObjectProperty', of: 'foam.parse.lsp.FileModelCache',  name: 'cache',    factory: function() { return this.FileModelCache.create(); } },
    { class: 'FObjectProperty', of: 'foam.parse.lsp.CursorAnalyzer',  name: 'analyzer', factory: function() { return this.CursorAnalyzer.create(); } },
    {
      name: 'provider',
      documentation: 'Translation backend — normally a foam.parse.lsp.HttpChatProvider, but typed as a plain property (not FObjectProperty) because only the structural contract matters here: any object exposing detect() and translate(texts, targetCode, context) works, which is what lets tests drive executeCommand with a stub instead of an HTTP server. Optional — no provider means translationReady stays false, refreshAvailability() is a no-op, and executeCommand throws rather than building an untranslated edit.'
    },
    {
      class: 'StringArray',
      name: 'targetLanguages',
      documentation: 'Languages the workspace wants every message translated into, e.g. [\'fr\', \'de\']. Missing-language scanning is a no-op while this is empty.'
    },
    {
      class: 'String',
      name: 'sourceLanguage',
      value: 'en',
      documentation: 'Language the bare `message:` value is written in — seeds messageMap.en when a map is created.'
    },
    {
      class: 'Boolean',
      name: 'translationReady',
      documentation: 'True once the translation provider probe (Task 5) has confirmed a model is reachable. Missing-language scanning and the translate code action are both gated on this — no provider, no unsolicited scan/action noise.'
    },
    {
      class: 'String',
      name: 'activeModel',
      documentation: 'Name of the translation model currently in use (e.g. \'translategemma:4b\'), surfaced in code-action titles so the user knows what will run.'
    }
  ],

  methods: [
    async function refreshAvailability() {
      /**
       * Probe `provider` and update translationReady/activeModel from the
       * result. No provider wired → translationReady false, no probe (a
       * handler under test with no HttpChatProvider stays silent rather
       * than throwing). Called at server boot as a fire-and-forget probe
       * (server.js) — never awaited by the initialize response.
       */
      if ( ! this.provider ) { this.translationReady = false; return; }
      var r = await this.provider.detect();
      this.translationReady = !! r.available;
      this.activeModel      = r.model || '';
    },

    async function executeCommand(command, args) {
      /**
       * Run one of the two i18n translate commands the code actions hand to
       * the client, and return the edit the server should apply.
       *   args: { uri, text, diagnosticRange?, messageText?, messageName?, languages }
       * Returns { edit: <WorkspaceEdit>, warnings: [string] }, or THROWS with
       * a user-facing reason — the server surfaces it via window/showMessage
       * and applies nothing.
       *
       * `text` is the file's CURRENT content (the server reads it from the
       * open-document map, or off disk). The edit is re-anchored against that
       * text here rather than reusing offsets computed back when the action
       * was offered, because the user may have typed in between. A builder
       * returning null means the anchor is gone or ambiguous → error, no edit.
       *
       * All-or-nothing: every requested language is translated BEFORE any
       * edit is built, so a provider failure on the second language throws
       * and leaves the file untouched instead of committing the first.
       */
      var a         = args || {};
      var langs     = a.languages || [];
      var relocated = 'The string could not be re-located — the file changed since the action was offered.';

      if ( command === 'foam.i18n.extractAndTranslate' ) {
        // Translate the literal as it reads IN SOURCE, not a.messageText:
        // the code action derives messageText by re-parsing the diagnostic's
        // own message with /Hardcoded display string "([^"]+)"/, which stops
        // at the first embedded double quote — `Say "Hi"` arrives here as
        // `Say `. buildAddExtractEdit already ignores messageText whenever a
        // range is given (it reads the literal from the range), so without
        // this the entry would pair a correct `en:` seed with a translation
        // of half the string. Same span logic, one call earlier.
        var srcSpan = a.diagnosticRange ? this.literalSpanFromRange_(a.text, a.diagnosticRange) : null;
        if ( a.diagnosticRange && ! srcSpan ) throw new Error(relocated);
        var sourceText  = srcSpan ? srcSpan.content : a.messageText;
        var extracted   = await this.translateInto_(sourceText, langs);
        var extractEdit = this.buildAddExtractEdit(a.text, a.messageText, a.uri, a.diagnosticRange,
          { translations: extracted.translations });
        if ( ! extractEdit ) throw new Error(relocated);
        return { edit: extractEdit, warnings: extracted.warnings };
      }

      if ( command === 'foam.i18n.translateMessage' ) {
        var source = this.findMessageText_(a.uri, a.text, a.messageName);
        if ( source === null ) {
          throw new Error('Message "' + a.messageName + '" could not be re-located — ' +
            'the file changed since the action was offered.');
        }
        var translated = await this.translateInto_(source, langs);
        var mapEdit    = this.buildMessageMapEdit(a.text, a.messageName, translated.translations, a.uri);
        if ( ! mapEdit ) throw new Error(relocated);
        return { edit: mapEdit, warnings: translated.warnings };
      }

      throw new Error('Unknown command: ' + command);
    },

    async function translateInto_(text, languages) {
      /**
       * Translate one source string into every language in `languages`, one
       * provider call per language. Returns { translations: { lang: string },
       * warnings: [string] } with each warning prefixed by its language (a
       * batch for two languages otherwise reports indistinguishable ones).
       *
       * Throws — building no edit — when there is no provider, nothing to
       * translate, no target language, the model answers with no usable
       * translation, or the provider itself rejects (its documented
       * all-or-nothing contract; partially completed languages are dropped).
       */
      if ( ! this.provider ) throw new Error('No translation provider is configured.');
      if ( ! text )          throw new Error('There is no source text to translate.');
      if ( ! languages.length ) throw new Error('No target languages are configured.');

      var translations = {}, warnings = [];
      for ( var i = 0 ; i < languages.length ; i++ ) {
        var lang = languages[i];
        // Third argument is the provider's domain hint — it steers the model
        // toward UI-label phrasing instead of prose.
        var results = await this.provider.translate([ text ], lang, 'application UI label');
        var result  = results && results[0];
        if ( ! result || ! result.translation ) {
          throw new Error('The translation model returned no ' + lang + ' translation.');
        }
        translations[lang] = result.translation;
        var langWarnings = result.warnings || [];
        for ( var w = 0 ; w < langWarnings.length ; w++ ) warnings.push(lang + ': ' + langWarnings[w]);
      }
      return { translations: translations, warnings: warnings };
    },

    function extractPlaceholders_(text) {
      /** Every `${...}`/`{0}`/`%s`/HTML-tag/entity sentinel literally present
       *  in `text`, in order — the same PLACEHOLDER_PATTERN HttpChatProvider
       *  protects before a string ever reaches a translation model. A fresh
       *  RegExp per call (built from .source): the shared constant carries
       *  no 'g' flag precisely so a stateful global-regex instance can never
       *  leak lastIndex between unrelated callers (see I18nProviders.js). */
      var re = new RegExp(this.HttpChatProvider.PLACEHOLDER_PATTERN.source, 'g');
      var out = [], m;
      while ( ( m = re.exec(text) ) !== null ) out.push(m[0]);
      return out;
    },

    function resolveTranslateTargets_(uri, text, opt_messageName) {
      /** Message names foam/i18nTranslate should act on: the one named
       *  message when given, else every messages: entry in the file
       *  currently missing a targetLanguages translation. Goes through the
       *  UNGATED scanMissingLanguages_, not the translationReady-gated
       *  scanMissingLanguages — an explicit foam/i18nTranslate call
       *  (dry-run or real) is not the unsolicited diagnostic/code-action
       *  noise that gate exists to suppress, and the dry-run path is
       *  specifically what runs WHEN translationReady is false (no local
       *  model — hand the agent the strings itself). Gating this would make
       *  the needs-translations payload permanently empty. */
      if ( opt_messageName ) return [ opt_messageName ];
      return this.scanMissingLanguages_(uri, text).map(function(s) { return s.name; });
    },

    async function dryRunTranslateStrings(uri, text, opt_messageName, opt_languages) {
      /**
       * foam/i18nTranslate's dryRun:true branch — no provider call, no
       * network. Just the source strings + target languages an MCP client
       * (or any agent) needs to translate itself and hand back to
       * foam/i18nApply when no local model is reachable. Returns
       * { strings: { NAME: 'source text' }, targetLanguages }.
       */
      var langs = ( opt_languages && opt_languages.length ) ? opt_languages : ( this.targetLanguages || [] );
      var names = this.resolveTranslateTargets_(uri, text, opt_messageName);
      var strings = {};
      for ( var i = 0 ; i < names.length ; i++ ) {
        var src = this.findMessageText_(uri, text, names[i]);
        if ( src !== null ) strings[names[i]] = src;
      }
      return { strings: strings, targetLanguages: langs };
    },

    async function translateMessages(uri, text, opt_messageName, opt_languages) {
      /**
       * foam/i18nTranslate's non-dry branch. Translates every target message
       * (one, or — messageName omitted — every scanMissingLanguages hit) and
       * merges every message's edit into ONE WorkspaceEdit. Returns
       * { edit, warnings, translated: { NAME: { lang: '...' } } }. Does NOT
       * touch disk — the caller (server.js) just returns the edit; applying
       * it is the client's (or the MCP wrapper's) job.
       *
       * Every buildMessageMapEdit call re-anchors against the SAME `text`
       * passed in here — never a running total that shifts as edits
       * accumulate — so each message's insertion offset stays valid against
       * the ORIGINAL text. That's safe to merge into one edits array only
       * because distinct messages: entries can never overlap (findEntrySpan_'s
       * ambiguity guards), so no two messages' insertion points can
       * interleave; the MCP disk-apply helper additionally applies every
       * edit in descending-offset order as a second layer of safety.
       *
       * Messages are translated SEQUENTIALLY (not Promise.all) — a local
       * model server processes one chat-completions request at a time
       * anyway, and it keeps warning attribution per-message simple. A
       * message whose source text can no longer be located (file changed
       * since scan) is skipped, not fatal to the rest of the batch — the
       * same "gone since offered" tolerance scanMissingLanguages results
       * already carry, unlike applyTranslations' placeholder check, which
       * is all-or-nothing by design.
       */
      var langs = ( opt_languages && opt_languages.length ) ? opt_languages : ( this.targetLanguages || [] );
      var names = this.resolveTranslateTargets_(uri, text, opt_messageName);
      var edits = [], warnings = [], translated = {};
      for ( var i = 0 ; i < names.length ; i++ ) {
        var name = names[i];
        var source = this.findMessageText_(uri, text, name);
        if ( source === null ) continue;
        var result = await this.translateInto_(source, langs);
        translated[name] = result.translations;
        for ( var w = 0 ; w < result.warnings.length ; w++ ) warnings.push(name + ': ' + result.warnings[w]);
        var mapEdit = this.buildMessageMapEdit(text, name, result.translations, uri);
        if ( mapEdit ) edits = edits.concat(mapEdit.changes[uri]);
      }
      var changes = {};
      changes[uri] = edits;
      return { edit: { changes: changes }, warnings: warnings, translated: translated };
    },

    function applyTranslations(text, uri, translations) {
      /**
       * foam/i18nApply's builder: validate, then build the merged
       * WorkspaceEdit for a translations payload an agent produced itself
       * (the needs-translations round trip) — { NAME: { lang: '...' } }.
       *
       * Validation (the whole point of this method existing separately from
       * buildMessageMapEdit): every placeholder-pattern token
       * (extractPlaceholders_) present in messageName's CURRENT source
       * `message:` text must appear VERBATIM in every translation offered
       * for it. An agent-produced translation is untrusted the same way a
       * model's is — losing `${name}` silently breaks the rendered UI.
       * All-or-nothing across the WHOLE payload: any offending message name
       * throws (listing every offender, not just the first) before ANY edit
       * is built — never a partial apply. A message name that can no longer
       * be located (source changed since the payload was generated) is
       * also an offender — it can't be validated, so it can't be trusted.
       *
       * Edits for the surviving (in this all-or-nothing method, that means
       * ALL) message names are merged into one WorkspaceEdit exactly like
       * translateMessages — same non-overlap argument applies.
       *
       * Returns { changes: { [uri]: [edit, ...] } } — edits may be empty
       * when every requested language was already present (buildMessageMapEdit
       * returns null per name in that case; never an error, matching that
       * method's existing no-op contract). Throws (does not return null) on
       * a placeholder-validation failure — the caller has a specific offender
       * list to report, unlike the "ambiguous file" null of buildMessageMapEdit.
       */
      var offenders = [];
      for ( var messageName in translations ) {
        if ( ! Object.prototype.hasOwnProperty.call(translations, messageName) ) continue;
        var source = this.findMessageText_(uri, text, messageName);
        if ( source === null ) { offenders.push(messageName); continue; }
        var required = this.extractPlaceholders_(source);
        if ( ! required.length ) continue;
        var langs = translations[messageName] || {};
        var lost = false;
        for ( var lang in langs ) {
          if ( ! Object.prototype.hasOwnProperty.call(langs, lang) ) continue;
          var value = langs[lang];
          for ( var p = 0 ; p < required.length ; p++ ) {
            if ( String(value).indexOf(required[p]) === -1 ) { lost = true; break; }
          }
          if ( lost ) break;
        }
        if ( lost ) offenders.push(messageName);
      }
      if ( offenders.length ) {
        throw new Error('Translation dropped a placeholder present in the source message for: ' +
          offenders.join(', '));
      }

      var edits = [];
      for ( var name in translations ) {
        if ( ! Object.prototype.hasOwnProperty.call(translations, name) ) continue;
        var mapEdit = this.buildMessageMapEdit(text, name, translations[name], uri);
        if ( mapEdit ) edits = edits.concat(mapEdit.changes[uri]);
      }
      var changes = {};
      changes[uri] = edits;
      return { changes: changes };
    },

    function findMessageText_(uri, text, messageName) {
      /** The CURRENT `message:` text of the named messages: entry, read from
       *  the model objects (the same source scanMissingLanguages trusts), not
       *  from a regex. Returns null when the file no longer defines that
       *  entry, or when its message isn't a plain string — either way the
       *  caller reports a re-anchor failure rather than translating a guess. */
      var models = this.cache.getModels(uri || '', text);
      if ( ! models ) return null;
      for ( var m = 0 ; m < models.length ; m++ ) {
        var msgs = models[m].messages || [];
        for ( var i = 0 ; i < msgs.length ; i++ ) {
          if ( msgs[i] && msgs[i].name === messageName ) {
            return typeof msgs[i].message === 'string' ? msgs[i].message : null;
          }
        }
      }
      return null;
    },

    // MOVED VERBATIM from DiagnosticsHandler:
    //   constantizeMessageName_, collectAxiomConstants_, findAddLiteral_,
    //   literalSpanFromRange_, buildAddExtractEdit, findNewMessagesInsertion_
    // plus a private copy of escapeRegex_ (DiagnosticsHandler keeps its own —
    // isCollectionAddReceiver_ still uses it there).
    function escapeRegex_(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    function constantizeMessageName_(s, opt_taken) {
      /** 'Upload Complete' -> 'UPLOAD_COMPLETE_MSG'; safe, unique FOAM message
       *  constant. The _MSG suffix keeps the generated constant out of the
       *  property/action namespace — a 'fileName' property already installs a
       *  FILE_NAME constant, so extracting the label 'File Name' to a bare
       *  FILE_NAME would clash. opt_taken is the set of names already defined on
       *  the model; on any remaining clash a numeric suffix is appended until
       *  free (FILE_NAME_MSG, FILE_NAME_MSG2, ...). */
      var up = String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if ( ! up ) up = 'MESSAGE';
      if ( /^[0-9]/.test(up) ) up = 'M_' + up;     // an identifier can't start with a digit
      var base = up + '_MSG';
      if ( ! opt_taken ) return base;
      var name = base, n = 2;
      while ( opt_taken[name] ) name = base + (n++);
      return name;
    },

    function collectAxiomConstants_(text, uri) {
      /** Names already defined as constant-style members on the file's single
       *  model, so an extracted message name can dodge them. Holds the CONSTANT
       *  form of every own + inherited property and action (FOAM installs a
       *  FILE_NAME constant for a 'fileName' property) plus existing message /
       *  constant names (already constant-cased). */
      var taken = {};
      var models = this.cache.getModels(uri || '', text);
      if ( ! models || ! models.length ) return taken;
      var model = models[0];
      var nameOf   = function(x) { return typeof x === 'string' ? x : ( x && x.name ); };
      var addConst = function(nm) { if ( nm ) taken[foam.String.constantize(nm)] = true; };
      var addRaw   = function(nm) { if ( nm ) taken[nm] = true; };

      var props = model.properties || [];
      for ( var i = 0 ; i < props.length ; i++ ) addConst(nameOf(props[i]));
      var acts = model.actions || [];
      for ( var i = 0 ; i < acts.length ; i++ ) addConst(nameOf(acts[i]));
      var msgs = model.messages || [];
      for ( var i = 0 ; i < msgs.length ; i++ ) addRaw(nameOf(msgs[i]));

      var consts = model.constants;
      if ( Array.isArray(consts) ) {
        for ( var i = 0 ; i < consts.length ; i++ ) addRaw(nameOf(consts[i]));
      } else if ( consts && typeof consts === 'object' ) {
        for ( var k in consts ) if ( Object.prototype.hasOwnProperty.call(consts, k) ) addRaw(k);
      }

      // Inherited properties — best effort; getProperties returns [] when the
      // class isn't registered (incomplete file mid-edit).
      var inherited = this.index.getProperties(this.cache.getClassId(model));
      if ( inherited ) {
        for ( var i = 0 ; i < inherited.length ; i++ ) addConst(inherited[i].name);
      }
      return taken;
    },

    function findAddLiteral_(text, messageText) {
      /** Locate `.add('messageText')` and return the {start,end} span of the
       *  quoted literal (quotes included), or null. */
      var re = new RegExp("\\.add\\(\\s*(['\"`])" + this.escapeRegex_(messageText) + "\\1");
      var m = re.exec(text);
      if ( ! m ) return null;
      var quoteRel = m[0].indexOf(m[1]);          // opening quote within the match
      var litStart = m.index + quoteRel;
      var litEnd = litStart + 1 + messageText.length + 1;  // open + text + close
      return { start: litStart, end: litEnd };
    },

    function literalSpanFromRange_(text, range) {
      /** {start, end, content} of the quoted literal for the occurrence the diagnostic
       *  range points at. The range covers the inner text (no quotes): the opening quote
       *  is one char before range.start and the closing quote is at range.end. Reading
       *  content straight from source (range as the source of truth) is robust to
       *  embedded quotes — unlike re-deriving length from a (possibly message-truncated)
       *  string. Returns null if the quotes don't line up. */
      if ( ! range || ! range.start || ! range.end ) return null;
      var innerStart = this.analyzer.positionToOffset(text, range.start);
      var innerEnd   = this.analyzer.positionToOffset(text, range.end);
      var open = innerStart - 1;
      if ( open < 0 || innerEnd <= innerStart || innerEnd >= text.length ) return null;
      var q = text[open];
      if ( q !== "'" && q !== '"' && q !== '`' ) return null;   // not a quoted literal here
      if ( text[innerEnd] !== q ) return null;                  // closing quote must match
      return { start: open, end: innerEnd + 1, content: text.substring(innerStart, innerEnd) };
    },

    function escapeJsString_(s) {
      /** Escape a raw (unquoted) translation string for embedding inside a
       *  single-quoted JS string literal. Backslashes MUST be escaped first —
       *  escaping the quote before the backslash would double-escape the
       *  backslash introduced by the quote step. Both line terminators are
       *  escaped: a raw CR is as illegal inside a single-quoted literal as a
       *  raw LF, and a model that answers with CRLF is not exotic. */
      return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        .replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    },

    function messageMapKey_(lang) {
      /** A messageMap key as it must appear in source: bare when the language
       *  code is a valid JS identifier ('fr'), quoted when it isn't ('fr-CA',
       *  'zh-Hant') — an unquoted `fr-CA:` is a syntax error. The quoted-form
       *  fallback is validated (unlike a translation VALUE, which is always
       *  escaped via escapeJsString_): a language code reaching this method
       *  can come from workspace config or an agent-supplied translations
       *  payload (applyTranslations), so an embedded quote/backslash there
       *  would break out of the emitted string literal rather than just
       *  mistranslate. Throws, naming the offending code, rather than
       *  writing unsafe source. */
      if ( /^[A-Za-z_$][\w$]*$/.test(lang) ) return lang;
      if ( ! /^[A-Za-z0-9@_$-]+$/.test(lang) ) {
        throw new Error('Invalid language code for a messageMap key: "' + lang + '"');
      }
      return "'" + lang + "'";
    },

    function scanMissingLanguages(uri, text) {
      /**
       * DiagnosticsHandler/CodeActionHandler entry point — same as
       * scanMissingLanguages_ below, PLUS gated on translationReady: with no
       * provider confirmed reachable (Task 5), an unsolicited HINT diagnostic
       * or code action would be noise the user can't act on yet. Returns
       * [{ name, missing: [lang, ...], range }] — never null.
       *
       * foam/i18nTranslate's dryRun path (resolveTranslateTargets_) does NOT
       * go through this gate — it calls scanMissingLanguages_ directly. An
       * explicit tool call asking "what needs translating" is not the
       * unsolicited noise this gate exists to suppress; translationReady
       * being false is exactly the situation dryRun exists to handle (no
       * local model — hand the agent the strings itself).
       */
      if ( ! this.translationReady ) return [];
      return this.scanMissingLanguages_(uri, text);
    },

    function scanMissingLanguages_(uri, text) {
      /**
       * Find every `messages:` entry in `text` missing a translation for one
       * of `targetLanguages`. Reads the model objects (not regex) for the
       * truth about what's already in messageMap — text is only used to
       * locate the `name:` literal's position for the diagnostic range.
       * UNGATED on translationReady (see scanMissingLanguages above for the
       * gated entry point diagnostics/code actions use) — still gated on a
       * non-empty targetLanguages, which has nothing to do with provider
       * availability: no target languages configured means there is
       * nothing to scan for, regardless of caller. Returns
       * [{ name, missing: [lang, ...], range }] — never null.
       *
       * Whole-file guard (isMultiModelFile_): a multi-model file offers no
       * single unambiguous `messages: [` array or entry span for the
       * builders (findEntrySpan_, buildAddExtractEdit) to write into — this
       * scanner used to have no such guard, so it would surface a HINT
       * (editor lane) or dry-run strings (MCP lane) for work the builders
       * then refused, a dead end either way (foam3#5283 review finding B).
       */
      if ( this.isMultiModelFile_(text) ) return [];
      var langs = this.targetLanguages || [];
      if ( ! langs.length ) return [];
      var out = [];
      var models = this.cache.getModels(uri || '', text);
      if ( ! models ) return out;
      // Position search is scoped to start at the `messages: [` array's own
      // `[` (never the whole file) — a same-named `name:` key elsewhere in
      // the file (e.g. a property sharing a message's name) would otherwise
      // be matched first and misplace the HINT squiggle at the wrong spot
      // (foam3#5283 review finding F). isMultiModelFile_ above already
      // guarantees at most one `messages: [` array exists.
      var arrM = /messages\s*:\s*\[/.exec(text);
      var searchFrom = arrM ? arrM.index : 0;
      for ( var m = 0 ; m < models.length ; m++ ) {
        var msgs = models[m].messages || [];
        for ( var i = 0 ; i < msgs.length ; i++ ) {
          var msg = msgs[i];
          if ( ! msg || ! msg.name ) continue;
          var map = msg.messageMap || {};
          var missing = langs.filter(function(l) { return ! map[l]; });
          if ( ! missing.length ) continue;
          // Position: the name literal of this entry in source text.
          var re = new RegExp("name\\s*:\\s*['\"]" + this.escapeRegex_(msg.name) + "['\"]");
          var pm = re.exec(text.slice(searchFrom));
          if ( ! pm ) continue;
          var absIndex = searchFrom + pm.index;
          out.push({
            name:    msg.name,
            missing: missing,
            range: {
              start: this.analyzer.offsetToPosition(text, absIndex),
              end:   this.analyzer.offsetToPosition(text, absIndex + pm[0].length)
            }
          });
        }
      }
      return out;
    },

    function isMultiModelFile_(text) {
      /**
       * True when `text` can't be treated as a single flat model for
       * regex-based structural edits: more than one top-level `foam.CLASS(`,
       * an inline nested `classes:` block, or a duplicated `messages:` array
       * — any of these make "the messages: array" or "the entry" ambiguous
       * without real parsing. Shared by findEntrySpan_, buildAddExtractEdit,
       * and scanMissingLanguages_ so all three refuse the same file shapes
       * consistently (foam3#5283 review finding B — before this, the scanner
       * offered HINTs/dry-run strings for files the builders would then
       * refuse to edit, a dead end for both the editor and MCP lanes).
       * buildAddExtractEdit additionally refuses a duplicated `properties:`
       * block, which is specific to where IT inserts and isn't part of this
       * shared check.
       */
      var classMatches = text.match(/foam\.CLASS\s*\(/g);
      if ( ! classMatches || classMatches.length !== 1 ) return true;
      if ( /\bclasses\s*:\s*\[/.test(text) ) return true;
      if ( ( text.match(/\bmessages\s*:\s*\[/g) || [] ).length > 1 ) return true;
      return false;
    },

    function findEntrySpan_(text, messageName) {
      /**
       * Locate the `{ name: '<messageName>', ... }` messages: entry in `text`
       * unambiguously. Scans FORWARD from the `messages: [` array's own `[`
       * — never backward from the name match — tracking bracket depth while
       * skipping over quoted content whole (so a decoy `{`/`}` inside a
       * string value, e.g. `message: 'a { b'`, can never be mistaken for a
       * structural brace: an entry span is only ever recorded by watching
       * depth return to the array's own level, never by proximity to the
       * name match). This also means a `messageMap: {...}` nested inside the
       * entry is handled for free — it's just deeper nesting under the same
       * counter, not a separate pass.
       *
       * Returns { start, end } (end exclusive, past the entry's closing `}`)
       * or null when: there's no `messages: [` array, the name isn't found
       * as a `name:` key inside exactly one top-level entry (not found, or
       * ambiguous — two entries share the name, or the messages: array
       * itself is duplicated), or the file has more than one top-level
       * model / nested `classes:` (isMultiModelFile_ above — model-boundary-
       * aware insertion needs real parsing, not a regex).
       */
      if ( this.isMultiModelFile_(text) ) return null;

      var arrM = /messages\s*:\s*\[/.exec(text);
      if ( ! arrM ) return null;

      // String-aware bracket walk starting AT the array's own '['. A
      // top-level entry's opening '{' is seen while depth === 1 (directly
      // inside the array, before it's counted); its matching '}' is the one
      // that returns depth from 2 back to 1.
      var entries = [];
      var depth = 0, entryStart = -1;
      for ( var i = arrM.index + arrM[0].length - 1 ; i < text.length ; i++ ) {
        var ch = text[i];
        if ( ch === '[' || ch === '{' ) {
          depth++;
          if ( ch === '{' && depth === 2 ) entryStart = i;
        } else if ( ch === ']' || ch === '}' ) {
          if ( ch === '}' && depth === 2 ) entries.push({ start: entryStart, end: i + 1 });
          depth--;
          if ( depth === 0 ) break;   // array closed
        } else if ( ch === "'" || ch === '"' || ch === '`' ) {
          for ( i++ ; i < text.length ; i++ ) {
            if ( text[i] === '\\' ) { i++; continue; }
            if ( text[i] === ch ) break;
          }
        }
      }

      var nameRe = new RegExp("name\\s*:\\s*['\"]" + this.escapeRegex_(messageName) + "['\"]");
      var matches = [];
      for ( var e = 0 ; e < entries.length ; e++ ) {
        if ( nameRe.test(text.substring(entries[e].start, entries[e].end)) ) matches.push(entries[e]);
      }
      if ( matches.length !== 1 ) return null;   // not found, or ambiguous
      return matches[0];
    },

    function stripStrings_(s) {
      /** Replace every quoted literal's content with spaces (quotes and
       *  length kept, so offsets stay valid) so a later key/regex scan can't
       *  be fooled by a colon or comma embedded in a translation value. */
      var out = '', i = 0, n = s.length;
      while ( i < n ) {
        var ch = s[i];
        if ( ch === "'" || ch === '"' || ch === '`' ) {
          out += ch; i++;
          while ( i < n ) {
            if ( s[i] === '\\' ) { out += '  '; i += 2; continue; }
            if ( s[i] === ch ) { out += ch; i++; break; }
            out += ' '; i++;
          }
          continue;
        }
        out += ch; i++;
      }
      return out;
    },

    function mapKeys_(mapContent) {
      /** Top-level keys already present in a messageMap's content (the
       *  substring between its `{`/`}`, exclusive), bare (`fr:`) and quoted
       *  (`'fr-CA':`) alike — this tool emits the quoted form for regional
       *  codes, so it has to recognize its own output or a second translate
       *  of the same language would append a duplicate key.
       *
       *  String-aware via stripStrings_ — a translation value containing
       *  ": " or ", " can't be mistaken for another key. For the quoted form
       *  the masked text keeps the quotes and the run length (content
       *  blanked), so the match locates the key's span and the real name is
       *  read back from the unmasked content at that same offset. */
      var masked = this.stripStrings_(mapContent);
      var keys = {}, m;
      var bareRe = /(^|,)\s*([A-Za-z_$][\w$]*)\s*:/g;
      while ( ( m = bareRe.exec(masked) ) !== null ) keys[m[2]] = true;
      var quotedRe = /(^|,)\s*(['"])( *)\2\s*:/g;
      while ( ( m = quotedRe.exec(masked) ) !== null ) {
        var start = m.index + m[0].indexOf(m[2]) + 1;   // just past the opening quote
        keys[mapContent.substring(start, start + m[3].length)] = true;
      }
      return keys;
    },

    function translationParts_(translations, skip) {
      /** Build `lang: 'escaped'` parts for every translations[lang] whose
       *  key isn't in `skip` — the spec says append/seed MISSING keys only,
       *  so a language already in the map (existing-map branch) or the
       *  entry's own sourceLanguage (no-map branch, already seeded from the
       *  message literal) is never duplicated. Both messageMap builders emit
       *  their language keys through here, so key quoting and value escaping
       *  are decided in exactly one place. */
      var parts = [];
      for ( var lang in translations ) {
        if ( ! Object.prototype.hasOwnProperty.call(translations, lang) ) continue;
        if ( skip && skip[lang] ) continue;
        parts.push(this.messageMapKey_(lang) + ": '" + this.escapeJsString_(translations[lang]) + "'");
      }
      return parts;
    },

    function buildMessageMapEdit(text, messageName, translations, uri) {
      /**
       * Build the WorkspaceEdit that adds `translations` (e.g. { fr: '...' })
       * to the `messageName` entry's messageMap. Two shapes:
       *   - entry has no messageMap yet → insert `, messageMap: { <sourceLanguage>:
       *     <message literal>, lang: '...', ... }` right after the entry's
       *     `message:` value. The source-language key reuses the entry's own
       *     message literal verbatim (already validly escaped) — same
       *     rawLiteral principle as buildAddExtractEdit. A `translations`
       *     entry for sourceLanguage itself is dropped (already seeded); if
       *     that leaves nothing to add, returns null.
       *   - entry already has a messageMap → append only the `lang: '...'`
       *     pairs not already present before that map's closing `}`; if
       *     every requested language is already there, returns null (no
       *     no-op edit).
       * Returns { changes: { [uri]: [edit] } } or null — see findEntrySpan_
       * for the ambiguity bail-outs (malformed/duplicate/multi-model), plus
       * a malformed entry (no `message:` value and no messageMap to extend).
       *
       * Limitation: like findEntrySpan_, this trusts messageMap: { ... } to be
       * a plain object literal — a computed/spread messageMap would still
       * "work" (regex just needs the literal `messageMap: {`) but nothing in
       * this codebase writes one, and no fixture exercises it.
       */
      var span = this.findEntrySpan_(text, messageName);
      if ( ! span ) return null;
      var entrySpan = text.substring(span.start, span.end);

      var mapM = /messageMap\s*:\s*\{/.exec(entrySpan);
      var insertOffset, newText;

      if ( mapM ) {
        // Existing map: find its closing `}` (depth-tracked, string-aware —
        // same technique as findEntrySpan_) and insert just before it.
        var mapOpenRel = mapM.index + mapM[0].length - 1;   // position of the map's '{'
        var depth = 0, mapEndRel = -1;
        for ( var j = mapOpenRel ; j < entrySpan.length ; j++ ) {
          var ch = entrySpan[j];
          if ( ch === '{' ) depth++;
          else if ( ch === '}' ) { depth--; if ( depth === 0 ) { mapEndRel = j; break; } }
          else if ( ch === "'" || ch === '"' || ch === '`' ) {
            for ( j++ ; j < entrySpan.length ; j++ ) {
              if ( entrySpan[j] === '\\' ) { j++; continue; }
              if ( entrySpan[j] === ch ) break;
            }
          }
        }
        if ( mapEndRel === -1 ) return null;
        var mapContent = entrySpan.substring(mapOpenRel + 1, mapEndRel);
        var existingKeys = this.mapKeys_(mapContent);
        var mapParts = this.translationParts_(translations, existingKeys);
        if ( ! mapParts.length ) return null;   // every requested language already present

        // What's already between the braces decides how the insertion joins
        // it — naively prepending ', ' before the closing `}` writes invalid
        // JS for the two shapes below (foam3#5283 review finding A):
        //   `{}` (or whitespace-only)  -> ', fr: ...'  would read '{ , fr: ... }'
        //   `{ en: 'x', }` (trailing comma) -> ', fr: ...' would read '{ en: 'x', , fr: ... }'
        // stripStrings_ masks quoted values (so a translation ending in a
        // literal ',' can't be mistaken for a structural trailing comma)
        // while keeping length/quote chars, so trailing-whitespace/char
        // detection on the masked text maps back to real offsets in mapContent.
        var maskedContent  = this.stripStrings_(mapContent);
        var trimmedMasked  = maskedContent.replace(/\s+$/, '');
        if ( trimmedMasked.length === 0 ) {
          // Empty or whitespace-only map: no existing entries to join onto —
          // pad with spaces so `{}` becomes `{ fr: '...' }`, not `{fr: '...'}`.
          insertOffset = span.start + mapEndRel;
          newText = ' ' + mapParts.join(', ') + ' ';
        } else if ( trimmedMasked[trimmedMasked.length - 1] === ',' ) {
          // Trailing comma already present: insert right after it (before any
          // trailing whitespace) with no comma of our own — the existing one
          // already separates the new pair from the last existing one.
          insertOffset = span.start + mapOpenRel + 1 + trimmedMasked.length;
          newText = ' ' + mapParts.join(', ');
        } else {
          insertOffset = span.start + mapEndRel;
          newText = ', ' + mapParts.join(', ');
        }
      } else {
        // No map yet: insert right after the entry's `message:` value. Left
        // boundary guard (`(?:^|[{,\s])`) keeps a property like
        // `submessage:` from being mistaken for `message:`.
        var msgM = /(?:^|[{,\s])message\s*:\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/.exec(entrySpan);
        if ( ! msgM ) return null;
        var literalEndRel = msgM.index + msgM[0].length;    // just past the closing quote
        var rawLiteral = entrySpan.substring(msgM.index + msgM[0].indexOf(msgM[1]), literalEndRel);
        var skip = {};
        skip[this.sourceLanguage] = true;
        var seededParts = this.translationParts_(translations, skip);
        // Symmetric with the existing-map branch's "already present" bail-out:
        // translations holding nothing but sourceLanguage leaves nothing to
        // add, and seeding a source-language-only map would be a no-op edit.
        if ( ! seededParts.length ) return null;
        insertOffset = span.start + literalEndRel;
        newText = ', messageMap: { ' + this.messageMapKey_(this.sourceLanguage) + ': ' + rawLiteral +
          ', ' + seededParts.join(', ') + ' }';
      }

      var p = this.analyzer.offsetToPosition(text, insertOffset);
      var edits = [{ range: { start: p, end: p }, newText: newText }];
      var changes = {};
      changes[uri] = edits;
      return { changes: changes };
    },

    function buildAddExtractEdit(text, messageText, uri, opt_range, opt_opts) {
      /**
       * Build the "extract to messages: entry" WorkspaceEdit for a hardcoded
       * .add('<messageText>') string: rewrite the usage to `this.<NAME>` and add
       * a `{ name, message }` entry (into an existing messages: array, or a new
       * one). Returns { changes: { [uri]: [edits] } } or null.
       *
       * opt_range (the triggering diagnostic's LSP range) pins the rewrite to the
       * exact occurrence — without it, a repeated identical string would rewrite the
       * first match. Falls back to the first .add() match only when no range is given.
       *
       * opt_opts = { withMessageMap: boolean, translations: Object|null }. With
       * neither set, the entry is the plain `{ name, message }` shape. With
       * withMessageMap (or translations, which implies it), the entry gains a
       * `messageMap` keyed by language: the sourceLanguage key reuses the
       * verbatim source literal; any opt_opts.translations entries (e.g.
       * { fr: '...' }) are added as escaped string literals. The seeded key
       * follows this.sourceLanguage, same as buildMessageMapEdit's no-map
       * branch — a workspace whose messages are written in French seeds `fr`
       * and keeps an `en` translation instead of silently dropping it.
       *
       * Scope safety: bail (null) unless there is exactly one top-level model and an
       * unambiguous single insertion target. Multiple `foam.CLASS(`, inline `classes:`,
       * or more than one `properties:`/`messages:` block → ambiguous → no autofix.
       *
       * Limitations:
       * - Diagnostics can appear in multi-model files, but the extract code action is
       *   intentionally disabled there; inserting `messages:` into the right model
       *   requires model-boundary parsing, not whole-file regexes.
       * - Inline inner `classes:` are skipped for the same reason: `messages:` or
       *   `properties:` could belong to either the outer model or an inner class.
       * - If the diagnostic range no longer lines up with the quoted literal, no edit is
       *   returned rather than risking a rewrite at the wrong occurrence.
       */
      // Ambiguous nesting → the "first" messages:/properties: may belong to an inner class.
      if ( this.isMultiModelFile_(text) ) return null;
      if ( ( text.match(/\bproperties\s*:\s*\[/g) || [] ).length > 1 ) return null;

      // With a range, read the literal (and its content) straight from source — the
      // range is authoritative and handles embedded quotes; the passed messageText may
      // be truncated by the caller's message-reparse. Without a range, fall back to the
      // first .add() match of messageText.
      var usage, content;
      if ( opt_range ) {
        usage = this.literalSpanFromRange_(text, opt_range);
        if ( ! usage ) return null;
        content = usage.content;
      } else {
        usage = this.findAddLiteral_(text, messageText);
        if ( ! usage ) return null;
        content = messageText;
      }

      var name = this.constantizeMessageName_(content, this.collectAxiomConstants_(text, uri));
      var edits = [];

      // Rewrite the usage: 'messageText' -> this.NAME
      edits.push({
        range: {
          start: this.analyzer.offsetToPosition(text, usage.start),
          end:   this.analyzer.offsetToPosition(text, usage.end)
        },
        newText: 'this.' + name
      });

      // Add the messages entry. Reuse the verbatim source literal (quotes + already-
      // valid escaping) for the message: value — re-escaping the raw captured content
      // would double-escape an existing `\'` and produce invalid JS.
      var rawLiteral = text.substring(usage.start, usage.end);
      var opts = opt_opts || {};
      var entry = "{ name: '" + name + "', message: " + rawLiteral;
      if ( opts.withMessageMap || opts.translations ) {
        // The source-language key reuses the verbatim source literal (already
        // validly escaped); model translations are raw strings that need
        // escaping and, for a regional code, a quoted key — both handled by
        // translationParts_, which also drops a translation for the language
        // just seeded. The skip follows sourceLanguage rather than a literal
        // 'en' so a French-source workspace drops `fr` (seeded) and keeps
        // `en` (a real translation target).
        var seedSkip = {};
        seedSkip[this.sourceLanguage] = true;
        var mapParts = [ this.messageMapKey_(this.sourceLanguage) + ': ' + rawLiteral ]
          .concat(this.translationParts_(opts.translations || {}, seedSkip));
        entry += ', messageMap: { ' + mapParts.join(', ') + ' }';
      }
      entry += ' }';
      var msgArr = /messages\s*:\s*\[/.exec(text);
      if ( msgArr ) {
        var insAt = msgArr.index + msgArr[0].length;          // just after '['
        var p = this.analyzer.offsetToPosition(text, insAt);
        edits.push({ range: { start: p, end: p }, newText: '\n    ' + entry + ',' });
      } else {
        var ins = this.findNewMessagesInsertion_(text, entry);
        if ( ! ins ) return null;
        var p2 = this.analyzer.offsetToPosition(text, ins.offset);
        edits.push({ range: { start: p2, end: p2 }, newText: ins.newText });
      }

      var changes = {};
      changes[uri] = edits;
      return { changes: changes };
    },

    function findNewMessagesInsertion_(text, entry) {
      /**
       * Pick where to insert a brand-new `messages: [...]` block. Preference:
       *   1. Right before the FIRST top-level block — properties:/methods:/listeners:/
       *      actions:. This sits after the declarative header (package/name/extends/
       *      requires/imports) and before any body, so it never lands inside a method
       *      body object literal.
       *   2. Else after the last header key — requires/imports (arrays) or
       *      package/name/extends (strings).
       *   3. Else right after `foam.CLASS({`.
       * Returns { offset, newText } for a zero-width insert, or null.
       */
      // 1. Before the first properties:/methods:/listeners:/actions: block.
      // First match (not last) → the top-level block, never a body-nested key.
      var pm = /(^|\n)([ \t]*)(?:properties|methods|listeners|actions)\s*:/.exec(text);
      if ( pm ) {
        var indent = pm[2];
        var lineStart = pm.index + pm[1].length;   // start of that line's indent
        return {
          offset: lineStart,
          newText: indent + 'messages: [\n' + indent + '  ' + entry + '\n' + indent + '],\n'
        };
      }

      // 2. After the last header key
      var endOff = -1, endIndent = '  ';
      var strRe = /(^|\n)([ \t]*)(package|name|extends)\s*:\s*'[^']*'\s*,?/g, sm;
      while ( ( sm = strRe.exec(text) ) !== null ) {
        var e = sm.index + sm[0].length;
        if ( e > endOff ) { endOff = e; endIndent = sm[2]; }
      }
      var arrKeys = ['requires', 'imports'];
      for ( var k = 0 ; k < arrKeys.length ; k++ ) {
        var am = new RegExp('(^|\\n)([ \\t]*)' + arrKeys[k] + '\\s*:\\s*\\[').exec(text);
        if ( ! am ) continue;
        var i = am.index + am[0].length - 1;       // at the '['
        var depth = 0;
        for ( ; i < text.length ; i++ ) {
          if ( text[i] === '[' ) depth++;
          else if ( text[i] === ']' ) { depth--; if ( depth === 0 ) { i++; break; } }
        }
        if ( text[i] === ',' ) i++;                // include trailing comma
        if ( i > endOff ) { endOff = i; endIndent = am[2]; }
      }
      if ( endOff !== -1 ) {
        return {
          offset: endOff,
          newText: '\n' + endIndent + 'messages: [\n' + endIndent + '  ' + entry + '\n' + endIndent + '],'
        };
      }

      // 3. After foam.CLASS({
      var clsOpen = /foam\.CLASS\s*\(\s*\{/.exec(text);
      if ( ! clsOpen ) return null;
      var o = clsOpen.index + clsOpen[0].length;
      return { offset: o, newText: '\n  messages: [\n    ' + entry + '\n  ],' };
    },

    function deriveLanguagesFromJournals(jrlLoader, filePaths) {
      /**
       * Fallback target-language list when no explicit config is given:
       * every distinct `locale` value already present across foam.i18n.Locale
       * rows in filePaths (typically journals/locales.jrl) — the languages
       * the workspace already has translations for. A variant row like
       * { locale: 'en', variant: 'US' } counts as base code 'en', not a
       * separate language. sourceLanguage (not a hardcoded 'en') is
       * excluded — it's the language messages are written in, not a
       * translation target. Returns a distinct, sorted array.
       *
       * Per-file loadFile() + concat, NOT loadFiles() — loadFiles() keys
       * rows by class+index, so a second file's rows silently overwrite the
       * first file's rows at the same index (same trap CSSTokenResolver's
       * loadFromJournals avoids the same way).
       */
      var objects = [];
      for ( var f = 0 ; f < filePaths.length ; f++ ) {
        objects = objects.concat(jrlLoader.loadFile(filePaths[f]));
      }
      var locales = jrlLoader.filterByClass(objects, 'foam.i18n.Locale');
      var seen = {};
      for ( var i = 0 ; i < locales.length ; i++ ) {
        var code = locales[i].locale;
        if ( ! code || code === this.sourceLanguage ) continue;
        seen[code] = true;
      }
      return Object.keys(seen).sort();
    }
  ]
});
