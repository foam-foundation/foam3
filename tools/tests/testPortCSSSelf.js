#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Tests for tools/portCSSSelf.js. Runs in node, no Java build needed.
//
// Usage: node foam3/tools/tests/testPortCSSSelf.js
//
// Loading this file as a module runs nothing.

var fs_    = require('fs');
var os_    = require('os');
var path_  = require('path');
var child_ = require('child_process');

var TOOL = path_.resolve(__dirname, '../portCSSSelf.js');
var port = require(TOOL);

var passes = 0, failures = 0;

function test(ok, message) {
  if ( ok ) {
    passes++;
    console.log('  ok   ' + message);
  } else {
    failures++;
    console.log('  FAIL ' + message);
  }
}

var B = '`';

function cls(css) {
  return "foam.CLASS({\n  name: 'X',\n  css: " + css + ",\n" +
    "  methods: [ function f() { return 1; } ]\n});\n";
}

var parser;

function portOf(src) { return port.portText(src, parser); }

function onlySkipped(r, reason) {
  // True when nothing changed and one value was reported, for reason.
  return r.changes.length === 0 && r.skipped.length === 1 && r.skipped[0].reason === reason;
}

function main() {
  parser = port.loadCSSParser();

  console.log('selectors');
  var r = portOf(cls(B + '^ { color: red; }\n  ^title:hover, ^ > ^body { margin: 0; }' + B));
  test(r.changes.length === 4, "every selector '^' is found (" + r.changes.length + ')');
  test(r.text.indexOf('<< { color: red; }') !== -1, "'^ {' becomes '<< {'");
  test(r.text.indexOf('<<title:hover, << > <<body') !== -1,
    "'^title' and '^body' become '<<title' and '<<body'");
  test(r.text.indexOf('^') === -1, "no '^' left");

  r = portOf(cls("'^ { padding: 6px 0; }'"));
  test(r.changes.length === 1 && r.text.indexOf("css: '<< { padding: 6px 0; }'") !== -1,
    'a single-quoted css: value is switched');

  console.log('left alone');
  r = portOf(cls(B + '<< { color: red; } <<title { }' + B));
  test(r.changes.length === 0, "'<<' is not touched");

  r = portOf(cls(B + '^ [class^=foo] { color: red; }' + B));
  test(r.changes.length === 1 && r.text.indexOf('<< [class^=foo]') !== -1,
    "the '^' of [class^=x] stays");

  r = portOf(cls(B + '^ { content: "^"; } /* ^ is old */ ^a::after { content: \'^b\'; }' + B));
  test(r.changes.length === 2,
    "'^' in a CSS string or comment stays (" + r.changes.length + ' changes)');
  test(r.text.indexOf('content: "^"') !== -1 && r.text.indexOf('/* ^ is old */') !== -1 &&
    r.text.indexOf("'^b'") !== -1,
    'string and comment text unchanged');

  var js =
    "foam.CLASS({\n" +
    "  name: 'Y',\n" +
    "  documentation: '^ { color: red; }',\n" +
    "  // css: `^ { color: red; }`\n" +
    "  methods: [\n" +
    "    function f(a, b) {\n" +
    "      var re = /^abc`'\"/;\n" +
    "      var s  = 'css: `^ { }`';\n" +
    "      return a ^ b ? re : { css: x ^ y };\n" +
    "    }\n" +
    "  ]\n" +
    "});\n";
  r = portOf(js);
  test(r.changes.length === 0 && r.text === js,
    "'^' in JavaScript code, comments, strings and regexes stays");
  test(r.skipped.length === 1 && r.skipped[0].reason === 'not a string literal',
    'a css: holding an expression is reported');

  var sh = "var css = '^ { a: b; }';\nfoam.CLASS({ name: 'A8', css });\nfoam.CLASS({ name: 'A9', css, methods: [] });\n";
  r = portOf(sh);
  test(r.changes.length === 0 && r.skipped.length === 2 &&
       r.skipped[0].reason === 'shorthand, not a string literal' && r.skipped[1].line === 3,
    'a shorthand { css } is reported, not switched');
  r = portOf("f(a, css, b); g(css); var { css } = x; [ css, 1 ];\n");
  test(r.skipped.length === 0, 'css as an argument, a destructured name or an array item is not a key');

  r = portOf(cls("{ 'font-family': 'monospace' }"));
  test(r.changes.length === 0 && r.skipped.length === 0,
    'a css: style map ({ ... }) is not listed');
  r = portOf(cls("[ 'a', 'b' ]"));
  test(r.changes.length === 0 && r.skipped.length === 0, 'a css: array is not listed');

  r = portOf(cls(B + '^^x { a: b; }' + B));
  test(r.changes.length === 0, "'^^x' is left alone");
  r = portOf(cls(B + 'a <^x { a: b; }' + B));
  test(r.changes.length === 0, "'<^x' is left alone");
  r = portOf(cls(B + '^\n  .x { a: b; }' + B));
  test(r.changes.length === 0,
    "a '^' right before a line break is left alone (FOAM never expands it)");

  var re1 = "if ( a ) /\"/.test(s); var t = \"x\"; var doc = \"{ css: '^a { color: red; }' }\";\n";
  r = portOf(re1);
  test(r.changes.length === 0 && r.text === re1,
    "a regex right after 'if ( ... )' is read as a regex, not a division");
  var re2 = "while ( a ) /'/.test(s); var doc = '{ css: `^a { }` }';\n" +
    "foam.CLASS({ name: 'W', css: '^ { a: b; }' });\n";
  r = portOf(re2);
  test(r.changes.length === 1 && r.text.indexOf("doc = '{ css: `^a { }` }'") !== -1,
    "a regex after 'while ( ... )' too");
  var div = "var x = ( a ) / 2; var y = f(b) / 3; foam.CLASS({ name: 'D', css: '^ { a: b; }' });\n";
  test(portOf(div).changes.length === 1, "a '/' after any other ')' is still a division");

  var DOC = 'var doc = "{ css: \'^a { color: red; }\' }";\n';
  [
    [ 'var m = n++ / 2, p = "/"; ' + DOC, "a '/' after a postfix ++ is a division" ],
    [ 'var m = n-- / 2, p = "/"; ' + DOC, "a '/' after a postfix -- is a division" ],
    [ 'var m = a[0]++ / 2, p = "/"; ' + DOC, "a '/' after a[0]++ is a division" ],
    [ 'var d = t.with( x ) / 2, p = "/"; ' + DOC, "a '/' after a method named with is a division" ],
    [ 'var d = t . while ( x ) / 2, p = "/"; ' + DOC,
      "a '/' after 't . while ( x )' is a division" ],
    [ 'var d = t.return / 2, p = "/"; ' + DOC,
      "a '/' after a property named return is a division" ],
    [ 'async function f() { for await ( var x of y ) /"/.test(x); ' + DOC + '}\n',
      "a regex after 'for await ( ... )' is a regex" ]
  ].forEach(function(c) {
    r = portOf(c[0]);
    test(r.changes.length === 0 && r.text === c[0], c[1]);
  });
  [
    [ 'x = a / /"/, y = "{ css: \'^a {}\' }";\n', "a regex right after a '/' division" ],
    [ 'var r = [.../"/]; var y = "{ css: \'^a {}\' }";\n', "a regex right after a spread" ],
    [ 'var v = this.#in / 2, p = "/"; ' + DOC, "a '/' after a private name such as #in divides" ],
    [ 'var n = { a: 1 } / 2, p = "/"; ' + DOC, "a '/' after an object's '}' divides" ],
    [ 'var n = f({ a: 1 } / 2, "/"); ' + DOC, "a '/' after an object argument divides" ],
    [ 'function g() { return { a: 1 } / 2, "/"; } ' + DOC, "a '/' after 'return { ... }' divides" ],
    [ 'var o = { a: { b: 1 } / 2, c: "/" }; ' + DOC, "a '/' after an object inside an object divides" ],
    [ 'var m = function() {} / 2, p = "/"; ' + DOC, "a '/' after a function expression divides" ],
    [ 'var m = function f(a) {} / 2, p = "/"; ' + DOC, "a '/' after a named function expression divides" ],
    [ 'var m = function* () {} / 2, p = "/"; ' + DOC, "a '/' after a generator expression divides" ],
    [ 'if ( a ) { b(); } /"/.test(s); ' + DOC, "a regex right after an if block's '}'" ],
    [ 'if ( a ) {} else { b(); } /"/.test(s); ' + DOC, "a regex right after an else block's '}'" ],
    [ 'function f() {} /"/.test(s); ' + DOC, "a regex right after a function declaration" ],
    [ 'switch ( a ) { case 1: { b(); } /"/.test(s); } ' + DOC, "a regex right after a block in a case" ],
    [ 'var h = x => {}\n/"/.test(s); ' + DOC, "a regex right after an arrow function's body" ],
    [ 'var h = x => /"/.test(x); ' + DOC, "a regex right after '=>'" ],
    [ 'foam.CLASS({ methods: [ function f() { l: { break l; } /"/.test(s); ' + DOC + '} ] });\n',
      "a regex right after a labelled block inside a method" ],
    [ 'function g() {\n  return\n  { a(); } /"/.test(s); ' + DOC + '}\n',
      "a regex after a block that follows 'return' and a line break" ],
    [ 'function* g() {\n  yield\n  { a(); } /"/.test(s); ' + DOC + '}\n',
      "a regex after a block that follows 'yield' and a line break" ]
  ].forEach(function(c) {
    r = portOf(c[0]);
    test(r.changes.length === 0 && r.text === c[0], c[1]);
  });

  var CLS = "foam.CLASS({ name: 'E', css: '^ { a: b; }' });\n";
  [
    [ "var s = 'x\\\r\ny'; " + CLS, "a line continuation with CRLF stays inside the string" ],
    [ '// note\r' + CLS, "a // comment ends at a lone CR" ],
    [ '// note\u2028' + CLS, "a // comment ends at U+2028" ],
    [ '// note\u2029' + CLS, "a // comment ends at U+2029" ]
  ].forEach(function(c) {
    test(portOf(c[0]).changes.length === 1, c[1]);
  });

  var pre = 'var m = ++n / 2; foam.CLASS({ name: \'P\', css: \'^ { a: b; }\' });\n';
  test(portOf(pre).changes.length === 1, "a '/' after a prefix ++ is still a division");

  console.log('skipped');
  r = portOf(cls(B + '^ { width: ${this.w}px; }' + B));
  test(onlySkipped(r, 'has ${...}'),
    'a css: template with ${...} is left alone and reported');

  r = portOf(cls("'^ { color: red; }' + extra"));
  test(onlySkipped(r, 'not a plain string literal'),
    'a css: string joined with + is left alone and reported');

  console.log('escapes');
  var esc = cls(B + '^ .icon::before { content: \'\\\\f00c\'; }\\n  ^x { }' + B);
  r = portOf(esc);
  test(r.changes.length === 2 &&
    r.text.indexOf("<< .icon::before { content: '\\\\f00c'; }\\n  <<x { }") !== -1,
    "offsets stay right after an escape in the css: text");

  r = portOf(cls("'\\x5e { a: b; }'"));
  test(onlySkipped(r, "'^' written as an escape"),
    "a '^' written as \\x5e is left alone and reported");

  [ "'\\74^x { a: b; }'", "'\\01^x { a: b; }'", "'\\9^x { a: b; }'" ].forEach(function(v) {
    r = portOf(cls(v));
    test(onlySkipped(r, 'bad escape'),
      'a legacy octal escape is reported as a bad escape: ' + v);
  });

  var bad = [ "'\\u{110000} ^ { a: b; }'", "'\\u{41 ^ { a: b; }'" ];
  bad.forEach(function(v) {
    var ok = true;
    try { r = portOf(cls(v)); } catch (x) { ok = false; }
    test(ok && onlySkipped(r, 'bad escape'),
      'a bad \\u{...} escape is skipped and reported, not thrown: ' + v);
  });

  var open = "foam.CLASS({\n  name: 'O',\n  css: '^ { a: b; }\n});\n";
  r = portOf(open);
  test(r.text === open && onlySkipped(r, 'string not closed'),
    'an unclosed css: string is left alone and reported');

  console.log('runtime expands old and new the same way');
  var before = '^ { color: red; } ^title:hover, ^ > ^body { margin: 0; } ' +
    '[class^=x] { content: "^"; }';
  r = portOf(cls(B + before + B));
  var after = r.text.split(B)[1];
  test(port.expandSelf(before) === port.expandSelf(after), 'same CSS after the runtime rewrite');

  console.log('idempotent');
  var once = portOf(cls(B + '^ { } ^a { } [x^=y] { }' + B)).text;
  test(portOf(once).changes.length === 0, 'a second run finds nothing');

  console.log('CSS axioms');
  var ax =
    "foam.CLASS({\n" +
    "  name: 'Z',\n" +
    "  axioms: [\n" +
    "    foam.u2.CSS.create({ code: `^ { color: red; }` }),\n" +
    "    { class: 'foam.u2.CSS', code: '^title { margin: 0; }' },\n" +
    "    foam.u2.CSS.create({ code: `<< { } [class^=x] { content: '^'; }` }),\n" +
    "    { class: 'foam.u2.Other', code: '^ { }' }\n" +
    "  ]\n" +
    "});\n";
  var axs = port.findCSSAxioms(ax, parser);
  test(axs.length === 2 && axs[0].line === 4 && axs[1].line === 5,
    "a CSS axiom with '^' in code: is listed, one without is not (" +
    JSON.stringify(axs.map(function(a) { return a.line; })) + ')');
  test(portOf(ax).changes.length === 0, 'a CSS axiom is not switched');

  console.log('command line');
  var dir  = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'portCSSSelf-'));
  var file = path_.join(dir, 'View.js');
  var jrl  = path_.join(dir, 'themes.jrl');
  var src  = cls(B + '^ { color: red; }\n  ^title { }' + B);
  var jsrc = 'p({"class":"foam.core.theme.Theme","customCSS":"^ {\\n  color: red;\\n}"})\n' +
             'p({"pattern":"^report\\\\.D(\\\\d{6})\\\\.csv$"})\n';
  var axFile = path_.join(dir, 'Axiom.js');
  fs_.writeFileSync(file, src);
  fs_.writeFileSync(jrl, jsrc);
  fs_.writeFileSync(axFile, ax);

  var out  = [];
  var code = port.run([ dir ], function(l) { out.push(l); });
  var text = out.join('\n');
  test(code === 0, 'dry run exits 0');
  test(fs_.readFileSync(file, 'utf8') === src, 'dry run writes nothing');
  test(/View\.js: 2/.test(text) && /To switch: 2 '\^' in 1 files/.test(text),
    'dry run prints the count per file and the total');
  test(/themes\.jrl:1 /.test(text) && ! /themes\.jrl:2 /.test(text),
    'a .jrl line with CSS is listed, a regex pattern is not');
  test(/Axiom\.js:4 /.test(text) && /Axiom\.js:5 /.test(text) && ! /Axiom\.js:6 /.test(text),
    'the report lists CSS axioms by file:line');
  test(out.indexOf(path_.join(dir, 'View.js') + ': 2') !== -1,
    'a path outside the current folder is printed in full');

  test(port.run([ '--check', dir ], function() {}) === 3, '--check exits 3 when there is a ^ to switch');
  test(fs_.readFileSync(file, 'utf8') === src, '--check writes nothing');
  test(port.run([ '--check', '--write', dir ], function() {}, function() {}) === 1,
    '--check with --write exits 1');

  fs_.chmodSync(file, 0o664);
  var res = child_.spawnSync(process.execPath, [ TOOL, '--write', dir ], { encoding: 'utf8' });
  test(res.status === 0, '--write exits 0');
  test(fs_.readFileSync(file, 'utf8') === src.replace(/\^/g, '<<'), '--write saves the change');
  test(( fs_.statSync(file).mode & 0o777 ) === 0o664, '--write keeps the file mode, group write too');
  test(fs_.readdirSync(dir).every(function(n) { return n.indexOf('portCSSSelf-tmp') === -1; }),
    '--write leaves no temp file');
  test(fs_.readFileSync(jrl, 'utf8') === jsrc, '.jrl files are never written');
  test(fs_.readFileSync(axFile, 'utf8') === ax, 'CSS axioms are never written');

  out  = [];
  code = port.run([ dir ], function(l) { out.push(l); });
  test(code === 0 && /To switch: 0 '\^' in 0 files/.test(out.join('\n')),
    'a run after --write finds 0');
  test(port.run([ '--check', dir ], function() {}) === 0, '--check exits 0 when nothing is left');


  var errs = [];
  out = [];
  test(port.run([], function() {}, function() {}) === 1, 'no path exits 1');
  code = port.run([ path_.join(dir, 'missing') ],
    function(l) { out.push(l); }, function(l) { errs.push(l); });
  test(code === 1 && /Not found/.test(errs.join('\n')) && ! /Not found/.test(out.join('\n')),
    "a missing path exits 1, 'Not found' goes to stderr");
  res = child_.spawnSync(process.execPath, [ TOOL, '--bogus' ], { encoding: 'utf8' });
  test(res.status === 1 && /Unknown option/.test(res.stderr) && ! /Unknown option/.test(res.stdout),
    "an unknown option exits 1, 'Unknown option' goes to stderr");

  console.log('bytes kept');
  var d2 = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'portCSSSelf-'));
  var latin = Buffer.concat([
    Buffer.from('// caf'), Buffer.from([ 0xe9 ]),
    Buffer.from("\nfoam.CLASS({ name: 'L1', css: '^ { a: b; }' });\n") ]);
  var latinFile = path_.join(d2, 'Latin.js');
  fs_.writeFileSync(latinFile, latin);
  var crlf = "\ufefffoam.CLASS({\r\n  name: 'C',\r\n  css: `\r\n" +
    "    ^ { a: b; }\r\n    ^x { }\r\n  `\r\n});\r\n";
  var crlfFile = path_.join(d2, 'Crlf.js');
  fs_.writeFileSync(crlfFile, crlf);
  var locked = path_.join(d2, 'Locked.js');
  fs_.writeFileSync(locked, cls("'^ { a: b; }'"));
  fs_.chmodSync(locked, 0);
  fs_.symlinkSync(crlfFile, path_.join(d2, 'Link.js'));
  fs_.mkdirSync(path_.join(d2, 'real'));
  fs_.symlinkSync(path_.join(d2, 'real'), path_.join(d2, 'linkdir'));
  out  = [];
  errs = [];
  code = port.run([ '--write', d2 ], function(l) { out.push(l); }, function(l) { errs.push(l); });
  text = out.join('\n');
  var errText = errs.join('\n');
  test(Buffer.compare(fs_.readFileSync(latinFile), latin) === 0,
    'a file that is not UTF-8 is not written');
  test(/Latin\.js +not UTF-8/.test(text), "it is listed as 'not UTF-8'");
  test(fs_.readFileSync(crlfFile, 'utf8') === crlf.replace(/\^/g, '<<'),
    'CRLF line ends and a BOM are kept byte for byte');
  test(/Locked\.js +/.test(errText) && ! /Locked\.js/.test(text) &&
    /Switched 2 '\^' in 1 files/.test(text),
    'a file that fails is listed on stderr and the run goes on');
  test(code === 2, 'a run with a failed file exits 2 (' + code + ')');

  var d3 = fs_.mkdtempSync(path_.join(os_.tmpdir(), 'portCSSSelf-'));
  var ro = path_.join(d3, 'ReadOnly.js');
  fs_.writeFileSync(ro, cls("'^ { a: b; }'"));
  fs_.chmodSync(ro, 0o444);
  errs = [];
  code = port.run([ '--write', ro ], function() {}, function(l) { errs.push(l); });
  test(code === 2 && /ReadOnly\.js/.test(errs.join('\n')) &&
       fs_.readFileSync(ro, 'utf8').indexOf('<<') === -1,
    'a read-only file is not written and is listed as failed');
  var target = path_.join(d3, 'Target.js');
  fs_.writeFileSync(target, cls("'^ { a: b; }'"));
  var link = path_.join(d3, 'Given.js');
  fs_.symlinkSync(target, link);
  code = port.run([ '--write', link ], function() {}, function() {});
  test(code === 0 && fs_.lstatSync(link).isSymbolicLink() &&
       fs_.readFileSync(target, 'utf8').indexOf("'<< { a: b; }'") !== -1,
    'a symlink given as the path is written through, and stays a symlink');
  test(/Link\.js +symlink, not followed/.test(text) && /linkdir +symlink, not followed/.test(text),
    'symlinked files and folders are listed as not followed');
  out = [];
  test(port.run([ crlfFile ], function(l) { out.push(l); }, function() {}) === 0,
    'a clean run exits 0');
  fs_.chmodSync(locked, 0o644);
  fs_.rmSync(d2, { recursive: true, force: true });

  fs_.rmSync(dir, { recursive: true, force: true });

  console.log('\n' + passes + ' passed, ' + failures + ' failed');
  process.exitCode = failures ? 1 : 0;
}

if ( require.main === module ) main();
