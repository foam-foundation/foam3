/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'SymbolHandler',

  requires: [
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.FoamClassGrammar'
  ],

  properties: [
    {
      name: 'fileClassifier',
      documentation: `The one answer to "is this a FOAM class file". server.js
        wires its own shared instance so guard and handler cannot disagree and
        the per-uri memo stays warm; the factory keeps handler-direct tests
        working unwired.`,
      factory: function() { return foam.parse.lsp.FileClassifier.create(); }
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
    },
    {
      name: 'grammar',
      documentation: `Source of each model's and member's extent
        (collectModelExtents). server.js passes its shared instance, since
        building one walks every class id; the factory keeps handler-direct
        tests working unwired.`,
      factory: function() { return this.FoamClassGrammar.create(); }
    }
  ],

  methods: [
    function handle(text, opt_uri) {
      /**
       * Returns DocumentSymbol[] — outline of class, properties, methods.
       *
       * `range` is the symbol's whole extent and `selectionRange` just its
       * name, inside it, as the LSP spec requires. Both used to be one point,
       * so an editor could not tell where a member ends: breadcrumbs and
       * sticky scroll named the wrong member once the cursor left its first
       * line, and "select symbol" selected nothing. Extents come from the
       * grammar's single parse (FoamClassGrammar.collectModelExtents); a
       * member the parse could not see falls back to the old name point.
       */
      if ( this.fileClassifier.classify(opt_uri || '', text) !== 'class' ) return [];

      var models = this.cache.getModels(opt_uri || '', text);
      var symbols = [];
      var pos = this.analyzer.offsetMapper(text);

      for ( var i = 0 ; i < models.length ; i++ ) {
        var m = models[i];
        var className = this.cache.getClassId(m) || 'Unknown';
        var startLine = m.sourceLine_ || 0;
        var kindNum = m.type_ === 'ENUM' ? 10 : m.type_ === 'INTERFACE' ? 11 : 5;
        var entry  = this.entryFor_(text, m);
        var extent = entry && entry.closed ? entry : null;
        // Where a member with no extent is looked for: the model's own call
        // when the grammar paired one (up to the next top-level call, or the
        // extent's end when it closed), else the whole file as before.
        var win = entry ? { from: entry.startPos, to: extent ? extent.endPos : entry.windowEnd } : null;
        var ctx = { text: text, pos: pos, win: win, closed: !! extent, regexHits: 0 };
        var children = [];

        // Property children
        var props = m.properties || [];
        for ( var j = 0 ; j < props.length ; j++ ) {
          var p = props[j];
          var propName = typeof p === 'string' ? p : p.name;
          if ( ! propName ) continue;
          children.push(this.memberSymbol_(ctx, propName, 7,
            extent && extent.properties, entry && entry.propertyPoints, this.findPropPosition_));
        }

        // Method children
        var methods = m.methods || [];
        for ( var j = 0 ; j < methods.length ; j++ ) {
          var method = methods[j];
          var methodName = typeof method === 'function' ? method.name : (method.name || '');
          if ( ! methodName ) continue;
          children.push(this.memberSymbol_(ctx, methodName, 6,
            extent && extent.methods, entry && entry.methodPoints, this.findMethodPosition_));
        }

        if ( ctx.regexHits ) {
          require('../logError').logLspError('SymbolHandler ' + className,
            ctx.regexHits + ' member(s) had no grammar position; placed by name regex');
        }

        var classPoint = { line: startLine, character: 0 };
        var range, selectionRange;
        if ( entry ) {
          // A refinement's name is optional; without one the `foam.CLASS`
          // token is what names the model.
          selectionRange = entry.nameStart !== null
            ? { start: pos(entry.nameStart), end: pos(entry.nameEnd) }
            : { start: pos(entry.startPos), end: pos(Math.max(entry.startPos, entry.headEnd - 1)) };
        } else {
          selectionRange = { start: classPoint, end: classPoint };
        }

        if ( extent ) {
          range = { start: pos(extent.startPos), end: pos(extent.endPos) };
        } else {
          // No closed extent: the range is synthesized around the members
          // rather than the members squeezed onto the class. Clamping them
          // onto a one-point class moved every one to the class line
          // (helloLocale/Controller.js `yourName` from 24:6 to 11:0). With a
          // paired call its members were all found inside [call, next call),
          // so the range runs from the call to the furthest of them; unpaired,
          // they sit where the whole-file search put them and the range
          // stretches to cover them.
          range = this.synthesizedRange_(entry ? pos(entry.startPos) : classPoint, children);
          if ( ! this.contains_(range, selectionRange) ) selectionRange = { start: range.start, end: range.start };
        }

        symbols.push({
          name: className,
          kind: kindNum,
          range: range,
          selectionRange: selectionRange,
          children: children
        });
      }

      // If no models from eval (SyntaxError), fall back to regex
      if ( models.length === 0 ) {
        return this.regexFallback_(text);
      }

      return symbols;
    },

    function before_(a, b) {
      return a.line < b.line || ( a.line === b.line && a.character < b.character );
    },

    function contains_(outer, inner) {
      return ! this.before_(inner.start, outer.start) && ! this.before_(outer.end, inner.end);
    },

    function synthesizedRange_(start, children) {
      /** The smallest range holding `start` and every child range. */
      var r = { start: start, end: start };
      for ( var c = 0 ; c < children.length ; c++ ) {
        if ( this.before_(children[c].range.start, r.start) ) r.start = children[c].range.start;
        if ( this.before_(r.end, children[c].range.end) )     r.end   = children[c].range.end;
      }
      return r;
    },

    function entryFor_(text, model) {
      /** The grammar's entry for `model` (FoamClassGrammar.modelEntryFor),
       *  closed or not, or null when the grammar has no call it pairs with. */
      try {
        return this.grammar.modelEntryFor(text, model);
      } catch ( e ) {
        require('../logError').logLspError('SymbolHandler extent for ' + ( model.name || model.refines ), e);
        return null;
      }
    },

    function memberSymbol_(ctx, name, kind, extents, points, findPoint) {
      /**
       * One member's DocumentSymbol, from the best source available:
       *   1. its closed extent — the whole definition as the range;
       *   2. the grammar's name position inside the model — a point at the
       *      name, when the parse reached the name but not the definition's end;
       *   3. the name regex inside the model's window, then from the model's
       *      call to the end of the file (logged by the caller);
       *   4. the model's call, when even that misses.
       * A name declared twice takes the first, as the outline always has.
       * Without a paired model (no window) steps 3-4 read the whole file, as
       * the outline did before it had extents.
       */
      var pos = ctx.pos;
      if ( extents ) {
        for ( var i = 0 ; i < extents.length ; i++ ) {
          var e = extents[i];
          if ( e.name !== name ) continue;
          return {
            name: name,
            kind: kind,
            range: { start: pos(e.startPos), end: pos(e.endPos) },
            selectionRange: { start: pos(e.nameStart), end: pos(e.nameEnd) }
          };
        }
      }
      if ( points && points[name] ) {
        var nr = { start: pos(points[name].nameStart), end: pos(points[name].nameEnd) };
        return { name: name, kind: kind, range: nr, selectionRange: nr };
      }
      var from = ctx.win ? ctx.win.from : 0;
      var at = findPoint.call(this, ctx.win ? ctx.text.substring(from, ctx.win.to) : ctx.text, name);
      // Not in the window: widen to the end of the file before giving up.
      // The window ends at the next top-level call, and a member can still
      // sit past it when the file's calls are not what the scan takes them
      // for; the model's point is the answer only when the name is nowhere.
      // Not for a closed extent: its range is fixed, and a hit past it would
      // sit outside the class.
      if ( at === -1 && ctx.win && ! ctx.closed ) at = findPoint.call(this, ctx.text.substring(from), name);
      if ( at !== -1 ) ctx.regexHits++;
      var point = at !== -1 ? pos(from + at) : ( ctx.win ? pos(from) : { line: 0, character: 0 } );
      return { name: name, kind: kind,
        range: { start: point, end: point },
        selectionRange: { start: point, end: point } };
    },

    function findPropPosition_(text, propName) {
      /** Offset of a property's `name: 'x'` in `text`, or -1. */
      var regex = new RegExp("name\\s*:\\s*['\"]" + propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]");
      var match = regex.exec(text);
      return match ? match.index : -1;
    },

    function findMethodPosition_(text, methodName) {
      /** Offset of a method's `function x(` in `text`, or -1. */
      var regex = new RegExp("function\\s+" + methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*\\(");
      var match = regex.exec(text);
      return match ? match.index : -1;
    },

    function regexFallback_(text) {
      /** Fallback symbol extraction using regex for broken files. */
      var symbols = [];

      // Class name
      var pkgMatch = text.match(/package\s*:\s*['"]([^'"]+)['"]/);
      var nameMatch = text.match(/name\s*:\s*['"]([^'"]+)['"]/);
      if ( nameMatch ) {
        var className = pkgMatch ? pkgMatch[1] + '.' + nameMatch[1] : nameMatch[1];
        var classPos = this.analyzer.offsetToPosition(text, nameMatch.index);
        symbols.push({
          name: className,
          kind: 5,
          range: { start: { line: 0, character: 0 }, end: this.analyzer.offsetToPosition(text, text.length) },
          selectionRange: { start: classPos, end: { line: classPos.line, character: classPos.character + nameMatch[0].length } }
        });
      }

      // Properties
      var objRegex = /\{\s*class\s*:\s*['"][^'"]*['"]\s*,\s*name\s*:\s*['"]([^'"]+)['"]/g;
      var match;
      while ( ( match = objRegex.exec(text) ) !== null ) {
        var pos = this.analyzer.offsetToPosition(text, match.index);
        symbols.push({
          name: match[1],
          kind: 7,
          range: { start: pos, end: { line: pos.line, character: pos.character + match[0].length } },
          selectionRange: { start: pos, end: { line: pos.line, character: pos.character + match[0].length } }
        });
      }

      // Methods
      var methodRegex = /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      while ( ( match = methodRegex.exec(text) ) !== null ) {
        if ( match[1] === 'factory' || match[1] === 'expression' ) continue;
        var pos = this.analyzer.offsetToPosition(text, match.index);
        symbols.push({
          name: match[1],
          kind: 6,
          range: { start: pos, end: { line: pos.line, character: pos.character + match[0].length } },
          selectionRange: { start: pos, end: { line: pos.line, character: pos.character + match[0].length } }
        });
      }

      return symbols;
    }
  ]
});
