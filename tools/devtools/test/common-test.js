/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
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
t(C.revealExpr('3') === 'inspect(window.__foamDevtools.node(3))' && C.revealExpr('x') === 'inspect(window.__foamDevtools.node(0))',
  'revealExpr: integer index only, anything else becomes 0');

console.log('common-test:', passes, 'passed');
