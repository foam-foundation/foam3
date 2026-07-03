/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Entry point for FOAM LSP server.
// Usage: node foam3/tools/lsp-start.js [pom-path]
//
// Uses pmake (same as build.sh) to correctly load all FOAM models,
// then starts the LSP JSON-RPC server on stdio.
//
// stdout = JSON-RPC channel, ALL logging goes to stderr.

// Redirect console.log to stderr BEFORE anything loads
console.log = function() { console.error.apply(console, arguments); };
console.warn = function() { console.error.apply(console, arguments); };

// Prevent unhandled rejections from crashing the process.
// Web-only code like JsLib.installLib() may reference 'document' which
// doesn't exist in Node.js — these are non-fatal for the LSP.
process.on('unhandledRejection', function(e) {
  console.error('[LSP] Ignoring unhandled rejection:', e.message || e);
});
process.on('uncaughtException', function(e) {
  // Ignore web-only errors (document, window, etc.)
  if ( e.message && ( e.message.includes('document') || e.message.includes('window') ) ) {
    console.error('[LSP] Ignoring web-only error:', e.message);
    return;
  }
  // Don't crash on syntax errors in loaded files — they're user's in-progress edits
  if ( e instanceof SyntaxError ) {
    console.error('[LSP] Ignoring SyntaxError in loaded file:', e.message);
    return;
  }
  // Log but don't crash — keep the server alive
  console.error('[LSP] Uncaught error (non-fatal):', e.message);
});

// Set globals that buildlib expects (normally set by build.js)
globalThis.SILENT  = false;
globalThis.VERBOSE = false;
globalThis.DRY_RUN = false;
globalThis.HELP    = false;
globalThis.NOP     = '';

var path_ = require('path');
var pmake = require('./pmake');
var buildlib = require('./buildlib');

// Override buildlib.error to not exit — keep LSP alive even if POM loading has errors
var origError = buildlib.error;
buildlib.error = function() {
  console.error('[LSP] Build error (non-fatal):', Array.prototype.join.call(arguments, ' '));
};

var pomPath = process.argv[2] || path_.join(process.cwd(), 'pom');

pmake.bind(buildlib, '-makers=LSP -pom=' + pomPath)();
