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

section('hints.i18nMissingLanguage — gates the HINT and the two translate actions');

// Handler-level, no server boot needed: both consumers take the config as a
// plain property, so the flag is exercised by constructing them directly.
//
// The fixture carries BOTH i18n diagnostics — a `messages:` entry with no
// messageMap (missing fr) and a hardcoded .add() string — so the hardcoded
// WARNING and its plain extract action double as the control: they must
// SURVIVE the flag being off. That is what proves this flag is narrow and
// not just "all i18n output".
var HINTS_SRC = [
  'foam.CLASS({',
  "  package: 'test.cfg',",
  "  name: 'CfgHintTarget',",
  '  messages: [',
  "    { name: 'DONE', message: 'Done' }",
  '  ],',
  '  methods: [',
  '    function render() {',
  "      this.start().add('Save changes').end();",
  '    }',
  '  ]',
  '});',
  ''
].join('\n');
var hintsUri = 'file:///t/CfgHintTarget.js';

// translationReady/activeModel stand in for a probed provider (the real probe
// is HTTP; I18nHandler only reads these two flags), so the translate actions
// clear their OTHER preconditions and the flag is the only variable left.
function hintsI18nHandler() {
  return foam.parse.lsp.handlers.I18nHandler.create({
    index: h.index, cache: h.cache,
    targetLanguages: ['fr'], translationReady: true, activeModel: 'stub-model'
  });
}
function hintsConfig(on) {
  return FeatureConfig.load({ initOptions: { features: { 'hints.i18nMissingLanguage': on } } });
}
function hintsDiags(on) {
  return foam.parse.lsp.handlers.DiagnosticsHandler.create({
    index: h.index, cache: h.cache,
    i18nHandler: hintsI18nHandler(), featureConfig: hintsConfig(on)
  }).handle(HINTS_SRC, hintsUri);
}
function codesOf(ds) { return ds.map(function(d) { return d.code; }); }

var hintsOnDiags  = hintsDiags(true);
var hintsOffDiags = hintsDiags(false);
test(codesOf(hintsOnDiags).indexOf('i18n-missing-language') !== -1,
  'control: flag on → the missing-fr HINT is emitted');
test(codesOf(hintsOffDiags).indexOf('i18n-missing-language') === -1,
  'hints.i18nMissingLanguage: false suppresses the missing-language HINT');
test(codesOf(hintsOffDiags).indexOf('i18n-hardcoded-display-string') !== -1,
  'the flag is narrow — the hardcoded-string WARNING survives it');

// Both code-action runs are fed the SAME diagnostics (the flag-on set, which
// carries both codes), so any difference in the offered actions comes from
// the flag and not from a thinner diagnostic list.
function hintsActions(on) {
  return foam.parse.lsp.handlers.CodeActionHandler.create({
    index: h.index, cssTokenResolver: h.cssTokenResolver,
    i18nHandler: hintsI18nHandler(), featureConfig: hintsConfig(on)
  }).handle(HINTS_SRC, null, { diagnostics: hintsOnDiags }, hintsUri);
}
function titles(as) { return as.map(function(a) { return a.title; }); }
var isActionC = function(t) { return /\+ translate to/.test(t); };            // extract AND translate
var isActionD = function(t) { return /^Translate '/.test(t); };              // translate missing language
var isActionA = function(t) { return /to a messages: entry$/.test(t); };     // plain extract (control)

var actionsOn  = titles(hintsActions(true));
var actionsOff = titles(hintsActions(false));
test(actionsOn.some(isActionC), 'control: flag on → action C (extract + translate) is offered');
test(actionsOn.some(isActionD), 'control: flag on → action D (translate missing language) is offered');
test(! actionsOff.some(isActionC), 'hints.i18nMissingLanguage: false withdraws action C');
test(! actionsOff.some(isActionD), 'hints.i18nMissingLanguage: false withdraws action D');
test(actionsOff.some(isActionA),
  'the flag withdraws only the translate offers — plain extraction stays available');

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
  var wsDir     = null;   // declared here so the finally can remove it whatever fails
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
    wsDir      = fs.mkdtempSync(path.join(os.tmpdir(), 'flsp-ws-'));
    var tmpFile = path.join(wsDir, 'CfgToggleTarget.js');
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

    section('server.js — boot progress via workDoneProgress');

    // Ordering is checked against positions in the raw `frames` array (this
    // phase's boot only — bootServer() reset it to [] just before phase 1),
    // not against timing, since everything the initialize handler sends is
    // synchronous within one JS tick.
    var initRespIdx = frames.indexOf(offRes);
    var createFrame = frames.filter(function(f) {
      return f.method === 'window/workDoneProgress/create' &&
             f.params && f.params.token === 'foam-boot';
    })[0];
    test(!! createFrame, 'window/workDoneProgress/create is sent for token foam-boot');
    test(!! createFrame && createFrame.id >= 1000000,
      'the create request id comes from the outbound id space (>= 1000000)');
    test(!! createFrame && frames.indexOf(createFrame) > initRespIdx,
      'workDoneProgress/create is sent after the initialize response, not before');

    var progressFrames = frames.filter(function(f) {
      return f.method === '$/progress' && f.params && f.params.token === 'foam-boot';
    });
    var kinds = progressFrames.map(function(f) { return f.params.value.kind; });
    test(kinds.length >= 2, 'at least a begin and an end $/progress frame arrive');
    test(kinds[0] === 'begin', 'the sequence opens with kind begin');
    test(kinds[kinds.length - 1] === 'end', 'the sequence closes with kind end');
    test(kinds.slice(1, -1).every(function(k) { return k === 'report'; }),
      'every frame between begin and end is a report');

    var beginFrame = progressFrames[0];
    test(!! beginFrame && beginFrame.params.value.title === 'FOAM LSP',
      'begin carries title "FOAM LSP"');
    test(!! beginFrame && typeof beginFrame.params.value.message === 'string' &&
      beginFrame.params.value.message.length > 0, 'begin carries a loading message');

    var reportFrame = progressFrames.filter(function(f) {
      return f.params.value.kind === 'report';
    })[0];
    test(!! reportFrame && /indexing \d+ classes/.test(reportFrame.params.value.message || ''),
      'a report frame names the indexed class count');

    var progressIdxs = progressFrames.map(function(f) { return frames.indexOf(f); });
    test(progressIdxs.length > 0 && Math.min.apply(null, progressIdxs) > initRespIdx,
      'the whole progress sequence arrives after the initialize response');
    test(progressIdxs.length > 0 && Math.max.apply(null, progressIdxs) < frames.indexOf(offDiag),
      'the whole progress sequence completes before the first publishDiagnostics');

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
    // The whole mkdtemp'd workspace goes, not just the file inside it —
    // wsDir is created per run, so leaving it behind litters the temp dir.
    if ( wsDir ) { try { fs.rmSync(wsDir, { recursive: true, force: true }); } catch (e) {} }
  }
});

module.exports = { done: bootDone };
