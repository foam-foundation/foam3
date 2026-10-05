/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Installs and updates the per-user FOAM-LSP clone for ./build.sh lsp-install,
// lsp-update and the per-build refresh (tools/JSTooling.js).

var cp   = require('child_process');
var fs   = require('fs');
var os   = require('os');
var path = require('path');

var REPO       = 'https://github.com/foam-foundation/FOAM-LSP.git';
var DAY_MS     = 24 * 60 * 60 * 1000;
var TIMEOUT_MS = 15000;   // a hung network must not stall the build

function home(env) { return env.FOAM_LSP_HOME || path.join(os.homedir(), '.foam', 'lsp'); }

function git(dir, args) {
  return cp.execFileSync('git', [ '-C', dir ].concat(args),
    { encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'pipe' ], timeout: TIMEOUT_MS }).trim();
}

function install(env) {
  var dir = home(env);
  if ( ! fs.existsSync(path.join(dir, '.git')) ) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    cp.execFileSync('git', [ 'clone', env.FOAM_LSP_REPO || REPO, dir ], { stdio: 'inherit' });
  } else {
    // Re-running lsp-install is how people upgrade, so bring the clone current first.
    try { update(env, { force: true }); } catch (e) {}
  }
  return dir;
}

// ./build.sh lsp-auto-update:false saves itself as this file. It sits in .git so the
// clone never reads as dirty, and it goes away with the clone.
function offFile(dir) { return path.join(dir, '.git', 'foam-lsp-no-autoupdate'); }

// Returns false when there is no clone to save the setting into.
function setAutoUpdate(env, on) {
  var dir = home(env);
  if ( ! fs.existsSync(path.join(dir, '.git')) ) return false;
  if ( on ) fs.rmSync(offFile(dir), { force: true });
  else      fs.writeFileSync(offFile(dir), '');
  return true;
}

function update(env, opts) {
  var dir = home(env);
  if ( ! fs.existsSync(path.join(dir, '.git')) ) return 'not-installed';
  if ( ! opts.force && fs.existsSync(offFile(dir)) ) return 'disabled';

  var stamp = path.join(dir, '.git', 'foam-lsp-last-update');
  if ( ! opts.force ) {
    try { if ( Date.now() - fs.statSync(stamp).mtimeMs < DAY_MS ) return 'throttled'; } catch (e) {}
  }

  // Stamp first: a skip or a failure below is then reported once a day, not every build.
  fs.writeFileSync(stamp, '');
  if ( git(dir, [ 'status', '--porcelain' ]) ) return 'dirty';
  var branch = git(dir, [ 'rev-parse', '--abbrev-ref', 'HEAD' ]);
  var main   = git(dir, [ 'rev-parse', '--abbrev-ref', 'origin/HEAD' ]).replace(/^origin\//, '');
  if ( branch !== main ) return 'off-default-branch';

  git(dir, [ 'pull', '--ff-only', '--quiet' ]);
  return 'updated';
}

module.exports = { home: home, install: install, setAutoUpdate: setAutoUpdate, update: update };
