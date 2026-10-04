/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'JrlLoader',

  documentation: `Generic JRL file loader using eval-intercept pattern.
    Defines p (put), c (create), r (remove) as interceptor functions,
    evals the JRL content, and returns collected objects.
    Reusable by any part of the system that needs to load JRL files.

    A journal is NOT valid JavaScript. FOAM writes long values as
    triple-quoted strings, which no JS engine accepts, so evaluating a
    whole journal as one function body throws a SyntaxError at
    CONSTRUCTION — the body never runs and nothing at all is collected.
    68 of this repo's 78 services.jrl files are in that state, and 119
    of 365 journals overall.

    So the content is cut into entries on the grammar's own entry starts
    and each is evaluated alone, with its triple-quoted spans replaced by
    empty strings first. A malformed entry then costs only itself.
    sliceEntries() is that step on its own, because JournalEntryIndex
    needs the same slices with their line numbers.`,

  requires: [ 'foam.parse.lsp.JrlGrammar' ],

  properties: [
    {
      name: 'grammar_',
      documentation: 'Shared JrlGrammar — supplies entry starts and triple-quoted spans.',
      factory: function() { return this.JrlGrammar.create(); }
    }
  ],

  methods: [
    function loadFile(filePath) {
      var fs_;
      try { fs_ = require('fs'); } catch ( e ) { return []; }
      if ( ! fs_.existsSync(filePath) ) return [];
      var content = fs_.readFileSync(filePath, 'utf8');
      return this.loadString(content);
    },

    function loadFiles(filePaths) {
      var all = {};
      for ( var i = 0 ; i < filePaths.length ; i++ ) {
        var objects = this.loadFile(filePaths[i]);
        for ( var j = 0 ; j < objects.length ; j++ ) {
          var obj = objects[j];
          var key = (obj['class'] || '') + ':' + (obj.id || j);
          all[key] = obj;
        }
      }
      var result = [];
      for ( var k in all ) {
        if ( all.hasOwnProperty(k) ) result.push(all[k]);
      }
      return result;
    },

    function loadString(content) {
      /** Surviving entry objects, in document order. */
      var entries = this.loadStringWithLines(content);
      var out = [];
      for ( var i = 0 ; i < entries.length ; i++ ) out.push(entries[i].obj);
      return out;
    },

    function loadStringWithLines(content) {
      /**
       * Surviving entries as [ { obj, line } ], line being the 0-based line
       * the entry starts on. Callers that want to point a user AT an entry —
       * a services.jrl row shown as a reference — need the line, and the
       * slices already carry it.
       */
      var objects = {};
      var ordered = [];
      var nextId = 0;

      var curLine = 0;

      function put(obj) {
        if ( ! obj || typeof obj !== 'object' ) return;
        var key = (obj['class'] || '') + ':' + (obj.id != null ? obj.id : '__auto_' + (nextId++));
        if ( ! objects[key] ) ordered.push(key);
        objects[key] = { obj: obj, line: curLine };
      }

      function remove(obj) {
        if ( ! obj || typeof obj !== 'object' ) return;
        var key = (obj['class'] || '') + ':' + (obj.id != null ? obj.id : '');
        if ( objects[key] ) {
          delete objects[key];
          var idx = ordered.indexOf(key);
          if ( idx !== -1 ) ordered.splice(idx, 1);
        }
      }

      // One entry at a time. Evaluating the whole journal as one function
      // body means one unparseable entry — or one triple-quoted string,
      // which is every real services.jrl — returns nothing at all.
      var slices = this.sliceEntries(content);
      for ( var i = 0 ; i < slices.length ; i++ ) {
        curLine = slices[i].line;
        try {
          var fn = new Function('p', 'c', 'r', slices[i].text);
          fn(put, put, remove);
        } catch ( e ) {
          // Malformed entry — it drops, the rest of the journal does not
        }
      }

      var result = [];
      for ( var i = 0 ; i < ordered.length ; i++ ) {
        if ( objects[ordered[i]] ) result.push(objects[ordered[i]]);
      }
      return result;
    },

    function sliceEntries(content) {
      /**
       * Cut journal text into one evaluable slice per entry:
       * [ { text, line, startPos } ], in document order.
       *
       * Entry starts and triple-quoted spans both come from JrlGrammar, so
       * this is position surgery, not pattern matching — a `"""` written
       * inside an ordinary string cannot be mistaken for a real one. Each
       * slice has its triple-quoted spans replaced by an empty string,
       * which is what makes it valid JavaScript.
       *
       * A journal the grammar cannot read at all yields one slice holding
       * the whole text, so a caller still gets the old behaviour rather
       * than silence.
       */
      if ( ! content ) return [];

      var pos;
      try { pos = this.grammar_.collectJrlPositions(content); } catch ( e ) { pos = null; }
      if ( ! pos || ! pos.entries || ! pos.entries.length ) {
        return [ { text: content, line: 0, startPos: 0 } ];
      }

      var out = [];
      for ( var i = 0 ; i < pos.entries.length ; i++ ) {
        var start = pos.entries[i].startPos;
        var end   = i + 1 < pos.entries.length ? pos.entries[i + 1].startPos : content.length;

        var spans = [];
        var triples = pos.tripleStrings || [];
        for ( var t = 0 ; t < triples.length ; t++ ) {
          var sp = triples[t];
          if ( sp.startPos >= start && sp.endPos <= end ) {
            spans.push({ startPos: sp.startPos - start, endPos: sp.endPos - start });
          }
        }

        out.push({
          text:     this.spliceTriples_(content.substring(start, end), spans),
          line:     pos.entries[i].line,
          startPos: start
        });
      }
      return out;
    },

    function spliceTriples_(content, tripleSpans) {
      /**
       * Replace """...""" spans (positions relative to `content`) with an
       * empty JS string so the content becomes evaluable.
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

    function filterByClass(objects, className) {
      var result = [];
      for ( var i = 0 ; i < objects.length ; i++ ) {
        if ( objects[i]['class'] === className ) result.push(objects[i]);
      }
      return result;
    }
  ]
});
