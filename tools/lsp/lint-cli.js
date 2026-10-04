#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registration-completeness lint, CLI entry point for CI / pre-push.
// Boots pmake directly (no LSP server) — pays the index boot (~30s) per run;
// intended for CI jobs and pre-push, not per-commit hooks.
//
// Usage, from the FOAM project root (the dir containing pom.js + foam3/):
//   node foam3/tools/lsp/lint-cli.js [--diff <ref>] [--checks a,b]
//        [--strategy-targets x,y] [--format text|json] [--strict]

var path = require('path');
var cp   = require('child_process');

function arg(flag) {
  var i = process.argv.indexOf(flag);
  return i === -1 ? null : ( process.argv[i + 1] || '' );
}
var has = function(flag) { return process.argv.indexOf(flag) !== -1; };

// Silence the console noise the LSP boot produces on stdout; findings go to
// stdout, boot chatter to stderr (same trick as the test harness).
console.log = function() { console.error.apply(console, arguments); };

var pmake    = require(path.resolve(__dirname, '../pmake'));
var buildlib = require(path.resolve(__dirname, '../buildlib'));
buildlib.error = function() {};
globalThis.SILENT = false; globalThis.VERBOSE = false;
globalThis.DRY_RUN = false; globalThis.HELP = false; globalThis.NOP = '';
process.on('unhandledRejection', function() {});

try {
  pmake.bind(buildlib, '-makers=LSP -pom=' + path.resolve(process.cwd(), 'pom'))();
} catch (e) {
  console.error('lint-cli: pmake boot failed: ' + e.message);
  process.exit(2);
}

var index = foam.parse.lsp.FoamIndex.create();
index.buildFileIndex();
var validator = foam.parse.lsp.handlers.PomValidator.create({ index: index });
var handler   = foam.parse.lsp.handlers.LintHandler.create({ index: index, pomValidator: validator });

var params = {};
if ( arg('--checks') )           params.checks = arg('--checks').split(',');
if ( arg('--strategy-targets') ) params.strategyTargets = arg('--strategy-targets').split(',');
if ( arg('--diff') != null ) {
  var ref = arg('--diff');
  if ( ! ref || ref.charAt(0) === '-' ) ref = 'HEAD';
  var out = cp.execSync('git diff --name-only ' + ref, { encoding: 'utf8' });
  var untracked = cp.execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' });
  var changed = out.split('\n').concat(untracked.split('\n')).filter(Boolean);
  params.scope = 'paths';
  params.paths = changed.filter(function(p, i) { return changed.indexOf(p) === i; });
}

var result;
try {
  result = handler.lint(params);
} catch (e) {
  console.error('lint-cli: ' + e.message);
  process.exit(2);
}

var findings = result.findings;
var errors   = findings.filter(function(f) { return f.severity === 'error'; }).length;
var warns    = findings.length - errors;

if ( arg('--format') === 'json' ) {
  process.stdout.write(JSON.stringify({ findings: findings, errors: errors, warns: warns }, null, 2) + '\n');
} else {
  for ( var i = 0 ; i < findings.length ; i++ ) {
    var f = findings[i];
    process.stdout.write(
      f.severity.toUpperCase().padEnd(6) + ' ' + f.check.padEnd(16) + ' ' +
      path.relative(process.cwd(), f.path) + ':' + f.line + '\n' +
      '       ' + f.message + '\n' +
      ( f.fix ? '       fix: ' + f.fix + '\n' : '' ));
  }
  process.stdout.write('---\n' + errors + ' error(s), ' + warns + ' warn(s)\n');
}

process.exit(errors > 0 || ( has('--strict') && warns > 0 ) ? 1 : 0);
