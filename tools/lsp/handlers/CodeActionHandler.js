/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'CodeActionHandler',

  documentation: 'Quick-fix code actions for FOAM diagnostics: unknown-class suggestions, wrong Java package, raw-color → $token, single-quote conversion, hardcoded-display-string → messages: extraction, missing-language messageMap translation.',

  properties: [
    { name: 'index' },
    { name: 'cssTokenResolver' },
    { name: 'i18nHandler' }
  ],

  methods: [
    function handle(text, range, context, uri) {
      var actions = [];
      if ( ! context || ! context.diagnostics ) return actions;

      var self = this;
      var javaImportMappings = this.index.getJavaImportMappings();

      for ( var i = 0 ; i < context.diagnostics.length ; i++ ) {
        var diag = context.diagnostics[i];

        // "Unknown class" → suggest similar names
        var unknownMatch = diag.message.match(/Unknown class[^']*'([^']+)'/);
        if ( unknownMatch ) {
          var suggestions = self.findSimilarClasses_(unknownMatch[1], 3);
          for ( var s = 0 ; s < suggestions.length ; s++ ) {
            actions.push({
              title: "Did you mean '" + suggestions[s] + "'?",
              kind:  'quickfix',
              diagnostics: [diag],
              edit: { changes: this.makeEdit_(uri, diag.range, suggestions[s]) }
            });
          }
        }

        // "Use single quotes" → convert
        var dqMatch = diag.message.match(/Use single quotes for FOAM class references:\s*'([^']+)'/);
        if ( dqMatch ) {
          var inner = dqMatch[1];
          actions.push({
            title:       "Convert to single quotes: '" + inner + "'",
            kind:        'quickfix',
            isPreferred: true,
            diagnostics: [diag],
            edit: { changes: this.makeEdit_(uri, diag.range, "'" + inner + "'") }
          });
        }

        // Raw color → $token replacement
        var rawColorMatch = diag.message.match(/raw color[^']*'([^']+)'/);
        if ( rawColorMatch && this.cssTokenResolver ) {
          var raw   = rawColorMatch[1];
          var token = this.cssTokenResolver.findTokenForValue(raw);
          if ( token ) {
            actions.push({
              title:       "Replace '" + raw + "' with '$" + token + "'",
              kind:        'quickfix',
              isPreferred: true,
              diagnostics: [diag],
              edit: { changes: this.makeEdit_(uri, diag.range, '$' + token) }
            });
          }
        }

        // Hardcoded display string → extract to a messages: entry (i18n)
        if ( diag.code === 'i18n-hardcoded-display-string' && this.i18nHandler ) {
          var hsMatch = diag.message.match(/Hardcoded display string "([^"]+)"/);
          if ( hsMatch ) {
            var i18nEdit = this.i18nHandler.buildAddExtractEdit(text, hsMatch[1], uri, diag.range);
            if ( i18nEdit ) {
              actions.push({
                title:       "Extract '" + hsMatch[1] + "' to a messages: entry",
                kind:        'quickfix',
                isPreferred: true,
                diagnostics: [diag],
                edit: i18nEdit
              });
            }

            var i18nEditB = this.i18nHandler.buildAddExtractEdit(text, hsMatch[1], uri, diag.range, { withMessageMap: true });
            if ( i18nEditB ) {
              actions.push({
                title:       "Extract '" + hsMatch[1] + "' to messages: with messageMap",
                kind:        'quickfix',
                diagnostics: [diag],
                edit:        i18nEditB
              });
            }

            // Variant C: extract AND fill the messageMap with real
            // translations. Gated like action D — no reachable model or no
            // configured languages means the action would only ever fail, so
            // it isn't offered. Unlike A/B this carries no precomputed edit:
            // translating is async, so the edit is built when the command
            // runs (I18nHandler.executeCommand), re-anchored against the
            // file's text as it is at that moment.
            if ( this.i18nHandler.translationReady &&
                 ( this.i18nHandler.targetLanguages || [] ).length ) {
              var langsC = this.i18nHandler.targetLanguages;
              actions.push({
                title: "Extract '" + hsMatch[1] + "' + translate to " + langsC.join(', ') +
                       ' via ' + this.i18nHandler.activeModel,
                kind:  'quickfix',
                diagnostics: [diag],
                command: {
                  title:     'Extract and translate',
                  command:   'foam.i18n.extractAndTranslate',
                  arguments: [{ uri: uri, diagnosticRange: diag.range,
                                messageText: hsMatch[1], languages: langsC }]
                }
              });
            }
          }
        }

        // Missing-language messageMap gap → translate via the active provider
        // (edit-less command this task; Task 6 wires foam.i18n.translateMessage).
        if ( diag.code === 'i18n-missing-language' && this.i18nHandler && this.i18nHandler.translationReady ) {
          var nameM = diag.message.match(/Message "([^"]+)" has no ([^ ]+(?:, [^ ]+)*) translation/);
          if ( nameM ) {
            var langsD = nameM[2].split(', ');
            for ( var li = 0 ; li < langsD.length ; li++ ) {
              actions.push({
                title: "Translate '" + nameM[1] + "' to " + langsD[li] + ' via ' + this.i18nHandler.activeModel,
                kind:  'quickfix',
                diagnostics: [diag],
                command: {
                  title:     'Translate',
                  command:   'foam.i18n.translateMessage',
                  arguments: [{ uri: uri, messageName: nameM[1], languages: [langsD[li]] }]
                }
              });
            }
            if ( langsD.length > 1 ) {
              actions.push({
                title: "Translate '" + nameM[1] + "' to all missing languages via " + this.i18nHandler.activeModel,
                kind:  'quickfix', diagnostics: [diag],
                command: { title: 'Translate', command: 'foam.i18n.translateMessage',
                           arguments: [{ uri: uri, messageName: nameM[1], languages: langsD }] }
              });
            }
          }
        }

        // Wrong Java import package → replace
        var wrongPkgMatch = diag.message.match(/Wrong Java package[^']*'([^']+)'/);
        if ( wrongPkgMatch ) {
          var wrongPkg = wrongPkgMatch[1];
          if ( javaImportMappings[wrongPkg] ) {
            actions.push({
              title:       "Replace with '" + javaImportMappings[wrongPkg] + "'",
              kind:        'quickfix',
              isPreferred: true,
              diagnostics: [diag],
              edit: { changes: this.makeEdit_(uri, diag.range, javaImportMappings[wrongPkg]) }
            });
          }
        }
      }

      return actions;
    },

    function makeEdit_(uri, range, newText) {
      var edits = {};
      edits[uri] = [{ range: range, newText: newText }];
      return edits;
    },

    function findSimilarClasses_(target, maxResults) {
      var targetShort = target.split('.').pop().toLowerCase();
      var ids         = this.index.getAllClassIds();
      var scored      = [];

      for ( var i = 0 ; i < ids.length ; i++ ) {
        var shortName = ids[i].split('.').pop().toLowerCase();
        if ( shortName === targetShort ) {
          scored.push({ id: ids[i], score: 100 });
        } else if ( shortName.indexOf(targetShort) !== -1 || targetShort.indexOf(shortName) !== -1 ) {
          scored.push({ id: ids[i], score: 50 });
        } else {
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
  ]
});
