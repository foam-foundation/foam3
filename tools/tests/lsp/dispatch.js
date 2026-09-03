/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Server DISPATCH tests: spawn the real entry point as a child process and
// speak LSP over its stdio pipes. Handler-level tests walk in the back door
// (call handle() directly); these prove the front door routes there too.
// Exists because the pom-validation lane shipped fully unit-tested yet
// unreachable — didOpen's isFoamFile gate never sent a pom.js to the handler
// at all.

var h = require('./_harness');
var test = h.test, section = h.section;

var cp   = require('child_process');
var fs   = require('fs');
var os   = require('os');
var path = require('path');

var root = fs.mkdtempSync(path.join(os.tmpdir(), 'lspd-'));
fs.writeFileSync(path.join(root, 'A.js'), '// exists\n');
var POM_URI     = 'file://' + path.join(root, 'pom.js');
var CLASS_URI   = 'file://' + path.join(root, 'B.js');
var CREATED     = path.join(root, 'C.js');
var CREATED_URI = 'file://' + CREATED;
var BAD_POM     = "foam.POM({\n  name: 'd',\n  files: [\n" +
  "    { name: 'A', flags: 'js |java' }\n  ]\n});\n";
var CLEAN_POM   = BAD_POM.replace('js |java', 'js|java');
var MISSING_POM = BAD_POM.replace("'A', flags: 'js |java'", "'C', flags: 'js|java'");
var CLASS_SRC   = "foam.CLASS({\n  package: 'd',\n  name: 'B',\n  properties: [\n" +
  "    'alpha',\n    'beta'\n  ],\n  methods: [\n    function go() { return this.alpha; }\n  ]\n});\n";
var CREATED_SRC = "foam.CLASS({\n  package: 'd',\n  name: 'C'\n});\n";
fs.writeFileSync(path.join(root, 'pom.js'), BAD_POM);

// The real entry point is lsp-start.js (server.js only exports start()) —
// the same script the VS Code, Zed, Emacs and MCP clients all spawn, with the
// same [pomPath] arg: the boot pmake-loads FOAM through that pom, so it must
// be the repo's own pom (a bare fixture pom can't bootstrap foam.CLASS).
//
// Why a child process rather than h.withServerLane, the in-process lane
// config.js and i18n.js use: that lane boots server.js and does its own
// didOpen -> publishDiagnostics round trips, so it covers server.js dispatch
// and would catch the pom bug below just as well. What it cannot cover is
// lsp-start.js itself — its arg handling, pom resolution and console/global
// setup — and this is the suite's only test that loads that file (mcp.js
// deliberately stops short of spawning it). A break there leaves every
// in-process test green and every real editor dead: the same
// unreachable-lane failure this file exists for, one level up. The child also
// frames over real OS pipes instead of process.stdin.emit('data').
// Measured marginal cost of the second boot: 2.5s (config alone 4.0s,
// config,dispatch 6.6s).
var repoRoot   = path.join(__dirname, '..', '..', '..');
var serverPath = path.join(repoRoot, 'tools', 'lsp-start.js');
var child = cp.spawn(process.execPath, [ serverPath, path.join(repoRoot, 'pom') ], {
  cwd: repoRoot, stdio: [ 'pipe', 'pipe', 'pipe' ]
});

// stderr is KEPT (not 'ignore'): it carries the child's boot log and any
// stack it dies on, and a failing wait quotes its tail. Same reason
// child.on('error') is handled — _harness.js's uncaughtException hook
// swallows throws, so an ENOENT spawn would otherwise present as a silent
// wait timeout with nothing to read.
var childErr = '', spawnError = null;
child.stderr.on('data', function(c) { childErr += c.toString(); });
child.on('error', function(e) { spawnError = e; });

var nextId = 1;
function send(method, params, isRequest) {
  var msg = { jsonrpc: '2.0', method: method, params: params };
  if ( isRequest ) msg.id = nextId++;
  var body = JSON.stringify(msg);
  child.stdin.write('Content-Length: ' + Buffer.byteLength(body) + '\r\n\r\n' + body);
  return msg.id;
}

// Frame parser + waiters: waitFor(pred, what) resolves with the first decoded
// message matching pred (checks backlog first, so races can't drop one).
//
// The deadline is PER WAIT and it names the wait: one deadline spanning the
// whole file would report "timed out" with no clue which step hung, which is
// exactly what a reverted server.js produces. Each timer is ref'd, so a
// pending wait also holds the event loop open — without that, node's loop
// empties once the child is idle and the runner exits 0 with no SUMMARY.
var WAIT_MS = 30000;   // the server boot (~2.5s) is inside the first wait
var backlog = [], waiters = [], buf = Buffer.alloc(0);
function deliver(m) {
  for ( var i = 0 ; i < waiters.length ; i++ ) {
    if ( waiters[i].pred(m) ) {
      var w = waiters.splice(i, 1)[0];
      clearTimeout(w.timer);
      return w.resolve(m);
    }
  }
  backlog.push(m);
}
function waitFor(pred, what) {
  for ( var i = 0 ; i < backlog.length ; i++ ) {
    if ( pred(backlog[i]) ) return Promise.resolve(backlog.splice(i, 1)[0]);
  }
  return new Promise(function(resolve, reject) {
    var w = { pred: pred, resolve: resolve };
    w.timer = setTimeout(function() {
      var i = waiters.indexOf(w);
      if ( i !== -1 ) waiters.splice(i, 1);
      reject(new Error('timed out after ' + WAIT_MS + 'ms waiting for ' + what +
        ( spawnError ? '\n    spawn failed: ' + spawnError.message : '' ) +
        ( childErr ? '\n    child stderr tail: ' + childErr.slice(-600) : '' )));
    }, WAIT_MS);
    waiters.push(w);
  });
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

function diagsFor(uri, what) {
  return waitFor(function(m) {
    return m.method === 'textDocument/publishDiagnostics' && m.params.uri === uri;
  }, what).then(function(m) { return m.params.diagnostics; });
}

// section() is called INSIDE the async body, not at require time: every
// assertion here resolves after the awaits, so a header printed at module
// load would sit ~200 lines above its own ticks in the full-suite log.
module.exports.done = (async function() {
  section('server dispatch — pushDiagnostics routing over real stdio');

  var initId = send('initialize', {
    processId: process.pid,
    rootUri:   'file://' + root,
    capabilities: {}
  }, true);
  await waitFor(function(m) { return m.id === initId; }, 'the initialize response');
  send('initialized', {});

  // didOpen of a pom.js must produce a diagnostics PUSH — this is the exact
  // path that was dead (the isFoamFile gate this branch replaces excluded
  // foam.POM by design).
  send('textDocument/didOpen', { textDocument: {
    uri: POM_URI, languageId: 'javascript', version: 1, text: BAD_POM } });
  var d1 = await diagsFor(POM_URI, 'the didOpen(pom.js) diagnostics push');
  test(d1.length === 1 && d1[0].code === 'pom-flag-whitespace',
    'didOpen(pom.js) pushes the pom-flag-whitespace diagnostic through the wire');

  // didChange to a clean pom must push an EMPTY set (squiggle clears).
  send('textDocument/didChange', {
    textDocument: { uri: POM_URI, version: 2 },
    contentChanges: [ { text: CLEAN_POM } ]
  });
  var d2 = await diagsFor(POM_URI, 'the didChange(clean pom) diagnostics push');
  test(d2.length === 0, 'didChange to a clean pom pushes an empty diagnostics set');

  // Widening the gate must not have broken the class lane: a foam.CLASS
  // didOpen still produces its own push.
  send('textDocument/didOpen', { textDocument: {
    uri: CLASS_URI, languageId: 'javascript', version: 1, text: CLASS_SRC } });
  var d3 = await diagsFor(CLASS_URI, 'the didOpen(foam.CLASS) diagnostics push');
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
  var dj = await diagsFor(JRL_URI, 'the didOpen(.jrl) diagnostics push');
  test(Array.isArray(dj), 'didOpen(.jrl) pushes on the jrl lane');

  // Plain JS gets NO push. Absence is proven by ordering: stdin is one
  // ordered pipe, so once the hover REQUEST on the plain doc answers, its
  // didOpen was fully processed — any push would already sit in backlog.
  var PLAIN_URI = 'file://' + path.join(root, 'plain.js');
  send('textDocument/didOpen', { textDocument: {
    uri: PLAIN_URI, languageId: 'javascript', version: 1,
    text: 'var alpha = 1;\nmodule.exports = alpha;\n' } });
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
  var dSave = await diagsFor(POM_URI, 'the didSave(pom.js) reindex re-push');
  test(Array.isArray(dSave) && dSave.length === 0,
    'didSave(pom.js) re-pushes through the reindex lane');

  // ---- Every table-driven document request, over the wire ----------------
  // server.js answers twelve requests from one DOC_REQUESTS row each. A wrong
  // handler or argument in a row is invisible to the handler unit tests (they
  // call the handler directly) and to a green suite, because nothing else
  // sends these methods. This list is deliberately a SECOND copy of the
  // routing intent: if it drifts from the table, one of the two is wrong.
  var ROUTED = [
    { m: 'textDocument/documentSymbol',       list: true },
    { m: 'textDocument/references',           list: true },
    { m: 'textDocument/codeLens',             list: true },
    { m: 'textDocument/implementation',       list: true },
    { m: 'textDocument/foldingRange',         list: true, anyDoc: true },
    { m: 'textDocument/documentHighlight',    list: true, anyDoc: true },
    { m: 'textDocument/signatureHelp'  },
    { m: 'textDocument/prepareRename'  },
    { m: 'textDocument/rename'         },
    { m: 'textDocument/prepareTypeHierarchy' },
    { m: 'textDocument/typeDefinition' },
    { m: 'textDocument/prepareCallHierarchy' }
  ];

  function routeParams(uri) {
    return { textDocument: { uri: uri }, position: { line: 2, character: 4 },
             newName: 'Renamed', context: { diagnostics: [] } };
  }

  for ( var ri = 0 ; ri < ROUTED.length ; ri++ ) {
    var route = ROUTED[ri];
    var onClass = await request(route.m, routeParams(CLASS_URI));
    test(! onClass.error && onClass.result !== undefined,
      route.m + ' answers a class doc without an error');

    // The guard assertion below only proves the route is WIRED, not that the
    // right handler got the right arguments — an empty answer and a handler
    // that quietly found nothing look identical over the wire. The three
    // checks after the loop are the ones that can tell those apart.
    var onPlain = await request(route.m, routeParams(PLAIN_URI));
    if ( ! route.anyDoc ) {
      test(route.list ? ( Array.isArray(onPlain.result) && onPlain.result.length === 0 )
                      : onPlain.result === null,
        route.m + ' answers the empty ' + ( route.list ? '[]' : 'null' ) + ' on a non-class doc');
    }
  }

  // Three routes whose answer on this fixture is NON-empty, so each one
  // separates "the row is right" from "the handler ran and found nothing".
  var syms = await request('textDocument/documentSymbol', routeParams(CLASS_URI));
  test(Array.isArray(syms.result) && syms.result.length > 0,
    'documentSymbol returns real symbols, so its row passes text and uri');

  var folds = await request('textDocument/foldingRange', routeParams(CLASS_URI));
  test(Array.isArray(folds.result) && folds.result.length > 0,
    'foldingRange returns real ranges for the multi-line properties array');

  // documentHighlight is the anyDoc proof: the plain doc names `alpha` twice,
  // and the position below sits on the first one. A row that lost anyDoc
  // would answer the empty [] here instead.
  var hl = await request('textDocument/documentHighlight',
    { textDocument: { uri: PLAIN_URI }, position: { line: 0, character: 5 } });
  test(Array.isArray(hl.result) && hl.result.length > 1,
    'documentHighlight runs on a NON-class doc and finds both uses of alpha');

  // pom-file-missing is a DISK check, so the save that clears it is the save
  // creating the named file — a file the pom's own axiom state knows nothing
  // about, which is why the open-pom re-push can't be gated on the
  // affected-class set the way the class lane is.
  send('textDocument/didChange', {
    textDocument: { uri: POM_URI, version: 3 },
    contentChanges: [ { text: MISSING_POM } ]
  });
  var d4 = await diagsFor(POM_URI, 'the diagnostics push for a pom naming a missing file');
  test(d4.length === 1 && d4[0].code === 'pom-file-missing',
    'a pom entry naming a file that is not on disk reports pom-file-missing');

  fs.writeFileSync(CREATED, CREATED_SRC);
  send('textDocument/didOpen', { textDocument: {
    uri: CREATED_URI, languageId: 'javascript', version: 1, text: CREATED_SRC } });
  await diagsFor(CREATED_URI, 'the didOpen push for the newly created file');
  send('textDocument/didSave', { textDocument: { uri: CREATED_URI } });
  var d5 = await diagsFor(POM_URI, 're-push of the open pom after the missing file is saved');
  test(d5.length === 0,
    'saving the file a pom entry names clears pom-file-missing on the open pom');
})().catch(function(e) {
  test(false, 'dispatch tests failed — ' + e.message);
}).then(function() {
  child.kill();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch ( e ) {}
});
