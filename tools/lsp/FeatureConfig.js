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
    features[key] = src[key] === true;
  });
}

// Per-key merge for the i18n section: later layers win key-by-key, but an
// earlier layer's key survives when a later layer never mentions it (mirrors
// Object.assign semantics, skipping `undefined` so a layer that names a key
// without setting it can't blank out an earlier value).
function applyI18n(i18n, src) {
  if ( ! src || typeof src !== 'object' ) return;
  Object.keys(src).forEach(function(key) {
    if ( src[key] !== undefined ) i18n[key] = src[key];
  });
}

function load(opts) {
  opts = opts || {};

  var features = Object.assign({}, DEFAULTS);
  var i18n = {};
  var warnings = [];

  // Layer 2: foam-lsp.json at the workspace root.
  if ( opts.rootPath ) {
    var configPath = path.join(opts.rootPath, 'foam-lsp.json');
    if ( fs.existsSync(configPath) ) {
      try {
        var raw = fs.readFileSync(configPath, 'utf8');
        var parsed = JSON.parse(raw);
        applyFeatures(features, parsed.features, warnings);
        applyI18n(i18n, parsed.i18n);
      } catch (e) {
        warnings.push('Failed to parse foam-lsp.json: ' + e.message);
      }
    }
  }

  // Layer 3: initOptions from the LSP client.
  if ( opts.initOptions ) {
    applyFeatures(features, opts.initOptions.features, warnings);
    applyI18n(i18n, opts.initOptions.i18n);
  }

  return {
    features: features,
    i18n: i18n,
    warnings: warnings,
    enabled: function(flag) { return features[flag] === true; }
  };
}

module.exports = { load: load, DEFAULTS: DEFAULTS };
