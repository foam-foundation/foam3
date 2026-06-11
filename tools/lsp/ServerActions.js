/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure request-action logic extracted from server.js so it is unit-testable.
// Every function takes its dependencies (index, caches, handlers) as explicit
// parameters and closes over nothing — server.js's start() calls these through
// thin wrappers that pass its closure instances. Keeping the bodies here means
// the LSP folding / signature-help / code-action / similar-class logic can be
// exercised directly in tests instead of being re-implemented inline.

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

function getSignatureHelp(text, position, index, fileModelCache, opt_uri) {
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

function getCodeActions(text, range, context, index, uri, cssTokenResolver, diagnosticsHandler) {
  /**
   * Provides code actions for diagnostics:
   * - "Did you mean X?" for unknown class references
   * - "Replace with correct import" for wrong Java packages
   * - "Replace '#abc' with '$token'" for raw color values with a matching token
   * - "Extract '...' to a messages: entry" for hardcoded display strings (i18n)
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

    // For "Use single quotes" hints, offer a one-click fix that rewrites
    // the entire matched span ("foo.X") to single-quoted form ('foo.X').
    var dqMatch = diag.message.match(/Use single quotes for FOAM class references:\s*'([^']+)'/);
    if ( dqMatch ) {
      var inner = dqMatch[1];
      actions.push({
        title: "Convert to single quotes: '" + inner + "'",
        kind: 'quickfix',
        isPreferred: true,
        diagnostics: [diag],
        edit: {
          changes: {
            [uri]: [{
              range: diag.range,
              newText: "'" + inner + "'"
            }]
          }
        }
      });
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

    // For hardcoded display strings, offer "extract to messages: entry"
    if ( diag.code === 'i18n-hardcoded-display-string' ) {
      var hsMatch = diag.message.match(/Hardcoded display string "([^"]+)"/);
      if ( hsMatch ) {
        var i18nEdit = diagnosticsHandler.buildAddExtractEdit(text, hsMatch[1], uri, diag.range);
        if ( i18nEdit ) {
          actions.push({
            title: "Extract '" + hsMatch[1] + "' to a messages: entry",
            kind: 'quickfix',
            isPreferred: true,
            diagnostics: [diag],
            edit: i18nEdit
          });
        }
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

module.exports = {
  getFoldingRanges:   getFoldingRanges,
  getSignatureHelp:   getSignatureHelp,
  getCodeActions:     getCodeActions,
  findSimilarClasses: findSimilarClasses
};
