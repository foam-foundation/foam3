/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
var fs = require('fs'), path = require('path');
// chrome mock: each eval answers with the (result, exc) pair queued for it,
// and records what was evaluated; fetch serves the extension's own files.
var answers = [], evaluated = [], fetched = [];
global.chrome = {
  devtools: { inspectedWindow: { eval: function(expr, cb) { evaluated.push(expr); var a = answers.shift(); cb(a[0], a[1]); } } },
  runtime: { getURL: function(f) { return 'chrome-extension://x/' + f; } }
};
global.fetch = function(url) {
  var f = url.replace('chrome-extension://x/', '');
  fetched.push(f);
  return Promise.resolve({ text: function() { return Promise.resolve(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')); } });
};
var C = require('../common.js');
var passes = 0;
function t(cond, msg) { assert(cond, msg); passes++; console.log('  ok', msg); }

var FALLBACK = 'JSON.stringify({error:"no backend",noBackend:true})';
// what the page answers when that fallback runs
var NO_BACKEND = eval(FALLBACK);
t(C.rpcExpr('inspect', [ '$0' ]) ===
  'window.__foamDevtools ? window.__foamDevtools.call("inspect", $0) : ' + FALLBACK,
  'rpcExpr: name is JSON-quoted, arg expressions are inserted verbatim');
t(C.rpcExpr('ping') ===
  'window.__foamDevtools ? window.__foamDevtools.call("ping") : ' + FALLBACK,
  'rpcExpr: no args -> call(name) only');
t(C.rpcExpr('selectUid', [ '"7"', '$0' ]) ===
  'window.__foamDevtools ? window.__foamDevtools.call("selectUid", "7", $0) : ' + FALLBACK,
  'rpcExpr: several args, comma-joined');
t(C.revealExpr('3') === 'inspect(window.__foamDevtools.node(3))' && C.revealExpr('x') === 'inspect(window.__foamDevtools.node(0))',
  'revealExpr: integer index only, anything else becomes 0');
t(C.revealExpr() === 'inspect(window.__foamDevtools.node())' && C.revealExpr(null) === 'inspect(window.__foamDevtools.node())', 'revealExpr: no index / null -> the pointed-at element');

// The injected bundle: every page-world file, in the order the registry
// needs (each registers on the one before), and nothing the manifest lists
// — it has no content scripts.
var manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
t(! manifest.content_scripts && ! manifest.permissions && ! manifest.host_permissions, 'manifest: no content scripts, no permissions — the backend goes in through inspectedWindow.eval');
t(C.BACKEND_FILES[0] === 'shapers.js' && C.BACKEND_FILES[2] === 'backend.js' && C.BACKEND_FILES.length === 8 &&
  C.BACKEND_FILES.every(function(f) { return fs.existsSync(path.join(__dirname, '..', f)); }),
  'BACKEND_FILES: eight files, shapers before backend, all present');

// foamEval never rejects: every failure resolves to {error}
answers = [ [ '{"ok":1}', null ], [ undefined, { isException: true, value: 'boom' } ], [ 42, null ], [ undefined, null ], [ '{nope', null ] ];
Promise.all([ C.foamEval('a'), C.foamEval('b'), C.foamEval('c'), C.foamEval('d'), C.foamEval('e') ]).then(function(r) {
  t(r[0].ok === 1, 'foamEval: JSON string result is parsed');
  t(r[1].error === 'boom', 'foamEval: page exception -> {error: value}');
  t(r[2].error === 'non-string result', 'foamEval: non-string result -> {error}');
  t(/mid-reload/.test(r[3].error), 'foamEval: undefined result -> {error} naming a reload');
  t(/^bad JSON/.test(r[4].error), 'foamEval: unparsable string -> {error: bad JSON}');

  // rpc with a backend: one eval, the answer
  answers = [ [ '{"foam":true}', null ] ]; evaluated = [];
  return C.rpc('ping');
}).then(function(r) {
  t(r.foam === true && evaluated.length === 1, 'rpc: backend present -> one eval, its answer');

  // rpc without a backend: the marker, then the bundle is evaluated, then the same call again
  answers = [ [ NO_BACKEND, null ], [ '{"ok":true}', null ], [ '{"foam":true}', null ] ]; evaluated = []; fetched = [];
  return C.rpc('ping');
}).then(function(r) {
  t(r.foam === true && evaluated.length === 3 && evaluated[0] === evaluated[2], 'rpc: no backend -> inject, then the same expression once more');
  t(fetched.join() === C.BACKEND_FILES.join(), 'rpc: the bundle is every BACKEND_FILES entry in order');
  var bundle = evaluated[1];
  t(/^\(function\(\) \{ if \( ! window\.__foamDevtools \) \{/.test(bundle) && /return JSON\.stringify\(\{ ok: true \}\); \}\)\(\)$/.test(bundle),
    'rpc: bundle is guarded on window.__foamDevtools and answers a JSON string');
  t(bundle.indexOf(fs.readFileSync(path.join(__dirname, '..', 'backend.js'), 'utf8')) > bundle.indexOf(fs.readFileSync(path.join(__dirname, '..', 'shapers.js'), 'utf8')),
    'rpc: shapers.js precedes backend.js inside the bundle');
  new Function(bundle);
  t(true, 'rpc: bundle parses as one script');

  // second rpc without a backend: sources are not fetched again
  answers = [ [ NO_BACKEND, null ], [ '{"ok":true}', null ], [ '{"n":2}', null ] ]; fetched = [];
  return C.rpc('ping');
}).then(function(r) {
  t(r.n === 2 && fetched.length === 0, 'rpc: bundle source is fetched once per page');

  // inject itself failing surfaces as an error, no retry
  answers = [ [ NO_BACKEND, null ], [ undefined, { isException: true, value: 'csp' } ] ]; evaluated = [];
  return C.rpc('ping');
}).then(function(r) {
  t(r.error === 'backend inject failed: csp' && evaluated.length === 2, 'rpc: a failing inject -> {error}, the call is not retried');
  console.log('common-test:', passes, 'passed');
});

