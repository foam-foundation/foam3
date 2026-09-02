/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Plain Node module (NOT foam.CLASS) — server.js and its handlers are plain
// Node consumers, so this stays a plain require() with no FOAM boot cost.
//
// Three-layer feature-toggle merge, lowest to highest precedence:
//   1. DEFAULTS (below)
//   2. foam-lsp.json at the workspace root (missing file: silent; malformed
//      JSON: one warning, falls back to defaults for this layer)
//   3. initOptions passed by the client at LSP initialize time
//
// Ruling R1: this module does NOT read env vars or locales.jrl — those
// fallbacks stay in server.js. FeatureConfig only merges the three layers
// above.

var fs = require('fs');
var path = require('path');

var DEFAULTS = Object.freeze({
  'diagnostics.java': true,
  'diagnostics.i18n': true,
  'hints.i18nMissingLanguage': true,
  'completion': true,
  'hover': true,
  'semanticTokens': true,
  'signatureHelp': true,
  'folding': true,
  'codeLens.i18n': true,
  'codeLens.hierarchy': false
});

// The i18n keys this module understands. Same role as DEFAULTS for the
// feature flags: it is what makes a typo ("langauges") visible instead of
// silently inert. No default VALUES here on purpose — every i18n key's
// fallback lives elsewhere (env vars and journals/locales.jrl in server.js,
// HttpChatProvider's own built-ins for endpoint/model), so this module only
// needs to know which names are legitimate.
var I18N_KEYS = Object.freeze([ 'languages', 'endpoint', 'model', 'sourceLanguage' ]);

// Merges `src.features` onto `features` in place, warning (once per call)
// about any key not present in DEFAULTS instead of silently accepting typos
// that would otherwise just never take effect.
function applyFeatures(features, src, warnings) {
  if ( ! src || typeof src !== 'object' ) return;
  Object.keys(src).forEach(function(key) {
    if ( ! DEFAULTS.hasOwnProperty(key) ) {
      warnings.push('Unknown feature flag "' + key + '" ignored');
      return;
    }
    // Coerce, but say so. `"true"` (a string, easy to write in JSON by hand)
    // and `1` both land on FALSE here — the strict `=== true` is deliberate,
    // since a truthy-passthrough would make `"false"` turn a flag ON. Silent
    // coercion is what made that surprising, so the value is named in a
    // warning while the coercion itself stands.
    if ( typeof src[key] !== 'boolean' ) {
      warnings.push('non-boolean value for "' + key + '" (' + JSON.stringify(src[key]) +
        ') — treated as false');
    }
    features[key] = src[key] === true;
  });
}

// Per-key merge for the i18n section: later layers win key-by-key, but an
// earlier layer's key survives when a later layer never mentions it (mirrors
// Object.assign semantics, skipping `undefined` so a layer that names a key
// without setting it can't blank out an earlier value).
//
// Unknown keys are warned-and-dropped, exactly as applyFeatures does for the
// boolean flags: carrying an unrecognised i18n key forward would hand
// server.js a value nothing reads, which reads as "my setting is ignored for
// no reason" from the user's side.
function applyI18n(i18n, src, warnings) {
  if ( ! src || typeof src !== 'object' ) return;
  Object.keys(src).forEach(function(key) {
    if ( I18N_KEYS.indexOf(key) === -1 ) {
      warnings.push('Unknown i18n setting "' + key + '" ignored');
      return;
    }
    if ( src[key] !== undefined ) i18n[key] = src[key];
  });
}

function load(opts) {
  opts = opts || {};

  var features = Object.assign({}, DEFAULTS);
  var i18n = {};
  var warnings = [];

  // Layer 2: foam-lsp.json at the workspace root. Read and parse share one
  // try so a missing file (ENOENT) stays silent — the common case, a
  // workspace with no config — while any OTHER read failure (EACCES,
  // EISDIR, ...) gets its own warning distinct from a parse failure: both
  // are "layer 2 contributed nothing", but only one of them means "there's
  // a real file here the admin should look at".
  if ( opts.rootPath ) {
    var configPath = path.join(opts.rootPath, 'foam-lsp.json');
    var raw = null;
    try {
      raw = fs.readFileSync(configPath, 'utf8');
    } catch (readErr) {
      if ( readErr.code !== 'ENOENT' ) {
        warnings.push('Failed to read foam-lsp.json: ' + readErr.message);
      }
    }
    if ( raw !== null ) {
      var parsed;
      var parseOk = true;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        parseOk = false;
        warnings.push('Failed to parse foam-lsp.json: ' + parseErr.message);
      }
      // Branch on parseOk, not `parsed !== null` — the literal JSON value
      // `null` parses successfully to `null`, which is itself not an
      // object, so it must fall into the same "not an object" warn path as
      // an array/number/string/boolean, not be skipped as if parsing failed.
      if ( parseOk ) {
        if ( parsed !== null && typeof parsed === 'object' && ! Array.isArray(parsed) ) {
          applyFeatures(features, parsed.features, warnings);
          applyI18n(i18n, parsed.i18n, warnings);
        } else {
          warnings.push('foam-lsp.json must be a JSON object; ignoring contents');
        }
      }
    }
  }

  // Layer 3: initOptions from the LSP client.
  if ( opts.initOptions ) {
    applyFeatures(features, opts.initOptions.features, warnings);
    applyI18n(i18n, opts.initOptions.i18n, warnings);
  }

  // Misuse guard for FUTURE handlers, not for user config: a flag name that
  // isn't in DEFAULTS can only come from a caller typo in our own code
  // (enabled('codelens.i18n') for 'codeLens.i18n'), and it would answer a
  // silent, permanent `false` — a feature that quietly never runs. Warned
  // once per name so a per-keystroke handler can't flood the log. Not pushed
  // into `warnings`: that array is the CONFIG's warnings, reported to the
  // user at initialize, and this is a developer-facing bug in the server.
  var badFlagsSeen = {};
  return {
    features: features,
    i18n: i18n,
    warnings: warnings,
    enabled: function(flag) {
      if ( ! DEFAULTS.hasOwnProperty(flag) && ! badFlagsSeen[flag] ) {
        badFlagsSeen[flag] = true;
        console.error('[LSP] config: enabled("' + flag + '") — no such feature flag; ' +
          'it will always answer false');
      }
      return features[flag] === true;
    }
  };
}

module.exports = { load: load, DEFAULTS: DEFAULTS, I18N_KEYS: I18N_KEYS };
