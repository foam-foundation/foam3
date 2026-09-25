/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'DocumentLinkHandler',

  documentation: `textDocument/documentLink: makes FOAM class-id strings
    clickable, targeting the file (and line) that declares the class.

    Model files: every class reference the FoamClassGrammar harvests —
    extends:, refines:, implements:, requires:, of:, class:, view:,
    sourceModel:/targetModel: and { class: 'x.Y' } specs in code. The grammar
    only matches registered ids, so an unknown id gets no link.

    Journals (.jrl): the refs FoamIndex.scanJrlClassRefs already resolves for
    semantic tokens ("class" values, ids inside serviceScript/javaCode and
    client JSON), plus any other string in the journal whose whole text is a
    registered class id (JrlGrammar jrlClassRef records) — "of":"foam.x.Y",
    for example.

    A class with no file (registered at runtime, or not in the file index)
    gets no link: a link that opens nothing is worse than none.`,

  requires: [
    'foam.parse.lsp.FileClassifier',
    'foam.parse.lsp.JrlGrammar'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamIndex',
      name: 'index'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FileClassifier',
      name: 'fileClassifier',
      factory: function() { return this.FileClassifier.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.JrlGrammar',
      name: 'jrlGrammar',
      documentation: `server.js passes JrlHandler's instance, so a journal's
        parse is cached once for both handlers rather than once each.`,
      factory: function() { return this.JrlGrammar.create(); }
    },
    {
      class: 'Int',
      name: 'maxJrlGrammarSize',
      documentation: `Journals longer than this (characters) skip the
        JrlGrammar pass and keep only the scanJrlClassRefs links. The grammar
        walks the text a character at a time: a 4.6 MB data journal took about
        5.5 s per documentLink request, and editors send one on open and after
        edits, stalling the single-threaded server. Same 1 MB line as
        JournalEntryIndex.maxFileSize, which ignores data journals for the
        same reason.`,
      value: 1048576
    },
    {
      name: 'capLogged_',
      documentation: `URIs whose size-cap skip has been logged. Editors ask
        for links on every edit, so logging each skip buried the log in one
        repeated line; once per URI is enough to explain the missing links.`,
      factory: function() { return new Set(); }
    }
  ],

  methods: [
    function handle(text, uri) {
      if ( ! text ) return [];
      var kind = this.fileClassifier.classify(uri, text);
      var spans = kind === 'class' ? this.modelSpans_(text) :
                  kind === 'jrl'   ? this.jrlSpans_(text, uri) : [];
      return this.toLinks_(text, spans);
    },

    function modelSpans_(text) {
      var map = this.index.getGrammar().collectAxiomPositions(text);
      var out = [];
      var kinds = [ 'classRef', 'instClassRef' ];
      for ( var k = 0 ; k < kinds.length ; k++ ) {
        var byName = map[kinds[k]] || {};
        for ( var id in byName ) {
          var recs = byName[id];
          for ( var i = 0 ; i < recs.length ; i++ ) {
            // The grammar tries class ids as bare literals, and the record is
            // written when the literal matches, before the closing quote is
            // checked. So `requires: [ 'foam.u2.ViewXYZ' ]`, an unknown id,
            // leaves a record for the registered prefix `foam.u2.View`.
            // Linking that would open the wrong class. A real reference is a
            // whole string: a quote on both sides of the span.
            if ( ! this.isQuotedWhole_(text, recs[i].startPos, recs[i].endPos) ) continue;
            out.push({ classId: id, start: recs[i].startPos, end: recs[i].endPos });
          }
        }
      }
      return out;
    },

    function jrlSpans_(text, uri) {
      var out = [];
      var refs = this.index.scanJrlClassRefs(text);
      for ( var i = 0 ; i < refs.length ; i++ ) {
        out.push({ classId: refs[i].classId, start: refs[i].offset, end: refs[i].offset + refs[i].length });
      }
      if ( text.length > this.maxJrlGrammarSize ) {
        if ( ! this.capLogged_.has(uri) ) {
          this.capLogged_.add(uri);
          require('../logError').logLspError('documentLink: journal string refs skipped for ' + uri,
            new Error(text.length + ' chars is over maxJrlGrammarSize (' + this.maxJrlGrammarSize + ')'));
        }
        return out;
      }
      var strRefs = this.jrlGrammar.collectJrlPositions(text).classRefs;
      for ( var j = 0 ; j < strRefs.length ; j++ ) {
        var r = strRefs[j];
        if ( ! this.isQuotedWhole_(text, r.startPos, r.endPos) ) continue;
        out.push({ classId: r.name, start: r.startPos, end: r.endPos });
      }
      return out;
    },

    function isQuotedWhole_(text, start, end) {
      var q = text.charAt(start - 1);
      if ( q !== '\'' && q !== '"' && q !== '`' ) return false;
      if ( text.charAt(end) === q ) return true;
      // A requires entry can rename the class: 'foam.u2.DetailView as DV'.
      // The id is still the whole reference; ` as DV` sits before the quote.
      var m = /^[ \t]+as[ \t]+[A-Za-z_$][\w$]*/.exec(text.substr(end, 120));
      return !! m && text.charAt(end + m[0].length) === q;
    },

    function toLinks_(text, spans) {
      // Both harvests can name the same span (a jrl "class" value is found by
      // both), and the grammar re-records a span when it backtracks. One link
      // per span; on overlap the earlier-starting, longer span wins.
      spans.sort(function(a, b) { return a.start - b.start || b.end - a.end; });
      var lineStarts = this.lineStarts_(text);
      var targets = {};
      var links = [];
      var lastEnd = -1;
      for ( var i = 0 ; i < spans.length ; i++ ) {
        var s = spans[i];
        if ( s.start < lastEnd ) continue;
        if ( ! targets.hasOwnProperty(s.classId) ) targets[s.classId] = this.targetFor_(s.classId);
        var target = targets[s.classId];
        if ( ! target ) continue;
        lastEnd = s.end;
        links.push({
          range: {
            start: this.toPosition_(lineStarts, s.start),
            end:   this.toPosition_(lineStarts, s.end)
          },
          target:  target,
          tooltip: 'Open ' + s.classId
        });
      }
      return links;
    },

    function targetFor_(classId) {
      /**
       * file:// URI of the class's declaring file, with a `#L<line>` fragment
       * (1-based) that VS Code opens at the declaration. Null when the class
       * has no file on record.
       */
      var filePath = this.index.getFilePath(classId);
      if ( ! filePath ) return null;
      var href;
      try {
        href = require('url').pathToFileURL(filePath).href;
      } catch ( e ) {
        require('../logError').logLspError('documentLink target for ' + classId, e);
        return null;
      }
      return href + '#L' + ( this.index.getClassLine(classId) + 1 );
    },

    function lineStarts_(text) {
      var starts = [ 0 ];
      for ( var i = 0 ; i < text.length ; i++ ) {
        if ( text.charCodeAt(i) === 10 ) starts.push(i + 1);
      }
      return starts;
    },

    function toPosition_(starts, offset) {
      var lo = 0, hi = starts.length - 1;
      while ( lo < hi ) {
        var mid = ( lo + hi + 1 ) >> 1;
        if ( starts[mid] <= offset ) lo = mid; else hi = mid - 1;
      }
      return { line: lo, character: offset - starts[lo] };
    }
  ]
});
