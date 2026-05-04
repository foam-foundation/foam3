/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'CompletionHandler',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.FoamClassGrammar',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.CursorSentinel',
    'foam.parse.lsp.CompletionItem',
    'foam.parse.StringPStream'
  ],

  constants: {
    CSS_PROPERTIES: [
      'align-content', 'align-items', 'align-self', 'animation', 'animation-delay',
      'animation-direction', 'animation-duration', 'animation-fill-mode', 'animation-name',
      'animation-play-state', 'animation-timing-function', 'appearance',
      'backdrop-filter', 'backface-visibility', 'background', 'background-attachment',
      'background-clip', 'background-color', 'background-image', 'background-origin',
      'background-position', 'background-repeat', 'background-size',
      'border', 'border-bottom', 'border-bottom-color', 'border-bottom-left-radius',
      'border-bottom-right-radius', 'border-bottom-style', 'border-bottom-width',
      'border-collapse', 'border-color', 'border-image', 'border-left', 'border-left-color',
      'border-left-style', 'border-left-width', 'border-radius', 'border-right',
      'border-right-color', 'border-right-style', 'border-right-width', 'border-spacing',
      'border-style', 'border-top', 'border-top-color', 'border-top-left-radius',
      'border-top-right-radius', 'border-top-style', 'border-top-width', 'border-width',
      'bottom', 'box-shadow', 'box-sizing',
      'clear', 'clip', 'clip-path', 'color', 'column-count', 'column-gap', 'column-rule',
      'column-width', 'columns', 'content', 'counter-increment', 'counter-reset', 'cursor',
      'direction', 'display',
      'fill', 'filter', 'flex', 'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow',
      'flex-shrink', 'flex-wrap', 'float', 'font', 'font-family', 'font-feature-settings',
      'font-size', 'font-style', 'font-variant', 'font-weight',
      'gap', 'grid', 'grid-area', 'grid-auto-columns', 'grid-auto-flow', 'grid-auto-rows',
      'grid-column', 'grid-column-end', 'grid-column-gap', 'grid-column-start', 'grid-gap',
      'grid-row', 'grid-row-end', 'grid-row-gap', 'grid-row-start', 'grid-template',
      'grid-template-areas', 'grid-template-columns', 'grid-template-rows',
      'height',
      'justify-content', 'justify-items', 'justify-self',
      'left', 'letter-spacing', 'line-height', 'list-style', 'list-style-type',
      'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top',
      'max-height', 'max-width', 'min-height', 'min-width',
      'object-fit', 'object-position', 'opacity', 'order', 'outline', 'outline-color',
      'outline-offset', 'outline-style', 'outline-width', 'overflow', 'overflow-x',
      'overflow-y', 'overflow-wrap',
      'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top',
      'perspective', 'place-content', 'place-items', 'place-self', 'pointer-events',
      'position',
      'resize', 'right', 'row-gap',
      'scroll-behavior', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-width',
      'table-layout', 'text-align', 'text-decoration', 'text-decoration-color',
      'text-decoration-line', 'text-decoration-style', 'text-indent', 'text-overflow',
      'text-shadow', 'text-transform', 'top', 'transform', 'transform-origin',
      'transition', 'transition-delay', 'transition-duration', 'transition-property',
      'transition-timing-function',
      'user-select',
      'vertical-align', 'visibility',
      'white-space', 'width', 'will-change', 'word-break', 'word-spacing', 'word-wrap',
      'writing-mode',
      'z-index'
    ]
  },

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
      of: 'foam.parse.lsp.FoamClassGrammar',
      name: 'grammar',
      factory: function() { return this.FoamClassGrammar.create({ index: this.index }); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CSSTokenResolver',
      name: 'cssTokenResolver'
    }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      if ( ! this.analyzer.isFoamFile(text, true) ) {
        return { isIncomplete: false, items: [] };
      }
      var uri = opt_uri || '';

      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var prefix = line.substring(0, position.character);

      // CSS block completions
      var cssItems = this.cssBlockCompletion_(text, position, uri);
      if ( cssItems && cssItems.length > 0 ) {
        return { isIncomplete: cssItems.length > 200, items: this.toLSPItems_(cssItems) };
      }

      // Java block completions: suggest getters/setters inside javaCode/javaGetter/etc.
      var javaItems = this.javaBlockCompletion_(text, position, lines, prefix, uri);
      if ( javaItems && javaItems.length > 0 ) {
        return { isIncomplete: false, items: this.toLSPItems_(javaItems) };
      }

      // Try context-based completion first when cursor is inside a quoted value.
      // The grammar sees complete text including closing quote, but contextFallback
      // correctly extracts the partial value between opening quote and cursor.
      if ( /['"][^'"]*$/.test(prefix) ) {
        var contextItems = this.contextFallback(text, position, uri);
        if ( contextItems.length > 0 ) {
          return { isIncomplete: contextItems.length > 200, items: this.toLSPItems_(contextItems) };
        }
      }

      // Fall back to grammar-based suggestions
      var offset = this.analyzer.positionToOffset(text, position);
      var suggestions = this.collectSuggestions(text, offset);

      var items = [];
      var keys = Object.keys(suggestions);
      for ( var i = 0 ; i < keys.length ; i++ ) {
        var s = suggestions[keys[i]];
        // Skip internal context-marker sugs (used by detectContext_)
        if ( s.text && s.text.indexOf('__ctx_') === 0 ) continue;
        items.push(this.toCompletionItem(s));
      }

      // Fallback: if grammar found no suggestions, detect context from line text
      if ( items.length === 0 ) {
        items = this.contextFallback(text, position, uri);
      }

      return { isIncomplete: items.length > 200, items: this.toLSPItems_(items) };
    },

    function contextFallback(text, position, opt_uri) {
      /** Detect cursor context from surrounding text and provide suggestions. */
      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var prefix = line.substring(0, position.character);

      // Find where the partial value starts (after the opening quote)
      var partialStart = this.findQuoteStart_(prefix);
      var replaceRange = {
        start: { line: position.line, character: partialStart },
        end: position
      };

      // POM file completions — file names, flags, projects
      if ( /foam\.POM\s*\(/.test(text) && /['"][^'"]*$/.test(prefix) ) {
        var pomItems = this.pomContextCompletion_(text, position, lines, prefix, replaceRange);
        if ( pomItems ) return pomItems;
      }

      // Inside class: '...' → property types.
      // Only foam.lang.* types insert by short name; all others must use the
      // full class id so the generated completion doesn't silently strip
      // the package (e.g. `class: 'foam.u2.ViewSpec'` must stay qualified).
      if ( /class\s*:\s*['"][^'"]*$/.test(prefix) ) {
        var self = this;
        return this.index.getPropertyTypes().map(function(t) {
          var isLang = t.id && t.id.indexOf('foam.lang.') === 0;
          var insertText = isLang ? t.name : t.id;
          return {
            label: t.name, kind: 7, detail: t.id,
            textEdit: { range: replaceRange, newText: insertText },
            filterText: t.name,
            sortText: '!' + t.name.toLowerCase()
          };
        });
      }

      // Inside tableColumns: ['...' or searchColumns: ['...' → property names
      // Grammar-driven detection via 'columnName' context marker; fall back
      // to regex for robustness on mid-edit files where the grammar may fail.
      var lineContext = this.getLineContext_(lines, position.line);
      var ctx = this.detectContext_(text, position);
      if ( (ctx.columnName ||
            /tableColumns\s*:\s*\[/.test(lineContext) ||
            /searchColumns\s*:\s*\[/.test(lineContext)) &&
           /['"][^'"]*$/.test(prefix) ) {
        var partial = this.extractPartial_(prefix).toLowerCase();
        var model = this.cache.getModelAt(opt_uri || '', text, position.line);
        if ( model ) {
          var classId = this.cache.getClassId(model);
          var props = this.index.getProperties(classId);
          var items = [];

          // Also add own model properties not yet in registry
          var propNames = {};
          for ( var pi = 0 ; pi < props.length ; pi++ ) propNames[props[pi].name] = props[pi];
          (model.properties || []).forEach(function(p) {
            var name = typeof p === 'string' ? p : p.name;
            if ( name && ! propNames[name] ) propNames[name] = { name: name, cls_: null };
          });

          for ( var name in propNames ) {
            if ( ! propNames.hasOwnProperty(name) ) continue;
            if ( partial && name.toLowerCase().indexOf(partial) === -1 ) continue;
            var p = propNames[name];
            var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
            items.push({
              label: name, kind: 10,
              detail: typeName + ' Property',
              textEdit: { range: replaceRange, newText: name },
              sortText: '!' + name.toLowerCase()
            });
          }
          return items;
        }
      }

      // Inside exports: ['...' → axiom names from the current model.
      // Grammar-driven via the exportName context marker. Must run before the
      // class-ref branch below — otherwise the 10-line `requires: [` lookback
      // hijacks the cursor and proposes class ids (the bogus suggestions
      // reported in issue #4999).
      if ( ctx.exportName && /['"][^'"]*$/.test(prefix) ) {
        return this.getExportNameItems_(text, position, opt_uri, replaceRange, prefix);
      }

      // Inside extends: '...' / requires: [...] / implements: [...] / of: '...' →
      // detect context via grammar (sentinel-based), fall back to regex checks.
      // Suggestions come from the index, not sug() — class IDs are too numerous
      // and the grammar's fallback classRef rule silently matches partials,
      // suppressing sug() collection.
      var inClassRefContext =
        ctx.classRef ||
        /(?:extends|of|view)\s*:\s*['"][^'"]*$/.test(prefix) ||
        (/requires\s*:\s*\[/.test(lineContext) && /['"][^'"]*$/.test(prefix)) ||
        (/implements\s*:\s*\[/.test(lineContext) && /['"][^'"]*$/.test(prefix));
      if ( inClassRefContext ) {
        var partial = this.extractPartial_(prefix).toLowerCase();
        var ids = this.index.getAllClassIds();
        var items = [];
        for ( var i = 0 ; i < ids.length ; i++ ) {
          if ( partial && ids[i].toLowerCase().indexOf(partial) === -1 ) continue;
          items.push({
            label: ids[i], kind: 7,
            textEdit: { range: replaceRange, newText: ids[i] },
            filterText: ids[i],
            sortText: '!' + ids[i].toLowerCase()
          });
          if ( items.length > 200 ) break;
        }
        return items;
      }

      // Inside javaImports: ['...' → Java packages (dynamic from registry)
      if ( /javaImports\s*:\s*\[/.test(lineContext) && /['"][^'"]*$/.test(prefix) ) {
        return this.getJavaImportSuggestions_(replaceRange, this.extractPartial_(prefix));
      }

      // Inside a property object { ... } within properties: [...] → suggest property keys
      if ( this.isInsidePropertyObject_(text, position) ) {
        var partial = prefix.trim().toLowerCase();
        var propKeys = [
          'class', 'name', 'of', 'documentation', 'hidden', 'transient',
          'value', 'factory', 'expression', 'javaCode', 'javaGetter',
          'javaPostSet', 'javaPreSet', 'javaFactory', 'javaSetter',
          'aliases', 'label', 'section', 'visibility', 'view',
          'adapt', 'preSet', 'postSet', 'required', 'width',
          'placeholder', 'help', 'gridColumns', 'tableCellFormatter',
          'labelFormatter', 'shortName', 'readPermissionRequired',
          'writePermissionRequired', 'validateObj', 'tableWidth',
          'storageTransient', 'networkTransient', 'readOnly',
          'permissionRequired', 'cloneProperty', 'javaInfoType'
        ];
        var items = [];
        for ( var i = 0 ; i < propKeys.length ; i++ ) {
          var k = propKeys[i];
          if ( partial && k.toLowerCase().indexOf(partial) === -1 ) continue;
          items.push({
            label: k + ': ',
            kind: 14,
            insertText: k + ': ',
            sortText: '!' + k.toLowerCase()
          });
        }
        return items;
      }

      return [];
    },

    function detectContext_(text, position) {
      /**
       * Grammar-driven context probe. Returns an object describing which
       * rule(s) the cursor is inside, determined by inspecting the
       * sug()-categories collected via CursorSentinel + collectSuggestionsAt.
       *
       * Returned flags (each boolean):
       *   - classRef:    cursor inside extends/requires/of/implements value
       *   - propertyType: cursor inside a `class: 'X'` value (property type)
       *   - topKey:      cursor at a top-level class-body key position
       *   - propKey:     cursor at a key position inside properties: [{ ... }]
       *   - pomKey:      cursor at a POM-body key position
       *
       * Handles empty values deterministically. Partial values are subject
       * to the grammar's permissive classRef fallback — callers should
       * combine with regex checks where needed (Phase 1 compromise; Phase 6
       * removes the permissive fallback and makes this authoritative).
       */
      var sentinel = this.CursorSentinel.create();
      var ins = sentinel.insertAt(text, position);
      var suggestions = this.grammar.collectSuggestionsAt(ins.text, ins.offset);

      var ctx = {
        classRef: false, propertyType: false, columnName: false,
        exportName: false,
        topKey: false, propKey: false, pomKey: false,
        pomFileName: false, pomJavaFileName: false, pomProjectPath: false,
        pomFlagValue: false, pomJavaDep: false
      };
      for ( var i = 0 ; i < suggestions.length ; i++ ) {
        var c = suggestions[i].category;
        if ( c === 'class' ) ctx.classRef = true;
        else if ( c === 'property' ) ctx.propertyType = true;
        else if ( c === 'columnName' ) ctx.columnName = true;
        else if ( c === 'exportName' ) ctx.exportName = true;
        else if ( c === 'topKey' ) ctx.topKey = true;
        else if ( c === 'propKey' ) ctx.propKey = true;
        else if ( c === 'pomKey' ) ctx.pomKey = true;
        else if ( c === 'pomFileName' ) ctx.pomFileName = true;
        else if ( c === 'pomJavaFileName' ) ctx.pomJavaFileName = true;
        else if ( c === 'pomProjectPath' ) ctx.pomProjectPath = true;
        else if ( c === 'pomFlagValue' ) ctx.pomFlagValue = true;
        else if ( c === 'pomJavaDep' ) ctx.pomJavaDep = true;
      }
      return ctx;
    },

    function isInsidePropertyObject_(text, position) {
      /**
       * Grammar-driven detection: cursor is inside a property object when
       * the grammar offers property-object keys (class, name, of, value, …)
       * at the cursor position. Replaces the brace-depth + regex walk.
       */
      return this.detectContext_(text, position).propKey;
    },

    function pomContextCompletion_(text, position, lines, prefix, replaceRange) {
      /**
       * Grammar-driven POM completions. detectContext_ tells us which POM
       * position the cursor is in (file name, Java file name, project path,
       * flag value, Java dep). The helpers below produce the actual items.
       *
       * Regex fallbacks remain only where the grammar may fail (mid-edit
       * files); once Phase 6 lands proper recovery, those go away.
       */
      var partial = this.extractPartial_(prefix);
      var ctx = this.detectContext_(text, position);
      var lineContext = this.getLineContext_(lines, position.line);

      if ( ctx.pomFlagValue || /flags\s*:\s*['"][^'"]*$/.test(prefix) ) {
        return this.pomFlagItems_(partial, replaceRange);
      }

      if ( ctx.pomFileName ||
           (/name\s*:\s*['"][^'"]*$/.test(prefix) && /files\s*:\s*\[/.test(lineContext)
            && ! /javaFiles\s*:\s*\[/.test(lineContext)) ) {
        return this.pomFileNameSuggestions_(text, partial, replaceRange, false);
      }

      if ( ctx.pomJavaFileName ||
           (/name\s*:\s*['"][^'"]*$/.test(prefix) && /javaFiles\s*:\s*\[/.test(lineContext)) ) {
        return this.pomFileNameSuggestions_(text, partial, replaceRange, true);
      }

      if ( ctx.pomProjectPath ||
           (/name\s*:\s*['"][^'"]*$/.test(prefix) && /projects\s*:\s*\[/.test(lineContext)) ) {
        return this.pomProjectSuggestions_(text, partial, replaceRange);
      }

      if ( ctx.pomJavaDep || /javaDependencies\s*:\s*\[/.test(lineContext) ) {
        return this.pomJavaDependencySuggestions_(partial, replaceRange);
      }

      return null;
    },

    function pomFlagItems_(partial, replaceRange) {
      /** Build completion items for POM flag values. */
      var flagValues = [
        'js', 'java', 'web', 'test',
        'js|java', 'js&test|java&test', 'js&test', 'java&test'
      ];
      var lower = partial.toLowerCase();
      var items = [];
      for ( var i = 0 ; i < flagValues.length ; i++ ) {
        if ( lower && flagValues[i].toLowerCase().indexOf(lower) === -1 ) continue;
        items.push({
          label: flagValues[i], kind: 21,
          textEdit: { range: replaceRange, newText: flagValues[i] },
          sortText: '!' + flagValues[i]
        });
      }
      return items;
    },

    function pomFileNameSuggestions_(text, partial, replaceRange, isJava) {
      /**
       * Suggest file names from the POM file's directory.
       * For files: [...] suggests .js files, for javaFiles: [...] suggests .java files.
       */
      var fs_, path_;
      try { fs_ = require('fs'); path_ = require('path'); } catch ( e ) { return []; }

      // Find the POM file's directory from the file index or cwd
      var pomDir = this.findPomDir_(text, path_);
      if ( ! pomDir || ! fs_.existsSync(pomDir) ) return [];

      var ext = isJava ? '.java' : '.js';
      var items = [];
      var lower = partial.toLowerCase();

      // Collect existing file names from POM to exclude
      var existing = {};
      var nameRegex = /name\s*:\s*['"]([^'"]+)['"]/g;
      var nm;
      while ( ( nm = nameRegex.exec(text) ) !== null ) existing[nm[1]] = true;

      this.scanDirForFiles_(pomDir, pomDir, ext, items, existing, lower, replaceRange, fs_, path_);
      return items;
    },

    function scanDirForFiles_(baseDir, dir, ext, items, existing, lower, replaceRange, fs_, path_) {
      /** Recursively scan directory for files with the given extension. */
      try {
        var entries = fs_.readdirSync(dir);
        for ( var i = 0 ; i < entries.length ; i++ ) {
          var entry = entries[i];
          var fullPath = path_.join(dir, entry);
          var stat = fs_.statSync(fullPath);

          if ( stat.isDirectory() && entry !== 'node_modules' && entry !== 'build' && entry !== '.git' ) {
            this.scanDirForFiles_(baseDir, fullPath, ext, items, existing, lower, replaceRange, fs_, path_);
          } else if ( entry.endsWith(ext) ) {
            var relative = path_.relative(baseDir, fullPath);
            // Remove extension for the POM name
            var name = relative.replace(/\\/g, '/').replace(new RegExp(ext.replace('.', '\\.') + '$'), '');
            if ( existing[name] ) continue;
            if ( lower && name.toLowerCase().indexOf(lower) === -1 ) continue;
            items.push({
              label: name, kind: 17,
              textEdit: { range: replaceRange, newText: name },
              sortText: '!' + name.toLowerCase()
            });
          }
          if ( items.length > 200 ) return;
        }
      } catch ( e ) {}
    },

    function pomProjectSuggestions_(text, partial, replaceRange) {
      /** Suggest subdirectory pom.js paths for projects: [...]. */
      var fs_, path_;
      try { fs_ = require('fs'); path_ = require('path'); } catch ( e ) { return []; }

      var pomDir = this.findPomDir_(text, path_);
      if ( ! pomDir || ! fs_.existsSync(pomDir) ) return [];

      var items = [];
      var lower = partial.toLowerCase();

      // Scan subdirectories for pom.js files
      try {
        var entries = fs_.readdirSync(pomDir);
        for ( var i = 0 ; i < entries.length ; i++ ) {
          var subDir = path_.join(pomDir, entries[i]);
          if ( ! fs_.statSync(subDir).isDirectory() ) continue;
          var pomPath = path_.join(subDir, 'pom.js');
          if ( fs_.existsSync(pomPath) ) {
            var name = entries[i] + '/pom';
            if ( lower && name.toLowerCase().indexOf(lower) === -1 ) continue;
            items.push({
              label: name, kind: 17,
              textEdit: { range: replaceRange, newText: name },
              sortText: '!' + name.toLowerCase()
            });
          }
        }
      } catch ( e ) {}
      return items;
    },

    function pomJavaDependencySuggestions_(partial, replaceRange) {
      /** Suggest Java dependencies from existing pom.js files in the project. */
      var items = [];
      var lower = partial.toLowerCase();
      var seen = {};

      // Scan all loaded POMs for javaDependencies
      var poms = foam.poms || [];
      for ( var p = 0 ; p < poms.length ; p++ ) {
        var deps = poms[p].javaDependencies || [];
        for ( var d = 0 ; d < deps.length ; d++ ) {
          var dep = deps[d];
          if ( seen[dep] || ( lower && dep.toLowerCase().indexOf(lower) === -1 ) ) continue;
          seen[dep] = true;
          items.push({
            label: dep, kind: 17,
            textEdit: { range: replaceRange, newText: dep },
            sortText: '!' + dep.toLowerCase()
          });
        }
      }
      return items;
    },

    function findPomDir_(text, path_) {
      /** Find the directory of the POM file being edited. */
      var fs_ = require('fs');

      // Try to find the POM's location from loaded poms
      var nameMatch = text.match(/name\s*:\s*['"]([^'"]+)['"]/);
      if ( nameMatch ) {
        var pomName = nameMatch[1];
        var poms = foam.poms || [];
        for ( var i = 0 ; i < poms.length ; i++ ) {
          if ( poms[i].name === pomName && poms[i].location ) {
            return poms[i].location;
          }
        }
      }

      // Fallback: use cwd
      return process.cwd();
    },

    function cssBlockCompletion_(text, position, opt_uri) {
      /**
       * CSS completion using shared CursorAnalyzer methods.
       * Handles: property names, property values, $token references.
       * All items include textEdit.range for mid-word replacement.
       */
      var blockCtx = this.analyzer.getBacktickBlockContext(text, position);
      if ( ! blockCtx || blockCtx.blockKey !== 'css' ) return null;

      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var cssCtx = this.analyzer.getCSSContext(line, position.character);
      if ( ! cssCtx ) return null;

      var replaceRange = {
        start: { line: position.line, character: cssCtx.replaceRange.start },
        end:   { line: position.line, character: cssCtx.replaceRange.end }
      };

      if ( cssCtx.type === 'propertyName' ) {
        return this.cssPropNameItems_(cssCtx.partial, replaceRange);
      }

      if ( cssCtx.type === 'propertyValue' ) {
        return this.cssPropValueItems_(cssCtx.propName, cssCtx.partial, replaceRange);
      }

      return null;
    },

    function cssPropNameItems_(partial, replaceRange) {
      /** Build completion items for CSS property names. */
      var lower = partial.toLowerCase();
      var props = this.CSS_PROPERTIES;
      var items = [];
      for ( var i = 0 ; i < props.length ; i++ ) {
        if ( lower && props[i].indexOf(lower) === -1 ) continue;
        items.push({
          label: props[i],
          kind: 10,
          detail: 'CSS property',
          textEdit: { range: replaceRange, newText: props[i] + ': ' },
          filterText: props[i],
          sortText: '!' + props[i]
        });
      }
      return items;
    },

    function cssPropValueItems_(propName, partial, replaceRange) {
      /** Build completion items for CSS property values + $tokens. */
      var lower = partial.toLowerCase();
      var isDollar = partial.charAt(0) === '$';
      var items = [];

      // $token suggestions
      if ( isDollar && this.cssTokenResolver ) {
        var tokenPartial = partial.substring(1).toLowerCase();
        var allNames = this.cssTokenResolver.getAllTokenNames();
        for ( var i = 0 ; i < allNames.length ; i++ ) {
          var name = allNames[i];
          if ( tokenPartial && name.toLowerCase().indexOf(tokenPartial) === -1 ) continue;
          var info = this.cssTokenResolver.getTokenInfo(name);
          var resolved = this.cssTokenResolver.getResolvedValue(name);
          var isColor = info && info.type === 'ColorToken';
          items.push({
            label: '$' + name,
            kind: isColor ? 16 : 6,
            detail: resolved || '',
            textEdit: { range: replaceRange, newText: '$' + name },
            filterText: '$' + name,
            sortText: '!' + name.toLowerCase()
          });
        }
        return items;
      }

      // CSS keyword values for the property
      if ( propName ) {
        var values = this.getCSSPropertyValues_(propName.toLowerCase());
        for ( var i = 0 ; i < values.length ; i++ ) {
          if ( lower && values[i].toLowerCase().indexOf(lower) === -1 ) continue;
          items.push({
            label: values[i],
            kind: 12,
            detail: propName,
            textEdit: { range: replaceRange, newText: values[i] },
            filterText: values[i],
            sortText: '!' + values[i]
          });
        }
      }

      // Also offer $token suggestions for color-related properties
      if ( this.cssTokenResolver && propName && /color|background|border|fill|stroke|outline|shadow/.test(propName.toLowerCase()) ) {
        var allNames = this.cssTokenResolver.getAllTokenNames();
        for ( var i = 0 ; i < allNames.length ; i++ ) {
          var info = this.cssTokenResolver.getTokenInfo(allNames[i]);
          if ( ! info || info.type !== 'ColorToken' ) continue;
          if ( lower && allNames[i].toLowerCase().indexOf(lower) === -1 ) continue;
          var resolved = this.cssTokenResolver.getResolvedValue(allNames[i]);
          items.push({
            label: '$' + allNames[i],
            kind: 16,
            detail: resolved || '',
            textEdit: { range: replaceRange, newText: '$' + allNames[i] },
            filterText: '$' + allNames[i],
            sortText: '~' + allNames[i]
          });
        }
      }

      return items;
    },

    function getCSSPropertyValues_(propertyName) {
      /** Returns common CSS values for a given property name. */
      var common = ['inherit', 'initial', 'unset', 'revert'];
      var valueMap = {
        'display':         ['none', 'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'contents', 'table', 'table-row', 'table-cell'],
        'position':        ['static', 'relative', 'absolute', 'fixed', 'sticky'],
        'flex-direction':  ['row', 'row-reverse', 'column', 'column-reverse'],
        'flex-wrap':       ['nowrap', 'wrap', 'wrap-reverse'],
        'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end', 'stretch'],
        'align-items':     ['flex-start', 'flex-end', 'center', 'baseline', 'stretch', 'start', 'end'],
        'align-content':   ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'stretch', 'start', 'end'],
        'align-self':      ['auto', 'flex-start', 'flex-end', 'center', 'baseline', 'stretch'],
        'overflow':        ['visible', 'hidden', 'scroll', 'auto', 'clip'],
        'overflow-x':      ['visible', 'hidden', 'scroll', 'auto', 'clip'],
        'overflow-y':      ['visible', 'hidden', 'scroll', 'auto', 'clip'],
        'visibility':      ['visible', 'hidden', 'collapse'],
        'white-space':     ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'],
        'text-align':      ['left', 'right', 'center', 'justify', 'start', 'end'],
        'text-decoration': ['none', 'underline', 'overline', 'line-through'],
        'text-transform':  ['none', 'capitalize', 'uppercase', 'lowercase'],
        'text-overflow':   ['clip', 'ellipsis'],
        'font-weight':     ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
        'font-style':      ['normal', 'italic', 'oblique'],
        'cursor':          ['auto', 'default', 'pointer', 'move', 'text', 'wait', 'help', 'crosshair', 'not-allowed', 'grab', 'grabbing', 'col-resize', 'row-resize', 'n-resize', 's-resize', 'e-resize', 'w-resize', 'zoom-in', 'zoom-out'],
        'resize':          ['none', 'both', 'horizontal', 'vertical', 'block', 'inline'],
        'pointer-events':  ['auto', 'none'],
        'user-select':     ['auto', 'text', 'none', 'contain', 'all'],
        'float':           ['none', 'left', 'right', 'inline-start', 'inline-end'],
        'clear':           ['none', 'left', 'right', 'both', 'inline-start', 'inline-end'],
        'box-sizing':      ['content-box', 'border-box'],
        'border-style':    ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'],
        'border-collapse': ['collapse', 'separate'],
        'list-style-type': ['none', 'disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'],
        'background-size': ['auto', 'cover', 'contain'],
        'background-repeat': ['repeat', 'repeat-x', 'repeat-y', 'no-repeat', 'space', 'round'],
        'background-position': ['top', 'bottom', 'left', 'right', 'center'],
        'background-attachment': ['scroll', 'fixed', 'local'],
        'object-fit':      ['fill', 'contain', 'cover', 'none', 'scale-down'],
        'word-break':      ['normal', 'break-all', 'keep-all', 'break-word'],
        'word-wrap':       ['normal', 'break-word', 'anywhere'],
        'transition':      ['none', 'all'],
        'outline':         ['none'],
        'outline-style':   ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'],
        'opacity':         ['0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1'],
        'z-index':         ['auto', '0', '1', '10', '100', '1000'],
        'flex':            ['none', '0', '1', 'auto'],
        'flex-grow':       ['0', '1'],
        'flex-shrink':     ['0', '1'],
        'flex-basis':      ['auto', '0', 'content'],
        'gap':             [],
        'row-gap':         [],
        'column-gap':      [],
        'order':           ['0', '1', '2', '-1'],
        'grid-template-columns': ['none', 'auto', 'min-content', 'max-content'],
        'grid-template-rows':    ['none', 'auto', 'min-content', 'max-content'],
        'place-items':     ['center', 'start', 'end', 'stretch'],
        'place-content':   ['center', 'start', 'end', 'stretch', 'space-between', 'space-around', 'space-evenly'],
        'animation-fill-mode': ['none', 'forwards', 'backwards', 'both'],
        'animation-direction': ['normal', 'reverse', 'alternate', 'alternate-reverse'],
        'animation-play-state': ['running', 'paused'],
        'content':         ['none', 'normal', '""', "''"],
        'table-layout':    ['auto', 'fixed'],
        'vertical-align':  ['baseline', 'sub', 'super', 'top', 'text-top', 'middle', 'bottom', 'text-bottom'],
        'direction':       ['ltr', 'rtl'],
        'writing-mode':    ['horizontal-tb', 'vertical-rl', 'vertical-lr'],
        'overflow-wrap':   ['normal', 'break-word', 'anywhere']
      };
      var values = valueMap[propertyName] || [];
      // For unknown properties, still return common values so completion is useful
      return values.length > 0 ? values.concat(common) : common;
    },

    function javaBlockCompletion_(text, position, lines, prefix, opt_uri) {
      /**
       * Suggest getter/setter methods when cursor is inside a Java code block.
       * Uses shared getBacktickBlockContext for block detection.
       */
      var blockCtx = this.analyzer.getBacktickBlockContext(text, position);
      if ( ! blockCtx || blockCtx.blockKey === 'css' ) return null;
      // blockCtx.blockKey is one of: javaCode, javaPreSet, javaPostSet, javaFactory, javaGetter

      // User is typing inside a Java code block
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);

      var targetClassId = null;
      var getSet, partial;

      // Empty line or just whitespace inside Java block — suggest all getters and setters
      var trimmedPrefix = prefix.trim();
      if ( trimmedPrefix === '' ) {
        if ( model ) {
          getSet = 'both';
          partial = '';
          targetClassId = this.cache.getClassId(model);
        }
      }

      // Check for get/set/is prefix — either bare (getCreatedBy, getcre) or on a variable (user.get)
      // Also trigger on variable. (dot with no prefix yet) or variable.g/ge partial
      var varGetSet = prefix.match(/(\w+)\.(get|set|is)(\w*)$/);
      var varDot = ! varGetSet ? prefix.match(/(\w+)\.(\w*)$/) : null;
      var bareGetSet = prefix.match(/(?:^|[\s(=!&|,])(?:return\s+)?(get|set|is)(\w*)$/);

      if ( ! targetClassId && ! varGetSet && ! varDot && ! bareGetSet ) return null;

      if ( varGetSet ) {
        // variable.getX — resolve the variable's type from Java declarations
        var javaVarName = varGetSet[1];
        getSet = varGetSet[2];
        partial = varGetSet[3] ? varGetSet[3].toLowerCase() : '';
        targetClassId = this.analyzer.resolveJavaVariableType(text, position, javaVarName, model, this.index);
      } else if ( varDot ) {
        // variable. or variable.g or variable.ge — resolve type, show all getters+setters
        var javaVarName = varDot[1];
        var dotPartial = varDot[2] ? varDot[2].toLowerCase() : '';
        targetClassId = this.analyzer.resolveJavaVariableType(text, position, javaVarName, model, this.index);
        if ( targetClassId ) {
          // Show both getters and setters, filtered by the partial after the dot
          getSet = 'both';
          partial = dotPartial;
        }
      }

      if ( ! targetClassId && bareGetSet ) {
        // Bare getX/setX — use the current model's class
        getSet = bareGetSet[1];
        partial = bareGetSet[2] ? bareGetSet[2].toLowerCase() : '';
        if ( model ) {
          targetClassId = this.cache.getClassId(model);
        }
      }

      if ( ! targetClassId ) return null;

      // Collect properties with Java types
      var items = [];
      var props = this.index.getProperties(targetClassId);

      // Also add own model properties not yet in registry
      if ( model ) {
        var ownNames = {};
        for ( var i = 0 ; i < props.length ; i++ ) ownNames[props[i].name] = true;
        (model.properties || []).forEach(function(p) {
          var name = typeof p === 'string' ? p : p.name;
          if ( name && ! ownNames[name] ) {
            props.push({ name: name, cls_: null });
          }
        });
      }

      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var propName = p.name;
        var capName = propName.charAt(0).toUpperCase() + propName.substring(1);
        var javaType = this.index.getPropertyJavaType(targetClassId, propName) || 'Object';
        var getLabel = 'get' + capName + '()';
        var setLabel = 'set' + capName + '(' + javaType + ')';

        // Filter: for 'both' mode (variable.partial), match against full label
        if ( partial ) {
          var getMatches = getLabel.toLowerCase().indexOf(partial) !== -1;
          var setMatches = setLabel.toLowerCase().indexOf(partial) !== -1;
          if ( ! getMatches && ! setMatches ) continue;
        }

        if ( getSet === 'get' || getSet === 'is' || getSet === 'both' ) {
          if ( ! partial || getLabel.toLowerCase().indexOf(partial) !== -1 ) {
            items.push({
              label: getLabel,
              kind: 2,
              detail: javaType + ' — ' + propName,
              documentation: javaType + ' get' + capName + '()',
              insertText: 'get' + capName + '()',
              sortText: '!' + propName
            });
          }
        }
        if ( getSet === 'set' || getSet === 'both' ) {
          if ( ! partial || setLabel.toLowerCase().indexOf(partial) !== -1 ) {
            items.push({
              label: setLabel,
              kind: 2,
              detail: 'void — ' + propName,
              documentation: 'void set' + capName + '(' + javaType + ' val)',
              insertText: 'set' + capName + '(',
              sortText: '!' + propName
            });
          }
        }
      }
      return items;
    },

    function getExportNameItems_(text, position, opt_uri, replaceRange, prefix) {
      /**
       * Build completion items for an `exports:` array value. Suggests axiom
       * names declared on the model being edited — properties, methods,
       * actions, listeners — plus any already-registered inherited ones.
       * Strings like 'name as alias' are valid exports; we only complete the
       * leading axiom name, so we filter by the substring before any ' as '.
       */
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      var partial = this.extractPartial_(prefix);
      var asIdx = partial.indexOf(' as ');
      if ( asIdx !== -1 ) partial = partial.substring(0, asIdx);
      var lower = partial.toLowerCase();

      var names = {};

      // Inherited axioms from the registry (if the class is already built).
      var classId = model ? this.cache.getClassId(model) : null;
      if ( classId ) {
        var props = this.index.getProperties(classId) || [];
        for ( var i = 0 ; i < props.length ; i++ )
          names[props[i].name] = { name: props[i].name, detail: 'Property' };

        var methods = this.index.getMethods(classId) || [];
        for ( var i = 0 ; i < methods.length ; i++ )
          names[methods[i].name] = { name: methods[i].name, detail: 'Method' };

        var actions = this.index.getActions(classId) || [];
        for ( var i = 0 ; i < actions.length ; i++ )
          names[actions[i].name] = { name: actions[i].name, detail: 'Action' };
      }

      // Own axioms from the live model text — covers names the user is
      // declaring right now that aren't in the registry yet.
      if ( model ) {
        var own = [
          { field: 'properties', label: 'Property' },
          { field: 'methods',    label: 'Method'   },
          { field: 'actions',    label: 'Action'   },
          { field: 'listeners',  label: 'Listener' }
        ];
        for ( var i = 0 ; i < own.length ; i++ ) {
          var arr = model[own[i].field] || [];
          for ( var j = 0 ; j < arr.length ; j++ ) {
            var a = arr[j];
            var name = typeof a === 'string' ? a : a.name;
            if ( name && ! names[name] ) names[name] = { name: name, detail: own[i].label };
          }
        }
      }

      var items = [];
      for ( var n in names ) {
        if ( ! names.hasOwnProperty(n) ) continue;
        if ( lower && n.toLowerCase().indexOf(lower) === -1 ) continue;
        items.push({
          label: n,
          kind: 10,
          detail: names[n].detail,
          textEdit: { range: replaceRange, newText: n },
          filterText: n,
          sortText: '!' + n.toLowerCase()
        });
      }
      return items;
    },

    function getLineContext_(lines, lineNum) {
      var ctx = '';
      for ( var i = Math.max(0, lineNum - 10) ; i <= lineNum ; i++ ) {
        ctx += (lines[i] || '') + '\n';
      }
      return ctx;
    },

    function extractPartial_(prefix) {
      var match = prefix.match(/['"]([^'"]*?)$/);
      return match ? match[1] : '';
    },

    function getJavaImportSuggestions_(replaceRange, partial) {
      /**
       * Build Java import suggestions dynamically from the FOAM registry.
       * Extract unique package prefixes from all class IDs that look like
       * Java-compatible packages (foam.*, com.*, java.*, etc.)
       */
      var ids = this.index.getAllClassIds();
      var packages = {};
      var lower = partial.toLowerCase();

      for ( var i = 0 ; i < ids.length ; i++ ) {
        var id = ids[i];
        var lastDot = id.lastIndexOf('.');
        if ( lastDot <= 0 ) continue;
        var pkg = id.substring(0, lastDot);

        // Skip if doesn't match partial
        if ( lower && id.toLowerCase().indexOf(lower) === -1 &&
             pkg.toLowerCase().indexOf(lower) === -1 ) continue;

        // Add both the full class import and the package prefix
        if ( ! packages[id] ) {
          packages[id] = true;
        }
      }

      var items = [];
      var keys = Object.keys(packages);
      for ( var i = 0 ; i < keys.length ; i++ ) {
        if ( items.length > 200 ) break;
        items.push({
          label: keys[i],
          kind: 7,
          textEdit: { range: replaceRange, newText: keys[i] },
          filterText: keys[i],
          sortText: keys[i].toLowerCase()
        });
      }
      return items;
    },

    function findQuoteStart_(prefix) {
      /** Find the character position right after the opening quote. */
      for ( var i = prefix.length - 1 ; i >= 0 ; i-- ) {
        if ( prefix[i] === "'" || prefix[i] === '"' ) return i + 1;
      }
      return prefix.length;
    },

    function collectSuggestions(text, cursorOffset) {
      /**
       * SmartView pattern: track maxPos and collect suggestions from parsers
       * tried near the cursor.
       *
       * Cursor-window: the strict ±2 char window misses suggestions when the
       * cursor sits inside whitespace (the parser's `wsc` eats the whitespace
       * before any sug fires, so sugs end up at the next non-whitespace char).
       * We accept a sug whose start position is within ±2 OR is within ±2 of
       * the cursor with only whitespace between — "cursor-effective" window.
       */
      var suggestions = {};
      var maxPos = 0;

      // Precompute: for each offset, the nearest non-whitespace positions on
      // either side of the cursor, so we can accept sugs that fire after wsc.
      var leftEdge  = cursorOffset;
      while ( leftEdge > 0 && /\s/.test(text.charAt(leftEdge - 1)) ) leftEdge--;
      var rightEdge = cursorOffset;
      while ( rightEdge < text.length && /\s/.test(text.charAt(rightEdge)) ) rightEdge++;

      function nearCursor(pos) {
        // Exact window around the cursor (original ±2).
        if ( pos >= cursorOffset - 2 && pos <= cursorOffset + 2 ) return true;
        // Whitespace-aware window: accept sugs fired inside the whitespace
        // gap and at the first non-whitespace char on either side.
        if ( pos >= leftEdge && pos <= rightEdge ) return true;
        return false;
      }

      var apply = function(p, grammar) {
        var result = p.parse(this, grammar);

        if ( result && p.suggest ) {
          var s = p.suggest();
          if ( s ) {
            var startPos = this.pos;
            if ( nearCursor(startPos) ) {
              suggestions[s.text || s.label] = s;
            }
          }
        }

        if ( this.pos > maxPos ) maxPos = this.pos;
        if ( ! result && p.suggest && this.pos === maxPos && nearCursor(this.pos) ) {
          var s = p.suggest();
          if ( s ) suggestions[s.text || s.label] = s;
        }

        return result;
      };

      var str = text + String.fromCharCode(26);
      var ps = this.StringPStream.create({ str: str, apply: apply });

      try {
        this.grammar.parse(ps);
      } catch (e) {}

      return suggestions;
    },

    function toCompletionItem(suggestion) {
      return this.CompletionItem.create({
        label: suggestion.text || suggestion.label,
        kind: this.categoryToKind(suggestion.category),
        detail: suggestion.hint || '',
        documentation: suggestion.tooltip || '',
        insertText: suggestion.text
      });
    },

    function toLSPItems_(items) {
      /**
       * Normalize an items array to LSP protocol shape. Model instances
       * (CompletionItem) are flattened via toLSP(); raw objects pass through.
       * Lets handlers mix typed and raw items during the migration.
       */
      if ( ! items ) return items;
      var out = new Array(items.length);
      for ( var i = 0 ; i < items.length ; i++ ) {
        var it = items[i];
        out[i] = ( it && typeof it.toLSP === 'function' ) ? it.toLSP() : it;
      }
      return out;
    },

    function categoryToKind(category) {
      switch ( category ) {
        case 'class':    return 7;
        case 'property': return 10;
        case 'method':   return 2;
        case 'key':
        case 'topKey':
        case 'propKey':
        case 'pomKey':   return 14;
        case 'enum':     return 13;
        case 'operator': return 24;
        default:         return 1;
      }
    }
  ]
});
