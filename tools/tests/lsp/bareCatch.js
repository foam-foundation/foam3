/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Empty catch blocks in the LSP's own source (tools/lsp). A catch with no
// statement drops the error, so a broken feature looks like an empty result;
// the fix is logLspError(context, err) from tools/lsp/logError.js (see "A
// fallback leaves a trace" in tools/lsp/CLAUDE.md).
//
// The tree still holds catches written before that rule, so this asserts a
// ceiling, not zero: a new empty catch fails the run, fixing an old one
// lowers the count. Lower BASELINE when that happens.
//
// A file opts out with a line of its own reading
// `// foam-lint-ignore: bare-catch`, saying why in the same comment.

var h = require('./_harness');
var test = h.test, section = h.section;
var fs = require('fs');
var os = require('os');
var path = require('path');

var BASELINE = 52;

function scanBareCatches(roots) {
  /** [ { path, line } ], line 1-based, for each catch whose block holds no
      statement (a comment alone counts as empty). Text-based brace walk. */
  var found = [];
  var files = [];

  function walk(dir) {
    var names;
    try { names = fs.readdirSync(dir); }
    catch (e) { test(false, 'bare-catch scan: read dir ' + dir + ' — ' + e.message); return; }
    for ( var i = 0 ; i < names.length ; i++ ) {
      // Vendor and generated trees (the VS Code extension's node_modules,
      // compiled out/) are not ours to scan.
      if ( names[i].charAt(0) === '.' )                continue;
      if ( names[i] === 'node_modules' )               continue;
      if ( names[i] === 'build' || names[i] === 'out' ) continue;
      var p = path.join(dir, names[i]);
      var st = fs.lstatSync(p);
      if ( st.isSymbolicLink() ) continue;
      if ( st.isDirectory() ) walk(p);
      else if ( p.endsWith('.js') ) files.push(p);
    }
  }
  roots.forEach(walk);

  files.forEach(function(file) {
    var content = fs.readFileSync(file, 'utf8');
    // The marker counts only as a line of its own, not quoted in a string.
    if ( /^\s*\/\/\s*foam-lint-ignore: bare-catch/m.test(content) ) return;

    var re = /catch\s*(?:\(\s*[\w$]*\s*\))?\s*\{/g;
    var m;
    while ( ( m = re.exec(content) ) !== null ) {
      var i = m.index + m[0].length;   // just past the '{'
      var depth = 1, hasStatement = false;
      while ( i < content.length && depth > 0 ) {
        var ch = content[i];
        if ( ch === '/' && content[i+1] === '/' ) {
          while ( i < content.length && content[i] !== '\n' ) i++;
        } else if ( ch === '/' && content[i+1] === '*' ) {
          i += 2;
          while ( i < content.length && !(content[i] === '*' && content[i+1] === '/') ) i++;
          i++;
        } else if ( ch === '{' ) depth++;
        else if ( ch === '}' ) depth--;
        else if ( ! /\s/.test(ch) ) hasStatement = true;
        i++;
      }
      if ( ! hasStatement ) found.push({ path: file, line: content.slice(0, m.index).split('\n').length });
    }
  });
  return found;
}

section('bare-catch — scanner');

var bcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-bare-catch-'));
fs.writeFileSync(path.join(bcDir, 'Bad.js'),
  "function f() {\n  try { g(); } catch (e) {}\n}\n");
fs.writeFileSync(path.join(bcDir, 'CommentOnly.js'),
  "function f() {\n  try { g(); } catch (e) { /* ignore */ }\n}\n");
fs.writeFileSync(path.join(bcDir, 'Good.js'),
  "function f() {\n  try { g(); } catch (e) { console.error('x: ' + e.message); }\n}\n");
fs.writeFileSync(path.join(bcDir, 'Suppressed.js'),
  "// foam-lint-ignore: bare-catch\nfunction f() {\n  try { g(); } catch (e) {}\n}\n");
fs.writeFileSync(path.join(bcDir, 'QuotesMarker.js'),
  "var hint = 'add // foam-lint-ignore: bare-catch';\nfunction f() {\n  try { g(); } catch (e) {}\n}\n");

var bc = scanBareCatches([ bcDir ]);
test(bc.some(function(f) { return f.path.endsWith('Bad.js') && f.line === 2; }),
  'empty catch body found, on its 1-based line');
test(bc.some(function(f) { return f.path.endsWith('CommentOnly.js'); }),
  'comment-only catch body counts as empty');
test(! bc.some(function(f) { return f.path.endsWith('Good.js'); }),
  'catch that logs is clean');
test(! bc.some(function(f) { return f.path.endsWith('Suppressed.js'); }),
  'ignore line skips the file');
test(bc.some(function(f) { return f.path.endsWith('QuotesMarker.js'); }),
  'the marker quoted inside a string does not skip the file');

section('bare-catch — tools/lsp');

var lspDir = path.resolve(__dirname, '../../lsp');
var lspCatches = scanBareCatches([ lspDir ]);
test(lspCatches.length <= BASELINE,
  'tools/lsp holds no more empty catches than the baseline (' + lspCatches.length + ' of ' + BASELINE + ')' +
  ( lspCatches.length > BASELINE ? ' — new: log them with logLspError. All: ' +
    lspCatches.map(function(f) { return path.relative(lspDir, f.path) + ':' + f.line; }).join(', ') : '' ));
if ( lspCatches.length < BASELINE ) {
  console.error('bare-catch: ' + lspCatches.length + ' empty catches left under tools/lsp — lower BASELINE in ' +
    path.relative(process.cwd(), __filename) + ' to ' + lspCatches.length);
}
