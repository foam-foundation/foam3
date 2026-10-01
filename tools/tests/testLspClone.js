/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// tools/lspClone.js against a local bare repo standing in for FOAM-LSP.
// Usage: cd foam3 && node tools/tests/testLspClone.js

var cp   = require('child_process');
var fs   = require('fs');
var os   = require('os');
var path = require('path');
var lsp  = require('../lspClone');

var failures = 0;
function test(ok, msg) { console.error(( ok ? 'PASS ' : 'FAIL ' ) + msg); if ( ! ok ) failures++; }
function git(dir) { return cp.execFileSync('git', [ '-C', dir ].concat([].slice.call(arguments, 1)), { encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'pipe' ] }).trim(); }

var tmp    = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp clone '));
var remote = path.join(tmp, 'remote.git');
var seed   = path.join(tmp, 'seed');
cp.execFileSync('git', [ 'init', '-q', '--bare', '-b', 'main', remote ]);
cp.execFileSync('git', [ 'clone', '-q', remote, seed ], { stdio: 'ignore' });
function push(file) {
  fs.writeFileSync(path.join(seed, file), file);
  git(seed, 'add', file);
  git(seed, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', file);
  git(seed, 'push', '-q', 'origin', 'HEAD:main');
}
push('one');

var env   = { FOAM_LSP_HOME: path.join(tmp, 'home', 'lsp'), FOAM_LSP_REPO: remote };
var stamp = path.join(env.FOAM_LSP_HOME, '.git', 'foam-lsp-last-update');
function age() { var old = new Date(Date.now() - 2 * 24 * 3600 * 1000); fs.utimesSync(stamp, old, old); }

test(lsp.update(env, {}) === 'not-installed', 'no clone: update does nothing');

test(lsp.install(env) === env.FOAM_LSP_HOME && fs.existsSync(path.join(env.FOAM_LSP_HOME, 'one')), 'install clones');
test(lsp.install(env) === env.FOAM_LSP_HOME, 'install twice keeps the clone');

push('two');
test(lsp.update(env, {}) === 'updated' && fs.existsSync(path.join(env.FOAM_LSP_HOME, 'two')), 'update fast-forwards');

push('three');
test(lsp.update(env, {}) === 'throttled', 'second update within 24 h is throttled');
test(lsp.update(env, { force: true }) === 'updated', 'force skips the throttle');

age(); fs.writeFileSync(path.join(env.FOAM_LSP_HOME, 'local-edit'), 'x');
test(lsp.update(env, {}) === 'dirty', 'local changes: left alone');
fs.unlinkSync(path.join(env.FOAM_LSP_HOME, 'local-edit'));

git(env.FOAM_LSP_HOME, 'checkout', '-q', '-b', 'feature');
test(lsp.update(env, {}) === 'off-default-branch', 'feature branch: left alone');
git(env.FOAM_LSP_HOME, 'checkout', '-q', 'main');

age(); git(env.FOAM_LSP_HOME, 'remote', 'set-url', 'origin', path.join(tmp, 'missing.git'));
var threw = false; try { lsp.update(env, {}); } catch (e) { threw = true; }
test(threw && lsp.update(env, {}) === 'throttled', 'unreachable remote: throws once, then throttled for the day');

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
