/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// pom-entry validation tests: grammar position harvest for pom values,
// PomValidator entry-level checks, editor diagnostics gating, and the
// foam/validatePoms aggregation.

var h = require('./_harness');
var test = h.test, section = h.section;
var grammar = h.grammar;

section('FoamClassGrammar — pom value position harvest');

// collectAxiomPositions returns, per kind, a map keyed by the harvested
// string CONTENT: single-occurrence kinds (pomFileName) hold one record,
// MULTI kinds (the new pomFlagValue / pomJavaFileName) hold an array —
// flag strings like 'js' repeat across entries, so every span matters.

var POM_SRC = "foam.POM({\n  name: 'demo',\n  files: [\n" +
  "    { name: 'foam/core/Good', flags: 'js|java' },\n" +
  "    { name: 'foam/core/Bad ', flags: 'js |java' }\n  ]\n});\n";

var pomMap = grammar.collectAxiomPositions(POM_SRC);

test(!! pomMap.pomFileName['foam/core/Good'] && !! pomMap.pomFileName['foam/core/Bad '],
  'pomFileName: both files: name values harvested, trailing space preserved in the key');
test(!! pomMap.pomFlagValue, 'pomFlagValue kind exists in the harvest map');

var badFlag = pomMap.pomFlagValue && pomMap.pomFlagValue['js |java'];
test(Array.isArray(badFlag) && badFlag.length === 1,
  'pomFlagValue is a MULTI kind — records arrive as arrays');
test(!! badFlag &&
  POM_SRC.slice(badFlag[0].startPos, badFlag[0].endPos) === 'js |java',
  'pomFlagValue span covers the string CONTENT exactly (quotes excluded)');

var goodFlag = pomMap.pomFlagValue && pomMap.pomFlagValue['js|java'];
test(Array.isArray(goodFlag) && goodFlag.length === 1,
  'clean flag value harvested too — the validator, not the grammar, judges');

var JAVA_POM_SRC = "foam.POM({\n  name: 'j',\n  javaFiles: [\n" +
  "    { name: 'foam/core/SomeJava', flags: 'test' }\n  ]\n});\n";
var javaMap = grammar.collectAxiomPositions(JAVA_POM_SRC);
var javaName = javaMap.pomJavaFileName && javaMap.pomJavaFileName['foam/core/SomeJava'];
test(Array.isArray(javaName) && javaName.length === 1 &&
  JAVA_POM_SRC.slice(javaName[0].startPos, javaName[0].endPos) === 'foam/core/SomeJava',
  'pomJavaFileName: javaFiles: name value harvested with exact span');

// A flag string that appears in two entries must yield two spans — the
// whole reason the new kinds are MULTI.
var DUP_SRC = "foam.POM({\n  name: 'd',\n  files: [\n" +
  "    { name: 'A', flags: 'js' },\n" +
  "    { name: 'B', flags: 'js' }\n  ]\n});\n";
var dupMap = grammar.collectAxiomPositions(DUP_SRC);
var dupFlags = dupMap.pomFlagValue && dupMap.pomFlagValue['js'];
test(Array.isArray(dupFlags) && dupFlags.length === 2,
  'duplicate flag strings keep BOTH spans (dedupe by startPos happens downstream)');

section('PomValidator.validateEntries — whitespace, unknown flags, missing files');

var fs   = require('fs');
var os   = require('os');
var path = require('path');

var validator = foam.parse.lsp.handlers.PomValidator.create({ index: h.index });

function issuesFor(src, pomPath) {
  return validator.validateEntries(src, pomPath || null);
}
function codes(issues) {
  return issues.map(function(i) { return i.code; }).sort().join(',');
}

// (a) whitespace inside a flag token -> ERROR naming the exact token
var fa = issuesFor("foam.POM({\n  files: [ { name: 'A', flags: 'js |java' } ]\n});\n");
test(fa.length === 1 && fa[0].code === 'pom-flag-whitespace' && fa[0].severity === 1,
  'flag token with whitespace -> one pom-flag-whitespace ERROR');
test(fa.length === 1 && fa[0].message.indexOf("'js '") !== -1,
  'the message quotes the exact offending token');

// (b) whitespace in a file name -> ERROR
var fb = issuesFor("foam.POM({\n  files: [ { name: 'foam/core/Bad ', flags: 'js' } ]\n});\n");
test(fb.length === 1 && fb[0].code === 'pom-name-whitespace' && fb[0].severity === 1,
  'trailing space in name -> pom-name-whitespace ERROR');

// (c) unknown flag token -> WARNING naming it
var fc = issuesFor("foam.POM({\n  files: [ { name: 'A', flags: 'js|java&tets' } ]\n});\n");
test(fc.length === 1 && fc[0].code === 'pom-flag-unknown' && fc[0].severity === 2,
  'misspelled flag -> pom-flag-unknown WARNING (vocabulary drifts, so never ERROR)');
test(fc.length === 1 && fc[0].message.indexOf("'tets'") !== -1,
  'the warning names the unknown token');

// (c2) empty token from a double pipe -> whitespace-variant ERROR
var fc2 = issuesFor("foam.POM({\n  files: [ { name: 'A', flags: 'js||java' } ]\n});\n");
test(fc2.length === 1 && fc2[0].code === 'pom-flag-whitespace' &&
  fc2[0].message.indexOf('empty flag token') !== -1,
  'a double | yields an empty token -> pom-flag-whitespace variant message');

// (d) file existence, only when a pomPath is given
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pomv-'));
fs.writeFileSync(path.join(tmp, 'Good.js'), '// exists\n');
var DISK_SRC = "foam.POM({\n  files: [\n" +
  "    { name: 'Good', flags: 'js' },\n" +
  "    { name: 'Ghost', flags: 'js' }\n  ]\n});\n";
var fd = issuesFor(DISK_SRC, path.join(tmp, 'pom.js'));
test(codes(fd) === 'pom-file-missing',
  'existing file passes, missing file -> exactly one pom-file-missing ERROR');
test(fd[0] && fd[0].severity === 1 && fd[0].message.indexOf('Ghost') !== -1,
  'pom-file-missing is an ERROR naming the entry');

// (d2) javaFiles resolve against .java, not .js
fs.writeFileSync(path.join(tmp, 'RealJava.java'), '// exists\n');
var JD_SRC = "foam.POM({\n  javaFiles: [\n" +
  "    { name: 'RealJava' },\n" +
  "    { name: 'GhostJava' }\n  ]\n});\n";
var fj = issuesFor(JD_SRC, path.join(tmp, 'pom.js'));
test(codes(fj) === 'pom-file-missing' && fj[0].message.indexOf('GhostJava') !== -1,
  'javaFiles entries resolve name + .java relative to the pom dir');

// (d3) no pomPath -> existence checks skipped entirely
var fd3 = issuesFor(DISK_SRC, null);
test(fd3.length === 0, 'without a pomPath (unit fixture) no existence check runs');

// (e) clean pom -> no issues
var fe = issuesFor("foam.POM({\n  files: [ { name: 'A', flags: 'js|java&test' } ]\n});\n", null);
test(fe.length === 0, 'clean fixture -> []');

// offsets point into the text so the diagnostics layer can map to line/char
test(fa[0] && typeof fa[0].start === 'number' && typeof fa[0].end === 'number' &&
  fa[0].end > fa[0].start,
  'issues carry start/end offsets into the source text');

section('DiagnosticsHandler — pom diagnostics, gated by diagnostics.pom');

var FeatureConfig = require('../../lsp/FeatureConfig');

function diagHandlerFor(features) {
  return foam.parse.lsp.handlers.DiagnosticsHandler.create({
    index:        h.index,
    pomValidator: validator,
    featureConfig: features ?
      FeatureConfig.load({ initOptions: { features: features } }) : null
  });
}

var BAD_POM = "foam.POM({\n  name: 'x',\n  files: [\n" +
  "    { name: 'A', flags: 'js |java' }\n  ]\n});\n";

// The uri must resolve to a real directory containing A.js, or the
// existence check adds a second (pom-file-missing) diagnostic.
var diagTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pomd-'));
fs.writeFileSync(path.join(diagTmp, 'A.js'), '// exists\n');
var BAD_POM_URI = 'file://' + path.join(diagTmp, 'pom.js');

var dh    = diagHandlerFor(null);
var diags = dh.handle(BAD_POM, BAD_POM_URI);
test(Array.isArray(diags) && diags.length === 1,
  'a pom.js text produces diagnostics through the normal handle() entry point');
test(!! diags[0] && diags[0].code === 'pom-flag-whitespace' && diags[0].severity === 1,
  'the pom-flag-whitespace ERROR comes through with its code and severity');
test(!! diags[0] && diags[0].source === 'foam-lsp',
  'diagnostic source is foam-lsp');
// span check: 'js |java' starts on line 3 (0-based) after "    { name: 'A', flags: '"
test(!! diags[0] && diags[0].range && diags[0].range.start.line === 3 &&
  diags[0].range.end.line === 3 && diags[0].range.end.character > diags[0].range.start.character,
  'offsets map to the correct line/char range');

var dhOff = diagHandlerFor({ 'diagnostics.pom': false });
test(dhOff.handle(BAD_POM, BAD_POM_URI).length === 0,
  'diagnostics.pom: false suppresses the pom diagnostics');

var dhOn = diagHandlerFor({ 'diagnostics.pom': true });
test(dhOn.handle(BAD_POM, BAD_POM_URI).length === 1,
  'explicit diagnostics.pom: true keeps them (and the flag name is known to FeatureConfig)');

test(FeatureConfig.load({}).enabled('diagnostics.pom') === true,
  'diagnostics.pom defaults ON');
