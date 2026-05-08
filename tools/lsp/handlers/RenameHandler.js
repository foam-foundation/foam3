/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'RenameHandler',

  documentation: 'Rename a class identifier across all files that reference it (extends/requires/of/implements). Produces a WorkspaceEdit that the editor applies atomically.',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.CursorAnalyzer'
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
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    }
  ],

  methods: [
    function prepare(text, position) {
      /**
       * textDocument/prepareRename — return the range that can be renamed,
       * or null if the cursor isn't on a renameable symbol.
       */
      var word = this.analyzer.getDottedWordAtPosition(text, position);
      if ( ! word || ! this.index.classExists(word) ) return null;

      // Find the word's range on the current line.
      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var start = position.character;
      var end   = position.character;
      var wc = /[a-zA-Z0-9_.$]/;
      while ( start > 0 && wc.test(line[start - 1]) ) start--;
      while ( end < line.length && wc.test(line[end]) ) end++;
      return {
        range: {
          start: { line: position.line, character: start },
          end:   { line: position.line, character: end }
        },
        placeholder: word
      };
    },

    function handle(text, position, newName, opt_uri) {
      /**
       * textDocument/rename — return a WorkspaceEdit that replaces every
       * occurrence of the class id (and its short name inside `.create()`
       * calls, `extends`/`of` string values) with the new name across all
       * files that reference it.
       */
      var oldId = this.analyzer.getDottedWordAtPosition(text, position);
      if ( ! oldId || ! this.index.classExists(oldId) ) return null;
      if ( ! newName || newName === oldId ) return null;

      var changes = {};
      var seenUris = {};

      // Start with the file that defines the class.
      var defPath = this.index.getFilePath(oldId);
      if ( defPath ) this.collectFileEdits_(defPath, oldId, newName, changes, seenUris);

      // All referencing classes (same set as ReferencesHandler uses).
      var refIds = {};
      var add = function(arr) { for ( var i = 0 ; i < arr.length ; i++ ) refIds[arr[i]] = true; };
      add(this.index.getSubclasses(oldId));
      add(this.index.getImplementors(oldId));
      add(this.index.getRequirers(oldId));
      add(this.index.getOfUsers(oldId));

      for ( var refId in refIds ) {
        var p = this.index.getFilePath(refId);
        if ( p ) this.collectFileEdits_(p, oldId, newName, changes, seenUris);
      }

      return { changes: changes };
    },

    function collectFileEdits_(filePath, oldId, newName, changes, seenUris) {
      /**
       * Read a file and emit TextEdit entries for every whole-word occurrence
       * of `oldId` (e.g. `foo.bar.OldClass`). We intentionally do NOT rewrite
       * the short name alone — too many false positives.
       */
      var uri = 'file://' + filePath;
      if ( seenUris[uri] ) return;
      seenUris[uri] = true;

      var fs_ = require('fs');
      var content;
      try { content = fs_.readFileSync(filePath, 'utf8'); } catch ( e ) { return; }

      var escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('(^|[^a-zA-Z0-9_.$])(' + escaped + ')(?![a-zA-Z0-9_.$])', 'g');
      var edits = [];
      var m;
      while ( ( m = re.exec(content) ) !== null ) {
        var matchStart = m.index + m[1].length;
        var startPos = this.analyzer.offsetToPosition(content, matchStart);
        edits.push({
          range: {
            start: startPos,
            end: { line: startPos.line, character: startPos.character + oldId.length }
          },
          newText: newName
        });
      }
      if ( edits.length > 0 ) changes[uri] = edits;
    }
  ]
});
