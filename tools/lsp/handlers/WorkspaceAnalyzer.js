/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'WorkspaceAnalyzer',

  documentation: 'Scans all FOAM files in the workspace, runs diagnostics, and aggregates results.',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.handlers.DiagnosticsHandler'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamIndex',
      name: 'index',
      factory: function() { return this.FoamIndex.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.handlers.DiagnosticsHandler',
      name: 'diagnosticsHandler',
      factory: function() { return this.DiagnosticsHandler.create({ index: this.index }); }
    }
  ],

  methods: [
    function analyze(progressCallback) {
      /**
       * Scans all files in the index, runs diagnostics on each,
       * and returns aggregated results with pattern grouping.
       *
       * @param progressCallback - optional function({ filesScanned, total })
       * @returns { filesScanned, filesWithIssues, warnings, errors, infos, patterns, fileResults }
       */
      var fs_   = require('fs');
      var idx   = this.index;
      var diag  = this.diagnosticsHandler;

      if ( ! idx.fileIndex_ ) idx.buildFileIndex();

      // Collect unique file paths that match active flags.
      // Files with flags like 'test' or 'swift' are skipped unless
      // those flags are currently active.
      var fileIndex = idx.fileIndex_;
      var seenPaths = {};
      var filePaths = [];
      for ( var classId in fileIndex ) {
        var entry = fileIndex[classId];
        var fp = entry.path || entry; // handle both new {path,flags} and legacy string format
        if ( seenPaths[fp] ) continue;

        // Check if file's flags match active flags
        if ( entry.flags && entry.flags.length > 0 ) {
          var hasActiveFlag = entry.flags.some(function(flag) {
            return foam.flags[flag] === true;
          });
          if ( ! hasActiveFlag ) continue;
        }

        seenPaths[fp] = true;
        filePaths.push(fp);
      }

      var total          = filePaths.length;
      var filesScanned   = 0;
      var filesWithIssues = 0;
      var warnings       = 0;
      var errors         = 0;
      var infos          = 0;
      var fileResults    = {};
      var patternCounts  = {};

      for ( var i = 0 ; i < filePaths.length ; i++ ) {
        var filePath = filePaths[i];
        try {
          var content = fs_.readFileSync(filePath, 'utf8');
          var diagnostics = diag.handle(content);

          if ( diagnostics.length > 0 ) {
            var uri = 'file://' + filePath;
            fileResults[uri] = diagnostics;
            filesWithIssues++;

            for ( var d = 0 ; d < diagnostics.length ; d++ ) {
              var sev = diagnostics[d].severity;
              if ( sev === 1 ) errors++;
              else if ( sev === 2 ) warnings++;
              else infos++;

              // Group by pattern — replace specific class/type names with *
              var pattern = this.generalizeMessage(diagnostics[d].message);
              var key = pattern + '|' + sev;
              if ( ! patternCounts[key] ) {
                patternCounts[key] = { pattern: pattern, count: 0, severity: sev };
              }
              patternCounts[key].count++;
            }
          }
        } catch (e) {
          // File read or parse error — skip silently
        }

        filesScanned++;
        if ( progressCallback && filesScanned % 50 === 0 ) {
          progressCallback({ filesScanned: filesScanned, total: total });
        }
      }

      // Convert pattern map to sorted array
      var patterns = [];
      for ( var key in patternCounts ) {
        patterns.push(patternCounts[key]);
      }
      patterns.sort(function(a, b) { return b.count - a.count; });

      return {
        filesScanned:   filesScanned,
        filesWithIssues: filesWithIssues,
        warnings:       warnings,
        errors:         errors,
        infos:          infos,
        patterns:       patterns,
        fileResults:    fileResults
      };
    },

    function analyzeFiles(filePaths) {
      /**
       * Scan a specific list of file paths — same result shape as analyze().
       * Use this when a save affects only some subset of the workspace
       * (saved file + subclasses + requirers + of-users). Much faster than
       * a full workspace scan when the dependency fan-out is small.
       */
      var fs_  = require('fs');
      var diag = this.diagnosticsHandler;
      var seen = {};
      var unique = [];
      for ( var i = 0 ; i < filePaths.length ; i++ ) {
        var p = filePaths[i];
        if ( p && ! seen[p] ) { seen[p] = true; unique.push(p); }
      }

      var filesScanned    = 0;
      var filesWithIssues = 0;
      var warnings        = 0;
      var errors          = 0;
      var infos           = 0;
      var fileResults     = {};

      for ( var j = 0 ; j < unique.length ; j++ ) {
        var filePath = unique[j];
        try {
          var content = fs_.readFileSync(filePath, 'utf8');
          var diagnostics = diag.handle(content);
          var uri = 'file://' + filePath;
          // ALWAYS include the file in results — empty arrays clear stale
          // diagnostics from a prior save.
          fileResults[uri] = diagnostics;
          if ( diagnostics.length > 0 ) {
            filesWithIssues++;
            for ( var d = 0 ; d < diagnostics.length ; d++ ) {
              var sev = diagnostics[d].severity;
              if ( sev === 1 ) errors++;
              else if ( sev === 2 ) warnings++;
              else infos++;
            }
          }
        } catch ( e ) {}
        filesScanned++;
      }

      return {
        filesScanned:    filesScanned,
        filesWithIssues: filesWithIssues,
        warnings:        warnings,
        errors:          errors,
        infos:           infos,
        patterns:        [],
        fileResults:     fileResults
      };
    },

    function analyzeSingleFile(filePath) {
      /**
       * Analyzes a single file and returns its diagnostics.
       * Useful for testing.
       */
      var fs_ = require('fs');
      var path_ = require('path');
      var absPath = path_.resolve(filePath);
      try {
        var content = fs_.readFileSync(absPath, 'utf8');
        return this.diagnosticsHandler.handle(content);
      } catch (e) {
        return null;
      }
    },

    function generalizeMessage(message) {
      /**
       * Replaces specific class names in diagnostic messages with wildcards
       * for pattern grouping. E.g.:
       *   "Unknown class in requires: 'foam.core.auth.User'" → "Unknown class in requires: 'foam.core.*'"
       */
      // Replace specific class after last dot with *
      return message.replace(
        /(['"])([\w.]+\.)\w+(['"]]?)/g,
        function(match, q1, prefix, q2) {
          // Group by the top-level package path (up to 3 segments)
          var parts = prefix.split('.');
          if ( parts.length > 3 ) {
            return q1 + parts.slice(0, 3).join('.') + '.*' + q2;
          }
          return q1 + prefix + '*' + q2;
        }
      );
    }
  ]
});
