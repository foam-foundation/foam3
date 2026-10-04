/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Single logging idiom for degraded-but-not-fatal LSP failures. Everything
 * that catches an error and falls back MUST leave this trace — a broken
 * feature must never be indistinguishable from an empty result.
 */
function logLspError(context, err) {
  console.error('[foam-lsp] ' + context + ': ' + (err && err.message ? err.message : String(err)));
}

module.exports = { logLspError: logLspError };
