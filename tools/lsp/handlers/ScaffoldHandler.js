/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'ScaffoldHandler',

  documentation: `
    workspace/executeCommand 'foam.scaffold.newClass' — create a new FOAM
    class file and register it in the nearest pom.js.

    Given { dir, name } it returns { edit, result }:
      edit   — a WorkspaceEdit with documentChanges
               [ CreateFile, TextDocumentEdit (the file's whole content),
                 TextDocumentEdit (the pom.js files: append) ]. The server
               hands it to the client via workspace/applyEdit; NOTHING is
               written to disk here, so the user's undo stack owns the change
               and an editor with unsaved buffers stays coherent.
      result — { created: <uri>, pomUpdated: bool, warning?: string }, the
               executeCommand response the caller (VS Code command, MCP,
               Zed) reports to the user.

    Three derivations, each deliberately source-driven rather than
    hardcoded:

      license header — copied VERBATIM from the leading block comment of the
        first sibling .js file in the same folder whose comment reads as a
        LICENSE (see harvestHeader_). Nothing product-specific is baked into
        this public code: a foam3 folder yields the FOAM Authors header, a
        downstream product folder yields that product's header. No such
        sibling → no header at all, plus a warning (inventing one, or
        promoting a class doc-comment to "license", would be worse than
        omitting it).

      package — the path below the last 'src' segment, dotted
        (…/src/foam/demo → foam.demo). No 'src' segment → the path below the
        nearest pom.js's own directory, which is how a pom-rooted tree names
        its entries anyway. Neither available → the folder's own name.

      pom entry — { name: '<path below the pom dir, no .js>', flags: 'js|java' }
        appended inside the pom's files: array. Anything ambiguous (no
        pom.js above the folder, no files: key, two foam.POM() calls, a
        duplicated files: key, an unterminated array) leaves the pom
        UNTOUCHED and reports pomUpdated:false with a warning naming the
        manual entry — a half-edited pom is worse than one the user
        finishes by hand.

    Client requirement: CreateFile is a resource operation, so a client that
    does not declare workspace.workspaceEdit.resourceOperations 'create'
    will decline the applyEdit. The server surfaces that decline as an error
    message rather than a silent no-op.
  `,

  requires: [
    'foam.parse.lsp.CursorAnalyzer'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    },
    {
      class: 'String',
      name: 'wsRoot',
      documentation: 'Workspace root path; server.js sets it from rootUri at ' +
        'initialize. When set, newClass refuses a dir outside it — the command ' +
        'is reachable from agent/MCP callers, not just an editor prompt, and ' +
        'writing a file (plus climbing to a pom.js) anywhere on the filesystem ' +
        'is not something a workspace language server should do. Empty/unset ' +
        'means NO containment check at all, which is how handler-level tests ' +
        'use it — a bare create() scaffolds into any folder it is given.'
    },
    {
      class: 'Boolean',
      name: 'requireWsRoot',
      documentation: 'Set by server.js at initialize. Inside a client session ' +
        'an empty wsRoot means the client sent no rootUri — and the answer to ' +
        '"no workspace root" is REFUSE, not "scaffold anywhere". Falling back ' +
        'to process.cwd() (what server.js used to do) would give the ' +
        'containment check an arbitrary boundary the user never chose and ' +
        'cannot see. Left false for bare handler-level tests, where an empty ' +
        'wsRoot legitimately means "no containment check".'
    }
  ],

  methods: [
    function newClass(args) {
      /**
       * Build the WorkspaceEdit + result summary for { dir, name }.
       * THROWS (with a user-facing message) for the cases where there is
       * nothing sane to build at all: a missing/invalid name, a directory
       * that isn't one or that lies outside the workspace, or a file that
       * already exists — scaffolding must never overwrite existing source.
       */
      var fs   = require('fs');
      var path = require('path');
      var a    = args || {};

      if ( typeof a.dir !== 'string' || ! a.dir ) throw new Error('No target folder was given.');
      if ( typeof a.name !== 'string' || ! /^[A-Z][A-Za-z0-9_$]*$/.test(a.name) ) {
        throw new Error('"' + a.name + '" is not a valid FOAM class name — start with an ' +
          'uppercase letter and use letters, digits, _ or $ only.');
      }
      var isDir = false;
      try { isDir = fs.statSync(a.dir).isDirectory(); } catch (e) { isDir = false; }
      if ( ! isDir ) throw new Error('Not a folder: ' + a.dir);

      // Resolve ONCE, here, so every path derived below — the file:// uris,
      // the pom walk-up, the package segments — is built from the same
      // absolute path. A relative dir would otherwise yield a uri like
      // file://a/b/X.js, whose 'a' parses as a URI authority, while the pom
      // edit's uri (built from an already-resolved pom path) came out
      // absolute: one WorkspaceEdit naming two different filesystems.
      //
      // realpath, not just resolve: the containment check below compares real
      // paths (a symlink otherwise walks straight out of the workspace), and
      // everything downstream must live in the same space as the check that
      // approved it — including the pom walk-up, whose stop-at-root
      // comparison is likewise lexical.
      var dir = this.realPath_(a.dir);
      this.assertInWorkspace_(dir);

      var filePath = path.join(dir, a.name + '.js');
      if ( fs.existsSync(filePath) ) throw new Error(a.name + '.js already exists in ' + dir);

      var warnings = [];

      var header = this.harvestHeader_(dir);
      if ( ! header ) {
        warnings.push('no license header was copied — no other .js file in this folder ' +
          'starts with a license block comment');
      }

      var pomPath = this.findNearestPom_(dir);
      var pkg     = this.derivePackage_(dir, pomPath ? path.dirname(pomPath) : null);

      var content = ( header ? header + '\n\n' : '' ) +
        'foam.CLASS({\n' +
        "  package: '" + pkg + "',\n" +
        "  name: '" + a.name + "'\n" +
        '});\n';

      var uri  = 'file://' + filePath;
      var zero = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
      var documentChanges = [
        { kind: 'create', uri: uri, options: { overwrite: false, ignoreIfExists: false } },
        { textDocument: { uri: uri, version: null }, edits: [ { range: zero, newText: content } ] }
      ];

      var pomUpdated = false;
      if ( ! pomPath ) {
        warnings.push('no pom.js was found above this folder — register ' + a.name + ' manually');
      } else {
        var pomText  = fs.readFileSync(pomPath, 'utf8');
        var relative = path.relative(path.dirname(pomPath), filePath)
          .split(path.sep).join('/').replace(/\.js$/, '');
        var pomEdit  = this.buildPomAppendEdit_(pomText, relative);
        if ( pomEdit ) {
          documentChanges.push({
            textDocument: { uri: 'file://' + pomPath, version: null },
            edits: [ pomEdit ]
          });
          pomUpdated = true;
        } else {
          warnings.push("could not update " + pomPath + " — add { name: '" + relative +
            "', flags: 'js|java' } to its files: array manually");
        }
      }

      var result = { created: uri, pomUpdated: pomUpdated };
      if ( warnings.length ) result.warning = warnings.join('; ');
      return { edit: { documentChanges: documentChanges }, result: result };
    },

    function realPath_(p) {
      /**
       * fs.realpathSync(p), or the plain resolved path when it can't be
       * resolved (p doesn't exist, or a permission error mid-walk). Every
       * caller here has already established that its path exists, so the
       * fallback is a safety net rather than a normal branch — and falling
       * back to the lexical path keeps the old (still lexically correct)
       * behaviour instead of throwing something the user can't act on.
       */
      var fs   = require('fs');
      var path = require('path');
      try { return fs.realpathSync(p); } catch (e) { return path.resolve(p); }
    },

    function assertInWorkspace_(resolvedDir) {
      /**
       * Refuse a target folder outside `wsRoot`. No wsRoot means no check when
       * this is a bare handler in a test, but REFUSAL once requireWsRoot is
       * set — see both properties' documentation.
       *
       * Both sides are run through fs.realpathSync first. The comparison
       * itself is lexical (path.relative), but everything DOWNSTREAM of it —
       * statSync, readdirSync, the client's own file write — follows
       * symlinks. Comparing lexical paths while acting on resolved ones is
       * the whole bug: `ln -s / <ws>/escape` makes <ws>/escape/etc lexically
       * inside the workspace and really /etc. Resolving first closes that,
       * and `rel` empty still means the folder IS the root, which is inside
       * it.
       */
      if ( this.requireWsRoot && ! this.wsRoot ) {
        throw new Error('Scaffolding requires a workspace root — this editor session ' +
          'opened no folder (no rootUri), so there is nothing to scaffold inside.');
      }
      if ( ! this.wsRoot ) return;
      var path = require('path');
      var root = this.realPath_(this.wsRoot);
      var dir  = this.realPath_(resolvedDir);
      var rel  = path.relative(root, dir);
      if ( rel === '..' || rel.indexOf('..' + path.sep) === 0 || path.isAbsolute(rel) ) {
        throw new Error(dir + ' is outside the workspace (' + root + ').');
      }
    },

    function harvestHeader_(dir) {
      /**
       * The leading block comment of the first sibling .js file (name-sorted,
       * for a deterministic answer) that carries a LICENSE, verbatim —
       * comment markers included. Files are scanned in order and the scan
       * stops at the first qualifying hit, so in a normal folder exactly one
       * file is read.
       *
       * "Carries a license" is decided by LICENSE_RE rather than "is the
       * first block comment", because a leading block comment is just as
       * often a class doc-comment ("FOAM State Machine (FSM) Implementation
       * …" and friends exist in this codebase) — copying one of those into a
       * new file as its "license header" is silently wrong in a way nobody
       * reviews. A folder whose only block comments are doc-comments takes
       * the no-header warning path instead.
       *
       * Returns null when no .js file in the folder qualifies.
       */
      var fs   = require('fs');
      var path = require('path');
      var LICENSE_RE = /@license|Copyright|CONFIDENTIAL|All Rights Reserved/i;
      var names;
      try { names = fs.readdirSync(dir); } catch (e) { return null; }
      names = names.filter(function(n) { return /\.js$/.test(n); }).sort();
      for ( var i = 0 ; i < names.length ; i++ ) {
        var text;
        try { text = fs.readFileSync(path.join(dir, names[i]), 'utf8'); } catch (e) { continue; }
        var m = /^\s*(\/\*[\s\S]*?\*\/)/.exec(text);
        if ( m && LICENSE_RE.test(m[1]) ) return m[1];
      }
      return null;
    },

    function findNearestPom_(dir) {
      /**
       * Nearest pom.js at or above `dir`, or null. The walk stops at
       * `wsRoot` when one is set (the folder is already known to be inside
       * it), so a workspace with no pom of its own can never reach out and
       * edit some unrelated pom.js further up the filesystem; with no
       * wsRoot it climbs to the filesystem root.
       *
       * Both ends are realpath'd for the same reason assertInWorkspace_ does
       * it: a lexical `cur === stop` never matches when either side reaches
       * the workspace through a symlink, and the walk would then sail past
       * the root it was supposed to stop at.
       */
      var fs   = require('fs');
      var path = require('path');
      var cur  = this.realPath_(dir);
      var stop = this.wsRoot ? this.realPath_(this.wsRoot) : null;
      for (;;) {
        var candidate = path.join(cur, 'pom.js');
        if ( fs.existsSync(candidate) ) return candidate;
        if ( stop && cur === stop ) return null;
        var parent = path.dirname(cur);
        if ( parent === cur ) return null;
        cur = parent;
      }
    },

    function derivePackage_(dir, opt_pomDir) {
      /**
       * Package for a class living in `dir`: the path below the LAST 'src'
       * segment (last, not first, so a nested source root like
       * <repo>/foam3/src/foam/demo wins over an outer one), else the path
       * below the pom's own directory, else the folder's own name.
       *
       * The answer is VALIDATED before it is returned, because newClass drops
       * it into a single-quoted JS string literal. A folder named `it's`
       * would otherwise emit `package: 'it's.views'` — a syntax error in the
       * file we just told the user we created. Refusing beats escaping here:
       * a FOAM package is a dotted Java-style identifier path, so `it's` is
       * not a package this scaffold could legitimately write under any
       * quoting, and a clear refusal names the folder to rename.
       */
      var path = require('path');
      var segs = path.resolve(dir).split(path.sep).filter(Boolean);
      var idx  = segs.lastIndexOf('src');
      if ( idx !== -1 && idx < segs.length - 1 ) {
        return this.assertPackageWritable_(segs.slice(idx + 1).join('.'), dir);
      }
      if ( opt_pomDir ) {
        var rel = path.relative(opt_pomDir, dir);
        if ( rel && rel.indexOf('..') !== 0 ) {
          return this.assertPackageWritable_(rel.split(path.sep).join('.'), dir);
        }
      }
      return this.assertPackageWritable_(segs[segs.length - 1] || '', dir);
    },

    function assertPackageWritable_(pkg, dir) {
      /**
       * `pkg` back, or a throw naming the folder when it isn't a legal FOAM
       * package. Checked SEGMENT BY SEGMENT, not as one flat character class:
       * a whole-string /^[A-Za-z0-9_$.]+$/ would wave through '3d' (a package
       * segment may not start with a digit, any more than a Java one may),
       * '.foam', 'foam.' and 'foam..demo' — all of which pass a character
       * test and none of which is a legal dotted identifier path. Each
       * segment must be an identifier: /^[A-Za-z_$][A-Za-z0-9_$]*$/, the same
       * alphabet the class-name check in newClass accepts.
       *
       * Anything else (a quote, a space, a dash, a backslash, a leading digit)
       * cannot be written into `package: '…'` safely OR meaningfully.
       */
      var segments = String(pkg).split('.');
      var legal = !! pkg && segments.every(function(s) {
        return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);
      });
      if ( legal ) return pkg;
      throw new Error('Cannot derive a FOAM package from ' + dir + ' — "' + pkg +
        '" is not a legal package. Each dot-separated segment must start with a ' +
        'letter, _ or $ and continue with letters, digits, _ or $. ' +
        'Rename the folder, or scaffold into one below a src/ directory.');
    },

    function findFilesArraySpan_(text) {
      /**
       * Locate the files: array of the pom's single foam.POM({ ... }) call.
       * Returns { open, close, lastCode } — the array's own '[' and ']'
       * offsets plus the offset of the last CODE character inside it
       * (-1 when the array holds nothing but whitespace/comments) — or null
       * when the file is ambiguous or malformed.
       *
       * Same string-aware, depth-tracking forward walk as
       * I18nHandler.findEntrySpan_: it starts at the POM object's own '{',
       * never near a name match, and skips quoted runs whole so a decoy
       * bracket inside a value (name: 'A]') can never be mistaken for a
       * structural one. Two things are added for pom files specifically:
       *   - line and block comments are skipped like strings, because poms
       *     routinely carry them and an apostrophe in one ("don't") would
       *     otherwise open a quoted run that swallows the rest of the file;
       *   - the files: key is recognized DURING the walk, at the object's
       *     own depth with a '{' or ',' to its left, so a `files:` inside a
       *     string, a comment, or a nested object cannot be picked up (and
       *     `javaFiles:` cannot either).
       *
       * Refuses (null) rather than guessing on: no foam.POM() call, more
       * than one, no files: key, a duplicated files: key at that level, or
       * an array that never closes.
       */
      var pomRe = /foam\.POM\s*\(\s*\{/g;
      var m = pomRe.exec(text);
      if ( ! m ) return null;
      if ( pomRe.exec(text) ) return null;      // two POM calls — ambiguous

      var keyRe    = /^files\s*:\s*\[/;
      var depth    = 0;
      var open     = -1;
      var close    = -1;
      var lastCode = -1;
      var seen     = 0;
      // Offset of the previous CODE character — a comment contributes none
      // and a quoted run contributes only its closing quote. Both the
      // files:-key boundary test and "the array's last code character" read
      // this, so neither has to re-scan backwards over text whose comments
      // and strings this forward walk has already resolved.
      var prevAt   = -1;

      for ( var i = m.index + m[0].length - 1 ; i < text.length ; i++ ) {
        var ch   = text[i];
        var next = text[i + 1];

        if ( ch === '/' && next === '/' ) {
          while ( i < text.length && text[i] !== '\n' ) i++;
          continue;
        }
        if ( ch === '/' && next === '*' ) {
          var endC = text.indexOf('*/', i + 2);
          i = endC === -1 ? text.length : endC + 1;
          continue;
        }
        if ( ch === "'" || ch === '"' || ch === '`' ) {
          for ( i++ ; i < text.length ; i++ ) {
            if ( text[i] === '\\' ) { i++; continue; }
            if ( text[i] === ch ) break;
          }
          prevAt = i;
          continue;
        }

        if ( ch === '{' || ch === '[' ) {
          depth++;
          prevAt = i;
          continue;
        }
        if ( ch === '}' || ch === ']' ) {
          // The files: array opened at depth 1 and so lives at depth 2; the
          // first depth-2 ']' seen after its '[' is its own close, and the
          // code character before it is the array's last one (-1 when that
          // is the '[' itself, i.e. an array holding only whitespace and
          // comments).
          if ( ch === ']' && depth === 2 && open !== -1 && close === -1 && i > open ) {
            close    = i;
            lastCode = prevAt > open ? prevAt : -1;
          }
          depth--;
          prevAt = i;
          if ( depth === 0 ) break;             // the POM object closed
          continue;
        }

        // Still checked after `open` is set: a SECOND files: key at this
        // level (back at depth 1 once the first array closed) is exactly the
        // ambiguity `seen` exists to catch.
        if ( depth === 1 && ch === 'f' ) {
          var km = keyRe.exec(text.substring(i, i + 40));
          if ( km && prevAt !== -1 && ( text[prevAt] === '{' || text[prevAt] === ',' ) ) {
            if ( ++seen > 1 ) return null;      // duplicated files: key
            open = i + km[0].length - 1;
            i    = open - 1;                    // resume AT the '[' so depth counts it
            continue;
          }
        }

        if ( ! /\s/.test(ch) ) prevAt = i;
      }

      if ( open === -1 || close === -1 ) return null;
      return { open: open, close: close, lastCode: lastCode };
    },

    function buildPomAppendEdit_(text, entryName) {
      /**
       * A single TextEdit appending { name: '<entryName>', flags: 'js|java' }
       * as the last element of the pom's files: array, or null when
       * findFilesArraySpan_ refused the file.
       *
       * The insert goes immediately after the array's last CODE character,
       * not merely after its last non-whitespace character: a trailing `//`
       * comment on the last entry's line would otherwise swallow the comma
       * this edit writes and silently break the file. A trailing comma
       * already there is reused rather than doubled.
       */
      var span = this.findFilesArraySpan_(text);
      if ( ! span ) return null;

      var entry     = "{ name: '" + entryName + "', flags: 'js|java' }";
      var insertAt, newText;

      if ( span.lastCode === -1 ) {
        // Empty array: open a line for the entry, indented one step past the
        // line the closing bracket sits on. The newline+indent already
        // sitting in front of that bracket is REUSED rather than re-emitted
        // — writing our own would leave a whitespace-only line behind it.
        // A one-line `files: []` has no such newline, so there it is added.
        var closeIndent = this.lineIndent_(text, span.close);
        var multiline   = text.substring(span.open + 1, span.close).indexOf('\n') !== -1;
        insertAt = span.open + 1;
        newText  = '\n' + closeIndent + '  ' + entry + ( multiline ? '' : '\n' + closeIndent );
      } else {
        var entryIndent = this.lineIndent_(text, span.lastCode);
        insertAt = span.lastCode + 1;
        newText  = ( text[span.lastCode] === ',' ? '' : ',' ) + '\n' + entryIndent + entry;
      }

      var pos = this.analyzer.offsetToPosition(text, insertAt);
      return { range: { start: pos, end: pos }, newText: newText };
    },

    function lineIndent_(text, offset) {
      /** The leading whitespace of the line `offset` falls on. */
      var start = text.lastIndexOf('\n', offset) + 1;
      var m = /^[ \t]*/.exec(text.substring(start, offset + 1));
      return m ? m[0] : '';
    }
  ]
});
