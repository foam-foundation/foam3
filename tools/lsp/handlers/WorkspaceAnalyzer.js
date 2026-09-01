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
    function collectFilePaths_() {
      /** Unique file paths in the index that match active flags. */
      var idx = this.index;
      if ( ! idx.fileIndex_ ) idx.buildFileIndex();
      var fileIndex = idx.fileIndex_;
      var seen = {};
      var paths = [];
      for ( var classId in fileIndex ) {
        var entry = fileIndex[classId];
        var fp = entry.path || entry; // handle both {path,flags} and legacy string
        if ( seen[fp] ) continue;
        if ( entry.flags && entry.flags.length > 0 ) {
          var active = entry.flags.some(function(flag) { return foam.flags[flag] === true; });
          if ( ! active ) continue;
        }
        seen[fp] = true;
        paths.push(fp);
      }
      return paths;
    },

    function newAcc_() {
      /** Fresh accumulator for a scan (shared by sync + async drivers). */
      return { filesScanned: 0, filesWithIssues: 0, warnings: 0, errors: 0,
               infos: 0, fileResults: {}, patternCounts: {}, slowest: [] };
    },

    function scanFileInto_(filePath, acc) {
      /** Diagnose one file, fold its results into `acc`, track parse time. */
      var fs_ = require('fs');
      try {
        var content = fs_.readFileSync(filePath, 'utf8');
        var uri = 'file://' + filePath;
        var t0 = process.hrtime.bigint();
        var diagnostics = this.diagnosticsHandler.handle(content, uri);
        var ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if ( acc.slowest.length < 10 || ms > acc.slowest[acc.slowest.length - 1].ms ) {
          acc.slowest.push({ path: filePath, ms: ms });
          acc.slowest.sort(function(a, b) { return b.ms - a.ms; });
          if ( acc.slowest.length > 10 ) acc.slowest.pop();
        }
        if ( diagnostics.length > 0 ) {
          acc.fileResults[uri] = diagnostics;
          acc.filesWithIssues++;
          for ( var d = 0 ; d < diagnostics.length ; d++ ) {
            var sev = diagnostics[d].severity;
            if ( sev === 1 ) acc.errors++;
            else if ( sev === 2 ) acc.warnings++;
            else acc.infos++;
            var pattern = this.patternFor(diagnostics[d]);
            var key = pattern + '|' + sev;
            if ( ! acc.patternCounts[key] ) {
              acc.patternCounts[key] = { pattern: pattern, count: 0, severity: sev };
            }
            acc.patternCounts[key].count++;
          }
        }
      } catch (e) {
        // File read or parse error — skip silently
      }
      acc.filesScanned++;
    },

    function finalizeAcc_(acc, totalMs) {
      /** Build the result object; log timing + slowest files when timed. */
      if ( totalMs !== undefined ) {
        console.error('[LSP] ⏱ workspace analysis ' + totalMs.toFixed(0) + 'ms over ' +
          acc.filesScanned + ' files (' + (totalMs / Math.max(acc.filesScanned, 1)).toFixed(1) + 'ms/file avg)');
        for ( var sI = 0 ; sI < Math.min(acc.slowest.length, 5) ; sI++ ) {
          console.error('[LSP] ⏱   slowest: ' + acc.slowest[sI].ms.toFixed(0) + 'ms  ' + acc.slowest[sI].path);
        }
      }
      var patterns = [];
      for ( var key in acc.patternCounts ) patterns.push(acc.patternCounts[key]);
      patterns.sort(function(a, b) { return b.count - a.count; });
      return {
        filesScanned:    acc.filesScanned,
        filesWithIssues: acc.filesWithIssues,
        warnings:        acc.warnings,
        errors:          acc.errors,
        infos:           acc.infos,
        patterns:        patterns,
        fileResults:     acc.fileResults
      };
    },

    function analyze(progressCallback) {
      /**
       * Scans all files in the index synchronously, runs diagnostics on each,
       * and returns aggregated results with pattern grouping. Blocks the event
       * loop for the whole scan — prefer analyzeAsync for the startup scan.
       *
       * @param progressCallback - optional function({ filesScanned, total })
       * @returns { filesScanned, filesWithIssues, warnings, errors, infos, patterns, fileResults }
       */
      var paths = this.collectFilePaths_();
      var total = paths.length;
      var acc = this.newAcc_();
      var start = process.hrtime.bigint();
      for ( var i = 0 ; i < paths.length ; i++ ) {
        this.scanFileInto_(paths[i], acc);
        if ( progressCallback && acc.filesScanned % 50 === 0 ) {
          progressCallback({ filesScanned: acc.filesScanned, total: total });
        }
      }
      return this.finalizeAcc_(acc, Number(process.hrtime.bigint() - start) / 1e6);
    },

    function analyzeAsync(progressCallback, done) {
      /**
       * Non-blocking workspace scan. Processes files in chunks and yields to
       * the event loop (setImmediate) between chunks, so the server keeps
       * answering hover / completion / diagnostic requests while the scan runs.
       * Calls done(results) — same shape as analyze() — when finished.
       */
      var self = this;
      var paths = this.collectFilePaths_();
      var total = paths.length;
      var acc = this.newAcc_();
      var start = process.hrtime.bigint();
      var CHUNK = 25;
      var i = 0;
      function step() {
        var end = Math.min(i + CHUNK, paths.length);
        for ( ; i < end ; i++ ) self.scanFileInto_(paths[i], acc);
        if ( progressCallback ) progressCallback({ filesScanned: acc.filesScanned, total: total });
        if ( i < paths.length ) {
          setImmediate(step);   // yield: queued requests get serviced between chunks
        } else {
          done(self.finalizeAcc_(acc, Number(process.hrtime.bigint() - start) / 1e6));
        }
      }
      step();
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
          var uri = 'file://' + filePath;
          var diagnostics = diag.handle(content, uri);  // pass URI so test/demo i18n exemptions apply
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
        return this.diagnosticsHandler.handle(content, 'file://' + absPath);  // URI → i18n exemptions apply
      } catch (e) {
        return null;
      }
    },

    function patternFor(diag) {
      /**
       * Grouping key for a diagnostic. Diagnostics that carry a stable `code`
       * (e.g. the i18n rules) group under that code so the audit shows one row
       * per rule instead of one row per distinct string. Uncoded diagnostics
       * fall back to generalizeMessage (class/type names wildcarded).
       */
      if ( diag && diag.code ) return diag.code;
      return this.generalizeMessage(diag.message);
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
