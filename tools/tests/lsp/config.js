/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Split from testFoamLSP.js — FeatureConfig tests.
// Shared harness (test/section + boot-time handlers) is required once
// by the entrypoint; this module reads its own copy.
//
// Pure module tests — FeatureConfig is a plain Node module (not foam.CLASS),
// so this category needs none of the pmake-booted FOAM instances the other
// categories share; it only borrows test()/section() from the harness.

var h = require('./_harness');
var test = h.test, section = h.section;

var FeatureConfig = require('../../lsp/FeatureConfig');
var fs = require('fs'), path = require('path'), os = require('os');

section('FeatureConfig — defaults');

var c = FeatureConfig.load({ rootPath: os.tmpdir() + '/no-such-dir-xyz' });
test(c.enabled('diagnostics.i18n') === true, 'default on');
test(c.enabled('codeLens.hierarchy') === false, 'hierarchy default off');
test(c.warnings.length === 0, 'no warnings on missing file');

section('FeatureConfig — foam-lsp.json overrides defaults');

var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flsp-'));
fs.writeFileSync(path.join(dir, 'foam-lsp.json'),
  JSON.stringify({ features: { 'diagnostics.i18n': false, 'codeLens.hierarchy': true } }));
c = FeatureConfig.load({ rootPath: dir });
test(c.enabled('diagnostics.i18n') === false, 'file overrides default');
test(c.enabled('codeLens.hierarchy') === true, 'file can enable');

section('FeatureConfig — initOptions override file');

c = FeatureConfig.load({ rootPath: dir,
  initOptions: { features: { 'diagnostics.i18n': true } } });
test(c.enabled('diagnostics.i18n') === true, 'initOptions beat file');
test(c.enabled('codeLens.hierarchy') === true, 'file survives where initOptions silent');

section('FeatureConfig — unknown keys warn once, ignored');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'),
  JSON.stringify({ features: { notAFlag: true } }));
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.some(function(w) { return w.indexOf('notAFlag') !== -1; }), 'unknown key warned');
test(c.enabled('hover') === true, 'defaults intact after unknown key');

section('FeatureConfig — unknown key via initOptions warns once, ignored');

// Reset the file back to something benign so this section's warnings are
// only about the initOptions path under test — otherwise the leftover
// notAFlag file from the previous section would add its own unrelated
// warning here (harmless to the assertion below, which only checks for
// 'alsoNotAFlag', but muddies what this section is meant to demonstrate).
fs.writeFileSync(path.join(dir, 'foam-lsp.json'), JSON.stringify({}));
c = FeatureConfig.load({ rootPath: dir, initOptions: { features: { alsoNotAFlag: true } } });
test(c.warnings.some(function(w) { return w.indexOf('alsoNotAFlag') !== -1; }), 'unknown initOptions key warned');
test(c.enabled('hover') === true, 'defaults intact after unknown initOptions key');

section('FeatureConfig — non-boolean feature value coerces to false');

c = FeatureConfig.load({ rootPath: dir, initOptions: { features: { hover: 'yes' } } });
test(c.enabled('hover') === false, 'non-boolean value coerces to false, not truthy-passthrough');

section('FeatureConfig — malformed JSON warns + falls back to defaults');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'), '{ nope');
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.length === 1 && c.enabled('completion') === true, 'malformed -> defaults + warning');

section('FeatureConfig — valid JSON that is not an object warns + falls back to defaults');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'), '[1,2]');
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.length === 1 && c.enabled('completion') === true, 'non-object JSON -> defaults + warning');

section('FeatureConfig — JSON literal null warns + falls back to defaults');

// `null` parses successfully (unlike '{ nope') but is not an object either
// (unlike '[1,2]', it can't even be told apart from "parse failed" by a
// `parsed !== null` check) — must land in the same non-object warn path.
fs.writeFileSync(path.join(dir, 'foam-lsp.json'), 'null');
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.length === 1 && c.enabled('completion') === true, 'null literal -> defaults + warning');

section('FeatureConfig — i18n section merges through the same layers');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'),
  JSON.stringify({ i18n: { languages: ['fr'], model: 'm1' } }));
c = FeatureConfig.load({ rootPath: dir, initOptions: { i18n: { model: 'm2' } } });
test(c.i18n.model === 'm2' && (c.i18n.languages || [])[0] === 'fr', 'i18n per-key precedence');

// --- server.js wiring, driven in-process --------------------------------
// The merge above is pure; what it CONTROLS is not. Capability gating lives
// in the initialize response and the diagnostics guards live on the
// publishDiagnostics path, so both are only reachable by booting server.js
// and talking real JSON-RPC to it — the same in-process lane the i18n
// category uses for workspace/executeCommand (tools/tests/lsp/i18n.js).
//
// Two phases, two server instances: phase 1 turns providers OFF and phase 2
// leaves them at their defaults, so every assertion has its own control —
// an omitted capability in phase 1 is only meaningful because phase 2 shows
// the same capability present when the flag is on.

// A view with both diagnostics under test in one file: a hardcoded display
// string (diagnostics.i18n) and a wrong-package javaImport (diagnostics.java).
var TARGET_MODEL = [
  'foam.CLASS({',
  "  package: 'test.cfg',",
  "  name: 'CfgToggleTarget',",
  "  javaImports: [ 'foam.nanos.logger.Logger' ],",
  '  methods: [',
  '    function render() {',
  "      this.start().add('Save changes').end();",
  '    }',
  '  ]',
  '});',
  ''
].join('\n');

var bootDone = h.withServerLane(async function() {
  var origWrite = process.stdout.write;
  var tmpFile   = null;
  try {
    // --- capture the server's stdout as parsed JSON-RPC messages ----------
    var frames = [];
    var inBuf  = Buffer.alloc(0);
    function drain() {
      while ( true ) {
        var headerEnd = inBuf.indexOf('\r\n\r\n');
        if ( headerEnd === -1 ) return;
        var m = /Content-Length:\s*(\d+)/i.exec(inBuf.slice(0, headerEnd).toString('utf8'));
        if ( ! m ) { inBuf = inBuf.slice(headerEnd + 4); continue; }
        var len = parseInt(m[1], 10), bodyStart = headerEnd + 4;
        if ( inBuf.length < bodyStart + len ) return;
        var body = inBuf.slice(bodyStart, bodyStart + len).toString('utf8');
        inBuf = inBuf.slice(bodyStart + len);
        try { frames.push(JSON.parse(body)); } catch (e) {}
      }
    }
    process.stdout.write = function(chunk) {
      inBuf = Buffer.concat([ inBuf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8') ]);
      drain();
      return true;
    };

    function sendToServer(msg) {
      var json = JSON.stringify(msg);
      process.stdin.emit('data', Buffer.from(
        'Content-Length: ' + Buffer.byteLength(json) + '\r\n\r\n' + json, 'utf8'));
    }
    function waitFor(pred, what) {
      return new Promise(function(resolve, reject) {
        var deadline = Date.now() + 20000;
        (function poll() {
          for ( var i = 0 ; i < frames.length ; i++ ) if ( pred(frames[i]) ) return resolve(frames[i]);
          if ( Date.now() > deadline ) return reject(new Error('timed out waiting for ' + what));
          setTimeout(poll, 10);
        })();
      });
    }
    function bootServer() {
      // Only one instance may hold the stdin 'data' listener, or every
      // message would reach both and each would answer it.
      process.stdin.removeAllListeners('data');
      require('../../lsp/server').start();
      // start() installs stdin 'end' -> process.exit(0), correct for a real
      // LSP process but fatal in-process: EOF on the runner's own stdin would
      // exit the whole run green with every later test silently skipped.
      process.stdin.removeAllListeners('end');
      frames = [];
      inBuf  = Buffer.alloc(0);
    }

    // The workspace root doubles as the foam-lsp.json lookup dir, so point it
    // at an empty temp dir — this test is about the initOptions layer, and a
    // foam-lsp.json in the real checkout must not be able to change its result.
    var wsDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'flsp-ws-'));
    tmpFile    = path.join(wsDir, 'CfgToggleTarget.js');
    fs.writeFileSync(tmpFile, TARGET_MODEL);
    var uri    = 'file://' + tmpFile;
    var wsUri  = 'file://' + wsDir;

    section('server.js — feature flags off gate capabilities and diagnostics');

    bootServer();
    sendToServer({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      rootUri: wsUri,
      initializationOptions: { foam: { features: {
        hover: false, semanticTokens: false, signatureHelp: false,
        folding: false, 'diagnostics.i18n': false } } } } });
    var offRes = await waitFor(function(f) { return f.id === 1 && f.result; }, 'the initialize response');
    var offCaps = offRes.result.capabilities;
    test(offCaps.hoverProvider === undefined,          'hover: false omits hoverProvider');
    test(offCaps.semanticTokensProvider === undefined, 'semanticTokens: false omits semanticTokensProvider');
    test(offCaps.signatureHelpProvider === undefined,  'signatureHelp: false omits signatureHelpProvider');
    test(offCaps.foldingRangeProvider === undefined,   'folding: false omits foldingRangeProvider');
    test(!! offCaps.completionProvider, 'a flag left at its default keeps its capability (completion)');
    test(!! offCaps.executeCommandProvider,
      'executeCommandProvider is unconditional — commands guard themselves');

    sendToServer({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri: uri, languageId: 'javascript', version: 1, text: TARGET_MODEL } } });
    var offDiag = await waitFor(function(f) {
      return f.method === 'textDocument/publishDiagnostics' && f.params.uri === uri;
    }, 'publishDiagnostics with diagnostics.i18n off');
    var offCodes = offDiag.params.diagnostics.map(function(d) { return d.code; });
    var offMsgs  = offDiag.params.diagnostics.map(function(d) { return d.message; });
    test(offCodes.indexOf('i18n-hardcoded-display-string') === -1,
      'diagnostics.i18n: false suppresses the hardcoded-display-string WARNING');
    test(offMsgs.some(function(m) { return /Wrong Java package/.test(m); }),
      'diagnostics.java (left on) still reports the wrong-package javaImport');

    section('server.js — the same file with every flag at its default');

    bootServer();
    sendToServer({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {
      rootUri: wsUri,
      initializationOptions: { foam: { features: { 'diagnostics.java': false } } } } });
    var onRes = await waitFor(function(f) { return f.id === 2 && f.result; }, 'the second initialize response');
    var onCaps = onRes.result.capabilities;
    test(onCaps.hoverProvider === true && !! onCaps.semanticTokensProvider &&
         !! onCaps.signatureHelpProvider && onCaps.foldingRangeProvider === true,
      'defaults keep every provider phase 1 omitted — the omission came from the flag');

    sendToServer({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {
      textDocument: { uri: uri, languageId: 'javascript', version: 1, text: TARGET_MODEL } } });
    var onDiag = await waitFor(function(f) {
      return f.method === 'textDocument/publishDiagnostics' && f.params.uri === uri;
    }, 'publishDiagnostics with diagnostics.java off');
    var onCodes = onDiag.params.diagnostics.map(function(d) { return d.code; });
    var onMsgs  = onDiag.params.diagnostics.map(function(d) { return d.message; });
    test(onCodes.indexOf('i18n-hardcoded-display-string') !== -1,
      'diagnostics.i18n at its default still reports the hardcoded display string');
    test(! onMsgs.some(function(m) { return /Wrong Java package/.test(m); }),
      'diagnostics.java: false suppresses the wrong-package javaImport ERROR');
  } catch (e) {
    test(false, 'server feature-toggle boot test threw: ' + ( e && e.stack ? e.stack : e ));
  } finally {
    process.stdout.write = origWrite;
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('end');
    process.stdin.pause();
    if ( tmpFile ) { try { fs.unlinkSync(tmpFile); } catch (e) {} }
  }
});

module.exports = { done: bootDone };
