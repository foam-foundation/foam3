/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registration-completeness lint (LintHandler): jrl discovery, rule-group,
// strategy-ref, pom-membership mapping, scope filtering.
// Uses throwaway fixture trees in os.tmpdir() + a duck-typed stub index so
// the checks are tested in isolation from the real workspace.

var h = require('./_harness');
var test = h.test, section = h.section;
var fs = require('fs');
var os = require('os');
var path = require('path');

section('LintHandler — fixtures');

// One shared fixture tree for all lint tests.
var FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-lint-'));
function write(rel, content, base) {
  var p = path.join(base || FIX, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

// deployment/alpha: rule referencing a group that DOES exist locally
write('deployment/alpha/rules.jrl',
  'p({"class":"foam.core.ruler.Rule","id":"alpha-rule","ruleGroup":"alpha-group"})\n');
write('deployment/alpha/ruleGroups.jrl',
  'p({"class":"foam.core.ruler.RuleGroup","id":"alpha-group"})\n');
// deployment/beta: rule referencing a group defined NOWHERE
write('deployment/beta/rules.jrl',
  'p({"class":"foam.core.ruler.Rule","id":"beta-rule","ruleGroup":"missing-group"})\n');
// deployment/gamma: rule whose group exists only in deployment/alpha (cross-deployment → warn)
write('deployment/gamma/rules.jrl',
  'p({"class":"foam.core.ruler.Rule","id":"gamma-rule","ruleGroup":"alpha-group"})\n');
// deployment/zeta: a Rule SUBCLASS row, written multi-line, naming a missing group
write('deployment/zeta/rules.jrl',
  'p({"class":"foam.core.ruler.Rule","id":"zeta-ok","ruleGroup":"alpha-group"})\n' +
  'p({\n  "class": "foam.core.dig.DUGRule",\n  "id": "zeta-dug",\n  "ruleGroup": "zeta-missing"\n})\n');

var handler = foam.parse.lsp.handlers.LintHandler.create({ root: FIX });

var found = handler.findJrlFiles_([ 'rules.jrl', 'ruleGroups.jrl', 'strategyReferences.jrl' ]);
test(found['rules.jrl'].length === 4, 'findJrlFiles_ finds all rules.jrl (got ' + found['rules.jrl'].length + ')');
test(found['rules.jrl'].every(function(f) { return path.isAbsolute(f); }), 'findJrlFiles_ returns absolute paths');
test(found['ruleGroups.jrl'].length === 1,
  'findJrlFiles_ collects every requested name in the same walk (got ' + found['ruleGroups.jrl'].length + ')');
test(Array.isArray(found['strategyReferences.jrl']) && found['strategyReferences.jrl'].length === 0,
  'findJrlFiles_ answers an empty list for a name with no file');

section('LintHandler — rule-group');

var rg = handler.checkRuleGroups_();

var betaFinding = rg.filter(function(f) { return f.message.indexOf('missing-group') !== -1; });
test(betaFinding.length === 1, 'undefined ruleGroup produces exactly one finding');
test(betaFinding[0] && betaFinding[0].severity === 'error', 'undefined ruleGroup is an error');
test(betaFinding[0] && betaFinding[0].check === 'rule-group', 'finding.check is rule-group');
test(betaFinding[0] && betaFinding[0].path === path.join(FIX, 'deployment/beta/rules.jrl'),
  'finding anchored at the rules.jrl that references the group');
test(betaFinding[0] && /never runs/.test(betaFinding[0].message),
  'message states the consequence (the rule never runs)');

var gammaFinding = rg.filter(function(f) { return f.path.indexOf('gamma') !== -1; });
test(gammaFinding.length === 1 && gammaFinding[0].severity === 'warn',
  'group defined only in another deployment dir is a warn');
test(gammaFinding[0] && gammaFinding[0].message.indexOf('deployment/alpha') !== -1,
  'cross-deployment warn names the dir that does define the group');

test(rg.filter(function(f) { return f.path.indexOf('alpha') !== -1; }).length === 0,
  'locally-defined group produces no finding');

var zeta = rg.filter(function(f) { return f.message.indexOf('zeta-missing') !== -1; });
test(zeta.length === 1 && zeta[0].severity === 'error',
  'a Rule subclass row (DUGRule) is checked too, not only class foam.core.ruler.Rule');
test(zeta[0] && zeta[0].line === 2,
  'finding line is the 1-based line the jrl entry starts on (got ' + ( zeta[0] && zeta[0].line ) + ')');
test(betaFinding[0] && betaFinding[0].line === 1, 'single-line entry on line 1 reports line 1');

// A checkout that itself sits under a directory named src: only a src/ BELOW
// the root makes a group reachable from every deployment dir.
var SRCPARENT = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-lint-srcparent-'));
var SRCROOT   = path.join(SRCPARENT, 'src', 'checkout');
write('deployment/one/ruleGroups.jrl', 'p({"class":"foam.core.ruler.RuleGroup","id":"one-group"})\n', SRCROOT);
write('deployment/two/rules.jrl',
  'p({"class":"foam.core.ruler.Rule","id":"two-rule","ruleGroup":"one-group"})\n', SRCROOT);
write('src/three/ruleGroups.jrl', 'p({"class":"foam.core.ruler.RuleGroup","id":"three-group"})\n', SRCROOT);
write('deployment/four/rules.jrl',
  'p({"class":"foam.core.ruler.Rule","id":"four-rule","ruleGroup":"three-group"})\n', SRCROOT);
var srcParentRg = foam.parse.lsp.handlers.LintHandler.create({ root: SRCROOT }).checkRuleGroups_();
test(srcParentRg.length === 1 && srcParentRg[0].severity === 'warn' && srcParentRg[0].path.indexOf('two') !== -1,
  'root under a src/ dir: a group only in another deployment dir still warns (got ' + srcParentRg.length + ')');
test(! srcParentRg.some(function(f) { return f.path.indexOf('four') !== -1; }),
  'root under a src/ dir: a group under <root>/src/ is still reachable');

section('LintHandler — strategy-ref');

// Fixture jrl + implementor source files
write('src/com/example/strategyReferences.jrl',
  'p({"class":"foam.strategy.StrategyReference","id":"ex.Registered","desiredModelId":"foam.core.ruler.RuleAction","strategy":"com.example.RegisteredAction"})\n' +
  'p({"class":"foam.strategy.StrategyReference","id":"ex.Ghost","desiredModelId":"foam.core.ruler.RuleAction","strategy":"com.example.MissingAction"})\n' +
  'p({"class":"foam.strategy.StrategyReference","id":"ex.TestOnly","desiredModelId":"foam.core.ruler.RuleAction","strategy":"com.example.TestOnlyAction"})\n');
write('src/com/example/RegisteredAction.js',   "foam.CLASS({ package: 'com.example', name: 'RegisteredAction' });\n");
write('src/com/example/UnregisteredAction.js', "foam.CLASS({ package: 'com.example', name: 'UnregisteredAction' });\n");
write('src/com/example/SuppressedAction.js',
  "// foam-lint-ignore: strategy-ref\nfoam.CLASS({ package: 'com.example', name: 'SuppressedAction' });\n");

var stubIndex = {
  classExists:     function(id) {
    return id !== 'com.example.MissingAction' && id !== 'com.example.TestOnlyAction';
  },
  isInterface:     function(id) { return true; },
  getImplementors: function(id) {
    return [ 'com.example.RegisteredAction', 'com.example.UnregisteredAction',
             'com.example.SuppressedAction', 'foam.core.ruler.CompositeRuleAction' ];
  },
  getSubclasses:   function(id) { return []; },
  getFilePath:     function(id) {
    // MissingAction has no file at all (true dangling ref); TestOnlyAction
    // resolves to a path but isn't loaded under current flags (flag-gated).
    if ( id === 'com.example.MissingAction' ) return null;
    if ( id.indexOf('com.example.') !== 0 ) return FIX + '/foam3/src/foam/core/ruler/CompositeRuleAction.js';
    return path.join(FIX, 'src/com/example', id.split('.').pop() + '.js');
  },
  getClassLine:    function(id) { return 0; }
};

var handlerWithIndex = foam.parse.lsp.handlers.LintHandler.create({ root: FIX, index: stubIndex });
var sr = handlerWithIndex.checkStrategyRefs_();

var ghost = sr.filter(function(f) { return f.message.indexOf('MissingAction') !== -1; });
test(ghost.length === 1 && ghost[0].severity === 'error',
  'StrategyReference to a nonexistent class is an error');
test(ghost[0] && ghost[0].path.indexOf('strategyReferences.jrl') !== -1,
  'error anchored at the jrl entry');

var flagGated = sr.filter(function(f) { return f.message.indexOf('TestOnlyAction') !== -1; });
test(flagGated.length === 1 && flagGated[0].severity === 'warn',
  'StrategyReference to a class registered in a pom but flag-gated is a warn, not an error');
test(flagGated[0] && /flag-gated/.test(flagGated[0].message),
  'flag-gated warn message notes it is registered but not loaded under current flags');

var unreg = sr.filter(function(f) { return f.message.indexOf('UnregisteredAction') !== -1; });
test(unreg.length === 1 && unreg[0].severity === 'warn',
  'implementor with no StrategyReference entry is a warn');
test(unreg[0] && /invisible/.test(unreg[0].message),
  'warn states the consequence (invisible in Rule-creation UI)');
test(unreg[0] && unreg[0].line === 1, 'implementor warn line is 1-based');

test(sr.filter(function(f) { return f.message.indexOf('RegisteredAction') !== -1; }).length === 0,
  'registered implementor produces no finding');
test(sr.filter(function(f) { return f.message.indexOf('SuppressedAction') !== -1; }).length === 0,
  'foam-lint-ignore marker suppresses the warn');
test(sr.filter(function(f) { return f.message.indexOf('CompositeRuleAction') !== -1; }).length === 0,
  'implementors outside <root>/src are skipped (foam3 core noise)');

section('LintHandler — pom-membership mapping + lint() orchestrator');

var stubValidator = {
  validate: function() {
    return {
      orphans:    [ path.join(FIX, 'src/com/example/Orphan.js') ],
      missing:    [ path.join(FIX, 'src/com/example/Gone.js') ],
      duplicates: [ { path: path.join(FIX, 'src/com/example/Dup.js'),
                      classIds: [ 'com.example.A', 'com.example.B' ] } ]
    };
  }
};
var full = foam.parse.lsp.handlers.LintHandler.create({
  root: FIX, index: stubIndex, pomValidator: stubValidator
});

var pm = full.checkPomMembership_();
test(pm.length === 2, 'orphans + missing buckets → two findings (got ' + pm.length + ')');
test(pm.filter(function(f) { return f.severity === 'error'; }).length === 2,
  'orphan + missing are errors');
test(pm.some(function(f) { return /not listed in any pom\.js/.test(f.message); }),
  'orphan message says not listed in any pom.js');

var all = full.lint({});
test(all && Array.isArray(all.findings), 'lint({}) returns { findings: [] }');
test(full.ALL_CHECKS.every(function(c) { return all.findings.some(function(f) { return f.check === c; }); }),
  'lint({}) runs every check');
test(JSON.stringify(full.ALL_CHECKS) === JSON.stringify([ 'pom-membership', 'rule-group', 'strategy-ref' ]),
  'ALL_CHECKS is the three registration checks');

var only = full.lint({ checks: [ 'rule-group' ] });
test(only.findings.length > 0 && only.findings.every(function(f) { return f.check === 'rule-group'; }),
  'checks filter runs only the named checks');

var unknownThrew = false, unknownMsg = '';
try { full.lint({ checks: [ 'pom_membership' ] }); }
catch ( e ) { unknownThrew = true; unknownMsg = e.message; }
test(unknownThrew && unknownMsg.indexOf('unknown check') !== -1,
  'lint() throws on an unrecognized check name instead of silently reading clean');

section('LintHandler — paths scope');

var orphanPath = path.join(FIX, 'src/com/example/Orphan.js');
var scoped = full.lint({ scope: 'paths', paths: [ orphanPath ] });
test(scoped.findings.length === 1 && scoped.findings[0].path === orphanPath,
  'paths scope keeps a finding anchored in a given file, and nothing from untouched checks');

var scopedRel = full.lint({ scope: 'paths', paths: [ 'src/com/example/Orphan.js' ] });
test(scopedRel.findings.length === 1 && scopedRel.findings[0].path === orphanPath,
  'paths scope resolves root-relative inputs (diff mode passes git-relative paths)');

test(full.lint({ scope: 'paths', paths: [ 'README.md' ] }).findings.length === 0,
  'paths scope touching no check input and no anchored file yields nothing');

var viaRules = full.lint({ scope: 'paths', paths: [ 'deployment/beta/rules.jrl' ] });
test(viaRules.findings.some(function(f) { return f.path.indexOf('gamma') !== -1; }) &&
     viaRules.findings.every(function(f) { return f.check === 'rule-group'; }),
  'touching a rules.jrl keeps every rule-group finding, even ones in other rules.jrl files');

var viaPom = full.lint({ scope: 'paths', paths: [ 'src/com/example/pom.js' ] });
test(! viaPom.findings.some(function(f) { return f.path === orphanPath; }),
  'touching a pom.js keeps only findings in that pom.js, not every orphan in the tree');

// The rename: the diff holds only ruleGroups.jrl, the error lands on the
// rules.jrl that still names the old id.
var REN = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-lint-rename-'));
write('deployment/a/rules.jrl',
  'p({"class":"foam.core.ruler.Rule","id":"a-rule","ruleGroup":"Notifications"})\n', REN);
write('deployment/a/ruleGroups.jrl',
  'p({"class":"foam.core.ruler.RuleGroup","id":"Notifications"})\n', REN);
var renHandler = foam.parse.lsp.handlers.LintHandler.create({ root: REN });
var renParams  = { scope: 'paths', paths: [ 'deployment/a/ruleGroups.jrl' ], checks: [ 'rule-group' ] };
test(renHandler.lint(renParams).findings.length === 0, 'rename case: clean before the rename');
write('deployment/a/ruleGroups.jrl',
  'p({"class":"foam.core.ruler.RuleGroup","id":"NotificationsRenamed"})\n', REN);
var renamed = renHandler.lint(renParams).findings;
test(renamed.length === 1 && renamed[0].severity === 'error' &&
     renamed[0].path === path.join(REN, 'deployment/a/rules.jrl'),
  'rename case: a diff with only ruleGroups.jrl reports the error on the untouched rules.jrl');

// A deleted strategy class: its error lands on strategyReferences.jrl, which
// the diff does not hold.
var viaClass = full.lint({ scope: 'paths', paths: [ 'src/com/example/MissingAction.js' ], checks: [ 'strategy-ref' ] });
test(viaClass.findings.length === 1 && viaClass.findings[0].message.indexOf('MissingAction') !== -1 &&
     viaClass.findings[0].path.indexOf('strategyReferences.jrl') !== -1,
  'deleted strategy class: the dangling-entry error is kept, and only that one');
test(JSON.stringify(viaClass.findings[0]).indexOf('subject') === -1,
  'the class a finding is about stays out of the JSON a client receives');

var viaRefs = full.lint({ scope: 'paths', paths: [ 'src/com/example/strategyReferences.jrl' ], checks: [ 'strategy-ref' ] });
test(viaRefs.findings.some(function(f) { return f.message.indexOf('UnregisteredAction') !== -1; }),
  'touching strategyReferences.jrl keeps every strategy-ref finding, including the implementor warns');
