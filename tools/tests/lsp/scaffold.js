/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// ScaffoldHandler: foam.scaffold.newClass — class template, license-header
// harvest from a sibling file, package derivation, and the string-aware
// pom.js `files:` append. Handler-level only: every case builds a real
// temp-dir fixture on disk and reads the returned WorkspaceEdit. No server
// boot — the command carries no document text, so there is nothing an
// in-process JSON-RPC round trip would add here.

var h = require('./_harness');
var test = h.test, section = h.section;
var fs = h.fs, path = h.path, Q = h.Q;
var os = require('os');

var handler = foam.parse.lsp.handlers.ScaffoldHandler.create();

// --- temp fixture helpers -------------------------------------------------

var roots_ = [];

function tmpRoot() {
  var d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'foam-scaffold-'));
  roots_.push(d);
  return d;
}

function write(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
  return filePath;
}

function mkdir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

// --- WorkspaceEdit readers ------------------------------------------------

function createOp(r) {
  return r.edit.documentChanges.filter(function(c) { return c.kind === 'create'; })[0];
}

function editsFor(r, filePath) {
  var uri = 'file://' + filePath;
  var c = r.edit.documentChanges.filter(function(dc) {
    return ! dc.kind && dc.textDocument && dc.textDocument.uri === uri;
  })[0];
  return c ? c.edits : null;
}

/** Content the new class file gets — the whole file, inserted at 0:0. */
function contentOf(r, filePath) {
  var edits = editsFor(r, filePath);
  return edits ? edits[0].newText : null;
}

/** Apply a single zero-width/replacement TextEdit to `text`. */
function applyEdit(text, edit) {
  var start = h.analyzer.positionToOffset(text, edit.range.start);
  var end   = h.analyzer.positionToOffset(text, edit.range.end);
  return text.substring(0, start) + edit.newText + text.substring(end);
}

/**
 * Eval-parse a pom's source the way pmake does — a real `new Function` run
 * with foam.POM captured. Same technique as the i18n messageMap tests: an
 * appended entry that only "looks right" in a string comparison but breaks
 * the file's syntax fails HERE, loudly.
 */
function parsePom(text) {
  var captured = null;
  var fn = new Function('foam', text);
  fn({ POM: function(m) { captured = m; } });
  return captured;
}

/** Convenience: apply the pom edit from `r` to `pomText` and eval-parse it. */
function appliedPom(r, pomPath, pomText) {
  var edits = editsFor(r, pomPath);
  if ( ! edits ) return null;
  return parsePom(applyEdit(pomText, edits[0]));
}

var HEADER = [
  '/**',
  ' * @license',
  ' * Copyright 2026 The FOAM Authors. All Rights Reserved.',
  ' * http://www.apache.org/licenses/LICENSE-2.0',
  ' */'
].join('\n');

var POM_ONE = [
  'foam.POM({',
  "  name: 'demo',",
  '  files: [',
  '    { name: "A", flags: "js" }',
  '  ]',
  '});',
  ''
].join('\n');

// =========================================================================
section('ScaffoldHandler — header harvest + package derivation (src tree)');

var r1Root = tmpRoot();
var r1Dir  = mkdir(path.join(r1Root, 'src', 'foam', 'demo'));
write(path.join(r1Dir, 'Sibling.js'), HEADER + "\n\nfoam.CLASS({ package: 'foam.demo', name: 'Sibling' });\n");
write(path.join(r1Root, 'src', 'pom.js'), POM_ONE);

var r1     = handler.newClass({ dir: r1Dir, name: 'NewThing' });
var r1File = path.join(r1Dir, 'NewThing.js');
var r1Text = contentOf(r1, r1File);

test(!! r1Text, 'src-tree: a TextDocumentEdit carries the new file content');
test(r1Text.indexOf(HEADER) === 0, 'src-tree: content begins with the sibling block comment, verbatim');
test(r1Text.indexOf("package: " + Q + "foam.demo" + Q) !== -1,
  'src-tree: package derived from the path after the src/ segment (foam.demo)');
test(r1Text.indexOf("name: " + Q + "NewThing" + Q) !== -1, 'src-tree: name is the requested class name');
test(/foam\.CLASS\(\{/.test(r1Text), 'src-tree: content is a foam.CLASS() template');

var r1Create = createOp(r1);
test(!! r1Create && r1Create.uri === 'file://' + r1File,
  'src-tree: documentChanges opens with a CreateFile for the new path');
test(!! r1Create && r1Create.options && r1Create.options.overwrite === false,
  'src-tree: CreateFile refuses to overwrite');
test(r1.edit.documentChanges.indexOf(r1Create) === 0, 'src-tree: the CreateFile comes first');
test(r1.result.created === 'file://' + r1File, 'src-tree: result.created is the new file uri');
test(r1.result.pomUpdated === true, 'src-tree: result.pomUpdated is true');
test(r1.result.warning === undefined, 'src-tree: no warning when header and pom both resolved');

// A relative dir must resolve to the same absolute path everything else in
// the edit is built from — an unresolved 'a/b' would produce file://a/b/X.js,
// whose 'a' parses as a URI authority, while the pom edit stayed absolute.
var relDir = path.relative(process.cwd(), r1Dir);
var rRel   = handler.newClass({ dir: relDir, name: 'RelativeDir' });
var rRelFile = path.join(r1Dir, 'RelativeDir.js');

test(path.isAbsolute(relDir) === false, 'relative dir: the fixture argument really is relative');
test(rRel.result.created === 'file://' + rRelFile,
  'relative dir: result.created is the absolute file:// uri');
test(createOp(rRel).uri.indexOf('file:///') === 0,
  'relative dir: the CreateFile uri has an empty authority (file:///), not a hostname');
test(editsFor(rRel, path.join(r1Root, 'src', 'pom.js')) !== null,
  'relative dir: the pom edit and the file edit agree on the same tree');

// =========================================================================
section('ScaffoldHandler — no harvestable header');

var r2Root = tmpRoot();
var r2Dir  = mkdir(path.join(r2Root, 'src', 'foam', 'bare'));
// A sibling with NO leading block comment (a line comment is not one).
write(path.join(r2Dir, 'Plain.js'), "// not a block comment\nfoam.CLASS({ name: 'Plain' });\n");
write(path.join(r2Root, 'src', 'pom.js'), POM_ONE);

var r2     = handler.newClass({ dir: r2Dir, name: 'Bare' });
var r2Text = contentOf(r2, path.join(r2Dir, 'Bare.js'));

test(r2Text.indexOf('foam.CLASS(') === 0, 'no-header: content starts at foam.CLASS( — nothing invented');
test(typeof r2.result.warning === 'string' && /header/i.test(r2.result.warning),
  'no-header: warning names the missing header');
test(r2.result.pomUpdated === true, 'no-header: the pom append still happened');

// A leading block comment is just as often a class doc-comment; copying one
// in as a "license header" is silently wrong, so only a licence-bearing
// block qualifies.
var DOC_COMMENT = [
  '/**',
  ' * FOAM State Machine (FSM) Implementation',
  ' * Describes what this file does — no license anywhere in it.',
  ' */'
].join('\n');

var r2bRoot = tmpRoot();
var r2bDir  = mkdir(path.join(r2bRoot, 'src', 'foam', 'mixed'));
// 'A' sorts first, so a plain "first block comment wins" scan would take it.
write(path.join(r2bDir, 'ADocumented.js'), DOC_COMMENT + "\n\nfoam.CLASS({ name: 'ADocumented' });\n");
write(path.join(r2bDir, 'ZLicensed.js'), HEADER + "\n\nfoam.CLASS({ name: 'ZLicensed' });\n");
write(path.join(r2bRoot, 'src', 'pom.js'), POM_ONE);

var r2b     = handler.newClass({ dir: r2bDir, name: 'Picky' });
var r2bText = contentOf(r2b, path.join(r2bDir, 'Picky.js'));

test(r2bText.indexOf(HEADER) === 0,
  'doc-comment: the licensed sibling is harvested even though a doc-commented one sorts first');
test(r2bText.indexOf('FOAM State Machine') === -1,
  'doc-comment: the class doc-comment was not copied in as a license');
test(r2b.result.warning === undefined, 'doc-comment: a license WAS found, so no warning');

var r2cRoot = tmpRoot();
var r2cDir  = mkdir(path.join(r2cRoot, 'src', 'foam', 'docsonly'));
write(path.join(r2cDir, 'OnlyDoc.js'), DOC_COMMENT + "\n\nfoam.CLASS({ name: 'OnlyDoc' });\n");
write(path.join(r2cRoot, 'src', 'pom.js'), POM_ONE);

var r2c     = handler.newClass({ dir: r2cDir, name: 'NoLicense' });
var r2cText = contentOf(r2c, path.join(r2cDir, 'NoLicense.js'));

test(r2cText.indexOf('foam.CLASS(') === 0,
  'doc-comment only: nothing is harvested — content starts at foam.CLASS(');
test(typeof r2c.result.warning === 'string' && /header/i.test(r2c.result.warning),
  'doc-comment only: the no-header warning path is taken');

// =========================================================================
section('ScaffoldHandler — package derivation with no src/ segment');

var r3Root = tmpRoot();
var r3Dir  = mkdir(path.join(r3Root, 'proj', 'widgets', 'inner'));
var r3Pom  = write(path.join(r3Root, 'proj', 'pom.js'), POM_ONE);

var r3     = handler.newClass({ dir: r3Dir, name: 'Gadget' });
var r3Text = contentOf(r3, path.join(r3Dir, 'Gadget.js'));

test(r3Text.indexOf("package: " + Q + "widgets.inner" + Q) !== -1,
  'no-src: package derived from the path below the nearest pom.js dir');

var r3Pom2 = appliedPom(r3, r3Pom, POM_ONE);
test(!! r3Pom2, 'no-src: the pom edit targets the pom that supplied the package root');
test(r3Pom2.files.length === 2 && r3Pom2.files[1].name === 'widgets/inner/Gadget',
  'no-src: entry name is the path below the pom dir, no .js extension');
test(r3Pom2.files[1].flags === 'js|java', 'no-src: entry flags are js|java');

// =========================================================================
section('ScaffoldHandler — pom append: plain files: array');

var r4Root = tmpRoot();
var r4Dir  = mkdir(path.join(r4Root, 'demo'));
var r4Pom  = write(path.join(r4Root, 'pom.js'), POM_ONE);

var r4    = handler.newClass({ dir: r4Dir, name: 'NewThing' });
var r4Out = appliedPom(r4, r4Pom, POM_ONE);

test(!! r4Out, 'plain pom: the appended source eval-parses as a foam.POM call');
test(r4Out.files.length === 2, 'plain pom: the existing entry survives, one entry added');
test(r4Out.files[0].name === 'A' && r4Out.files[0].flags === 'js', 'plain pom: entry A is untouched');
test(r4Out.files[1].name === 'demo/NewThing', 'plain pom: new entry is named relative to the pom dir');
test(r4Out.files[1].name.indexOf('.js') === -1, 'plain pom: new entry name carries no .js extension');
test(r4Out.name === 'demo', 'plain pom: the pom name key is untouched');
test(r4.result.pomUpdated === true, 'plain pom: pomUpdated true');

// The insert lands inside the array, before its closing bracket.
var r4Applied = applyEdit(POM_ONE, editsFor(r4, r4Pom)[0]);
test(r4Applied.indexOf("{ name: " + Q + "demo/NewThing" + Q) < r4Applied.lastIndexOf(']'),
  'plain pom: the new entry is inserted before the array close');

// =========================================================================
section('ScaffoldHandler — pom append: trailing comma + decoy brackets');

var POM_TRAILING = [
  'foam.POM({',
  "  name: 'files: [ decoy ]',",
  '  files: [',
  '    { name: "A]", flags: "js" },',
  '  ]',
  '});',
  ''
].join('\n');

var r5Root = tmpRoot();
var r5Dir  = mkdir(path.join(r5Root, 'demo'));
var r5Pom  = write(path.join(r5Root, 'pom.js'), POM_TRAILING);

var r5    = handler.newClass({ dir: r5Dir, name: 'NewThing' });
var r5Out = appliedPom(r5, r5Pom, POM_TRAILING);

test(!! r5Out, 'trailing comma: the appended source eval-parses');
test(r5Out.files.length === 2, 'trailing comma: no duplicated comma, no empty slot');
test(r5Out.files[1].name === 'demo/NewThing', 'trailing comma: the new entry is the last one');
test(r5Out.files[0].name === 'A]', 'decoy: a ] inside a quoted value did not close the array early');
test(r5Out.name === 'files: [ decoy ]', 'decoy: a files: [ ... ] inside a string was not mistaken for the key');

// =========================================================================
section('ScaffoldHandler — pom append: comments and empty array');

var POM_COMMENTS = [
  'foam.POM({',
  "  name: 'demo',",
  '  // files: [ this comment does not count ]',
  '  files: [',
  "    { name: 'A', flags: 'js' }  // don't be fooled by this apostrophe",
  '  ]',
  '});',
  ''
].join('\n');

var r6Root = tmpRoot();
var r6Dir  = mkdir(path.join(r6Root, 'demo'));
var r6Pom  = write(path.join(r6Root, 'pom.js'), POM_COMMENTS);

var r6    = handler.newClass({ dir: r6Dir, name: 'NewThing' });
var r6Out = appliedPom(r6, r6Pom, POM_COMMENTS);

test(!! r6Out, 'comments: the appended source eval-parses');
test(!! r6Out && r6Out.files.length === 2, 'comments: entry appended after the commented last entry');
test(!! r6Out && r6Out.files[1].name === 'demo/NewThing', 'comments: the new entry is the last one');

var POM_EMPTY = [
  'foam.POM({',
  "  name: 'demo',",
  '  files: [',
  '  ]',
  '});',
  ''
].join('\n');

var r7Root = tmpRoot();
var r7Dir  = mkdir(path.join(r7Root, 'demo'));
var r7Pom  = write(path.join(r7Root, 'pom.js'), POM_EMPTY);

var r7    = handler.newClass({ dir: r7Dir, name: 'First' });
var r7Out = appliedPom(r7, r7Pom, POM_EMPTY);

test(!! r7Out, 'empty array: the appended source eval-parses');
test(!! r7Out && r7Out.files.length === 1 && r7Out.files[0].name === 'demo/First',
  'empty array: the first entry is added with no stray comma');

var r7Applied = applyEdit(POM_EMPTY, editsFor(r7, r7Pom)[0]);
test(! /\n[ \t]+\n/.test(r7Applied), 'empty array: no whitespace-only line is left behind');

// The one-line form has no newline in front of its ']' to reuse, so the edit
// has to supply one.
var POM_EMPTY_INLINE = [
  'foam.POM({',
  "  name: 'demo',",
  '  files: []',
  '});',
  ''
].join('\n');

var r7bRoot = tmpRoot();
var r7bDir  = mkdir(path.join(r7bRoot, 'demo'));
var r7bPom  = write(path.join(r7bRoot, 'pom.js'), POM_EMPTY_INLINE);

var r7b    = handler.newClass({ dir: r7bDir, name: 'First' });
var r7bOut = appliedPom(r7b, r7bPom, POM_EMPTY_INLINE);
test(!! r7bOut && r7bOut.files.length === 1 && r7bOut.files[0].name === 'demo/First',
  'inline empty array: the first entry is added and the source eval-parses');

// =========================================================================
section('ScaffoldHandler — pom that cannot be appended to');

var POM_NO_FILES = [
  'foam.POM({',
  "  name: 'demo',",
  '  projects: [',
  "    { name: 'sub/pom' }",
  '  ]',
  '});',
  ''
].join('\n');

var r8Root = tmpRoot();
var r8Dir  = mkdir(path.join(r8Root, 'demo'));
var r8Pom  = write(path.join(r8Root, 'pom.js'), POM_NO_FILES);

var r8 = handler.newClass({ dir: r8Dir, name: 'Orphan' });

test(!! contentOf(r8, path.join(r8Dir, 'Orphan.js')), 'no files: key: the class file is still created');
test(r8.result.pomUpdated === false, 'no files: key: pomUpdated false');
test(typeof r8.result.warning === 'string' && /pom/i.test(r8.result.warning),
  'no files: key: warning names the pom');
test(editsFor(r8, r8Pom) === null, 'no files: key: the pom gets no edit at all');
test(r8.edit.documentChanges.length === 2, 'no files: key: documentChanges is create + content only');
test(fs.readFileSync(r8Pom, 'utf8') === POM_NO_FILES, 'no files: key: the pom on disk is untouched');

// Two foam.POM() calls in one file — ambiguous, refuse rather than guess.
var r9Root = tmpRoot();
var r9Dir  = mkdir(path.join(r9Root, 'demo'));
write(path.join(r9Root, 'pom.js'), POM_ONE + POM_ONE);

var r9 = handler.newClass({ dir: r9Dir, name: 'Ambiguous' });
test(r9.result.pomUpdated === false, 'two POM calls: pomUpdated false');
test(typeof r9.result.warning === 'string' && /pom/i.test(r9.result.warning),
  'two POM calls: warning names the pom');

// =========================================================================
section('ScaffoldHandler — nearest pom.js wins');

var r10Root = tmpRoot();
var r10Dir  = mkdir(path.join(r10Root, 'src', 'foam', 'demo'));
var outerPom = write(path.join(r10Root, 'src', 'pom.js'), POM_ONE);
var innerPom = write(path.join(r10Root, 'src', 'foam', 'pom.js'), POM_ONE);

var r10 = handler.newClass({ dir: r10Dir, name: 'Nearest' });

test(editsFor(r10, innerPom) !== null, 'walk-up: the closest ancestor pom.js is the one edited');
test(editsFor(r10, outerPom) === null, 'walk-up: the further pom.js is left alone');

var r10Out = appliedPom(r10, innerPom, POM_ONE);
test(!! r10Out && r10Out.files[1].name === 'demo/Nearest',
  'walk-up: entry name is relative to the CLOSEST pom dir');

// No pom.js anywhere above the target dir.
var r11Root = tmpRoot();
var r11Dir  = mkdir(path.join(r11Root, 'loose'));
var r11 = handler.newClass({ dir: r11Dir, name: 'Loose' });

test(!! contentOf(r11, path.join(r11Dir, 'Loose.js')), 'no pom: the class file is still created');
test(r11.result.pomUpdated === false, 'no pom: pomUpdated false');
test(typeof r11.result.warning === 'string' && /pom/i.test(r11.result.warning),
  'no pom: warning names the missing pom');

// =========================================================================
section('ScaffoldHandler — argument validation');

function throws(fn) {
  try { fn(); return false; } catch (e) { return true; }
}

var r12Root = tmpRoot();
var r12Dir  = mkdir(path.join(r12Root, 'demo'));
write(path.join(r12Dir, 'Taken.js'), 'foam.CLASS({ name: "Taken" });\n');

test(throws(function() { handler.newClass({ dir: r12Dir, name: 'Taken' }); }),
  'validation: refuses to scaffold over an existing file');
test(throws(function() { handler.newClass({ dir: r12Dir, name: 'lowerCase' }); }),
  'validation: refuses a name that is not a FOAM class name');
test(throws(function() { handler.newClass({ dir: r12Dir, name: 'Bad Name' }); }),
  'validation: refuses a name with a space');
test(throws(function() { handler.newClass({ dir: path.join(r12Root, 'nope'), name: 'X' }); }),
  'validation: refuses a directory that does not exist');
test(throws(function() { handler.newClass({ name: 'X' }); }),
  'validation: refuses a missing dir argument');

// =========================================================================
section('ScaffoldHandler — workspace containment');

// The command is reachable from agent/MCP callers, not only an editor
// prompt, so a wsRoot-bearing handler must refuse to write outside it.
var wsRootFixture = tmpRoot();
var insideDir     = mkdir(path.join(wsRootFixture, 'src', 'foam', 'inside'));
write(path.join(wsRootFixture, 'src', 'pom.js'), POM_ONE);
var outsideRoot   = tmpRoot();
var outsideDir    = mkdir(path.join(outsideRoot, 'elsewhere'));

var boundHandler = foam.parse.lsp.handlers.ScaffoldHandler.create({ wsRoot: wsRootFixture });

var inside = boundHandler.newClass({ dir: insideDir, name: 'Inside' });
test(!! contentOf(inside, path.join(insideDir, 'Inside.js')),
  'containment: a folder inside the workspace scaffolds normally');
test(throws(function() { boundHandler.newClass({ dir: outsideDir, name: 'Outside' }); }),
  'containment: a folder outside the workspace is refused');
test(throws(function() {
  boundHandler.newClass({ dir: path.join(insideDir, '..', '..', '..', '..', 'elsewhere'), name: 'Sneaky' });
}), 'containment: .. segments cannot climb out of the workspace');
test(!! contentOf(boundHandler.newClass({ dir: wsRootFixture, name: 'AtRoot' }), path.join(wsRootFixture, 'AtRoot.js')),
  'containment: the workspace root itself counts as inside');
test(!! contentOf(handler.newClass({ dir: outsideDir, name: 'Unbound' }), path.join(outsideDir, 'Unbound.js')),
  'containment: a handler with no wsRoot (test use) applies no check');

// With wsRoot set, the pom walk-up stops there too — it must not reach out
// and edit an unrelated pom.js further up the filesystem.
var noPomWs  = tmpRoot();
var noPomDir = mkdir(path.join(noPomWs, 'sub'));
var capped   = foam.parse.lsp.handlers.ScaffoldHandler.create({ wsRoot: noPomWs })
  .newClass({ dir: noPomDir, name: 'Capped' });
test(capped.result.pomUpdated === false && /pom/i.test(capped.result.warning || ''),
  'containment: a workspace with no pom.js of its own does not adopt one from above');

// --- cleanup --------------------------------------------------------------
roots_.forEach(function(d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
});

// =========================================================================
// server.js wiring, driven in-process. The command advertisement, the
// scaffold branch of workspace/executeCommand, and throwIfDeclined_ are only
// reachable by booting server.js and talking real JSON-RPC to it — the same
// in-process lane config.js and i18n.js use. withServerLane serializes it
// against those: only one lane may hold process.stdin/stdout at a time.
var laneDone = h.withServerLane(async function() {
  var origWrite = process.stdout.write;
  var wsDir     = null;
  try {
    var frames = [];
    var inBuf  = Buffer.alloc(0);
    function drain() {
      while ( true ) {
        var headerEnd = inBuf.indexOf('\r\n\r\n');
        if ( headerEnd === -1 ) return;
        var m = /Content-Length:\s*(\d+)/i.exec(inBuf.slice(0, headerEnd).toString('utf8'));
        if ( ! m ) { inBuf = inBuf.slice(headerEnd + 4); continue; }
        var len = parseInt(m[1], 10), bodyStart = headerEnd + 4;
        if ( inBuf.length < bodyStart + len ) return;
        var body = inBuf.slice(bodyStart, bodyStart + len).toString('utf8');
        inBuf = inBuf.slice(bodyStart + len);
        try { frames.push(JSON.parse(body)); } catch (e) {}
      }
    }
    process.stdout.write = function(chunk) {
      inBuf = Buffer.concat([ inBuf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8') ]);
      drain();
      return true;
    };

    function sendToServer(msg) {
      var json = JSON.stringify(msg);
      process.stdin.emit('data', Buffer.from(
        'Content-Length: ' + Buffer.byteLength(json) + '\r\n\r\n' + json, 'utf8'));
    }
    // `from` scopes the search to frames that arrived after a given point, so
    // the second dispatch can't match the first one's applyEdit.
    function waitFor(pred, what, from) {
      return new Promise(function(resolve, reject) {
        var deadline = Date.now() + 20000;
        (function poll() {
          for ( var i = from || 0 ; i < frames.length ; i++ ) if ( pred(frames[i]) ) return resolve(frames[i]);
          if ( Date.now() > deadline ) return reject(new Error('timed out waiting for ' + what));
          setTimeout(poll, 10);
        })();
      });
    }

    // Only one server instance may hold the stdin 'data' listener, and the
    // 'end' -> process.exit(0) listener start() installs would kill the whole
    // run on the runner's own stdin EOF.
    process.stdin.removeAllListeners('data');
    require('../../lsp/server').start();
    process.stdin.removeAllListeners('end');
    frames = [];
    inBuf  = Buffer.alloc(0);

    // A workspace with a pom and a target folder inside it, so the happy path
    // exercises all three documentChanges AND the wsRoot the server sets.
    wsDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'flsp-scaffold-ws-'));
    var wsSrc = path.join(wsDir, 'src', 'foam', 'lane');
    fs.mkdirSync(wsSrc, { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'src', 'pom.js'), POM_ONE);
    fs.writeFileSync(path.join(wsSrc, 'Sibling.js'), HEADER + "\nfoam.CLASS({ name: 'Sibling' });\n");

    section('server.js — foam.scaffold.newClass over JSON-RPC');

    sendToServer({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      rootUri: 'file://' + wsDir, initializationOptions: {} } });
    var initRes = await waitFor(function(f) { return f.id === 1 && f.result; }, 'the initialize response');
    var cmds = ( initRes.result.capabilities.executeCommandProvider || {} ).commands || [];
    test(cmds.indexOf('foam.scaffold.newClass') !== -1,
      'foam.scaffold.newClass is advertised in executeCommandProvider.commands');

    // --- happy path: client applies the edit ------------------------------
    var mark = frames.length;
    sendToServer({ jsonrpc: '2.0', id: 2, method: 'workspace/executeCommand', params: {
      command: 'foam.scaffold.newClass', arguments: [ { dir: wsSrc, name: 'LaneClass' } ] } });

    var applyReq = await waitFor(function(f) {
      return f.method === 'workspace/applyEdit';
    }, 'the outbound workspace/applyEdit', mark);
    var dcs = applyReq.params.edit.documentChanges;
    test(applyReq.params.label === 'FOAM: New Class', 'the applyEdit is labelled FOAM: New Class');
    test(dcs.length === 3, 'the edit carries create + file content + pom append');
    test(dcs[0].kind === 'create' && dcs[0].uri === 'file://' + path.join(wsSrc, 'LaneClass.js'),
      'the CreateFile names the new class file');
    test(/foam\.CLASS\(\{/.test(dcs[1].edits[0].newText), 'the second change carries the class template');
    test(dcs[2].textDocument.uri === 'file://' + path.join(wsDir, 'src', 'pom.js'),
      'the third change targets the workspace pom.js');

    sendToServer({ jsonrpc: '2.0', id: applyReq.id, result: { applied: true } });
    var cmdRes = await waitFor(function(f) { return f.id === 2 && 'result' in f; },
      'the executeCommand response', mark);
    test(cmdRes.result && cmdRes.result.created === 'file://' + path.join(wsSrc, 'LaneClass.js'),
      'the command answers with result.created');
    test(cmdRes.result && cmdRes.result.pomUpdated === true, 'the command answers with pomUpdated: true');

    // --- the client declines the edit -------------------------------------
    mark = frames.length;
    sendToServer({ jsonrpc: '2.0', id: 3, method: 'workspace/executeCommand', params: {
      command: 'foam.scaffold.newClass', arguments: [ { dir: wsSrc, name: 'DeclinedClass' } ] } });
    var applyReq2 = await waitFor(function(f) { return f.method === 'workspace/applyEdit'; },
      'the second applyEdit', mark);
    sendToServer({ jsonrpc: '2.0', id: applyReq2.id,
      result: { applied: false, failureReason: 'user said no' } });

    var errMsg = await waitFor(function(f) {
      return f.method === 'window/showMessage' && f.params.type === 1;
    }, 'the error showMessage for a declined edit', mark);
    test(/did not apply the edit/.test(errMsg.params.message),
      'a declined applyEdit is reported as an error, not silently swallowed');
    test(/user said no/.test(errMsg.params.message),
      'the client\'s failureReason travels with it');
    var declRes = await waitFor(function(f) { return f.id === 3 && 'result' in f; },
      'the declined command response', mark);
    test(declRes.result === null, 'a failed command still answers the request (with null)');

    // --- containment, end to end ------------------------------------------
    mark = frames.length;
    sendToServer({ jsonrpc: '2.0', id: 4, method: 'workspace/executeCommand', params: {
      command: 'foam.scaffold.newClass',
      arguments: [ { dir: fs.realpathSync(os.tmpdir()), name: 'Outside' } ] } });
    var outErr = await waitFor(function(f) {
      return f.method === 'window/showMessage' && f.params.type === 1;
    }, 'the error showMessage for an out-of-workspace dir', mark);
    test(/outside the workspace/.test(outErr.params.message),
      'the server refuses a dir outside the workspace root it was initialized with');
    test(! frames.slice(mark).some(function(f) { return f.method === 'workspace/applyEdit'; }),
      'a refused dir produces no applyEdit at all');
  } catch (e) {
    test(false, 'scaffold server lane threw: ' + ( e && e.stack ? e.stack : e ));
  } finally {
    process.stdout.write = origWrite;
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('end');
    process.stdin.pause();
    if ( wsDir ) { try { fs.rmSync(wsDir, { recursive: true, force: true }); } catch (e) {} }
  }
});

module.exports = { done: laneDone };
