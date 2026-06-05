/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// POM membership diagnostics + pull-diagnostic shape.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, diagHandler = h.diagHandler;


// === PomValidator — orphans / missing / duplicates ===

section('PomValidator');

index.buildFileIndex();

var validator = foam.parse.lsp.handlers.PomValidator.create({ index: index });
var result    = validator.validate();

test(result && typeof result === 'object', 'PomValidator.validate returns an object');
test(Array.isArray(result.orphans),    'result.orphans is an array');
test(Array.isArray(result.missing),    'result.missing is an array');
test(Array.isArray(result.duplicates), 'result.duplicates is an array');

// Missing should be exactly zero on a healthy checkout — every POM entry
// should resolve to a real file.
test(result.missing.length === 0,
  'No POM entries point at missing files (count=' + result.missing.length + ')');


// === Pull diagnostics — DiagnosticsHandler shape suitable for textDocument/diagnostic ===

section('Pull-diagnostic shape');

// The dispatch in server.js for textDocument/diagnostic wraps existing
// DiagnosticsHandler output. Smoke-test the handler shape so the wire
// format stays valid.
var unknownText = "foam.CLASS({\n  extends: 'foo.bar.Nonexistent'\n});";
var diags = diagHandler.handle(unknownText, 'file:///t');
test(Array.isArray(diags), 'DiagnosticsHandler.handle returns an array (ready for pull-diagnostic wrap)');
test(diags.every(function(d) { return d.range && typeof d.message === 'string'; }),
  'each diagnostic has range + message');
