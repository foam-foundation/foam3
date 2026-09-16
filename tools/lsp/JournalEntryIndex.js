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

    Positions come from JrlGrammar via JrlLoader.sliceEntries(); entry
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

  requires: [ 'foam.parse.lsp.JrlLoader' ],

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
      documentation: 'FoamIndex; supplies getJournalDirs() for journal discovery.'
    },
    {
      class: 'StringArray',
      name: 'journalFiles',
      documentation: 'Explicit journal list (tests). Empty -> discover via index.'
    },
    {
      name: 'loader',
      documentation: `Supplies sliceEntries() — the cut-on-entry-starts,
        blank-the-triple-quotes step. Shared rather than repeated: the two
        copies computed the same spans from the same grammar output, so a
        change to one silently made the journal lookup and the journal
        loader read the same file differently.`,
      factory: function() { return this.JrlLoader.create(); }
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
      name: 'serviceList_',
      documentation: `Cached services.jrl discovery — the WIDE walk, separate
        from fileList_'s directory answer. Null until the first service query,
        so a workspace whose journals are never looked up never pays the walk.`,
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
      this.fileList_    = null;
      this.serviceList_ = null;
      this.fileCache_   = {};
    },

    function getServiceLocations(name, opt_from) {
      // servicesOnly: only services.jrl can answer, so no other file is
      // ever read or parsed for this lookup (daoKey names appear as data
      // inside unrelated journals).
      var locs = this.lookup_([ name ], function(rec) {
        return rec.key === name;
      }, true);
      // opt_from is the file the jump started from — a path or a file:// uri.
      // A name registered in several journals is normal (per-target
      // deployment journals redefine appConfig, http and friends), so the
      // answer is ordered rather than trimmed: see rankLocations_.
      return locs ? this.rankLocations_(locs, opt_from) : null;
    },

    function getEntryLocations(modelId, key) {
      // Pre-gate on both: a matching entry stores its class id and its
      // key as literal text, so both strings must appear in the file.
      return this.lookup_([ key, modelId ], function(rec) {
        return rec.clsId === modelId && rec.key === key;
      });
    },

    function rankLocations_(locs, opt_from) {
      /**
       * Orders a multi-file answer nearest-first, relative to the file the
       * jump started from.
       *
       * Ranked, never trimmed: which registration is live is decided at
       * deploy time (the target directory is an argument to the deploy step,
       * and no pom names it), so the index cannot know which row wins. What
       * it can do is put the one you are standing next to first.
       *
       * Ordering, in order:
       *   1. most leading PATH SEGMENTS shared with the origin file's
       *      directory — same target beats a sibling target, and a row beside
       *      your source beats both. Segment-wise, not character-wise: a
       *      character prefix ranks .../foobar/ as close to .../foo/.
       *   2. path, ascending — a total order, so the answer is stable across
       *      runs and platforms rather than left to walk order.
       *   3. line, DESCENDING, within one file — journal entries are ordered
       *      ops (p merges, c replaces, r removes), so when a name is
       *      registered twice in one journal the LAST row is the effective
       *      one and belongs at the top.
       *
       * No directory name is special-cased. Naming deployment/ here would
       * bake one app layout into the framework, and the segment count already
       * produces the same answer for it.
       */
      var path_    = require('path');
      var from     = this.toPath_(opt_from);
      var fromSegs = from ? path_.dirname(from).split(path_.sep) : null;

      function shared(file) {
        if ( ! fromSegs ) return 0;
        var segs = path_.dirname(file).split(path_.sep);
        var n    = 0;
        while ( n < segs.length && n < fromSegs.length && segs[n] === fromSegs[n] ) n++;
        return n;
      }

      var scored = locs.map(function(l) {
        return { loc: l, score: shared(l.file) };
      });
      scored.sort(function(a, b) {
        if ( a.score !== b.score )         return b.score - a.score;
        if ( a.loc.file !== b.loc.file )   return a.loc.file < b.loc.file ? -1 : 1;
        return b.loc.line - a.loc.line;
      });
      return scored.map(function(e) { return e.loc; });
    },

    function toPath_(uriOrPath) {
      /**
       * Accepts either, because the two callers hold a uri and the ranking
       * works in paths. Local on purpose: every uri/path conversion in
       * tools/lsp is still hand-rolled, and adding a 53rd hand-rolled site
       * inside the shared module would be worse than one here. The decode is
       * wrapped because decodeURIComponent throws on a stray '%'.
       */
      if ( typeof uriOrPath !== 'string' || ! uriOrPath )   return null;
      if ( uriOrPath.indexOf('file://') !== 0 )             return uriOrPath;
      try { return decodeURIComponent(uriOrPath.substring(7)); }
      catch ( e ) { return uriOrPath.substring(7); }
    },

    function files_() {
      if ( this.journalFiles.length ) return this.journalFiles;
      if ( ! this.fileList_ ) this.fileList_ = this.findJournalFiles_();
      return this.fileList_;
    },

    function serviceFiles_() {
      /**
       * The file list a SERVICE lookup scans: every services.jrl in the
       * workspace, not just the ones beside a pom or a class file.
       *
       * journalFiles still wins when set, so an explicit list stays an
       * explicit list (lookup_ filters it to services.jrl as before) — the
       * discovery difference applies only to the auto-discovered case.
       */
      if ( this.journalFiles.length ) return this.journalFiles;
      if ( ! this.serviceList_ ) {
        this.serviceList_ = ( this.index && this.index.getServiceJournalFiles &&
                              this.index.getServiceJournalFiles() ) || [];
      }
      return this.serviceList_;
    },

    function findJournalFiles_() {
      var fs_ = require('fs');
      var path_ = require('path');
      var files = [];
      // The pom locations + indexed source dirs union lives on FoamIndex, so
      // this and buildStringUsageIndex_'s services.jrl walk cannot drift.
      var dirs = ( this.index && this.index.getJournalDirs() ) || [];

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
      var files = servicesOnly ? this.serviceFiles_() : this.files_();
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
       * JrlLoader.sliceEntries -> per-entry eval. Slicing each entry on the
       * grammar's own entry starts isolates syntax errors: ops[0] of a
       * slice IS that slice's entry, and a slice that fails to compile
       * drops only its own entry.
       *
       * The slicing itself is the loader's — this class only differs in what
       * it does with a slice (ordered ops and a per-entry key, rather than a
       * deduped object list), so it keeps parseEntriesOrdered_ and nothing
       * else.
       */
      var recs = [];
      var slices = this.loader.sliceEntries(content);
      for ( var i = 0 ; i < slices.length ; i++ ) {
        var ops = this.parseEntriesOrdered_(slices[i].text);
        if ( ! ops.length || ops[0].op === 'r' ) continue;
        var obj = ops[0].obj;
        if ( ! obj || typeof obj !== 'object' ) continue;

        var clsId = typeof obj['class'] === 'string' ? obj['class'] : null;
        var key = this.entryKey_(clsId, obj);
        if ( key === null ) continue;

        recs.push({ clsId: clsId, key: key, line: slices[i].line });
      }
      return recs;
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
