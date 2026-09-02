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
