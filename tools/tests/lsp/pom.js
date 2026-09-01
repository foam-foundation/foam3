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
