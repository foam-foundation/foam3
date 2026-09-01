/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'PomValidator',

  documentation: 'POM-membership diagnostics — flags orphan FOAM model files (a .js with foam.CLASS that no pom.js lists), POMs referencing files that no longer exist, and duplicate registrations. Result feeds the custom foam/validatePoms request and rolls up into the workspace analyzer.',

  properties: [
    { name: 'index' }
  ],

  methods: [
    function validate() {
      // Returns { orphans: [path], missing: [{pomFile, missingPath}], duplicates: [{classId, paths}] }
      //
      // Source of truth: FoamIndex.fileIndex_ — built at boot by walking
      // every pom.js. It already maps classId → file path. We cross-check
      // against the filesystem under src/.

      var fs   = require('fs');
      var path = require('path');

      var fileIndex = this.index.fileIndex_ || {};
      var indexedPaths = {};
      var duplicates   = [];
      var pathToIds    = {};

      for ( var id in fileIndex ) {
        var entry = fileIndex[id];
        var p     = typeof entry === 'string' ? entry : entry.path;
        if ( ! p ) continue;
        indexedPaths[p] = true;
        ( pathToIds[p] || (pathToIds[p] = []) ).push(id);
      }
      for ( var p in pathToIds ) {
        if ( pathToIds[p].length > 1 ) {
          duplicates.push({ path: p, classIds: pathToIds[p] });
        }
      }

      // Missing files: POM entry exists but disk file doesn't.
      var missing = [];
      for ( var p in indexedPaths ) {
        if ( ! fs.existsSync(p) ) missing.push(p);
      }

      // Orphans: walk a small set of expected source roots looking for
      // .js files that contain a foam.CLASS / foam.ENUM / foam.INTERFACE
      // call but aren't in the POM index. We bound the walk to typical
      // FOAM source roots to keep this O(workspace) rather than O(fs).
      var orphans   = [];
      var pomFiles  = [];
      var sourceRoots = this.detectSourceRoots_(indexedPaths);
      var FOAM_DECL = /foam\.(?:CLASS|ENUM|INTERFACE|RELATIONSHIP|LIB)\s*\(/;

      for ( var i = 0 ; i < sourceRoots.length ; i++ ) {
        // The project's top-level pom.js sits one level ABOVE the src root
        // the walk covers.
        var rootPom = path.join(path.dirname(sourceRoots[i]), 'pom.js');
        if ( fs.existsSync(rootPom) ) pomFiles.push(rootPom);

        this.walkSourceTree_(sourceRoots[i], function(filePath) {
          if ( ! filePath.endsWith('.js') )      return;
          if ( filePath.endsWith('/pom.js') )     { pomFiles.push(filePath); return; }
          if ( indexedPaths[filePath] )           return;
          // Skip test/, generated/etc. — only flag plain-source orphans.
          if ( /\/test\//.test(filePath) )        return;
          if ( filePath.endsWith('tests.jrl') )   return;
          try {
            var text = fs.readFileSync(filePath, 'utf8');
            if ( FOAM_DECL.test(text) ) orphans.push(filePath);
          } catch (e) {}
        });
      }

      // Entry-level issues (whitespace, unknown flags, missing files) rolled
      // up across every pom the walk found.
      var entryIssues = [];
      for ( var i = 0 ; i < pomFiles.length ; i++ ) {
        try {
          var pomText = fs.readFileSync(pomFiles[i], 'utf8');
          var issues  = this.validateEntries(pomText, pomFiles[i]);
          for ( var j = 0 ; j < issues.length ; j++ ) {
            issues[j].pomFile = pomFiles[i];
            entryIssues.push(issues[j]);
          }
        } catch (e) {}
      }

      return { orphans: orphans, missing: missing, duplicates: duplicates,
        entryIssues: entryIssues };
    },

    function validateEntries(text, pomPath) {
      /** Entry-level checks on ONE pom.js source text: whitespace inside
       *  name/flags values, unknown flag tokens, entries pointing at files
       *  that don't exist on disk. Returns
       *  [{severity: 1|2, start, end, code, message}] with offsets into
       *  `text`. Positions come from the grammar harvest (pomFileName /
       *  pomJavaFileName / pomFlagValue kinds) — never from regex scans.
       *
       *  Deliberately validates WITHOUT trimming: it mirrors what
       *  foam.checkFlags actually matches (src/foam.js), so a spaced token
       *  is reported as the silent no-match it is.
       */
      var fs     = require('fs');
      var path   = require('path');
      var issues = [];
      var map    = this.grammar_().collectAxiomPositions(text);
      var pomDir = pomPath ? path.dirname(pomPath) : null;

      // Flag vocabulary measured across the repo's poms (2026-08-23).
      // Unknown tokens WARN rather than ERROR — this list drifts as new
      // flags appear.
      var KNOWN = { js: 1, java: 1, web: 1, test: 1, node: 1, swift: 1,
        debug: 1, demo: 1, dev: 1, genjava: 1, sql: 1, firebase: 1, gcloud: 1 };

      function push(rec, severity, code, message) {
        issues.push({ severity: severity, code: code, message: message,
          start: rec.startPos, end: rec.endPos });
      }

      // Every span of a kind, flattened; single-occurrence kinds hold one
      // record per name, MULTI kinds an array. Dedupe by startPos — the
      // grammar's backtracking can record the same span twice.
      function eachSpan(kind, cb) {
        var byName = map[kind] || {}, seen = {};
        for ( var name in byName ) {
          var recs = byName[name];
          if ( ! Array.isArray(recs) ) recs = [ recs ];
          for ( var i = 0 ; i < recs.length ; i++ ) {
            if ( seen[recs[i].startPos] ) continue;
            seen[recs[i].startPos] = true;
            cb(name, recs[i]);
          }
        }
      }

      function checkName(kind, ext) {
        eachSpan(kind, function(content, rec) {
          if ( content !== content.trim() || /\s/.test(content) ) {
            push(rec, 1, 'pom-name-whitespace',
              'whitespace in pom file name ' + "'" + content + "'" +
              ' — the build resolves the name verbatim');
            return;
          }
          if ( ! pomDir ) return;
          if ( ! fs.existsSync(path.resolve(pomDir, content + ext)) ) {
            push(rec, 1, 'pom-file-missing',
              "'" + content + ext + "'" + ' not found relative to this pom.js');
          }
        });
      }
      checkName('pomFileName',     '.js');
      checkName('pomJavaFileName', '.java');

      eachSpan('pomFlagValue', function(content, rec) {
        // Tokens exactly as foam.checkFlags sees them: split on | then &,
        // no trimming.
        var ors = content.split('|');
        for ( var i = 0 ; i < ors.length ; i++ ) {
          var ands = ors[i].split('&');
          for ( var j = 0 ; j < ands.length ; j++ ) {
            var tok = ands[j];
            if ( tok === '' ) {
              push(rec, 1, 'pom-flag-whitespace',
                'empty flag token in ' + "'" + content + "'");
              return;
            }
            if ( tok !== tok.trim() || /\s/.test(tok) ) {
              push(rec, 1, 'pom-flag-whitespace',
                'whitespace in flag token ' + "'" + tok + "'");
              return;
            }
            if ( ! KNOWN[tok] ) {
              push(rec, 2, 'pom-flag-unknown',
                'unknown flag ' + "'" + tok + "'");
              return;
            }
          }
        }
      });

      return issues;
    },

    function grammar_() {
      /** Lazy grammar for position harvesting — same pattern as
       *  DefinitionHandler.grammar_(). */
      if ( ! this.grammarInstance_ ) {
        this.grammarInstance_ = foam.parse.lsp.FoamClassGrammar.create({ index: this.index });
      }
      return this.grammarInstance_;
    },

    function detectSourceRoots_(indexedPaths) {
      // Compute the set of unique top-level `src/` directories that the
      // POM index already references. Each is an FS root we'll walk for
      // orphans.
      var roots = {};
      for ( var p in indexedPaths ) {
        // Match prefix up through the first `/src/`. Most FOAM projects
        // organise as <root>/src/<package>/<file>.js.
        var m = p.match(/^(.*\/src)\//);
        if ( m ) roots[m[1]] = true;
      }
      return Object.keys(roots);
    },

    function walkSourceTree_(root, visit) {
      // Recursive directory walk, bounded by typical project sizes. Skips
      // hidden dirs and common build/output directories.
      var fs = require('fs');
      var path = require('path');
      var stack = [root];
      while ( stack.length ) {
        var dir = stack.pop();
        var entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch (e) { continue; }
        for ( var i = 0 ; i < entries.length ; i++ ) {
          var ent  = entries[i];
          var name = ent.name;
          if ( name.charAt(0) === '.' )                 continue;
          if ( name === 'node_modules' )                continue;
          if ( name === 'build' || name === 'out' )     continue;
          var full = path.join(dir, name);
          if ( ent.isDirectory() ) {
            stack.push(full);
          } else if ( ent.isFile() ) {
            visit(full);
          }
        }
      }
    }
  ]
});
