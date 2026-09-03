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
