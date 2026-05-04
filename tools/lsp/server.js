/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// FOAM LSP Server — JSON-RPC over stdio.
// Started by LSPMaker.end() after all FOAM models are loaded.

function start() {
  // Redirect console.log to stderr — stdout is JSON-RPC channel
  var origLog = console.log;
  console.log = function() { console.error.apply(console, arguments); };

  var index = globalThis.__foamLSPIndex__ || foam.parse.lsp.FoamIndex.create();
  if ( ! globalThis.__foamLSPIndex__ ) index.buildFileIndex();
  var grammar = foam.parse.lsp.FoamClassGrammar.create({ index: index });
  var fileModelCache = foam.parse.lsp.FileModelCache.create();
  var typeTracker = foam.parse.lsp.TypeTracker.create({ cache: fileModelCache });

  var cssTokenResolver = foam.parse.lsp.CSSTokenResolver.create();
  cssTokenResolver.loadFromRegistry();
  cssTokenResolver.loadFromJournals();
  console.error('[LSP] ' + cssTokenResolver.getAllTokenNames().length + ' CSS tokens loaded.');

  var completionHandler  = foam.parse.lsp.handlers.CompletionHandler.create({ index: index, grammar: grammar, cache: fileModelCache, cssTokenResolver: cssTokenResolver });
  var hoverHandler       = foam.parse.lsp.handlers.HoverHandler.create({ index: index, cache: fileModelCache, typeTracker: typeTracker, cssTokenResolver: cssTokenResolver });
  var definitionHandler  = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index });
  var diagnosticsHandler = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index, cache: fileModelCache, cssTokenResolver: cssTokenResolver });
  var symbolHandler      = foam.parse.lsp.handlers.SymbolHandler.create({ cache: fileModelCache });
  var memberHandler      = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index, cache: fileModelCache, typeTracker: typeTracker });

  var semanticTokenHandler = foam.parse.lsp.handlers.SemanticTokenHandler.create({ index: index, cache: fileModelCache, typeTracker: typeTracker, cssTokenResolver: cssTokenResolver });
  var referencesHandler = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });
  var documentHighlightHandler = foam.parse.lsp.handlers.DocumentHighlightHandler.create();
  var renameHandler = foam.parse.lsp.handlers.RenameHandler.create({ index: index });
  var jrlHandler = foam.parse.lsp.handlers.JrlHandler.create({ index: index });
  jrlHandler.buildJournalClassMap();
  var workspaceAnalyzer = foam.parse.lsp.handlers.WorkspaceAnalyzer.create({ index: index });

  var documents = {};
  var rawBuffer = Buffer.alloc(0);

  // === JSON-RPC over stdio ===
  // Use raw Buffer (not string) because Content-Length is in bytes,
  // and multi-byte UTF-8 characters cause string.length !== byte length.

  process.stdin.on('data', function(chunk) {
    rawBuffer = Buffer.concat([rawBuffer, chunk]);
    processBuffer();
  });

  function processBuffer() {
    while ( true ) {
      var headerEnd = rawBuffer.indexOf('\r\n\r\n');
      if ( headerEnd === -1 ) return;

      var header = rawBuffer.slice(0, headerEnd).toString('utf8');
      var match = header.match(/Content-Length:\s*(\d+)/i);
      if ( ! match ) { rawBuffer = rawBuffer.slice(headerEnd + 4); continue; }

      var contentLength = parseInt(match[1]);
      var bodyStart = headerEnd + 4;

      if ( rawBuffer.length < bodyStart + contentLength ) return;

      var body = rawBuffer.slice(bodyStart, bodyStart + contentLength).toString('utf8');
      rawBuffer = rawBuffer.slice(bodyStart + contentLength);

      try {
        handleMessage(JSON.parse(body));
      } catch (e) {
        console.error('FOAM LSP parse error:', e);
      }
    }
  }

  function send(msg) {
    var json = JSON.stringify(msg);
    var out = 'Content-Length: ' + Buffer.byteLength(json) + '\r\n\r\n' + json;
    process.stdout.write(out);
  }

  function respond(id, result) {
    send({ jsonrpc: '2.0', id: id, result: result });
  }

  function respondError(id, code, message) {
    send({ jsonrpc: '2.0', id: id, error: { code: code, message: message } });
  }

  function notify(method, params) {
    send({ jsonrpc: '2.0', method: method, params: params });
  }

  function isFoamFile(text) {
    return foam.parse.lsp.CursorAnalyzer.FOAM_CALL_REGEX.test(text);
  }

  function isJrlFile(uri) {
    return uri && uri.endsWith('.jrl');
  }

  function getSignatureHelp(text, position, index, opt_uri) {
    /**
     * Provides parameter hints when cursor is inside parentheses of a method call.
     * E.g., this.myClass(|) → shows parameters for myClass
     * Also handles this.X.create({ → shows class properties
     */
    var lines = text.split('\n');
    var line = lines[position.line] || '';
    var prefix = line.substring(0, position.character);

    // Find the method name by scanning back from cursor to find '('
    // Then find the word before '('
    var callMatch = prefix.match(/(?:this\.)?(\w+)\s*\(\s*[^)]*$/);
    if ( ! callMatch ) return null;

    var methodName = callMatch[1];

    // Resolve the current class using FileModelCache for multi-class support
    var model = fileModelCache.getModelAt(opt_uri || '', text, position.line);
    if ( ! model ) return null;
    var classId = fileModelCache.getClassId(model);

    // Find the method in the class
    var methods = index.getMethods(classId);
    var method = null;
    for ( var i = 0 ; i < methods.length ; i++ ) {
      if ( methods[i].name === methodName ) { method = methods[i]; break; }
    }

    if ( ! method ) return null;

    // Build parameter list
    var params = [];
    if ( method.args && method.args.length > 0 ) {
      for ( var i = 0 ; i < method.args.length ; i++ ) {
        var a = method.args[i];
        params.push({
          label: a.name,
          documentation: a.type ? 'Type: ' + a.type : ''
        });
      }
    } else if ( method.code ) {
      var match = method.code.toString().match(/function\s*\w*\s*\(([^)]*)\)/);
      if ( match && match[1].trim() ) {
        var paramNames = match[1].split(',').map(function(p) { return p.trim(); });
        for ( var i = 0 ; i < paramNames.length ; i++ ) {
          params.push({ label: paramNames[i] });
        }
      }
    }

    if ( params.length === 0 ) return null;

    // Build signature label
    var sig = methodName + '(' + params.map(function(p) { return p.label; }).join(', ') + ')';

    // Determine active parameter by counting commas before cursor
    var afterParen = prefix.substring(prefix.lastIndexOf('(') + 1);
    var activeParam = (afterParen.match(/,/g) || []).length;

    return {
      signatures: [{
        label: sig,
        documentation: method.documentation || '',
        parameters: params
      }],
      activeSignature: 0,
      activeParameter: Math.min(activeParam, params.length - 1)
    };
  }

  function getFoldingRanges(text) {
    /**
     * Finds foldable sections: properties, methods, requires, imports,
     * exports, javaImports, actions, listeners arrays.
     */
    var ranges = [];
    var keywords = ['properties', 'methods', 'requires', 'imports', 'exports', 'javaImports', 'actions', 'listeners'];
    var lines = text.split('\n');

    for ( var k = 0 ; k < keywords.length ; k++ ) {
      var kw = keywords[k];
      var pattern = new RegExp(kw + '\\s*:\\s*\\[');

      for ( var i = 0 ; i < lines.length ; i++ ) {
        if ( ! pattern.test(lines[i]) ) continue;

        // Find the matching ] using balanced bracket tracking
        var depth = 0;
        var foundOpen = false;
        var endLine = -1;
        for ( var j = i ; j < lines.length ; j++ ) {
          var line = lines[j];
          for ( var c = 0 ; c < line.length ; c++ ) {
            if ( line[c] === '[' ) { depth++; foundOpen = true; }
            else if ( line[c] === ']' ) {
              depth--;
              if ( foundOpen && depth === 0 ) {
                endLine = j;
                break;
              }
            }
          }
          if ( endLine !== -1 ) break;
        }

        if ( endLine > i ) {
          ranges.push({
            startLine: i,
            endLine: endLine,
            kind: 'region'
          });
        }
      }
    }

    return ranges;
  }

  function getCodeActions(text, range, context, index, uri, cssTokenResolver) {
    /**
     * Provides code actions for diagnostics:
     * - "Did you mean X?" for unknown class references
     * - "Replace with correct import" for wrong Java packages
     * - "Replace '#abc' with '$token'" for raw color values with a matching token
     */
    var actions = [];
    if ( ! context || ! context.diagnostics ) return actions;

    for ( var i = 0 ; i < context.diagnostics.length ; i++ ) {
      var diag = context.diagnostics[i];

      // For "Unknown class" diagnostics, suggest similar names
      var unknownMatch = diag.message.match(/Unknown class[^']*'([^']+)'/);
      if ( unknownMatch ) {
        var unknownId = unknownMatch[1];
        var suggestions = findSimilarClasses(unknownId, index, 3);
        for ( var s = 0 ; s < suggestions.length ; s++ ) {
          actions.push({
            title: "Did you mean '" + suggestions[s] + "'?",
            kind: 'quickfix',
            diagnostics: [diag],
            edit: {
              changes: {
                [uri]: [{
                  range: diag.range,
                  newText: suggestions[s]
                }]
              }
            }
          });
        }
      }

      // For raw color diagnostics, offer a $token replacement if available.
      // Matches both new message ("raw color 'X'") and legacy phrasing.
      var rawColorMatch = diag.message.match(/raw color[^']*'([^']+)'/);
      if ( rawColorMatch && cssTokenResolver ) {
        var raw = rawColorMatch[1];
        var token = cssTokenResolver.findTokenForValue(raw);
        if ( token ) {
          actions.push({
            title: "Replace '" + raw + "' with '$" + token + "'",
            kind: 'quickfix',
            isPreferred: true,
            diagnostics: [diag],
            edit: {
              changes: {
                [uri]: [{
                  range: diag.range,
                  newText: '$' + token
                }]
              }
            }
          });
        }
      }

      // For wrong Java import packages, suggest correct ones
      var javaImportMappings = index.getJavaImportMappings();
      var wrongPkgMatch = diag.message.match(/Wrong Java package[^']*'([^']+)'/);
      if ( wrongPkgMatch ) {
        var wrongPkg = wrongPkgMatch[1];
        if ( javaImportMappings[wrongPkg] ) {
          actions.push({
            title: "Replace with '" + javaImportMappings[wrongPkg] + "'",
            kind: 'quickfix',
            isPreferred: true,
            diagnostics: [diag],
            edit: {
              changes: {
                [uri]: [{
                  range: diag.range,
                  newText: javaImportMappings[wrongPkg]
                }]
              }
            }
          });
        }
      }
    }

    return actions;
  }

  function findSimilarClasses(target, index, maxResults) {
    /** Simple fuzzy match: find classes whose short name is close to target's short name. */
    var targetShort = target.split('.').pop().toLowerCase();
    var ids = index.getAllClassIds();
    var scored = [];

    for ( var i = 0 ; i < ids.length ; i++ ) {
      var shortName = ids[i].split('.').pop().toLowerCase();
      if ( shortName === targetShort ) {
        // Exact short name match but different package — high score
        scored.push({ id: ids[i], score: 100 });
      } else if ( shortName.indexOf(targetShort) !== -1 || targetShort.indexOf(shortName) !== -1 ) {
        scored.push({ id: ids[i], score: 50 });
      } else {
        // Levenshtein-like: count common chars
        var common = 0;
        for ( var c = 0 ; c < targetShort.length ; c++ ) {
          if ( shortName.indexOf(targetShort[c]) !== -1 ) common++;
        }
        var similarity = common / Math.max(targetShort.length, shortName.length);
        if ( similarity > 0.6 ) {
          scored.push({ id: ids[i], score: Math.round(similarity * 40) });
        }
      }
    }

    scored.sort(function(a, b) { return b.score - a.score; });
    var results = [];
    for ( var i = 0 ; i < Math.min(scored.length, maxResults) ; i++ ) {
      results.push(scored[i].id);
    }
    return results;
  }

  function pushDiagnostics(uri, text) {
    notify('textDocument/publishDiagnostics', {
      uri: uri,
      diagnostics: diagnosticsHandler.handle(text, uri)
    });
  }

  function pushJrlDiagnostics(uri, text) {
    try {
      notify('textDocument/publishDiagnostics', {
        uri: uri,
        diagnostics: jrlHandler.handleDiagnostics(text, uri)
      });
    } catch (e) {
      console.error('[LSP] JRL diagnostics error:', e.message);
    }
  }

  function reindexFile(uri) {
    /**
     * Re-evaluate a FOAM source file into the live registry so that
     * changes (new/removed/renamed properties on a class) are picked up
     * without restarting the LSP. Triggered on save — not on every
     * keystroke, since mid-edit text is often syntactically broken.
     *
     * Steps:
     *   1. Invalidate the per-URI FileModelCache entry.
     *   2. Eval the file text in a context that calls the real foam.CLASS /
     *      foam.ENUM / foam.INTERFACE, which re-registers (or refines) the
     *      classes in the global foam.__context__.__cache__ registry.
     *   3. Invalidate any FoamIndex caches keyed on classes defined in the
     *      file so subsequent queries rebuild from the fresh axioms.
     *   4. Re-push diagnostics for this file AND every open JRL — JRL
     *      validates property/class names against the live registry, so a
     *      newly-added property here should immediately clear matching
     *      "Unknown property" warnings in any open .jrl file.
     */
    var doc = documents[uri];
    if ( ! doc ) return;
    fileModelCache.invalidate(uri);

    var changedClassIds = [];
    if ( isFoamFile(doc.text) ) {
      var models = fileModelCache.getModels(uri, doc.text);

      // Re-register the classes via real foam.CLASS. Wrap each model block
      // in a try/catch so one bad block doesn't skip the rest.
      for ( var i = 0 ; i < models.length ; i++ ) {
        var m = models[i];
        try {
          var typeFn = ( m.type_ === 'ENUM'      ? foam.ENUM :
                         m.type_ === 'INTERFACE' ? foam.INTERFACE :
                                                   foam.CLASS );
          typeFn(m);
        } catch ( e ) {
          console.error('[LSP] reindex re-register failed for ' +
            (m.package ? m.package + '.' : '') + m.name + ': ' + e.message);
        }
      }

      // Clear FoamIndex caches for each class defined in this file and
      // collect them for the targeted re-analyze pass below.
      for ( var i = 0 ; i < models.length ; i++ ) {
        var classId = fileModelCache.getClassId(models[i]);
        if ( ! classId ) continue;
        changedClassIds.push(classId);
        if ( typeof index.invalidate === 'function' ) index.invalidate(classId);
      }
    }

    // Compute the dependency closure — files whose diagnostics could be
    // impacted by this change. Empty list for non-FOAM saves; JRLs only
    // affect the open-file loop below.
    var affectedPaths = changedClassIds.length > 0
      ? index.getAffectedFiles(changedClassIds)
      : [];
    var affectedPathsSet = {};
    affectedPaths.forEach(function(p) { affectedPathsSet[p] = true; });

    // Re-push diagnostics for the saved file itself, open JRLs (registry
    // mutation affects their class refs), and any open FOAM file that's in
    // the affected set. Untouched open files are left alone — FOAM's axiom
    // state didn't change relative to them.
    for ( var ouri in documents ) {
      var otext = documents[ouri].text;
      if ( ouri === uri ) {
        fileModelCache.invalidate(ouri);
        if ( isJrlFile(ouri) ) pushJrlDiagnostics(ouri, otext);
        else if ( isFoamFile(otext) ) pushDiagnostics(ouri, otext);
        continue;
      }
      if ( isJrlFile(ouri) ) {
        pushJrlDiagnostics(ouri, otext);
      } else if ( isFoamFile(otext) ) {
        // Only re-diagnose if this file's path is in the affected set.
        var opath = uriToPath_(ouri);
        if ( opath && affectedPathsSet[opath] ) {
          fileModelCache.invalidate(ouri);
          pushDiagnostics(ouri, otext);
        }
      }
    }

    // Re-analyze closed-but-affected files so the Problems panel stays
    // coherent. Debounced so burst-saves coalesce.
    if ( affectedPaths.length > 0 ) {
      scheduleAffectedReanalyze(affectedPaths, uri);
    }
  }

  function uriToPath_(uri) {
    if ( ! uri ) return null;
    if ( uri.indexOf('file://') === 0 ) return decodeURIComponent(uri.substring(7));
    return uri;
  }

  var affectedReanalyzeTimer_ = null;
  var pendingAffectedPaths_ = {};
  function scheduleAffectedReanalyze(paths, skipUri) {
    /**
     * Debounced, targeted re-analysis: scans ONLY the file paths supplied
     * by getAffectedFiles. Burst-saves merge their path sets rather than
     * each triggering a full workspace scan.
     */
    paths.forEach(function(p) { pendingAffectedPaths_[p] = true; });
    if ( affectedReanalyzeTimer_ ) clearTimeout(affectedReanalyzeTimer_);
    affectedReanalyzeTimer_ = setTimeout(function() {
      affectedReanalyzeTimer_ = null;
      var batch = Object.keys(pendingAffectedPaths_);
      pendingAffectedPaths_ = {};
      try {
        var results = workspaceAnalyzer.analyzeFiles(batch);
        for ( var uri in results.fileResults ) {
          // Skip the saved file and any open file — they've already been
          // pushed from the open-doc loop with live buffer contents.
          if ( uri === skipUri ) continue;
          if ( documents[uri] ) continue;
          notify('textDocument/publishDiagnostics', {
            uri: uri,
            diagnostics: results.fileResults[uri]
          });
        }
        console.error('[LSP] affected reanalyze: ' +
          results.filesScanned + ' scanned, ' +
          results.filesWithIssues + ' with issues');
      } catch ( e ) {
        console.error('[LSP] affected reanalyze error: ' + e.message);
      }
    }, 500);
  }

  // === Message Dispatch ===

  function handleMessage(msg) {
    var method = msg.method;
    var params = msg.params;
    var id     = msg.id;

    switch ( method ) {
      case 'initialize':
        respond(id, {
          capabilities: {
            textDocumentSync: {
              openClose: true,
              change: 1,
              save: { includeText: false }
            },
            completionProvider: {
              triggerCharacters: ["'", '"', '.', ':', '$'],
              resolveProvider: false
            },
            hoverProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            signatureHelpProvider: {
              triggerCharacters: ['(', ',']
            },
            workspaceSymbolProvider: true,
            foldingRangeProvider: true,
            semanticTokensProvider: {
              legend: {
                tokenTypes: ['type', 'class', 'variable', 'keyword', 'string', 'comment', 'number', 'operator', 'method'],
                tokenModifiers: ['declaration', 'readonly']
              },
              full: true
            },
            codeActionProvider: true,
            documentHighlightProvider: true,
            renameProvider: { prepareProvider: true }
          },
          experimental: {
            workspaceAnalyzer: true
          },
          serverInfo: { name: 'foam-lsp', version: '0.2.0' }
        });
        break;

      case 'initialized':
        break;

      case 'shutdown':
        respond(id, null);
        break;

      case 'exit':
        process.exit(0);
        break;

      case 'textDocument/didOpen':
        var tdoc = params.textDocument;
        console.error('[LSP] didOpen: ' + tdoc.uri + ' lang=' + tdoc.languageId);
        documents[tdoc.uri] = { text: tdoc.text, version: tdoc.version || 0 };
        if ( isFoamFile(tdoc.text) ) pushDiagnostics(tdoc.uri, tdoc.text);
        if ( isJrlFile(tdoc.uri) ) pushJrlDiagnostics(tdoc.uri, tdoc.text);
        break;

      case 'textDocument/didChange':
        var uri = params.textDocument.uri;
        if ( params.contentChanges.length > 0 ) {
          documents[uri] = { text: params.contentChanges[0].text, version: params.textDocument.version || 0 };
          fileModelCache.invalidate(uri);
          if ( isFoamFile(documents[uri].text) ) pushDiagnostics(uri, documents[uri].text);
          if ( isJrlFile(uri) ) pushJrlDiagnostics(uri, documents[uri].text);
        }
        break;

      case 'textDocument/didSave':
        reindexFile(params.textDocument.uri);
        break;

      case 'textDocument/didClose':
        delete documents[params.textDocument.uri];
        notify('textDocument/publishDiagnostics', { uri: params.textDocument.uri, diagnostics: [] });
        break;

      case 'textDocument/completion':
        var doc = documents[params.textDocument.uri];
        // JRL file completion
        if ( doc && isJrlFile(params.textDocument.uri) ) {
          try {
            var result = jrlHandler.handleCompletion(doc.text, params.position, params.textDocument.uri);
            respond(id, result);
          } catch (e) {
            console.error('[LSP] JRL completion error:', e.message);
            respond(id, { isIncomplete: false, items: [] });
          }
          break;
        }
        if ( ! doc || ! isFoamFile(doc.text) ) {
          respond(id, { isIncomplete: false, items: [] });
          break;
        }
        try {
          var lines = doc.text.split('\n');
          var line = lines[params.position.line] || '';
          var prefix = line.substring(0, params.position.character);
          var result;
          // Try member completion first (this., .create({), or inside create block)
          result = memberHandler.handle(doc.text, params.position, params.textDocument.uri);
          // Fall back to grammar-based completion
          if ( ! result || result.items.length === 0 ) {
            result = completionHandler.handle(doc.text, params.position, params.textDocument.uri);
          }
          console.error('[LSP] completion: ' + result.items.length + ' items at line ' + params.position.line + ':' + params.position.character);
          respond(id, result);
        } catch (e) {
          console.error('[LSP] completion error:', e.message, e.stack);
          respond(id, { isIncomplete: false, items: [] });
        }
        break;

      case 'textDocument/hover':
        var doc = documents[params.textDocument.uri];
        console.error('[LSP] hover requested: ' + params.textDocument.uri);
        if ( ! doc ) { console.error('[LSP] hover: no doc'); respond(id, null); break; }
        // JRL file hover
        if ( isJrlFile(params.textDocument.uri) ) {
          try {
            var result = jrlHandler.handleHover(doc.text, params.position, params.textDocument.uri);
            respond(id, result);
          } catch (e) {
            console.error('[LSP] JRL hover error:', e.message);
            respond(id, null);
          }
          break;
        }
        if ( ! isFoamFile(doc.text) ) { respond(id, null); break; }
        try {
          var result = hoverHandler.handle(doc.text, params.position, params.textDocument.uri);
          console.error('[LSP] hover: success');
          respond(id, result);
        } catch (e) {
          console.error('[LSP] hover error:', e.message);
          respond(id, null);
        }
        break;

      case 'textDocument/definition':
        var doc = documents[params.textDocument.uri];
        if ( ! doc ) { respond(id, null); break; }
        // JRL file go-to-definition
        if ( isJrlFile(params.textDocument.uri) ) {
          try {
            var result = jrlHandler.handleDefinition(doc.text, params.position, params.textDocument.uri);
            respond(id, result);
          } catch (e) {
            console.error('[LSP] JRL definition error:', e.message);
            respond(id, null);
          }
          break;
        }
        if ( ! isFoamFile(doc.text) ) { respond(id, null); break; }
        try {
          var result = definitionHandler.handle(doc.text, params.position, params.textDocument.uri);
          console.error('[LSP] definition: success');
          respond(id, result);
        } catch (e) {
          console.error('[LSP] definition error:', e.message);
          respond(id, null);
        }
        break;

      case 'textDocument/documentSymbol':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, []); break; }
        try {
          var result = symbolHandler.handle(doc.text, params.textDocument.uri);
          console.error('[LSP] documentSymbol: success');
          respond(id, result);
        } catch (e) {
          console.error('[LSP] documentSymbol error:', e.message);
          respond(id, []);
        }
        break;

      case 'textDocument/signatureHelp':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, null); break; }
        try {
          var result = getSignatureHelp(doc.text, params.position, index, params.textDocument.uri);
          respond(id, result);
        } catch (e) {
          console.error('[LSP] signatureHelp error:', e.message);
          respond(id, null);
        }
        break;

      case 'foam/analyzeWorkspace':
        try {
          var results = workspaceAnalyzer.analyze(function(progress) {
            notify('foam/analyzeProgress', progress);
          });
          // Push diagnostics to Problems panel via standard LSP protocol
          for ( var uri in results.fileResults ) {
            notify('textDocument/publishDiagnostics', {
              uri: uri,
              diagnostics: results.fileResults[uri]
            });
          }
          // Also return results for sidebar tree view
          respond(id, {
            filesScanned:    results.filesScanned,
            filesWithIssues: results.filesWithIssues,
            warnings:        results.warnings,
            errors:          results.errors,
            infos:           results.infos,
            patterns:        results.patterns,
            fileResults:     results.fileResults
          });
        } catch (e) {
          console.error('[LSP] analyzeWorkspace error:', e.message);
          respondError(id, -32603, e.message);
        }
        break;

      case 'workspace/symbol':
        var query = (params.query || '').toLowerCase();
        var symbols = [];
        var ids = index.getAllClassIds();
        for ( var i = 0 ; i < ids.length && symbols.length < 100 ; i++ ) {
          if ( ids[i].toLowerCase().indexOf(query) !== -1 ) {
            var filePath = index.getFilePath(ids[i]);
            if ( filePath ) {
              symbols.push({
                name: ids[i].split('.').pop(),
                kind: 5,
                location: {
                  uri: 'file://' + filePath,
                  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
                },
                containerName: ids[i]
              });
            }
          }
        }
        respond(id, symbols);
        break;

      case 'textDocument/foldingRange':
        var doc = documents[params.textDocument.uri];
        if ( ! doc ) { respond(id, []); break; }
        respond(id, getFoldingRanges(doc.text));
        break;

      case 'textDocument/codeAction':
        var doc = documents[params.textDocument.uri];
        if ( ! doc ) { respond(id, []); break; }
        respond(id, getCodeActions(doc.text, params.range, params.context, index, params.textDocument.uri, cssTokenResolver));
        break;

      case 'textDocument/semanticTokens/full':
        var doc = documents[params.textDocument.uri];
        if ( ! doc ) { respond(id, { data: [] }); break; }
        // JRL file semantic tokens
        if ( isJrlFile(params.textDocument.uri) ) {
          try {
            var result = jrlHandler.handleSemanticTokens(doc.text);
            respond(id, result);
          } catch (e) {
            console.error('[LSP] JRL semanticTokens error:', e.message);
            respond(id, { data: [] });
          }
          break;
        }
        if ( ! isFoamFile(doc.text) ) { respond(id, { data: [] }); break; }
        try {
          var result = semanticTokenHandler.handle(doc.text, params.textDocument.uri);
          console.error('[LSP] semanticTokens: ' + (result.data.length / 5) + ' tokens');
          respond(id, result);
        } catch (e) {
          console.error('[LSP] semanticTokens error:', e.message, e.stack);
          respond(id, { data: [] });
        }
        break;

      case 'textDocument/references':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, []); break; }
        try {
          var result = referencesHandler.handle(doc.text, params.position, params.textDocument.uri);
          respond(id, result);
        } catch (e) {
          console.error('[LSP] references error:', e.message);
          respond(id, []);
        }
        break;

      case 'textDocument/documentHighlight':
        var doc = documents[params.textDocument.uri];
        if ( ! doc ) { respond(id, []); break; }
        try {
          respond(id, documentHighlightHandler.handle(doc.text, params.position));
        } catch (e) {
          console.error('[LSP] documentHighlight error:', e.message);
          respond(id, []);
        }
        break;

      case 'textDocument/prepareRename':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, null); break; }
        try {
          respond(id, renameHandler.prepare(doc.text, params.position));
        } catch (e) {
          console.error('[LSP] prepareRename error:', e.message);
          respond(id, null);
        }
        break;

      case 'textDocument/rename':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, null); break; }
        try {
          respond(id, renameHandler.handle(doc.text, params.position, params.newName, params.textDocument.uri));
        } catch (e) {
          console.error('[LSP] rename error:', e.message);
          respond(id, null);
        }
        break;

      default:
        if ( id !== undefined ) {
          respondError(id, -32601, 'Method not found: ' + method);
        }
    }
  }

  console.error('FOAM LSP server started. ' + index.getAllClassIds().length + ' classes indexed.');
}

module.exports = { start: start };
