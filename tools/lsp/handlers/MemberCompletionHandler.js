/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'MemberCompletionHandler',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.CompletionItem',
    'foam.parse.lsp.TypeTracker'
  ],

  constants: {
    // Cap on not-yet-required classes offered under `this.<Partial>`. The
    // list is sent with isIncomplete, so the client asks again as the
    // partial grows and the right class surfaces well before the cap bites.
    MAX_AUTO_REQUIRE_ITEMS: 50
  },

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
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.TypeTracker',
      name: 'typeTracker'
    },
    {
      name: 'featureConfig',
      documentation: 'Optional feature-toggle config from tools/lsp/FeatureConfig ' +
        '(server.js wires it). Plain Node object, not an FObject, so no `class:` ' +
        'here — same convention as DiagnosticsHandler.featureConfig. Null means ' +
        '"every feature on", so a handler created bare in tests still offers ' +
        'auto-required classes.'
    },
    {
      name: 'completionItemSupport',
      documentation: `The client's textDocument.completion.completionItem
        capability, as sent in initialize (server.js wires it). Plain object,
        so no class:. Null means the client declared nothing, and the list
        goes out without labelDetails — see CompletionItem.toLSPItems.`
    }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      var result = this.collect_(text, position, opt_uri);
      result.items = this.CompletionItem.toLSPItems(result.items, this.completionItemSupport);
      return result;
    },

    function featureOn_(flag) {
      /** True when `flag` is enabled, or when no featureConfig is wired at all. */
      return ! this.featureConfig || this.featureConfig.enabled(flag);
    },

    function collect_(text, position, opt_uri) {
      if ( this.fileClassifier.classify(opt_uri || '', text) !== 'class' ) {
        return { isIncomplete: false, items: [] };
      }

      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var prefix = line.substring(0, position.character);

      // Value-mode (F3): cursor on an enum-typed property value inside
      // X.create({…}) / .tag(this.X, {…}). Grammar-driven detection.
      var instItems = this.instantiationValueItems_(text, position, opt_uri);
      if ( instItems ) return instItems;

      // Detect context: foam.X. ▊ or foam.X.Y. ▊ where foam.X is a LIB
      var libMatch = prefix.match(/(foam(?:\.\w+)+)\.\w*$/);
      if ( libMatch ) {
        var libItems = this.getLibMemberItems_(libMatch[1]);
        if ( libItems ) return libItems;
      }

      // Detect context: this.X.create({ ▊ }) — on the same line
      var createMatch = prefix.match(/this\.(\w+)\.create\(\s*\{\s*\w*$/);
      if ( createMatch ) {
        return this.handleCreateCompletion(text, createMatch[1], position, opt_uri);
      }

      // Detect context: ClassName.create({ ▊ }) — full class name, same line
      var fullCreateMatch = prefix.match(/([\w.]+)\.create\(\s*\{\s*\w*$/);
      if ( fullCreateMatch ) {
        var classId = fullCreateMatch[1];
        var resolved = this.cache.resolveShortName(opt_uri, text, classId, position.line) || classId;
        if ( this.index.classExists(resolved) ) {
          return this.getClassPropertyItems(resolved);
        }
      }

      // Detect context: cursor INSIDE a .create({ ... }) block on a separate line
      var createCtx = this.analyzer.findCreateContext(text, position.line, this.cache, this.index, opt_uri);
      if ( createCtx ) {
        return this.getClassPropertyItems(createCtx);
      }

      // Detect context: x. ▊ where x is a typed variable from .create()
      var varMatch = prefix.match(/(\w+)\.\w*$/);
      if ( varMatch && varMatch[1] !== 'this' && varMatch[1] !== 'foam' ) {
        var model = this.cache.getModelAt(opt_uri || '', text, position.line);
        var varType = this.typeTracker ? this.typeTracker.resolveVariableType(text, position, varMatch[1], model, this.index) : null;
        if ( varType ) {
          return this.getClassMemberItems(varType);
        }
      }

      // Detect context: this.RequiredClass. ▊ — suggest create() and class constants
      var reqClassMatch = prefix.match(/this\.([A-Z]\w*)\.\w*$/);
      if ( reqClassMatch ) {
        var requiresMap = this.cache.resolveRequiresMap(opt_uri, text, position.line);
        var fullId = requiresMap[reqClassMatch[1]];
        if ( fullId && this.index.classExists(fullId) ) {
          return this.getRequiredClassItems(fullId);
        }
      }

      // Detect context: this. ▊ — suggest members + requires + imports
      if ( /this\.\w*$/.test(prefix) ) {
        return this.handleThisCompletion(text, position, opt_uri);
      }

      return { isIncomplete: false, items: [] };
    },

    function handleThisCompletion(text, position, opt_uri) {
      /** Suggest: own properties, methods, actions, required classes, imports. */
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      var classId = this.cache.getClassId(model);

      // Mid-edit fallback: when the file fails to eval (broken body like
      // `this.` with nothing after it), classId stays null. Route to the
      // cache's text-regex fallback so completions keep working. A
      // grammar-driven axiom extractor will replace this fallback.
      if ( ! classId ) {
        classId = this.cache.resolveClassIdFromText(text);
      }

      var items = [];

      // Properties (own + inherited) — only if class exists in registry
      var props = classId ? this.index.getProperties(classId) : [];
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        var propDoc = '**' + p.name + '** (`' + typeName + '`)';
        if ( p.documentation ) propDoc += '\n\n' + p.documentation;
        items.push({
          label: p.name,
          kind: 10,
          detail: typeName,
          labelDetails: { detail: ': ' + typeName },
          documentation: { kind: 'markdown', value: propDoc },
          sortText: '!' + p.name
        });
      }

      // Methods — with parameter signatures
      var methods = classId ? this.index.getMethods(classId) : [];
      for ( var i = 0 ; i < methods.length ; i++ ) {
        var m = methods[i];
        var sig = this.analyzer.getMethodSignature(m);
        var doc = '```javascript\n' + sig + '\n```';
        if ( m.documentation ) doc += '\n\n' + m.documentation;
        items.push({
          label: m.name,
          kind: 2,
          detail: sig,
          documentation: { kind: 'markdown', value: doc },
          insertText: m.name + '()',
          sortText: '!1_' + m.name
        });
      }

      // Actions
      var actions = classId ? this.index.getActions(classId) : [];
      for ( var i = 0 ; i < actions.length ; i++ ) {
        items.push({
          label: actions[i].name,
          kind: 2,
          detail: 'Action',
          documentation: actions[i].documentation || '',
          sortText: '1_' + actions[i].name
        });
      }

      // Required classes (model-first, text fallback) — this.ShortName is available
      var requiresMap = this.cache.resolveRequiresMap(opt_uri, text, position.line);
      for ( var alias in requiresMap ) {
        var fullId = requiresMap[alias];
        var cls = this.index.getClass(fullId);
        var rdoc = cls && cls.model_ ? ( cls.model_.documentation || '' ) : '';
        items.push({
          label: alias,
          kind: 7,
          detail: fullId,
          labelDetails: { description: this.packageOf_(fullId) },
          documentation: rdoc.substring(0, 100),
          sortText: '!2_' + alias
        });
      }

      // Classes not required yet — `this.DAOCon▊` offers
      // foam.comics.DAOControllerView along with the require it needs.
      var autoRequire = this.featureOn_('completion.autoRequires') &&
        ! ( model && model.type_ === 'LIB' );
      if ( autoRequire ) {
        var line    = text.split('\n')[position.line] || '';
        var partial = /this\.(\w*)$/.exec(line.substring(0, position.character))[1];
        var extra   = this.autoRequireItems_(text, position, partial, requiresMap, classId, model, opt_uri);
        for ( var i = 0 ; i < extra.length ; i++ ) items.push(extra[i]);
      }

      // Imports — model-first (preserves shape), text fallback
      // Imports list (model.imports when available, mid-edit regex fallback otherwise).
      var importNames = this.cache.resolveImports(opt_uri, text, position.line);
      for ( var i = 0 ; i < importNames.length ; i++ ) {
        items.push({
          label: importNames[i],
          kind: 10,
          detail: 'import',
          sortText: '!2_' + importNames[i]
        });
      }

      // isIncomplete while auto-require is on: `this.` alone offers no
      // unrequired class (there is no partial to narrow 4000 ids by), so the
      // client must ask again once the user types `D`, `DA`, … — a complete
      // list would be filtered client-side and never grow them.
      return { isIncomplete: autoRequire, items: items };
    },

    function isJavaOnly_(flags) {
      /**
       * True for model flags naming java but neither js nor web:
       * `['java']` or `'java'`. `['js', 'java']` and no flags at all are
       * both false — those classes exist in JS.
       */
      if ( ! flags ) return false;
      var list = Array.isArray(flags) ? flags : String(flags).split(/[|&,\s]+/);
      return list.indexOf('java') !== -1 && list.indexOf('js') === -1 && list.indexOf('web') === -1;
    },

    function packageOf_(classId) {
      /** 'foam.comics.DAOControllerView' → 'foam.comics'; '' for an id with no package. */
      var dot = classId.lastIndexOf('.');
      return dot === -1 ? '' : classId.substring(0, dot);
    },

    function autoRequireItems_(text, position, partial, requiresMap, ownClassId, model, opt_uri) {
      /**
       * Classes this model does not require yet, offered under
       * `this.<Partial>`.
       *
       * Problem: `this.DAOCon▊` only ever listed the classes already in
       * `requires:`, so reaching for a new one meant leaving the method,
       * typing 'foam.comics.DAOControllerView' into the array, and coming back.
       * Offering it here and inserting the short name alone would be worse:
       * `this.DAOControllerView` is undefined at runtime until the class is
       * required.
       *
       * Fix: every item carries an additionalTextEdits entry that adds the
       * id to the `requires:` of the model the cursor is in (requiresEdit_),
       * so the pick and the require land together. When no edit can be
       * built — an unterminated array, one holding `{ path: … }` objects —
       * nothing is offered: a short name without its require is a bug.
       *
       * Only a partial starting with a capital is a class name (`this.foo`
       * is a member), and a class whose short name the file already uses —
       * required as itself or as another class — is skipped: requiring a
       * second `DetailView` would silently change what the first one means.
       * The same holds for a name the class already has without requiring
       * it (inheritedNameTaken_).
       *
       * A Java-only class (`flags: ['java']`, e.g. foam.dao.F3FileJournal)
       * has no JS side for `this.X` to reach, so it is offered only when the
       * model being edited is Java-only as well.
       */
      if ( ! partial || ! /^[A-Z]/.test(partial) ) return [];
      var ownJavaOnly = this.isJavaOnly_(model && model.flags);

      var taken = {};
      for ( var alias in requiresMap ) {
        taken[alias] = true;
        taken[requiresMap[alias]] = true;
      }

      var inherited = this.inheritedNameTaken_(ownClassId, model);

      var lower = partial.toLowerCase();
      var ids   = this.index.getAllClassIds();
      var hits  = [];
      for ( var i = 0 ; i < ids.length ; i++ ) {
        var id    = ids[i];
        var short = id.substring(id.lastIndexOf('.') + 1);
        if ( short.toLowerCase().indexOf(lower) !== 0 ) continue;
        if ( taken[short] || taken[id] || id === ownClassId || inherited(short) ) continue;
        if ( ! ownJavaOnly ) {
          var cls = this.index.getClass(id);
          if ( cls && cls.model_ && this.isJavaOnly_(cls.model_.flags) ) continue;
        }
        hits.push({ id: id, short: short });
      }
      if ( ! hits.length ) return [];
      hits.sort(function(a, b) {
        return a.short < b.short ? -1 : a.short > b.short ? 1 :
               a.id    < b.id    ? -1 : a.id    > b.id    ? 1 : 0;
      });

      var layout = this.requiresLayout_(text, this.analyzer.positionToOffset(text, position));
      if ( ! layout ) return [];
      if ( ! this.modelMatchesLayout_(text, opt_uri, model, layout) ) return [];

      // The model HAS a requires: array the harvest did not reach. The
      // grammar stops at the first entry it cannot parse — a call in a value
      // such as `axioms: [ foam.pattern.Faceted.create() ]` — so a
      // `requires:` written after it has no span. Taking that for "no
      // requires yet" wrote a second `requires:` key, and in an object
      // literal the later duplicate wins: the original array survived and
      // the new require was dropped. There is no safe place to write, so
      // nothing is offered.
      var hasRequires = ( model && model.requires !== undefined ) || Object.keys(requiresMap).length > 0;
      if ( ! layout.requires && hasRequires ) return [];

      var items = [];
      for ( var i = 0 ; i < hits.length && items.length < this.MAX_AUTO_REQUIRE_ITEMS ; i++ ) {
        var edit = this.requiresEdit_(text, layout, hits[i].id);
        if ( ! edit ) return [];
        items.push({
          label: hits[i].short,
          kind: 7,
          detail: hits[i].id,
          labelDetails: { description: this.packageOf_(hits[i].id) },
          documentation: 'Adds `' + hits[i].id + '` to `requires:`.',
          sortText: '!3_' + hits[i].short,
          additionalTextEdits: [ edit ]
        });
      }
      return items;
    },

    function inheritedNameTaken_(ownClassId, model) {
      /**
       * Returns fn(short) → true when `this.<short>` already means something
       * in this class without a `requires:` entry of its own.
       *
       * Problem: a class implementing foam.mlang.Expressions gets `GroupBy`
       * from that interface's requires (it is what GROUP_BY() builds). The
       * offer listed foam.dashboard.model.GroupBy first; picking it added
       * that require, and GROUP_BY() then built a dashboard GroupBy.
       *
       * Fix: ask the classes the name could come from — the class itself
       * when registered, its parent and each implemented interface (read off
       * the model, since the registry lags an unsaved edit) — for an axiom
       * of that name, and check the model's own inner classes.
       */
      var self   = this;
      var owners = [];
      var add    = function(id) {
        var cls = id && self.index.getClass(id);
        if ( cls && cls.getAxiomByName ) owners.push(cls);
      };
      add(ownClassId);
      if ( model ) {
        add(model.extends || 'foam.lang.AbstractFObject');
        ( model.implements || [] ).forEach(function(i) { add(typeof i === 'string' ? i : i && i.path); });
      }
      var inner = {};
      ( model && model.classes || [] ).forEach(function(c) { if ( c && c.name ) inner[c.name] = true; });
      return function(short) {
        if ( inner[short] ) return true;
        for ( var i = 0 ; i < owners.length ; i++ ) {
          if ( owners[i].getAxiomByName(short) ) return true;
        }
        return false;
      };
    },

    function requiresLayout_(text, offset) {
      /**
       * Where the `requires:` of the model enclosing `offset` is, or where
       * one would go. The model's span is read off the significant-call scan
       * (its own `foam.X(` to the next one), and the entries inside it off
       * the grammar's `requiresEntry` / `headEntry` harvest — no regex over
       * model structure (see "Model positions" in tools/lsp/CLAUDE.md).
       *
       * Returns { requires, heads, callOffset } — `requires` is the entry's
       * span or null, `heads` the package/name/extends/refines/implements
       * spans in source order — or null when the offset is in no model.
       *
       * Records inside a comment are dropped. The grammar's top level skips
       * text a character at a time, so it parses a commented-out foam.CLASS
       * like a live one: in src/foam/parse/parse.js the `/* … *\/`
       * AltSuggestion after Suggestion supplied Suggestion's last `name:`,
       * and the new `requires:` was written into the comment and lost.
       *
       * When a model has two `requires:` keys (ScrollWizardletView.js has),
       * JS keeps the LAST, so that is the one reported.
       */
      var self  = this;
      var calls = this.fileClassifier.significantCalls(text);
      var start = -1;
      var end   = text.length;
      for ( var i = 0 ; i < calls.length ; i++ ) {
        if ( calls[i].offset <= offset ) { start = calls[i].offset; continue; }
        end = calls[i].offset;
        break;
      }
      if ( start === -1 ) return null;

      var positions = this.index.getGrammar().collectAxiomPositions(text);
      var comments  = this.fileClassifier.commentSpans(text);
      function inModel(byText) {
        // Backtracking re-runs a rule at the same offset, so one entry can
        // be recorded twice — keep one record per start.
        var out = [], seen = {};
        for ( var key in byText ) {
          var recs = byText[key];
          for ( var r = 0 ; r < recs.length ; r++ ) {
            var rec = recs[r];
            if ( rec.startPos < start || rec.startPos >= end || seen[rec.startPos] ) continue;
            if ( self.inComment_(comments, rec.startPos) ) continue;
            seen[rec.startPos] = true;
            out.push(rec);
          }
        }
        return out.sort(function(a, b) { return a.startPos - b.startPos; });
      }
      var requires = inModel(positions.requiresEntry);
      return {
        requires:   requires[requires.length - 1] || null,
        heads:      inModel(positions.headEntry),
        callOffset: start,
        comments:   comments
      };
    },

    function modelMatchesLayout_(text, opt_uri, model, layout) {
      /**
       * True when `model` — whose requires decide what is already required —
       * is the model whose text `layout` is about to edit.
       *
       * Problem: FileModelCache.parseFileModels gives the k-th evaluated
       * model the line of the k-th significant foam.X( call. A call that
       * never runs at load time breaks that pairing for every model after
       * it: src/foam/dao/Relationship.js:329 declares a foam.CLASS inside a
       * method, so each later model carries the previous call's line, and
       * getModelAt inside ManyToManyRelationshipImpl answers the model AFTER
       * it. `this.StackB` then added foam.u2.stack.StackBlock a second time,
       * because the wrong model's requires said it was missing. The same
       * happens in the other direction when one call runs several times
       * (`[...].forEach(M => foam.CLASS(...))`).
       *
       * Fix (a guard, not a repair of parseFileModels): the model's
       * sourceLine_ must be the line of the call being edited, and the count
       * of evaluated models must match the count of calls that produce one.
       * Either failing means the pairing is untrustworthy, and nothing is
       * offered. A missing model (the file did not evaluate) is trusted only
       * when the file has a single call, so there is nothing to mispair.
       */
      var calls = this.fileClassifier.significantCalls(text).filter(function(c) {
        return c.name !== 'LIB' && c.name !== 'POM' && c.name !== 'SCRIPT';
      });
      if ( ! model ) return calls.length <= 1;
      var callLine = this.analyzer.offsetToPosition(text, layout.callOffset).line;
      if ( model.sourceLine_ !== callLine ) return false;
      var models = this.cache.getModels(opt_uri || '', text).filter(function(m) { return m.type_ !== 'LIB'; });
      return models.length === calls.length;
    },

    function inComment_(comments, offset) {
      /** True when `offset` sits inside one of `comments` ({ start, end }, sorted). */
      for ( var i = 0 ; i < comments.length ; i++ ) {
        if ( comments[i].start > offset ) return false;
        if ( offset < comments[i].end ) return true;
      }
      return false;
    },

    function eolAt_(text, offset) {
      /**
       * The line ending of the line holding `offset`: '\r\n' or '\n'. Asked
       * per line, not per file — a file with a single CRLF somewhere is not a
       * CRLF file, and a break written next to an LF line must be LF.
       */
      var nl = text.indexOf('\n', offset);
      if ( nl === -1 ) nl = text.lastIndexOf('\n', offset);
      return nl > 0 && text.charAt(nl - 1) === '\r' ? '\r\n' : '\n';
    },

    function requiresEdit_(text, layout, classId) {
      /**
       * The TextEdit that adds `classId` to the model's requires, written the
       * way the file already writes it:
       *   - an array exists: the id goes in with the entries' own quote and
       *     indentation — at its sorted place when the entries are sorted,
       *     last otherwise; one entry per line or all on one line, as found;
       *   - no array: `requires: [ … ]` goes in after the model's last
       *     identity entry (package/name/extends/refines/implements), which
       *     is where FOAM files put it.
       * Line breaks copy the ending of the line written next to, so a CRLF
       * line gets `\r\n` and an LF line `\n`, even in a mixed file.
       * Returns null when the text leaves no safe place to write — which
       * includes any position inside a comment.
       */
      var self = this;
      var eol;
      function edit(from, to, newText) {
        if ( self.inComment_(layout.comments, from) ) return null;
        return {
          range: { start: self.analyzer.offsetToPosition(text, from), end: self.analyzer.offsetToPosition(text, to) },
          newText: newText
        };
      }

      if ( layout.requires ) {
        var open = text.indexOf('[', layout.requires.startPos);
        var list = open === -1 ? null : this.scanStringList_(text, open);
        if ( ! list ) return null;
        var strs = list.strings;
        eol = this.eolAt_(text, open);

        if ( ! strs.length ) {
          var keyIndent = this.lineIndent_(text, layout.requires.startPos);
          var q = this.quoteOf_(text, layout);
          return edit(open + 1, list.close, eol + keyIndent + this.indentUnit_(text, keyIndent, layout.callOffset) +
            q + classId + q + eol + keyIndent);
        }

        var lit    = strs[0].quote + classId + strs[0].quote;
        var sorted = true;
        for ( var i = 1 ; i < strs.length ; i++ ) {
          if ( strs[i - 1].value > strs[i].value ) { sorted = false; break; }
        }
        var at = strs.length;
        if ( sorted ) {
          for ( var i = 0 ; i < strs.length ; i++ ) {
            if ( classId < strs[i].value ) { at = i; break; }
          }
        }
        var multiline = this.analyzer.offsetToPosition(text, strs[0].start).line !==
                        this.analyzer.offsetToPosition(text, open).line;
        if ( at < strs.length ) {
          var before = strs[at];
          return edit(before.start, before.start,
            lit + ( multiline ? ',' + eol + this.lineIndent_(text, before.start) : ', ' ));
        }
        var last = strs[strs.length - 1];
        return edit(last.end, last.end,
          ( multiline ? ',' + eol + this.lineIndent_(text, last.start) : ', ' ) + lit);
      }

      // No requires: yet — insert after the last identity entry. Its end must
      // be followed by `,` or the closing `}`; anything else means the
      // grammar stopped inside the entry, and writing there would land in
      // the middle of it.
      var anchor = layout.heads[layout.heads.length - 1];
      if ( ! anchor ) return null;
      eol = this.eolAt_(text, anchor.endPos);
      var after = anchor.endPos;
      while ( after < text.length && /\s/.test(text.charAt(after)) ) after++;
      var next = text.charAt(after);
      if ( next !== ',' && next !== '}' ) return null;

      var indent = this.lineIndent_(text, anchor.startPos);
      var quote  = this.quoteOf_(text, layout);
      var block  = 'requires: [' + eol + indent + this.indentUnit_(text, indent, layout.callOffset) +
        quote + classId + quote + eol + indent + ']';
      return next === ','
        ? edit(after + 1, after + 1, eol + indent + block + ',')
        : edit(anchor.endPos, anchor.endPos, ',' + eol + indent + block);
    },

    function quoteOf_(text, layout) {
      /**
       * The quote the model writes its identity values with — `name: "Foo"`
       * gets a `"foam.x.Y"` require, not a lone single-quoted one. Single
       * quote (the FOAM convention) when there is nothing to copy.
       */
      var head = layout.heads[0];
      if ( ! head ) return "'";
      var src = text.substring(head.startPos, head.endPos);
      var sq  = src.indexOf("'");
      var dq  = src.indexOf('"');
      return dq !== -1 && ( sq === -1 || dq < sq ) ? '"' : "'";
    },

    function scanStringList_(text, open) {
      /**
       * The string literals of the array opening at `open`, up to its `]`:
       * { strings: [{ start, end, value, quote }], close }. Comments are
       * skipped. Null for an unterminated array or one holding anything but
       * strings (`{ path: … }` entries) — a place requiresEdit_ must not
       * guess at.
       */
      var strings = [];
      for ( var i = open + 1 ; i < text.length ; i++ ) {
        var c = text.charAt(i);
        if ( c === ']' ) return { strings: strings, close: i };
        if ( c === '[' || c === '{' ) return null;
        if ( c === '/' && text.charAt(i + 1) === '/' ) {
          i = text.indexOf('\n', i);
          if ( i === -1 ) return null;
          continue;
        }
        if ( c === '/' && text.charAt(i + 1) === '*' ) {
          i = text.indexOf('*/', i + 2);
          if ( i === -1 ) return null;
          i++;
          continue;
        }
        if ( c === "'" || c === '"' || c === '`' ) {
          var close = text.indexOf(c, i + 1);
          if ( close === -1 ) return null;
          strings.push({ start: i, end: close + 1, value: text.substring(i + 1, close), quote: c });
          i = close;
        }
      }
      return null;
    },

    function lineIndent_(text, offset) {
      /** Leading whitespace of the line holding `offset`. */
      var start = text.lastIndexOf('\n', offset - 1) + 1;
      var end   = start;
      while ( end < text.length && ( text.charAt(end) === ' ' || text.charAt(end) === '\t' ) ) end++;
      return text.substring(start, end);
    },

    function indentUnit_(text, keyIndent, callOffset) {
      /**
       * One level of the file's indentation: how far the model's keys sit in
       * from its `foam.X(` line. A model nested in an IIFE with 4-space keys
       * under a 2-space call gives '  ', not '    '. Two spaces when the
       * keys are not indented past the call.
       */
      var callIndent = this.lineIndent_(text, callOffset);
      return keyIndent.length > callIndent.length && keyIndent.indexOf(callIndent) === 0
        ? keyIndent.substring(callIndent.length) : '  ';
    },

    function handleCreateCompletion(text, shortName, position, opt_uri) {
      /** Resolve short name from requires, then suggest its properties. */
      var fullId = this.cache.resolveShortName(opt_uri, text, shortName, position ? position.line : 0);
      if ( ! fullId ) return { isIncomplete: false, items: [] };
      return this.getClassPropertyItems(fullId);
    },

    function instantiationValueItems_(text, position, opt_uri) {
      /** Enum value completion for a property value inside an instantiation.
       *  Returns null unless the cursor is on (or just after) an enum-typed
       *  property's value. */
      var grammar = this.index.getGrammar && this.index.getGrammar();
      if ( ! grammar || ! grammar.collectInstantiations ) return null;
      var off = this.analyzer.positionToOffset(text, position);

      // end-of-line offset (bounds an unclosed/absent value to its own line)
      var lineEnd = text.indexOf('\n', off);
      if ( lineEnd === -1 ) lineEnd = text.length;

      var insts = grammar.collectInstantiations(text);
      var best = null;  // { inst, entry }
      for ( var i = 0 ; i < insts.length ; i++ ) {
        var inst = insts[i];
        for ( var e = 0 ; e < inst.entries.length ; e++ ) {
          var entry = inst.entries[e];
          if ( off <= entry.keyPos.endPos ) continue;   // cursor not past this key's colon
          var regionEnd = entry.valuePos ? entry.valuePos.endPos + 1 : lineEnd;
          if ( off > regionEnd ) continue;
          if ( ! best || entry.keyPos.startPos > best.entry.keyPos.startPos ) best = { inst: inst, entry: entry };
        }
      }
      if ( ! best ) return null;

      var classId = this.cache.resolveShortName(opt_uri, text, best.inst.classText, position.line) || best.inst.classText;
      if ( ! this.index.classExists(classId) ) return null;
      var info = this.index.getPropertyInfo(classId, best.entry.key);
      if ( ! info.found || ! info.isEnum ) return null;

      var items = [];
      for ( var v = 0 ; v < info.enumValues.length ; v++ ) {
        var val = info.enumValues[v];
        items.push({
          label: val.name,
          kind: 13,  // EnumMember
          detail: info.enumId + '.' + val.name + ( val.label ? ' — ' + val.label : '' ),
          documentation: val.label || '',
          sortText: '!0_' + ( '0000' + val.ordinal ).slice(-4)
        });
      }
      return { isIncomplete: false, items: items };
    },

    function getLibMemberItems_(dottedPrefix) {
      /**
       * Completion items for foam.LIB members. `dottedPrefix` is the segment
       * before the trailing dot — e.g. 'foam.Color' or 'foam.animation.Interp'.
       * Returns null when no matching LIB exists so callers can fall through.
       */
      var entry = this.index.getLibEntry(dottedPrefix);
      if ( ! entry ) return null;
      var items = [];
      var methods = entry.methods || [];
      for ( var i = 0 ; i < methods.length ; i++ ) {
        items.push({
          label: methods[i],
          kind: 2,
          detail: 'method — ' + dottedPrefix,
          sortText: '!' + methods[i]
        });
      }
      var consts = entry.constants || [];
      for ( var j = 0 ; j < consts.length ; j++ ) {
        items.push({
          label: consts[j],
          kind: 21,
          detail: 'constant — ' + dottedPrefix,
          sortText: '!' + consts[j]
        });
      }
      return { isIncomplete: false, items: items };
    },

    function getClassMemberItems(classId) {
      /** Get completion items for properties + methods + actions of a class (for typed variables). */
      var items = [];

      // Properties
      var props = this.index.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        items.push({
          label: p.name,
          kind: 10,
          detail: typeName + ' — ' + classId,
          labelDetails: { detail: ': ' + typeName },
          documentation: p.documentation || '',
          sortText: '!' + p.name
        });
      }

      // Methods
      var methods = this.index.getMethods(classId);
      for ( var i = 0 ; i < methods.length ; i++ ) {
        var m = methods[i];
        var sig = this.analyzer.getMethodSignature(m);
        items.push({
          label: m.name,
          kind: 2,
          detail: sig,
          documentation: m.documentation || '',
          insertText: m.name + '()',
          sortText: '!1_' + m.name
        });
      }

      // Actions
      var actions = this.index.getActions(classId);
      for ( var i = 0 ; i < actions.length ; i++ ) {
        items.push({
          label: actions[i].name,
          kind: 2,
          detail: 'Action — ' + classId,
          documentation: actions[i].documentation || '',
          sortText: '!1_' + actions[i].name
        });
      }

      return { isIncomplete: false, items: items };
    },

    function getRequiredClassItems(classId) {
      /** Get completion items for a required class: enum values, create(), constants. */
      var items = [];

      // If it's an enum, suggest its ordinal values (primary usage)
      var enumValues = this.index.getEnumValues(classId);
      if ( enumValues && enumValues.length > 0 ) {
        for ( var i = 0 ; i < enumValues.length ; i++ ) {
          var v = enumValues[i];
          items.push({
            label: v.name,
            kind: 13, // EnumMember
            detail: classId + '.' + v.name + ( v.label ? ' — ' + v.label : '' ),
            documentation: v.label || '',
            sortText: '!0_' + ('0000' + v.ordinal).slice(-4)
          });
        }
        return { isIncomplete: false, items: items };
      }

      // create() — primary action on a required class
      var props = this.index.getOwnProperties(classId);
      var propNames = props.slice(0, 5).map(function(p) { return p.name; }).join(', ');
      items.push({
        label: 'create',
        kind: 2,
        detail: classId + '.create({})',
        documentation: { kind: 'markdown', value: '```foam\n' + classId + '.create()\n```\nCreate a new instance.' + ( propNames ? '\n\nProperties: `' + propNames + '`...' : '' ) },
        insertText: 'create({\n  $0\n})',
        insertTextFormat: 2,
        sortText: '!0_create'
      });

      // Static property constants: CLASS_NAME.PROPERTY_NAME
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var constName = p.name.replace(/([A-Z])/g, '_$1').toUpperCase();
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        items.push({
          label: constName,
          kind: 21,
          detail: typeName + ' axiom',
          documentation: p.documentation || '',
          sortText: '!1_' + constName
        });
      }

      // getAxiomByName, isInstance, isSubClass — common static methods
      var staticMethods = ['isInstance', 'isSubClass', 'getAxiomByName', 'getAxiomsByClass'];
      for ( var i = 0 ; i < staticMethods.length ; i++ ) {
        items.push({
          label: staticMethods[i],
          kind: 2,
          detail: 'static method',
          insertText: staticMethods[i] + '($0)',
          insertTextFormat: 2,
          sortText: '!2_' + staticMethods[i]
        });
      }

      return { isIncomplete: false, items: items };
    },

    function getClassPropertyItems(classId) {
      /** Get completion items for all properties of a class (for .create({})). */
      var props = this.index.getProperties(classId);
      var items = [];
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        items.push({
          label: p.name,
          kind: 10,
          detail: typeName + ' — ' + classId,
          labelDetails: { detail: ': ' + typeName },
          documentation: p.documentation || '',
          insertText: p.name + ': ',
          sortText: '!' + p.name,
          preselect: i === 0
        });
      }
      return { isIncomplete: false, items: items };
    }
  ]
});
