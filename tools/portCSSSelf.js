#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Switches the deprecated '^' class shorthand to '<<' in css: values. FOAM
// stops replacing '^' on 2027-06-30. Any FOAM3 app can run it on its own
// source. Without --write it only reports. See --help.

var fs_   = require('fs');
var path_ = require('path');

var HELP = `Usage: node foam3/tools/portCSSSelf.js [--write | --check] <dir-or-file>...

Switches the deprecated '^' class shorthand to '<<' in css: values. FOAM
stops replacing '^' on 2027-06-30.

Reads every .js file under the given folders. Without --write it changes
nothing: it prints, per file, the number of '^' to switch and one line
before and after, then a total.

  --write   Save the changes. Each file is written to a temp file in its
            own folder and renamed over the old one, so the folder must
            be writable too.
  --check   Change nothing; exit 3 when there is a '^' to switch, so a CI
            job can stop new '^' from landing.
  --help    Show this text.

Only a '^' in a selector is changed. The '^' of [attr^=x] and a '^' inside
a CSS string or comment stay as they are.

Every css: key whose value is a string is switched, in any object, not only
in a foam.CLASS: inner classes, classes defined inside methods, and plain
objects too. The editor may not flag a '^' in some of those.

Not changed, listed for a manual check:
  - a css: value with \${...} in it, or one that is not a plain string,
    such as css: someVar or the shorthand { css }
  - foam.u2.CSS axioms (CSS.create({ code: ... }) or
    { class: 'foam.u2.CSS', code: ... }) whose code: has a '^'
  - .jrl files whose text looks like CSS with a '^' in it

Skipped: folders named node_modules, build or target, and folders whose
name starts with '.'. Symlinks inside a folder, .js files over 20 MB and
files that are not UTF-8 are listed and left alone. .jrl files over 20 MB
are data and are skipped without a line.

Exit code 0 on success, 1 on bad arguments, 2 when a file failed to read
or write (listed on stderr; the other files are still done), 3 with
--check when there is a '^' to switch.`;

var SKIP_DIRS = { node_modules: true, build: true, target: true };

// Larger files are data, not source. They are listed, not read.
var MAX_BYTES = 20 * 1024 * 1024;

// The class name FOAM puts in place of '^' and '<<'. Any name works: it is
// only used to compare the CSS before and after a change.
var CHECK_BASE = '.portCSSSelf-check';

var parser_ = null;

function loadCSSParser() {
  // Loads foam3's CSS grammar, the one the language server uses. Takes a
  // second or two.
  if ( parser_ ) return parser_;
  var src   = path_.resolve(__dirname, '../src');
  var saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  var emit  = process.emitWarning;
  // FOAM prints notices while it loads. Keep them out of the report.
  console.log = console.warn = console.error = console.info = function() {};
  process.emitWarning = function() {};
  try {
    require(path_.join(src, 'foam_node.js'));
    foam.cwd = src;
    foam.require('pom', false, true);
  } finally {
    Object.assign(console, saved);
    process.emitWarning = emit;
  }
  parser_ = foam.lookup('foam.u2.parse.CSSParser').create();
  return parser_;
}

function expandSelf(text) {
  // The rewrite FOAM's runtime does (foam.u2.CSS expandCSS).
  return text.replace(/(?:<<|\^)(.)/g, function(m, next) {
    return /[A-Za-z0-9_-]/.test(next) ? CHECK_BASE + '-' + next : CHECK_BASE + next;
  });
}


// JavaScript scanning. Just enough to find css: keys outside comments,
// strings and regular expressions.

var REGEX_AFTER_WORD = {
  'return': true, 'typeof': true, 'instanceof': true, 'in': true, 'of': true,
  'new': true, 'delete': true, 'void': true, 'throw': true, 'case': true,
  'do': true, 'else': true, 'yield': true, 'await': true
};

function isIdStart(c) { return /[A-Za-z_$]/.test(c); }
function isIdPart(c)  { return /[A-Za-z0-9_$]/.test(c); }

function skipSpace(s, i) {
  // Returns the index of the next character that is not white space or
  // part of a comment.
  var n = s.length;
  while ( i < n ) {
    var c = s[i];
    if ( /\s/.test(c) ) { i++; continue; }
    if ( c === '/' && s[i + 1] === '/' ) {
      while ( i < n && ! /[\n\r\u2028\u2029]/.test(s[i]) ) i++;
      continue;
    }
    if ( c === '/' && s[i + 1] === '*' ) {
      var j = s.indexOf('*/', i + 2);
      i = j < 0 ? n : j + 2;
      continue;
    }
    break;
  }
  return i;
}

function endOfString(s, i) {
  // i is at an opening ' or ". Returns the index after the closing quote.
  var q = s[i], n = s.length;
  for ( var j = i + 1 ; j < n ; j++ ) {
    var c = s[j];
    if ( c === '\\' ) {
      // A backslash before CRLF continues the line past both characters.
      j += s[j + 1] === '\r' && s[j + 2] === '\n' ? 2 : 1;
      continue;
    }
    if ( c === q ) return j + 1;
    if ( c === '\n' ) return j;
  }
  return n;
}

function endOfTemplate(s, i) {
  // i is at an opening backtick. Returns { end, interpolated }.
  var n = s.length, interpolated = false;
  for ( var j = i + 1 ; j < n ; j++ ) {
    var c = s[j];
    if ( c === '\\' ) { j++; continue; }
    if ( c === '`' ) return { end: j + 1, interpolated: interpolated };
    if ( c === '$' && s[j + 1] === '{' ) {
      interpolated = true;
      j = scan(s, j + 2, true, null) - 1;
    }
  }
  return { end: n, interpolated: interpolated };
}

function endOfRegex(s, i) {
  // i is at the opening '/'. Returns the index after the flags, or -1 when
  // the line ends first, so the '/' was not a regular expression.
  var n = s.length, inClass = false;
  for ( var j = i + 1 ; j < n ; j++ ) {
    var c = s[j];
    if ( c === '\n' ) return -1;
    if ( c === '\\' ) { j++; continue; }
    if ( c === '[' ) inClass = true;
    else if ( c === ']' ) inClass = false;
    else if ( c === '/' && ! inClass ) {
      j++;
      while ( j < n && isIdPart(s[j]) ) j++;
      return j;
    }
  }
  return -1;
}

// Words whose '( ... )' may be followed by a statement that is a regex.
var LOOP_HEADS = { 'if': true, 'while': true, 'for': true, 'with': true };

// Object keys scan() reports.
var KEYS = { css: true, code: true, 'class': true };

// Characters after which a '{' opens an object, not a block: 'x = {'.
var VALUE_AFTER = '(,=[!&|?+-*%<>~^/';

function startsValue(prev, lastWord, kinds, newline) {
  // True when the next token is a value, so a '{' there opens an object and
  // a 'function' there is an expression. Its '}' is then a value and a '/'
  // after it divides: 'x = { a: 1 } / 2'.
  if ( prev === 'word-op' ) {
    // A line break ends 'return' and 'yield': 'return\n{ a(); }' is a block.
    if ( newline && ( lastWord === 'return' || lastWord === 'yield' ) ) return false;
    return lastWord !== null && lastWord !== 'do' && lastWord !== 'else';
  }
  // After ':' only inside an object: '{ a: {' but not 'case 1: {'.
  if ( prev === ':' ) return kinds[kinds.length - 1] === 'object';
  return prev !== '' && VALUE_AFTER.indexOf(prev) !== -1;
}

function scan(s, i, inBraces, h) {
  // Walks JavaScript from i. For each css:, code: or class: key of an
  // object literal it calls h.key(name, keyStart, valueStart, brace), where
  // brace is the index of the object's '{'. For each CSS.create( it calls
  // h.create(index of the '('). With inBraces it stops after the '}' that
  // closes a ${...} and returns the index after it.
  var n = s.length, depth = 0, prev = '', braces = [];
  // The word before each '('. A '/' after the ')' of an if, while, for or
  // with starts a regex: 'if ( a ) /x/.test(s)'. A property such as the
  // with of t.with( x ) does not count.
  var parens = [], word = null;
  // kinds holds 'object', 'block' or 'fnbody' for each open '{'. fn is
  // 'expr' or 'decl' from a 'function' word until its '('; fnParens says the
  // same for each open '('. fnBody is true right after the ')' of a function
  // expression: its body holds statements, but its '}' is a value.
  // newline says a line break came before the current token.
  var kinds = [], fn = null, fnParens = [], fnBody = false, newline = false;
  // The open '(', '[' and '{', innermost last. A shorthand { css } counts
  // only when the innermost is an object's '{', not f(a, css).
  var nest = [];
  while ( i < n ) {
    var c = s[i];
    if ( /\s/.test(c) ) {
      if ( /[\n\r\u2028\u2029]/.test(c) ) newline = true;
      i++;
      continue;
    }
    if ( c === '/' && ( s[i + 1] === '/' || s[i + 1] === '*' ) ) {
      var after = skipSpace(s, i);
      if ( /[\n\r\u2028\u2029]/.test(s.substring(i, after)) ) newline = true;
      i = after;
      continue;
    }
    var lastNewline = newline;
    newline = false;
    var lastWord = word;
    word = null;
    var lastFnBody = fnBody;
    fnBody = false;
    if ( c === '\'' || c === '"' ) {
      var end = endOfString(s, i);
      var key = s.substring(i + 1, end - 1);
      if ( KEYS[key] === true ) maybeKey(s, key, i, end, prev, braces, h);
      prev = 'value';
      i = end;
      continue;
    }
    if ( c === '`' ) {
      i = endOfTemplate(s, i).end;
      prev = 'value';
      continue;
    }
    if ( c === '/' ) {
      var re = ( prev === '' || prev === 'word-op' || prev === '=>' ||
                 '(,=:[!&|?{};+-*%<>~^/'.indexOf(prev) !== -1 ) ? endOfRegex(s, i) : -1;
      if ( re !== -1 ) { i = re; prev = 'value'; continue; }
      prev = '/';
      i++;
      continue;
    }
    if ( isIdStart(c) ) {
      var j = i;
      while ( j < n && isIdPart(s[j]) ) j++;
      var w    = s.substring(i, j);
      var prop = prev === '.' || prev === '#';
      var inObject = nest[nest.length - 1] === '{' && kinds[kinds.length - 1] === 'object';
      if ( KEYS[w] === true && ! prop ) maybeKey(s, w, i, j, prev, braces, h, inObject);
      if ( w === 'CSS' && h ) {
        var m = /^\s*\.\s*create\s*\(/.exec(s.substring(j, j + 40));
        if ( m ) h.create(j + m[0].length - 1);
      }
      // 'for await ( ... )' heads a loop like 'for ( ... )'.
      word = prop ? null : ( w === 'await' && lastWord === 'for' ) ? 'for' : w;
      // 'function' keeps fn through its name: 'x = function f() {}'.
      if ( w === 'function' && ! prop ) fn = startsValue(prev, lastWord, kinds, lastNewline) ? 'expr' : 'decl';
      else if ( lastWord !== 'function' ) fn = null;
      prev = REGEX_AFTER_WORD[w] === true && ! prop ? 'word-op' : 'value';
      i = j;
      continue;
    }
    // A spread is followed by a value, as an operator is.
    if ( c === '.' && s[i + 1] === '.' && s[i + 2] === '.' ) {
      prev = ',';
      i += 3;
      continue;
    }
    // A postfix ++ or -- leaves a value, so a '/' after it divides.
    if ( ( c === '+' || c === '-' ) && s[i + 1] === c && prev === 'value' ) {
      i += 2;
      continue;
    }
    // An arrow's '{' opens a block, and a regex may follow '=>'.
    if ( c === '=' && s[i + 1] === '>' ) {
      prev = '=>';
      i += 2;
      continue;
    }
    if ( /[0-9]/.test(c) ) {
      while ( i < n && /[0-9A-Za-z_.]/.test(s[i]) ) i++;
      prev = 'value';
      continue;
    }
    if ( c === '{' || c === '(' || c === '[' ) nest.push(c);
    if ( c === '}' || c === ')' || c === ']' ) nest.pop();
    if ( c === '{' ) {
      depth++;
      braces.push(i);
      kinds.push(lastFnBody ? 'fnbody' : startsValue(prev, lastWord, kinds, lastNewline) ? 'object' : 'block');
    }
    var closed = null;
    if ( c === '}' ) {
      if ( inBraces && depth === 0 ) return i + 1;
      depth--;
      braces.pop();
      closed = kinds.pop();
    }
    if ( c === '(' ) {
      parens.push(lastWord);
      fnParens.push(fn);
      fn = null;
    } else if ( c !== '*' ) {
      // 'function* g()' keeps fn across the '*'.
      fn = null;
    }
    if ( c === ')' ) {
      var head = parens.pop();
      fnBody = fnParens.pop() === 'expr';
      prev = LOOP_HEADS[head] === true ? 'word-op' : 'value';
    } else {
      prev = c === ']' || closed === 'object' || closed === 'fnbody' ? 'value' : c;
    }
    i++;
  }
  return n;
}

function maybeKey(s, name, keyStart, keyEnd, prev, braces, h, shorthand) {
  // A key follows '{' or ',' and is followed by ':'. With shorthand, a key
  // followed by ',' or '}' is reported too, { css }, with value index -1.
  if ( ! h || ( prev !== '{' && prev !== ',' ) ) return;
  var colon = skipSpace(s, keyEnd);
  if ( shorthand && ( s[colon] === ',' || s[colon] === '}' ) ) {
    h.key(name, keyStart, -1, braces[braces.length - 1]);
    return;
  }
  if ( s[colon] !== ':' ) return;
  h.key(name, keyStart, skipSpace(s, colon + 1), braces[braces.length - 1]);
}

function lineOf(s, offset) {
  var line = 1;
  for ( var i = 0 ; i < offset ; i++ ) if ( s.charCodeAt(i) === 10 ) line++;
  return line;
}

function readValue(s, key, v) {
  // The value at v as { key, line, start, end, quote, skip }, or null for an
  // object or array. start and end bound the text inside the quotes; skip
  // says why the value is left alone.
  var c   = s[v];
  var rec = { key: key, line: lineOf(s, key), start: -1, end: -1, quote: c, skip: null };
  var end;
  if ( v < 0 ) {
    rec.skip = 'shorthand, not a string literal';
    return rec;
  }
  if ( c === '`' ) {
    var t = endOfTemplate(s, v);
    end = t.end;
    if ( t.interpolated ) rec.skip = 'has ${...}';
  } else if ( c === '\'' || c === '"' ) {
    end = endOfString(s, v);
  } else if ( c === '{' || c === '[' ) {
    // A style map or a list, never FOAM CSS text.
    return null;
  } else {
    rec.skip = 'not a string literal';
    return rec;
  }
  if ( s[end - 1] !== c || end - v < 2 ) {
    rec.skip = 'string not closed';
  } else if ( ! rec.skip ) {
    var after = s[skipSpace(s, end)];
    if ( after !== ',' && after !== '}' && after !== undefined ) {
      rec.skip = 'not a plain string literal';
    }
  }
  rec.start = v + 1;
  rec.end   = end - 1;
  return rec;
}

function findCSSValues(s) {
  // Every css: value in the file, as readValue() returns it.
  var out = [];
  scan(s, 0, false, {
    key: function(name, key, v) {
      var rec = name === 'css' && readValue(s, key, v);
      if ( rec ) out.push(rec);
    },
    create: function() {}
  });
  return out;
}

function deprecatedCarets(parser, text) {
  // Offsets in text of each '^' the language server marks as deprecated.
  var out = [];
  parser.walk(parser.parse(text), function(n) {
    if ( n.kind === 'caret' && n.raw === '^' && ! n.context && ! n.inAttr ) out.push(n.start);
  });
  return out;
}

function findCSSAxioms(s, parser) {
  // foam.u2.CSS axioms, made with CSS.create({ code: ... }) or written as
  // { class: 'foam.u2.CSS', code: ... }, whose code: holds a deprecated '^'.
  // Returns [ { line, snippet } ]. These are listed, never changed.
  var owners = {}; // index of an axiom's '{' -> index where the axiom starts
  var codes  = [];
  scan(s, 0, false, {
    key: function(name, key, v, brace) {
      if ( v < 0 ) return;
      var rec = name === 'code' && readValue(s, key, v);
      if ( rec ) codes.push({ brace: brace, rec: rec });
      if ( name === 'class' && /^['"]foam\.u2\.CSS['"]/.test(s.substr(v, 13)) ) {
        owners[brace] = brace;
      }
    },
    create: function(paren) {
      var brace = skipSpace(s, paren + 1);
      if ( s[brace] === '{' ) owners[brace] = paren;
    }
  });
  var out = [];
  codes.forEach(function(c) {
    if ( owners[c.brace] === undefined || c.rec.start < 0 ) return;
    // An interpolation is blanked: only the text around it is CSS.
    var raw = s.substring(c.rec.start, c.rec.end).replace(/\$\{[^}]*\}/g, function(m) {
      return m.replace(/[^\n]/g, ' ');
    });
    var cooked = cook(raw);
    if ( ! cooked || ! deprecatedCarets(parser, cooked.text).length ) return;
    var at = owners[c.brace];
    var ls = s.lastIndexOf('\n', at) + 1;
    out.push({ line: lineOf(s, at), snippet: s.substring(ls, ls + 80).split('\n')[0] });
  });
  return out;
}

var SIMPLE_ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v' };

function cook(raw) {
  // The string value of a JavaScript literal's raw text, plus map[i]: the
  // index in raw where character i of the value comes from. Returns null
  // for an escape JavaScript would reject, such as \u{110000}.
  var text = '', map = [], n = raw.length;
  function put(str, at) {
    for ( var k = 0 ; k < str.length ; k++ ) { text += str[k]; map.push(at); }
  }
  for ( var i = 0 ; i < n ; ) {
    var c = raw[i];
    if ( c === '\r' ) {
      put('\n', i);
      i += raw[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if ( c !== '\\' ) { put(c, i); i++; continue; }
    var d = raw[i + 1];
    if ( SIMPLE_ESCAPES[d] ) { put(SIMPLE_ESCAPES[d], i); i += 2; continue; }
    if ( d === '\r' ) { i += raw[i + 2] === '\n' ? 3 : 2; continue; }
    if ( d === '\n' || d === '\u2028' || d === '\u2029' ) { i += 2; continue; }
    if ( d === 'x' ) {
      if ( ! /^[0-9A-Fa-f]{2}$/.test(raw.substr(i + 2, 2)) ) return null;
      put(String.fromCharCode(parseInt(raw.substr(i + 2, 2), 16)), i);
      i += 4;
      continue;
    }
    if ( d === 'u' && raw[i + 2] === '{' ) {
      var close = raw.indexOf('}', i);
      var hex   = close < 0 ? '' : raw.substring(i + 3, close);
      if ( ! /^[0-9A-Fa-f]{1,6}$/.test(hex) || parseInt(hex, 16) > 0x10FFFF ) return null;
      put(String.fromCodePoint(parseInt(hex, 16)), i);
      i = close + 1;
      continue;
    }
    if ( d === 'u' ) {
      if ( ! /^[0-9A-Fa-f]{4}$/.test(raw.substr(i + 2, 4)) ) return null;
      put(String.fromCharCode(parseInt(raw.substr(i + 2, 4), 16)), i);
      i += 6;
      continue;
    }
    // A legacy octal escape (\1 to \9, or \0 before a digit) is rejected
    // in templates and strict code, and means another character elsewhere.
    if ( /[1-9]/.test(d) || ( d === '0' && /[0-9]/.test(raw[i + 2] || '') ) ) return null;
    if ( d === '0' ) { put('\0', i); i += 2; continue; }
    put(d === undefined ? '' : d, i);
    i += 2;
  }
  map.push(n);
  return { text: text, map: map };
}

function portText(s, parser) {
  // Returns { text, changes: [ { offset, line } ], skipped: [ { line, reason, snippet } ] }
  // for one .js file's source. changes are in file order.
  var values  = findCSSValues(s);
  var edits   = [];
  var skipped = [];

  values.forEach(function(v) {
    function skip(reason) {
      var snippet = s.substring(v.key, v.key + 60).split('\n')[0];
      skipped.push({ line: v.line, reason: reason, snippet: snippet });
    }
    if ( v.skip ) {
      // Listed even with no '^' in sight: the script can't see inside it.
      skip(v.skip);
      return;
    }
    var raw = s.substring(v.start, v.end);
    // A '^' can also be written as an escape, such as \x5e.
    if ( raw.indexOf('^') === -1 && raw.indexOf('\\') === -1 ) return;

    var cooked = cook(raw);
    if ( ! cooked ) { skip('bad escape'); return; }
    var found  = [];
    var bad    = false;
    deprecatedCarets(parser, cooked.text).forEach(function(k) {
      var at = cooked.map[k];
      if ( raw[at] !== '^' ) bad = true;
      found.push({ cooked: k, raw: at });
    });
    if ( ! found.length ) return;
    if ( bad ) { skip("'^' written as an escape"); return; }

    // The runtime must expand the old and the new text the same way.
    var after = cooked.text;
    for ( var i = found.length - 1 ; i >= 0 ; i-- ) {
      var k = found[i].cooked;
      after = after.substring(0, k) + '<<' + after.substring(k + 1);
    }
    if ( expandSelf(after) !== expandSelf(cooked.text) ) {
      skip('switching would change the CSS');
      return;
    }
    found.forEach(function(f) { edits.push(v.start + f.raw); });
  });

  edits.sort(function(a, b) { return a - b; });
  var text = s;
  for ( var i = edits.length - 1 ; i >= 0 ; i-- ) {
    text = text.substring(0, edits[i]) + '<<' + text.substring(edits[i] + 1);
  }
  return {
    text:    text,
    changes: edits.map(function(o) { return { offset: o, line: lineOf(s, o) }; }),
    skipped: skipped
  };
}

function scanJrl(s) {
  // Lines of a journal whose text looks like a CSS rule using '^': a '^',
  // maybe a selector, a '{', then 'name: value' before the '}'.
  var re   = new RegExp(
    '\\^[\\w-]*(?:[\\s:.#>+~,=*()\\[\\]\\w-]|\\\\[nt]){0,80}' +  // '^', maybe a selector
    '\\{[^{}]{0,300}?[A-Za-z-]+\\s*:\\s*[^{};]+[;}]',             // '{', then 'name: value'
    'g');
  var hits = [];
  var seen = {};
  var m;
  while ( ( m = re.exec(s) ) ) {
    var line = lineOf(s, m.index);
    if ( seen[line] ) continue;
    seen[line] = true;
    hits.push({ line: line, snippet: s.substr(m.index, 60).split('\n')[0] });
  }
  return hits;
}

function collectFiles(paths) {
  // Returns { js: [], jrl: [], missing: [], links: [] }. Symlinks met
  // inside a folder are listed in links, never followed.
  var out = { js: [], jrl: [], missing: [], links: [] };
  function add(f) {
    if ( /\.js$/.test(f) ) out.js.push(f);
    else if ( /\.jrl$/.test(f) ) out.jrl.push(f);
  }
  function walk(dir) {
    fs_.readdirSync(dir, { withFileTypes: true })
      .sort(function(a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; })
      .forEach(function(e) {
        var f = path_.join(dir, e.name);
        if ( e.isSymbolicLink() ) {
          out.links.push(f);
        } else if ( e.isDirectory() ) {
          if ( e.name[0] !== '.' && ! SKIP_DIRS[e.name] ) walk(f);
        } else if ( e.isFile() ) {
          add(f);
        }
      });
  }
  paths.forEach(function(p) {
    var st;
    try { st = fs_.statSync(p); } catch (x) { out.missing.push(p); return; }
    if ( st.isDirectory() ) walk(p);
    else add(p);
  });
  return out;
}

function clip(str) {
  str = str.trim();
  return str.length > 100 ? str.substring(0, 97) + '...' : str;
}

function show(cwd, f) {
  // The path to print: relative when inside cwd, else in full.
  var rel = path_.relative(cwd, f);
  return ! rel || rel.startsWith('..') ? path_.resolve(f) : rel;
}

function run(argv, print, printErr) {
  // Runs the tool. Returns the exit code. print(line) writes one line to
  // stdout, printErr(line) to stderr.
  print    = print    || function(l) { process.stdout.write(l + '\n'); };
  printErr = printErr || function(l) { process.stderr.write(l + '\n'); };
  var write = false, check = false, paths = [];
  for ( var i = 0 ; i < argv.length ; i++ ) {
    var a = argv[i];
    if ( a === '--help' || a === '-h' ) { print(HELP); return 0; }
    if ( a === '--write' ) { write = true; continue; }
    if ( a === '--check' ) { check = true; continue; }
    if ( a.startsWith('-') ) { printErr('Unknown option: ' + a + '\n\n' + HELP); return 1; }
    paths.push(a);
  }
  if ( ! paths.length ) { printErr(HELP); return 1; }
  if ( write && check ) { printErr('--write and --check do not go together.'); return 1; }

  var files = collectFiles(paths);
  if ( files.missing.length ) {
    printErr('Not found: ' + files.missing.join(', '));
    return 1;
  }

  var parser  = loadCSSParser();
  var cwd     = process.cwd();
  var total   = 0;
  var changed = 0;
  var skipped = [];
  var axioms  = [];
  var jrl     = [];
  var leftOut = files.links.map(function(f) { return show(cwd, f) + '  symlink, not followed'; });
  var failed  = [];

  function read(f, quiet) {
    // The file's text, or null when it is left alone. quiet leaves a file
    // over 20 MB out of the report.
    if ( fs_.statSync(f).size > MAX_BYTES ) {
      if ( ! quiet ) leftOut.push(show(cwd, f) + '  over 20 MB, not read');
      return null;
    }
    var buf = fs_.readFileSync(f);
    var s   = buf.toString('utf8');
    // Text that is not UTF-8 would change when written back.
    if ( ! Buffer.from(s, 'utf8').equals(buf) ) {
      leftOut.push(show(cwd, f) + '  not UTF-8, check by hand');
      return null;
    }
    return s;
  }

  function portFile(f) {
    var s = read(f);
    if ( s === null || ! /css/i.test(s) ) return;
    var r   = portText(s, parser);
    var rel = show(cwd, f);
    r.skipped.forEach(function(k) {
      skipped.push(rel + ':' + k.line + '  ' + k.reason + '  ' + clip(k.snippet));
    });
    if ( s.indexOf('CSS') !== -1 ) findCSSAxioms(s, parser).forEach(function(a) {
      axioms.push(rel + ':' + a.line + '  ' + clip(a.snippet));
    });
    if ( ! r.changes.length ) return;
    if ( write ) save(f, r.text);
    total += r.changes.length;
    changed++;
    var line = r.changes[0].line;
    print(rel + ': ' + r.changes.length);
    print('  ' + line + ': ' + clip(s.split('\n')[line - 1]));
    print('  ' + line + ': ' + clip(r.text.split('\n')[line - 1]));
  }

  function save(f, text) {
    // Writes a file next to f, then renames it over f, so a write that
    // fails partway leaves f as it was. A symlink given as a path is
    // followed, and a read-only file fails as a plain write would.
    f = fs_.realpathSync(f);
    fs_.accessSync(f, fs_.constants.W_OK);
    var mode = fs_.statSync(f).mode & 0o7777;
    var tmp  = f + '.portCSSSelf-tmp';
    try {
      fs_.writeFileSync(tmp, text);
      // writeFileSync's mode is cut by the umask; chmod is not.
      fs_.chmodSync(tmp, mode);
      fs_.renameSync(tmp, f);
    } catch (x) {
      try { fs_.unlinkSync(tmp); } catch (_) {}
      throw x;
    }
  }

  function scanFile(f) {
    // Data journals can be huge and are only read, so a big one is skipped
    // without a line.
    var s = read(f, true);
    if ( s === null ) return;
    scanJrl(s).forEach(function(h) {
      jrl.push(show(cwd, f) + ':' + h.line + '  ' + clip(h.snippet));
    });
  }

  // One file that fails to read or write never stops the run.
  function each(list, fn) {
    list.forEach(function(f) {
      try {
        fn(f);
      } catch (x) {
        failed.push(show(cwd, f) + '  ' + ( x && x.message || x ));
      }
    });
  }
  each(files.js, portFile);
  each(files.jrl, scanFile);

  function section(title, lines, out) {
    if ( ! lines.length ) return;
    out('');
    out(title + ' (' + lines.length + '):');
    lines.forEach(function(l) { out('  ' + l); });
  }
  section('css: values left alone, check by hand', skipped, print);
  section("foam.u2.CSS axioms with '^' in code:, check by hand", axioms, print);
  section(".jrl lines that look like CSS with '^', check by hand", jrl, print);
  section('Files left alone', leftOut, print);
  print('');
  print(( write ? 'Switched ' : 'To switch: ' ) + total + " '^' in " + changed + ' files.' +
    ( write ? '' : ' Dry run, nothing written. Add --write to apply.' ));
  // Exit 2 so a CI job can tell a failed file from a clean run.
  section('Files that failed to read or write', failed, printErr);
  if ( failed.length ) return 2;
  return check && total ? 3 : 0;
}

module.exports = {
  loadCSSParser: loadCSSParser,
  findCSSAxioms: findCSSAxioms,
  portText:      portText,
  expandSelf:    expandSelf,
  run:           run
};

if ( require.main === module ) process.exitCode = run(process.argv.slice(2));
