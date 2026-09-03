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

section('FeatureConfig — non-boolean feature value coerces to false, and says so');

// The coercion is deliberate (a truthy passthrough would make the string
// "false" turn a flag ON), but silent coercion is what made it surprising:
// `"true"` and `1` are both easy to write by hand in JSON and both land on
// false. The warning names the flag AND the value that was thrown away.
c = FeatureConfig.load({ rootPath: dir, initOptions: { features: { hover: 'yes' } } });
test(c.enabled('hover') === false, 'non-boolean value coerces to false, not truthy-passthrough');
test(c.warnings.some(function(w) { return /non-boolean value for "hover"/.test(w); }),
  'the coercion is warned about, not silent');
test(c.warnings.some(function(w) { return w.indexOf('"yes"') !== -1; }),
  'the warning quotes the offending value');

c = FeatureConfig.load({ rootPath: dir, initOptions: { features: { hover: 'true' } } });
test(c.enabled('hover') === false && c.warnings.length === 1,
  'the string "true" is the trap this warning exists for — false, with a warning');

c = FeatureConfig.load({ rootPath: dir, initOptions: { features: { hover: false } } });
test(c.enabled('hover') === false && c.warnings.length === 0,
  'a real boolean false is not a warning (control)');

section('FeatureConfig — unknown i18n keys warn + are dropped');

// Same treatment the boolean flags already got. An unrecognised i18n key
// carried forward would reach server.js as a value nothing reads — which
// looks, from the user's side, like their setting was ignored for no reason.
fs.writeFileSync(path.join(dir, 'foam-lsp.json'),
  JSON.stringify({ i18n: { langauges: ['fr'], model: 'm1' } }));
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.some(function(w) { return w.indexOf('langauges') !== -1; }),
  'a typo\'d i18n key from foam-lsp.json is warned about');
test(c.i18n.langauges === undefined, 'the typo\'d key is not carried into the merged i18n');
test(c.i18n.model === 'm1', 'the sibling key on the same layer still applies');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'), JSON.stringify({}));
c = FeatureConfig.load({ rootPath: dir, initOptions: { i18n: { endpiont: 'http://x' } } });
test(c.warnings.some(function(w) { return w.indexOf('endpiont') !== -1; }),
  'a typo\'d i18n key from initOptions is warned about too');
test(c.i18n.endpiont === undefined, 'and dropped');

c = FeatureConfig.load({ rootPath: dir, initOptions: { i18n: {
  languages: ['fr'], endpoint: 'http://x', model: 'm', sourceLanguage: 'en' } } });
test(c.warnings.length === 0, 'every known i18n key passes without a warning (control)');

section('FeatureConfig — enabled() on a name that is not a flag warns once');

// Misuse guard for FUTURE handlers, not for user config: only a caller typo
// in our own code can reach it, and it would otherwise answer a silent,
// permanent false — a feature that quietly never runs.
c = FeatureConfig.load({ rootPath: os.tmpdir() + '/no-such-dir-xyz' });
var errs = [];
var origErr = console.error;
var misuseAnswer;
// Nothing that reports a result may run while console.error is swapped out —
// the harness's own test() writes its ✓/✘ lines through console.error, so a
// test() call inside this window would land in `errs` and be counted as a
// warning the config emitted.
console.error = function(m) { errs.push(String(m)); };
try {
  misuseAnswer = c.enabled('codelens.i18n');
  c.enabled('codelens.i18n');
} finally {
  console.error = origErr;
}
test(misuseAnswer === false, 'a misspelled flag still answers false');
test(errs.length === 1, 'the misuse is reported exactly once, not once per call');
test(errs.length === 1 && errs[0].indexOf('codelens.i18n') !== -1, 'and it names the bad flag');

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

    // Every boot-progress frame on the token this server uses. Declared once
    // — three separate phases below ask "did anything arrive on foam-boot?",
    // and each has a different right answer.
    function isBootProgress(f) {
      return f.method === '$/progress' && f.params && f.params.token === 'foam-boot';
    }
    function bootCreateFrames() {
      return frames.filter(function(f) {
        return f.method === 'window/workDoneProgress/create' &&
               f.params && f.params.token === 'foam-boot';
      });
    }

    section('server.js — feature flags off gate capabilities and diagnostics');

    bootServer();
    sendToServer({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      rootUri: wsUri,
      // A client that DECLARES window.workDoneProgress — the only kind that
      // may be sent these frames at all. Phase 3 below is the same boot
      // without the declaration.
      capabilities: { window: { workDoneProgress: true } },
      initializationOptions: { foam: { features: {
        hover: false, semanticTokens: false, signatureHelp: false,
        folding: false, 'diagnostics.i18n': false,
        'codeLens.i18n': false, 'codeLens.hierarchy': false } } } } });
    var offRes = await waitFor(function(f) { return f.id === 1 && f.result; }, 'the initialize response');
    var offCaps = offRes.result.capabilities;
    test(offCaps.hoverProvider === undefined,          'hover: false omits hoverProvider');
    test(offCaps.semanticTokensProvider === undefined, 'semanticTokens: false omits semanticTokensProvider');
    test(offCaps.signatureHelpProvider === undefined,  'signatureHelp: false omits signatureHelpProvider');
    test(offCaps.foldingRangeProvider === undefined,   'folding: false omits foldingRangeProvider');
    test(offCaps.codeLensProvider === undefined,
      'codeLens.i18n: false + codeLens.hierarchy: false (its own default) omits codeLensProvider');
    test(!! offCaps.completionProvider, 'a flag left at its default keeps its capability (completion)');
    test(!! offCaps.executeCommandProvider,
      'executeCommandProvider is unconditional — commands guard themselves');

    section('server.js — boot progress via workDoneProgress');

    // Ordering is checked against positions in the raw `frames` array (this
    // phase's boot only — bootServer() reset it to [] just before phase 1),
    // not against timing.
    var initRespIdx = frames.indexOf(offRes);
    var createFrame = await waitFor(function(f) {
      return f.method === 'window/workDoneProgress/create' &&
             f.params && f.params.token === 'foam-boot';
    }, 'the workDoneProgress/create request');
    test(createFrame.id >= 1000000,
      'the create request id comes from the outbound id space (>= 1000000)');
    test(frames.indexOf(createFrame) > initRespIdx,
      'workDoneProgress/create is sent after the initialize response, not before');

    // The single most important frame-ordering rule here: the token is not
    // ours to use until the client ANSWERS the create request, so nothing may
    // have arrived on it yet. This is what the create request is for.
    test(frames.filter(isBootProgress).length === 0,
      'no $/progress frame arrives before the client answers workDoneProgress/create');

    sendToServer({ jsonrpc: '2.0', id: createFrame.id, result: null });
    await waitFor(function(f) {
      return isBootProgress(f) && f.params.value.kind === 'end';
    }, 'the end $/progress frame');

    var progressFrames = frames.filter(isBootProgress);
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

    // The report frame is a boot SUMMARY, not progress against remaining work
    // — indexing finished before initialize was even dispatched. Asserting the
    // class count is in it pins that intent.
    var reportFrame = progressFrames.filter(function(f) {
      return f.params.value.kind === 'report';
    })[0];
    test(!! reportFrame && /indexing \d+ classes/.test(reportFrame.params.value.message || ''),
      'a report frame names the indexed class count');

    var progressIdxs = progressFrames.map(function(f) { return frames.indexOf(f); });
    test(progressIdxs.length > 0 && Math.min.apply(null, progressIdxs) > frames.indexOf(createFrame),
      'the whole progress sequence arrives after the create request');

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

    section('server.js — codeLensProvider tracks the lens COUPLING, not just codeLens.i18n');

    // codeLens.i18n on, but hints.i18nMissingLanguage off (which withdraws the
    // i18n lens) and codeLens.hierarchy at its false default: both lenses are
    // dead, so advertising the capability would buy a textDocument/codeLens
    // round trip per open file, every one answered with [].
    bootServer();
    sendToServer({ jsonrpc: '2.0', id: 8, method: 'initialize', params: {
      rootUri: wsUri,
      initializationOptions: { foam: { features: {
        'hints.i18nMissingLanguage': false } } } } });   // codeLens.i18n left at its default (on)
    var deadLensRes = await waitFor(function(f) { return f.id === 8 && f.result; },
      'the dead-lens initialize response');
    test(deadLensRes.result.capabilities.codeLensProvider === undefined,
      'codeLens.i18n on but hints off + hierarchy off omits codeLensProvider');

    // Same flags, hierarchy turned on — the capability comes back, proving the
    // omission above came from the coupling and not from something else.
    bootServer();
    sendToServer({ jsonrpc: '2.0', id: 9, method: 'initialize', params: {
      rootUri: wsUri,
      initializationOptions: { foam: { features: {
        'hints.i18nMissingLanguage': false, 'codeLens.hierarchy': true } } } } });
    var hierOnlyRes = await waitFor(function(f) { return f.id === 9 && f.result; },
      'the hierarchy-only initialize response');
    test(!! hierOnlyRes.result.capabilities.codeLensProvider,
      'the hierarchy lens alone still earns codeLensProvider (control)');

    section('server.js — a client without window.workDoneProgress gets nothing');

    // Not "no frames on an unaccepted token" — no CREATE REQUEST EITHER. A
    // client that never declared the capability has nowhere to route any of
    // this, so asking it to make a token is itself the protocol violation.
    bootServer();
    sendToServer({ jsonrpc: '2.0', id: 10, method: 'initialize', params: {
      rootUri: wsUri, capabilities: { window: {} } } });
    await waitFor(function(f) { return f.id === 10 && f.result; }, 'the no-capability initialize response');
    // The initialize handler emits everything it is going to emit inside one
    // synchronous dispatch, so once its response is in hand a single further
    // turn of the loop is enough to catch anything it queued behind it.
    await new Promise(function(r) { setTimeout(r, 50); });
    test(bootCreateFrames().length === 0,
      'no window/workDoneProgress/create for a client that did not declare the capability');
    test(frames.filter(isBootProgress).length === 0,
      'no $/progress frames either');

    section('server.js — a client that REJECTS create gets no progress frames');

    bootServer();
    sendToServer({ jsonrpc: '2.0', id: 11, method: 'initialize', params: {
      rootUri: wsUri, capabilities: { window: { workDoneProgress: true } } } });
    await waitFor(function(f) { return f.id === 11 && f.result; }, 'the rejecting-client initialize response');
    var rejectCreate = await waitFor(function(f) {
      return f.method === 'window/workDoneProgress/create' &&
             f.params && f.params.token === 'foam-boot';
    }, 'the create request to reject');
    sendToServer({ jsonrpc: '2.0', id: rejectCreate.id,
      error: { code: -32601, message: 'workDoneProgress/create not supported' } });
    await new Promise(function(r) { setTimeout(r, 50); });
    test(frames.filter(isBootProgress).length === 0,
      'a rejected create yields no $/progress frames at all (the .catch only logs)');

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
    test(!! onCaps.codeLensProvider,
      'codeLens.i18n at its default (on) keeps codeLensProvider even with codeLens.hierarchy left off');

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

// ---- settings contract: the VS Code manifest and FeatureConfig.DEFAULTS
// must declare the SAME flag set. The extension derives its forwarding
// from manifest keys and the server validates against DEFAULTS — a flag
// present on one side only is either invisible in the settings UI or an
// "unknown flag" warning for every user. (Review follow-up M10.)
(function() {
  var section = h.section, test = h.test;
  section('FeatureConfig <-> VS Code manifest contract');

  var FeatureConfig = require('../../lsp/FeatureConfig');
  var manifest = JSON.parse(require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', 'lsp', 'editors', 'vscode', 'package.json'), 'utf8'));
  var props = ( manifest.contributes &&
                manifest.contributes.configuration &&
                manifest.contributes.configuration.properties ) || {};

  var manifestFlags = Object.keys(props)
    .filter(function(k) { return k.indexOf('foam.features.') === 0; })
    .map(function(k) { return k.substring('foam.features.'.length); })
    .sort();
  var defaultFlags = Object.keys(FeatureConfig.DEFAULTS).sort();

  test(manifestFlags.join(',') === defaultFlags.join(','),
    'manifest foam.features.* keys == FeatureConfig.DEFAULTS keys — got [' +
    manifestFlags + '] vs [' + defaultFlags + ']');

  manifestFlags.forEach(function(flag) {
    var p = props['foam.features.' + flag];
    test(p.type === 'boolean' && p.default === FeatureConfig.DEFAULTS[flag],
      'manifest default for ' + flag + ' matches DEFAULTS');
    test(/Takes effect after a server restart\.$/.test(p.description || ''),
      'description for ' + flag + ' carries the restart note');
  });
})();

module.exports = { done: bootDone };
