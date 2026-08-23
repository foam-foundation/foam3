/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'CodeLensHandler',

  documentation: `
    textDocument/codeLens: two independent, feature-toggled lenses over a
    single-model file.

      codeLens.i18n       — one lens per messages: entry missing a target
                            language, offering foam.i18n.translateMessage
                            for the missing languages. Delegates entirely to
                            I18nHandler.scanMissingLanguages (already gated
                            on translationReady and its own multi-model
                            guard) — this handler adds no scanning of its own.
      codeLens.hierarchy  — one lens per class naming its direct-subclass
                            count, read straight from FoamIndex.getSubclasses.
                            Informational BY DESIGN, not a placeholder:
                            command is '' because no client-side navigation
                            command exists to jump to a subclass list yet.
                            Follow-up shape: gate an editor.action.showReferences
                            (or equivalent) command behind the client's
                            declared command-execution capability, since it
                            would no-op outside VS Code.

    Both lenses bail out on a multi-model file (more than one top-level
    foam.CLASS()-family call) — there's no single unambiguous class to
    anchor a hierarchy lens on, and I18nHandler.scanMissingLanguages already
    refuses the same shape internally for the same reason. This handler's
    own guard reads it straight off FileModelCache's parsed models (no
    regex, no dependency on i18nHandler being wired at all).
  `,

  requires: [
    'foam.parse.lsp.CursorAnalyzer'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamIndex',
      name: 'index'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FileModelCache',
      name: 'cache'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.handlers.I18nHandler',
      name: 'i18nHandler',
      documentation: 'Optional (server.js wires it). Null-safe: with no ' +
        'i18nHandler the i18n lens is simply never offered, same as ' +
        'DiagnosticsHandler treats a missing one. The multi-model guard in ' +
        'handle() does NOT depend on this — it is independent of whether ' +
        'i18nHandler is wired.'
    },
    {
      name: 'featureConfig',
      documentation: 'Optional feature-toggle config from tools/lsp/FeatureConfig ' +
        '(server.js wires it). Plain Node object, not an FObject, so no `class:` ' +
        'here — same convention as DiagnosticsHandler.featureConfig. Null means ' +
        '"every check on", so a handler created bare in tests still offers both lenses.'
    }
  ],

  methods: [
    function featureOn_(flag) {
      /** True when `flag` is enabled, or when no featureConfig is wired at all. */
      return ! this.featureConfig || this.featureConfig.enabled(flag);
    },

    function handle(text, opt_uri) {
      if ( ! this.analyzer.isFoamFile(text) ) return [];

      var uri = opt_uri || '';
      var wantI18n      = !! this.i18nHandler && this.featureOn_('codeLens.i18n');
      var wantHierarchy = this.featureOn_('codeLens.hierarchy');
      if ( ! wantI18n && ! wantHierarchy ) return [];

      // Multi-model guard, independent of i18nHandler: more than one model
      // in the file (two foam.CLASS() blocks, an ENUM alongside a CLASS,
      // etc.) means no single class is THE class this file's lens should
      // anchor on. Read straight off FileModelCache's already-parsed models
      // — no regex, and no dependency on i18nHandler being wired (a
      // hierarchy-only caller with no i18nHandler must still get this).
      // I18nHandler.scanMissingLanguages_ separately guards its own
      // messages:-array-specific ambiguity (nested classes:, duplicated
      // messages: arrays) — that's a finer-grained i18n concern this check
      // doesn't need to replicate, since a duplicated messages: array or
      // nested classes: block inside a SINGLE foam.CLASS() call doesn't
      // create a second model here and doesn't affect where a hierarchy
      // lens anchors.
      var models = this.cache.getModels(uri, text);
      if ( models.length > 1 ) return [];

      var lenses = [];
      if ( wantI18n ) this.addI18nLenses_(uri, text, lenses);
      if ( wantHierarchy ) this.addHierarchyLenses_(models, lenses);
      return lenses;
    },

    function addI18nLenses_(uri, text, lenses) {
      /**
       * One lens per messages: entry with a missing-language gap — reuses
       * I18nHandler.scanMissingLanguages verbatim (position, gating on
       * translationReady, and the messageMapEditable_ check all come from
       * there), so this is purely a scan-result → lens/command mapping.
       */
      var missing = this.i18nHandler.scanMissingLanguages(uri, text);
      for ( var i = 0 ; i < missing.length ; i++ ) {
        var m = missing[i];
        var count = m.missing.length;
        lenses.push({
          range: m.range,
          command: {
            title:   count + ' translation' + ( count === 1 ? '' : 's' ) + ' missing',
            command: 'foam.i18n.translateMessage',
            // Same argument shape workspace/executeCommand hands to
            // I18nHandler.executeCommand: { uri, messageName, languages }.
            // `text` is deliberately absent — server.js fills it in from the
            // live document just before dispatching the command, same as it
            // does for the code-action-offered variant of this command.
            arguments: [{ uri: uri, messageName: m.name, languages: m.missing }]
          }
        });
      }
    },

    function addHierarchyLenses_(models, lenses) {
      /**
       * One lens per model in the file, anchored at the model's own
       * foam.CLASS() line (FileModelCache's sourceLine_ — no new regex),
       * naming its direct-subclass count (FoamIndex.getSubclasses — a
       * couple of ms). Deliberately NOT a reference count: referencing this
       * class through ReferencesHandler.referencesForClassId union-scans
       * four workspace usage indexes and was measured at 1.9-16.8s on a
       * heavily-referenced class — synchronous on the RPC loop and re-paid
       * on every save (those indexes invalidate on reindex), unacceptable
       * for something that runs on every codeLens request.
       *
       * Informational BY DESIGN: `command` is '' because no client-side
       * command exists yet to act on a subclass count. Follow-up shape: a
       * client-capability-gated editor.action.showReferences (or
       * equivalent) — see the class doc.
       */
      for ( var i = 0 ; i < models.length ; i++ ) {
        var model   = models[i];
        var classId = this.cache.getClassId(model);
        if ( ! classId ) continue;

        var line       = model.sourceLine_ || 0;
        var subclasses = this.index.getSubclasses(classId);

        lenses.push({
          range: {
            start: { line: line, character: 0 },
            end:   { line: line, character: 0 }
          },
          command: {
            title:   subclasses.length + ' subclass' + ( subclasses.length === 1 ? '' : 'es' ),
            command: ''
          }
        });
      }
    }
  ]
});
