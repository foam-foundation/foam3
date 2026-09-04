/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// FileClassifier — the one shared answer to "what kind of file is this".
// These pin the classification contract both the server dispatch and
// DiagnosticsHandler route through.

var h = require('./_harness');
var test = h.test, section = h.section;

var c = foam.parse.lsp.FileClassifier.create();

section('FileClassifier — kinds');

function k(uri, text) { return c.classify('file:///' + uri, text); }

test(k('a.js', "foam.CLASS({ name: 'X' });") === 'class', 'foam.CLASS -> class');
test(k('pom.js', 'foam.POM({ files: [] });') === 'pom', 'foam.POM -> pom');
test(k('e.js', 'foam.ENUM({});') === 'class', 'foam.ENUM -> class');
test(k('x.jrl', 'p({})') === 'jrl', '.jrl extension -> jrl, text not consulted');
test(k('b.js', 'var x = 1;') === 'other', 'no foam call -> other');
test(k('u.js', 'foam.u2.something();') === 'other',
  'lowercase foam.u2 call is not a definition call');

section('FileClassifier — comments and strings cannot misroute (the point)');

test(k('c.js', '// foam.POM( in a comment\nvar x = 1;') === 'other',
  'line-comment mention alone -> other');
test(k('d.js', '/* foam.POM( */\nfoam.CLASS({});') === 'class',
  'block-comment pom mention before a real CLASS -> class');
test(k('f.js', '// docs mention foam.CLASS(\nfoam.POM({});') === 'pom',
  'comment CLASS mention before a real POM -> pom (the shipped downstream case)');
test(k('s.js', "var s = 'foam.POM(';\nfoam.CLASS({});") === 'class',
  'single-quoted string mention skipped');
test(k('t.js', '`template with foam.CLASS( inside`;') === 'other',
  'backtick template mention skipped');
test(k('q.js', 'var s = "esc \\" foam.CLASS( still string";') === 'other',
  'escaped quote does not end the string early');

section('FileClassifier — call shape and precedence');

test(k('w.js', 'foam.POM (\n  {});') === 'pom',
  'whitespace/newline between name and paren allowed (regex parity)');
test(k('p.js', 'foam.CLASS({});\nfoam.POM({});') === 'class',
  'FIRST significant call wins (a real file never mixes these)');
test(k('n.js', 'foam.POMX({});') === 'class',
  'POMX is not POM — word boundary via full-name match');
test(k('z.js', '') === 'other', 'empty text -> other');
test(c.classify('', 'foam.CLASS({});') === 'class', 'empty uri still classifies by text');

section('FileClassifier — skips that must not run past their own terminator');

// Each of these shipped as 'other', i.e. the file went silent in the editor:
// the skip swallowed the real foam call behind a mis-paired terminator.
test(k('esc.js', 'var a = "\\\\";\nfoam.CLASS({ name: "X" });') === 'class',
  'an escaped BACKSLASH ends the string — \\\\ is not an escaped quote');
test(k('re.js', "var re = /don't/;\nfoam.CLASS({ package: 'x', name: 'Y' });") === 'class',
  "an apostrophe inside a regex literal cannot swallow the next line's call");
test(k('un.js', "var s = 'oops\nfoam.CLASS({ name: 'Z' });") === 'class',
  'an unterminated quote dies at its own newline, not three functions later');
test(k('tmpl.js', 'var t = `line one\nline two`;\nfoam.CLASS({ name: "T" });') === 'class',
  'a template literal still spans lines (only the two quote kinds are line-bounded)');

section('FileClassifier — kinds the FILENAME decides, before any text');

// A pom.js is a pom even when its foam.POM( is half-typed. server.js asked the
// URI in one place and the text in another, and split on exactly this state:
// the pom cache was invalidated and the diagnostics were not.
test(c.classify('file:///a/pom.js', 'foam.POM({\n  files: [') === 'pom',
  'a pom.js broken mid-edit is still a pom');
test(c.classify('file:///a/pom.js', '') === 'pom',
  'an empty pom.js is still a pom');
test(c.classify('file:///a/compom.js', 'var x = 1;') === 'other',
  'the pom rule matches the whole filename, not a suffix of one');

section('FileClassifier — repeat asks are cached');

var CACHED_URI = 'file:///c/Big.js';
var t1 = 'var x = 1;\n// ' + new Array(200).join('padding ') + '\n';
test(c.classify(CACHED_URI, t1) === 'other' && c.classify(CACHED_URI, t1) === 'other',
  'the same uri+text answers the same twice (cache hit path)');
test(c.classify(CACHED_URI, 'foam.CLASS({ name: "New" });') === 'class',
  'new text for a cached uri is re-classified, not served stale');

// === significantCalls: every call, in order, with its line ===
// classify() only needs the first call. Model-position lookups need them all,
// which is why this is one scan and not a second regex somewhere else.

var callsText = [
  "// a header that mentions foam.CLASS( in prose",
  "foam.CLASS({",
  "  name: 'First',",
  "  properties: [ { name: 'sample', value: 'foam.ENUM(' } ]",
  "});",
  "",
  "/* foam.INTERFACE( inside a block comment */",
  "foam.ENUM({ name: 'Second' });",
  "",
  "foam.LIB({ name: 'third' });"
].join('\n');

var cc = foam.parse.lsp.FileClassifier.create();
var found = cc.significantCalls(callsText);

test(found.length === 3, 'significantCalls skips the comment and string mentions (3 real calls)');
test(found.map(function(x) { return x.name; }).join(',') === 'CLASS,ENUM,LIB',
  'significantCalls returns names in source order');
test(found[0].line === 1 && found[1].line === 7 && found[2].line === 9,
  'significantCalls reports the line each call is written on');
test(callsText.substring(found[1].offset).indexOf('foam.ENUM(') === 0,
  'the reported offset points at the call itself');
test(cc.significantCalls('') .length === 0, 'significantCalls on empty text is empty');
test(cc.significantCalls(callsText) === found,
  'the same text is answered from the memo, not re-scanned');
