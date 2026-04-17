/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'ReferencesHandler',

  documentation: 'Find all references to a class: subclasses, implementors, and files that require or use it via `of:`.',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer'
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
      of: 'foam.parse.lsp.FileModelCache',
      name: 'cache',
      factory: function() { return this.FileModelCache.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      var word = this.analyzer.getDottedWordAtPosition(text, position);
      if ( ! word ) return [];

      // Case A: cursor on a property name inside `properties: [{ name: '…' }]`
      // of the current class — find every class that inherits or references it.
      var propRefs = this.propertyReferences_(text, position, word, opt_uri);
      if ( propRefs ) return propRefs;

      // Case B: cursor on a class identifier (name, extends, requires, of, etc.)
      var classId = this.resolveClassAtCursor_(text, position, word, opt_uri);
      if ( ! classId ) return [];

      // Collect referencing class IDs from every angle. Dedup — a class may
      // both extend and require the target (rare, but keep it honest).
      var seen = {};
      var refs = [];
      function add(id) { if ( id && ! seen[id] ) { seen[id] = true; refs.push(id); } }

      var subs  = this.index.getSubclasses(classId);
      var impls = this.index.getImplementors(classId);
      var reqs  = this.index.getRequirers(classId);
      var ofs   = this.index.getOfUsers(classId);
      for ( var i = 0 ; i < subs.length ; i++ )  add(subs[i]);
      for ( var i = 0 ; i < impls.length ; i++ ) add(impls[i]);
      for ( var i = 0 ; i < reqs.length ; i++ )  add(reqs[i]);
      for ( var i = 0 ; i < ofs.length ; i++ )   add(ofs[i]);

      var locations = [];
      for ( var i = 0 ; i < refs.length ; i++ ) {
        var loc = this.buildLocation_(refs[i], classId);
        if ( loc ) locations.push(loc);
      }
      return locations;
    },

    function propertyReferences_(text, position, word, opt_uri) {
      /**
       * If the cursor is on a property-name string inside the current model's
       * `properties: [{ name: '…' }]`, return locations where that property is
       * referenced — own class, every subclass (inherited usage), and any
       * file whose text contains `this.word` / `.word$` / `'word'` in a table
       * column / `get<Word>()` Java getter.
       *
       * Returns null when the cursor isn't on a property name, so the caller
       * falls through to class-reference resolution.
       */
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      if ( ! model || ! this.isOwnPropertyName_(model, word) ) return null;

      var classId = this.cache.getClassId(model);
      if ( ! classId ) return null;

      // Collect files to scan: the defining class + every subclass (they
      // inherit the property and commonly reference it).
      var seen = {};
      var filesToScan = [];
      function addFile(id) {
        if ( ! id || seen[id] ) return;
        seen[id] = true;
        filesToScan.push(id);
      }
      addFile(classId);
      var subs = this.transitiveSubclasses_(classId);
      for ( var i = 0 ; i < subs.length ; i++ ) addFile(subs[i]);

      // Also include classes that REQUIRE or have `of: classId` — they likely
      // access the property through a typed variable.
      var reqs = this.index.getRequirers(classId);
      var ofs  = this.index.getOfUsers(classId);
      for ( var i = 0 ; i < reqs.length ; i++ ) addFile(reqs[i]);
      for ( var i = 0 ; i < ofs.length ; i++ )   addFile(ofs[i]);

      var locations = [];
      for ( var i = 0 ; i < filesToScan.length ; i++ ) {
        this.scanPropertyRefs_(filesToScan[i], word, locations);
      }
      return locations;
    },

    function isOwnPropertyName_(model, word) {
      /** True if `word` is the name of one of this model's own properties. */
      var props = model.properties || [];
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var n = typeof p === 'string' ? p : p.name;
        if ( n === word ) return true;
      }
      return false;
    },

    function transitiveSubclasses_(classId) {
      /** All subclasses, recursively. Bounded to avoid pathological hierarchies. */
      var out = [];
      var seen = {};
      var queue = [classId];
      var MAX = 2000;
      while ( queue.length > 0 && out.length < MAX ) {
        var id = queue.shift();
        var subs = this.index.getSubclasses(id);
        for ( var i = 0 ; i < subs.length ; i++ ) {
          if ( seen[subs[i]] ) continue;
          seen[subs[i]] = true;
          out.push(subs[i]);
          queue.push(subs[i]);
        }
      }
      return out;
    },

    function scanPropertyRefs_(refClassId, propName, locations) {
      /**
       * Read the file backing `refClassId` and emit a Location for every
       * whole-word occurrence of `propName`. Uses `\b` boundaries so
       * `foo` doesn't match `fooBar`. Skips binary/large files defensively.
       */
      var filePath = this.index.getFilePath(refClassId);
      if ( ! filePath ) return;

      var fs_ = require('fs');
      var content;
      try { content = fs_.readFileSync(filePath, 'utf8'); } catch ( e ) { return; }
      if ( content.length > 2 * 1024 * 1024 ) return;   // skip very large files

      var escaped = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('\\b' + escaped + '\\b', 'g');
      var m;
      var uri = 'file://' + filePath;
      while ( ( m = re.exec(content) ) !== null ) {
        var startPos = this.analyzer.offsetToPosition(content, m.index);
        locations.push({
          uri: uri,
          range: {
            start: startPos,
            end: { line: startPos.line, character: startPos.character + propName.length }
          }
        });
        if ( locations.length > 1000 ) return;   // safety cap
      }
    },

    function resolveClassAtCursor_(text, position, word, opt_uri) {
      /**
       * Resolve the class ID the cursor is on. Handles:
       *   1. Full dotted class id — returned as-is if known.
       *   2. Cursor on the current model's own `name:` — package + name.
       *   3. Short name via the model's requires — alias lookup.
       *   4. Short property-type name (e.g. 'String') — via getPropertyTypes.
       *   5. Dotted word that exists in the registry as a fallback.
       *
       * Qualified ids (contain a dot) take precedence. For unqualified words,
       * model-based resolution runs FIRST because many short names collide
       * with a literal registry entry (e.g. 'FObject' exists but
       * 'foam.lang.FObject' is almost always what the user means).
       */
      var isQualified = word.indexOf('.') !== -1;
      if ( isQualified && this.index.classExists(word) ) return word;

      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      if ( model ) {
        var selfId = this.cache.getClassId(model);
        if ( selfId && ( model.name === word || selfId === word ) ) return selfId;
        var map = this.cache.buildRequiresMap(model);
        if ( map[word] && this.index.classExists(map[word]) ) return map[word];
      }

      var propTypes = this.index.getPropertyTypes();
      for ( var i = 0 ; i < propTypes.length ; i++ ) {
        if ( propTypes[i].name === word ) return propTypes[i].id;
      }

      var resolved = this.analyzer.resolveShortName(text, word);
      if ( resolved && this.index.classExists(resolved) ) return resolved;

      if ( this.index.classExists(word) ) return word;
      return null;
    },

    function buildLocation_(refClassId, targetClassId) {
      /**
       * Build an LSP Location pointing at the referencing file. When the
       * target class ID appears literally in the referencer's source text,
       * point at its exact occurrence; otherwise fall back to line 0.
       */
      var filePath = this.index.getFilePath(refClassId);
      if ( ! filePath ) return null;

      var line = 0, ch = 0;
      try {
        var fs_ = require('fs');
        var content = fs_.readFileSync(filePath, 'utf8');
        var idx = content.indexOf(targetClassId);
        if ( idx !== -1 ) {
          for ( var i = 0 ; i < idx ; i++ ) {
            if ( content[i] === '\n' ) { line++; ch = 0; } else ch++;
          }
          return {
            uri: 'file://' + filePath,
            range: {
              start: { line: line, character: ch },
              end:   { line: line, character: ch + targetClassId.length }
            }
          };
        }
      } catch ( e ) {}

      return {
        uri: 'file://' + filePath,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
      };
    }
  ]
});
