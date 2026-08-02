/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'JournalEntryIndex',

  documentation: `Workspace-wide index of journal (.jrl) entries:
    which journal file (and line) defines each service name and each
    per-model entry id. Backs JrlHandler's cross-reference
    go-to-definition (daoKey -> services.jrl, parent -> menu entry).

    Positions come from JrlGrammar (parser combinators); entry
    SEMANTICS come from evaluating the journal with p/c/r interceptors
    (JrlLoader's pattern), aligned to grammar records by document
    order. Triple-quoted FOAM strings are spliced out before eval —
    they are not valid JavaScript.

    Lazy: built on first query, dropped by invalidate() (wired to
    .jrl saves in server.js).`,

  requires: [ 'foam.parse.lsp.JrlGrammar' ],

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
    { name: 'maps_', value: null }
  ],

  methods: [
    function invalidate() { this.maps_ = null; },

    function getServiceLocations(name) {
      this.ensureBuilt_();
      var a = this.maps_.serviceByName[name];
      return a && a.length ? a : null;
    },

    function getEntryLocations(modelId, key) {
      this.ensureBuilt_();
      var m = this.maps_.entriesByModel[modelId];
      var a = m && m[key];
      return a && a.length ? a : null;
    },

    function findJournalFiles_() {
      var fs_ = require('fs');
      var path_ = require('path');
      var files = [];
      var dirs = ( this.index && this.index.getIndexedDirs() ) || [];
      for ( var d = 0 ; d < dirs.length ; d++ ) {
        var names;
        try { names = fs_.readdirSync(dirs[d]); } catch ( e ) { continue; }
        for ( var n = 0 ; n < names.length ; n++ ) {
          if ( names[n].endsWith('.jrl') ) files.push(path_.join(dirs[d], names[n]));
        }
      }
      return files;
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
       * ops IN DOCUMENT ORDER without de-duplication, so ops[i]
       * corresponds to the grammar's entries[i]. (JrlLoader.loadString
       * de-dupes by id, which would break the alignment.)
       */
      var ops = [];
      function put(o)    { ops.push({ op: 'p', obj: o }); }
      function remove(o) { ops.push({ op: 'r', obj: o }); }
      try {
        var fn = new Function('p', 'c', 'r', content);
        fn(put, put, remove);
      } catch ( e ) { /* malformed journal: whatever was collected */ }
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
    },

    function ensureBuilt_() {
      if ( this.maps_ ) return;
      var fs_ = require('fs');
      var path_ = require('path');
      var maps = { serviceByName: {}, entriesByModel: {} };
      var files = this.journalFiles.length ? this.journalFiles : this.findJournalFiles_();

      for ( var f = 0 ; f < files.length ; f++ ) {
        var file = files[f];
        var content;
        try { content = fs_.readFileSync(file, 'utf8'); } catch ( e ) { continue; }

        var pos = this.grammar.collectJrlPositions(content);
        var ops = this.parseEntriesOrdered_(
          this.sanitizeContent_(content, pos.tripleStrings));

        // Alignment guard: ops[i] <-> pos.entries[i] only holds when the
        // eval saw every entry the grammar saw. Otherwise skip the file
        // rather than index wrong positions.
        if ( ops.length !== pos.entries.length ) continue;

        var isServices = path_.basename(file) === 'services.jrl';

        for ( var i = 0 ; i < ops.length ; i++ ) {
          if ( ops[i].op === 'r' ) continue;
          var obj = ops[i].obj;
          if ( ! obj || typeof obj !== 'object' ) continue;

          var clsId = typeof obj['class'] === 'string' ? obj['class'] : null;
          var key = this.entryKey_(clsId, obj);
          if ( key === null ) continue;

          var loc = { file: file, line: pos.entries[i].line };

          if ( clsId ) {
            var byKey = maps.entriesByModel[clsId] ||
              ( maps.entriesByModel[clsId] = {} );
            ( byKey[key] || ( byKey[key] = [] ) ).push(loc);
          }
          if ( isServices ) {
            ( maps.serviceByName[key] ||
              ( maps.serviceByName[key] = [] ) ).push(loc);
          }
        }
      }

      this.maps_ = maps;
    }
  ]
});
