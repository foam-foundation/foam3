/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'JrlHandler',

  documentation: 'Hover and semantic tokens for FOAM journal (.jrl) files. JRL files contain p({...}), c({...}), r({...}) calls with FOAM model objects.',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.CursorAnalyzer'
  ],

  constants: {
    JAVA_EMBED_KEYS_: {
      javaCode: true, javaFactory: true, javaGetter: true, javaSetter: true,
      javaPreSet: true, javaPostSet: true, javaAdapt: true, javaCompare: true,
      javaComparePropertyToObject: true, javaComparePropertyToValue: true,
      javaCloneProperty: true, javaDiffProperty: true,
      javaFormatJSON: true, javaJSONParser: true, javaCSVParser: true,
      javaQueryParser: true, javaToCSV: true, javaToCSVLabel: true,
      javaFromCSVLabelMapping: true, javaAssertValue: true,
      javaValidateObj: true, javaCondition: true, javaValue: true,
      javaImports: true, code: true, serviceScript: true
    }
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
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    },
    {
      name: 'journalClassMap_',
      documentation: 'Map of journal filename → FOAM class ID, built from services.jrl files.',
      factory: function() { return {}; }
    }
  ],

  methods: [
    function isJrlFile(uri) {
      return uri && uri.endsWith('.jrl');
    },

    function buildJournalClassMap() {
      /**
       * Scan services.jrl files for setJournalName/setOf pairings.
       * Builds map: journalName → FOAM class ID.
       * Called once at startup.
       */
      var fs_ = require('fs');
      var path_ = require('path');
      var map = {};

      // Find all services.jrl files via POM locations
      var poms = foam.poms || [];
      for ( var p = 0 ; p < poms.length ; p++ ) {
        var loc = poms[p].location || '';
        var svcPath = path_.resolve(loc, 'services.jrl');
        if ( ! fs_.existsSync(svcPath) ) continue;

        try {
          var content = fs_.readFileSync(svcPath, 'utf8');
          // Find setJournalName + setOf pairs (they appear close together)
          var journalName = null;
          var lines = content.split('\n');
          for ( var i = 0 ; i < lines.length ; i++ ) {
            var jnMatch = lines[i].match(/\.setJournalName\s*\(\s*"(\w+)"\s*\)/);
            if ( jnMatch ) journalName = jnMatch[1];

            var ofMatch = lines[i].match(/\.setOf\s*\(\s*([\w.]+)\.getOwnClassInfo\s*\(\s*\)\s*\)/);
            if ( ofMatch && journalName ) {
              map[journalName] = ofMatch[1];
              journalName = null;
            }
          }
        } catch (e) {}
      }

      // Also scan sub-project services.jrl files
      this.walkServiceFiles_(map, fs_, path_);

      this.journalClassMap_ = map;
      return map;
    },

    function walkServiceFiles_(map, fs_, path_) {
      /** Walk the file index to find services.jrl files not in POM locations. */
      var fileIndex = this.index.fileIndex_;
      if ( ! fileIndex ) return;
      var seenDirs = {};
      for ( var classId in fileIndex ) {
        var entry = fileIndex[classId];
        var filePath = entry.path || entry;
        var dir = path_.dirname(filePath);
        if ( seenDirs[dir] ) continue;
        seenDirs[dir] = true;
        var svcPath = path_.resolve(dir, 'services.jrl');
        if ( ! fs_.existsSync(svcPath) ) continue;
        try {
          var content = fs_.readFileSync(svcPath, 'utf8');
          var journalName = null;
          var lines = content.split('\n');
          for ( var i = 0 ; i < lines.length ; i++ ) {
            var jnMatch = lines[i].match(/\.setJournalName\s*\(\s*"(\w+)"\s*\)/);
            if ( jnMatch ) journalName = jnMatch[1];
            var ofMatch = lines[i].match(/\.setOf\s*\(\s*([\w.]+)\.getOwnClassInfo\s*\(\s*\)\s*\)/);
            if ( ofMatch && journalName ) {
              map[journalName] = ofMatch[1];
              journalName = null;
            }
          }
        } catch (e) {}
      }
    },

    function resolveClassForJrl(uri, entry) {
      /**
       * Resolve the FOAM class for a JRL entry.
       * 1. If entry has "class" field, use it directly
       * 2. Otherwise, look up the JRL filename in journalClassMap_
       */
      if ( entry && entry['class'] ) return entry['class'];

      // Extract filename from URI: file:///path/to/journals/threddCardAuthorizations.jrl → threddCardAuthorizations
      if ( uri ) {
        var parts = uri.split('/');
        var filename = parts[parts.length - 1].replace('.jrl', '');
        return this.journalClassMap_[filename] || null;
      }
      return null;
    },

    function handleHover(text, position, opt_uri) {
      var lines = text.split('\n');
      var line = lines[position.line] || '';

      // Embedded block hover — for BOTH serviceScript (language-agnostic
      // Java/JS-ish code) and client (FObject JSON): extract the dotted
      // identifier under the cursor and resolve it to a registered class.
      // If the full dotted word isn't a class (e.g. `foo.X.Builder` where
      // only `foo.X` is registered), progressively trim trailing segments
      // until we hit a known class or run out — single predictable path,
      // covers member-access chains, JSON-quoted class ids, and escaped
      // values uniformly.
      var embedCtx = this.detectEmbeddedBlockContext_(text, position);
      if ( embedCtx ) {
        var hit = this.resolveDottedClassUnderCursor_(embedCtx);
        if ( hit ) return { contents: { kind: 'markdown', value: hit } };
        return null;
      }

      // Try single-line first, then multi-line
      var entry = this.parseJrlEntry_(line);
      if ( ! entry ) {
        var found = this.findEntryAtLine_(text, position.line);
        if ( found ) entry = found.entry;
      }
      if ( ! entry ) return null;

      // Resolve class: nearest class context (handles nested objects)
      var classId = this.resolveNearestClass_(text, position.line, opt_uri, entry);
      var cls = classId ? this.index.getClass(classId) : null;

      // Hover on p/c/r/v command
      var cmdMatch = line.match(/^\s*(?:\w+\.)?(p|c|r|v)\s*\(/);
      if ( cmdMatch ) {
        var cmdStart = line.indexOf(cmdMatch[1]);
        if ( position.character >= cmdStart && position.character <= cmdStart + cmdMatch[1].length ) {
          var cmdDocs = {
            p: '**p** (Put / Update)\n\nUpdate an existing record in the DAO. If a record with the same ID exists, it is merged with the new values. If no record exists, it is created.\n\nUsed in data journals for persisting FObject state.',
            c: '**c** (Create)\n\nCreate a new record in the DAO. Unlike `p`, this always creates a new entry and does not merge with existing records.\n\nCommonly used in `services.jrl` to define DAO configurations and service CSpecs.',
            r: '**r** (Remove)\n\nRemove a record from the DAO by its ID.\n\nThe object only needs the `id` field to identify which record to remove.',
            v: '**v** (Version)\n\nSet the journal version number for schema migration tracking.\n\nWhen the journal version changes, FOAM can run migration logic to update persisted data.'
          };
          return { contents: { kind: 'markdown', value: cmdDocs[cmdMatch[1]] || '' } };
        }
      }

      // Find what's under the cursor — pass entry so it works for multi-line
      var col = position.character;
      var segment = this.getSegmentAt_(line, col, entry);
      if ( ! segment ) return null;

      // Hover on "class" value → show class info
      if ( segment.value === classId ) {
        if ( ! cls ) return null;
        var m = cls.model_;
        var md = '**' + m.id + '**\n\n';
        if ( m.extends && m.extends !== 'FObject' ) md += 'extends `' + m.extends + '`\n\n';
        if ( m.documentation ) md += m.documentation + '\n\n';
        return { contents: { kind: 'markdown', value: md } };
      }

      // Hover on a property name → show type info
      // Handles both full names (processDate) and shortNames (an → accountNo)
      if ( segment.isKey && cls ) {
        var prop = this.resolveProperty_(cls, segment.value);
        if ( prop ) {
          var typeName = prop.cls_ && prop.cls_.model_ ? prop.cls_.model_.name : 'Property';
          var isShort = prop.name !== segment.value;
          var md = isShort
            ? '**' + prop.name + '** → `' + segment.value + '`\n\n'
            : '**' + segment.value + '**\n\n';
          if ( prop.label ) md += 'Label: **' + prop.label + '**\n\n';
          md += 'Type: `' + typeName + '`\n\n';
          if ( prop.documentation ) md += prop.documentation + '\n\n';
          return { contents: { kind: 'markdown', value: md } };
        }
      }

      // Hover on a value → check if it's a timestamp on a Date property
      if ( segment.isValue && segment.key && cls ) {
        var prop = this.resolveProperty_(cls, segment.key);
        if ( prop ) {
          var typeName = prop.cls_ && prop.cls_.model_ ? prop.cls_.model_.name : '';
          var propLabel = prop.label || prop.name;
          if ( (typeName === 'Date' || typeName === 'DateTime' || typeName === 'DateTimeUTC') && typeof segment.rawValue === 'number' ) {
            var formatted = this.formatTimestamp_(segment.rawValue);
            var md = '**' + propLabel + '**: `' + formatted + '`\n\n';
            md += 'Type: ' + typeName + '\n\nRaw: ' + segment.rawValue;
            return { contents: { kind: 'markdown', value: md } };
          }
        }
      }

      return null;
    },

    function handleSemanticTokens(text) {
      /**
       * JRL semantic tokens complement the TextMate/tree-sitter grammar by
       * emitting registry-verified highlights the grammar cannot reach:
       *   • Verified `"class":"…"` values (top-level and inside embedded JSON)
       *   • Dotted class IDs inside embedded Java blocks (serviceScript,
       *     javaCode, javaFactory, etc.)
       *   • Dotted class IDs inside escaped-in-double-quote client strings
       *
       * Token types: 0=type, 1=class, 2=variable, 3=keyword, 4=string,
       * 5=comment, 6=number, 7=operator, 8=method.
       */
      var tokens = [];
      this.collectClassValueTokens_(text, tokens);
      this.collectEmbeddedBlockTokens_(text, tokens);

      tokens.sort(function(a, b) {
        return a.line !== b.line ? a.line - b.line : a.char - b.char;
      });
      return this.encodeTokens_(tokens);
    },

    function collectClassValueTokens_(text, tokens) {
      /** Line-by-line scan for "class":"…" and class:"…" verified values. */
      var lines = text.split('\n');
      for ( var lineNum = 0 ; lineNum < lines.length ; lineNum++ ) {
        var line = lines[lineNum];
        if ( ! line.trim() || /^\s*\/\//.test(line) ) continue;

        var classRegex = /(?:"class"|(?<=[{,])\s*class)\s*:\s*(?:"([^"]+)"|'([^']+)')/g;
        var cm;
        while ( ( cm = classRegex.exec(line) ) !== null ) {
          var classVal = cm[1] || cm[2];
          if ( classVal && this.index.classExists(classVal) ) {
            var valIdx = line.indexOf(classVal, cm.index);
            if ( valIdx !== -1 ) {
              tokens.push({ line: lineNum, char: valIdx, length: classVal.length, type: 1, modifiers: 0 });
            }
          }
        }
      }
    },

    function collectEmbeddedBlockTokens_(text, tokens) {
      /**
       * Walk every embedded value block in the file and emit tokens for
       * registry-verified identifiers inside. Handles:
       *   1. Triple-quoted values:  "key": """…"""
       *   2. Backtick values:        "key": `…`
       *   3. Escaped-in-double-quote values: "key": "…"   (for client only)
       *
       * Dispatch by key:
       *   • Java keys (serviceScript, javaCode, …)    → Java tokenization
       *   • `client`                                  → JSON tokenization
       */
      var blocks = this.findEmbeddedBlocks_(text);
      for ( var i = 0 ; i < blocks.length ; i++ ) {
        var b = blocks[i];
        if ( this.JAVA_EMBED_KEYS_[b.key] ) {
          this.collectJavaEmbedTokens_(text, b, tokens);
        } else if ( b.key === 'client' ) {
          this.collectJsonEmbedTokens_(text, b, tokens);
        }
      }
    },

    function findEmbeddedBlocks_(text) {
      /**
       * Scan the full text for every triple-quote and backtick embedded
       * value. Returns array of { key, contentStart, contentEnd, delim }
       * where delim is '"""' or '`'. Skips `//` line comments.
       *
       * Approach: find `"key":` then the opening delimiter right after.
       * Matches BOTH quoted-key (`"javaCode"`) and unquoted-key (`javaCode`).
       */
      var out = [];
      var keyDelimRe = /(?:"([a-zA-Z_][\w$]*)"|([a-zA-Z_][\w$]*))\s*:\s*("""|`)/g;
      var m;
      while ( ( m = keyDelimRe.exec(text) ) !== null ) {
        var key = m[1] || m[2];
        if ( ! key ) continue;
        var delim = m[3];
        var openStart = m.index + m[0].length - delim.length;
        var contentStart = openStart + delim.length;
        var contentEnd = text.indexOf(delim, contentStart);
        if ( contentEnd === -1 ) break;
        out.push({ key: key, contentStart: contentStart, contentEnd: contentEnd, delim: delim });
        keyDelimRe.lastIndex = contentEnd + delim.length;
      }

      // Escaped-in-double-quote form: `"client": "…"` where inner quotes
      // are `\"`. Only honor `client` (FObject JSON); serviceScript also
      // uses this form but we leave Java highlighting to grammar injection
      // there since escaping makes it hard to detect reliably.
      var escRe = /"(client)"\s*:\s*"(?!"")((?:\\.|[^"\\\n])*)"/g;
      var em;
      while ( ( em = escRe.exec(text) ) !== null ) {
        var vStart = em.index + em[0].length - em[2].length - 1;
        out.push({
          key: em[1],
          contentStart: vStart + 1,
          contentEnd: vStart + 1 + em[2].length,
          delim: '"',
          escaped: true
        });
      }
      return out;
    },

    function collectJavaEmbedTokens_(text, block, tokens) {
      /**
       * Emit `type` tokens (0) for dotted class IDs and short class names
       * that the registry resolves. Registry-verified only — no hardcoded
       * list. The surrounding grammar handles Java keyword / string /
       * comment highlighting; we add what the grammar can't know:
       * which identifiers are actually FOAM classes.
       */
      var content = text.substring(block.contentStart, block.contentEnd);
      var lineOffsets = this.computeLineOffsets_(text);

      // Dotted identifier — a.b.c.D — followed by optional `.getOwnClassInfo`
      var dottedRe = /\b([a-z][\w$]*(?:\.[a-zA-Z_][\w$]*)+)\b/g;
      var dm;
      while ( ( dm = dottedRe.exec(content) ) !== null ) {
        var id = dm[1];
        var hit = this.resolveRegisteredPrefix_(id);
        if ( ! hit ) continue;
        this.pushTokenAt_(tokens, block.contentStart + dm.index, hit.length, 0, lineOffsets);
      }
    },

    function collectJsonEmbedTokens_(text, block, tokens) {
      /**
       * Emit `class` tokens (1) for registry-verified `"class":"…"` values
       * inside an embedded JSON block. If the block is escaped-in-double-
       * quote form, `\"class\":\"…\"` — handle both literal and escaped.
       */
      var content = text.substring(block.contentStart, block.contentEnd);
      var lineOffsets = this.computeLineOffsets_(text);

      // Literal: "class":"com.foo.Bar"
      var litRe = /"class"\s*:\s*"([^"\n]+)"/g;
      var lm;
      while ( ( lm = litRe.exec(content) ) !== null ) {
        var cid = lm[1];
        if ( ! this.index.classExists(cid) ) continue;
        var valIdx = content.indexOf(cid, lm.index);
        if ( valIdx === -1 ) continue;
        this.pushTokenAt_(tokens, block.contentStart + valIdx, cid.length, 1, lineOffsets);
      }

      // Escaped: \"class\":\"com.foo.Bar\"
      var escRe = /\\"class\\"\s*:\s*\\"([^"\\\n]+)\\"/g;
      var em;
      while ( ( em = escRe.exec(content) ) !== null ) {
        var ecid = em[1];
        if ( ! this.index.classExists(ecid) ) continue;
        var eIdx = content.indexOf(ecid, em.index);
        if ( eIdx === -1 ) continue;
        this.pushTokenAt_(tokens, block.contentStart + eIdx, ecid.length, 1, lineOffsets);
      }
    },

    function resolveRegisteredPrefix_(dottedId) {
      /**
       * Given `foo.X.Builder`, return the longest prefix that exists in the
       * FOAM registry. Returns { length } (char length of the matched
       * prefix) or null.
       */
      if ( ! dottedId ) return null;
      var cand = dottedId;
      while ( cand ) {
        if ( this.index.classExists(cand) ) return { length: cand.length };
        var dot = cand.lastIndexOf('.');
        if ( dot === -1 ) return null;
        cand = cand.substring(0, dot);
      }
      return null;
    },

    function computeLineOffsets_(text) {
      /** Pre-computed line-start offsets for fast offset → {line,char}. */
      var offs = [0];
      for ( var i = 0 ; i < text.length ; i++ ) {
        if ( text.charCodeAt(i) === 10 ) offs.push(i + 1);
      }
      return offs;
    },

    function pushTokenAt_(tokens, offset, length, type, lineOffsets) {
      /** Binary-search offset → line/char and push a semantic token. */
      var lo = 0, hi = lineOffsets.length - 1;
      while ( lo < hi ) {
        var mid = (lo + hi + 1) >> 1;
        if ( lineOffsets[mid] <= offset ) lo = mid; else hi = mid - 1;
      }
      tokens.push({
        line: lo,
        char: offset - lineOffsets[lo],
        length: length,
        type: type,
        modifiers: 0
      });
    },

    function encodeTokens_(tokens) {
      /** LSP delta-encoding: [dL, dC, length, type, modifiers] per token. */
      var data = [];
      var prevLine = 0, prevChar = 0;
      for ( var i = 0 ; i < tokens.length ; i++ ) {
        var t = tokens[i];
        var deltaLine = t.line - prevLine;
        var deltaChar = deltaLine === 0 ? t.char - prevChar : t.char;
        data.push(deltaLine, deltaChar, t.length, t.type, t.modifiers);
        prevLine = t.line;
        prevChar = t.char;
      }
      return { data: data };
    },

    function parseJrlEntry_(line) {
      /**
       * Extract the object from a single-line p({...}), c({...}), r({...}).
       * FOAM JRL uses JS object notation (unquoted keys), not JSON.
       */
      var match = line.match(/^\s*(?:\w+\.)?\w+\s*\(\s*(\{.*\})\s*\)\s*$/);
      if ( ! match ) return null;
      return this.evalJrlObject_(match[1]);
    },

    function findEntryAtLine_(text, lineNum) {
      /**
       * Find the JRL entry spanning the given line (handles multi-line entries).
       * Returns { entry, startLine, endLine, rawText } or null.
       */
      var lines = text.split('\n');

      // Walk backward from lineNum to find the start of the entry (the p({, c({, etc.)
      var startLine = lineNum;
      while ( startLine > 0 && ! /^\s*(?:\w+\.)?\w+\s*\(/.test(lines[startLine]) ) {
        startLine--;
      }

      // Single-line entry — fast path
      var singleMatch = lines[startLine].match(/^\s*(?:\w+\.)?\w+\s*\(\s*(\{.*\})\s*\)\s*$/);
      if ( singleMatch ) {
        var entry = this.evalJrlObject_(singleMatch[1]);
        return entry ? { entry: entry, startLine: startLine, endLine: startLine, rawText: lines[startLine] } : null;
      }

      // Multi-line entry — collect lines until we find the closing )
      var depth = 0;
      var endLine = startLine;
      var raw = '';
      for ( var i = startLine ; i < lines.length ; i++ ) {
        raw += lines[i] + '\n';
        for ( var c = 0 ; c < lines[i].length ; c++ ) {
          if ( lines[i][c] === '{' || lines[i][c] === '[' ) depth++;
          if ( lines[i][c] === '}' || lines[i][c] === ']' ) depth--;
        }
        if ( depth <= 0 && raw.indexOf(')') !== -1 ) {
          endLine = i;
          break;
        }
      }

      // Extract the object from p({...}) across lines
      var objMatch = raw.match(/(?:\w+\.)?\w+\s*\(\s*(\{[\s\S]*\})\s*\)/);
      if ( ! objMatch ) return null;
      var entry = this.evalJrlObject_(objMatch[1]);
      return entry ? { entry: entry, startLine: startLine, endLine: endLine, rawText: raw } : null;
    },

    function evalJrlObject_(objStr) {
      /** Parse a JRL object string (JSON or FOAM unquoted-key format). */
      try {
        return JSON.parse(objStr);
      } catch (e) {
        try {
          return eval('(' + objStr + ')');
        } catch (e2) {
          return null;
        }
      }
    },

    function getSegmentAt_(line, col, opt_entry) {
      /**
       * Find what's under the cursor in a JRL line.
       * Handles both JSON ("key":value) and FOAM (key:value) formats.
       * opt_entry: pre-parsed entry object (for multi-line entries).
       * Returns { value, isKey, isValue, key, rawValue } or null.
       */
      var entry = opt_entry || this.parseJrlEntry_(line);
      if ( ! entry ) return null;

      // Match both quoted and unquoted keys: "key": or key:
      // Also match single-quoted keys: 'key':
      var kvRegex = /(?:"(\w+)"|'(\w+)'|(?<=[{,\s])(\w+))\s*:\s*/g;
      var kv;
      while ( ( kv = kvRegex.exec(line) ) !== null ) {
        var keyName = kv[1] || kv[2] || kv[3];
        var keyStart = kv.index + (kv[1] ? 1 : kv[2] ? 1 : 0); // skip quote if present
        var keyEnd = keyStart + keyName.length;

        // Cursor on key name
        if ( col >= keyStart && col <= keyEnd ) {
          return { value: keyName, isKey: true, isValue: false };
        }

        // Check if cursor is on the value after this key
        var afterKey = kv.index + kv[0].length;
        var valuePart = line.substring(afterKey);

        // String value (quoted)
        var strMatch = valuePart.match(/^"([^"]*)"/);
        if ( strMatch ) {
          var valEnd = afterKey + 1 + strMatch[1].length;
          if ( col >= afterKey && col <= valEnd + 1 ) {
            return { value: strMatch[1], isKey: false, isValue: true, key: keyName, rawValue: entry[keyName] };
          }
          continue;
        }

        // Number value
        var numMatch = valuePart.match(/^(-?\d+\.?\d*)/);
        if ( numMatch ) {
          var valEnd = afterKey + numMatch[1].length;
          if ( col >= afterKey && col <= valEnd ) {
            return { value: numMatch[1], isKey: false, isValue: true, key: keyName, rawValue: entry[keyName] };
          }
          continue;
        }

        // Boolean/null
        var boolMatch = valuePart.match(/^(true|false|null)/);
        if ( boolMatch ) {
          var valEnd = afterKey + boolMatch[1].length;
          if ( col >= afterKey && col <= valEnd ) {
            return { value: boolMatch[1], isKey: false, isValue: true, key: keyName, rawValue: entry[keyName] };
          }
        }
      }

      return null;
    },

    function resolveProperty_(cls, keyName) {
      /** Find a property by name, shortName, or alias. */
      // Try direct name first
      var prop = cls.getAxiomByName(keyName);
      if ( prop && foam.lang.Property.isInstance(prop) ) return prop;

      // Search by shortName or alias
      var props = cls.getAxiomsByClass(foam.lang.Property);
      for ( var i = 0 ; i < props.length ; i++ ) {
        if ( props[i].shortName === keyName ) return props[i];
        if ( props[i].aliases ) {
          for ( var j = 0 ; j < props[i].aliases.length ; j++ ) {
            if ( props[i].aliases[j] === keyName ) return props[i];
          }
        }
      }
      return null;
    },

    function handleCompletion(text, position, opt_uri) {
      /** Suggest property names based on the class in the JRL entry. */
      var lines = text.split('\n');
      var line = lines[position.line] || '';

      // Embedded value blocks — serviceScript (Java) and client (FObject
      // JSON) may be triple-quoted OR escaped inside a regular double-quoted
      // string. Route to the right sub-completion before the normal JRL path.
      var embedCtx = this.detectEmbeddedBlockContext_(text, position);
      if ( embedCtx ) {
        if ( embedCtx.key === 'serviceScript' ) {
          return this.serviceScriptCompletion_(embedCtx.content,
            this.embedCursorToPosition_(embedCtx), embedCtx);
        }
        if ( embedCtx.key === 'client' ) {
          return this.clientBlockCompletion_(text, position, embedCtx);
        }
      }

      var entry = this.parseJrlEntry_(line);
      if ( ! entry ) {
        var found = this.findEntryAtLine_(text, position.line);
        if ( found ) entry = found.entry;
      }
      // For nested objects, find the nearest class context
      var classId = this.resolveNearestClass_(text, position.line, opt_uri, entry);
      if ( ! classId ) return { isIncomplete: false, items: [] };

      var cls = this.index.getClass(classId);
      if ( ! cls ) return { isIncomplete: false, items: [] };

      var prefix = line.substring(0, position.character);

      // After a key colon — suggest class names for "class": or enum values
      var afterColonMatch = prefix.match(/"(class)"\s*:\s*"?(\w*)$/);
      if ( afterColonMatch ) {
        return this.getClassNameCompletions_(afterColonMatch[2]);
      }

      // Inside a key position — suggest property names
      var items = [];
      var props = this.index.getProperties(classId);
      var existingKeys = entry ? Object.keys(entry) : [];

      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        if ( existingKeys.indexOf(p.name) !== -1 ) continue;
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        var doc = '';
        if ( p.label ) doc += '**' + p.label + '**\n\n';
        doc += 'Type: `' + typeName + '`';
        if ( p.documentation ) doc += '\n\n' + p.documentation;

        items.push({
          label: p.name,
          kind: 10,
          detail: typeName + ' — ' + classId,
          documentation: { kind: 'markdown', value: doc },
          insertText: '"' + p.name + '": ',
          sortText: '!' + p.name
        });

        // Also suggest shortName if available
        if ( p.shortName ) {
          items.push({
            label: p.shortName,
            kind: 10,
            detail: p.name + ' (' + typeName + ')',
            documentation: { kind: 'markdown', value: 'Short name for `' + p.name + '`\n\n' + doc },
            insertText: '"' + p.shortName + '": ',
            sortText: '~' + p.shortName
          });
        }
      }

      // Always suggest "class" if not present
      if ( ! entry || ! entry['class'] ) {
        items.unshift({
          label: 'class',
          kind: 10,
          detail: 'FOAM class identifier',
          insertText: '"class": "',
          sortText: '!!class'
        });
      }

      return { isIncomplete: false, items: items };
    },

    function detectEmbeddedBlockContext_(text, position) {
      /**
       * Find the embedded-value block the cursor is inside, whether it's
       * `key: """…"""`, `key: \`…\``, or the escaped-inside-double-quotes
       * form `key: "…"`. Returns { key, content, contentOffset, relativeOffset,
       * escaped } or null.
       *
       * For the escaped form, `content` is the UNESCAPED inner string
       * (so `"{\"of\":\"X\"}"` yields `{"of":"X"}`), and relativeOffset is
       * the cursor's offset into the unescaped form — good enough for
       * class/property completion on the JSON structure.
       */
      var triple = this.detectTripleQuoteContext_(text, position);
      if ( triple ) { triple.escaped = false; return triple; }

      // Escaped-in-double-quotes form. Only for `client` (and any other
      // key whose value is an FObject JSON literal). Look backward for a
      // `"key": "` start; the opening quote position is derived from the
      // regex match (NOT lastIndexOf, which is fooled by escaped quotes
      // inside the value).
      var abs = this.toOffset_(text, position);
      var before = text.substring(0, abs);
      // Anchor the pattern to end-of-prefix: key + colon + opening quote
      // + captured (so-far) value chars; the value must not be triple-quoted.
      var vm = before.match(/"([a-zA-Z_][\w$]*)"\s*:\s*"(?!"")((?:\\.|[^"\n\\])*)$/);
      if ( ! vm ) return null;
      if ( vm[1] !== 'client' && vm[1] !== 'serviceScript' ) return null;

      // Position of the value's opening `"`: start of the full match,
      // plus the full match length, minus the captured-value length,
      // minus 1 (the opening quote itself).
      var valOpen = vm.index + vm[0].length - vm[2].length - 1;

      var j = abs;
      var n = text.length;
      while ( j < n ) {
        var c = text.charAt(j);
        if ( c === '\\' ) { j += 2; continue; }
        if ( c === '"' ) break;
        if ( c === '\n' ) break;
        j++;
      }
      var valClose = j;

      var raw = text.substring(valOpen + 1, valClose);
      var unescaped = raw.replace(/\\(["\\/bfnrt]|u[0-9a-fA-F]{4})/g, function(_, esc) {
        switch ( esc.charAt(0) ) {
          case '"':  return '"';
          case '\\': return '\\';
          case '/':  return '/';
          case 'b':  return '\b';
          case 'f':  return '\f';
          case 'n':  return '\n';
          case 'r':  return '\r';
          case 't':  return '\t';
          case 'u':  return String.fromCharCode(parseInt(esc.substring(1), 16));
          default:   return esc;
        }
      });

      // Compute the cursor's offset into `unescaped` by replaying the
      // escape rules up to `abs`.
      var cursorInRaw = abs - (valOpen + 1);
      var cursorInUnesc = 0;
      var rawIdx = 0;
      while ( rawIdx < cursorInRaw && rawIdx < raw.length ) {
        if ( raw.charAt(rawIdx) === '\\' && rawIdx + 1 < raw.length ) {
          rawIdx += 2; cursorInUnesc += 1;
        } else {
          rawIdx += 1; cursorInUnesc += 1;
        }
      }

      return {
        key: vm[1],
        content: unescaped,
        contentOffset: valOpen + 1,
        relativeOffset: cursorInUnesc,
        escaped: true
      };
    },

    function resolveDottedClassUnderCursor_(ctx) {
      /**
       * Hover resolver for embedded code/JSON. Four modes, first hit wins:
       *
       *   1. Full dotted word IS a registered class id → class doc.
       *   2. Dotted word with a trailing `.segment` that isn't a class —
       *      trim trailing segments until a prefix matches.
       *   3. Short word (no dots) that IS itself a class id → class doc.
       *   4. Short word preceded by a resolvable receiver chain —
       *      `<receiver>.<word>` where receiver walks to a class. Look up
       *      the word as a method/getter/setter on that class.
       *
       * Grammar-level upgrade planned: replace char walks with a chain
       * grammar. First cut went through `foam.parse.Grammar.symbols`
       * callback (arg ordering issue) — keep char-walking for now, add
       * back once the grammar path is stable and covered by tests.
       */
      var cpos = this.embedCursorToPosition_(ctx);
      var content = ctx.content;
      var cursorAbs = this.positionToOffset_(content, cpos);

      var wordRe = /[\w.$]/;
      var start = cursorAbs;
      var end = cursorAbs;
      while ( start > 0 && wordRe.test(content.charAt(start - 1)) ) start--;
      while ( end < content.length && wordRe.test(content.charAt(end)) ) end++;
      var dotted = content.substring(start, end).replace(/^\.+|\.+$/g, '');

      if ( dotted && this.index.classExists(dotted) ) {
        return this.index.getClassDoc(dotted);
      }
      if ( dotted && dotted.indexOf('.') !== -1 ) {
        for ( var cand = dotted ; cand.indexOf('.') !== -1 ; ) {
          if ( this.index.classExists(cand) ) {
            // If the trimmed suffix is an enum value on this class, show
            // the value hover rather than the class doc.
            var suffix = dotted.substring(cand.length + 1);
            if ( suffix && suffix.indexOf('.') === -1 ) {
              var enumHit = this.buildEnumValueHover_(cand, suffix);
              if ( enumHit ) return enumHit;
            }
            return this.index.getClassDoc(cand);
          }
          cand = cand.substring(0, cand.lastIndexOf('.'));
        }
      }
      if ( dotted && dotted.indexOf('.') === -1 ) {
        // Effective word start: first non-dot char in the matched region.
        var effectiveStart = start;
        while ( effectiveStart < content.length && content.charAt(effectiveStart) === '.' ) {
          effectiveStart++;
        }
        var receiverType = this.resolveReceiverBefore_(content, effectiveStart);
        if ( receiverType ) {
          // Check enum first — hovering on ENUM_VALUE inside enum class scope.
          var enumHover = this.buildEnumValueHover_(receiverType, dotted);
          if ( enumHover ) return enumHover;
          return this.buildMemberHover_(receiverType, dotted);
        }
      }
      return null;
    },

    function positionToOffset_(content, pos) {
      /** Map {line, character} to absolute offset in content. */
      var off = 0, line = 0;
      for ( var i = 0 ; i < content.length ; i++ ) {
        if ( line === pos.line ) return i + pos.character;
        if ( content.charCodeAt(i) === 10 ) line++;
      }
      return content.length;
    },

    function resolveReceiverBefore_(content, wordStart) {
      /**
       * Return the FOAM class id of the receiver expression that precedes
       * `content[wordStart]`. Operates on the FULL embedded content so
       * multi-line builder chains work:
       *
       *   return new foo.X.Builder(x)
       *     .setA(true)
       *     .setB(y)
       *     .setC(…)   ← cursor on setC resolves receiver across lines
       *
       * Walks backward peeling alternating word/dot runs and balanced
       * `(…)` groups; treats whitespace (including newlines) as part of
       * the chain if it's between a dot and the next token.
       */
      if ( wordStart === 0 || content.charAt(wordStart - 1) !== '.' ) return null;
      var pos = wordStart - 2; // start before the trailing dot
      while ( pos >= 0 ) {
        var ch = content.charAt(pos);
        if ( /[\w.$]/.test(ch) ) { pos--; continue; }
        if ( ch === ')' ) {
          var depth = 1;
          pos--;
          while ( pos >= 0 && depth > 0 ) {
            var c = content.charAt(pos);
            if ( c === ')' ) depth++;
            else if ( c === '(' ) depth--;
            if ( depth === 0 ) break;
            pos--;
          }
          if ( depth !== 0 ) return null;
          pos--; // consume the '('
          continue;
        }
        if ( /\s/.test(ch) ) {
          // Whitespace (including newlines) is part of the chain only if it
          // sits between two chain elements — i.e. the next non-ws char
          // going backward is `.`, `)`, or `]`. This rejects `new foo.Bar`
          // (whitespace between `new` and the chain) while accepting
          //    foo.Builder(x)
          //      .setA(…)           (ws before `.`)
          // and foo
          //      .bar                (ws before `.`)
          var skip = pos;
          while ( skip >= 0 && /\s/.test(content.charAt(skip)) ) skip--;
          if ( skip < 0 ) break;
          var prev = content.charAt(skip);
          if ( prev !== '.' && prev !== ')' && prev !== ']' ) break;
          pos = skip;
          continue;
        }
        break;
      }
      var segStart = pos + 1;
      // Skip leading whitespace and leading dots.
      while ( segStart < wordStart - 1 && /[\s.]/.test(content.charAt(segStart)) ) segStart++;
      var receiverExpr = content.substring(segStart, wordStart - 1).replace(/\s+/g, '');
      if ( ! receiverExpr ) return null;
      return this.resolveReceiverType_(receiverExpr);
    },

    function buildEnumValueHover_(classId, valueName) {
      /**
       * If classId is an enum and valueName is one of its values, build a
       * hover showing the value's label and ordinal.
       */
      var values = this.index.getEnumValues(classId);
      if ( ! values || ! values.length ) return null;
      for ( var i = 0 ; i < values.length ; i++ ) {
        if ( values[i].name !== valueName ) continue;
        var v = values[i];
        var md = '```java\n' + classId + '.' + v.name + '\n```\n';
        md += '*enum value on `' + classId + '`*';
        if ( v.label ) md += '\n\nLabel: **' + v.label + '**';
        if ( v.ordinal != null ) md += '\n\nOrdinal: ' + v.ordinal;
        return md;
      }
      return null;
    },

    function buildMemberHover_(classId, memberName) {
      /**
       * Build hover markdown for a member access on a known class. Matches
       * getters/setters derived from properties, and FOAM methods. Returns
       * null if the member isn't on the class.
       */
      // Getter/setter pattern — `getX` / `setX` where X is a capitalized
      // name that, lowercased, names a property on the class.
      var gs = memberName.match(/^(get|set|is)([A-Z]\w*)$/);
      if ( gs ) {
        var propName = gs[2].charAt(0).toLowerCase() + gs[2].substring(1);
        var props = this.index.getProperties(classId);
        for ( var i = 0 ; i < props.length ; i++ ) {
          if ( props[i].name === propName ) {
            var typeName = this.index.getPropertyJavaType(classId, propName) || 'Object';
            var md = '```java\n';
            md += ( gs[1] === 'set' ? 'void '
                                    : typeName + ' ' ) + memberName;
            md += ( gs[1] === 'set' ? '(' + typeName + ' val)' : '()' );
            md += '\n```\n';
            md += '*property `' + propName + '` on `' + classId + '`*';
            if ( props[i].documentation ) md += '\n\n' + props[i].documentation;
            return md;
          }
        }
      }

      // FOAM method axiom
      var methods = this.index.getMethods(classId);
      for ( var i = 0 ; i < methods.length ; i++ ) {
        if ( methods[i].name !== memberName ) continue;
        var m = methods[i];
        var md = '```java\n' + memberName + '(';
        if ( m.args && m.args.length > 0 ) {
          md += m.args.map(function(a) {
            return ( a.type ? a.type + ' ' : '' ) + a.name;
          }).join(', ');
        }
        md += ')\n```\n*method on `' + classId + '`*';
        if ( m.documentation ) md += '\n\n' + m.documentation;
        return md;
      }

      return null;
    },

    function embedCursorToPosition_(ctx) {
      /** Translate ctx.relativeOffset into a {line,character} inside ctx.content. */
      var before = ctx.content.substring(0, ctx.relativeOffset);
      var line = 0, col = 0;
      for ( var i = 0 ; i < before.length ; i++ ) {
        if ( before.charCodeAt(i) === 10 ) { line++; col = 0; } else col++;
      }
      return { line: line, character: col };
    },

    function detectTripleQuoteContext_(text, position) {
      /**
       * If the cursor is inside a triple-quoted JRL value (`"""…"""`),
       * return { key, content, contentOffset, relativeOffset } where:
       *   • key: the JRL key preceding the `"""` (e.g. 'serviceScript',
       *     'client', 'javaCode')
       *   • content: the string between the opening and closing `"""`
       *   • contentOffset: absolute offset in text where content starts
       *   • relativeOffset: cursor's offset within content
       * Returns null if the cursor isn't in such a block.
       */
      var abs = this.toOffset_(text, position);
      // Walk backward for an unmatched opening `"""`.
      var i = abs;
      var openIdx = -1;
      while ( i >= 2 ) {
        if ( text.charAt(i) === '"' && text.charAt(i - 1) === '"' && text.charAt(i - 2) === '"' ) {
          openIdx = i - 2;
          break;
        }
        i--;
      }
      if ( openIdx === -1 ) return null;

      // Confirm there's no earlier `"""` that would close this one.
      // Count `"""` occurrences before cursor: must be odd (open without close).
      var before = text.substring(0, abs);
      var tripleRe = /"""/g;
      var count = 0;
      while ( tripleRe.exec(before) !== null ) count++;
      if ( count % 2 === 0 ) return null;

      // Extract the key immediately before the opening `"""` — e.g.
      //   "serviceScript": """
      // Scan back from openIdx for the pattern `"KEY"`.
      var beforeOpen = text.substring(Math.max(0, openIdx - 200), openIdx);
      var km = beforeOpen.match(/"([a-zA-Z_][\w$]*)"\s*:\s*$/);
      if ( ! km ) return null;

      var contentStart = openIdx + 3;
      var contentEnd = text.indexOf('"""', contentStart);
      if ( contentEnd === -1 ) contentEnd = text.length;

      return {
        key: km[1],
        content: text.substring(contentStart, contentEnd),
        contentOffset: contentStart,
        relativeOffset: abs - contentStart
      };
    },

    function toOffset_(text, position) {
      var offset = 0, line = 0, col = 0;
      for ( var i = 0 ; i < text.length && line <= position.line ; i++ ) {
        if ( line === position.line && col === position.character ) return i;
        if ( text.charCodeAt(i) === 10 ) { line++; col = 0; } else col++;
        offset = i + 1;
      }
      return offset;
    },

    function serviceScriptCompletion_(text, position, ctx) {
      /**
       * Inside a serviceScript Java code block. Two registry-driven modes:
       *
       *   1. Dotted class/package path — `foam.dao.E<cursor>` or
       *      `com.paytic.<cursor>` → suggest every class id that starts
       *      with the prefix. No hardcoded names.
       *
       *   2. Member access on a resolvable receiver — `<expr>.<partial>`
       *      → resolve the receiver's Java type via the Java-type-resolver
       *      (cast/new/literal class / `com.x.Y.getOwnClassInfo()`) and
       *      offer that class's own getters/setters from the registry.
       *      For FOAM Builder-pattern receivers (anything returning `this`
       *      or the builder's own type) this surfaces EVERY real setter
       *      the class actually declares, no hardcoded list.
       */
      // Operate on the FULL content up to the cursor so multi-line
       // builder chains resolve correctly (each setter on its own line).
      var cursorAbs = this.positionToOffset_(text, position);
      var prefix = text.substring(0, cursorAbs);

      // Partial word at cursor: letters only — we match an optional leading
      // dot explicitly below.
      var partialMatch = prefix.match(/\.(\w*)$/);
      if ( partialMatch ) {
        var partialName = partialMatch[1] || '';
        var dotPos = cursorAbs - partialName.length - 1;
        var receiverType = this.resolveReceiverBefore_(text, dotPos + 1);
        if ( receiverType ) {
          // Enum values take precedence — they're what you actually want
          // when the receiver is an enum class.
          var enumItems = this.enumValueCompletions_(receiverType, partialName);
          if ( enumItems.length > 0 ) return { isIncomplete: false, items: enumItems };

          var items = this.memberCompletions_(receiverType, partialName);
          if ( items.length > 0 ) return { isIncomplete: false, items: items };
        }
      }

      // Otherwise: dotted class-id prefix search.
      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var linePrefix = line.substring(0, position.character);
      var dotted = linePrefix.match(/([\w.$]+)$/);
      var partial = dotted ? dotted[1] : '';
      var ids = this.index.getAllClassIds();
      var out = [];
      var lower = partial.toLowerCase();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        if ( lower && ids[i].toLowerCase().indexOf(lower) === -1 ) continue;
        out.push({
          label: ids[i], kind: 7,
          insertText: ids[i],
          sortText: ids[i].toLowerCase()
        });
        if ( out.length > 200 ) break;
      }
      return { isIncomplete: out.length > 200, items: out };
    },

    function resolveReceiverType_(expr) {
      /**
       * Best-effort: resolve the type of a Java-expression receiver string
       * to a FOAM class id. Handles:
       *   • Fully-qualified / short class id (e.g. `foam.dao.EasyDAO`)
       *   • `X.Builder(...)` — type is `X.Builder` if registered, else `X`
       *   • `X.getOwnClassInfo()` — the class's own ClassInfo; treat as X
       *   • Chained builder calls `X.Builder(x).setA(true).setB(y)` —
       *     iteratively strip trailing `.method(args)` (FOAM builders
       *     return `this`, so the chain's type is the head's type)
       */
      var e = expr.replace(/\s+/g, '');
      var callRe = /\.\w+\s*\([^)]*\)\s*$/;
      while ( e ) {
        if ( this.index.classExists(e) ) return e;
        var builderBase = e.match(/^([\w.$]+?)\.Builder$/);
        if ( builderBase && this.index.classExists(builderBase[1]) ) return builderBase[1];
        var next = e.replace(callRe, '');
        if ( next === e ) break;
        e = next;
      }
      return null;
    },

    function enumValueCompletions_(classId, partial) {
      /**
       * If classId is a FOAM enum, offer its VALUES as completions.
       * Returns empty array for non-enums.
       */
      var values = this.index.getEnumValues(classId);
      if ( ! values || ! values.length ) return [];
      var items = [];
      var lower = partial ? partial.toLowerCase() : '';
      for ( var i = 0 ; i < values.length ; i++ ) {
        var v = values[i];
        if ( lower && v.name.toLowerCase().indexOf(lower) === -1 ) continue;
        items.push({
          label: v.name,
          kind: 20, // CompletionItemKind.EnumMember
          detail: classId + (v.label ? ' — ' + v.label : ''),
          insertText: v.name,
          sortText: '!' + String(v.ordinal != null ? v.ordinal : i).padStart(5, '0')
        });
      }
      return items;
    },

    function memberCompletions_(classId, partial) {
      /**
       * Build completion items for members of a FOAM class's Java surface:
       * every property as `getX()` / `setX(…)`, and every FOAM method by
       * its name. Everything derived from the registry — no hardcoding.
       */
      var items = [];
      var lower = partial.toLowerCase();
      var props = this.index.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var cap = p.name.charAt(0).toUpperCase() + p.name.substring(1);
        var typeName = this.index.getPropertyJavaType(classId, p.name) || 'Object';
        var getter = 'get' + cap;
        var setter = 'set' + cap;
        if ( ! lower || getter.toLowerCase().indexOf(lower) !== -1 ) {
          items.push({
            label: getter + '()', kind: 2,
            detail: typeName + ' — ' + classId,
            insertText: getter + '()',
            sortText: '!' + p.name
          });
        }
        if ( ! lower || setter.toLowerCase().indexOf(lower) !== -1 ) {
          items.push({
            label: setter + '(' + typeName + ')', kind: 2,
            detail: 'void — ' + classId,
            insertText: setter + '(',
            sortText: '!' + p.name
          });
        }
      }
      var methods = this.index.getMethods(classId);
      for ( var j = 0 ; j < methods.length ; j++ ) {
        var m = methods[j];
        if ( lower && m.name.toLowerCase().indexOf(lower) === -1 ) continue;
        items.push({
          label: m.name + '()', kind: 2,
          detail: classId + '.' + m.name,
          insertText: m.name + '(',
          sortText: '!!' + m.name
        });
      }
      return items;
    },

    function clientBlockCompletion_(text, position, ctx) {
      /**
       * Inside a client value — nested FObject JSON spec. Works for both
       * triple-quoted and escaped-in-double-quotes forms. Delegate to the
       * normal JRL completion on the unescaped content, adjusted position.
       */
      return this.handleCompletion(ctx.content, this.embedCursorToPosition_(ctx), null);
    },

    function getClassNameCompletions_(partial) {
      /** Suggest FOAM class IDs matching partial input. */
      var allIds = this.index.getAllClassIds();
      var items = [];
      var lower = partial.toLowerCase();
      for ( var i = 0 ; i < allIds.length ; i++ ) {
        if ( lower && allIds[i].toLowerCase().indexOf(lower) === -1 ) continue;
        items.push({
          label: allIds[i],
          kind: 7,
          insertText: allIds[i],
          sortText: allIds[i]
        });
        if ( items.length > 50 ) break;
      }
      return { isIncomplete: items.length > 50, items: items };
    },

    function handleDiagnostics(text, opt_uri) {
      /** Validate JRL entries: unknown classes, unknown properties. Handles single and multi-line. */
      var lines = text.split('\n');
      var diags = [];
      var processed = {};

      for ( var lineNum = 0 ; lineNum < lines.length ; lineNum++ ) {
        var line = lines[lineNum];
        if ( ! line.trim() || /^\s*\/\//.test(line) ) continue;
        if ( processed[lineNum] ) continue;

        // Try single-line first, then multi-line
        var entry = this.parseJrlEntry_(line);
        var startLine = lineNum;
        var endLine = lineNum;

        if ( ! entry ) {
          // Only try multi-line from entry start lines
          if ( ! /^\s*(?:\w+\.)?\w+\s*\(/.test(line) ) continue;
          var found = this.findEntryAtLine_(text, lineNum);
          if ( ! found ) continue;
          entry = found.entry;
          startLine = found.startLine;
          endLine = found.endLine;
        }

        // Mark processed lines
        for ( var p = startLine ; p <= endLine ; p++ ) processed[p] = true;

        var classId = this.resolveClassForJrl(opt_uri, entry);
        if ( ! classId ) continue;

        // Validate class exists
        var cls = this.index.getClass(classId);
        if ( ! cls ) {
          // Find the class string in the entry lines
          for ( var sl = startLine ; sl <= endLine ; sl++ ) {
            var classIdx = lines[sl].indexOf(classId);
            if ( classIdx !== -1 ) {
              diags.push({
                range: { start: { line: sl, character: classIdx }, end: { line: sl, character: classIdx + classId.length } },
                severity: 1,
                source: 'foam-lsp',
                message: 'Unknown class: ' + classId
              });
              break;
            }
          }
          continue;
        }

        // Validate property names across all lines of the entry
        for ( var key in entry ) {
          if ( key === 'class' ) continue;
          var prop = this.resolveProperty_(cls, key);
          if ( ! prop ) {
            var escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var keyPattern = new RegExp('(?:"' + escaped + '"|' + escaped + ')\\s*:');
            for ( var sl = startLine ; sl <= endLine ; sl++ ) {
              var keyMatch = keyPattern.exec(lines[sl]);
              if ( keyMatch ) {
                var keyStart = keyMatch.index + (keyMatch[0].charAt(0) === '"' ? 1 : 0);
                diags.push({
                  range: { start: { line: sl, character: keyStart }, end: { line: sl, character: keyStart + key.length } },
                  severity: 2,
                  source: 'foam-lsp',
                  message: 'Unknown property "' + key + '" on ' + classId
                });
                break;
              }
            }
          }
        }
      }

      return diags;
    },

    function handleDefinition(text, position, opt_uri) {
      /**
       * Go-to-definition for JRL entries.
       * Resolves: class names → .js source, property keys → property in class file.
       */
      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var entry = this.parseJrlEntry_(line);
      if ( ! entry ) {
        var found = this.findEntryAtLine_(text, position.line);
        if ( found ) entry = found.entry;
      }
      if ( ! entry ) return null;

      var classId = this.resolveNearestClass_(text, position.line, opt_uri, entry);
      var cls = classId ? this.index.getClass(classId) : null;

      var col = position.character;
      var segment = this.getSegmentAt_(line, col, entry);
      if ( ! segment ) return null;

      // Go-to on class value → navigate to the class .js file
      if ( segment.value === classId || ( segment.isValue && segment.key === 'class' ) ) {
        var clsId = segment.value;
        var filePath = this.index.getFilePath(clsId);
        if ( filePath ) {
          return { uri: 'file://' + filePath, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
        }
      }

      // Go-to on property key → navigate to property definition in the class
      if ( segment.isKey && cls ) {
        var prop = this.resolveProperty_(cls, segment.value);
        if ( prop ) {
          // Find which class in the chain defines this property
          var chain = this.index.getInheritanceChain(classId);
          for ( var c = 0 ; c < chain.length ; c++ ) {
            var ancestorCls = this.index.getClass(chain[c]);
            if ( ! ancestorCls ) continue;
            var own = ancestorCls.getOwnAxiomsByClass(foam.lang.Property);
            for ( var i = 0 ; i < own.length ; i++ ) {
              if ( own[i].name === prop.name ) {
                var filePath = this.index.getFilePath(chain[c]);
                if ( filePath ) {
                  // Find the property line in the file
                  var fs_ = require('fs');
                  try {
                    var content = fs_.readFileSync(filePath, 'utf8');
                    var propRegex = new RegExp("name\\s*:\\s*['\"]" + prop.name + "['\"]");
                    var match = propRegex.exec(content);
                    if ( match ) {
                      var lineNum = 0;
                      for ( var ci = 0 ; ci < match.index ; ci++ ) {
                        if ( content[ci] === '\n' ) lineNum++;
                      }
                      return { uri: 'file://' + filePath, range: { start: { line: lineNum, character: 0 }, end: { line: lineNum, character: 0 } } };
                    }
                  } catch (e) {}
                  return { uri: 'file://' + filePath, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
                }
              }
            }
          }
        }
      }

      // Go-to on a value that looks like a class ID → navigate to that class
      if ( segment.isValue && typeof segment.value === 'string' && this.index.classExists(segment.value) ) {
        var filePath = this.index.getFilePath(segment.value);
        if ( filePath ) {
          return { uri: 'file://' + filePath, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
        }
      }

      return null;
    },

    function resolveNearestClass_(text, lineNum, opt_uri, entry) {
      /**
       * Find the nearest "class" value for the cursor position.
       * Handles nested objects: walks backward from cursor to find
       * the closest "class": "..." within the current brace depth.
       */
      var lines = text.split('\n');
      var depth = 0;

      // Walk backward from cursor to find the nearest "class" at our depth or above
      for ( var i = lineNum ; i >= 0 ; i-- ) {
        var l = lines[i] || '';

        // Track brace depth (going backward, } increases, { decreases)
        for ( var c = l.length - 1 ; c >= 0 ; c-- ) {
          if ( l[c] === '}' ) depth++;
          if ( l[c] === '{' ) depth--;
        }

        // Look for "class" on this line at current depth or shallower
        var classMatch = l.match(/(?:"class"|class)\s*:\s*(?:"([^"]+)"|'([^']+)')/);
        if ( classMatch && depth <= 0 ) {
          return classMatch[1] || classMatch[2];
        }
      }

      // Fallback to entry-level or filename-based resolution
      return this.resolveClassForJrl(opt_uri, entry);
    },

    function formatTimestamp_(ts) {
      /** Convert a timestamp to human-readable UTC date string. */
      var d = new Date(ts);
      return d.getUTCFullYear() + '-' +
        String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(d.getUTCDate()).padStart(2, '0') + ' ' +
        String(d.getUTCHours()).padStart(2, '0') + ':' +
        String(d.getUTCMinutes()).padStart(2, '0') + ':' +
        String(d.getUTCSeconds()).padStart(2, '0') + ' UTC';
    }
  ]
});
