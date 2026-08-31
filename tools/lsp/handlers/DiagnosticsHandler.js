/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'DiagnosticsHandler',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.FoamClassGrammar',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.Diagnostic',
    'foam.parse.lsp.handlers.JavaBlockValidator'
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
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamClassGrammar',
      name: 'grammar',
      factory: function() { return this.FoamClassGrammar.create({ index: this.index }); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.handlers.JavaBlockValidator',
      name: 'javaValidator',
      factory: function() { return this.JavaBlockValidator.create({ index: this.index }); }
    },
    {
      name: 'prevResults_',
      documentation: 'Cache of previous diagnostics per URI for incremental updates.',
      factory: function() { return {}; }
    },
    {
      class: 'String',
      name: 'uri_',
      documentation: 'URI of the file currently being diagnosed; read by i18n validators for test/demo-file exemption.'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CSSTokenResolver',
      name: 'cssTokenResolver'
    },
    {
      name: 'validTypes_',
      factory: function() {
        var types = {};
        var propTypes = this.index.getPropertyTypes();
        for ( var i = 0 ; i < propTypes.length ; i++ ) {
          types[propTypes[i].name] = true;
          types[propTypes[i].id] = true;
        }
        return types;
      }
    }
  ],

  methods: [
    function handle(text, opt_uri) {
      if ( ! this.analyzer.isFoamFile(text) ) return [];

      var uri = opt_uri || '';
      this.uri_ = uri;
      var models = this.cache.getModels(uri, text);
      var diagnostics = [];
      var prev = this.prevResults_[uri];

      for ( var i = 0 ; i < models.length ; i++ ) {
        var m = models[i];
        var modelKey = (this.cache.getClassId(m)) + '_' + (m.sourceLine_ || 0);

        // Incremental: reuse previous diagnostics if model hasn't changed
        if ( prev && prev.modelKeys && prev.modelKeys[modelKey] && prev.text === text ) {
          var cached = prev.modelKeys[modelKey];
          for ( var j = 0 ; j < cached.length ; j++ ) diagnostics.push(cached[j]);
        } else {
          var modelDiags = [];
          this.validateModel_(m, text, modelDiags);
          for ( var j = 0 ; j < modelDiags.length ; j++ ) diagnostics.push(modelDiags[j]);
          if ( ! prev ) prev = { text: text, modelKeys: {} };
          prev.modelKeys[modelKey] = modelDiags;
        }
      }

      // Hardcoded display strings in .add() — scanned once over the whole file
      // (not per model) so multi-class files locate each occurrence natively.
      this.validateAddStrings_(text, diagnostics);

      // Parser-emitted diagnostics — single grammar pass covers all class-ref
      // and property-type positions (extends/requires/of/implements and
      // class: '…'). Positions come straight from parser offsets, no regex.
      this.collectGrammarDiagnostics_(text, diagnostics);

      // Enum / primitive literal values inside X.create({})/.tag(this.X,{}).
      // Whole-file scan (like validateAddStrings_); detection via the grammar.
      this.validateInstantiations_(text, diagnostics);

      this.prevResults_[uri] = { text: text, modelKeys: prev ? prev.modelKeys : {} };
      return this.toLSPDiagnostics_(diagnostics);
    },

    function collectGrammarDiagnostics_(text, diagnostics) {
      /**
       * Consume msg-tagged records from grammar parse. For each record,
       * decide whether to emit a Diagnostic based on the msg type and the
       * matched text. All positions come from parser offsets — no regex.
       */
      var records = this.grammar.collectDiagnostics(text);
      for ( var i = 0 ; i < records.length ; i++ ) {
        var r = records[i];
        var matched = text.substring(r.startPos, r.endPos);
        if ( ! matched ) continue;

        if ( r.msg && r.msg.type === 'unknownClassRef' ) {
          if ( ! this.classKnown_(matched) ) {
            this.addDiag_(diagnostics, text, r.startPos, matched.length, 2,
              "Unknown class: '" + matched + "'");
          }
        } else if ( r.msg && r.msg.type === 'doubleQuotedClassRef' ) {
          // FOAM convention is single-quoted class refs. Parse the value
          // anyway (lenient) but surface a hint with the corrected form so
          // the CodeAction in server.js can offer a one-click fix.
          // `matched` here is the WHOLE "..." span including the quotes.
          var inner = matched.replace(/^"/, '').replace(/"$/, '');
          this.addDiag_(diagnostics, text, r.startPos, matched.length, 4,
            "Use single quotes for FOAM class references: '" + inner + "'");
        } else if ( r.msg && r.msg.type === 'unknownPropType' ) {
          if ( ! this.validTypes_[matched] && ! this.classKnown_(matched) ) {
            this.addDiag_(diagnostics, text, r.startPos, matched.length, 3,
              "Unknown property type: '" + matched + "'");
          }
        } else if ( r.msg && ( r.msg.type === 'tableColumnName' ||
                               r.msg.type === 'searchColumnName' ) ) {
          // Cross-reference with the enclosing model's axioms. tableColumns
          // entries may also name actions — rendered as row buttons
          // (foam.u2.table.UnstyledTableView filters getAxiomsByClass(Action)
          // against tableColumns). searchColumns filters properties only.
          var pos = this.analyzer.offsetToPosition(text, r.startPos);
          var model = this.cache.getModelAt('', text, pos.line);
          if ( ! model ) continue;
          var propSet = this.collectPropNames_(model);
          // Column names can be dot paths ('owner.name') — check first segment
          var baseName = matched.split('.')[0];
          var isTable = r.msg.type === 'tableColumnName';
          if ( ! propSet[baseName] &&
               ! ( isTable && this.collectActionNames_(model)[baseName] ) ) {
            var classId = this.cache.getClassId(model);
            this.addDiag_(diagnostics, text, r.startPos, matched.length, 2,
              ( isTable ? "Property or action '" : "Property '" ) + matched +
                "' does not exist on " + classId);
          }
        }
      }
    },

    function validateInstantiations_(text, diagnostics) {
      /** Validate enum/primitive LITERAL values in X.create({})/.tag(this.X,{}).
       *  Detection is grammar-driven (collectInstantiations). Comments never
       *  reach here — the grammar's lineComment arm consumes them before the
       *  instantiationCall arm. Expressions/slots/identifiers are skipped;
       *  only quoted strings, numbers, and true/false are checked. */
      var insts = this.grammar.collectInstantiations(text);
      for ( var i = 0 ; i < insts.length ; i++ ) {
        var inst = insts[i];
        var line = this.analyzer.offsetToPosition(text, inst.callSpan.startPos).line;
        var classId = this.cache.resolveShortName(this.uri_ || '', text, inst.classText, line) || inst.classText;
        if ( ! this.index.classExists(classId) ) continue;

        for ( var e = 0 ; e < inst.entries.length ; e++ ) {
          var entry = inst.entries[e];
          if ( ! entry.valueText || ! entry.valuePos ) continue;
          var v = entry.valueText;
          var c0 = v.charAt(0);
          var isStr  = c0 === "'" || c0 === '"';
          var isNum  = c0 === '-' || ( c0 >= '0' && c0 <= '9' );
          var isBool = v === 'true' || v === 'false';
          if ( ! isStr && ! isNum && ! isBool ) continue;   // literals only

          var info = this.index.getPropertyInfo(classId, entry.key);
          if ( ! info.found ) continue;
          var off = entry.valuePos.startPos;
          var len = entry.valuePos.endPos - entry.valuePos.startPos;

          if ( info.isEnum ) {
            if ( ! isStr ) continue;
            var inner = v.slice(1, -1);
            if ( inner === '' ) continue;   // empty = unfilled/mid-edit, not an error
            var names = info.enumValues.map(function(x) { return x.name; });
            if ( names.indexOf(inner) === -1 ) {
              this.addDiag_(diagnostics, text, off, len, 2,
                "'" + inner + "' is not a valid " + info.enumId + " value. Expected: " + names.join(', '));
            }
          } else if ( info.primitiveKind === 'int' || info.primitiveKind === 'float' ) {
            if ( isStr ) {
              this.addDiag_(diagnostics, text, off, len, 2,
                "'" + entry.key + "' expects a numeric value, got a string literal");
            }
          } else if ( info.primitiveKind === 'boolean' ) {
            if ( isStr || isNum ) {
              this.addDiag_(diagnostics, text, off, len, 2,
                "'" + entry.key + "' expects a boolean (true/false)");
            }
          }
        }
      }
    },

    function collectPropNames_(model) {
      /** Property-name set for a model: registry props + own raw props. */
      var propNames = {};
      var classId = this.cache.getClassId(model);
      var props = this.index.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) propNames[props[i].name] = true;
      if ( props.length === 0 && model.extends ) {
        var parentProps = this.index.getProperties(model.extends);
        for ( var i = 0 ; i < parentProps.length ; i++ ) propNames[parentProps[i].name] = true;
      }
      var ownProps = model.properties || [];
      for ( var i = 0 ; i < ownProps.length ; i++ ) {
        var p = ownProps[i];
        var name = typeof p === 'string' ? p : p.name;
        if ( name ) propNames[name] = true;
      }
      return propNames;
    },

    function collectActionNames_(model) {
      /** Action-name set for a model: registry actions + own raw actions.
       *  Mirrors collectPropNames_ — parent fallback covers mid-edit models
       *  not yet in the registry. */
      var actionNames = {};
      var classId = this.cache.getClassId(model);
      var actions = this.index.getActions(classId);
      for ( var i = 0 ; i < actions.length ; i++ ) actionNames[actions[i].name] = true;
      if ( actions.length === 0 && model.extends ) {
        var parentActions = this.index.getActions(model.extends);
        for ( var i = 0 ; i < parentActions.length ; i++ ) actionNames[parentActions[i].name] = true;
      }
      var ownActions = model.actions || [];
      for ( var i = 0 ; i < ownActions.length ; i++ ) {
        var a = ownActions[i];
        var name = typeof a === 'function' ? a.name : a && a.name;
        if ( name ) actionNames[name] = true;
      }
      return actionNames;
    },

    function toLSPDiagnostics_(diagnostics) {
      /** Flatten Diagnostic instances to LSP protocol shape; pass raws through. */
      if ( ! diagnostics ) return diagnostics;
      var out = new Array(diagnostics.length);
      for ( var i = 0 ; i < diagnostics.length ; i++ ) {
        var d = diagnostics[i];
        out[i] = ( d && typeof d.toLSP === 'function' ) ? d.toLSP() : d;
      }
      return out;
    },

    function validateModel_(m, text, diagnostics) {
      // LIB objects are not classes — skip all class-level validators.
      if ( m && m.type_ === 'LIB' ) return;

      var classId = this.cache.getClassId(m);

      // Unknown class (extends/requires/of/implements) and unknown property-type
      // diagnostics come from collectGrammarDiagnostics_ — not repeated here.

      // Validate Java blocks
      this.javaValidator.validateModel(m, classId, diagnostics, text);

      // Validate CSS token references
      this.validateCSS_(m, text, diagnostics);

      // Validate tableColumns/searchColumns
      // tableColumns/searchColumns validation is now emitted from the grammar's
      // columnName rule via P.msg — see collectGrammarDiagnostics_.

      // Validate raw CSS values
      this.validateRawCSSValues_(m, text, diagnostics);

      // Warn about ^classname rules in css: that aren't applied from JS
      this.validateUnusedCSSClasses_(m, text, diagnostics);

      // Validate expression parameters
      this.validateExpressions_(m, text, diagnostics);

      // i18n hardcoded .add() strings are scanned once per file in handle()
      // (validateAddStrings_), not here — they need whole-file scoping.
    },

    function validateAddStrings_(text, diagnostics) {
      /**
       * WARNING when a hardcoded user-facing string literal is passed to .add()
       * in a view's render code. Unlike declarative property/action labels (which
       * foam/i18n/scripts.jrl auto-extracts by name), in-body .add('...') text is
       * extracted by nothing and ships untranslated.
       *
       * Scans the raw file text directly (once per file, not per model) so every
       * occurrence is located at its own native offset — no cross-class collision,
       * and a per-line `i18n-ignore` only affects its own occurrence. Matches inside
       * comments are skipped so commented-out .add() calls aren't flagged.
       *
       * Intentionally NOT matched: .start('tag') (structural, not display text)
       * and .translate('...') (already on the translation-service path — its
       * literals sit one nesting level down, so the top-level scan skips them).
       */
      if ( this.isI18nExemptUri_(this.uri_) ) return;       // test/demo/mock files exempt

      var skip = this.nonCodeRanges_(text);
      var re = /\.add\(/g;
      var match;
      while ( ( match = re.exec(text) ) !== null ) {
        if ( this.offsetInRanges_(skip, match.index) ) continue;   // comment / Java / string block → skip
        if ( this.isCollectionAddReceiver_(text, match.index) ) continue; // Set/Map .add(), not u2 display
        // Every literal at the TOP nesting level of the argument list —
        // direct (.add('x')), ternary arms, and '+' concatenation pieces all
        // sit at that level (issue #5135: conditional args escaped the old
        // literal-must-follow-the-paren regex). Literals inside nested
        // calls/objects (.create({label:'x'}), .translate('k','v')) don't.
        var lits = this.addArgLiterals_(text, skip, match.index + match[0].length);
        for ( var li = 0 ; li < lits.length ; li++ ) {
          var quote = text[lits[li][0]];
          var inner = lits[li][0] + 1;                               // past the opening quote
          var content = text.substring(inner, lits[li][1] - 1);
          if ( quote === '`' && /\$\{/.test(content) ) continue;     // interpolated → dynamic
          if ( ! this.isUserFacingText_(content) ) continue;
          if ( this.lineHasI18nIgnore_(text, inner) ) continue;      // per-line suppression
          this.addDiag_(diagnostics, text, inner, content.length, this.Diagnostic.WARNING,
            'Hardcoded display string "' + content + '" — define it as a messages: entry ' +
              '(in-body .add() text is not auto-extracted for i18n).',
            'i18n-hardcoded-display-string');
        }
      }
    },

    function addArgLiterals_(text, ranges, argStart) {
      /**
       * Collect [start,end) spans of the string literals sitting at the top
       * nesting level of an argument list whose opening '(' immediately
       * precedes argStart. `ranges` is nonCodeRanges_ output (sorted): its
       * string entries at depth 1 ARE the literals; comment entries are
       * jumped over so brackets inside comments don't skew the depth. Stops
       * at the matching ')' or end of text (unterminated — mid-edit).
       */
      var out = [];
      var depth = 1;
      var i = argStart, n = text.length, ri = 0;
      while ( i < n && depth > 0 ) {
        while ( ri < ranges.length && ranges[ri][1] <= i ) ri++;
        if ( ri < ranges.length && ranges[ri][0] === i ) {
          var r = ranges[ri];
          var q = text[r[0]];
          if ( depth === 1 && ( q === "'" || q === '"' || q === '`' ) ) out.push(r);
          i = r[1];
          continue;
        }
        var c = text[i];
        if ( c === '(' || c === '{' || c === '[' ) depth++;
        else if ( c === ')' || c === '}' || c === ']' ) depth--;
        i++;
      }
      return out;
    },

    function isCollectionAddReceiver_(text, dotOffset) {
      /**
       * True when the `.add(` at dotOffset is a Set/Map collection add rather than a
       * u2 display add. Display adds are either chained off an element builder
       * (`.start(...).add(...)` → preceded by `)`), on this/self, or on an element
       * variable. A collection receiver is a bare identifier that is ALSO used with
       * `.delete(`/`.has(` or assigned `new Set/Map` — Set/Map APIs u2 Elements lack.
       * Content can't tell 'type' (display) from 'scheduled' (collection) — receiver can.
       */
      if ( text[dotOffset - 1] === ')' ) return false;     // chained off an element call → u2
      var j = dotOffset - 1;
      while ( j >= 0 && /[\w$]/.test(text[j]) ) j--;
      var receiver = text.substring(j + 1, dotOffset);
      if ( ! receiver || receiver === 'this' || receiver === 'self' ) return false;
      var r = this.escapeRegex_(receiver);
      if ( new RegExp('\\b' + r + '\\s*\\.\\s*(?:delete|has)\\s*\\(').test(text) ) return true;
      if ( new RegExp('\\b' + r + '\\s*=\\s*new\\s+(?:Set|Map|WeakSet|WeakMap)\\b').test(text) ) return true;
      return false;
    },

    function nonCodeRanges_(text) {
      /**
       * Single pass over `text` collecting [start,end) ranges of // line comments,
       * /* block comments, AND string/template literals. The .add() scanner skips
       * matches inside these so it ignores (a) commented-out code and (b) .add()
       * calls embedded in non-JS string blocks — Java (`javaCode: '... list.add(..)'`),
       * doc strings, backtick templates — flagging only real JS-code .add() calls.
       * String state is tracked so a `//` inside a string (e.g. a URL) is not a comment.
       */
      var ranges = [];
      var i = 0, n = text.length, str = null, strStart = -1;
      while ( i < n ) {
        var c = text[i];
        if ( str ) {
          if ( c === '\\' ) { i += 2; continue; }
          if ( c === str ) { ranges.push([ strStart, i + 1 ]); str = null; }
          i++; continue;
        }
        if ( c === '"' || c === "'" || c === '`' ) { str = c; strStart = i; i++; continue; }
        if ( c === '/' && text[i + 1] === '/' ) {
          var e = text.indexOf('\n', i); if ( e === -1 ) e = n;
          ranges.push([ i, e ]); i = e; continue;
        }
        if ( c === '/' && text[i + 1] === '*' ) {
          var e2 = text.indexOf('*/', i + 2); e2 = e2 === -1 ? n : e2 + 2;
          ranges.push([ i, e2 ]); i = e2; continue;
        }
        i++;
      }
      return ranges;
    },

    function offsetInRanges_(ranges, offset) {
      for ( var i = 0 ; i < ranges.length ; i++ ) {
        if ( offset >= ranges[i][0] && offset < ranges[i][1] ) return true;
      }
      return false;
    },

    function isUserFacingText_(s) {
      /**
       * Conservative "looks like a word" test. Flags prose/words; skips all-caps
       * codes, single chars, and pure symbol/digit strings. Shared by the label
       * (HINT) and in-body .add() (WARNING) validators.
       */
      if ( ! s || typeof s !== 'string' ) return false;
      if ( /^#?[0-9a-fA-F]{3,8}$/.test(s) ) return false;  // hex color ('#fff', 'aabbcc')
      if ( /^[\d.]+(px|em|rem|%|vh|vw|vmin|vmax|pt|s|ms|deg|fr|ch|ex)$/i.test(s) ) return false; // CSS unit value
      // programmatic identifier / key with no spaces — e.g. 'superuser.enable',
      // 'foam.core.X' (dotted between word chars). Excludes permission/collection
      // adds. Keeps prose ('Upload Complete') and ellipsis ('Processing...').
      if ( ! /\s/.test(s) && /[A-Za-z0-9_$]\.[A-Za-z0-9_$]/.test(s) ) return false;
      if ( ! /[a-z]/.test(s) ) return false;       // needs a lowercase letter → skips 'ID','API','Y','OK'
      if ( ! /[A-Za-z]{2}/.test(s) ) return false; // needs 2+ consecutive letters → skips symbols/digits
      return true;
    },

    function isI18nExemptUri_(uri) {
      /**
       * True for files where i18n diagnostics are noise: test/demo/mock sources.
       * Framework and product views are NOT exempt.
       */
      if ( ! uri ) return false;
      if ( /(?:^|\/)(?:test|tests|demos|mock|mocks)\//i.test(uri) ) return true;
      if ( /Test\.js$/.test(uri) ) return true;
      if ( /Mock[^\/]*\.js$/.test(uri) ) return true;
      return false;
    },

    function lineHasI18nIgnore_(text, offset) {
      /**
       * True when the source line containing `offset` carries an `i18n-ignore`
       * marker (e.g. a trailing `// i18n-ignore` comment) — per-line opt-out.
       */
      var start = text.lastIndexOf('\n', offset) + 1;
      var end = text.indexOf('\n', offset);
      if ( end === -1 ) end = text.length;
      return text.substring(start, end).indexOf('i18n-ignore') !== -1;
    },

    function constantizeMessageName_(s, opt_taken) {
      /** 'Upload Complete' -> 'UPLOAD_COMPLETE_MSG'; safe, unique FOAM message
       *  constant. The _MSG suffix keeps the generated constant out of the
       *  property/action namespace — a 'fileName' property already installs a
       *  FILE_NAME constant, so extracting the label 'File Name' to a bare
       *  FILE_NAME would clash. opt_taken is the set of names already defined on
       *  the model; on any remaining clash a numeric suffix is appended until
       *  free (FILE_NAME_MSG, FILE_NAME_MSG2, ...). */
      var up = String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if ( ! up ) up = 'MESSAGE';
      if ( /^[0-9]/.test(up) ) up = 'M_' + up;     // an identifier can't start with a digit
      var base = up + '_MSG';
      if ( ! opt_taken ) return base;
      var name = base, n = 2;
      while ( opt_taken[name] ) name = base + (n++);
      return name;
    },

    function collectAxiomConstants_(text, uri) {
      /** Names already defined as constant-style members on the file's single
       *  model, so an extracted message name can dodge them. Holds the CONSTANT
       *  form of every own + inherited property and action (FOAM installs a
       *  FILE_NAME constant for a 'fileName' property) plus existing message /
       *  constant names (already constant-cased). */
      var taken = {};
      var models = this.cache.getModels(uri || '', text);
      if ( ! models || ! models.length ) return taken;
      var model = models[0];
      var nameOf   = function(x) { return typeof x === 'string' ? x : ( x && x.name ); };
      var addConst = function(nm) { if ( nm ) taken[foam.String.constantize(nm)] = true; };
      var addRaw   = function(nm) { if ( nm ) taken[nm] = true; };

      var props = model.properties || [];
      for ( var i = 0 ; i < props.length ; i++ ) addConst(nameOf(props[i]));
      var acts = model.actions || [];
      for ( var i = 0 ; i < acts.length ; i++ ) addConst(nameOf(acts[i]));
      var msgs = model.messages || [];
      for ( var i = 0 ; i < msgs.length ; i++ ) addRaw(nameOf(msgs[i]));

      var consts = model.constants;
      if ( Array.isArray(consts) ) {
        for ( var i = 0 ; i < consts.length ; i++ ) addRaw(nameOf(consts[i]));
      } else if ( consts && typeof consts === 'object' ) {
        for ( var k in consts ) if ( Object.prototype.hasOwnProperty.call(consts, k) ) addRaw(k);
      }

      // Inherited properties — best effort; getProperties returns [] when the
      // class isn't registered (incomplete file mid-edit).
      var inherited = this.index.getProperties(this.cache.getClassId(model));
      if ( inherited ) {
        for ( var i = 0 ; i < inherited.length ; i++ ) addConst(inherited[i].name);
      }
      return taken;
    },

    function findAddLiteral_(text, messageText) {
      /** Locate `.add('messageText')` and return the {start,end} span of the
       *  quoted literal (quotes included), or null. */
      var re = new RegExp("\\.add\\(\\s*(['\"`])" + this.escapeRegex_(messageText) + "\\1");
      var m = re.exec(text);
      if ( ! m ) return null;
      var quoteRel = m[0].indexOf(m[1]);          // opening quote within the match
      var litStart = m.index + quoteRel;
      var litEnd = litStart + 1 + messageText.length + 1;  // open + text + close
      return { start: litStart, end: litEnd };
    },

    function literalSpanFromRange_(text, range) {
      /** {start, end, content} of the quoted literal for the occurrence the diagnostic
       *  range points at. The range covers the inner text (no quotes): the opening quote
       *  is one char before range.start and the closing quote is at range.end. Reading
       *  content straight from source (range as the source of truth) is robust to
       *  embedded quotes — unlike re-deriving length from a (possibly message-truncated)
       *  string. Returns null if the quotes don't line up. */
      if ( ! range || ! range.start || ! range.end ) return null;
      var innerStart = this.analyzer.positionToOffset(text, range.start);
      var innerEnd   = this.analyzer.positionToOffset(text, range.end);
      var open = innerStart - 1;
      if ( open < 0 || innerEnd <= innerStart || innerEnd >= text.length ) return null;
      var q = text[open];
      if ( q !== "'" && q !== '"' && q !== '`' ) return null;   // not a quoted literal here
      if ( text[innerEnd] !== q ) return null;                  // closing quote must match
      return { start: open, end: innerEnd + 1, content: text.substring(innerStart, innerEnd) };
    },

    function buildAddExtractEdit(text, messageText, uri, opt_range) {
      /**
       * Build the "extract to messages: entry" WorkspaceEdit for a hardcoded
       * .add('<messageText>') string: rewrite the usage to `this.<NAME>` and add
       * a `{ name, message }` entry (into an existing messages: array, or a new
       * one). Returns { changes: { [uri]: [edits] } } or null.
       *
       * opt_range (the triggering diagnostic's LSP range) pins the rewrite to the
       * exact occurrence — without it, a repeated identical string would rewrite the
       * first match. Falls back to the first .add() match only when no range is given.
       *
       * Scope safety: bail (null) unless there is exactly one top-level model and an
       * unambiguous single insertion target. Multiple `foam.CLASS(`, inline `classes:`,
       * or more than one `properties:`/`messages:` block → ambiguous → no autofix.
       *
       * Limitations:
       * - Diagnostics can appear in multi-model files, but the extract code action is
       *   intentionally disabled there; inserting `messages:` into the right model
       *   requires model-boundary parsing, not whole-file regexes.
       * - Inline inner `classes:` are skipped for the same reason: `messages:` or
       *   `properties:` could belong to either the outer model or an inner class.
       * - If the diagnostic range no longer lines up with the quoted literal, no edit is
       *   returned rather than risking a rewrite at the wrong occurrence.
       */
      var classMatches = text.match(/foam\.CLASS\s*\(/g);
      if ( ! classMatches || classMatches.length !== 1 ) return null;
      // Ambiguous nesting → the "first" messages:/properties: may belong to an inner class.
      if ( /\bclasses\s*:\s*\[/.test(text) ) return null;
      if ( ( text.match(/\bproperties\s*:\s*\[/g) || [] ).length > 1 ) return null;
      if ( ( text.match(/\bmessages\s*:\s*\[/g)   || [] ).length > 1 ) return null;

      // With a range, read the literal (and its content) straight from source — the
      // range is authoritative and handles embedded quotes; the passed messageText may
      // be truncated by the caller's message-reparse. Without a range, fall back to the
      // first .add() match of messageText.
      var usage, content;
      if ( opt_range ) {
        usage = this.literalSpanFromRange_(text, opt_range);
        if ( ! usage ) return null;
        content = usage.content;
      } else {
        usage = this.findAddLiteral_(text, messageText);
        if ( ! usage ) return null;
        content = messageText;
      }

      var name = this.constantizeMessageName_(content, this.collectAxiomConstants_(text, uri));
      var edits = [];

      // Rewrite the usage: 'messageText' -> this.NAME
      edits.push({
        range: {
          start: this.analyzer.offsetToPosition(text, usage.start),
          end:   this.analyzer.offsetToPosition(text, usage.end)
        },
        newText: 'this.' + name
      });

      // Add the messages entry. Reuse the verbatim source literal (quotes + already-
      // valid escaping) for the message: value — re-escaping the raw captured content
      // would double-escape an existing `\'` and produce invalid JS.
      var rawLiteral = text.substring(usage.start, usage.end);
      var entry = "{ name: '" + name + "', message: " + rawLiteral + " }";
      var msgArr = /messages\s*:\s*\[/.exec(text);
      if ( msgArr ) {
        var insAt = msgArr.index + msgArr[0].length;          // just after '['
        var p = this.analyzer.offsetToPosition(text, insAt);
        edits.push({ range: { start: p, end: p }, newText: '\n    ' + entry + ',' });
      } else {
        var ins = this.findNewMessagesInsertion_(text, entry);
        if ( ! ins ) return null;
        var p2 = this.analyzer.offsetToPosition(text, ins.offset);
        edits.push({ range: { start: p2, end: p2 }, newText: ins.newText });
      }

      var changes = {};
      changes[uri] = edits;
      return { changes: changes };
    },

    function findNewMessagesInsertion_(text, entry) {
      /**
       * Pick where to insert a brand-new `messages: [...]` block. Preference:
       *   1. Right before the FIRST top-level block — properties:/methods:/listeners:/
       *      actions:. This sits after the declarative header (package/name/extends/
       *      requires/imports) and before any body, so it never lands inside a method
       *      body object literal.
       *   2. Else after the last header key — requires/imports (arrays) or
       *      package/name/extends (strings).
       *   3. Else right after `foam.CLASS({`.
       * Returns { offset, newText } for a zero-width insert, or null.
       */
      // 1. Before the first properties:/methods:/listeners:/actions: block.
      // First match (not last) → the top-level block, never a body-nested key.
      var pm = /(^|\n)([ \t]*)(?:properties|methods|listeners|actions)\s*:/.exec(text);
      if ( pm ) {
        var indent = pm[2];
        var lineStart = pm.index + pm[1].length;   // start of that line's indent
        return {
          offset: lineStart,
          newText: indent + 'messages: [\n' + indent + '  ' + entry + '\n' + indent + '],\n'
        };
      }

      // 2. After the last header key
      var endOff = -1, endIndent = '  ';
      var strRe = /(^|\n)([ \t]*)(package|name|extends)\s*:\s*'[^']*'\s*,?/g, sm;
      while ( ( sm = strRe.exec(text) ) !== null ) {
        var e = sm.index + sm[0].length;
        if ( e > endOff ) { endOff = e; endIndent = sm[2]; }
      }
      var arrKeys = ['requires', 'imports'];
      for ( var k = 0 ; k < arrKeys.length ; k++ ) {
        var am = new RegExp('(^|\\n)([ \\t]*)' + arrKeys[k] + '\\s*:\\s*\\[').exec(text);
        if ( ! am ) continue;
        var i = am.index + am[0].length - 1;       // at the '['
        var depth = 0;
        for ( ; i < text.length ; i++ ) {
          if ( text[i] === '[' ) depth++;
          else if ( text[i] === ']' ) { depth--; if ( depth === 0 ) { i++; break; } }
        }
        if ( text[i] === ',' ) i++;                // include trailing comma
        if ( i > endOff ) { endOff = i; endIndent = am[2]; }
      }
      if ( endOff !== -1 ) {
        return {
          offset: endOff,
          newText: '\n' + endIndent + 'messages: [\n' + endIndent + '  ' + entry + '\n' + endIndent + '],'
        };
      }

      // 3. After foam.CLASS({
      var clsOpen = /foam\.CLASS\s*\(\s*\{/.exec(text);
      if ( ! clsOpen ) return null;
      var o = clsOpen.index + clsOpen[0].length;
      return { offset: o, newText: '\n  messages: [\n    ' + entry + '\n  ],' };
    },

    function validateCSS_(model, text, diagnostics) {
      /**
       * Validate $token references inside css: template strings.
       * Reports unknown CSS token names as warnings.
       * Tokens declared in the model's own cssTokens: [...] array or
       * inherited from the extends chain are recognized as valid.
       */
      if ( ! this.cssTokenResolver ) return;

      var cssStr = model.css;
      if ( ! cssStr || typeof cssStr !== 'string' ) return;

      var baseOffset = text.indexOf(cssStr);
      if ( baseOffset === -1 ) return;

      var localTokens = this.collectLocalCssTokens_(model);

      // Match the full chain — `$base`, then 0+ `$suffix` segments — so
      // ColorToken-installed suffixes like `$primary400$foreground` validate
      // as a single name rather than splitting into `$primary400` (known)
      // and `$foreground` (unknown).
      var tokenPattern = /\$([a-zA-Z][a-zA-Z0-9_\-]*(?:\$[a-zA-Z][a-zA-Z0-9_\-]*)*)/g;
      var tm;
      while ( ( tm = tokenPattern.exec(cssStr) ) !== null ) {
        var tokenName = tm[1];
        if ( localTokens[tokenName] ) continue;
        if ( ! this.cssTokenResolver.tokenExists(tokenName) ) {
          this.addDiag_(diagnostics, text, baseOffset + tm.index, tm[0].length, 2,
            "Unknown CSS token: '$" + tokenName + "'");
        }
      }
    },

    function collectLocalCssTokens_(model) {
      /**
       * Build a set of CSS token names declared on the model itself or
       * inherited from its extends chain. Walks up `extends` via the index;
       * unknown ancestors are silently skipped.
       */
      var set = Object.create(null);
      var addFrom = function(tokens) {
        if ( ! tokens || ! tokens.length ) return;
        for ( var i = 0 ; i < tokens.length ; i++ ) {
          var t = tokens[i];
          if ( t && t.name ) set[t.name] = true;
        }
      };
      addFrom(model.cssTokens);

      var parentId = model.extends;
      var guard = 0;
      while ( parentId && guard++ < 32 ) {
        var parentCls = this.index.getClass(parentId);
        if ( ! parentCls || ! parentCls.model_ ) break;
        addFrom(parentCls.model_.cssTokens);
        parentId = parentCls.model_.extends;
      }
      return set;
    },

    function validateRawCSSValues_(m, text, diagnostics) {
      /**
       * Warn when raw color values are used where CSS tokens should be.
       * Checks css: template strings and color properties on enum values.
       * Consistent with CSSAuditTest.js detection patterns.
       */
      var colorProps = /(?:^|[;{}\s])\s*(color|background(?:-color)?|border(?:-color)?|border-(?:top|bottom|left|right)(?:-color)?|outline-color)\s*:\s*([^;}\n$]+)/g;
      var rawColorValue = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(/;
      var localTokenValues = this.collectLocalCssTokenValueMap_(m);

      // Check css: template string
      var cssStr = m.css;
      if ( cssStr && typeof cssStr === 'string' ) {
        var baseOffset = text.indexOf(cssStr);
        if ( baseOffset !== -1 ) {
          var match;
          while ( ( match = colorProps.exec(cssStr) ) !== null ) {
            var valueStr = match[2].trim();
            if ( rawColorValue.test(valueStr) ) {
              var rawMatch = valueStr.match(/#[0-9a-fA-F]{3,8}|rgba?\s*\([^)]*\)|hsla?\s*\([^)]*\)/);
              var rawVal = rawMatch ? rawMatch[0] : valueStr;
              var offset = baseOffset + match.index + match[0].indexOf(valueStr);
              this.addDiag_(diagnostics, text, offset, rawVal.length, 2,
                this.rawColorMessage_(rawVal, localTokenValues));
            }
          }
        }
      }

      // Check enum values with color properties
      var values = m.values || [];
      for ( var i = 0 ; i < values.length ; i++ ) {
        var v = values[i];
        if ( ! v || typeof v !== 'object' ) continue;
        var colorVal = v.color || v.background;
        if ( colorVal && typeof colorVal === 'string' && rawColorValue.test(colorVal) ) {
          var loc = this.findInText_(text, 'color', colorVal, 0);
          if ( loc === null ) loc = this.findInText_(text, 'background', colorVal, 0);
          if ( loc !== null ) {
            this.addDiag_(diagnostics, text, loc, colorVal.length, 2,
              this.rawColorMessage_(colorVal, localTokenValues));
          }
        }
      }
    },

    function collectLocalCssTokenValueMap_(model) {
      /**
       * Map of normalized color value → local token name, for reverse lookup.
       * Only string-valued tokens are included — function/$-reference values
       * can't be resolved without the runtime.
       */
      var map = {};
      var normalize = function(v) {
        if ( ! v || typeof v !== 'string' ) return null;
        var s = v.trim().toLowerCase();
        var m3 = s.match(/^#([0-9a-f]{3})$/);
        if ( m3 ) {
          var c = m3[1];
          return '#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        }
        return s;
      };
      var addFrom = function(tokens) {
        if ( ! tokens || ! tokens.length ) return;
        for ( var i = 0 ; i < tokens.length ; i++ ) {
          var t = tokens[i];
          if ( ! t || ! t.name ) continue;
          var n = normalize(t.value);
          if ( n && ! map[n] ) map[n] = t.name;
        }
      };
      addFrom(model.cssTokens);
      var parentId = model.extends;
      var guard = 0;
      while ( parentId && guard++ < 32 ) {
        var cls = this.index.getClass(parentId);
        if ( ! cls || ! cls.model_ ) break;
        addFrom(cls.model_.cssTokens);
        parentId = cls.model_.extends;
      }
      return map;
    },

    function validateUnusedCSSClasses_(model, text, diagnostics) {
      /**
       * Flag ^classname rules in css: that no JS code applies via
       * this.myClass('name') / myClass("name") / myClass(`name`).
       *
       * Suppressed entirely when any call site passes a non-literal
       * argument to myClass(…) — too many false positives when class
       * names are computed (e.g. myClass(state), myClass(this.tag)).
       */
      var cssStr = model.css;
      if ( ! cssStr || typeof cssStr !== 'string' ) return;
      var baseOffset = text.indexOf(cssStr);
      if ( baseOffset === -1 ) return;

      // Collect ^name tokens that look like class selectors (letter-start).
      var defs = {};
      var order = [];
      var declPattern = /\^([a-zA-Z][a-zA-Z0-9_\-]*)/g;
      var dm;
      while ( ( dm = declPattern.exec(cssStr) ) !== null ) {
        var n = dm[1];
        if ( defs[n] ) continue;
        defs[n] = { offset: baseOffset + dm.index, len: dm[0].length };
        order.push(n);
      }
      if ( order.length === 0 ) return;

      // Build haystack from methods/listeners/actions source.
      var hay = '';
      var collect = function(arr) {
        if ( ! arr ) return;
        for ( var i = 0 ; i < arr.length ; i++ ) {
          var s = arr[i];
          if ( ! s ) continue;
          if ( typeof s === 'function' ) { hay += '\n' + s.toString(); continue; }
          if ( typeof s.code === 'function' ) { hay += '\n' + s.code.toString(); continue; }
          if ( typeof s.code === 'string' )   { hay += '\n' + s.code; continue; }
          if ( typeof s.isAvailable === 'function' ) hay += '\n' + s.isAvailable.toString();
        }
      };
      collect(model.methods);
      collect(model.listeners);
      collect(model.actions);

      // If myClass(...) is ever called with something other than a quoted
      // literal, we can't be sure — skip the whole diagnostic.
      var dynamicCall = /myClass\s*\(\s*(?!['"`])/;
      if ( dynamicCall.test(hay) ) return;

      for ( var i = 0 ; i < order.length ; i++ ) {
        var name = order[i];
        var re = new RegExp("myClass\\s*\\(\\s*['\"`]" + this.escapeRegex_(name) + "['\"`]\\s*\\)");
        if ( re.test(hay) ) continue;
        this.addDiag_(diagnostics, text, defs[name].offset, defs[name].len, 2,
          "Unused CSS class '^" + name + "': no matching this.myClass('" + name + "') call");
      }
    },

    function escapeRegex_(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    function rawColorMessage_(rawVal, opt_localTokenValues) {
      /**
       * Build a raw-color diagnostic message that names the matching CSS
       * token when one exists. Checks local tokens first, then the global
       * resolver. No match → honest "no token matches" message.
       */
      if ( opt_localTokenValues ) {
        var needle = rawVal ? rawVal.trim().toLowerCase() : '';
        var m3 = needle.match(/^#([0-9a-f]{3})$/);
        if ( m3 ) {
          var c = m3[1];
          needle = '#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        }
        var localName = opt_localTokenValues[needle];
        if ( localName ) {
          return "Prefer CSS token '$" + localName + "' over raw color '" + rawVal + "'";
        }
      }
      if ( this.cssTokenResolver ) {
        var token = this.cssTokenResolver.findTokenForValue(rawVal);
        if ( token ) {
          return "Prefer CSS token '$" + token + "' over raw color '" + rawVal + "'";
        }
      }
      return "Raw color '" + rawVal + "' — no matching CSS token in the registry";
    },

    function validateExpressions_(m, text, diagnostics) {
      /**
       * Validate expression function parameters are real property names.
       * Handles trailing $ (slot access), deep $ chains (block$flowParent$value),
       * inner classes (classes: [...]), and multi-model files.
       *
       * Builds property scopes — one for the outer model, one per inner class —
       * each with a text range. For each expression match, finds the narrowest
       * enclosing scope and validates against that scope's properties.
       */
      var classId = this.cache.getClassId(m);
      var modelOffset = m.sourceLine_ ? this.analyzer.positionToOffset(text, { line: m.sourceLine_, character: 0 }) : 0;

      // Determine end of this model's text
      var nextModelRegex = new RegExp(this.analyzer.FOAM_CALL_REGEX.source, 'g');
      nextModelRegex.lastIndex = modelOffset + 1;
      var nextMatch = nextModelRegex.exec(text);
      var modelEnd = nextMatch ? nextMatch.index : text.length;
      var modelText = text.substring(modelOffset, modelEnd);

      // Build property scopes: outer model + each inner class
      var scopes = [];
      scopes.push(this.buildPropScope_(classId, m, 0, modelText.length));

      // Inner classes get their own scopes with text ranges
      var innerClasses = m.classes || [];
      for ( var ic = 0 ; ic < innerClasses.length ; ic++ ) {
        var inner = innerClasses[ic];
        var innerName = inner.name || ('InnerClass' + ic);
        var innerClassId = classId + '.' + innerName;

        // Find inner class text range within modelText
        var innerRange = this.findInnerClassRange_(modelText, innerName);
        scopes.push(this.buildPropScope_(innerClassId, inner,
          innerRange ? innerRange.start : 0,
          innerRange ? innerRange.end : modelText.length));
      }

      // Find expression: function(...) patterns within this model's text
      var exprRegex = /expression\s*:\s*function\s*\(([^)]*)\)/g;
      var match;
      while ( ( match = exprRegex.exec(modelText) ) !== null ) {
        var paramsStr = match[1].trim();
        if ( ! paramsStr ) continue;

        // Find the narrowest enclosing scope for this expression
        var exprPos = match.index;
        var scope = this.findEnclosingScope_(scopes, exprPos);

        var params = paramsStr.split(/\s*,\s*/);
        var paramsOffset = modelOffset + match.index + match[0].indexOf(paramsStr);

        var currentOffset = paramsOffset;
        for ( var i = 0 ; i < params.length ; i++ ) {
          var param = params[i].trim();
          if ( ! param ) { currentOffset += params[i].length + 1; continue; }

          var paramOffset = text.indexOf(param, currentOffset);
          if ( paramOffset === -1 ) paramOffset = currentOffset;
          currentOffset = paramOffset + param.length + 1;

          // Strip trailing $ (slot access)
          var cleanParam = param;
          if ( cleanParam.charAt(cleanParam.length - 1) === '$' ) cleanParam = cleanParam.substring(0, cleanParam.length - 1);

          // Split on $ for deep paths
          var segments = cleanParam.split('$');
          var firstSegment = segments[0];

          // Skip non-property-like params
          if ( /^[_$]$/.test(firstSegment) || firstSegment === 'x' || firstSegment === 'data' ||
               firstSegment === 'self' || firstSegment === 'this' ) continue;

          // Validate first segment against scope properties
          if ( ! scope.propNames[firstSegment] ) {
            this.addDiag_(diagnostics, text, paramOffset, param.length, 2,
              "Property '" + firstSegment + "' does not exist on " + scope.classId);
            continue;
          }

          // Walk the chain for deep paths
          if ( segments.length > 1 ) {
            var currentClassId = this.index.resolvePropertyTypeClassId(scope.classId, firstSegment);
            for ( var s = 1 ; s < segments.length ; s++ ) {
              if ( ! currentClassId ) break;
              var segment = segments[s];
              var segProps = this.index.getProperties(currentClassId);
              var segFound = false;
              for ( var sp = 0 ; sp < segProps.length ; sp++ ) {
                if ( segProps[sp].name === segment ) { segFound = true; break; }
              }

              if ( ! segFound ) {
                var segOffset = text.indexOf(segment, paramOffset);
                if ( segOffset === -1 ) segOffset = paramOffset;
                this.addDiag_(diagnostics, text, segOffset, segment.length, 2,
                  "Property '" + segment + "' does not exist on " + currentClassId);
                break;
              }

              currentClassId = this.index.resolvePropertyTypeClassId(currentClassId, segment);
            }
          }
        }
      }
    },

    function buildPropScope_(classId, modelObj, rangeStart, rangeEnd) {
      /**
       * Build a property scope: { classId, propNames, start, end }.
       * Collects names that are valid as `expression:` / `postSet:` / etc.
       * parameters — i.e., anything accessible on `this.`: own + inherited
       * properties, plus imports (which FOAM exposes on `this` too).
       */
      var propNames = {};

      // Registry properties (own + inherited)
      var props = this.index.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) propNames[props[i].name] = true;

      // If class not registered, try parent
      if ( props.length === 0 && modelObj.extends ) {
        var parentProps = this.index.getProperties(modelObj.extends);
        for ( var i = 0 ; i < parentProps.length ; i++ ) propNames[parentProps[i].name] = true;
      }

      // Raw model properties
      var ownProps = modelObj.properties || [];
      for ( var i = 0 ; i < ownProps.length ; i++ ) {
        var p = ownProps[i];
        var name = typeof p === 'string' ? p : p.name;
        if ( name ) propNames[name] = true;
      }

      // Imports — `imports: [ 'visualizationWidth', 'ctrl?' ]` are all exposed
      // on `this` at runtime so they're valid expression params too.
      var imps = modelObj.imports || [];
      for ( var i = 0 ; i < imps.length ; i++ ) {
        var imp = imps[i];
        var iname = typeof imp === 'string' ? imp : (imp && imp.name);
        if ( ! iname ) continue;
        // handle aliases `'a as b'` and optional `'x?'`
        var asIdx = iname.indexOf(' as ');
        if ( asIdx !== -1 ) iname = iname.substring(asIdx + 4).trim();
        iname = iname.replace(/\?$/, '').trim();
        if ( iname ) propNames[iname] = true;
      }

      // Constants — `constants: { NAME: 'X' }` or `constants: [{ name: 'X' }]`
      var consts = modelObj.constants;
      if ( consts ) {
        if ( Array.isArray(consts) ) {
          for ( var i = 0 ; i < consts.length ; i++ ) {
            var c = consts[i];
            var cn = typeof c === 'string' ? c : (c && c.name);
            if ( cn ) propNames[cn] = true;
          }
        } else if ( typeof consts === 'object' ) {
          for ( var cn in consts ) {
            if ( Object.prototype.hasOwnProperty.call(consts, cn) ) propNames[cn] = true;
          }
        }
      }

      return { classId: classId, propNames: propNames, start: rangeStart, end: rangeEnd };
    },

    function findInnerClassRange_(modelText, className) {
      /**
       * Find the text range of an inner class definition within the model text.
       * Returns { start, end } offsets or null.
       */
      var namePattern = new RegExp("name\\s*:\\s*['\"]" + className + "['\"]");
      var nameMatch = namePattern.exec(modelText);
      if ( ! nameMatch ) return null;

      // Walk backward from name match to find the opening {
      var start = nameMatch.index;
      for ( var i = start ; i >= 0 ; i-- ) {
        if ( modelText.charAt(i) === '{' ) { start = i; break; }
      }

      // Walk forward to find the closing } at the same depth
      var depth = 0;
      var end = modelText.length;
      for ( var i = start ; i < modelText.length ; i++ ) {
        var ch = modelText.charAt(i);
        if ( ch === '{' ) depth++;
        else if ( ch === '}' ) {
          depth--;
          if ( depth === 0 ) { end = i + 1; break; }
        }
        // Skip strings
        else if ( ch === "'" || ch === '"' || ch === '`' ) {
          for ( i++ ; i < modelText.length ; i++ ) {
            if ( modelText.charAt(i) === '\\' ) { i++; continue; }
            if ( modelText.charAt(i) === ch ) break;
          }
        }
      }

      return { start: start, end: end };
    },

    function findEnclosingScope_(scopes, position) {
      /**
       * Find the narrowest scope that contains the given position.
       * Inner class scopes are narrower than the outer model scope.
       */
      var best = scopes[0]; // outer model is always the fallback
      for ( var i = 1 ; i < scopes.length ; i++ ) {
        var s = scopes[i];
        if ( position >= s.start && position < s.end ) {
          // Prefer narrower scope
          if ( (s.end - s.start) < (best.end - best.start) ) {
            best = s;
          }
        }
      }
      return best;
    },

    function classKnown_(classId) {
      /**
       * Check if a class is known — registered in FOAM runtime OR in the
       * POM file index. The file index includes all files from the POM walk
       * with the current flags, so flag-filtered classes (test, swift, etc.)
       * are correctly excluded unless the user enables those flags.
       */
      return this.index.classExists(classId) || this.index.getFilePath(classId) != null;
    },

    function findInText_(text, key, value, opt_startOffset) {
      /** Find the offset of a value string in text, optionally near a key. */
      var escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var searchStr = key ? key + "\\s*:\\s*['\"]" + escaped : "['\"]" + escaped;
      var regex = new RegExp(searchStr, 'g');
      if ( opt_startOffset ) regex.lastIndex = opt_startOffset;
      var match = regex.exec(text);
      if ( ! match ) return null;
      return match.index + match[0].indexOf(value);
    },

    function addDiag_(diagnostics, text, offset, length, severity, message, opt_code) {
      var pos = this.analyzer.offsetToPosition(text, offset);
      diagnostics.push(this.Diagnostic.create({
        range: {
          start: pos,
          end: { line: pos.line, character: pos.character + length }
        },
        severity: severity,
        message: message,
        code: opt_code
      }));
    }
  ]
});
