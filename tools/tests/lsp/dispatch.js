/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Server DISPATCH tests: spawn the real server.js and speak LSP over stdio.
// Handler-level tests walk in the back door (call handle() directly); these
// prove the front door routes there too. Exists because the pom-validation
// lane shipped fully unit-tested yet unreachable — didOpen's isFoamFile
// gate never sent a pom.js to the handler at all.

var h = require('./_harness');
var test = h.test, section = h.section;

var cp   = require('child_process');
var fs   = require('fs');
var os   = require('os');
var path = require('path');

section('server dispatch — pushDiagnostics routing over real stdio');

var root = fs.mkdtempSync(path.join(os.tmpdir(), 'lspd-'));
fs.writeFileSync(path.join(root, 'A.js'), '// exists\n');
var POM_URI   = 'file://' + path.join(root, 'pom.js');
var CLASS_URI = 'file://' + path.join(root, 'B.js');
var BAD_POM   = "foam.POM({\n  name: 'd',\n  files: [\n" +
  "    { name: 'A', flags: 'js |java' }\n  ]\n});\n";
var CLEAN_POM = BAD_POM.replace('js |java', 'js|java');
var CLASS_SRC = "foam.CLASS({\n  package: 'd',\n  name: 'B',\n  properties: [ 'p' ]\n});\n";
fs.writeFileSync(path.join(root, 'pom.js'), BAD_POM);

// The real entry point is lsp-start.js (server.js only exports start()) —
// same script the VS Code extension spawns, with the same [pomPath] arg:
// the boot pmake-loads FOAM through that pom, so it must be the repo's own
// pom (a bare fixture pom can't bootstrap foam.CLASS). One full server
// boot (~15-30s) is this category's price for testing the real wire.
var repoRoot   = path.join(__dirname, '..', '..', '..');
var serverPath = path.join(repoRoot, 'tools', 'lsp-start.js');
var child = cp.spawn(process.execPath, [ serverPath, path.join(repoRoot, 'pom') ], {
  cwd: repoRoot, stdio: [ 'pipe', 'pipe', 'ignore' ]
});

var nextId = 1;
function send(method, params, isRequest) {
  var msg = { jsonrpc: '2.0', method: method, params: params };
  if ( isRequest ) msg.id = nextId++;
  var body = JSON.stringify(msg);
  child.stdin.write('Content-Length: ' + Buffer.byteLength(body) + '\r\n\r\n' + body);
  return msg.id;
}

// Frame parser + waiters: waitFor(pred) resolves with the first decoded
// message matching pred (checks backlog first, so races can't drop one).
var backlog = [], waiters = [], buf = Buffer.alloc(0);
function deliver(m) {
  for ( var i = 0 ; i < waiters.length ; i++ ) {
    if ( waiters[i].pred(m) ) return waiters.splice(i, 1)[0].resolve(m);
  }
  backlog.push(m);
}
function waitFor(pred) {
  for ( var i = 0 ; i < backlog.length ; i++ ) {
    if ( pred(backlog[i]) ) return Promise.resolve(backlog.splice(i, 1)[0]);
  }
  return new Promise(function(resolve) { waiters.push({ pred: pred, resolve: resolve }); });
}
child.stdout.on('data', function(chunk) {
  buf = Buffer.concat([ buf, chunk ]);
  for ( ; ; ) {
    var hEnd = buf.indexOf('\r\n\r\n');
    if ( hEnd === -1 ) return;
    var len = parseInt(/Content-Length: (\d+)/.exec(buf.slice(0, hEnd).toString())[1], 10);
    if ( buf.length < hEnd + 4 + len ) return;
    deliver(JSON.parse(buf.slice(hEnd + 4, hEnd + 4 + len).toString()));
    buf = buf.slice(hEnd + 4 + len);
  }
});

function diagsFor(uri) {
  return waitFor(function(m) {
    return m.method === 'textDocument/publishDiagnostics' && m.params.uri === uri;
  }).then(function(m) { return m.params.diagnostics; });
}

var TIMEOUT_MS = 90000;
var run = (async function() {
  var initId = send('initialize', {
    processId: process.pid,
    rootUri:   'file://' + root,
    capabilities: {}
  }, true);
  await waitFor(function(m) { return m.id === initId; });
  send('initialized', {});

  // didOpen of a pom.js must produce a diagnostics PUSH — this is the exact
  // path that was dead (isFoamFile excludes foam.POM by design).
  send('textDocument/didOpen', { textDocument: {
    uri: POM_URI, languageId: 'javascript', version: 1, text: BAD_POM } });
  var d1 = await diagsFor(POM_URI);
  test(d1.length === 1 && d1[0].code === 'pom-flag-whitespace',
    'didOpen(pom.js) pushes the pom-flag-whitespace diagnostic through the wire');

  // didChange to a clean pom must push an EMPTY set (squiggle clears).
  send('textDocument/didChange', {
    textDocument: { uri: POM_URI, version: 2 },
    contentChanges: [ { text: CLEAN_POM } ]
  });
  var d2 = await diagsFor(POM_URI);
  test(d2.length === 0, 'didChange to a clean pom pushes an empty diagnostics set');

  // Widening the gate must not have broken the class lane: a foam.CLASS
  // didOpen still produces its own push.
  send('textDocument/didOpen', { textDocument: {
    uri: CLASS_URI, languageId: 'javascript', version: 1, text: CLASS_SRC } });
  var d3 = await diagsFor(CLASS_URI);
  test(Array.isArray(d3), 'didOpen(foam.CLASS file) still pushes on the class lane');

  // ---- T1 characterization: pin today's dispatch behavior so the route-
  // table / classifyFile refactors diff against reality, not intention. ----

  function request(method, params) {
    var id = send(method, params, true);
    return waitFor(function(m) { return m.id === id; });
  }

  // jrl lane: a .jrl didOpen produces its own push (pushJrlDiagnostics).
  var JRL_URI = 'file://' + path.join(root, 'seed.jrl');
  send('textDocument/didOpen', { textDocument: {
    uri: JRL_URI, languageId: 'javascript', version: 1,
    text: 'p({"class":"d.B","p":"x"})\n' } });
  var dj = await diagsFor(JRL_URI);
  test(Array.isArray(dj), 'didOpen(.jrl) pushes on the jrl lane');

  // Plain JS gets NO push. Absence is proven by ordering: stdin is one
  // ordered pipe, so once the hover REQUEST on the plain doc answers, its
  // didOpen was fully processed — any push would already sit in backlog.
  var PLAIN_URI = 'file://' + path.join(root, 'plain.js');
  send('textDocument/didOpen', { textDocument: {
    uri: PLAIN_URI, languageId: 'javascript', version: 1,
    text: 'var x = 1;\nmodule.exports = x;\n' } });
  var hoverPlain = await request('textDocument/hover', {
    textDocument: { uri: PLAIN_URI }, position: { line: 0, character: 5 } });
  test(hoverPlain.result === null,
    'hover on a non-FOAM doc answers null (guard characterization)');
  test(! backlog.some(function(m) {
      return m.method === 'textDocument/publishDiagnostics' && m.params.uri === PLAIN_URI;
    }),
    'plain JS didOpen produced no diagnostics push');

  // Guard on the pom doc: hover answers null — pom files are not class
  // docs, and today every doc-kind guard falls back to the empty answer.
  var hoverPom = await request('textDocument/hover', {
    textDocument: { uri: POM_URI }, position: { line: 0, character: 2 } });
  test(hoverPom.result === null, 'hover on a pom doc answers null');

  // Unknown method: -32601, the JSON-RPC method-not-found contract.
  var unknown = await request('foam/noSuchMethod', {});
  test(!! unknown.error && unknown.error.code === -32601,
    'unknown request method answers -32601');

  // didSave re-push lane (reindex loop): the saved pom re-pushes its
  // diagnostics — the doc holds the CLEAN text from the didChange above,
  // so the re-push is an empty set.
  send('textDocument/didSave', { textDocument: { uri: POM_URI } });
  var dSave = await diagsFor(POM_URI);
  test(Array.isArray(dSave) && dSave.length === 0,
    'didSave(pom.js) re-pushes through the reindex lane');
})();

// NOT unref'd: with the timer unref'd and the child dead, node's event loop
// empties and the runner exits 0 with no SUMMARY — the timer must hold the
// process open until the race settles, then be cleared.
var timer;
var timeout = new Promise(function(resolve) {
  timer = setTimeout(function() {
    test(false, 'dispatch tests timed out after ' + TIMEOUT_MS + 'ms — no push received');
    resolve();
  }, TIMEOUT_MS);
});

module.exports.done = Promise.race([ run, timeout ]).catch(function(e) {
  test(false, 'dispatch tests threw: ' + e.message);
}).then(function() {
  clearTimeout(timer);
  child.kill();
});
