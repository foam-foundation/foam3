/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Split from testFoamLSP.js — FeatureConfig tests.
// Shared harness (test/section + boot-time handlers) is required once
// by the entrypoint; this module reads its own copy.
//
// Pure module tests — FeatureConfig is a plain Node module (not foam.CLASS),
// so this category needs none of the pmake-booted FOAM instances the other
// categories share; it only borrows test()/section() from the harness.

var h = require('./_harness');
var test = h.test, section = h.section;

var FeatureConfig = require('../../lsp/FeatureConfig');
var fs = require('fs'), path = require('path'), os = require('os');

section('FeatureConfig — defaults');

var c = FeatureConfig.load({ rootPath: os.tmpdir() + '/no-such-dir-xyz' });
test(c.enabled('diagnostics.i18n') === true, 'default on');
test(c.enabled('codeLens.hierarchy') === false, 'hierarchy default off');
test(c.warnings.length === 0, 'no warnings on missing file');

section('FeatureConfig — foam-lsp.json overrides defaults');

var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flsp-'));
fs.writeFileSync(path.join(dir, 'foam-lsp.json'),
  JSON.stringify({ features: { 'diagnostics.i18n': false, 'codeLens.hierarchy': true } }));
c = FeatureConfig.load({ rootPath: dir });
test(c.enabled('diagnostics.i18n') === false, 'file overrides default');
test(c.enabled('codeLens.hierarchy') === true, 'file can enable');

section('FeatureConfig — initOptions override file');

c = FeatureConfig.load({ rootPath: dir,
  initOptions: { features: { 'diagnostics.i18n': true } } });
test(c.enabled('diagnostics.i18n') === true, 'initOptions beat file');
test(c.enabled('codeLens.hierarchy') === true, 'file survives where initOptions silent');

section('FeatureConfig — unknown keys warn once, ignored');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'),
  JSON.stringify({ features: { notAFlag: true } }));
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.some(function(w) { return w.indexOf('notAFlag') !== -1; }), 'unknown key warned');
test(c.enabled('hover') === true, 'defaults intact after unknown key');

section('FeatureConfig — unknown key via initOptions warns once, ignored');

// Reset the file back to something benign so this section's warnings are
// only about the initOptions path under test — otherwise the leftover
// notAFlag file from the previous section would add its own unrelated
// warning here (harmless to the assertion below, which only checks for
// 'alsoNotAFlag', but muddies what this section is meant to demonstrate).
fs.writeFileSync(path.join(dir, 'foam-lsp.json'), JSON.stringify({}));
c = FeatureConfig.load({ rootPath: dir, initOptions: { features: { alsoNotAFlag: true } } });
test(c.warnings.some(function(w) { return w.indexOf('alsoNotAFlag') !== -1; }), 'unknown initOptions key warned');
test(c.enabled('hover') === true, 'defaults intact after unknown initOptions key');

section('FeatureConfig — non-boolean feature value coerces to false');

c = FeatureConfig.load({ rootPath: dir, initOptions: { features: { hover: 'yes' } } });
test(c.enabled('hover') === false, 'non-boolean value coerces to false, not truthy-passthrough');

section('FeatureConfig — malformed JSON warns + falls back to defaults');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'), '{ nope');
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.length === 1 && c.enabled('completion') === true, 'malformed -> defaults + warning');

section('FeatureConfig — valid JSON that is not an object warns + falls back to defaults');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'), '[1,2]');
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.length === 1 && c.enabled('completion') === true, 'non-object JSON -> defaults + warning');

section('FeatureConfig — JSON literal null warns + falls back to defaults');

// `null` parses successfully (unlike '{ nope') but is not an object either
// (unlike '[1,2]', it can't even be told apart from "parse failed" by a
// `parsed !== null` check) — must land in the same non-object warn path.
fs.writeFileSync(path.join(dir, 'foam-lsp.json'), 'null');
c = FeatureConfig.load({ rootPath: dir });
test(c.warnings.length === 1 && c.enabled('completion') === true, 'null literal -> defaults + warning');

section('FeatureConfig — i18n section merges through the same layers');

fs.writeFileSync(path.join(dir, 'foam-lsp.json'),
  JSON.stringify({ i18n: { languages: ['fr'], model: 'm1' } }));
c = FeatureConfig.load({ rootPath: dir, initOptions: { i18n: { model: 'm2' } } });
test(c.i18n.model === 'm2' && (c.i18n.languages || [])[0] === 'fr', 'i18n per-key precedence');
