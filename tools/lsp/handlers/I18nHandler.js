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
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.HttpChatProvider',
      name: 'provider',
      documentation: 'Translation backend (Task 5). Optional — no provider means translationReady stays false and refreshAvailability() is a no-op.'
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
       *  backslash introduced by the quote step. */
      return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    },

    function scanMissingLanguages(uri, text) {
      /**
       * Find every `messages:` entry in `text` missing a translation for one
       * of `targetLanguages`. Reads the model objects (not regex) for the
       * truth about what's already in messageMap — text is only used to
       * locate the `name:` literal's position for the diagnostic range.
       * Gated on translationReady + a non-empty targetLanguages: with no
       * provider confirmed reachable (Task 5), scanning is unsolicited noise.
       * Returns [{ name, missing: [lang, ...], range }] — never null.
       */
      if ( ! this.translationReady ) return [];
      var langs = this.targetLanguages || [];
      if ( ! langs.length ) return [];
      var out = [];
      var models = this.cache.getModels(uri || '', text);
      if ( ! models ) return out;
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
          var pm = re.exec(text);
          if ( ! pm ) continue;
          out.push({
            name:    msg.name,
            missing: missing,
            range: {
              start: this.analyzer.offsetToPosition(text, pm.index),
              end:   this.analyzer.offsetToPosition(text, pm.index + pm[0].length)
            }
          });
        }
      }
      return out;
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
       * model / nested `classes:` (same whole-file guards buildAddExtractEdit
       * uses — model-boundary-aware insertion needs real parsing, not a
       * regex).
       */
      var classMatches = text.match(/foam\.CLASS\s*\(/g);
      if ( ! classMatches || classMatches.length !== 1 ) return null;
      if ( /\bclasses\s*:\s*\[/.test(text) ) return null;
      if ( ( text.match(/\bmessages\s*:\s*\[/g) || [] ).length > 1 ) return null;

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
      /** Top-level `lang:` keys already present in a messageMap's content
       *  (the substring between its `{`/`}`, exclusive). String-aware via
       *  stripStrings_ — a translation value containing ": " or ", " can't
       *  be mistaken for another key. */
      var masked = this.stripStrings_(mapContent);
      var keys = {}, keyRe = /(^|,)\s*([A-Za-z_$][\w$]*)\s*:/g, m;
      while ( ( m = keyRe.exec(masked) ) !== null ) keys[m[2]] = true;
      return keys;
    },

    function translationParts_(translations, skip) {
      /** Build `lang: 'escaped'` parts for every translations[lang] whose
       *  key isn't in `skip` — the spec says append/seed MISSING keys only,
       *  so a language already in the map (existing-map branch) or the
       *  entry's own sourceLanguage (no-map branch, already seeded from the
       *  message literal) is never duplicated. */
      var parts = [];
      for ( var lang in translations ) {
        if ( ! Object.prototype.hasOwnProperty.call(translations, lang) ) continue;
        if ( skip && skip[lang] ) continue;
        parts.push(lang + ": '" + this.escapeJsString_(translations[lang]) + "'");
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
       *     entry for sourceLanguage itself is dropped (already seeded).
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
        var existingKeys = this.mapKeys_(entrySpan.substring(mapOpenRel + 1, mapEndRel));
        var mapParts = this.translationParts_(translations, existingKeys);
        if ( ! mapParts.length ) return null;   // every requested language already present
        insertOffset = span.start + mapEndRel;
        newText = ', ' + mapParts.join(', ');
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
        insertOffset = span.start + literalEndRel;
        newText = ', messageMap: { ' + this.sourceLanguage + ': ' + rawLiteral +
          ( seededParts.length ? ', ' + seededParts.join(', ') : '' ) + ' }';
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
       * `messageMap` keyed by language: 'en' reuses the verbatim source literal;
       * any opt_opts.translations entries (e.g. { fr: '...' }) are added as
       * escaped string literals. Source language is hard-coded 'en' here.
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
      var classMatches = text.match(/foam\.CLASS\s*\(/g);
      if ( ! classMatches || classMatches.length !== 1 ) return null;
      // Ambiguous nesting → the "first" messages:/properties: may belong to an inner class.
      if ( /\bclasses\s*:\s*\[/.test(text) ) return null;
      if ( ( text.match(/\bproperties\s*:\s*\[/g) || [] ).length > 1 ) return null;
      if ( ( text.match(/\bmessages\s*:\s*\[/g)   || [] ).length > 1 ) return null;

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
        // en reuses the verbatim source literal (already validly escaped);
        // model translations are raw strings and need single-quote escaping.
        var mapParts = [ 'en: ' + rawLiteral ];
        var tr = opts.translations || {};
        for ( var lang in tr ) {
          if ( ! Object.prototype.hasOwnProperty.call(tr, lang) ) continue;
          mapParts.push(lang + ": '" + this.escapeJsString_(tr[lang]) + "'");
        }
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
