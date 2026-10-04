/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure model behind the VS Code lint surface (editors/vscode/src/lintModel.ts):
// scope filtering, grouping, finding -> diagnostic mapping, summary counts.
// Compiles the extension with its own TypeScript, then requires the emitted
// JS — the model imports nothing from 'vscode' precisely so this can run in
// plain node. Skips (asserting nothing) when the extension's node_modules is
// absent, so the LSP suite stays runnable without installing them.

var h = require('./_harness');
var test = h.test, section = h.section;
var fs   = require('fs');
var path = require('path');
var cp   = require('child_process');

section('VS Code lint model');

var EXT = path.resolve(__dirname, '../../lsp/editors/vscode');
var TSC = path.join(EXT, 'node_modules', 'typescript', 'bin', 'tsc');

if ( ! fs.existsSync(TSC) ) {
  console.error('  (skipped: ' + path.relative(process.cwd(), EXT) +
    '/node_modules absent — run editors/vscode/install.sh to enable)');
} else {
  fs.rmSync(path.join(EXT, 'out', 'lintModel.js'), { force: true });

  var compiled = true;
  try {
    cp.execSync(process.execPath + ' ' + JSON.stringify(TSC) + ' -p .',
      { cwd: EXT, stdio: 'pipe' });
  } catch (e) {
    compiled = false;
    console.error('  tsc output: ' +
      String(e.stdout && e.stdout.length ? e.stdout : e.message).slice(0, 2000));
  }
  test(compiled, 'extension TypeScript compiles');

  // Guard the require + every model assertion behind `compiled`: a failed
  // tsc leaves out/lintModel.js absent (removed above), so an unguarded
  // require here would throw MODULE_NOT_FOUND at the top level. _harness's
  // uncaughtException handler swallows that throw, which unwinds past every
  // later category (including testFoamLSP.js's final exit-code check) and
  // node exits 0 with no SUMMARY — silently hiding the very compile failure
  // the assertion above exists to catch.
  if ( compiled ) {
    var m = require(path.join(EXT, 'out', 'lintModel.js'));

    var FINDINGS = [
      { check: 'rule-group', severity: 'error', path: '/w/deployment/alpha/rules.jrl',
        line: 3, message: 'rule references missing group', fix: 'add the group' },
      { check: 'strategy-ref', severity: 'warn', path: '/w/src/strategyReferences.jrl',
        line: 7, message: 'flag-gated strategy' },
      { check: 'pom-membership', severity: 'error', path: '/w/src/Foo.js',
        line: 1, message: 'not listed in any pom.js', fix: 'add an entry' },
      { check: 'strategy-ref', severity: 'warn', path: '/w/src/strategyReferences.jrl',
        line: 11, message: 'flag-gated strategy' }
    ];

    // --- scopeFindings ---
    test(m.scopeFindings(FINDINGS, 'workspace', []).length === 4,
      'scope "workspace" keeps every finding regardless of open files');
    test(m.scopeFindings(FINDINGS, 'workspace', []) !== FINDINGS,
      'scope "workspace" returns a copy, not the cache array');
    var openOne = m.scopeFindings(FINDINGS, 'openFiles', ['/w/src/Foo.js']);
    test(openOne.length === 1 && openOne[0].check === 'pom-membership',
      'scope "openFiles" keeps only findings anchored in an open file');
    test(m.scopeFindings(FINDINGS, 'openFiles', []).length === 0,
      'scope "openFiles" with nothing open yields no findings');
    test(m.scopeFindings(FINDINGS, 'unknown-scope', []).length === 0,
      'unknown scope value falls back to the safe "openFiles" behaviour');

    // --- groupByFile ---
    var grouped = m.groupByFile(FINDINGS);
    test(grouped.size === 3, 'groupByFile returns one entry per distinct path (got ' + grouped.size + ')');
    test(grouped.get('/w/src/strategyReferences.jrl').length === 2,
      'groupByFile collects both findings sharing a path');
    var pBucket = grouped.get('/w/src/strategyReferences.jrl');
    test(pBucket[0].line === 7 && pBucket[1].line === 11,
      'groupByFile preserves input order within a bucket');
    test(grouped.get('/w/src/Foo.js')[0] === FINDINGS[2],
      'groupByFile stores the finding objects themselves');

    // --- toDiagnosticData ---
    var d0 = m.toDiagnosticData(FINDINGS[0]);
    test(d0.line === 2, 'toDiagnosticData converts 1-based finding line to 0-based (3 -> ' + d0.line + ')');
    test(d0.severity === 'error', 'toDiagnosticData carries severity through');
    test(d0.code === 'rule-group', 'toDiagnosticData sets code to the check name');
    test(d0.message.indexOf('rule references missing group') === 0,
      'toDiagnosticData message starts with the finding message');
    test(d0.message.indexOf('\nfix: add the group') !== -1,
      'toDiagnosticData appends the fix hint when present');
    test(m.toDiagnosticData(FINDINGS[1]).message.indexOf('fix:') === -1,
      'toDiagnosticData omits the fix line when the finding has no hint');
    test(m.toDiagnosticData({ check: 'x', severity: 'warn', path: '/a', line: 0, message: 'm' }).line === 0,
      'toDiagnosticData clamps a 0 line to 0 rather than -1');

    // --- summarize ---
    var s = m.summarize(FINDINGS);
    test(s.errors === 2 && s.warns === 2, 'summarize counts errors and warns (' + s.errors + '/' + s.warns + ')');
    var sOne = m.summarize([ FINDINGS[0], FINDINGS[1], FINDINGS[3] ]);
    test(sOne.errors === 1 && sOne.warns === 2,
      'summarize does not confuse errors with warns (' + sOne.errors + '/' + sOne.warns + ')');
    test(s.byCheck.length === 3, 'summarize buckets by check name');
    test(s.byCheck[0].check === 'strategy-ref' && s.byCheck[0].count === 2,
      'summarize orders buckets by descending count');
    test(s.byCheck[1].check === 'pom-membership' && s.byCheck[2].check === 'rule-group',
      'summarize breaks equal counts alphabetically');
  }
}
