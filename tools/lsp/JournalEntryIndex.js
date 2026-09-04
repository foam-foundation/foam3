/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'JournalEntryIndex',

  documentation: `Workspace-wide lookup of journal (.jrl) entries:
    which journal file (and line) defines each service name and each
    per-model entry id. Backs JrlHandler's cross-reference
    go-to-definition (daoKey -> services.jrl, parent -> menu entry).

    Positions come from JrlGrammar (parser combinators); entry
    SEMANTICS come from evaluating each entry with p/c/r interceptors
    (JrlLoader's pattern). Each entry is evaluated ALONE, sliced on
    the grammar's entry starts, so a malformed entry costs only
    itself, never the whole file. Triple-quoted FOAM strings are
    spliced out before eval — they are not valid JavaScript.

    Query-driven, not build-the-world: a lookup reads each journal's
    raw text and skips the (expensive) parse entirely unless the text
    can contain the key. Service lookups only ever touch services.jrl
    files, and journals over maxFileSize are ignored outright (they
    are data, not config). Per-file parses are cached by mtime+size;
    invalidate() (wired to .jrl saves in server.js) drops the caches
    so the next query re-reads from disk.`,

  requires: [ 'foam.parse.lsp.JrlGrammar' ],

  constants: {
    // Keys whose VALUE names a registered service rather than describing one.
    // Schema-blind by nature: nothing in the model says `daoKey` points at a
    // services.jrl row, it is a convention. Lives here because both the
    // journal handler and the JS definition handler navigate on it, and two
    // copies of a convention list drift.
    SERVICE_KEY_NAMES: [ 'daoKey' ]
  },

  properties: [
    {
      name: 'index',
      documentation: 'FoamIndex; supplies getIndexedDirs() for journal discovery.'
    },
    {
      class: 'StringArray',
      name: 'journalFiles',
      documentation: 'Explicit journal list (tests). Empty -> discover via index.'
    },
    {
      name: 'grammar',
      factory: function() { return this.JrlGrammar.create(); }
    },
    {
      class: 'Int',
      name: 'maxFileSize',
      documentation: `Journals larger than this (bytes) are never read or
        parsed. Config journals (menus, services, rules, regions) are
        tens-to-hundreds of KB; multi-MB .jrl files are data journals
        that go-to-definition never targets.`,
      value: 1048576
    },
    {
      name: 'fileList_',
      documentation: 'Cached discovery result; null until first query.',
      value: null
    },
    {
      name: 'fileCache_',
      documentation: 'path -> { mtimeMs, size, recs } parsed-entry cache.',
      factory: function() { return {}; }
    }
  ],

  methods: [
    function invalidate() {
      this.fileList_  = null;
      this.fileCache_ = {};
    },

    function getServiceLocations(name) {
      // servicesOnly: only services.jrl can answer, so no other file is
      // ever read or parsed for this lookup (daoKey names appear as data
      // inside unrelated journals).
      return this.lookup_([ name ], function(rec) {
        return rec.key === name;
      }, true);
    },

    function getEntryLocations(modelId, key) {
      // Pre-gate on both: a matching entry stores its class id and its
      // key as literal text, so both strings must appear in the file.
      return this.lookup_([ key, modelId ], function(rec) {
        return rec.clsId === modelId && rec.key === key;
      });
    },

    function files_() {
      if ( this.journalFiles.length ) return this.journalFiles;
      if ( ! this.fileList_ ) this.fileList_ = this.findJournalFiles_();
      return this.fileList_;
    },

    function findJournalFiles_() {
      var fs_ = require('fs');
      var path_ = require('path');
      var files = [];
      var seen = {};
      var dirs = [];

      // Collect directories from foam.poms locations
      var poms = ( typeof foam !== 'undefined' && foam.poms ) || [];
      for ( var p = 0 ; p < poms.length ; p++ ) {
        var pomDir = poms[p] && poms[p].location;
        if ( pomDir && ! seen[pomDir] ) {
          seen[pomDir] = true;
          dirs.push(pomDir);
        }
      }

      // Collect directories from indexed source files
      var indexDirs = ( this.index && this.index.getIndexedDirs() ) || [];
      for ( var d = 0 ; d < indexDirs.length ; d++ ) {
        if ( ! seen[indexDirs[d]] ) {
          seen[indexDirs[d]] = true;
          dirs.push(indexDirs[d]);
        }
      }

      // Read .jrl files from each directory
      for ( var i = 0 ; i < dirs.length ; i++ ) {
        var names;
        try { names = fs_.readdirSync(dirs[i]); } catch ( e ) { continue; }
        for ( var n = 0 ; n < names.length ; n++ ) {
          if ( names[n].endsWith('.jrl') ) files.push(path_.join(dirs[i], names[n]));
        }
      }

      return files;
    },

    function lookup_(needles, match, servicesOnly) {
      var path_ = require('path');
      for ( var n = 0 ; n < needles.length ; n++ ) {
        if ( typeof needles[n] !== 'string' || ! needles[n] ) return null;
      }
      var files = this.files_();
      var out = [];
      for ( var f = 0 ; f < files.length ; f++ ) {
        if ( servicesOnly && path_.basename(files[f]) !== 'services.jrl' ) {
          continue;
        }
        var recs = this.fileRecords_(files[f], needles);
        if ( ! recs ) continue;
        for ( var i = 0 ; i < recs.length ; i++ ) {
          if ( match(recs[i]) ) {
            out.push({ file: files[f], line: recs[i].line });
          }
        }
      }
      return out.length ? out : null;
    },

    function fileRecords_(file, needles) {
      /**
       * Parsed records for one journal, cached by mtime+size. On a
       * cache miss the raw text is pre-gated on the lookup needles
       * before any parsing: a journal that cannot contain the key is
       * never parsed (substring scan is orders of magnitude cheaper
       * than a grammar parse). Returns null when gated out, oversized
       * or unreadable.
       */
      var fs_ = require('fs');
      var st;
      try { st = fs_.statSync(file); } catch ( e ) {
        delete this.fileCache_[file];
        return null;
      }
      if ( st.size > this.maxFileSize ) {
        delete this.fileCache_[file];
        return null;
      }
      var c = this.fileCache_[file];
      if ( c && c.mtimeMs === st.mtimeMs && c.size === st.size ) return c.recs;
      delete this.fileCache_[file];

      var content;
      try { content = fs_.readFileSync(file, 'utf8'); } catch ( e ) { return null; }
      for ( var n = 0 ; n < needles.length ; n++ ) {
        if ( content.indexOf(needles[n]) === -1 ) return null;
      }

      var recs = this.parseFile_(content);
      this.fileCache_[file] = { mtimeMs: st.mtimeMs, size: st.size, recs: recs };
      return recs;
    },

    function parseFile_(content) {
      /**
       * Grammar positions -> per-entry eval. Slicing each entry on the
       * grammar's own entry starts isolates syntax errors: ops[0] of a
       * slice IS that slice's entry, and a slice that fails to compile
       * drops only its own entry.
       */
      var recs = [];
      var pos = this.grammar.collectJrlPositions(content);
      for ( var i = 0 ; i < pos.entries.length ; i++ ) {
        var start = pos.entries[i].startPos;
        var end   = i + 1 < pos.entries.length ?
          pos.entries[i + 1].startPos : content.length;

        var spans = [];
        for ( var t = 0 ; t < pos.tripleStrings.length ; t++ ) {
          var s = pos.tripleStrings[t];
          if ( s.startPos >= start && s.endPos <= end ) {
            spans.push({ startPos: s.startPos - start, endPos: s.endPos - start });
          }
        }

        var ops = this.parseEntriesOrdered_(
          this.sanitizeContent_(content.substring(start, end), spans));
        if ( ! ops.length || ops[0].op === 'r' ) continue;
        var obj = ops[0].obj;
        if ( ! obj || typeof obj !== 'object' ) continue;

        var clsId = typeof obj['class'] === 'string' ? obj['class'] : null;
        var key = this.entryKey_(clsId, obj);
        if ( key === null ) continue;

        recs.push({ clsId: clsId, key: key, line: pos.entries[i].line });
      }
      return recs;
    },

    function sanitizeContent_(content, tripleSpans) {
      /**
       * Replace """...""" spans (positions from JrlGrammar) with an
       * empty JS string so the content becomes evaluable. Pure
       * position-based string surgery — no pattern matching.
       */
      var out = '';
      var last = 0;
      for ( var i = 0 ; i < tripleSpans.length ; i++ ) {
        var s = tripleSpans[i];
        if ( s.startPos < last ) continue;
        out += content.substring(last, s.startPos) + '""';
        last = s.endPos;
      }
      return out + content.substring(last);
    },

    function parseEntriesOrdered_(content) {
      /**
       * Evaluate journal content with p/c/r interceptors, collecting
       * ops IN DOCUMENT ORDER without de-duplication. Callers pass a
       * single-entry slice, so ops[0] is that entry; a SyntaxError
       * yields no ops at all (the slice never compiled).
       */
      var ops = [];
      function put(o)    { ops.push({ op: 'p', obj: o }); }
      function remove(o) { ops.push({ op: 'r', obj: o }); }
      try {
        var fn = new Function('p', 'c', 'r', content);
        fn(put, put, remove);
      } catch ( e ) { /* malformed entry: whatever was collected */ }
      return ops;
    },

    function entryKey_(clsId, obj) {
      /**
       * The identity value of a journal entry, per its model's schema:
       * the model's declared id property (cls.ID), falling back to
       * 'name' (CSpec-style identity) when the id slot is absent.
       */
      var cls = clsId ? foam.maybeLookup(clsId) : null;
      var idName = ( cls && cls.ID && cls.ID.name ) || 'id';
      var v = obj[idName];
      if ( typeof v !== 'string' && typeof v !== 'number' ) v = obj.name;
      return ( typeof v === 'string' || typeof v === 'number' ) ? String(v) : null;
    }
  ]
});
