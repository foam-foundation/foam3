/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
// chrome mock: each eval answers with the (result, exc) pair queued for it
var answers = [];
global.chrome = { devtools: { inspectedWindow: { eval: function(expr, cb) { var a = answers.shift(); cb(a[0], a[1]); } } } };
var C = require('../common.js');
var passes = 0;
function t(cond, msg) { assert(cond, msg); passes++; console.log('  ok', msg); }

var FALLBACK = 'JSON.stringify({error:"no backend — reload the inspected page (extension scripts inject on page load)"})';
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

// foamEval never rejects: every failure resolves to {error}
answers = [ [ '{"ok":1}', null ], [ undefined, { isException: true, value: 'boom' } ], [ 42, null ], [ undefined, null ], [ '{nope', null ] ];
Promise.all([ C.foamEval('a'), C.foamEval('b'), C.foamEval('c'), C.foamEval('d'), C.foamEval('e') ]).then(function(r) {
  t(r[0].ok === 1, 'foamEval: JSON string result is parsed');
  t(r[1].error === 'boom', 'foamEval: page exception -> {error: value}');
  t(r[2].error === 'non-string result', 'foamEval: non-string result -> {error}');
  t(/mid-reload/.test(r[3].error), 'foamEval: undefined result -> {error} naming a reload');
  t(/^bad JSON/.test(r[4].error), 'foamEval: unparsable string -> {error: bad JSON}');
  console.log('common-test:', passes, 'passed');
});

