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
                            on translationReady and the multi-model guard) —
                            this handler adds no scanning of its own.
      codeLens.hierarchy  — one lens per class naming its direct-subclass
                            and reference counts, read straight from
                            FoamIndex/ReferencesHandler. Informational only
                            (command: '' — no client-side navigation command
                            exists yet for it), so resolveProvider stays
                            false.

    Both lenses share the same multi-model bail-out as I18nHandler's own
    scanners (isMultiModelFile_): a file with more than one foam.CLASS(),
    a nested classes: block, or a duplicated messages: array has no single
    unambiguous class/messages position to anchor a lens on.
  `,

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.handlers.I18nHandler',
    'foam.parse.lsp.handlers.ReferencesHandler'
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
        'DiagnosticsHandler treats a missing one.'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.handlers.ReferencesHandler',
      name: 'referencesHandler',
      documentation: 'Optional (server.js wires it). Null-safe: with no ' +
        'referencesHandler the hierarchy lens still reports subclasses ' +
        '(FoamIndex-only) with a 0 reference count rather than throwing.'
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

      // Shared whole-file guard: a multi-model file (more than one
      // foam.CLASS(), a nested classes: block, or a duplicated messages:
      // array) has no single unambiguous class-name or messages: position
      // for either lens to anchor on — same reasoning as
      // I18nHandler.scanMissingLanguages_'s own guard, reused rather than
      // reimplemented.
      if ( this.i18nHandler && this.i18nHandler.isMultiModelFile_(text) ) return [];

      var lenses = [];
      if ( wantI18n ) this.addI18nLenses_(uri, text, lenses);
      if ( wantHierarchy ) this.addHierarchyLenses_(uri, text, lenses);
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

    function addHierarchyLenses_(uri, text, lenses) {
      /**
       * One lens per model in the file, anchored at the model's own
       * foam.CLASS() line (FileModelCache's sourceLine_ — no new regex).
       * Informational only: no client-side command exists yet to act on a
       * subclass/reference count, so `command` is the empty string, which
       * LSP clients render as a non-actionable label.
       */
      var models = this.cache.getModels(uri, text);
      for ( var i = 0 ; i < models.length ; i++ ) {
        var model   = models[i];
        var classId = this.cache.getClassId(model);
        if ( ! classId ) continue;

        var line       = model.sourceLine_ || 0;
        var subclasses = this.index.getSubclasses(classId);
        var refs       = this.referencesHandler ?
          this.referencesHandler.referencesForClassId(classId) : [];

        lenses.push({
          range: {
            start: { line: line, character: 0 },
            end:   { line: line, character: 0 }
          },
          command: {
            title: subclasses.length + ' subclass' + ( subclasses.length === 1 ? '' : 'es' ) +
              ' · ' + refs.length + ' ref' + ( refs.length === 1 ? '' : 's' ),
            command: ''
          }
        });
      }
    }
  ]
});
