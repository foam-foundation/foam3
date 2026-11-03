/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// GrammarLintMaker - after all models load, runs foam.parse.lint.GrammarLint
// over every class and prints one line per finding. Run it with
// tools/lintGrammars.js.

var path_ = require('path');

exports.description = 'checks every foam.parse grammar for undefined rules, orphan actions, left recursion and similar mistakes';

exports.init = function() {
  flags.loadFiles = true;
  flags.js        = true;
  flags.web       = true;
  // GrammarLint is flagged js&test|grammarlint: test builds and this tool
  // load it, an app's production bundle does not.
  flags.grammarlint = true;
};

exports.end = function() {
  // Promote UNUSED models to USED so every class is built (same as LSPMaker).
  for ( var i = 0 ; i < 2 ; i++ ) {
    for ( var key in foam.UNUSED ) {
      try { foam.maybeLookup(key); } catch (x) {}
    }
  }

  var lint    = foam.parse.lint.GrammarLint.create();
  var classes = [];
  Object.keys(foam.USED).sort().forEach(function(id) {
    var cls;
    try { cls = foam.lookup(id, true); } catch (x) { return; }
    if ( ! cls || ! cls.getOwnAxiomsByClass ) return;
    if ( lint.isChecked(cls) ) classes.push(cls);
  });

  // Building a grammar from data can log (a missing import, no DAO); that is
  // not a finding, and lintGrammars.js has console silenced for the whole run.
  var cwd      = process.cwd();
  var findings = lint.lintClasses(classes);
  findings.forEach(function(f) { if ( f.source ) f.source = path_.relative(cwd, f.source); });

  // stdout directly: lintGrammars.js silences console so loading noise stays out of the report.
  var out   = function(line) { process.stdout.write(line + '\n'); };
  var count = function(s, opt_check) {
    return findings.filter(function(f) { return f.severity === s && ( ! opt_check || f.check === opt_check ); }).length;
  };
  findings.forEach(function(f) { out(f.toString()); });
  out(`[GrammarLint] ${classes.length} grammar classes checked: ${count('error')} errors, ${count('warning')} warnings, ` +
      `${count('skip', 'not-built')} not built, ${count('skip', 'unreachable')} without the unreachable check.`);

  process.exitCode = count('error') ? 1 : 0;
};
