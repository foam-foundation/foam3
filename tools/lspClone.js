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
  }
  return dir;
}

// --lsp-auto-update:false saves itself as this file. It sits in .git so the
// clone never reads as dirty, and it goes away with the clone.
function offFile(dir) { return path.join(dir, '.git', 'foam-lsp-no-autoupdate'); }

function setAutoUpdate(env, on) {
  var dir = home(env);
  if ( ! fs.existsSync(path.join(dir, '.git')) ) return;
  if ( on ) fs.rmSync(offFile(dir), { force: true });
  else      fs.writeFileSync(offFile(dir), '');
}

function update(env, opts) {
  var dir = home(env);
  if ( ! fs.existsSync(path.join(dir, '.git')) ) return 'not-installed';
  if ( ! opts.force && fs.existsSync(offFile(dir)) ) return 'disabled';

  var stamp = path.join(dir, '.git', 'foam-lsp-last-update');
  if ( ! opts.force ) {
    try { if ( Date.now() - fs.statSync(stamp).mtimeMs < DAY_MS ) return 'throttled'; } catch (e) {}
  }
  if ( git(dir, [ 'status', '--porcelain' ]) ) return 'dirty';
  var branch = git(dir, [ 'rev-parse', '--abbrev-ref', 'HEAD' ]);
  var main   = git(dir, [ 'rev-parse', '--abbrev-ref', 'origin/HEAD' ]).replace(/^origin\//, '');
  if ( branch !== main ) return 'off-default-branch';

  // Stamp before pulling: offline, the build tries once a day, not every build.
  fs.writeFileSync(stamp, '');
  git(dir, [ 'pull', '--ff-only', '--quiet' ]);
  return 'updated';
}

module.exports = { home: home, install: install, setAutoUpdate: setAutoUpdate, update: update };
