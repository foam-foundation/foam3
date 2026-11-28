#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Tests for JavacMaker's staging and class list (publishClasses). Runs in node, no build needed.
//
// Usage: node foam3/tools/tests/testJavacSwap.js

var fs_   = require('fs');
var os_   = require('os');
var path_ = require('path');

var publish = require('../JavacMaker').publishClasses, markPlainBuild = require('../JavacMaker').markPlainBuild;

var passes = 0, failures = 0;
function test(ok, message) {
  if ( ok ) { passes++; console.log('  ok   ' + message); }
  else      { failures++; console.log('  FAIL ' + message); }
}

var dir = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'javac-swap-'));
var to = path_.join(dir, 'classes'), from = path_.join(dir, 'classes-swap'), manifest = path_.join(dir, 'swap-manifest');
var put = (root, rel, text) => { fs_.mkdirSync(path_.dirname(path_.join(root, rel)), { recursive: true }); fs_.writeFileSync(path_.join(root, rel), text); };
var list = () => fs_.existsSync(manifest) ? fs_.readFileSync(manifest, 'utf8').split('\n').filter(Boolean) : null;

console.log('publishClasses');
put(to, 'a/Same.class', 'same');
put(to, 'a/Old.class', 'old');
var old = new Date(Date.now() - 100000);
fs_.utimesSync(path_.join(to, 'a/Same.class'), old, old);
put(from, 'a/Same.class', 'same');
put(from, 'a/Old.class', 'new');
put(from, 'b/Fresh.class', 'fresh');
publish(from, to, manifest);
test(JSON.stringify(list()) === JSON.stringify(['a/Old.class', 'b/Fresh.class']), 'the list names the changed and the new class, not the one with the same bytes: ' + list());
test(fs_.readFileSync(path_.join(to, 'a/Old.class'), 'utf8') === 'new' && fs_.readFileSync(path_.join(to, 'b/Fresh.class'), 'utf8') === 'fresh', 'they are in the classes folder');
test(Date.now() - fs_.statSync(path_.join(to, 'a/Same.class')).mtimeMs < 20000, 'the class with the same bytes is touched, so it is not compiled again');
test(! fs_.existsSync(from) && fs_.readdirSync(path_.join(to, 'a')).every(f => ! f.endsWith('.tmp')), 'the staging folder and temp files are gone');

console.log('the list is kept between runs');
put(from, 'c/Next.class', 'next');
publish(from, to, manifest);
test(JSON.stringify(list()) === JSON.stringify(['a/Old.class', 'b/Fresh.class', 'c/Next.class']), 'a second run adds to the list, it does not replace it: ' + list());
put(from, 'c/Next.class', 'next');
publish(from, to, manifest);
test(list().length === 3, 'a run that changes nothing leaves it as it was');

console.log('a class that is gone');
fs_.rmSync(path_.join(to, 'b/Fresh.class'));
put(from, 'c/Next.class', 'next2');
publish(from, to, manifest);
test(list().indexOf('b/Fresh.class') !== -1, 'a listed class that was deleted stays listed: the reader skips it');

console.log('a build without staging');
markPlainBuild(dir);
test(! fs_.existsSync(path_.join(dir, 'swap-stale')), 'with no swap-live file it marks nothing');
fs_.writeFileSync(path_.join(dir, 'swap-live'), '');
markPlainBuild(dir);
test(fs_.existsSync(path_.join(dir, 'swap-stale')), 'with swap-live it writes swap-stale');

fs_.rmSync(dir, { recursive: true, force: true });
console.log('\n' + passes + ' passed, ' + failures + ' failed');
process.exitCode = failures ? 1 : 0;
