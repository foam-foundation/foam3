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

      // Case B: cursor on a message name inside `messages: [{ name: '…' }]`
      // or a constant name inside `constants: { NAME: … }` / `constants: [...]`.
      // Same scoping as properties — own class + subclasses + requirers + of-users.
      var axiomRefs = this.axiomReferences_(text, position, word, opt_uri);
      if ( axiomRefs ) return axiomRefs;

      // Case C: cursor on a class identifier (name, extends, requires, of, etc.)
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
      for ( var i = 0 ; i < subs.length ; i++ )   add(subs[i]);
      for ( var i = 0 ; i < impls.length ; i++ )  add(impls[i]);
      for ( var i = 0 ; i < reqs.length ; i++ )   add(reqs[i]);
      for ( var i = 0 ; i < ofs.length ; i++ )    add(ofs[i]);

      // Union with the workspace usage indexes (JS / Java / string). These
      // surface classes that *use* the target inside method bodies, javaCode
      // blocks, or via context-injection strings — references grep can't
      // find without parsing every file.
      try {
        var jsUses = this.index.getJsUsages(classId);
        for ( var i = 0 ; i < jsUses.length ; i++ ) add(jsUses[i].sourceClassId);
      } catch (e) {}
      try {
        var javaUses = this.index.getJavaUsages(classId);
        for ( var i = 0 ; i < javaUses.length ; i++ ) add(javaUses[i].sourceClassId);
      } catch (e) {}
      // Class-name strings ARE valid context keys too (e.g. CSpec id matches
      // the dotted class id of its result type) — pick those up via the
      // string-reference index keyed on either the short name or the full id.
      try {
        var shortName = classId.split('.').pop();
        var strUses   = this.index.getStringUsages(shortName);
        for ( var i = 0 ; i < strUses.length ; i++ ) {
          if ( strUses[i].sourceClassId ) add(strUses[i].sourceClassId);
        }
      } catch (e) {}
      // Classes that reference the target ONLY inside a view spec
      // (`view: { class: 'X' }`, searchView, rowView, defaultNewItem, …)
      // declare no requires/of for it — the view-spec index is the only edge
      // that puts their files in the scan set.
      try {
        var viewUses = this.index.getViewSpecUsers(classId);
        for ( var i = 0 ; i < viewUses.length ; i++ ) add(viewUses[i].sourceClassId);
      } catch (e) {}

      var locations = [];
      for ( var i = 0 ; i < refs.length ; i++ ) {
        var locs = this.buildLocations_(refs[i], classId);
        for ( var j = 0 ; j < locs.length ; j++ ) locations.push(locs[j]);
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

    function axiomReferences_(text, position, word, opt_uri) {
      /**
       * Find references when the cursor is on a **message** name inside
       * `messages: [{ name: '…' }]` OR a **constant** name inside
       * `constants: { NAME: … }` / `constants: [{ name: '…' }]`.
       * Returns null if the cursor isn't on one of those (so the caller
       * falls through to class-reference resolution).
       *
       * The pattern is the same as property references: both are exposed
       * on `this` and accessed via `this.NAME` in subclasses. We scope
       * the file scan to the defining class, its subclasses, and classes
       * that require/`of:` the defining class — strict `.NAME` /
       * `'NAME'` / `NAME(` patterns with a comment mask, no false positives.
       */
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      if ( ! model ) return null;

      var kind = null;
      if ( this.isOwnMessageName_(model, word) )       kind = 'message';
      else if ( this.isOwnConstantName_(model, word) ) kind = 'constant';
      if ( ! kind ) return null;

      var classId = this.cache.getClassId(model);
      if ( ! classId ) return null;

      // Same scoping as property references — own class + transitive
      // subclasses + requirers + of-users.
      var seen = {};
      var files = [];
      function addFile(id) {
        if ( ! id || seen[id] ) return;
        seen[id] = true; files.push(id);
      }
      addFile(classId);
      var subs = this.transitiveSubclasses_(classId);
      for ( var i = 0 ; i < subs.length ; i++ ) addFile(subs[i]);
      var reqs = this.index.getRequirers(classId);
      var ofs  = this.index.getOfUsers(classId);
      for ( var i = 0 ; i < reqs.length ; i++ ) addFile(reqs[i]);
      for ( var i = 0 ; i < ofs.length ; i++ )   addFile(ofs[i]);

      var locations = [];
      for ( var i = 0 ; i < files.length ; i++ ) {
        this.scanPropertyRefs_(files[i], word, locations);
      }
      return locations;
    },

    function isOwnMessageName_(model, word) {
      /** True if `word` names one of this model's messages[] entries. */
      var msgs = model.messages || [];
      for ( var i = 0 ; i < msgs.length ; i++ ) {
        var m = msgs[i];
        var n = typeof m === 'string' ? m : (m && m.name);
        if ( n === word ) return true;
      }
      return false;
    },

    function isOwnConstantName_(model, word) {
      /**
       * True if `word` names one of this model's constants. FOAM supports
       * two shapes: an object map `constants: { NAME: … }` and an array
       * `constants: [{ name: 'NAME', value: … }]`.
       */
      var c = model.constants;
      if ( ! c ) return false;
      if ( Array.isArray(c) ) {
        for ( var i = 0 ; i < c.length ; i++ ) {
          var entry = c[i];
          var n = typeof entry === 'string' ? entry : (entry && entry.name);
          if ( n === word ) return true;
        }
        return false;
      }
      if ( typeof c === 'object' ) {
        return Object.prototype.hasOwnProperty.call(c, word);
      }
      return false;
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
       * real reference to `propName`. Matches these semantic patterns only:
       *   • `.propName`          — property access (this.x, obj.x)
       *   • `propName:`          — key position (definition, .create({}))
       *   • `'propName'`         — quoted (tableColumns, searchColumns, aliases)
       *   • `getPropName(`       — Java getter
       *   • `setPropName(`       — Java setter
       * Skips any match whose match-position is inside a line/block comment
       * (detected via preceding-line state).
       */
      var filePath = this.index.getFilePath(refClassId);
      if ( ! filePath ) return;

      var fs_ = require('fs');
      var content;
      try { content = fs_.readFileSync(filePath, 'utf8'); } catch ( e ) { return; }
      if ( content.length > 2 * 1024 * 1024 ) return;

      var escaped = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var cap = propName.charAt(0).toUpperCase() + propName.substring(1);
      var capEsc = cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Each entry: [regex, length-of-matched-identifier, offsetFromMatchStart]
      // offsetFromMatchStart = position of propName within the overall match
      // (e.g. for `.propName`, the name is at offset 1 relative to the `.`).
      var patterns = [
        [ new RegExp('\\.' + escaped + '\\b', 'g'),               propName.length, 1 ],
        [ new RegExp('\\b' + escaped + '\\s*:', 'g'),             propName.length, 0 ],
        [ new RegExp("['\"]" + escaped + "['\"]", 'g'),           propName.length, 1 ],
        [ new RegExp('\\bget' + capEsc + '\\s*\\(', 'g'),         3 + cap.length,  0 ],
        [ new RegExp('\\bset' + capEsc + '\\s*\\(', 'g'),         3 + cap.length,  0 ]
      ];

      var commentMask = this.buildCommentMask_(content);
      var uri = 'file://' + filePath;
      var seen = {};

      for ( var p = 0 ; p < patterns.length ; p++ ) {
        var re = patterns[p][0];
        var nameLen = patterns[p][1];
        var offFromMatch = patterns[p][2];
        var m;
        while ( ( m = re.exec(content) ) !== null ) {
          var hitIdx = m.index + offFromMatch;
          if ( commentMask[hitIdx] ) continue;
          if ( seen[hitIdx] ) continue;
          seen[hitIdx] = true;
          var startPos = this.analyzer.offsetToPosition(content, hitIdx);
          locations.push({
            uri: uri,
            range: {
              start: startPos,
              end: { line: startPos.line, character: startPos.character + nameLen }
            }
          });
          if ( locations.length > 1000 ) return;
        }
      }
    },

    function buildCommentMask_(content) {
      // Return an array where mask[i] === true iff offset i is inside a line
      // comment or block comment. Strings are NOT masked — quoted property
      // names like 'propName' in tableColumns are legitimate references the
      // caller matches.
      var mask = new Array(content.length);
      var i = 0, n = content.length;
      while ( i < n ) {
        var c = content[i];
        if ( c === '/' && content[i + 1] === '/' ) {
          while ( i < n && content[i] !== '\n' ) { mask[i++] = true; }
          continue;
        }
        if ( c === '/' && content[i + 1] === '*' ) {
          mask[i++] = true; mask[i++] = true;
          while ( i < n && ! ( content[i] === '*' && content[i + 1] === '/' ) ) {
            mask[i++] = true;
          }
          if ( i < n ) { mask[i++] = true; mask[i++] = true; }
          continue;
        }
        // Skip string literals so '//' inside a string doesn't start a comment.
        if ( c === "'" || c === '"' || c === '`' ) {
          var q = c;
          i++;
          while ( i < n && content[i] !== q ) {
            if ( content[i] === '\\' ) i++;
            i++;
          }
          if ( i < n ) i++;
          continue;
        }
        i++;
      }
      return mask;
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

      // Cursor on a `this.Short` / `self.Short` usage — resolve the short name
      // via requires so references work FROM a usage site, not just the decl.
      var bare = word.replace(/^(?:this|self)\./, '');

      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      if ( model ) {
        var selfId = this.cache.getClassId(model);
        if ( selfId && ( model.name === word || selfId === word || model.name === bare ) ) return selfId;
        var map = this.cache.buildRequiresMap(model);
        if ( map[word] && this.index.classExists(map[word]) ) return map[word];
        if ( map[bare] && this.index.classExists(map[bare]) ) return map[bare];
      }

      var propTypes = this.index.getPropertyTypes();
      for ( var i = 0 ; i < propTypes.length ; i++ ) {
        if ( propTypes[i].name === word ) return propTypes[i].id;
      }

      // No regex fallback: the model-based lookup above (cache.buildRequiresMap)
      // is the only requires-aware path now.
      if ( this.index.classExists(word) ) return word;
      return null;
    },

    function buildLocations_(refClassId, targetClassId) {
      /**
       * Build LSP Locations for every reference to targetClassId inside
       * refClassId's source file. Three complementary sources, deduped by
       * offset, capped at 200 per file.
       *
       *   A. FoamClassGrammar.collectAxiomPositions(text) — every classRef
       *      position emitted by the grammar (extends / requires / implements
       *      / of / view-class / class-typed slots). Exact and context-aware
       *      because it's driven by the parser, not text.
       *   B. Word-bounded full-id text scan — catches occurrences outside
       *      grammar reach (string literals inside JS function bodies, raw
       *      mentions in comments-style strings, javaImports entries).
       *   C. Short-name scan — `\bShort\b` where the source class's
       *      requires / javaImports map Short → targetClassId. Captures
       *      `this.Flow.create(...)` (JS) and `Flow flow = ...` (Java
       *      code blocks). Word-bounded so `Flow` doesn't match inside
       *      `FlowMode` / `Flowable`.
       *
       * Comments are masked. When no concrete occurrence is found, a single
       * line-0 fallback is returned so the user can still navigate (e.g.
       * the referencer uses an `as` alias and the literal id never appears).
       */
      var filePath = this.index.getFilePath(refClassId);
      if ( ! filePath ) return [];

      var fs_ = require('fs');
      var content;
      try { content = fs_.readFileSync(filePath, 'utf8'); } catch ( e ) { return []; }

      var uri      = 'file://' + filePath;
      var fallback = [{
        uri:   uri,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
      }];
      if ( content.length > 2 * 1024 * 1024 ) return fallback;

      var commentMask = this.buildCommentMask_(content);
      var self = this;
      var out  = [];
      var seen = {};

      function push(idx, len) {
        if ( commentMask[idx] ) return;
        if ( seen[idx] )        return;
        seen[idx] = true;
        var startPos = self.analyzer.offsetToPosition(content, idx);
        out.push({
          uri: uri,
          range: {
            start: startPos,
            end:   { line: startPos.line, character: startPos.character + len }
          }
        });
      }

      // === A. Grammar-emitted classRef positions ===
      try {
        var grammar = typeof this.index.getGrammar === 'function' ?
          this.index.getGrammar() : null;
        if ( grammar ) {
          var posMap = grammar.collectAxiomPositions(content);
          var hits   = ( posMap && posMap.classRef && posMap.classRef[targetClassId] ) || [];
          for ( var i = 0 ; i < hits.length && out.length < 200 ; i++ ) {
            push(hits[i].startPos, targetClassId.length);
          }
        }
      } catch (e) {}

      // === B. Word-bounded full-id text scan ===
      var escapedFull = targetClassId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var reFull = new RegExp('(?<![\\w.])' + escapedFull + '(?![\\w])', 'g');
      var m;
      while ( ( m = reFull.exec(content) ) !== null ) {
        push(m.index, targetClassId.length);
        if ( out.length >= 200 ) break;
      }

      // === C. Short-name scan via requires / javaImports ===
      var shortNames = this.shortNamesFor_(refClassId, targetClassId);
      for ( var s = 0 ; s < shortNames.length && out.length < 200 ; s++ ) {
        var shortName = shortNames[s];
        if ( shortName === targetClassId ) continue;
        var escShort = shortName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // `\bShort\b`, but reject when the preceding char is `.` — those
        // positions are tails of dotted ids already handled by A/B.
        var reShort = new RegExp('(?<![\\w$.])' + escShort + '(?![\\w$])', 'g');
        while ( ( m = reShort.exec(content) ) !== null ) {
          push(m.index, shortName.length);
          if ( out.length >= 200 ) break;
        }
      }

      // === D. Grammar-emitted usage positions (no regex) ===
      // Code usages the grammar tags: `this.Short` / `self.Short` member access
      // (render, init, listeners, const access) via `memberRef`, plus the class
      // positions inside .create() / .tag() / { class: } instantiations. Each
      // is mapped to the target through this class's requires short names or a
      // full-id match. The bare scan in C can't see `.`-preceded usages.
      try {
        var g2 = typeof this.index.getGrammar === 'function' ? this.index.getGrammar() : null;
        if ( g2 ) {
          var shortSet = {};
          for ( var s2 = 0 ; s2 < shortNames.length ; s2++ ) shortSet[shortNames[s2]] = true;
          var pm = g2.collectAxiomPositions(content);
          var self2 = this;
          ['memberRef', 'instCreateReceiver', 'instTagClass', 'instClassRef'].forEach(function(kind) {
            var bucket = ( pm && pm[kind] ) || {};
            for ( var nm in bucket ) {
              var stripped = nm.replace(/^(?:this|self)\./, '');
              var isMatch = shortSet[stripped] || nm === targetClassId || stripped === targetClassId;
              if ( ! isMatch ) continue;
              var recs = Array.isArray(bucket[nm]) ? bucket[nm] : [bucket[nm]];
              for ( var r2 = 0 ; r2 < recs.length && out.length < 200 ; r2++ ) {
                // point at the short-name segment, not the `this.` prefix
                var off = recs[r2].startPos + ( nm.length - stripped.length );
                push(off, stripped.length);
              }
            }
          });
        }
      } catch (e) {}

      return out.length > 0 ? out : fallback;
    },

    function shortNamesFor_(refClassId, targetClassId) {
      /**
       * Short names that refClass uses for targetClassId, drawn from its
       * `requires:` (`'foam.x.Y'` or `'foam.x.Y as Z'`) and `javaImports:`
       * (`'foam.x.Y'`). Returns an array — usually 0 or 1 element. Empty
       * when refClass doesn't declare the target.
       */
      var cls = typeof this.index.getClass === 'function' ?
        this.index.getClass(refClassId) : null;
      if ( ! cls || ! cls.model_ ) return [];
      var out = {};
      var reqs = cls.model_.requires || [];
      for ( var i = 0 ; i < reqs.length ; i++ ) {
        var r = reqs[i];
        var path, alias;
        if ( typeof r === 'string' ) {
          var parts = r.split(/\s+as\s+/);
          path  = parts[0].trim();
          alias = ( parts[1] || path.split('.').pop() ).trim();
        } else if ( r && r.path ) {
          path  = r.path;
          alias = r.name || path.split('.').pop();
        }
        if ( path === targetClassId && alias ) out[alias] = true;
      }
      var ji = cls.model_.javaImports || [];
      for ( var i = 0 ; i < ji.length ; i++ ) {
        var imp = typeof ji[i] === 'string' ? ji[i] : ( ji[i] && ji[i].path );
        if ( imp === targetClassId ) {
          var sh = imp.split('.').pop();
          if ( sh ) out[sh] = true;
        }
      }
      return Object.keys(out);
    }
  ]
});
