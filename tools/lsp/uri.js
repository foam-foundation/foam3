/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * The one file:// URI -> filesystem path conversion for server.js and the
 * handlers. Each used to write its own copy, and copies drift: one decodes
 * `%20`, the next forgets to, and the same file then reads as two paths.
 * Anything that is not a file:// URI is returned unchanged. Like
 * decodeURIComponent itself, a malformed escape (a stray '%') throws.
 */
function uriToPath(uri) {
  if ( ! uri ) return null;
  if ( uri.indexOf('file://') === 0 ) return decodeURIComponent(uri.substring(7));
  return uri;
}

module.exports = { uriToPath: uriToPath };
