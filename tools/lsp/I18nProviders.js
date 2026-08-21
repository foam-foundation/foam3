/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Ported from the pi ollama-translate extension (prompt shape, placeholder
// protection, leakage scrub — proven there against translategemma). Logic
// kept identical; TS -> FOAM-style JS.

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'HttpChatProvider',

  documentation: `OpenAI-compatible chat-completions translation provider.
    Talks to any local server exposing /v1/models + /v1/chat/completions —
    covers Ollama, LM Studio, llama.cpp, vLLM. Detection results are cached:
    a positive result for the whole session (the model isn't going to
    disappear mid-session), a negative result for negativeCacheTtlMs (the
    user may still be starting the server) so a missing model doesn't wedge
    translationReady false forever without hammering the endpoint on every
    request either. Reconfiguring endpoints or model clears the cache.`,

  properties: [
    {
      class: 'StringArray',
      name: 'endpoints',
      documentation: 'Base URLs probed in order by detect(). First one that answers /v1/models with this.model listed wins. Each entry is normalized on set (see normalizeEndpoint_): a scheme-less host (Ollama\'s own documented OLLAMA_HOST format, e.g. "127.0.0.1:11434") gets http:// prepended, and trailing slashes are stripped.',
      factory: function() { return [ 'http://127.0.0.1:11434', 'http://127.0.0.1:1234' ]; },
      adapt: function(_, v) {
        if ( ! Array.isArray(v) ) return v;
        var self = this;
        return v.map(function(h) { return self.normalizeEndpoint_(h); });
      },
      postSet: function() { this.clearCache_(); }
    },
    {
      class: 'String',
      name: 'model',
      value: 'translategemma:4b',
      postSet: function() { this.clearCache_(); }
    },
    {
      class: 'String',
      name: 'sourceLanguage',
      value: 'en'
    },
    {
      class: 'Int',
      name: 'timeoutMs',
      value: 30000
    },
    {
      class: 'Int',
      name: 'negativeCacheTtlMs',
      documentation: 'How long a negative detect() result is honoured before re-probing. A property (not a literal) so tests can exercise TTL expiry without a real 60s sleep.',
      value: 60000
    },
    {
      name: 'lastProbe_',
      documentation: 'Date.now() timestamp of the last detect() probe — drives the negativeCacheTtlMs negative-cache TTL. Cleared on endpoints/model reconfiguration.'
    },
    {
      name: 'lastResult_',
      documentation: 'Cached { available, model, endpoint } from the last detect() probe. Cleared on endpoints/model reconfiguration.'
    },
    {
      name: 'resolvedModel_',
      documentation: 'The exact model id from the endpoint\'s /v1/models listing that matched this.model on the last successful detect() — e.g. "translategemma:4b-q4_0" for a configured "translategemma:4b". Ollama (and OpenAI-compatible servers generally) resolve chat requests by exact id, so translate() POSTs this, not the configured prefix. Cleared on endpoints/model reconfiguration.'
    }
  ],

  methods: [
    async function detect() {
      /**
       * Probe this.endpoints in order for a reachable OpenAI-compatible
       * server that lists this.model. Never throws — an unreachable
       * endpoint (connection refused, timeout, non-2xx, bad JSON) is just
       * skipped and the next endpoint tried. Returns
       * { available, model, endpoint }; endpoint is '' when none matched.
       * `model` is the RESOLVED listing id (e.g. 'translategemma:4b-q4_0'),
       * not necessarily the configured this.model — see resolvedModel_.
       *
       * Caching: a cached positive result is returned for the rest of the
       * session (no re-probing once a model is confirmed up). A cached
       * negative result is only honoured for negativeCacheTtlMs — long
       * enough to avoid hammering a down server on every call, short enough
       * that starting the server after the LSP boots is noticed soon after.
       */
      if ( this.lastResult_ ) {
        if ( this.lastResult_.available ) return this.lastResult_;
        if ( Date.now() - this.lastProbe_ < this.negativeCacheTtlMs ) return this.lastResult_;
      }

      var self = this;
      for ( var i = 0 ; i < this.endpoints.length ; i++ ) {
        var endpoint = this.endpoints[i];
        try {
          var res = await fetch(endpoint + '/v1/models', {
            signal: AbortSignal.timeout(this.timeoutMs)
          });
          if ( ! res.ok ) continue;
          var json = await res.json();
          var models = ( json && json.data ) || [];
          // Substring match — Ollama model ids carry a tag/quant suffix
          // (e.g. 'translategemma:4b-q4_0') that an exact match would miss.
          // Capture the MATCHED listing id (find, not some) — Ollama's chat
          // endpoint resolves by exact id, so the configured prefix alone
          // would 404 once the server actually runs a tagged variant.
          var matched = null;
          for ( var j = 0 ; j < models.length ; j++ ) {
            var m = models[j];
            if ( m && typeof m.id === 'string' && m.id.indexOf(self.model) !== -1 ) {
              matched = m.id;
              break;
            }
          }
          if ( matched ) {
            var result = { available: true, model: matched, endpoint: endpoint };
            this.lastProbe_     = Date.now();
            this.lastResult_    = result;
            this.resolvedModel_ = matched;
            return result;
          }
        } catch (e) {
          // Unreachable / timed out / malformed response — try the next endpoint.
        }
      }

      console.error('[HttpChatProvider] no translation model reachable — tried ' +
        this.endpoints.join(', ') + ' for model "' + this.model + '"');
      var negative = { available: false, model: this.model, endpoint: '' };
      this.lastProbe_  = Date.now();
      this.lastResult_ = negative;
      return negative;
    },

    async function translate(texts, targetCode, context) {
      /**
       * Translate `texts` (array of source strings) into `targetCode`,
       * sequentially — one chat-completions call per string. `context` is
       * an optional short domain hint folded into the prompt (e.g. 'Visa
       * dispute management UI'). Returns [{ input, translation, warnings }],
       * one entry per input string, in order.
       *
       * Placeholder sentinels (${name}, {0}, %s, <tag>, &amp;) are protected
       * before the string ever reaches the model and restored afterward —
       * a model that drops or mistranslates a sentinel produces a warning
       * rather than a silently broken translation.
       *
       * All-or-nothing: on the first per-string failure (non-2xx response,
       * missing content, etc.) this THROWS and any translations already
       * completed for earlier strings in this call are discarded — there is
       * no partial-success return. This matches the LSP command's
       * error-handling contract (no partial edits get built from a partial
       * batch); callers rely on it.
       */
      var det = await this.detect();
      if ( ! det.available ) {
        throw new Error('No translation model reachable at any configured endpoint (' +
          this.endpoints.join(', ') + ')');
      }

      var sourceLang = this.languageName_(this.sourceLanguage, 'English');
      var targetLang = this.languageName_(targetCode, targetCode);

      var out = [];
      for ( var i = 0 ; i < texts.length ; i++ ) {
        var protectedResult = this.protectText_(texts[i]);
        var prompt = this.buildPrompt_({
          text:           protectedResult.protectedText,
          sourceLanguage: sourceLang,
          sourceCode:     this.sourceLanguage,
          targetLanguage: targetLang,
          targetCode:     targetCode,
          context:        context
        });

        var res = await fetch(det.endpoint + '/v1/chat/completions', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({
            model:       this.resolvedModel_,
            messages:    [ { role: 'user', content: prompt } ],
            temperature: 0,
            stream:      false
          }),
          signal: AbortSignal.timeout(this.timeoutMs)
        });

        if ( ! res.ok ) {
          var body = await res.text().catch(function() { return ''; });
          throw new Error('Translation request failed (' + res.status + ' ' + res.statusText + '): ' + body);
        }

        var json = await res.json();
        var content = json && json.choices && json.choices[0] &&
          json.choices[0].message && json.choices[0].message.content;
        if ( typeof content !== 'string' ) {
          throw new Error('Translation response did not include choices[0].message.content');
        }

        var withoutLeakage = this.removePromptLeakage_(content);
        var restored = protectedResult.restore(withoutLeakage.text);
        out.push({
          input:       texts[i],
          translation: restored.text,
          warnings:    withoutLeakage.warnings.concat(restored.warnings)
        });
      }

      return out;
    },

    function normalizeEndpoint_(host) {
      /**
       * Ported from the TS source's normalizeHost, extended: Ollama's own
       * documented OLLAMA_HOST format is scheme-less (e.g. '127.0.0.1:11434'
       * or just a bare host) — fetch() throws a TypeError on that (no
       * protocol), which detect()'s per-endpoint try/catch silently
       * swallows as "unreachable". Prepend http:// when no scheme is
       * present. Also strips trailing slashes so '.../v1/models' doesn't
       * end up as '...//v1/models' (404s against most servers).
       */
      if ( ! host ) return host;
      var h = String(host).replace(/\/+$/, '');
      if ( ! /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(h) ) h = 'http://' + h;
      return h;
    },

    function clearCache_() {
      /** Reconfiguring endpoints/model invalidates any cached detect()
       *  result — a stale positive/negative from the OLD config must not
       *  survive into the new one. */
      this.lastProbe_     = undefined;
      this.lastResult_    = undefined;
      this.resolvedModel_ = undefined;
    },

    function protectText_(text) {
      /**
       * Replace FOAM/printf/HTML placeholders with opaque sentinel tokens
       * before handing text to the model, so a translation model can't
       * mangle `${name}`, `{0}`, `%s`, `<b>`, `&amp;`, etc. Returns
       * { protectedText, restore(translated) } — restore() swaps the
       * sentinels back for their original values and reports any sentinel
       * the model failed to preserve as a warning.
       */
      var tokenMap = [];
      // this.PLACEHOLDER_PATTERN (constants: below) is shared with
      // I18nHandler.applyTranslations, which re-derives the same sentinel
      // spans from a translation (via extractPlaceholders_'s exec-in-a-loop,
      // then indexOf against each offered translation) to verify none were
      // lost — one regex, so the two can't drift apart. The constant is
      // deliberately NON-global (no 'g' flag) so a caller building its own
      // 'g' RegExp from .source (as extractPlaceholders_ and THIS site both
      // do) can never be corrupted by another caller's stale lastIndex on
      // the shared instance. THIS site needs a 'g' matcher (text.replace()
      // below matches every occurrence), so it builds its own RegExp from
      // .source rather than mutating — or being handed — the shared instance.
      var pattern = new RegExp(this.PLACEHOLDER_PATTERN.source, 'g');

      var protectedText = text.replace(pattern, function(value) {
        var token = '__FOAM_I18N_TOKEN_' + tokenMap.length + '__';
        tokenMap.push({ token: token, value: value });
        return token;
      });

      return {
        protectedText: protectedText,
        restore: function(translated) {
          var restored = translated.trim();
          var warnings = [];

          for ( var i = 0 ; i < tokenMap.length ; i++ ) {
            var token = tokenMap[i].token, value = tokenMap[i].value;
            if ( restored.indexOf(token) === -1 ) {
              warnings.push('Model output did not preserve token ' + token + ' for ' + value);
              continue;
            }
            restored = restored.split(token).join(value);
          }

          return { text: restored, warnings: warnings };
        }
      };
    },

    function buildPrompt_(params) {
      // TranslateGemma is sensitive to the documented prompt shape. Keep the
      // final two blank lines immediately before the source text, and never
      // put context or tool instructions after "Please translate..."; the
      // model may translate them as if they were source text.
      var specialization = params.context ? ' specializing in ' + params.context : '';

      return [
        'You are a professional ' + params.sourceLanguage + ' (' + params.sourceCode + ') to ' +
          params.targetLanguage + ' (' + params.targetCode + ') translator' + specialization +
          '. Your goal is to accurately convey the meaning and nuances of the original ' +
          params.sourceLanguage + ' text while adhering to ' + params.targetLanguage +
          ' grammar, vocabulary, and cultural sensitivities.',
        'Produce only the ' + params.targetLanguage + ' translation, without any additional ' +
          'explanations or commentary. Please translate the following ' + params.sourceLanguage +
          ' text into ' + params.targetLanguage + ':',
        '',
        '',
        params.text
      ].join('\n');
    },

    function removePromptLeakage_(text) {
      /**
       * Some models echo back part of the instruction prompt instead of (or
       * before) the translation. When the output looks like it starts with
       * one of the known instruction prefixes AND contains a blank-line
       * paragraph break, keep only the last paragraph (the actual
       * translation) and warn — rather than returning the leaked prompt
       * text as if it were the translation.
       */
      var warnings = [];
      var cleaned = text.trim();

      var leakagePatterns = [
        /^Domain\/context\s*:/im,
        /^Domaine\/contexte\s*:/im,
        /^Preserve placeholders/im,
        /^Conserver (?:exactement )?(?:les )?marqueurs/im,
        /^Produce only the /im,
        /^You are a professional /im
      ];

      var leaked = leakagePatterns.some(function(pattern) { return pattern.test(cleaned); });
      if ( leaked && cleaned.indexOf('\n\n') !== -1 ) {
        var parts = cleaned.split(/\n\s*\n/).map(function(part) { return part.trim(); }).
          filter(function(part) { return !! part; });
        var last = parts[parts.length - 1];
        if ( last && last !== cleaned ) {
          cleaned = last;
          warnings.push('Removed apparent prompt/instruction leakage from model output; review translation.');
        }
      }

      return { text: cleaned, warnings: warnings };
    },

    function languageName_(codeOrName, fallback) {
      if ( ! codeOrName ) return fallback;
      var name = this.LANGUAGE_NAMES[codeOrName];
      return name === undefined ? codeOrName : name;
    }
  ],

  constants: {
    // No 'g' flag here on purpose — a global regex carries mutable
    // lastIndex state across calls, which would corrupt a caller matching
    // repeatedly against this shared instance (e.g. I18nHandler's
    // extractPlaceholders_, which exec()s it in a loop to validate every
    // placeholder in a translation via indexOf). Callers that need a 'g'
    // matcher (protectText_ above, extractPlaceholders_) build their own
    // RegExp from .source rather than sharing this instance.
    PLACEHOLDER_PATTERN: /\$\{[^}]+\}|\{\d+\}|%[sdifjoO]|<\/?[A-Za-z][^>]*>|&[A-Za-z0-9#]+;/,

    LANGUAGE_NAMES: {
      en: 'English',
      fr: 'French',
      es: 'Spanish',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      nl: 'Dutch',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese',
      'zh-Hans': 'Chinese',
      'zh-Hant': 'Chinese',
      ar: 'Arabic',
      hi: 'Hindi',
      ru: 'Russian'
    }
  }
});
