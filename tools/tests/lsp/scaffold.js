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

// --- cleanup --------------------------------------------------------------
roots_.forEach(function(d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
});
