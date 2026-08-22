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

  // Feature toggles. The real merge needs the client's initializationOptions
  // and the workspace root, neither of which exists until 'initialize' — so
  // handlers are built against an all-defaults config here and re-pointed at
  // the merged one there. Nothing can arrive on the wire before 'initialize',
  // so no request is ever served under the placeholder.
  var FeatureConfig = require('./FeatureConfig');
  var featureConfig = FeatureConfig.load({});

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
  var i18nHandler        = foam.parse.lsp.handlers.I18nHandler.create({ index: index, cache: fileModelCache });
  // Translation provider: created here (server-start scope) so `provider` is
  // reachable from the 'initialize' case below, where config actually
  // arrives (the client's options are message-scoped, not available here).
  var provider = foam.parse.lsp.HttpChatProvider.create();
  i18nHandler.provider = provider;
  var diagnosticsHandler = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index, cache: fileModelCache, cssTokenResolver: cssTokenResolver, i18nHandler: i18nHandler, featureConfig: featureConfig });
  var symbolHandler      = foam.parse.lsp.handlers.SymbolHandler.create({ cache: fileModelCache });
  var memberHandler      = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index, cache: fileModelCache, typeTracker: typeTracker });

  var semanticTokenHandler = foam.parse.lsp.handlers.SemanticTokenHandler.create({ index: index, cache: fileModelCache, typeTracker: typeTracker, cssTokenResolver: cssTokenResolver });
  var referencesHandler = foam.parse.lsp.handlers.ReferencesHandler.create({ index: index });
  var documentHighlightHandler = foam.parse.lsp.handlers.DocumentHighlightHandler.create();
  var renameHandler = foam.parse.lsp.handlers.RenameHandler.create({ index: index });
  var journalEntryIndex = foam.parse.lsp.JournalEntryIndex.create({ index: index });
  var jrlHandler = foam.parse.lsp.handlers.JrlHandler.create({
    index: index,
    journalEntryIndex: journalEntryIndex
  });
  jrlHandler.buildJournalClassMap();
  var workspaceAnalyzer = foam.parse.lsp.handlers.WorkspaceAnalyzer.create({ index: index });

  var signatureHelpHandler   = foam.parse.lsp.handlers.SignatureHelpHandler.create({ index: index, cache: fileModelCache });
  var foldingRangeHandler    = foam.parse.lsp.handlers.FoldingRangeHandler.create();
  var codeActionHandler      = foam.parse.lsp.handlers.CodeActionHandler.create({ index: index, cssTokenResolver: cssTokenResolver, i18nHandler: i18nHandler, featureConfig: featureConfig });
  var workspaceSymbolHandler = foam.parse.lsp.handlers.WorkspaceSymbolHandler.create({ index: index });
  var typeHierarchyHandler   = foam.parse.lsp.handlers.TypeHierarchyHandler.create({ index: index, cache: fileModelCache });
  var implementationHandler  = foam.parse.lsp.handlers.ImplementationHandler.create({ index: index, cache: fileModelCache });
  var typeDefinitionHandler  = foam.parse.lsp.handlers.TypeDefinitionHandler.create({ index: index, cache: fileModelCache });
  var callHierarchyHandler   = foam.parse.lsp.handlers.CallHierarchyHandler.create({ index: index, cache: fileModelCache });
  var pomValidator           = foam.parse.lsp.handlers.PomValidator.create({ index: index });

  var documents = {};
  var rawBuffer = Buffer.alloc(0);

  // === JSON-RPC over stdio ===
  // Use raw Buffer (not string) because Content-Length is in bytes,
  // and multi-byte UTF-8 characters cause string.length !== byte length.

  process.stdin.on('data', function(chunk) {
    rawBuffer = Buffer.concat([rawBuffer, chunk]);
    processBuffer();
  });

  // Exit when the client closes our stdin — otherwise a dead parent leaves
  // this process orphaned forever (and writes to its closed pipes EPIPE).
  process.stdin.on('end', function() {
    process.exit(0);
  });

  // --- git HEAD watch (opt-in) ---------------------------------------------
  // The registry reflects the boot-time checkout. A branch switch rewrites
  // files wholesale with no didSave, so answers silently go stale. When the
  // client sets FOAM_LSP_EXIT_ON_HEAD_CHANGE (the MCP wrapper does — it
  // reboots us lazily on the next tool call), exit as soon as a watched
  // repo's HEAD changes. Editors don't set it: a didSave-driven refresh plus
  // a visible restart is better UX than a surprise server exit.
  // HEAD content only changes on checkout/switch/rebase — not on commit —
  // so normal work never triggers this.
  var fs_   = require('fs');
  var path_ = require('path');

  function resolveHeadPath(root) {
    // .git is a directory in a normal checkout, but a "gitdir: <path>" file
    // in worktrees and submodules.
    var dotGit = path_.join(root, '.git');
    try {
      var gitdir = dotGit;
      if ( fs_.statSync(dotGit).isFile() ) {
        var m = fs_.readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)\s*$/m);
        if ( ! m ) return null;
        gitdir = path_.resolve(root, m[1].trim());
      }
      var head = path_.join(gitdir, 'HEAD');
      fs_.accessSync(head);
      return head;
    } catch (e) { return null; }
  }

  function readHead(p) {
    try { return fs_.readFileSync(p, 'utf8'); } catch (e) { return ''; }
  }

  if ( process.env.FOAM_LSP_EXIT_ON_HEAD_CHANGE ) {
    // Watch the project repo and the foam3 submodule (same layout assumption
    // as the rest of the tooling: foam3/ under the project root).
    var headPaths = [ process.cwd(), path_.join(process.cwd(), 'foam3') ].
      map(resolveHeadPath).filter(function(p) { return p; });
    var headBaseline = headPaths.map(readHead);
    setInterval(function() {
      for ( var i = 0 ; i < headPaths.length ; i++ ) {
        if ( readHead(headPaths[i]) !== headBaseline[i] ) {
          console.error('[LSP] git HEAD changed (' + headPaths[i] + ') — exiting so the client boots a fresh index');
          process.exit(0);
        }
      }
    }, Math.max(1000, Number(process.env.FOAM_LSP_HEAD_POLL_MS) || 10000)).unref();
  }

  // LSP spec: initialize.processId is the client's pid; the server should
  // exit when that process dies. Covers parents killed with SIGKILL, where
  // stdin 'end' may never be observed before the next write EPIPEs.
  function watchClientProcess(pid) {
    if ( typeof pid !== 'number' ) return;
    setInterval(function() {
      try {
        process.kill(pid, 0);
      } catch (e) {
        process.exit(0);
      }
    }, 30000).unref();
  }

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

  // === Outbound server -> client requests (workspace/applyEdit) ===
  // Every other message this server sends is either a response to the client
  // or a notification; applyEdit is the one place the server asks the client
  // for something and needs the answer back. Ids start high so they can never
  // collide with a client-issued id, and handleMessage settles the promise
  // when the matching response arrives.
  var outboundId = 1000000;
  var pendingOutbound = {};
  function request(method, params) {
    return new Promise(function(resolve, reject) {
      var id = outboundId++;
      pendingOutbound[id] = { resolve: resolve, reject: reject };
      send({ jsonrpc: '2.0', id: id, method: method, params: params });
    });
  }

  function byNameResult(info, op) {
    // Name-addressed lookup by resolved class id (not cursor position) — the
    // engine behind foam/byName. info = { classId, memberName?, uri, line,
    // character, kind }. Returns the same shapes the cursor-driven LSP methods
    // return, so the MCP reuses one set of shapers for both addressing modes.
    var classId = info.classId;
    switch ( op ) {
      case 'definition':
        return [ {
          uri:   info.uri,
          range: { start: { line: info.line, character: info.character },
                   end:   { line: info.line, character: info.character } }
        } ];
      case 'hover': {
        // buildMethodHover_ returns a raw markdown string (wrap it);
        // buildClassHover already returns a { contents: {...} } hover (pass
        // it through). Don't double-wrap.
        if ( info.memberName && info.kind === 6 ) {
          var cls = index.getClass(classId);
          var methodAxiom = null;
          if ( cls ) {
            try {
              var ms = cls.getAxiomsByClass(foam.lang.Method);
              for ( var i = 0 ; i < ms.length ; i++ ) {
                if ( ms[i].name === info.memberName ) { methodAxiom = ms[i]; break; }
              }
            } catch (e) {}
          }
          if ( methodAxiom ) {
            var mmd = hoverHandler.buildMethodHover_(methodAxiom, classId);
            return mmd ? { contents: { kind: 'markdown', value: mmd } } : null;
          }
          // Java-only method (no FOAM axiom): hover from its parsed signature.
          var jms = index.getJavaMethods(classId);
          for ( var ji = 0 ; ji < jms.length ; ji++ ) {
            if ( jms[ji].name === info.memberName ) {
              var jv = '```java\n' + ( jms[ji].sig || jms[ji].name ) + '\n```';
              if ( jms[ji].doc ) jv += '\n\n' + jms[ji].doc;
              return { contents: { kind: 'markdown', value: jv } };
            }
          }
        }
        return hoverHandler.buildClassHover(classId);
      }
      case 'references': {
        // Class.member: return the member's call-site lines when the member
        // scan recognizes it (own property/message/constant); null falls
        // back to class references (methods go through callHierarchy).
        if ( info.memberName ) {
          var mLocs = referencesHandler.memberReferencesForClassId(classId, info.memberName);
          if ( mLocs ) return mLocs;
        }
        return referencesHandler.referencesForClassId(classId);
      }
      case 'implementation': {
        var targets = index.isInterface(classId) ?
          index.getImplementors(classId) : index.getSubclasses(classId);
        var locs = [];
        for ( var i = 0 ; i < targets.length ; i++ ) {
          var fp = index.getFilePath(targets[i]);
          if ( ! fp ) continue;
          var ln = index.getClassLine(targets[i]);
          locs.push({ uri: 'file://' + fp,
            range: { start: { line: ln, character: 0 }, end: { line: ln, character: 0 } } });
        }
        return locs;
      }
      case 'typeHierarchy': {
        var item = typeHierarchyHandler.itemFor_(classId);
        return {
          supertypes: item ? typeHierarchyHandler.supertypes(item) : [],
          subtypes:   item ? typeHierarchyHandler.subtypes(item)   : []
        };
      }
      case 'callHierarchy': {
        if ( ! info.memberName ) return { incoming: [], outgoing: [] };
        var chItem = callHierarchyHandler.itemFor_(classId, info.memberName);
        return {
          incoming: callHierarchyHandler.incomingCalls(chItem),
          outgoing: callHierarchyHandler.outgoingCalls(chItem)
        };
      }
      default:
        return null;
    }
  }

  function isFoamFile(text) {
    return foam.parse.lsp.CursorAnalyzer.FOAM_CALL_REGEX.test(text);
  }

  function isJrlFile(uri) {
    return uri && uri.endsWith('.jrl');
  }

  function isPomFile(uri) {
    return uri && /pom\.js$/.test(uri);
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

    // POM saves don't go through the foam.CLASS reindex path (POM is excluded
    // from FOAM_CALL_REGEX). Drop the cached entry positions for this pom so
    // class→pom navigation reflects the edit on the next request.
    if ( isPomFile(uri) && typeof index.invalidatePomCache === 'function' ) {
      var pomPath = uriToPath_(uri);
      if ( pomPath ) index.invalidatePomCache(pomPath);
    }

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

  // Per-request timing. Logs `[LSP] ⏱ <method> <ms>ms` for any request/
  // notification whose handler runs at least LSP_TIMING_MIN_MS. Override the
  // threshold with env LSP_TIMING_MS (set to 0 to log every message).
  var LSP_TIMING_MIN_MS = process.env.LSP_TIMING_MS !== undefined ?
    Number(process.env.LSP_TIMING_MS) : 5;

  function handleMessage(msg) {
    var method = msg.method;
    var params = msg.params;
    var id     = msg.id;

    // A RESPONSE to one of our own outbound requests: it carries an id but no
    // method (a client REQUEST carries both, so the method check keeps this
    // from ever swallowing one). Settle the waiting promise and stop — there
    // is nothing to dispatch and nothing to respond to.
    if ( id !== undefined && method === undefined && pendingOutbound[id] ) {
      var pending = pendingOutbound[id];
      delete pendingOutbound[id];
      if ( msg.error ) pending.reject(new Error(msg.error.message));
      else             pending.resolve(msg.result);
      return;
    }

    var timerStart = process.hrtime.bigint();
    try {
    switch ( method ) {
      case 'initialize':
        watchClientProcess(params && params.processId);
        // Feature toggles: defaults < foam-lsp.json at the workspace root <
        // this client's initializationOptions.foam. Handlers were created at
        // start()-scope with the all-defaults config; hand them the merged one
        // now that the client's layer has actually arrived.
        featureConfig = FeatureConfig.load({
          rootPath:    params && params.rootUri ? uriToPath_(params.rootUri) : process.cwd(),
          initOptions: params && params.initializationOptions && params.initializationOptions.foam
        });
        featureConfig.warnings.forEach(function(w) { console.error('[LSP] config: ' + w); });
        diagnosticsHandler.featureConfig = featureConfig;
        codeActionHandler.featureConfig  = featureConfig;

        // i18n settings ride the same merge (featureConfig.i18n), but the
        // env-var and locales.jrl fallbacks below stay here: FeatureConfig
        // merges the three declared layers only — it never reads the
        // environment or the journals.
        var i18nOpts = featureConfig.i18n;
        if ( i18nOpts.sourceLanguage ) i18nHandler.sourceLanguage = i18nOpts.sourceLanguage;
        // An explicit-but-empty languages: [] is treated the same as unset —
        // falls through to journal derivation below — rather than as "no
        // languages wanted", so an empty config array never suppresses the
        // locales.jrl fallback.
        if ( Array.isArray(i18nOpts.languages) && i18nOpts.languages.length ) {
          i18nHandler.targetLanguages = i18nOpts.languages;
        } else {
          try {
            var wsRoot = params && params.rootUri ? uriToPath_(params.rootUri) : process.cwd();
            var localesPath = require('path').join(wsRoot, 'journals', 'locales.jrl');
            if ( require('fs').existsSync(localesPath) ) {
              i18nHandler.targetLanguages = i18nHandler.deriveLanguagesFromJournals(
                foam.parse.lsp.JrlLoader.create(), [ localesPath ]);
            }
          } catch (e) { console.error('[LSP] i18n language derivation failed:', e.message); }
        }

        // Translation provider config: explicit config wins, then env vars,
        // then HttpChatProvider's own built-in defaults (untouched when
        // neither is set).
        if ( i18nOpts.endpoint ) {
          provider.endpoints = [ i18nOpts.endpoint ];
        } else if ( process.env.OLLAMA_HOST ) {
          provider.endpoints = [ process.env.OLLAMA_HOST ];
        }
        if ( i18nOpts.model ) {
          provider.model = i18nOpts.model;
        } else if ( process.env.OLLAMA_TRANSLATION_MODEL ) {
          provider.model = process.env.OLLAMA_TRANSLATION_MODEL;
        }
        // Boot probe — fire-and-forget. Never await: an unreachable/slow
        // translation endpoint must not delay the initialize response.
        // Skipped when no target languages are configured (no initOpts
        // languages and no journals/locales.jrl): the translate feature can
        // never fire there, and the probe would just cost two loopback
        // fetches plus a "no translation model reachable" console line on
        // every boot. foam/i18nStatus still probes on demand.
        if ( ( i18nHandler.targetLanguages || [] ).length ) {
          i18nHandler.refreshAvailability().catch(function() {});
        }

        // Capabilities the client can turn off are ADDED below rather than
        // set to false: a client that never sees the capability never sends
        // the request, so the feature costs nothing at all — where `false`
        // still leaves some clients probing, and leaves the dispatch case as
        // the only thing standing between a request and the handler.
        var caps = {
          textDocumentSync: {
            openClose: true,
            change: 1,
            save: { includeText: false }
          },
          definitionProvider: true,
          referencesProvider: true,
          documentSymbolProvider: true,
          workspaceSymbolProvider: true,
          codeActionProvider: true,
          executeCommandProvider: {
            commands: ['foam.i18n.extractAndTranslate', 'foam.i18n.translateMessage']
          },
          documentHighlightProvider: true,
          renameProvider: { prepareProvider: true },
          typeHierarchyProvider: true,
          implementationProvider: true,
          typeDefinitionProvider: true,
          callHierarchyProvider: true
          // No diagnosticProvider (pull): diagnostics are PUSHED via
          // publishDiagnostics on open/change and from the workspace scan.
          // Advertising pull here too made clients render every diagnostic
          // twice (push copy + pull copy).
          //
          // executeCommandProvider stays unconditional: its commands are
          // invoked from code actions the server itself offered, and each
          // command guards its own preconditions.
        };
        if ( featureConfig.enabled('completion') ) {
          caps.completionProvider = {
            triggerCharacters: ["'", '"', '.', ':', '$'],
            resolveProvider: false
          };
        }
        if ( featureConfig.enabled('hover') ) caps.hoverProvider = true;
        if ( featureConfig.enabled('signatureHelp') ) {
          caps.signatureHelpProvider = { triggerCharacters: ['(', ','] };
        }
        if ( featureConfig.enabled('folding') ) caps.foldingRangeProvider = true;
        if ( featureConfig.enabled('semanticTokens') ) {
          caps.semanticTokensProvider = {
            legend: {
              tokenTypes: ['type', 'class', 'variable', 'keyword', 'string', 'comment', 'number', 'operator', 'method'],
              tokenModifiers: ['declaration', 'readonly']
            },
            full: true
          };
        }

        respond(id, {
          capabilities: caps,
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
        if ( params.textDocument.uri && params.textDocument.uri.endsWith('.jrl') ) {
          journalEntryIndex.invalidate();
        }
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
        // pom.js doesn't match FOAM_CALL_REGEX (POM is excluded), but the
        // DefinitionHandler has a dedicated pom→class branch that needs to
        // run. Let pom.js through; other non-FOAM .js files still bail.
        if ( ! isFoamFile(doc.text) && ! isPomFile(params.textDocument.uri) ) {
          respond(id, null); break;
        }
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
          respond(id, signatureHelpHandler.handle(doc.text, params.position, params.textDocument.uri));
        } catch (e) {
          console.error('[LSP] signatureHelp error:', e.message);
          respond(id, null);
        }
        break;

      case 'foam/validatePoms':
        // Custom request: returns { orphans, missing, duplicates } for the
        // POM membership audit. Surfaced via foam/analyzeWorkspace too;
        // also callable on demand.
        try {
          respond(id, pomValidator.validate());
        } catch (e) {
          console.error('[LSP] foam/validatePoms error:', e.message);
          respondError(id, -32603, e.message);
        }
        break;

      case 'foam/analyzeWorkspace':
        // Non-blocking: analyzeAsync yields between chunks so hover/completion/
        // diagnostics keep responding while the workspace scan runs.
        try {
          workspaceAnalyzer.analyzeAsync(function(progress) {
            notify('foam/analyzeProgress', progress);
          }, function(results) {
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
          });
        } catch (e) {
          console.error('[LSP] analyzeWorkspace error:', e.message);
          respondError(id, -32603, e.message);
        }
        break;

      case 'foam/byName':
        // Custom request: name-addressed navigation by class id. params:
        // { name, op } where op ∈ definition|hover|references|implementation|
        // typeHierarchy|callHierarchy. Returns the same shapes as the
        // cursor-driven LSP methods so MCP reuses its shapers. null if the
        // name can't be resolved.
        try {
          var bnInfo = index.resolveSymbol(params && params.name);
          respond(id, bnInfo ? byNameResult(bnInfo, params && params.op) : null);
        } catch (e) {
          console.error('[LSP] foam/byName error:', e.message);
          respond(id, null);
        }
        break;

      // Custom i18n methods (thin: parse args, read document text like
      // workspace/executeCommand does above, call I18nHandler, respond).
      // All three are async-dispatched the same way — a promise chain with
      // exactly one respond()/respondError() at its end — because
      // refreshAvailability/translateInto_ are network round trips
      // (foam/i18nStatus, foam/i18nTranslate) or because staying consistent
      // with the other two beats a needlessly-sync foam/i18nApply. Each gets
      // the same last-resort .catch() as workspace/executeCommand above: if
      // respond()/respondError() itself throws (e.g. EPIPE, client already
      // gone), that throw happens INSIDE a .catch handler here — unlike a
      // synchronous case's throw, that would otherwise become an unhandled
      // rejection rather than propagating normally, which could take the
      // whole server down.
      case 'foam/i18nStatus':
        Promise.resolve().then(function() {
          return i18nHandler.refreshAvailability();
        }).then(function() {
          respond(id, {
            available:       i18nHandler.translationReady,
            model:           i18nHandler.activeModel,
            endpoint:        ( provider.lastResult_ && provider.lastResult_.endpoint ) || '',
            targetLanguages: i18nHandler.targetLanguages || []
          });
        }).catch(function(e) {
          console.error('[LSP] foam/i18nStatus error:', e.message);
          respondError(id, -32603, e.message);
        }).catch(function(e) {
          console.error('[LSP] foam/i18nStatus reporting failed:', e.message);
        });
        break;

      case 'foam/i18nTranslate': {
        var trArgs = params || {};
        Promise.resolve().then(function() {
          var tdoc = documents[trArgs.uri];
          var ttext = tdoc ? tdoc.text : require('fs').readFileSync(uriToPath_(trArgs.uri), 'utf8');
          return trArgs.dryRun ?
            i18nHandler.dryRunTranslateStrings(trArgs.uri, ttext, trArgs.messageName, trArgs.languages) :
            i18nHandler.translateMessages(trArgs.uri, ttext, trArgs.messageName, trArgs.languages);
        }).then(function(r) {
          respond(id, r);
        }).catch(function(e) {
          console.error('[LSP] foam/i18nTranslate error:', e.message);
          respondError(id, -32603, e.message);
        }).catch(function(e) {
          console.error('[LSP] foam/i18nTranslate reporting failed:', e.message);
        });
        break;
      }

      case 'foam/i18nApply': {
        var apArgs = params || {};
        Promise.resolve().then(function() {
          var adoc = documents[apArgs.uri];
          var atext = adoc ? adoc.text : require('fs').readFileSync(uriToPath_(apArgs.uri), 'utf8');
          return i18nHandler.applyTranslations(atext, apArgs.uri, apArgs.translations || {});
        }).then(function(edit) {
          respond(id, { edit: edit, warnings: [] });
        }).catch(function(e) {
          console.error('[LSP] foam/i18nApply error:', e.message);
          respondError(id, -32603, e.message);
        }).catch(function(e) {
          console.error('[LSP] foam/i18nApply reporting failed:', e.message);
        });
        break;
      }

      case 'workspace/symbol':
        try {
          respond(id, workspaceSymbolHandler.handle(params.query));
        } catch (e) {
          console.error('[LSP] workspace/symbol error:', e.message);
          respond(id, []);
        }
        break;

      case 'textDocument/foldingRange':
        var doc = documents[params.textDocument.uri];
        if ( ! doc ) { respond(id, []); break; }
        try {
          respond(id, foldingRangeHandler.handle(doc.text));
        } catch (e) {
          console.error('[LSP] foldingRange error:', e.message);
          respond(id, []);
        }
        break;

      case 'textDocument/codeAction':
        var doc = documents[params.textDocument.uri];
        if ( ! doc ) { respond(id, []); break; }
        try {
          respond(id, codeActionHandler.handle(doc.text, params.range, params.context, params.textDocument.uri));
        } catch (e) {
          console.error('[LSP] codeAction error:', e.message);
          respond(id, []);
        }
        break;

      // The one promise-aware case: translating is a network round trip, so
      // the edit can't be built inside this synchronous dispatch. The command
      // resolves with the edit, the client is asked to apply it, and only
      // then does the request get its (unspecified, per LSP) result. Errors —
      // provider down, anchor gone, client refused the edit — are surfaced to
      // the user as a message, never as a silent no-op.
      case 'workspace/executeCommand': {
        var cmdArgs = ( params.arguments && params.arguments[0] ) || {};
        // Reading the text starts inside the promise chain so a bad/deleted
        // uri (readFileSync throwing) lands in the same catch as any other
        // failure instead of leaving the request unanswered.
        Promise.resolve().then(function() {
          var cdoc = documents[cmdArgs.uri];
          cmdArgs.text = cdoc ? cdoc.text : require('fs').readFileSync(uriToPath_(cmdArgs.uri), 'utf8');
          return i18nHandler.executeCommand(params.command, cmdArgs);
        }).then(function(r) {
          return request('workspace/applyEdit', { label: 'FOAM i18n translate', edit: r.edit })
            .then(function(applyResult) {
              // The client answers an applyEdit it declined with applied:false
              // rather than an error response, so a refusal has to be checked
              // for explicitly — otherwise it reads as success and the user is
              // told nothing while the file stayed unchanged.
              if ( applyResult && applyResult.applied === false ) {
                throw new Error('the editor did not apply the edit' +
                  ( applyResult.failureReason ? ' (' + applyResult.failureReason + ')' : '' ));
              }
              if ( r.warnings && r.warnings.length ) {
                notify('window/showMessage', { type: 2 /* Warning */,
                  message: 'Translation applied with warnings: ' + r.warnings.join('; ') });
              }
              respond(id, null);
            });
        }).catch(function(e) {
          notify('window/showMessage', { type: 1 /* Error */, message: 'FOAM i18n: ' + e.message });
          respond(id, null);   // executeCommand's result is unspecified; errors surface via showMessage
        }).catch(function(e) {
          // Last resort: the reporting itself failed — a client that died
          // mid-command makes the stdout write throw (EPIPE), and an
          // unhandled rejection would take the whole server down with it.
          console.error('[LSP] executeCommand reporting failed:', e.message);
        });
        break;
      }

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

      case 'textDocument/prepareTypeHierarchy':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, null); break; }
        try {
          respond(id, typeHierarchyHandler.prepare(doc.text, params.position, params.textDocument.uri));
        } catch (e) {
          console.error('[LSP] prepareTypeHierarchy error:', e.message);
          respond(id, null);
        }
        break;

      case 'typeHierarchy/supertypes':
        try {
          respond(id, typeHierarchyHandler.supertypes(params.item));
        } catch (e) {
          console.error('[LSP] typeHierarchy/supertypes error:', e.message);
          respond(id, []);
        }
        break;

      case 'typeHierarchy/subtypes':
        try {
          respond(id, typeHierarchyHandler.subtypes(params.item));
        } catch (e) {
          console.error('[LSP] typeHierarchy/subtypes error:', e.message);
          respond(id, []);
        }
        break;

      case 'textDocument/implementation':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, []); break; }
        try {
          respond(id, implementationHandler.handle(doc.text, params.position, params.textDocument.uri));
        } catch (e) {
          console.error('[LSP] implementation error:', e.message);
          respond(id, []);
        }
        break;

      case 'textDocument/typeDefinition':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, null); break; }
        try {
          respond(id, typeDefinitionHandler.handle(doc.text, params.position, params.textDocument.uri));
        } catch (e) {
          console.error('[LSP] typeDefinition error:', e.message);
          respond(id, null);
        }
        break;

      case 'textDocument/diagnostic':
        // LSP 3.17 pull-diagnostic model. Caller asks for the diagnostics
        // of an arbitrary file without first didOpen-ing it. We read the
        // file fresh from disk so non-editor clients can query without a
        // document-open round trip.
        try {
          var dUri  = params.textDocument && params.textDocument.uri;
          if ( ! dUri ) { respond(id, { kind: 'full', items: [] }); break; }
          var dDoc  = documents[dUri];
          var dText = dDoc ? dDoc.text : null;
          if ( ! dText ) {
            var p = uriToPath_(dUri);
            if ( p ) {
              try { dText = require('fs').readFileSync(p, 'utf8'); } catch (re) {}
            }
          }
          if ( ! dText ) { respond(id, { kind: 'full', items: [] }); break; }
          var items;
          if ( isJrlFile(dUri) ) {
            items = jrlHandler.handleDiagnostics(dText, dUri);
          } else if ( isFoamFile(dText) ) {
            items = diagnosticsHandler.handle(dText, dUri);
          } else {
            items = [];
          }
          respond(id, { kind: 'full', items: items });
        } catch (e) {
          console.error('[LSP] textDocument/diagnostic error:', e.message);
          respond(id, { kind: 'full', items: [] });
        }
        break;

      case 'textDocument/prepareCallHierarchy':
        var doc = documents[params.textDocument.uri];
        if ( ! doc || ! isFoamFile(doc.text) ) { respond(id, null); break; }
        try {
          respond(id, callHierarchyHandler.prepare(doc.text, params.position, params.textDocument.uri));
        } catch (e) {
          console.error('[LSP] prepareCallHierarchy error:', e.message);
          respond(id, null);
        }
        break;

      case 'callHierarchy/incomingCalls':
        try {
          respond(id, callHierarchyHandler.incomingCalls(params.item));
        } catch (e) {
          console.error('[LSP] callHierarchy/incomingCalls error:', e.message);
          respond(id, []);
        }
        break;

      case 'callHierarchy/outgoingCalls':
        try {
          respond(id, callHierarchyHandler.outgoingCalls(params.item));
        } catch (e) {
          console.error('[LSP] callHierarchy/outgoingCalls error:', e.message);
          respond(id, []);
        }
        break;

      default:
        if ( id !== undefined ) {
          respondError(id, -32601, 'Method not found: ' + method);
        }
    }
    } finally {
      var elapsedMs = Number(process.hrtime.bigint() - timerStart) / 1e6;
      if ( method && elapsedMs >= LSP_TIMING_MIN_MS ) {
        console.error('[LSP] ⏱ ' + method + ' ' + elapsedMs.toFixed(1) + 'ms');
      }
    }
  }

  console.error('FOAM LSP server started. ' + index.getAllClassIds().length + ' classes indexed.');
}

module.exports = { start: start };
