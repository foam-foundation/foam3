/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'LintHandler',

  documentation: `Registration-completeness lint — cross-file checks the
    per-file diagnostics cannot see: a Rule whose ruleGroup is defined
    nowhere (the rule never runs; the only sign is a startup log line), a StrategyReference pointing at a
    missing class, strategy implementors with no StrategyReference entry
    (invisible in the Rule-creation UI), and POM membership (delegates to
    PomValidator). Serves the custom foam/lint request. Never uses reference
    search — jrl cross-referencing goes through JrlLoader + FoamIndex only.
    Checks degrade gracefully: without 'index' the strategy-ref implementor
    direction (Direction B) is skipped, and without 'pomValidator'
    pom-membership returns no findings.`,

  requires: [ 'foam.parse.lsp.JrlLoader' ],

  constants: {
    // Canonical list lives in ../lintChecks.js — shared with the MCP
    // foam_lint schema so a new check registers on both surfaces at once.
    ALL_CHECKS: require('../lintChecks'),
    DEFAULT_STRATEGY_TARGETS: [ 'foam.core.ruler.RuleAction' ],
    IGNORE_MARKER: 'foam-lint-ignore: strategy-ref',
    // The files each check reads. A finding can sit in a file the change
    // never touched: rename a group in ruleGroups.jrl and the error lands on
    // the rules.jrl that names it. So a 'paths' scope keeps every finding of
    // a check once one of that check's inputs is among the paths.
    // pom-membership has no entry: every pom.js feeds every orphan finding,
    // so adding a class with its pom entry would report all orphans in the
    // tree. Its findings stay limited to the touched files.
    CHECK_INPUTS: {
      'rule-group':     [ 'rules.jrl', 'ruleGroups.jrl' ],
      'strategy-ref':   [ 'strategyReferences.jrl' ]
    }
  },

  properties: [
    { name: 'index' },
    { name: 'pomValidator' },
    {
      name: 'loader',
      factory: function() { return this.JrlLoader.create(); }
    },
    {
      name: 'root',
      factory: function() { return process.cwd(); }
    }
  ],

  methods: [
    function findJrlFiles_(basenames) {
      /** One bounded walk from root collecting files with any of these exact
          basenames: { basename: [absolute paths] }, every name present.
          Same skip rules as PomValidator.walkSourceTree_. */
      var fs = require('fs');
      var path = require('path');
      var out = {};
      for ( var b = 0 ; b < basenames.length ; b++ ) out[basenames[b]] = [];
      var stack = [ this.root ];
      while ( stack.length ) {
        var dir = stack.pop();
        var entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch (e) { require('../logError').logLspError('lint: read dir ' + dir, e); continue; }
        for ( var i = 0 ; i < entries.length ; i++ ) {
          var ent = entries[i];
          if ( ent.name.charAt(0) === '.' )             continue;
          if ( ent.name === 'node_modules' )            continue;
          if ( ent.name === 'build' || ent.name === 'out' ) continue;
          var full = path.join(dir, ent.name);
          if ( ent.isDirectory() ) stack.push(full);
          else if ( ent.isFile() && out.hasOwnProperty(ent.name) ) out[ent.name].push(full);
        }
      }
      return out;
    },

    function loadEntries_(filePath) {
      /** The journal's entries as [ { obj, line } ], line 0-based where the
          entry starts (JrlLoader.loadStringWithLines). */
      var text;
      try { text = require('fs').readFileSync(filePath, 'utf8'); }
      catch (e) { require('../logError').logLspError('lint: read ' + filePath, e); return []; }
      return this.loader.loadStringWithLines(text);
    },

    function underSrc_(filePath) {
      /** True when a src/ directory sits between root and filePath. Tested on
          the root-relative path: a checkout under ~/src/ would otherwise put
          every file under /src/. */
      var path = require('path');
      return ( path.sep + path.relative(this.root, filePath) ).indexOf(path.sep + 'src' + path.sep) !== -1;
    },

    function finding_(check, severity, filePath, line, message, fix, subject) {
      var f = { check: check, severity: severity, path: filePath, line: line, message: message };
      if ( fix ) f.fix = fix;
      // The class a finding is about, when that class's file is not the
      // finding's own path. Non-enumerable: it serves the 'paths' scope only
      // and stays out of the JSON a client receives.
      if ( subject ) Object.defineProperty(f, 'subject_', { value: subject });
      return f;
    },

    function checkRuleGroups_(files) {
      var path = require('path');
      var self = this;
      var findings = [];
      files = files || this.findJrlFiles_(this.CHECK_INPUTS['rule-group']);

      // groupId → [defining files]
      var defs = {};
      var groupFiles = files['ruleGroups.jrl'];
      for ( var i = 0 ; i < groupFiles.length ; i++ ) {
        var groups = this.loader.filterByClass(
          this.loader.loadFile(groupFiles[i]), 'foam.core.ruler.RuleGroup');
        for ( var j = 0 ; j < groups.length ; j++ ) {
          if ( groups[j].id == null ) continue;
          ( defs[groups[j].id] || (defs[groups[j].id] = []) ).push(groupFiles[i]);
        }
      }

      // Reachable = same dir as the rules.jrl, OR anywhere under
      // <root>/journals/, OR any src/ path below root; a group only defined
      // in a DIFFERENT deployment dir demotes the finding to a warn (not an
      // error).
      function reachable(defFile, ruleFile) {
        if ( path.dirname(defFile) === path.dirname(ruleFile) ) return true;
        if ( defFile.indexOf(path.join(self.root, 'journals') + path.sep) === 0 ) return true;
        return self.underSrc_(defFile);
      }

      // Every row, whatever its class: Rule subclasses (DUGRule,
      // PermissionedUserRule, ...) name a ruleGroup too. A row with no
      // ruleGroup takes 'default' and is skipped below.
      var ruleFiles = files['rules.jrl'];
      for ( var i = 0 ; i < ruleFiles.length ; i++ ) {
        var rules = this.loadEntries_(ruleFiles[i]);
        for ( var j = 0 ; j < rules.length ; j++ ) {
          var rule = rules[j].obj;
          if ( ! rule.ruleGroup ) continue;
          var defFiles = defs[rule.ruleGroup] || [];
          var line = rules[j].line + 1;
          if ( defFiles.length === 0 ) {
            findings.push(this.finding_('rule-group', 'error', ruleFiles[i], line,
              "rule '" + rule.id + "' references ruleGroup '" + rule.ruleGroup +
              "' — not defined in any ruleGroups.jrl (the rule never runs; the server only logs 'RuleGroup not found' at startup)",
              'add the group to ' + path.join(path.dirname(ruleFiles[i]), 'ruleGroups.jrl')));
          } else if ( ! defFiles.some(function(d) { return reachable(d, ruleFiles[i]); }) ) {
            findings.push(this.finding_('rule-group', 'warn', ruleFiles[i], line,
              "rule '" + rule.id + "' references ruleGroup '" + rule.ruleGroup +
              "' — only defined in other deployment dirs: " +
              defFiles.map(function(d) { return path.relative(self.root, path.dirname(d)); }).join(', '),
              'define the group beside the rule or in journals/'));
          }
        }
      }
      return findings;
    },

    function checkStrategyRefs_(strategyTargets, files) {
      var fs = require('fs');
      var path = require('path');
      var findings = [];
      var targets = ( strategyTargets && strategyTargets.length ) ?
        strategyTargets : this.DEFAULT_STRATEGY_TARGETS;
      files = files || this.findJrlFiles_(this.CHECK_INPUTS['strategy-ref']);

      // Collect all StrategyReference entries; Direction A along the way.
      var registered = {};
      var refFiles = files['strategyReferences.jrl'];
      for ( var i = 0 ; i < refFiles.length ; i++ ) {
        var refs = this.loadEntries_(refFiles[i]);
        for ( var j = 0 ; j < refs.length ; j++ ) {
          var ref = refs[j].obj;
          if ( ref['class'] !== 'foam.strategy.StrategyReference' ) continue;
          if ( ! ref.strategy ) continue;
          registered[ref.strategy] = true;
          if ( this.index && ! this.index.classExists(ref.strategy) ) {
            var flagGatedPath = this.index.getFilePath && this.index.getFilePath(ref.strategy);
            if ( flagGatedPath ) {
              findings.push(this.finding_('strategy-ref', 'warn', refFiles[i], refs[j].line + 1,
                "StrategyReference '" + (ref.id || '') + "' points at class '" + ref.strategy +
                "' — registered in a pom but flag-gated (not loaded under current flags)",
                'expected for test-only strategies; verify the flags if this should be a production class',
                ref.strategy));
            } else {
              findings.push(this.finding_('strategy-ref', 'error', refFiles[i], refs[j].line + 1,
                "StrategyReference '" + (ref.id || '') + "' points at class '" + ref.strategy +
                "' which does not exist in the index",
                'fix the class id or delete the stale entry',
                ref.strategy));
            }
          }
        }
      }

      // Direction B: implementors of each target with no entry.
      if ( ! this.index ) return findings;
      var srcRoot = path.join(this.root, 'src') + path.sep;
      for ( var t = 0 ; t < targets.length ; t++ ) {
        var impls = this.index.isInterface(targets[t]) ?
          this.index.getImplementors(targets[t]) :
          this.index.getSubclasses(targets[t]);
        for ( var k = 0 ; k < impls.length ; k++ ) {
          if ( registered[impls[k]] ) continue;
          var file = this.index.getFilePath(impls[k]);
          if ( ! file || file.indexOf(srcRoot) !== 0 ) continue;
          var text;
          try { text = fs.readFileSync(file, 'utf8'); }
          catch (e) { require('../logError').logLspError('lint: read ' + file, e); continue; }
          if ( text.indexOf(this.IGNORE_MARKER) !== -1 ) continue;
          findings.push(this.finding_('strategy-ref', 'warn', file,
            (this.index.getClassLine(impls[k]) || 0) + 1,
            "'" + impls[k] + "' implements " + targets[t] +
            " but has no StrategyReference entry — invisible in the Rule-creation UI" +
            " (intentional for jrl-only actions)",
            "add an entry to strategyReferences.jrl, or add '// " + this.IGNORE_MARKER + "' to the class file"));
        }
      }
      return findings;
    },

    function checkPomMembership_() {
      if ( ! this.pomValidator ) return [];
      var r = this.pomValidator.validate();
      var findings = [];
      for ( var i = 0 ; i < r.orphans.length ; i++ ) {
        findings.push(this.finding_('pom-membership', 'error', r.orphans[i], 1,
          'foam.CLASS file not listed in any pom.js — the class never compiles into a build',
          'add an entry to the nearest pom.js (copy a sibling entry for the flags)'));
      }
      for ( var i = 0 ; i < r.missing.length ; i++ ) {
        findings.push(this.finding_('pom-membership', 'error', r.missing[i], 1,
          'pom.js entry points at a file that does not exist',
          'remove the stale entry or restore the file'));
      }
      return findings;
    },

    function scopeToPaths_(findings, paths) {
      /** Findings a change to `paths` (root-relative or absolute) can have
          caused: those anchored in one of the paths; every finding of a
          check whose input file is among them; and a finding about a class
          whose file is among them (a deleted strategy class leaves its error
          on strategyReferences.jrl). */
      var path = require('path');
      var self = this;
      var keep = {}, basenames = {};
      var abs = paths.map(function(p) { return path.resolve(self.root, p); });
      for ( var i = 0 ; i < abs.length ; i++ ) {
        keep[abs[i]] = true;
        basenames[path.basename(abs[i])] = true;
      }
      function touched(check) {
        return ( self.CHECK_INPUTS[check] || [] ).some(function(b) { return basenames[b]; });
      }
      function subjectTouched(classId) {
        var tail = path.sep + classId.split('.').join(path.sep) + '.js';
        return abs.some(function(p) { return p.slice(-tail.length) === tail; });
      }
      return findings.filter(function(f) {
        return keep[f.path] || touched(f.check) || ( f.subject_ && subjectTouched(f.subject_) );
      });
    },

    function lint(params) {
      params = params || {};
      var checks = ( params.checks && params.checks.length ) ? params.checks : this.ALL_CHECKS;
      var allChecks = this.ALL_CHECKS;
      var unknown = checks.filter(function(c) { return allChecks.indexOf(c) === -1; });
      if ( unknown.length ) {
        throw new Error('unknown check(s): ' + unknown.join(', ') + ' — valid: ' + this.ALL_CHECKS.join(', '));
      }

      // One workspace walk for every journal the selected checks read.
      var names = [];
      if ( checks.indexOf('rule-group') !== -1 )   names = names.concat(this.CHECK_INPUTS['rule-group']);
      if ( checks.indexOf('strategy-ref') !== -1 ) names = names.concat(this.CHECK_INPUTS['strategy-ref']);
      var files = names.length ? this.findJrlFiles_(names) : {};

      var findings = [];
      if ( checks.indexOf('pom-membership') !== -1 ) findings = findings.concat(this.checkPomMembership_());
      if ( checks.indexOf('rule-group') !== -1 )     findings = findings.concat(this.checkRuleGroups_(files));
      if ( checks.indexOf('strategy-ref') !== -1 )   findings = findings.concat(this.checkStrategyRefs_(params.strategyTargets, files));

      if ( params.scope === 'paths' && Array.isArray(params.paths) ) {
        findings = this.scopeToPaths_(findings, params.paths);
      }
      return { findings: findings };
    }
  ]
});
