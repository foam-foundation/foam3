/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
var D = require('../backend.js');
var passes = 0;
function t(cond, msg) { assert(cond, msg); passes++; console.log('  ok', msg); }

D.register('echo', function(a, b) { return { a: a, b: b }; });
var out = D.call('echo', 1, 'x');
t(typeof out === 'string' && out === '{"a":1,"b":"x"}', 'call: registered method result is a JSON string with args passed through');

var unknown = JSON.parse(D.call('nope'));
t(unknown.error === 'unknown method: nope', 'call: unknown method -> {error} string, no throw');

D.register('boom', function() { throw new Error('kaboom'); });
var boom = JSON.parse(D.call('boom'));
t(boom.error === 'kaboom', 'call: throwing method -> {error: message} string');

D.register('cycle', function() { var o = {}; o.self = o; return o; });
t(/^stringify: /.test(JSON.parse(D.call('cycle')).error), 'call: unserialisable result -> {error: stringify: ...} string');

t(D.foamReady() === false, 'foamReady: false outside a FOAM page');

console.log('backend-test:', passes, 'passed');
