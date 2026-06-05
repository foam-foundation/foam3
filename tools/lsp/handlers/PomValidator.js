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
      var sourceRoots = this.detectSourceRoots_(indexedPaths);
      var FOAM_DECL = /foam\.(?:CLASS|ENUM|INTERFACE|RELATIONSHIP|LIB)\s*\(/;

      for ( var i = 0 ; i < sourceRoots.length ; i++ ) {
        this.walkSourceTree_(sourceRoots[i], function(filePath) {
          if ( ! filePath.endsWith('.js') )      return;
          if ( indexedPaths[filePath] )           return;
          // Skip test/, pom.js, generated/etc. — only flag plain-source orphans.
          if ( /\/test\//.test(filePath) )        return;
          if ( filePath.endsWith('/pom.js') )     return;
          if ( filePath.endsWith('tests.jrl') )   return;
          try {
            var text = fs.readFileSync(filePath, 'utf8');
            if ( FOAM_DECL.test(text) ) orphans.push(filePath);
          } catch (e) {}
        });
      }

      return { orphans: orphans, missing: missing, duplicates: duplicates };
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
